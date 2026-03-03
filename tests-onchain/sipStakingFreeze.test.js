// first run a local forked mainnet node in a separate terminal window:
//     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
// now run the test:
//     npx hardhat test tests-onchain/sipStakingFreeze.test.js --network rskForkedMainnet

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

describe("SIP Staking Freeze test onchain", () => {
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

        const stakingProxy = await get("StakingProxy");
        const staking = await ethers.getContractAt(
            "IStaking",
            stakingProxy.address,
            deployerSigner
        );
        const sovrynProtocol = await ethers.getContract("SovrynProtocol", deployerSigner);

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
            stakingProxy,
            sovrynProtocol,
            governorOwner,
            governorOwnerSigner,
            timelockOwner,
            timelockOwnerSigner,
            multisigAddress,
            multisigSigner,
        };
    });

    describe("SIP Staking Freeze Test creation and execution", () => {
        it("SIP Staking Freeze is executable and freezes staking contract", async () => {
            if (!hre.network.tags["forked"]) {
                console.error("ERROR: Must run on a forked net");
                return;
            }
            await hre.network.provider.request({
                method: "hardhat_reset",
                params: [
                    {
                        forking: {
                            jsonRpcUrl: "https://mainnet-dev.sovryn.app/rpc",
                            blockNumber: 8400000, // Use a recent block
                        },
                    },
                ],
            });

            const {
                deployer,
                deployerSigner,
                staking,
                stakingProxy,
                governorOwner,
                timelockOwnerSigner,
                multisigAddress,
                multisigSigner,
            } = await setupTest();

            // Verify staking is not frozen initially
            const initialFrozenState = await staking.frozen();
            expect(initialFrozenState).to.be.false;

            // Verify staking is not paused (required for freeze validation)
            const initialPausedState = await staking.paused();
            console.log(`Initial staking paused state: ${initialPausedState}`);
            console.log(`Initial staking frozen state: ${initialFrozenState}`);

            // CREATE PROPOSAL
            const sov = await ethers.getContract("SOV", timelockOwnerSigner);
            const whaleAmount = (await sov.totalSupply()).mul(ethers.BigNumber.from(5));
            await sov.mint(deployer, whaleAmount);

            await sov.connect(deployerSigner).approve(staking.address, whaleAmount);

            // Unpause staking if paused
            if (await staking.paused()) {
                await staking.connect(multisigSigner).pauseUnpause(false);
            }

            const kickoffTS = await staking.kickoffTS();
            await staking
                .connect(deployerSigner)
                .stake(whaleAmount, kickoffTS.add(MAX_DURATION), deployer, deployer);
            await mine();

            // Test that staking operations work before freeze
            const balanceBeforeFreeze = await staking.balanceOf(deployer);
            console.log(`Deployer balance before freeze: ${balanceBeforeFreeze.toString()}`);
            expect(balanceBeforeFreeze).to.be.gt(0);

            // CREATE PROPOSAL AND VERIFY
            const proposalIdBeforeSIP = await governorOwner.latestProposalIds(deployer);
            await hre.run("sips:create", { argsFunc: "getArgsSipStakingFreeze" });
            const proposalId = await governorOwner.latestProposalIds(deployer);
            expect(
                proposalId,
                "Proposal was not created. Check the SIP creation is not commented out."
            ).is.gt(proposalIdBeforeSIP);

            console.log(`Proposal created with ID: ${proposalId.toString()}`);

            // VOTE FOR PROPOSAL
            await mine();
            await governorOwner.connect(deployerSigner).castVote(proposalId, true);
            console.log("Vote cast for proposal");

            // QUEUE PROPOSAL
            let proposal = await governorOwner.proposals(proposalId);
            await mine(proposal.endBlock);
            await governorOwner.queue(proposalId);
            console.log("Proposal queued");

            // EXECUTE PROPOSAL
            proposal = await governorOwner.proposals(proposalId);
            await time.increaseTo(proposal.eta);
            await expect(governorOwner.execute(proposalId))
                .to.emit(governorOwner, "ProposalExecuted")
                .withArgs(proposalId);

            console.log("Proposal executed");

            // VERIFY execution
            expect((await governorOwner.proposals(proposalId)).executed).to.be.true;

            // VALIDATE STAKING IS FROZEN
            const finalFrozenState = await staking.frozen();
            const finalPausedState = await staking.paused();

            console.log(`Final staking frozen state: ${finalFrozenState}`);
            console.log(`Final staking paused state: ${finalPausedState}`);

            expect(finalFrozenState).to.be.true;
            // When frozen, paused should also be true (as per StakingAdminModule.freezeUnfreeze)
            expect(finalPausedState).to.be.true;

            // Verify staking operations are blocked
            const testAmount = ethers.utils.parseEther("100");
            await sov.mint(deployer, testAmount);
            await sov.connect(deployerSigner).approve(staking.address, testAmount);

            // Try to stake - should fail because contract is frozen
            await expect(
                staking
                    .connect(deployerSigner)
                    .stake(testAmount, kickoffTS.add(MAX_DURATION), deployer, deployer)
            ).to.be.revertedWith("paused");

            console.log("Verified: Staking operations are blocked after freeze");

            // Verify owner is still the same
            const stakingOwner = await staking.owner();
            console.log(`Staking owner: ${stakingOwner}`);
            expect(stakingOwner).to.equal(timelockOwnerSigner._address);
        });

        it("Validates that frozen state prevents all staking operations", async () => {
            if (!hre.network.tags["forked"]) {
                console.error("ERROR: Must run on a forked net");
                return;
            }

            const { deployer, deployerSigner, staking, timelockOwnerSigner, multisigSigner } =
                await setupTest();

            const sov = await ethers.getContract("SOV", timelockOwnerSigner);
            const testAmount = ethers.utils.parseEther("1000");
            await sov.mint(deployer, testAmount);
            await sov.connect(deployerSigner).approve(staking.address, testAmount);

            const kickoffTS = await staking.kickoffTS();

            // First stake some tokens while not frozen
            if (await staking.paused()) {
                await staking.connect(multisigSigner).pauseUnpause(false);
            }

            await staking
                .connect(deployerSigner)
                .stake(testAmount, kickoffTS.add(MAX_DURATION), deployer, deployer);

            // Now freeze the contract
            await staking.connect(multisigSigner).freezeUnfreeze(true);

            const isFrozen = await staking.frozen();
            expect(isFrozen).to.be.true;

            console.log("Contract is frozen, testing blocked operations...");

            // Test that stake is blocked
            await sov.mint(deployer, testAmount);
            await sov.connect(deployerSigner).approve(staking.address, testAmount);
            await expect(
                staking
                    .connect(deployerSigner)
                    .stake(testAmount, kickoffTS.add(MAX_DURATION), deployer, deployer)
            ).to.be.revertedWith("paused");

            // Test that extend is blocked
            await expect(
                staking
                    .connect(deployerSigner)
                    .extendStakingDuration(
                        kickoffTS.add(MAX_DURATION),
                        kickoffTS.add(MAX_DURATION).add(86400 * 14)
                    )
            ).to.be.revertedWith("paused");

            // Test that delegate is blocked
            await expect(
                staking
                    .connect(deployerSigner)
                    .delegate(deployerSigner.address, kickoffTS.add(MAX_DURATION))
            ).to.be.revertedWith("paused");

            console.log("All staking operations correctly blocked when frozen");
        });
    });
});
