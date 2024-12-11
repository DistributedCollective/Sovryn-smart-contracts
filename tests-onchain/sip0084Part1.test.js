// first run a local forked mainnet node in a separate terminal window:
//     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
// now run the test:
//     npx hardhat test tests-onchain/sip0084Part1.test.js --network rskForkedMainnet

const {
    impersonateAccount,
    mine,
    time,
    setBalance,
} = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");
const { getProtocolModules } = require("../deployment/helpers/helpers");

const {
    ethers,
    deployments: { createFixture, get },
} = hre;

const MAX_DURATION = ethers.BigNumber.from(24 * 60 * 60).mul(1092);

const ONE_RBTC = ethers.utils.parseEther("1.0");

const getImpersonatedSigner = async (addressToImpersonate) => {
    await impersonateAccount(addressToImpersonate);
    return await ethers.getSigner(addressToImpersonate);
};

describe("SIP-0084 Part 1 test onchain", () => {
    const getImpersonatedSignerFromJsonRpcProvider = async (addressToImpersonate) => {
        const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
        await provider.send("hardhat_impersonateAccount", [addressToImpersonate]);
        return provider.getSigner(addressToImpersonate);
    };

    const setupTest = createFixture(async ({ deployments }) => {
        const deployer = (await ethers.getSigners())[0].address;
        const deployerSigner = await ethers.getSigner(deployer);

        const multisigAddress = (await get("MultiSigWallet")).address;
        const multisigSigner = await getImpersonatedSignerFromJsonRpcProvider(multisigAddress);

        await setBalance(deployer, ONE_RBTC.mul(10));
        await deployments.fixture(["ProtocolModules"], {
            keepExistingDeployments: true,
        }); // start from a fresh deployments

        const staking = await ethers.getContract("Staking", deployerSigner);
        const sovrynProtocol = await ethers.getContract("SovrynProtocol", deployerSigner);

        const god = await deployments.get("GovernorAdmin");
        const governorAdmin = await ethers.getContractAt(
            "GovernorAlpha",
            god.address,
            deployerSigner
        );
        const governorAdminSigner = await getImpersonatedSigner(god.address);

        await setBalance(governorAdminSigner.address, ONE_RBTC);
        const timelockOwner = await ethers.getContract("TimelockOwner", governorAdminSigner);

        const timelockOwnerSigner = await getImpersonatedSignerFromJsonRpcProvider(
            timelockOwner.address
        );
        await setBalance(timelockOwnerSigner._address, ONE_RBTC);

        //
        return {
            deployer,
            deployerSigner,
            staking,
            sovrynProtocol,
            governorAdmin,
            governorAdminSigner,
            timelockOwner,
            timelockOwnerSigner,
            multisigAddress,
            multisigSigner,
        };
    });

    describe("SIP-0084 Part 1 Test creation and execution", () => {
        it("SIP-0084 Part 1 is executable and valid", async () => {
            expect(hre.network.tags["forked"], "ERROR: Must run on a forked net").equal(true);
            await hre.network.provider.request({
                method: "hardhat_reset",
                params: [
                    {
                        forking: {
                            jsonRpcUrl: "https://mainnet-dev.sovryn.app/rpc",
                            blockNumber: 6926710,
                        },
                    },
                ],
            });

            const {
                deployer,
                deployerSigner,
                staking,
                governorAdmin,
                timelockOwnerSigner,
                multisigAddress,
                multisigSigner,
            } = await setupTest();

            // CREATE PROPOSAL
            const sov = await ethers.getContract("SOV", timelockOwnerSigner);
            const whaleAmount = (await sov.totalSupply()).mul(ethers.BigNumber.from(5));
            await sov.mint(deployer, whaleAmount);

            await sov.connect(deployerSigner).approve(staking.address, whaleAmount);

            if (await staking.paused()) await staking.connect(multisigSigner).pauseUnpause(false);
            const kickoffTS = await staking.kickoffTS();
            await staking.stake(
                whaleAmount,
                ethers.BigNumber.from(Date.now()).add(MAX_DURATION),
                deployer,
                deployer
            );
            await mine();

            // CREATE PROPOSAL AND VERIFY
            const proposalIdBeforeSIP = await governorAdmin.latestProposalIds(deployer);
            await hre.run("sips:create", { argsFunc: "getArgsSip0084Part1" });
            const proposalId = await governorAdmin.latestProposalIds(deployer);
            expect(
                proposalId,
                "Proposal was not created. Check the SIP creation is not commented out."
            ).is.gt(proposalIdBeforeSIP);

            // VOTE FOR PROPOSAL

            await mine();
            await governorAdmin.connect(deployerSigner).castVote(proposalId, true);

            // QUEUE PROPOSAL
            let proposal = await governorAdmin.proposals(proposalId);
            await mine(proposal.endBlock);
            await governorAdmin.queue(proposalId);

            const wrbtc = await ethers.getContract("WRBTC");
            const priceFeeds = await ethers.getContract("PriceFeeds");
            const previousWrbtcPriceFeeds = await priceFeeds.pricesFeeds(wrbtc.address);

            console.log(`previous WRBTC priceFeeds: ${previousWrbtcPriceFeeds}`);

            // EXECUTE PROPOSAL
            proposal = await governorAdmin.proposals(proposalId);
            await time.increaseTo(proposal.eta);
            await expect(governorAdmin.execute(proposalId))
                .to.emit(governorAdmin, "ProposalExecuted")
                .withArgs(proposalId);

            // VERIFY execution
            expect((await governorAdmin.proposals(proposalId)).executed).to.be.true;

            const expectedWrbtcPriceFeed = await get("PriceFeedsMoC");
            const latestWrbtcPriceFeeds = await priceFeeds.pricesFeeds(wrbtc.address);

            console.log(`latest WRBTC priceFeeds: ${latestWrbtcPriceFeeds}`);
            console.log(`expected WRBTC priceFeeds: ${expectedWrbtcPriceFeed.address}`);

            expect(latestWrbtcPriceFeeds).not.to.equal(previousWrbtcPriceFeeds);
            expect(expectedWrbtcPriceFeed.address).to.equal(latestWrbtcPriceFeeds);
        });
    });
});
