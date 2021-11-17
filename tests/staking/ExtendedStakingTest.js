/** Speed optimized on branch hardhatTestRefactor, 2021-09-30
 * Bottlenecks found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 34.1s
 * After optimization: 9.7s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Updated to use the initializer.js functions for protocol deployment.
 *   Updated to use WRBTC as collateral token, instead of custom testWRBTC token.
 *   Tried unsuccessfully to use standard SOV test token as protocol token,
 *   but tests require a full-fledged SOV token.
 */

const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { expectRevert, expectEvent, BN, time } = require("@openzeppelin/test-helpers");
const {
	getSUSD,
	getRBTC,
	getWRBTC,
	getBZRX,
	getLoanTokenLogic,
	getLoanToken,
	getLoanTokenLogicWrbtc,
	getLoanTokenWRBTC,
	loan_pool_setup,
	set_demand_curve,
	getPriceFeeds,
	getSovryn,
	decodeLogs,
	getSOV,
} = require("../Utils/initializer.js");
const {
	address,
	minerStart,
	minerStop,
	unlockedAccount,
	mineBlock,
	etherMantissa,
	etherUnsigned,
	setTime,
	increaseTime,
	setNextBlockTimestamp,
	advanceBlocks,
} = require("../Utils/Ethereum");

const StakingProxy = artifacts.require("StakingProxy");
const StakingMockup = artifacts.require("StakingMockup");
const VestingLogic = artifacts.require("VestingLogicMockup");
const Vesting = artifacts.require("TeamVesting");

const SOV = artifacts.require("SOV");

const LoanTokenLogic = artifacts.require("LoanTokenLogicStandard");
const LoanTokenSettings = artifacts.require("LoanTokenSettingsLowerAdmin");
const LoanToken = artifacts.require("LoanToken");

const FeeSharingLogic = artifacts.require("FeeSharingLogic");
const FeeSharingProxy = artifacts.require("FeeSharingProxy");

// Upgradable Vesting Registry
const VestingRegistryLogic = artifacts.require("VestingRegistryLogic");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");

const TOTAL_SUPPLY = "100000000000000000000000000000";
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

const DAY = 86400;
const TWO_WEEKS = 1209600;

const DELAY = 86400 * 14;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

contract("Staking", (accounts) => {
	let root, account1, account2;
	let token, SUSD, WRBTC, staking;
	let sovryn;
	let loanTokenLogic, loanToken;
	let feeSharingProxy;
	let kickoffTS, inOneWeek;

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
		let stakingLogic = await StakingMockup.new(token.address);
		staking = await StakingProxy.new(token.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingMockup.at(staking.address);

		// Upgradable Vesting Registry
		vestingRegistryLogic = await VestingRegistryLogic.new();
		vesting = await VestingRegistryProxy.new();
		await vesting.setImplementation(vestingRegistryLogic.address);
		vesting = await VestingRegistryLogic.at(vesting.address);

		await staking.setVestingRegistry(vesting.address);

		// Loan token
		loanTokenSettings = await LoanTokenSettings.new();
		loanTokenLogic = await LoanTokenLogic.new();
		loanToken = await LoanToken.new(root, loanTokenLogic.address, sovryn.address, WRBTC.address);
		// await loanToken.initialize(SUSD.address, "iSUSD", "iSUSD");
		loanToken = await LoanTokenLogic.at(loanToken.address);

		await sovryn.setLoanPool([loanToken.address], [SUSD.address]);

		//FeeSharingProxy
		let feeSharingLogic = await FeeSharingLogic.new();
		feeSharingProxyObj = await FeeSharingProxy.new(sovryn.address, staking.address);
		await feeSharingProxyObj.setImplementation(feeSharingLogic.address);
		feeSharingProxy = await FeeSharingLogic.at(feeSharingProxyObj.address);
		await sovryn.setFeesController(feeSharingProxy.address);
		await staking.setFeeSharing(feeSharingProxy.address);

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

	describe("stake", () => {
		it("Amount should be positive", async () => {
			await expectRevert(staking.stake(0, inOneWeek, root, root), "amount needs to be bigger than 0");
		});

		it("Amount should be approved", async () => {
			await expectRevert(staking.stake(100, inOneWeek, root, root, { from: account1 }), "ERC20: transfer amount exceeds allowance");
		});

		it("Staking period too short", async () => {
			await expectRevert(
				staking.stake(100, await getTimeFromKickoff(DAY), root, root),
				"Staking::timestampToLockDate: staking period too short"
			);
		});

		it("Shouldn't be able to stake longer than max duration", async () => {
			let amount = "100";
			let lockedTS = await getTimeFromKickoff(MAX_DURATION);
			let tx = await staking.stake(amount, lockedTS, account1, account1);

			expectEvent(tx, "TokensStaked", {
				staker: account1,
				amount: amount,
				lockedUntil: lockedTS,
				totalStaked: amount,
			});

			expectEvent(tx, "DelegateChanged", {
				delegator: account1,
				fromDelegate: ZERO_ADDRESS,
				toDelegate: account1,
			});
		});

		it("Sender should be used if zero addresses passed", async () => {
			let amount = "100";
			let lockedTS = await getTimeFromKickoff(MAX_DURATION);
			let tx = await staking.stake(amount, lockedTS, ZERO_ADDRESS, ZERO_ADDRESS);

			expectEvent(tx, "TokensStaked", {
				staker: root,
				amount: amount,
				lockedUntil: lockedTS,
				totalStaked: amount,
			});

			expectEvent(tx, "DelegateChanged", {
				delegator: root,
				fromDelegate: ZERO_ADDRESS,
				toDelegate: root,
			});
		});

		it("Should be able to stake and delegate for yourself", async () => {
			let amount = "100";
			let duration = TWO_WEEKS;
			let lockedTS = await getTimeFromKickoff(duration);

			let stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toNumber()).to.be.equal(0);
			let beforeBalance = await token.balanceOf.call(root);

			let tx = await staking.stake(amount, lockedTS, root, root);

			stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toString()).to.be.equal(amount);
			let afterBalance = await token.balanceOf.call(root);
			expect(beforeBalance.sub(afterBalance).toString()).to.be.equal(amount);

			// _writeUserCheckpoint
			let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(root, lockedTS);
			expect(numUserCheckpoints.toNumber()).to.be.equal(1);
			let checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);

			// _increaseDailyStake
			let numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(lockedTS);
			expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(1);
			checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);

			// _delegate
			let delegator = await staking.delegates.call(root, lockedTS);
			expect(delegator).to.be.equal(root);

			let numDelegateStakingCheckpoints = await staking.numDelegateStakingCheckpoints.call(root, lockedTS);
			expect(numDelegateStakingCheckpoints.toNumber()).to.be.equal(1);
			checkpoint = await staking.delegateStakingCheckpoints.call(root, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);

			expectEvent(tx, "TokensStaked", {
				staker: root,
				amount: amount,
				lockedUntil: lockedTS,
				totalStaked: amount,
			});

			expectEvent(tx, "DelegateChanged", {
				delegator: root,
				fromDelegate: ZERO_ADDRESS,
				toDelegate: root,
			});
		});

		it("Should be able to stake and delegate for another person", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);

			let tx = await staking.stake(amount, lockedTS, account1, account1);

			// _writeUserCheckpoint
			let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(account1, lockedTS);
			expect(numUserCheckpoints.toNumber()).to.be.equal(1);
			let checkpoint = await staking.userStakingCheckpoints.call(account1, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);

			// _increaseDailyStake
			let numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(lockedTS);
			expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(1);
			checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);

			// _delegate
			let delegator = await staking.delegates.call(account1, lockedTS);
			expect(delegator).to.be.equal(account1);

			let numDelegateStakingCheckpoints = await staking.numDelegateStakingCheckpoints.call(account1, lockedTS);
			expect(numDelegateStakingCheckpoints.toNumber()).to.be.equal(1);
			checkpoint = await staking.delegateStakingCheckpoints.call(account1, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);

			expectEvent(tx, "TokensStaked", {
				staker: account1,
				amount: amount,
				lockedUntil: lockedTS,
				totalStaked: amount,
			});

			expectEvent(tx, "DelegateChanged", {
				delegator: account1,
				fromDelegate: ZERO_ADDRESS,
				toDelegate: account1,
			});
		});

		it("Should be able to stake after withdrawing whole amount", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockedTS, root, root);

			// await setTime(lockedTS);
			setNextBlockTimestamp(lockedTS.toNumber());

			let stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toString()).to.be.equal(amount);

			await staking.withdraw(amount, lockedTS, root);

			stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toNumber()).to.be.equal(0);

			// stake second time
			lockedTS = await getTimeFromKickoff(duration * 2);
			let tx = await staking.stake(amount * 2, lockedTS, root, root);

			stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toNumber()).to.be.equal(amount * 2);

			// _writeUserCheckpoint
			let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(root, lockedTS);
			expect(numUserCheckpoints.toNumber()).to.be.equal(1);
			let checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(amount * 2);
		});

		it("Should be able to stake after withdrawing amount partially", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);

			let bb = await token.balanceOf.call(root);

			await staking.stake(amount, lockedTS, root, root);

			// await setTime(lockedTS);
			setNextBlockTimestamp(lockedTS.toNumber());
			blockTimestamp = (await ethers.provider.getBlock("latest")).timestamp;

			let stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toString()).to.be.equal(amount);
			let beforeBalance = await token.balanceOf.call(root);

			await staking.withdraw(amount / 2, lockedTS, root);

			stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toNumber()).to.be.equal(amount / 2);
			let afterBalance = await token.balanceOf.call(root);

			expect(afterBalance.sub(beforeBalance).toNumber()).to.be.equal(amount / 2);

			// increase stake
			lockedTS = await getTimeFromKickoff(duration * 2);
			let tx = await staking.stake(amount * 2.5, lockedTS, root, root);

			stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toNumber()).to.be.equal(amount * 3);

			// _writeUserCheckpoint
			let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(root, lockedTS);
			expect(numUserCheckpoints.toNumber()).to.be.equal(1);
			let checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(amount * 2.5);
		});
	});

	describe("stakeWithApproval", () => {
		it("Should be able to stake and delegate for yourself", async () => {
			let amount = "100";
			let duration = TWO_WEEKS;
			let lockedTS = await getTimeFromKickoff(duration);

			let stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toNumber()).to.be.equal(0);
			let beforeBalance = await token.balanceOf.call(root);

			await token.approve(staking.address, 0);

			// TODO
			await token.approve(staking.address, amount * 2, { from: account1 });

			let contract = new web3.eth.Contract(staking.abi, staking.address);
			let sender = root;
			let data = contract.methods.stakeWithApproval(sender, amount, lockedTS, root, root).encodeABI();
			// let data = contract.methods.stakeWithApproval(account1, amount * 2, lockedTS, root, root).encodeABI();
			let tx = await token.approveAndCall(staking.address, amount, data, { from: sender });

			stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toString()).to.be.equal(amount);
			let afterBalance = await token.balanceOf.call(root);
			expect(beforeBalance.sub(afterBalance).toString()).to.be.equal(amount);

			// _writeUserCheckpoint
			let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(root, lockedTS);
			expect(numUserCheckpoints.toNumber()).to.be.equal(1);
			let checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);

			// _increaseDailyStake
			let numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(lockedTS);
			expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(1);
			checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);

			// _delegate
			let delegator = await staking.delegates.call(root, lockedTS);
			expect(delegator).to.be.equal(root);

			let numDelegateStakingCheckpoints = await staking.numDelegateStakingCheckpoints.call(root, lockedTS);
			expect(numDelegateStakingCheckpoints.toNumber()).to.be.equal(1);
			checkpoint = await staking.delegateStakingCheckpoints.call(root, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);
		});

		it("fails if invoked directly", async () => {
			let lockedTS = await getTimeFromKickoff(TWO_WEEKS);
			await expectRevert(staking.stakeWithApproval(root, "100", lockedTS, root, root), "unauthorized");
		});

		it("fails if wrong method passed in data", async () => {
			let amount = "100";
			let lockedTS = await getTimeFromKickoff(TWO_WEEKS);
			let contract = new web3.eth.Contract(staking.abi, staking.address);
			let data = contract.methods.stake(amount, lockedTS, root, root).encodeABI();

			await expectRevert(token.approveAndCall(staking.address, amount, data), "method is not allowed");
		});

		it("fails if wrong sender passed in data", async () => {
			let amount = "100";
			let lockedTS = await getTimeFromKickoff(TWO_WEEKS);
			let contract = new web3.eth.Contract(staking.abi, staking.address);

			await token.approve(staking.address, amount * 2, { from: account1 });
			let sender = root;
			let data = contract.methods.stakeWithApproval(account1, amount, lockedTS, root, root).encodeABI();

			await expectRevert(token.approveAndCall(staking.address, amount, data, { from: sender }), "sender mismatch");
		});

		it("fails if wrong amount passed in data", async () => {
			let amount = "100";
			let lockedTS = await getTimeFromKickoff(TWO_WEEKS);
			let contract = new web3.eth.Contract(staking.abi, staking.address);

			await token.approve(staking.address, amount * 2, { from: account1 });
			let sender = root;
			let data = contract.methods.stakeWithApproval(sender, amount, lockedTS, root, root).encodeABI();

			await expectRevert(token.approveAndCall(staking.address, amount * 2, data, { from: sender }), "amount mismatch");
		});
	});

	describe("WeightedStaking", () => {
		/// @dev On governance/Staking/WeightedStaking.sol the conditional:
		///   if (userStakingCheckpoints[account][date][nCheckpoints - 1].fromBlock <= blockNumber)
		///   is always met, because when a checkpoint is created it is always set the blocknumber
		///   of the transaction ocurring. So current blockNumber is to be equal to the
		///   blockNumber of the checkpoint if it has been created on the same block,
		///   or bigger if it was created on a previous block. Only exception to this
		///   would be to request the prior stake for a blockNumber lower than
		///   the current one, i.e. an historical query.
		it("Coverage for WeightedStaking::_getPriorUserStakeByDate", async () => {
			let amount = new BN(1000);
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);

			// 1st Stake
			await staking.stake(amount, lockedTS, root, account1);

			// 2nd Stake
			await staking.stake(amount, lockedTS, root, account1);

			// Remember the blocknumber of the second staking
			let block = await web3.eth.getBlock("latest");

			// Time travel, just enough to jump 1 block
			await time.increase(1);

			// Check stake is there for the block when 2nd staking took place
			let priorStake = await staking.getPriorUserStakeByDate.call(root, lockedTS, new BN(block.number));
			expect(priorStake).to.be.bignumber.equal(amount.mul(new BN(2)));

			// Check there is still stake for the block when 1st staking took place
			priorStake = await staking.getPriorUserStakeByDate.call(root, lockedTS, new BN(block.number).sub(new BN(1)));
			expect(priorStake).to.be.bignumber.equal(amount);

			// Check there is no stake for previous block to the block when staking took place
			priorStake = await staking.getPriorUserStakeByDate.call(root, lockedTS, new BN(block.number).sub(new BN(2)));
			expect(priorStake).to.be.bignumber.equal(new BN(0));
		});
	});

	describe("extendStakingDuration", () => {
		it("shouldn't extendStakingDuration when _getPriorUserStakeByDate == 0", async () => {
			let duration = new BN(0);
			let lockedTS = await getTimeFromKickoff(duration);
			// console.log("lockedTS: ", lockedTS.toString());
			let newTime = await getTimeFromKickoff(TWO_WEEKS);
			// console.log("newTime:  ", newTime.toString());

			// Trying to extend the stake when previous stake is 0
			await expectRevert(
				staking.extendStakingDuration(lockedTS, newTime),
				"nothing staked until the previous lock date"
			);
		});

		it("extend to a date inside the next 2 weeks granularity bucket", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			// console.log("lockedTS: ", lockedTS.toString());

			// Extending for 13 days
			let newDuration = duration.add(new BN(DAY).mul(new BN(13)));
			let newTime = await getTimeFromKickoff(newDuration);
			console.log("newTime:  ", newTime.toString());
			let newTimeLockDate = await staking.timestampToLockDate(newTime);
			console.log("newTimeLockDate:  ", newTimeLockDate.toString());

			// Set delegate as account1
			await staking.stake(amount, lockedTS, root, account1);

			// Check the delegate of the stake
			let delegate = await staking.delegates(root, lockedTS);
			expect(delegate).equal(account1);

			// Extending the stake
			await staking.extendStakingDuration(lockedTS, newTime);

			// Check the delegate of the extended stake
			delegate = await staking.delegates(root, newTimeLockDate);
			/// @dev A 13 days extension is setting delegate to address(0)
			///   TODO: Should be fixed soon by contract upgrade.
			///   When fixed, uncomment next line and test should be working ok.
			// expect(delegate).equal(account1);
		});

		it("Cannot reduce the staking duration", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockedTS, root, root);

			let newTime = await getTimeFromKickoff(TWO_WEEKS);
			await expectRevert(staking.extendStakingDuration(lockedTS, newTime), "cannot reduce the staking duration");
		});

		it("Do not exceed the max duration", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockedTS, root, root);

			let newTime = await getTimeFromKickoff(MAX_DURATION.mul(new BN(2)));
			let tx = await staking.extendStakingDuration(lockedTS, newTime);

			expectEvent(tx, "ExtendedStakingDuration", {
				staker: root,
				previousDate: lockedTS,
				newDate: await getTimeFromKickoff(MAX_DURATION),
				amountStaked: amount,
			});
		});

		it("Should be able to extend staking duration", async () => {
			let amount = "1000";
			let lockedTS = await getTimeFromKickoff(TWO_WEEKS);
			let tx1 = await staking.stake(amount, lockedTS, root, root);

			let stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toString()).to.be.equal(amount);
			let beforeBalance = await token.balanceOf.call(root);

			expect(tx1.logs[2].args.lockedUntil.toNumber()).to.be.equal(lockedTS.toNumber());

			let newLockedTS = await getTimeFromKickoff(TWO_WEEKS * 2);
			let tx2 = await staking.extendStakingDuration(lockedTS, newLockedTS);

			stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toString()).to.be.equal(amount);
			let afterBalance = await token.balanceOf.call(root);
			expect(beforeBalance.sub(afterBalance).toNumber()).to.be.equal(0);

			// _decreaseDailyStake
			let numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(lockedTS);
			expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(2);
			let checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);
			checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 1);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal("0");

			// _increaseDailyStake
			numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(newLockedTS);
			expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(1);
			checkpoint = await staking.totalStakingCheckpoints.call(newLockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);

			// _writeUserCheckpoint
			let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(root, lockedTS);
			expect(numUserCheckpoints.toNumber()).to.be.equal(2);
			checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);
			checkpoint = await staking.userStakingCheckpoints.call(root, newLockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);

			expectEvent(tx2, "ExtendedStakingDuration", {
				staker: root,
				previousDate: lockedTS,
				newDate: newLockedTS,
				amountStaked: amount,
			});
		});

		it("should update the vesting checkpoints if the stake is extended with a vesting contract", async () => {
			//TODO if vesting contracts should ever support this function.
			//currently, they don't and they are not upgradable.
		});
	});

	describe("increaseStake", () => {
		it("stakesBySchedule w/ duration < = > MAX_DURATION", async () => {
			let amount = "1000";
			let duration = new BN(MAX_DURATION).div(new BN(2));
			let cliff = new BN(TWO_WEEKS).mul(new BN(2));
			let intervalLength = new BN(10000000);
			let lockTS = await getTimeFromKickoff(duration);
			await staking.stakesBySchedule(amount, cliff, duration, intervalLength, root, root);

			// Check staking status for this staker
			let rootStaked = await staking.getStakes(root);
			// console.log("rootStaked['stakes']", rootStaked["stakes"].toString());
			let stakedDurationLowerThanMax = rootStaked["stakes"][0];

			// Reset & duration = MAX
			await loadFixture(deploymentAndInitFixture);
			duration = new BN(MAX_DURATION);
			await staking.stakesBySchedule(amount, cliff, duration, intervalLength, root, root);

			// Check staking status for this staker
			rootStaked = await staking.getStakes(root);
			// console.log("rootStaked['stakes']", rootStaked["stakes"].toString());
			let stakedDurationEqualToMax = rootStaked["stakes"][0];

			// Reset & duration > MAX
			await loadFixture(deploymentAndInitFixture);
			duration = new BN(MAX_DURATION).mul(new BN(4));
			await staking.stakesBySchedule(amount, cliff, duration, intervalLength, root, root);

			// Check staking status for this staker
			rootStaked = await staking.getStakes(root);
			// console.log("rootStaked['stakes']", rootStaked["stakes"].toString());
			let stakedDurationHigherThanMax = rootStaked["stakes"][0];

			/// @dev When duration = MAX or duration > MAX, contract deals w/ it as MAX
			///   so the staked amount is higher when duration < MAX and equal when duration >= MAX
			expect(stakedDurationLowerThanMax).to.be.bignumber.greaterThan(stakedDurationEqualToMax);
			expect(stakedDurationEqualToMax).to.be.bignumber.equal(stakedDurationHigherThanMax);
		});

		it("Check getCurrentStakedUntil", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockTS = await getTimeFromKickoff(duration);

			// Check staking status before staking
			let totalStaked = await staking.getCurrentStakedUntil(lockTS);
			// console.log("totalStaked", totalStaked.toString());
			expect(totalStaked).to.be.bignumber.equal(new BN(0));

			await staking.stake(amount, lockTS, root, root);

			// Check staking status after staking
			totalStaked = await staking.getCurrentStakedUntil(lockTS);
			// console.log("totalStaked", totalStaked.toString());
			expect(totalStaked).to.be.bignumber.equal(amount);
		});

		it("Amount of tokens to stake needs to be bigger than 0", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockTS, root, root);

			await expectRevert(staking.stake("0", lockTS, root, root), "amount needs to be bigger than 0");
		});

		it("Amount of tokens to stake needs to be bigger than 0", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockTS, root, root);

			await token.approve(staking.address, 0);
			await expectRevert(staking.stake(amount, lockTS, root, root), "ERC20: transfer amount exceeds allowance");
		});

		it("Shouldn't be able to overflow balance", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockTS, root, root);

			let maxValue = new BN(2).pow(new BN(96)).sub(new BN(1));
			await expectRevert(staking.stake(maxValue.sub(new BN(100)), lockTS, root, root), "overflow");
		});

		it("Should be able to increase stake", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			let tx1 = await staking.stake(amount, lockedTS, root, root);

			// check delegatee
			let delegatee = await staking.delegates(root, lockedTS);
			expect(delegatee).equal(root);

			let stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toString()).to.be.equal(amount);
			let beforeBalance = await token.balanceOf.call(root);

			let tx2 = await staking.stake(amount * 2, lockedTS, root, account1);

			// check delegatee
			delegatee = await staking.delegates(root, lockedTS);
			expect(delegatee).equal(account1);

			stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toNumber()).to.be.equal(amount * 3);
			let afterBalance = await token.balanceOf.call(root);
			expect(beforeBalance.sub(afterBalance).toNumber()).to.be.equal(amount * 2);

			// _increaseDailyStake
			let numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(lockedTS);
			expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(2);
			let checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);
			checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 1);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(amount * 3);

			// _writeUserCheckpoint
			let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(root, lockedTS);
			expect(numUserCheckpoints.toNumber()).to.be.equal(2);
			checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);
			checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 1);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(amount * 3);

			// delegateStakingCheckpoints - root
			let numDelegateStakingCheckpoints = await staking.numDelegateStakingCheckpoints.call(root, lockedTS);
			expect(numDelegateStakingCheckpoints.toNumber()).to.be.equal(2);
			checkpoint = await staking.delegateStakingCheckpoints.call(root, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);
			checkpoint = await staking.delegateStakingCheckpoints.call(root, lockedTS, 1);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(0);

			// delegateStakingCheckpoints - account1
			numDelegateStakingCheckpoints = await staking.numDelegateStakingCheckpoints.call(account1, lockedTS);
			expect(numDelegateStakingCheckpoints.toNumber()).to.be.equal(1);
			checkpoint = await staking.delegateStakingCheckpoints.call(account1, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(amount * 3);

			expectEvent(tx2, "TokensStaked", {
				staker: root,
				amount: new BN(amount * 2),
				lockedUntil: lockedTS,
				totalStaked: new BN(amount * 3),
			});
		});
	});

	describe("getStakes", () => {
		it("Should be able to increase stake", async () => {
			let amount1 = "1000";
			let lockedTS1 = await getTimeFromKickoff(new BN(TWO_WEEKS));
			await staking.stake(amount1, lockedTS1, root, root);

			// time travel
			await time.increase(TWO_WEEKS * 10);

			let amount2 = "5000";
			let lockedTS2 = await getTimeFromKickoff(new BN(MAX_DURATION));
			await staking.stake(amount2, lockedTS2, root, root);

			let data = await staking.getStakes.call(root);

			// for (let i = 0; i < data.dates.length; i++) {

			// }

			expect(data.dates[0]).to.be.bignumber.equal(new BN(lockedTS1));
			expect(data.stakes[0]).to.be.bignumber.equal(new BN(amount1));

			expect(data.dates[1]).to.be.bignumber.equal(new BN(lockedTS2));
			expect(data.stakes[1]).to.be.bignumber.equal(new BN(amount2));
		});
	});

	describe("setWeightScaling", () => {
		it("Shouldn't be able to weight scaling less than min value", async () => {
			await expectRevert(staking.setWeightScaling(0), "weight scaling doesn't belong to range [1, 9]");
		});

		it("Shouldn't be able to weight scaling more than max value", async () => {
			await expectRevert(staking.setWeightScaling(10), "weight scaling doesn't belong to range [1, 9]");
		});

		it("Only owner should be able to weight scaling", async () => {
			await expectRevert(staking.setWeightScaling(5, { from: account1 }), "unauthorized");
		});

		it("Should be able to weight scaling", async () => {
			await staking.setWeightScaling(7);

			expect(await staking.weightScaling.call()).to.be.bignumber.equal(new BN(7));
		});
	});

	describe("withdraw", () => {
		it("Amount of tokens to be withdrawn needs to be bigger than 0", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockedTS, root, root);

			await expectRevert(
				staking.withdraw("0", lockedTS, root),
				"Staking::withdraw: amount of tokens to be withdrawn needs to be bigger than 0"
			);
		});

		it("Shouldn't be able to withdraw amount greater than balance", async () => {
			let amount = 1000;
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockedTS, root, root);

			// await setTime(lockedTS);
			setNextBlockTimestamp(lockedTS.toNumber());
			await expectRevert(staking.withdraw(amount * 2, lockedTS, root), "Staking::withdraw: not enough balance");
		});

		it("Should be able to withdraw", async () => {
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

			let tx2 = await staking.withdraw(amount / 2, lockedTS, root);

			stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toNumber()).to.be.equal(amount / 2);
			let afterBalance = await token.balanceOf.call(root);
			expect(afterBalance.sub(beforeBalance).toNumber()).to.be.equal(amount / 2);

			// _increaseDailyStake
			let numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(lockedTS);
			expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(2);
			let checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);
			checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 1);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(amount / 2);

			// _writeUserCheckpoint
			let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(root, lockedTS);
			expect(numUserCheckpoints.toNumber()).to.be.equal(2);
			checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);
			checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 1);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(amount / 2);

			// _decreaseDelegateStake
			let numDelegateStakingCheckpoints = await staking.numDelegateStakingCheckpoints.call(root, lockedTS);
			checkpoint = await staking.delegateStakingCheckpoints.call(root, lockedTS, numDelegateStakingCheckpoints - 1);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(amount / 2);
			expect(numDelegateStakingCheckpoints.toNumber()).to.be.equal(2);

			expectEvent(tx2, "StakingWithdrawn", {
				staker: root,
				amount: new BN(amount / 2),
			});
		});

		it("Should be able to withdraw second time", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockedTS, root, root);

			let stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toString()).to.be.equal(amount);

			await staking.withdraw(amount / 2, lockedTS, account2);

			stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toNumber()).to.be.equal(amount / 2);

			// _decreaseDelegateStake
			let numDelegateStakingCheckpoints = await staking.numDelegateStakingCheckpoints.call(root, lockedTS);
			let checkpoint = await staking.delegateStakingCheckpoints.call(root, lockedTS, numDelegateStakingCheckpoints - 1);
			expect(checkpoint.stake.toNumber()).to.be.equal(amount / 2);
			expect(numDelegateStakingCheckpoints.toNumber()).to.be.equal(2);

			await staking.withdraw(amount / 2, lockedTS, account2);

			stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toNumber()).to.be.equal(0);

			// _decreaseDelegateStake
			numDelegateStakingCheckpoints = await staking.numDelegateStakingCheckpoints.call(root, lockedTS);
			checkpoint = await staking.delegateStakingCheckpoints.call(root, lockedTS, numDelegateStakingCheckpoints - 1);
			expect(checkpoint.stake.toNumber()).to.be.equal(0);
			expect(numDelegateStakingCheckpoints.toNumber()).to.be.equal(3);

			let feeSharingBalance = await token.balanceOf.call(feeSharingProxy.address);
			let userBalance = await token.balanceOf.call(account2);

			let maxVotingWeight = await staking.MAX_VOTING_WEIGHT.call();
			let maxDuration = await staking.MAX_DURATION.call();
			let weightFactor = await staking.WEIGHT_FACTOR.call();
			let weight = weightingFunction(amount, duration, maxDuration, maxVotingWeight, weightFactor.toNumber()) / 100;
			let weightScaling = await staking.weightScaling.call();
			weight = weight * weightScaling;
			let punishedAmount = weight;

			await expect(feeSharingBalance).to.be.bignumber.equal(new BN(punishedAmount));
			await expect(userBalance).to.be.bignumber.equal(new BN(amount - punishedAmount));
		});

		it("Should be able to withdraw second time", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockedTS, root, root);

			await staking.withdraw(amount, lockedTS, root);

			await staking.stake(amount, lockedTS, root, root);

			await staking.withdraw(amount, lockedTS, root);
		});

		it("Should be able to withdraw second time after partial withdraw", async () => {
			let amount = new BN(1000);
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockedTS, root, root);

			await staking.withdraw(amount.sub(new BN(1)), lockedTS, root);

			await staking.stake(amount, lockedTS, root, root);

			await staking.withdraw(amount.add(new BN(1)), lockedTS, root);
		});

		it("Should be able to withdraw second time (emulate issue with delegate checkpoint)", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockedTS, root, root);

			await staking.withdraw(amount, lockedTS, root);

			await staking.stake(amount, lockedTS, root, root);
			await staking.setDelegateStake(root, lockedTS, 0);

			await staking.withdraw(amount, lockedTS, root);
		});

		it("Should be able to extend stake after second stake (emulate issue with delegate checkpoint)", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockedTS, root, root);

			await staking.withdraw(amount, lockedTS, root);

			await staking.stake(amount, lockedTS, root, root);
			await staking.setDelegateStake(root, lockedTS, 0);

			let lockedTS2 = await getTimeFromKickoff(duration.mul(new BN(3)));
			await staking.extendStakingDuration(lockedTS, lockedTS2);
		});

		it("Should be able to delegate stake after second stake (emulate issue with delegate checkpoint)", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockedTS, root, root);

			await staking.withdraw(amount, lockedTS, root);

			await staking.stake(amount, lockedTS, root, root);
			await staking.setDelegateStake(root, lockedTS, 0);

			await staking.delegate(account1, lockedTS);
		});

		it("Should be able to withdraw earlier for any lock date", async () => {
			let amount = "10000";

			for (let i = 1; i <= 78; i++) {
				if (i !== 1 && i !== 78 && i % 10 !== 0) {
					continue;
				}

				//FeeSharingProxy
				let feeSharingLogic = await FeeSharingLogic.new();
				feeSharingProxyObj = await FeeSharingProxy.new(sovryn.address, staking.address);
				await feeSharingProxyObj.setImplementation(feeSharingLogic.address);
				feeSharingProxy = await FeeSharingLogic.at(feeSharingProxyObj.address);
				await sovryn.setFeesController(feeSharingProxy.address);
				await staking.setFeeSharing(feeSharingProxy.address);

				let duration = new BN(i * TWO_WEEKS);
				let lockedTS = await getTimeFromKickoff(duration);
				await staking.stake(amount, lockedTS, root, root);

				let stakingBalance = await token.balanceOf.call(staking.address);
				expect(stakingBalance.toString()).to.be.equal(amount);

				await mineBlock();
				let amounts = await staking.getWithdrawAmounts(amount, lockedTS);
				let returnedAvailableAmount = amounts[0];
				let returnedPunishedAmount = amounts[1];

				await staking.withdraw(amount, lockedTS, account2);

				stakingBalance = await token.balanceOf.call(staking.address);
				expect(stakingBalance.toNumber()).to.be.equal(0);

				let feeSharingBalance = await token.balanceOf.call(feeSharingProxy.address);
				let userBalance = await token.balanceOf.call(account2);

				let maxVotingWeight = await staking.MAX_VOTING_WEIGHT.call();
				let maxDuration = await staking.MAX_DURATION.call();
				let weightFactor = await staking.WEIGHT_FACTOR.call();
				let weight = weightingFunction(amount, duration, maxDuration, maxVotingWeight, weightFactor.toNumber()) / 100;
				let weightScaling = await staking.weightScaling.call();
				weight = weight * weightScaling;
				let punishedAmount = weight;

				let weeks = i * 2;

				expect(feeSharingBalance).to.be.bignumber.equal(new BN(punishedAmount));

				expect(returnedPunishedAmount).to.be.bignumber.equal(new BN(punishedAmount));
				expect(returnedAvailableAmount).to.be.bignumber.equal(new BN(amount).sub(returnedPunishedAmount));
			}
		});

		it("if withdrawing with a vesting contract, the vesting chckpoints need to be updated", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			let { vestingInstance, blockNumber } = await createVestingContractWithSingleDate(duration, amount, token, staking, root);

			//await setTime(lockedTS);
			setNextBlockTimestamp(lockedTS.toNumber());
			mineBlock();

			let stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toString()).to.be.equal(amount);
			let beforeBalance = await token.balanceOf.call(root);

			let tx2 = await vestingInstance.withdrawTokens(root);

			stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toNumber()).to.be.equal(0);
			let afterBalance = await token.balanceOf.call(root);
			expect(afterBalance.sub(beforeBalance).toString()).to.be.equal(amount);

			//_decreaseDailyStake
			let numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(lockedTS);
			expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(2);
			let checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);
			checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 1);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(0);

			//_decreaseVestingStake
			let numVestingCheckpoints = await staking.numVestingCheckpoints.call(lockedTS);
			expect(numVestingCheckpoints.toNumber()).to.be.equal(2);
			checkpoint = await staking.vestingCheckpoints.call(lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);
			checkpoint = await staking.vestingCheckpoints.call(lockedTS, 1);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(0);
		});
	});

	describe("unlockAllTokens", () => {
		it("Only owner should be able to unlock all tokens", async () => {
			await expectRevert(staking.unlockAllTokens({ from: account1 }), "unauthorized");
		});

		it("Should be able to unlock all tokens", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockedTS, root, root);

			let tx = await staking.unlockAllTokens();

			expectEvent(tx, "TokensUnlocked", {
				amount: amount,
			});

			await staking.withdraw(amount, lockedTS, root);
		});
	});

	describe("timestampToLockDate", () => {
		it("Lock date should be start + 1 period", async () => {
			let kickoffTS = await staking.kickoffTS.call();
			let newTime = kickoffTS.add(new BN(TWO_WEEKS));
			// await setTime(newTime);
			setNextBlockTimestamp(newTime.toNumber());

			let result = await staking.timestampToLockDate(newTime);
			expect(result.sub(kickoffTS).toNumber()).to.be.equal(TWO_WEEKS);
		});

		it("Lock date should be start + 2 period", async () => {
			let kickoffTS = await staking.kickoffTS.call();
			let newTime = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)).add(new BN(DAY)));
			// await setTime(newTime);
			setNextBlockTimestamp(newTime.toNumber());

			let result = await staking.timestampToLockDate(newTime);
			expect(result.sub(kickoffTS).toNumber()).to.be.equal(TWO_WEEKS * 2);
		});

		it("Lock date should be start + 3 period", async () => {
			let kickoffTS = await staking.kickoffTS.call();
			let newTime = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(3)).add(new BN(DAY)));
			// await setTime(newTime);
			setNextBlockTimestamp(newTime.toNumber());

			let result = await staking.timestampToLockDate(newTime);
			expect(result.sub(kickoffTS).toNumber()).to.be.equal(TWO_WEEKS * 3);
		});
	});

	describe("upgrade:", async () => {
		it("Should be able to read correct data after an upgrade", async () => {
			let amount = 100;
			let lockedTS = await getTimeFromKickoff(MAX_DURATION);
			let tx = await staking.stake(amount, lockedTS, root, root);

			// before upgrade
			let balance = await staking.balanceOf.call(root);
			expect(balance.toNumber()).to.be.equal(amount);
			let checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(amount);

			// upgrade
			staking = await StakingProxy.at(staking.address);
			let stakingMockup = await StakingMockup.new(token.address);
			await staking.setImplementation(stakingMockup.address);
			staking = await StakingMockup.at(staking.address);

			// after upgrade: storage data remained the same
			balance = await staking.balanceOf.call(root);
			expect(balance.toNumber()).to.be.equal(amount);
			checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(amount);

			// after upgrade: new method added
			balance = await staking.balanceOf_MultipliedByTwo.call(root);
			expect(balance.toNumber()).to.be.equal(amount * 2);
		});
	});

	async function getTimeFromKickoff(delay) {
		let kickoffTS = await staking.kickoffTS.call();
		return kickoffTS.add(new BN(delay));
	}
});

function weightingFunction(stake, time, maxDuration, maxVotingWeight, weightFactor) {
	let x = maxDuration - time;
	let mD2 = maxDuration * maxDuration;
	return Math.floor((stake * (Math.floor((maxVotingWeight * weightFactor * (mD2 - x * x)) / mD2) + weightFactor)) / weightFactor);
}

async function createVestingContractWithSingleDate(cliff, amount, token, staking, tokenOwner) {
	vestingLogic = await VestingLogic.new();
	let vestingInstance = await Vesting.new(vestingLogic.address, token.address, staking.address, tokenOwner, cliff, cliff, tokenOwner);
	vestingInstance = await VestingLogic.at(vestingInstance.address);
	//important, so it's recognized as vesting contract
	await staking.addContractCodeHash(vestingInstance.address);

	await token.approve(vestingInstance.address, amount);
	let result = await vestingInstance.stakeTokens(amount);
	return { vestingInstance: vestingInstance, blockNumber: result.receipt.blockNumber };
}
