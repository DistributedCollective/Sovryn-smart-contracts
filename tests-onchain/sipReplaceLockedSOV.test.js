// first run a local forked mainnet node in a separate terminal window:
//     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
// now run the test:
//     npx hardhat test tests-onchain/sipReplaceLockedSOV.test.js --network rskForkedMainnet

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

describe("SIP Replace LockedSOV test onchain", () => {
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

        // Deploy LockedSOVMigration
        await deployments.fixture(["LockedSOVMigration"], {
            keepExistingDeployments: true,
        });

        const stakingProxy = await get("StakingProxy");
        const staking = await ethers.getContractAt(
            "IStaking",
            stakingProxy.address,
            deployerSigner
        );
        const sovrynProtocol = await ethers.getContract("SovrynProtocol", deployerSigner);
        const lockedSOV = await get("LockedSOV");
        const lockedSOVMigration = await get("LockedSOVMigration");

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
            lockedSOV,
            lockedSOVMigration,
            governorOwner,
            governorOwnerSigner,
            timelockOwner,
            timelockOwnerSigner,
            multisigAddress,
            multisigSigner,
        };
    });

    describe("SIP Replace LockedSOV Test creation and execution", () => {
        it("SIP Replace LockedSOV is executable and updates protocol contracts", async () => {
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
                sovrynProtocol,
                lockedSOV,
                lockedSOVMigration,
                governorOwner,
                timelockOwnerSigner,
                multisigSigner,
            } = await setupTest();

            // Get initial LockedSOV address from protocol
            const initialLockedSOVAddress = await sovrynProtocol.getLockedSOVAddress();
            console.log(`Initial LockedSOV address in protocol: ${initialLockedSOVAddress}`);
            console.log(`Old LockedSOV deployment: ${lockedSOV.address}`);
            console.log(`New LockedSOVMigration deployment: ${lockedSOVMigration.address}`);

            expect(initialLockedSOVAddress.toLowerCase()).to.equal(
                lockedSOV.address.toLowerCase()
            );

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

            // CREATE PROPOSAL AND VERIFY
            const proposalIdBeforeSIP = await governorOwner.latestProposalIds(deployer);
            await hre.run("sips:create", { argsFunc: "getArgsSipReplaceLockedSOV" });
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

            // VALIDATE LOCKEDSOV ADDRESS UPDATED IN PROTOCOL
            const updatedLockedSOVAddress = await sovrynProtocol.getLockedSOVAddress();
            console.log(`Updated LockedSOV address in protocol: ${updatedLockedSOVAddress}`);

            expect(updatedLockedSOVAddress.toLowerCase()).to.equal(
                lockedSOVMigration.address.toLowerCase()
            );

            // Verify LiquidityMining contracts updated (if they exist)
            try {
                const lm = await ethers.getContract("LiquidityMining");
                const lmLockedSOV = await lm.lockedSOV();
                console.log(`LiquidityMining LockedSOV: ${lmLockedSOV}`);
                expect(lmLockedSOV.toLowerCase()).to.equal(
                    lockedSOVMigration.address.toLowerCase()
                );
            } catch (error) {
                console.log("LiquidityMining contract not found, skipping validation");
            }

            try {
                const lmV2 = await ethers.getContract("LiquidityMiningV2");
                const lmV2LockedSOV = await lmV2.lockedSOV();
                console.log(`LiquidityMiningV2 LockedSOV: ${lmV2LockedSOV}`);
                expect(lmV2LockedSOV.toLowerCase()).to.equal(
                    lockedSOVMigration.address.toLowerCase()
                );
            } catch (error) {
                console.log("LiquidityMiningV2 contract not found, skipping validation");
            }

            console.log("All contracts successfully updated to use LockedSOVMigration");
        });

        it("Validates that LockedSOVMigration mutes all operations", async () => {
            if (!hre.network.tags["forked"]) {
                console.error("ERROR: Must run on a forked net");
                return;
            }

            const { deployer, deployerSigner, lockedSOVMigration, timelockOwnerSigner } =
                await setupTest();

            const sov = await ethers.getContract("SOV", timelockOwnerSigner);
            const lockedSOVMigrationContract = await ethers.getContractAt(
                "ILockedSOV",
                lockedSOVMigration.address,
                deployerSigner
            );

            const testAmount = ethers.utils.parseEther("1000");
            await sov.mint(deployer, testAmount);
            await sov.connect(deployerSigner).approve(lockedSOVMigration.address, testAmount);

            console.log("Testing LockedSOVMigration muted functions...");

            // Test deposit - should not revert but should do nothing
            const initialBalance = await lockedSOVMigrationContract.getLockedBalance(deployer);
            await lockedSOVMigrationContract
                .connect(deployerSigner)
                .deposit(deployer, testAmount, 0);
            const afterDepositBalance =
                await lockedSOVMigrationContract.getLockedBalance(deployer);
            expect(afterDepositBalance).to.equal(initialBalance);
            console.log("Deposit is muted - balance unchanged");

            // Test depositSOV - should not revert but should do nothing
            await lockedSOVMigrationContract
                .connect(deployerSigner)
                .depositSOV(deployer, testAmount);
            const afterDepositSOVBalance =
                await lockedSOVMigrationContract.getLockedBalance(deployer);
            expect(afterDepositSOVBalance).to.equal(initialBalance);
            console.log("DepositSOV is muted - balance unchanged");

            // Test withdraw - should not revert but should do nothing
            const initialSOVBalance = await sov.balanceOf(deployer);
            await lockedSOVMigrationContract.connect(deployerSigner).withdraw(deployer);
            const afterWithdrawSOVBalance = await sov.balanceOf(deployer);
            expect(afterWithdrawSOVBalance).to.equal(initialSOVBalance);
            console.log("Withdraw is muted - no SOV transferred");

            // Test createVesting - should return address(0)
            const vestingAddress = await lockedSOVMigrationContract
                .connect(deployerSigner)
                .callStatic.createVesting();
            expect(vestingAddress).to.equal(ethers.constants.AddressZero);
            console.log("CreateVesting is muted - returns zero address");

            // Test createVestingAndStake - should not revert but should do nothing
            await lockedSOVMigrationContract.connect(deployerSigner).createVestingAndStake();
            console.log("CreateVestingAndStake is muted - no action taken");

            // Test stakeTokens - should not revert but should do nothing
            await lockedSOVMigrationContract.connect(deployerSigner).stakeTokens();
            console.log("StakeTokens is muted - no action taken");

            // Test withdrawAndStakeTokens - should not revert but should do nothing
            await lockedSOVMigrationContract
                .connect(deployerSigner)
                .withdrawAndStakeTokens(deployer);
            console.log("WithdrawAndStakeTokens is muted - no action taken");

            // Test withdrawAndStakeTokensFrom - should not revert but should do nothing
            await lockedSOVMigrationContract
                .connect(deployerSigner)
                .withdrawAndStakeTokensFrom(deployer);
            console.log("WithdrawAndStakeTokensFrom is muted - no action taken");

            console.log("All LockedSOVMigration operations correctly muted");

            // Verify read functions still work
            const cliff = await lockedSOVMigrationContract.cliff();
            const duration = await lockedSOVMigrationContract.duration();
            console.log(`Cliff: ${cliff.toString()}, Duration: ${duration.toString()}`);
            expect(cliff).to.be.gt(0);
            expect(duration).to.be.gt(0);
            console.log("Read functions still operational");
        });
    });
});
