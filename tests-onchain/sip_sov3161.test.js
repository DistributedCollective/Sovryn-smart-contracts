//@note hh test tests-onchain/sip0047.test.js --network rskForkedMainnet

const {
    impersonateAccount,
    mine,
    time,
    setBalance,
} = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");

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

describe("Replace LoanOpenings module - borrowing from existing loan bug fix", () => {
    const getImpersonatedSignerFromJsonRpcProvider = async (addressToImpersonate) => {
        const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
        await provider.send("hardhat_impersonateAccount", [addressToImpersonate]);
        return provider.getSigner(addressToImpersonate);
    };

    const setupTest = createFixture(async ({ deployments, getNamedAccounts }) => {
        //const { deployer } = await getNamedAccounts();
        //const deployerSigner = await ethers.getSigner(deployer);
        //const deployer = "0xFEe171A152C02F336021fb9E79b4fAc2304a9E7E"; // has enough voting power to create a SIP
        // const deployerSigner = await getImpersonatedSignerFromJsonRpcProvider(
        //     deployerAddress.toLowerCase()
        // );
        const deployerSigner = (await ethers.getSigners())[0];
        const deployer = deployerSigner.address;

        await setBalance(deployer, ONE_RBTC.mul(10));

        const staking = await ethers.getContract("Staking", deployerSigner);
        const protocol = await ethers.getContract("ISovryn");

        const god = await deployments.get("GovernorOwner");
        const governorOwner = await ethers.getContractAt(
            "GovernorAlpha",
            god.address,
            deployerSigner
        );
        const governorOwnerSigner = await getImpersonatedSigner(god.address);

        await setBalance(governorOwnerSigner.address, ONE_RBTC);
        const timelockOwner = await ethers.getContract("TimelockOwner", governorOwnerSigner);

        const timelockOwnerSigner = await getImpersonatedSignerFromJsonRpcProvider(
            timelockOwner.address
        );
        await setBalance(timelockOwnerSigner._address, ONE_RBTC);

        await deployments.fixture("ReplaceProtocolModules", {
            keepExistingDeployments: true,
        });

        //
        return {
            deployer,
            deployerSigner,
            governorOwner,
            governorOwnerSigner,
            timelockOwner,
            timelockOwnerSigner,
            staking,
            protocol,
        };
    });

    describe("SIP for SOV-3161 Testing", () => {
        it("SIP is executable and valid", async () => {
            if (!(hre.network.tags["forked"] && hre.network.tags["mainnet"])) {
                console.error("ERROR: Must run on a forked mainnet");
                return;
            }
            await hre.network.provider.request({
                method: "hardhat_reset",
                params: [
                    {
                        forking: {
                            jsonRpcUrl: "https://mainnet-dev.sovryn.app/rpc",
                            blockNumber: 5796574, // block num at the time of the test creation with no fix applied yet
                        },
                    },
                ],
            });

            const {
                deployer,
                deployerSigner,
                governorOwner,
                timelockOwnerSigner,
                staking,
                protocol,
            } = await setupTest();

            // CREATE PROPOSAL
            const sov = await ethers.getContract("SOV", timelockOwnerSigner);
            const whaleAmount = (await sov.totalSupply()).mul(ethers.BigNumber.from(5));
            await sov.mint(deployer, whaleAmount);

            await sov.connect(deployerSigner).approve(staking.address, whaleAmount);

            if (await staking.paused()) await staking.connect(multisigSigner).pauseUnpause(false);
            const kickoffTS = await staking.kickoffTS();
            await staking.stake(whaleAmount, kickoffTS.add(MAX_DURATION), deployer, deployer);
            await mine();

            // CREATE PROPOSAL AND VERIFY
            const proposalIdBeforeSIP = await governorOwner.latestProposalIds(deployer);
            await hre.run("sips:create", { argsFunc: "getArgsSip_SOV_3161" });
            const proposalId = await governorOwner.latestProposalIds(deployer);
            expect(
                proposalId,
                "Proposal was not created. Check the SIP creation is not commented out."
            ).is.gt(proposalIdBeforeSIP);

            // VOTE FOR PROPOSAL

            await mine();
            await governorOwner.connect(deployerSigner).castVote(proposalId, true);

            // QUEUE PROPOSAL
            let proposal = await governorOwner.proposals(proposalId);
            await mine(proposal.endBlock);
            await governorOwner.queue(proposalId);

            // EXECUTE PROPOSAL
            proposal = await governorOwner.proposals(proposalId);
            await time.increaseTo(proposal.eta);
            await expect(governorOwner.execute(proposalId))
                .to.emit(governorOwner, "ProposalExecuted")
                .withArgs(proposalId);

            // VALIDATE EXECUTION
            expect(
                (await protocol.getTarget("setDelegatedManager(bytes32,address,bool)")) ==
                    (await get("LoanOpenings")).address
            ).to.be.true;
        });
    });
});
