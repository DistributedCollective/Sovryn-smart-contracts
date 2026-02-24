// first run a local forked mainnet node in a separate terminal window:
//     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
// now run the test:
//     npx hardhat test tests-onchain/sipRevertAmmOwnershipPart3.test.js --network rskForkedMainnet

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

describe("Revert AMM Ownership Part 3 (GovernorOwner) - Inverse of SIP-0046 Part 3", () => {
    const getImpersonatedSignerFromJsonRpcProvider = async (addressToImpersonate) => {
        const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
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
        });

        const staking = await ethers.getContract("Staking", deployerSigner);

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

        return {
            deployer,
            deployerSigner,
            staking,
            governorOwner,
            governorOwnerSigner,
            timelockOwner,
            timelockOwnerSigner,
            multisigAddress,
            multisigSigner,
        };
    });

    describe("SIP Revert AMM Ownership Part 3 - Test creation and execution", () => {
        it("SIP Revert AMM Ownership Part 3 is executable and valid", async () => {
            expect(hre.network.tags["forked"], "ERROR: Must run on a forked net").equal(true);
            await hre.network.provider.request({
                method: "hardhat_reset",
                params: [
                    {
                        forking: {
                            jsonRpcUrl: "https://mainnet-dev.sovryn.app/rpc",
                        },
                    },
                ],
            });

            const {
                deployer,
                deployerSigner,
                staking,
                governorOwner,
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
            const currentTS = ethers.BigNumber.from(
                (await ethers.provider.getBlock("latest")).timestamp
            );
            await staking.stake(whaleAmount, currentTS.add(MAX_DURATION), deployer, deployer);
            await mine();

            // CREATE PROPOSAL AND VERIFY
            const proposalIdBeforeSIP = await governorOwner.latestProposalIds(deployer);
            await hre.run("sips:create", { argsFunc: "getArgsSipRevertAmmOwnershipPart3" });
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

            // VERIFY execution
            expect((await governorOwner.proposals(proposalId)).executed).to.be.true;

            // Verify transferOwnership was called: newOwner() should be multisig for each converter
            const ownershipABI = [
                "function owner() view returns(address)",
                "function newOwner() view returns(address)",
            ];

            const converterDeploymentNames = [
                "AmmConverterDoc",
                "AmmConverterUsdt",
                "AmmConverterBpro",
                "AmmConverterBnb",
                "AmmConverterMoc",
                "AmmConverterXusd",
                "AmmConverterSov",
                "AmmConverterEth",
                "AmmConverterFish",
                "AmmConverterMynt",
            ];

            for (const name of converterDeploymentNames) {
                const deployment = await get(name);
                const contract = await ethers.getContractAt(ownershipABI, deployment.address);
                const pendingOwner = await contract.newOwner();
                expect(
                    pendingOwner.toLowerCase(),
                    `${name}: newOwner should be multisig after transferOwnership`
                ).to.equal(multisigAddress.toLowerCase());
            }
        });
    });
});
