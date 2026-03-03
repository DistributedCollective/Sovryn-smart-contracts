// first run a local forked mainnet node in a separate terminal window:
//     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
// now run the test:
//     npx hardhat test tests-onchain/sipStakingUnfreeze.test.js --network rskForkedMainnet

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

describe("SIP Staking Unfreeze test onchain", () => {
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

    describe("SIP Staking Unfreeze Test creation and execution", () => {
        it("SIP Staking Unfreeze is executable and unfreezes staking contract", async () => {
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

            // First, we need to freeze the staking contract
            console.log("Step 1: Freezing staking contract first...");

            // Unpause staking if paused
            if (await staking.paused()) {
                await staking.connect(multisigSigner).pauseUnpause(false);
            }

            // Freeze the contract using multisig
            await staking.connect(multisigSigner).freezeUnfreeze(true);

            const initialFrozenState = await staking.frozen();
            const initialPausedState = await staking.paused();

            expect(initialFrozenState).to.be.true;
            expect(initialPausedState).to.be.true;

            console.log(`Initial staking frozen state: ${initialFrozenState}`);
            console.log(`Initial staking paused state: ${initialPausedState}`);

            // CREATE PROPOSAL TO UNFREEZE
            const sov = await ethers.getContract("SOV", timelockOwnerSigner);
            const whaleAmount = (await sov.totalSupply()).mul(ethers.BigNumber.from(5));
            await sov.mint(deployer, whaleAmount);

            await sov.connect(deployerSigner).approve(staking.address, whaleAmount);

            // We can't stake while frozen, so we need to stake before creating the test conditions
            // Reset to a state where we can stake
            await staking.connect(multisigSigner).freezeUnfreeze(false);
            await staking.connect(multisigSigner).pauseUnpause(false);

            const kickoffTS = await staking.kickoffTS();
            await staking
                .connect(deployerSigner)
                .stake(whaleAmount, kickoffTS.add(MAX_DURATION), deployer, deployer);
            await mine();

            // Now freeze again for the unfreeze test
            await staking.connect(multisigSigner).freezeUnfreeze(true);

            // Verify it's frozen before creating proposal
            const frozenBeforeProposal = await staking.frozen();
            expect(frozenBeforeProposal).to.be.true;
            console.log("Staking is frozen, ready to create unfreeze proposal");

            // Verify staking operations are blocked while frozen
            const testAmount = ethers.utils.parseEther("100");
            await sov.mint(deployer, testAmount);
            await sov.connect(deployerSigner).approve(staking.address, testAmount);

            await expect(
                staking
                    .connect(deployerSigner)
                    .stake(testAmount, kickoffTS.add(MAX_DURATION), deployer, deployer)
            ).to.be.revertedWith("paused");
            console.log("Confirmed: Staking operations blocked while frozen");

            // CREATE PROPOSAL AND VERIFY
            const proposalIdBeforeSIP = await governorOwner.latestProposalIds(deployer);
            await hre.run("sips:create", { argsFunc: "getArgsSipStakingUnfreeze" });
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

            // VALIDATE STAKING IS UNFROZEN
            const finalFrozenState = await staking.frozen();
            const finalPausedState = await staking.paused();

            console.log(`Final staking frozen state: ${finalFrozenState}`);
            console.log(`Final staking paused state: ${finalPausedState}`);

            expect(finalFrozenState).to.be.false;
            // When unfrozen, contract is left in paused state (as per StakingAdminModule.freezeUnfreeze)
            expect(finalPausedState).to.be.true;

            console.log("Verified: Staking is unfrozen but remains paused");

            // Verify owner is still the same
            const stakingOwner = await staking.owner();
            console.log(`Staking owner: ${stakingOwner}`);
            expect(stakingOwner).to.equal(timelockOwnerSigner._address);

            // Unpause and verify staking operations work again
            await staking.connect(multisigSigner).pauseUnpause(false);

            const finalPausedAfterUnpause = await staking.paused();
            const finalFrozenAfterUnpause = await staking.frozen();

            expect(finalPausedAfterUnpause).to.be.false;
            expect(finalFrozenAfterUnpause).to.be.false;

            // Test that staking works again
            await sov.mint(deployer, testAmount);
            await sov.connect(deployerSigner).approve(staking.address, testAmount);

            await expect(
                staking
                    .connect(deployerSigner)
                    .stake(testAmount, kickoffTS.add(MAX_DURATION), deployer, deployer)
            ).to.not.be.reverted;

            console.log("Success: Staking operations work again after unfreeze and unpause");
        });

        it("Validates unfreeze flow: frozen → unfrozen (paused) → unpaused (operational)", async () => {
            if (!hre.network.tags["forked"]) {
                console.error("ERROR: Must run on a forked net");
                return;
            }

            const { deployer, deployerSigner, staking, timelockOwnerSigner, multisigSigner } =
                await setupTest();

            const sov = await ethers.getContract("SOV", timelockOwnerSigner);
            const testAmount = ethers.utils.parseEther("1000");

            console.log("\n=== Testing Unfreeze State Transitions ===");

            // Initial state: unfrozen, unpaused
            if (await staking.paused()) {
                await staking.connect(multisigSigner).pauseUnpause(false);
            }
            const kickoffTS = await staking.kickoffTS();

            console.log("State 1: Operational (unfrozen, unpaused)");
            let frozen = await staking.frozen();
            let paused = await staking.paused();
            console.log(`  frozen: ${frozen}, paused: ${paused}`);
            expect(frozen).to.be.false;
            expect(paused).to.be.false;

            // Can stake
            await sov.mint(deployer, testAmount);
            await sov.connect(deployerSigner).approve(staking.address, testAmount);
            await staking
                .connect(deployerSigner)
                .stake(testAmount, kickoffTS.add(MAX_DURATION), deployer, deployer);
            console.log("  ✓ Staking works");

            // Freeze the contract
            await staking.connect(multisigSigner).freezeUnfreeze(true);

            console.log("\nState 2: Frozen (frozen, paused)");
            frozen = await staking.frozen();
            paused = await staking.paused();
            console.log(`  frozen: ${frozen}, paused: ${paused}`);
            expect(frozen).to.be.true;
            expect(paused).to.be.true;

            // Cannot stake
            await sov.mint(deployer, testAmount);
            await sov.connect(deployerSigner).approve(staking.address, testAmount);
            await expect(
                staking
                    .connect(deployerSigner)
                    .stake(testAmount, kickoffTS.add(MAX_DURATION), deployer, deployer)
            ).to.be.revertedWith("paused");
            console.log("  ✓ Staking blocked");

            // Unfreeze the contract
            await staking.connect(multisigSigner).freezeUnfreeze(false);

            console.log("\nState 3: Unfrozen but still paused (unfrozen, paused)");
            frozen = await staking.frozen();
            paused = await staking.paused();
            console.log(`  frozen: ${frozen}, paused: ${paused}`);
            expect(frozen).to.be.false;
            expect(paused).to.be.true; // Still paused after unfreeze

            // Still cannot stake (still paused)
            await sov.mint(deployer, testAmount);
            await sov.connect(deployerSigner).approve(staking.address, testAmount);
            await expect(
                staking
                    .connect(deployerSigner)
                    .stake(testAmount, kickoffTS.add(MAX_DURATION), deployer, deployer)
            ).to.be.revertedWith("paused");
            console.log("  ✓ Staking still blocked (paused)");

            // Unpause the contract
            await staking.connect(multisigSigner).pauseUnpause(false);

            console.log("\nState 4: Operational again (unfrozen, unpaused)");
            frozen = await staking.frozen();
            paused = await staking.paused();
            console.log(`  frozen: ${frozen}, paused: ${paused}`);
            expect(frozen).to.be.false;
            expect(paused).to.be.false;

            // Can stake again
            await sov.mint(deployer, testAmount);
            await sov.connect(deployerSigner).approve(staking.address, testAmount);
            await expect(
                staking
                    .connect(deployerSigner)
                    .stake(testAmount, kickoffTS.add(MAX_DURATION), deployer, deployer)
            ).to.not.be.reverted;
            console.log("  ✓ Staking works again");

            console.log("\n=== Complete State Transition Flow Validated ===");
            console.log("Operational → Frozen → Unfrozen (Paused) → Operational");
        });
    });
});
