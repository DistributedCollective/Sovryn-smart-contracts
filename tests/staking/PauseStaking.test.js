const hre = require("hardhat");
const { ethers } = hre;
const { expect } = require("chai");

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expectRevert, expectEvent, BN } = require("@openzeppelin/test-helpers");
const {
    decodeLogs,
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getPriceFeeds,
    getSovryn,
} = require("../Utils/initializer.js");
const { address, setNextBlockTimestamp, mineBlock, increaseTime } = require("../Utils/Ethereum");
const EIP712 = require("../Utils/EIP712");
const { getAccountsPrivateKeysBuffer } = require("../Utils/hardhat_utils");
const {
    deployAndGetIStaking,
    getStakingModulesObject,
    getStakingModulesAddressList,
    replaceStakingModule,
} = require("../Utils/initializer");

const WeightedStakingModuleMockup = artifacts.require("WeightedStakingModuleMockup");
const IWeightedStakingModuleMockup = artifacts.require("IWeightedStakingModuleMockup");

const StakingProxy = artifacts.require("StakingProxy");

const SOV = artifacts.require("SOV");

const LoanTokenLogic = artifacts.require("LoanTokenLogicStandard");
const LoanTokenSettings = artifacts.require("LoanTokenSettingsLowerAdmin");
const LoanToken = artifacts.require("LoanToken");

const FeeSharingCollector = artifacts.require("FeeSharingCollector");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorProxy");

// Upgradable Vesting Registry
// const VestingRegistry = artifacts.require("VestingRegistryMockup");
const VestingRegistry = artifacts.require("VestingRegistry");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");

const Vesting = artifacts.require("TeamVesting");
const VestingLogic = artifacts.require("VestingLogicMockup");

const StakingAdminModule = artifacts.require("StakingAdminModule");
const StakingWithdrawModule = artifacts.require("StakingWithdrawModule");
const StakingStakeModule = artifacts.require("StakingWithdrawModule");

const TOTAL_SUPPLY = "100000000000000000000000000000";
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

const DAY = 86400;
const TWO_WEEKS = 1209600;

const DELAY = DAY * 14;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const maxWithdrawIterations = 10;

contract("Staking", (accounts) => {
    let root, account1;
    let token, SUSD, WRBTC, staking;
    let sovryn;
    let loanTokenLogic, loanToken;
    let feeSharingCollectorProxy;
    let kickoffTS;
    let iWeightedStakingModuleMockup;

    async function deploymentAndInitFixture(_wallets, _provider) {
        // Deploying sovrynProtocol w/ generic function from initializer.js
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        await sovryn.setSovrynProtocolAddress(sovryn.address);

        // Custom tokens
        /// @dev This SOV token is not a SOV test token
        ///   but a full-fledged SOV token including functionality
        ///   like the approveAndCall method.
        token = await SOV.new(TOTAL_SUPPLY);

        // Staking
        /// Staking Modules
        // Creating the Staking Instance (Staking Modules Interface).
        const stakingProxy = await StakingProxy.new(token.address);
        const modulesObject = await getStakingModulesObject();
        staking = await deployAndGetIStaking(stakingProxy.address, modulesObject);
        const weightedStakingModuleMockup = await WeightedStakingModuleMockup.new();
        const modulesAddressList = getStakingModulesAddressList(modulesObject);
        //console.log(modulesAddressList);
        await replaceStakingModule(
            stakingProxy.address,
            modulesAddressList["WeightedStakingModule"],
            weightedStakingModuleMockup.address
        );
        iWeightedStakingModuleMockup = await IWeightedStakingModuleMockup.at(staking.address);

        // Upgradable Vesting Registry
        vestingRegistry = await VestingRegistry.new();
        vesting = await VestingRegistryProxy.new();
        await vesting.setImplementation(vestingRegistry.address);
        vesting = await VestingRegistry.at(vesting.address);

        await staking.setVestingRegistry(vesting.address);
        await staking.setMaxVestingWithdrawIterations(maxWithdrawIterations);

        // Loan token
        loanTokenSettings = await LoanTokenSettings.new();
        loanTokenLogic = await LoanTokenLogic.new();
        loanToken = await LoanToken.new(
            root,
            loanTokenLogic.address,
            sovryn.address,
            WRBTC.address
        );
        // await loanToken.initialize(SUSD.address, "iSUSD", "iSUSD");
        loanToken = await LoanTokenLogic.at(loanToken.address);

        await sovryn.setLoanPool([loanToken.address], [SUSD.address]);

        //FeeSharingCollectorProxy
        let feeSharingCollector = await FeeSharingCollector.new();
        feeSharingCollectorProxyObj = await FeeSharingCollectorProxy.new(
            sovryn.address,
            staking.address
        );
        await feeSharingCollectorProxyObj.setImplementation(feeSharingCollector.address);
        feeSharingCollectorProxy = await FeeSharingCollector.at(
            feeSharingCollectorProxyObj.address
        );
        await sovryn.setFeesController(feeSharingCollectorProxy.address);
        await staking.setFeeSharing(feeSharingCollectorProxy.address);

        await token.transfer(account1, 1000);
        await token.approve(staking.address, TOTAL_SUPPLY);
        kickoffTS = await staking.kickoffTS.call();
        inOneWeek = kickoffTS.add(new BN(DELAY));
    }

    before(async () => {
        [root, account1, account2, ...accounts] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    describe("pause staking", () => {
        it("should pause staking activities", async () => {
            let tx = await staking.pauseUnpause(true); // Paused
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingAdminModule,
                "StakingPaused",
                {
                    setPaused: true,
                }
            );
            expect(await staking.frozen()).to.be.equal(false); // Must not be frozen when paused
        });

        it("should not pause/unpause when frozen", async () => {
            await staking.freezeUnfreeze(true); // Freezed
            await expectRevert(staking.pauseUnpause(true), "paused");
        });

        it("fails pausing if sender isn't an owner/pauser", async () => {
            await expectRevert(staking.pauseUnpause(true, { from: account1 }), "unauthorized"); // SS02 : unauthorized
        });

        it("fails pausing if sender is an admin", async () => {
            await staking.addAdmin(account1);
            await expectRevert(staking.pauseUnpause(true, { from: account1 }), "unauthorized"); // SS02 : unauthorized
        });

        it("should not allow staking when paused", async () => {
            await staking.pauseUnpause(true); // Paused
            let amount = "100";
            let lockedTS = await getTimeFromKickoff(MAX_DURATION);
            await expectRevert(
                staking.stake(amount, lockedTS, ZERO_ADDRESS, ZERO_ADDRESS),
                "paused"
            ); // SS03 : paused
        });

        //TODO: resume when refactored to resolve EIP-170 contract size issue
        it("should not allow to stakeWithApproval when paused", async () => {
            await staking.pauseUnpause(true); // Paused
            let amount = "100";
            let duration = TWO_WEEKS;
            let lockedTS = await getTimeFromKickoff(duration);

            let stakingBalance = await token.balanceOf.call(staking.address);
            expect(stakingBalance.toNumber()).to.be.equal(0);

            await token.approve(staking.address, 0);
            await token.approve(staking.address, amount * 2, { from: account1 });

            let contract = new web3.eth.Contract(staking.abi, staking.address);
            let sender = root;
            let data = contract.methods
                .stakeWithApproval(sender, amount, lockedTS, root, root)
                .encodeABI();
            await expectRevert(
                token.approveAndCall(staking.address, amount, data, { from: sender }),
                "paused"
            ); // SS03 : paused
        });

        it("should not allow to extend staking duration when paused", async () => {
            let amount = "1000";
            let lockedTS = await getTimeFromKickoff(TWO_WEEKS);
            let tx1 = await staking.stake(amount, lockedTS, root, root);

            let stakingBalance = await token.balanceOf.call(staking.address);
            expect(stakingBalance.toString()).to.be.equal(amount);
            decode = decodeLogs(tx1.receipt.rawLogs, StakingStakeModule, "DelegateChanged")[0];
            expect(parseInt(decode.args.lockedUntil)).to.be.equal(lockedTS.toNumber());

            let newLockedTS = await getTimeFromKickoff(TWO_WEEKS * 2);
            await staking.pauseUnpause(true); // Paused
            await expectRevert(staking.extendStakingDuration(lockedTS, newLockedTS), "paused"); // SS03 : paused
        });

        it("should not allow stakesBySchedule when paused", async () => {
            await staking.pauseUnpause(true); // Paused
            let amount = "1000";
            let duration = new BN(MAX_DURATION).div(new BN(2));
            let cliff = new BN(TWO_WEEKS).mul(new BN(2));
            let intervalLength = new BN(10000000);
            await expectRevert(
                staking.stakesBySchedule(amount, cliff, duration, intervalLength, root, root),
                "paused"
            ); // SS03 : paused
        });

        it("should not allow delegating stakes when paused", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedTS = await getTimeFromKickoff(duration);
            await staking.stake(amount, lockedTS, root, root);

            await staking.withdraw(amount, lockedTS, root);

            await staking.stake(amount, lockedTS, root, root);
            await iWeightedStakingModuleMockup.setDelegateStake(root, lockedTS, 0); // <=== MOCK!!!

            await staking.pauseUnpause(true); // Paused
            await expectRevert(staking.delegate(account1, lockedTS), "paused"); // SS03 : paused
        });
    });

    describe("freeze withdrawal", () => {
        it("should freeze withdrawal", async () => {
            let tx = await staking.freezeUnfreeze(true); // Freeze
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingAdminModule,
                "StakingFrozen",
                {
                    setFrozen: true,
                }
            );
            expect(await staking.paused()).to.be.equal(true); // Must also pause when freezed
            await staking.freezeUnfreeze(false); // Unfreeze
            expect(await staking.paused()).to.be.equal(true); // Must still be paused when unfreezed
        });

        it("fails freezing if sender isn't an owner/pauser", async () => {
            await expectRevert(staking.freezeUnfreeze(true, { from: account1 }), "unauthorized"); // SS02 : unauthorized
        });

        it("fails freezing if sender is an admin", async () => {
            await staking.addAdmin(account1);
            await expectRevert(staking.freezeUnfreeze(true, { from: account1 }), "unauthorized"); // SS02 : unauthorized
        });

        it("should not allow withdrawal when frozen", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedTS = await getTimeFromKickoff(duration);
            let tx1 = await staking.stake(amount, lockedTS, root, root);

            // await setTime(lockedTS);
            setNextBlockTimestamp(lockedTS.toNumber());
            mineBlock();

            let stakingBalance = await token.balanceOf.call(staking.address);
            expect(stakingBalance.toString()).to.be.equal(amount);
            let beforeBalance = await token.balanceOf.call(root);

            await staking.freezeUnfreeze(true); // Freeze
            await expectRevert(staking.withdraw(amount / 2, lockedTS, root), "paused"); // SS04 : frozen

            await staking.freezeUnfreeze(false); // Unfreeze
            let tx2 = await staking.withdraw(amount / 2, lockedTS, root);

            stakingBalance = await token.balanceOf.call(staking.address);
            expect(stakingBalance.toNumber()).to.be.equal(amount / 2);
            let afterBalance = await token.balanceOf.call(root);
            expect(afterBalance.sub(beforeBalance).toNumber()).to.be.equal(amount / 2);

            // _increaseDailyStake
            let numTotalStakingCheckpoints =
                await staking.numTotalStakingCheckpoints.call(lockedTS);
            expect(parseInt(numTotalStakingCheckpoints)).to.be.equal(2);
            let checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
            expect(parseInt(checkpoint.fromBlock)).to.be.equal(tx1.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);
            checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 1);
            expect(parseInt(checkpoint.fromBlock)).to.be.equal(tx2.receipt.blockNumber);
            expect(parseInt(checkpoint.stake)).to.be.equal(amount / 2);

            // _writeUserCheckpoint
            let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(root, lockedTS);
            expect(numUserCheckpoints.toNumber()).to.be.equal(2);
            checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
            expect(parseInt(checkpoint.fromBlock)).to.be.equal(tx1.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);
            checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 1);
            expect(parseInt(checkpoint.fromBlock)).to.be.equal(tx2.receipt.blockNumber);
            expect(parseInt(checkpoint.stake)).to.be.equal(amount / 2);

            // _decreaseDelegateStake
            let numDelegateStakingCheckpoints = await staking.numDelegateStakingCheckpoints.call(
                root,
                lockedTS
            );
            checkpoint = await staking.delegateStakingCheckpoints.call(
                root,
                lockedTS,
                numDelegateStakingCheckpoints - 1
            );
            expect(parseInt(checkpoint.fromBlock)).to.be.equal(tx2.receipt.blockNumber);
            expect(parseInt(checkpoint.stake)).to.be.equal(amount / 2);
            expect(parseInt(numDelegateStakingCheckpoints)).to.be.equal(2);

            await expectEvent.inTransaction(
                tx2.receipt.rawLogs[0].transactionHash,
                StakingWithdrawModule,
                "StakingWithdrawn",
                {
                    staker: root,
                    amount: new BN(amount / 2),
                }
            );
        });

        it("should not allow cancelTeamVesting when frozen, and able to continue after unfrozen", async () => {
            const WEEK = new BN(7 * 24 * 60 * 60);
            let vestingLogic = await VestingLogic.new();
            const ONE_MILLON = "1000000000000000000000000";
            let previousAmount = await token.balanceOf(root);
            let toStake = ONE_MILLON;

            // Upgradable Vesting Registry
            vestingRegistry = await VestingRegistry.new();
            vestingRegistry = await VestingRegistryProxy.new();
            await vestingRegistry.setImplementation(vestingRegistry.address);
            vestingRegistry = await VestingRegistry.at(vestingRegistry.address);

            await staking.setVestingRegistry(vestingRegistry.address);

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                16 * WEEK,
                38 * WEEK,
                feeSharingCollectorProxy.address
            );

            const sampleVesting = vesting.address;
            const vestingType = new BN(0); // TeamVesting
            const vestingCreationType = new BN(3);
            const vestingCreationAndTypes = {
                isSet: true,
                vestingType: vestingType.toString(),
                vestingCreationType: vestingCreationType.toString(),
            };

            await vestingRegistry.registerVestingToVestingCreationAndTypes(
                [sampleVesting],
                [vestingCreationAndTypes]
            );

            vesting = await VestingLogic.at(vesting.address);
            await staking.addContractCodeHash(vesting.address);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            await increaseTime(10 * WEEK);
            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            let amountAfterStake = await token.balanceOf(root);

            await staking.addAdmin(account1);

            await staking.freezeUnfreeze(true); // Freeze
            await expectRevert(
                staking.cancelTeamVesting(vesting.address, root, 0, {
                    from: account1,
                }),
                "paused"
            ); // WS04 : frozen

            await staking.freezeUnfreeze(false); // Unfreeze
            // governance withdraw until duration must withdraw all staked tokens without fees
            let tx = await staking.cancelTeamVesting(vesting.address, root, 0, {
                from: account1,
            });

            const getStartDate = vesting.startDate();
            const getCliff = vesting.cliff();
            const getMaxIterations = staking.getMaxVestingWithdrawIterations();

            const [startDate, cliff, maxIterations] = await Promise.all([
                getStartDate,
                getCliff,
                getMaxIterations,
            ]);
            const startIteration = startDate.add(cliff);

            const decodedIncompleteEvent = decodeLogs(
                tx.receipt.rawLogs,
                StakingWithdrawModule,
                "TeamVestingPartiallyCancelled"
            )[0].args;
            // last processed date = starIteration + ( (max_iterations - 1) * 1209600 )  // 1209600 is TWO_WEEKS
            expect(
                new BN(decodedIncompleteEvent["nextStartFrom"]).sub(new BN(TWO_WEEKS)).toString()
            ).to.equal(
                startIteration
                    .add(new BN(maxIterations.sub(new BN(1))).mul(new BN(TWO_WEEKS)))
                    .toString()
            );

            // Withdraw another iteration
            await staking.cancelTeamVesting(
                vesting.address,
                root,
                new BN(decodedIncompleteEvent["nextStartFrom"])
            );

            // verify amount
            let amount = await token.balanceOf(root);

            assert.equal(
                previousAmount.sub(new BN(toStake).mul(new BN(2))).toString(),
                amountAfterStake.toString()
            );
            assert.equal(previousAmount.toString(), amount.toString());

            let vestingBalance = await staking.balanceOf(vesting.address);
            expect(vestingBalance).to.be.bignumber.equal(new BN(0));

            /// should emit token withdrawn event for complete withdrawal
            const end = await vesting.endDate();
            tx = await staking.cancelTeamVesting(
                vesting.address,
                root,
                new BN(end.toString()).add(new BN(TWO_WEEKS))
            );

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingWithdrawModule,
                "TeamVestingCancelled",
                {
                    caller: root,
                    receiver: root,
                }
            );
        });

        it("should not allow governanceWithdrawTokens when frozen", async () => {
            const WEEK = new BN(7 * 24 * 60 * 60);
            let vestingLogic = await VestingLogic.new();
            const ONE_MILLON = "1000000000000000000000000";
            let previousAmount = await token.balanceOf(root);
            let toStake = ONE_MILLON;

            // Upgradable Vesting Registry
            vestingRegistry = await VestingRegistry.new();
            vestingRegistry = await VestingRegistryProxy.new();
            await vestingRegistry.setImplementation(vestingRegistry.address);
            vestingRegistry = await VestingRegistry.at(vestingRegistry.address);

            await staking.setVestingRegistry(vestingRegistry.address);

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                16 * WEEK,
                36 * WEEK,
                feeSharingCollectorProxy.address
            );

            vesting = await VestingLogic.at(vesting.address);
            await staking.addContractCodeHash(vesting.address);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            await increaseTime(20 * WEEK);
            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            let amountAfterStake = await token.balanceOf(root);

            await staking.addAdmin(account1);

            await staking.freezeUnfreeze(true); // Freeze
            await expectRevert(
                staking.governanceWithdrawVesting(vesting.address, root, { from: account1 }),
                "paused"
            ); // WS04 : frozen

            const sampleVesting = vesting.address;
            const vestingType = new BN(0); // TeamVesting
            const vestingCreationType = new BN(3);
            const vestingCreationAndTypes = {
                isSet: true,
                vestingType: vestingType.toString(),
                vestingCreationType: vestingCreationType.toString(),
            };

            await vestingRegistry.registerVestingToVestingCreationAndTypes(
                [sampleVesting],
                [vestingCreationAndTypes]
            );

            await staking.freezeUnfreeze(false); // Unfreeze
            // governance withdraw until duration must withdraw all staked tokens without fees
            let tx = await staking.governanceWithdrawVesting(vesting.address, root, {
                from: account1,
            });

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingWithdrawModule,
                "VestingTokensWithdrawn",
                {
                    vesting: vesting.address,
                    receiver: root,
                }
            );

            // verify amount
            let amount = await token.balanceOf(root);

            assert.equal(
                previousAmount.sub(new BN(toStake).mul(new BN(2))).toString(),
                amountAfterStake.toString()
            );
            assert.equal(previousAmount.toString(), amount.toString());

            let vestingBalance = await staking.balanceOf(vesting.address);
            expect(vestingBalance).to.be.bignumber.equal(new BN(0));
        });

        it("governanceWithdrawVesting and cancelTeamVesting function should not be overlapped (governanceWithdrawVesting -> cancelTeamVesting)", async () => {
            const WEEK = new BN(7 * 24 * 60 * 60);
            let vestingLogic = await VestingLogic.new();
            const ONE_MILLON = "1000000000000000000000000";
            let previousAmount = await token.balanceOf(root);
            let toStake = ONE_MILLON;

            // Upgradable Vesting Registry
            vestingRegistry = await VestingRegistry.new();
            vestingRegistry = await VestingRegistryProxy.new();
            await vestingRegistry.setImplementation(vestingRegistry.address);
            vestingRegistry = await VestingRegistry.at(vestingRegistry.address);

            await staking.setVestingRegistry(vestingRegistry.address);

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                16 * WEEK,
                36 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);
            await staking.addContractCodeHash(vesting.address);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            await increaseTime(20 * WEEK);
            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            let amountAfterStake = await token.balanceOf(root);

            await staking.addAdmin(account1);

            await staking.freezeUnfreeze(true); // Freeze
            await expectRevert(
                staking.governanceWithdrawVesting(vesting.address, root, { from: account1 }),
                "paused"
            ); // WS04 : frozen

            let sampleVesting = vesting.address;
            let vestingType = new BN(0); // TeamVesting
            let vestingCreationType = new BN(3);
            let vestingCreationAndTypes = {
                isSet: true,
                vestingType: vestingType.toString(),
                vestingCreationType: vestingCreationType.toString(),
            };

            await vestingRegistry.registerVestingToVestingCreationAndTypes(
                [sampleVesting],
                [vestingCreationAndTypes]
            );

            await staking.freezeUnfreeze(false); // Unfreeze
            // governance withdraw until duration must withdraw all staked tokens without fees
            let tx = await staking.governanceWithdrawVesting(vesting.address, root, {
                from: account1,
            });

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingWithdrawModule,
                "VestingTokensWithdrawn",
                {
                    vesting: vesting.address,
                    receiver: root,
                }
            );

            // verify amount
            let amount = await token.balanceOf(root);

            assert.equal(
                previousAmount.sub(new BN(toStake).mul(new BN(2))).toString(),
                amountAfterStake.toString()
            );
            assert.equal(previousAmount.toString(), amount.toString());

            let vestingBalance = await staking.balanceOf(vesting.address);
            expect(vestingBalance).to.be.bignumber.equal(new BN(0));

            /** Try to withdraw by using cancelTeamVesting function */
            // Upgradable Vesting Registry
            vestingRegistry = await VestingRegistry.new();
            vestingRegistry = await VestingRegistryProxy.new();
            await vestingRegistry.setImplementation(vestingRegistry.address);
            vestingRegistry = await VestingRegistry.at(vestingRegistry.address);

            await staking.setVestingRegistry(vestingRegistry.address);

            sampleVesting = vesting.address;
            vestingType = new BN(0); // TeamVesting
            vestingCreationType = new BN(3);
            vestingCreationAndTypes = {
                isSet: true,
                vestingType: vestingType.toString(),
                vestingCreationType: vestingCreationType.toString(),
            };

            await vestingRegistry.registerVestingToVestingCreationAndTypes(
                [sampleVesting],
                [vestingCreationAndTypes]
            );

            /// should emit token withdrawn event for complete withdrawal
            const end = await vesting.endDate();
            tx = await staking.cancelTeamVesting(
                vesting.address,
                root,
                new BN(end.toString()).sub(new BN(TWO_WEEKS)).mul(new BN(10)),
                {
                    from: account1,
                }
            );

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingWithdrawModule,
                "TeamVestingCancelled",
                {
                    caller: account1,
                    receiver: root,
                }
            );

            /** Receiver (root) balance must remain exactly the same */
            amount = await token.balanceOf(root);
            assert.equal(previousAmount.toString(), amount.toString());

            /** Vesting balance should still remain 0 */
            vestingBalance = await staking.balanceOf(vesting.address);
            expect(vestingBalance).to.be.bignumber.equal(new BN(0));
        });

        it("governanceWithdrawVesting and cancelTeamVesting function should not be overlapped (cancelTeamVesting -> governanceWithdrawVesting)", async () => {
            const WEEK = new BN(7 * 24 * 60 * 60);
            let vestingLogic = await VestingLogic.new();
            const ONE_MILLON = "1000000000000000000000000";
            let previousAmount = await token.balanceOf(root);
            let toStake = ONE_MILLON;

            // Upgradable Vesting Registry
            vestingRegistry = await VestingRegistry.new();
            vestingRegistry = await VestingRegistryProxy.new();
            await vestingRegistry.setImplementation(vestingRegistry.address);
            vestingRegistry = await VestingRegistry.at(vestingRegistry.address);

            await staking.setVestingRegistry(vestingRegistry.address);

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                16 * WEEK,
                38 * WEEK,
                feeSharingCollectorProxy.address
            );

            const sampleVesting = vesting.address;
            const vestingType = new BN(0); // TeamVesting
            const vestingCreationType = new BN(3);
            const vestingCreationAndTypes = {
                isSet: true,
                vestingType: vestingType.toString(),
                vestingCreationType: vestingCreationType.toString(),
            };

            await vestingRegistry.registerVestingToVestingCreationAndTypes(
                [sampleVesting],
                [vestingCreationAndTypes]
            );

            vesting = await VestingLogic.at(vesting.address);
            await staking.addContractCodeHash(vesting.address);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            await increaseTime(10 * WEEK);
            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            let amountAfterStake = await token.balanceOf(root);

            await staking.addAdmin(account1);

            // governance withdraw until duration must withdraw all staked tokens without fees
            let tx = await staking.cancelTeamVesting(vesting.address, root, 0, {
                from: account1,
            });

            const getStartDate = vesting.startDate();
            const getCliff = vesting.cliff();
            const getMaxIterations = staking.getMaxVestingWithdrawIterations();

            const [startDate, cliff, maxIterations] = await Promise.all([
                getStartDate,
                getCliff,
                getMaxIterations,
            ]);
            const startIteration = startDate.add(cliff);

            const decodedIncompleteEvent = decodeLogs(
                tx.receipt.rawLogs,
                StakingWithdrawModule,
                "TeamVestingPartiallyCancelled"
            )[0].args;

            // last processed date = starIteration + ( (max_iterations - 1) * 1209600 )  // 1209600 is TWO_WEEKS
            expect(
                new BN(decodedIncompleteEvent["nextStartFrom"]).sub(new BN(TWO_WEEKS)).toString()
            ).to.equal(
                startIteration
                    .add(new BN(maxIterations.sub(new BN(1))).mul(new BN(TWO_WEEKS)))
                    .toString()
            );

            // Withdraw another iteration
            await staking.cancelTeamVesting(
                vesting.address,
                root,
                new BN(decodedIncompleteEvent["nextStartFrom"])
            );

            // verify amount
            let amount = await token.balanceOf(root);

            assert.equal(
                previousAmount.sub(new BN(toStake).mul(new BN(2))).toString(),
                amountAfterStake.toString()
            );
            assert.equal(previousAmount.toString(), amount.toString());

            let vestingBalance = await staking.balanceOf(vesting.address);
            expect(vestingBalance).to.be.bignumber.equal(new BN(0));

            /// should emit token withdrawn event for complete withdrawal
            const end = await vesting.endDate();
            tx = await staking.cancelTeamVesting(
                vesting.address,
                root,
                new BN(end.toString()).add(new BN(TWO_WEEKS))
            );

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingWithdrawModule,
                "TeamVestingCancelled",
                {
                    caller: root,
                    receiver: root,
                }
            );

            previousAmount = await token.balanceOf(root);
            // Governance withdraw vesting
            tx = await staking.governanceWithdrawVesting(vesting.address, root, {
                from: account1,
            });

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingWithdrawModule,
                "VestingTokensWithdrawn",
                {
                    vesting: vesting.address,
                    receiver: root,
                }
            );

            /** Receiver (root) balance must remain exactly the same */
            amount = await token.balanceOf(root);
            assert.equal(previousAmount.toString(), amount.toString());

            /** Vesting balance should still remain 0 */
            vestingBalance = await staking.balanceOf(vesting.address);
            expect(vestingBalance).to.be.bignumber.equal(new BN(0));
        });
    });

    describe("add pauser", () => {
        it("adds pauser", async () => {
            let tx = await staking.addPauser(account1);

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingAdminModule,
                "PauserAddedOrRemoved",
                {
                    pauser: account1,
                    added: true,
                }
            );

            let isPauser = await staking.pausers(account1);
            expect(isPauser).equal(true);
        });

        it("fails if sender isn't an owner", async () => {
            await expectRevert(staking.addPauser(account1, { from: account1 }), "unauthorized");
        });
    });

    describe("remove pauser", () => {
        it("removes pauser", async () => {
            await staking.addPauser(account1);
            let tx = await staking.removePauser(account1);
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingAdminModule,
                "PauserAddedOrRemoved",
                {
                    pauser: account1,
                    added: false,
                }
            );

            let isPauser = await staking.pausers(account1);
            expect(isPauser).equal(false);
        });

        it("fails if sender isn't an owner", async () => {
            await expectRevert(staking.removePauser(account1, { from: account1 }), "unauthorized");
        });
    });

    async function getTimeFromKickoff(delay) {
        let kickoffTS = await staking.kickoffTS.call();
        return kickoffTS.add(new BN(delay));
    }
});
