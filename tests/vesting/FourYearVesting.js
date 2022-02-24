const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");
const {
	increaseTime,
	lastBlock,
} = require("../Utils/Ethereum");

const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const SOV = artifacts.require("SOV");
const TestWrbtc = artifacts.require("TestWrbtc");
const FeeSharingProxy = artifacts.require("FeeSharingProxyMockup");
const VestingLogic = artifacts.require("FourYearVestingLogic");
const Vesting = artifacts.require("FourYearVesting");
//Upgradable Vesting Registry
const VestingRegistryLogic = artifacts.require("VestingRegistryLogicMockup");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");

const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
const WEEK = new BN(7 * 24 * 60 * 60);

const TOTAL_SUPPLY = "10000000000000000000000000";
const ONE_MILLON = "1000000000000000000000000";
const ONE_ETHER = "1000000000000000000";

contract("FourYearVesting", (accounts) => {
	let root, a1, a2, a3;
	let token, staking, stakingLogic, feeSharingProxy;
	let vestingLogic;
	let kickoffTS;

	let cliff = "1";
	let duration = "39";

	before(async () => {
		[root, a1, a2, a3, ...accounts] = accounts;
		token = await SOV.new(TOTAL_SUPPLY);
		wrbtc = await TestWrbtc.new();

		vestingLogic = await VestingLogic.new();

		feeSharingProxy = await FeeSharingProxy.new(constants.ZERO_ADDRESS, constants.ZERO_ADDRESS);

		stakingLogic = await StakingLogic.new(token.address);
		staking = await StakingProxy.new(token.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);
		//Upgradable Vesting Registry
		vestingRegistryLogic = await VestingRegistryLogic.new();
		vestingReg = await VestingRegistryProxy.new();
		await vestingReg.setImplementation(vestingRegistryLogic.address);
		vestingReg = await VestingRegistryLogic.at(vestingReg.address);
		await staking.setVestingRegistry(vestingReg.address);

		await token.transfer(a2, "1000");
		await token.approve(staking.address, "1000", { from: a2 });

		kickoffTS = await staking.kickoffTS.call();
	});

	describe("constructor", () => {
		it("sets the expected values", async () => {
			let vestingInstance = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				cliff,
				duration,
				feeSharingProxy.address
			);
			vestingInstance = await VestingLogic.at(vestingInstance.address);

			// Check data
			let _sov = await vestingInstance.SOV();
			let _stackingAddress = await vestingInstance.staking();
			let _tokenOwner = await vestingInstance.tokenOwner();
			let _cliff = await vestingInstance.cliff();
			let _duration = await vestingInstance.duration();
			let _feeSharingProxy = await vestingInstance.feeSharingProxy();

			assert.equal(_sov, token.address);
			assert.equal(_stackingAddress, staking.address);
			assert.equal(_tokenOwner, root);
			assert.equal(_cliff.toString(), cliff);
			assert.equal(_duration.toString(), duration);
			assert.equal(_feeSharingProxy, feeSharingProxy.address);
		});

		it("fails if the 0 address is passed as SOV address", async () => {
			await expectRevert(
				Vesting.new(vestingLogic.address, constants.ZERO_ADDRESS, staking.address, root, cliff, duration, feeSharingProxy.address),

				"SOV address invalid"
			);
		});

		it("fails if the 0 address is passed as token owner address", async () => {
			await expectRevert(
				Vesting.new(
					vestingLogic.address,
					token.address,
					staking.address,
					constants.ZERO_ADDRESS,
					cliff,
					duration,
					feeSharingProxy.address
				),
				"token owner address invalid"
			);
		});

		it("fails if the 0 address is passed as staking address", async () => {
			await expectRevert(
				Vesting.new(vestingLogic.address, token.address, constants.ZERO_ADDRESS, root, cliff, duration, feeSharingProxy.address),
				"staking address invalid"
			);
		});

		it("fails if the vesting duration is bigger than the max staking duration", async () => {
			await expectRevert(
				Vesting.new(
					vestingLogic.address,
					token.address,
					staking.address,
					root,
					cliff,
					MAX_DURATION.add(new BN(1)),
					feeSharingProxy.address
				),
				"duration may not exceed the max duration"
			);
		});

		it("fails if the vesting duration is shorter than the cliff", async () => {
			await expectRevert(
				Vesting.new(vestingLogic.address, token.address, staking.address, root, 100, 99, feeSharingProxy.address),
				"duration must be bigger than or equal to the cliff"
			);
		});

		it("fails if the 0 address is passed as feeSharingProxy address", async () => {
			await expectRevert(
				Vesting.new(vestingLogic.address, token.address, staking.address, root, cliff, duration, constants.ZERO_ADDRESS),
				"feeSharingProxy address invalid"
			);
		});
	});

	describe("delegate", () => {
		let vesting;
		it("should stake tokens and delegate voting power", async () => {
			let toStake = ONE_MILLON;
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				a2,
				4 * WEEK,
				39 * 4 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await token.approve(vesting.address, toStake);
			await vesting.stakeTokens(toStake, 0);

			// check delegatee
			let data = await staking.getStakes.call(vesting.address);
			/// @dev Optimization: This loop through 40 steps is a bottleneck
			for (let i = 0; i < data.dates.length; i++) {
				let delegatee = await staking.delegates(vesting.address, data.dates[i]);
				expect(delegatee).equal(a2);
			}

			// delegate
			let tx = await vesting.delegate(a1, { from: a2 });

			expectEvent(tx, "VotesDelegated", {
				caller: a2,
				delegatee: a1,
			});

			// check new delegatee
			data = await staking.getStakes.call(vesting.address);
			/// @dev Optimization: This loop through 40 steps is a bottleneck
			for (let i = 0; i < data.dates.length; i++) {
				let delegatee = await staking.delegates(vesting.address, data.dates[i]);
				expect(delegatee).equal(a1);
			}
		});

		it("should stake tokens 1 time and delegate voting power (using vesting logic with bug in delegation)", async () => {
			let toStake = ONE_MILLON;
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				a2,
				4 * WEEK,
				39 * 4 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await token.approve(vesting.address, toStake);
			await vesting.stakeTokens(toStake, 0);

			// check delegatee
			let data = await staking.getStakes.call(vesting.address);
			for (let i = 0; i < data.dates.length; i++) {
				let delegatee = await staking.delegates(vesting.address, data.dates[i]);
				expect(delegatee).equal(a2);
			}

			// delegate
			let tx = await vesting.delegate(a1, { from: a2 });

			expectEvent(tx, "VotesDelegated", {
				caller: a2,
				delegatee: a1,
			});

			// check new delegatee
			data = await staking.getStakes.call(vesting.address);
			for (let i = 0; i < data.dates.length; i++) {
				let delegatee = await staking.delegates(vesting.address, data.dates[i]);
				expect(delegatee).equal(a1);
			}
		});

		it("fails if delegatee is zero address", async () => {
			await expectRevert(vesting.delegate(constants.ZERO_ADDRESS, { from: a2 }), "delegatee address invalid");
		});

		it("fails if not a token owner", async () => {
			await expectRevert(vesting.delegate(a1, { from: a1 }), "unauthorized");
		});
	});

	describe("stakeTokens; using Ganache", () => {
		// Check random scenarios
		let vesting;
		it("should stake 1,000,000 SOV with a duration of 104 weeks and a 26 week cliff", async () => {
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				26 * WEEK,
				104 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);
			await token.approve(vesting.address, ONE_MILLON);
			let tx = await vesting.stakeTokens(ONE_MILLON, 0);
			startDate = await vesting.startDate();
			let amount = new BN(ONE_MILLON).div(new BN(2));
			expectEvent(tx, "TokensStaked", {
				caller: root,
				amount: amount,
			});
			let lastStakingSchedule = await vesting.lastStakingSchedule();
			let remainingStakeAmount = await vesting.remainingStakeAmount();
			tx = await vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
			lastStakingSchedule = await vesting.lastStakingSchedule();
			remainingStakeAmount = await vesting.remainingStakeAmount();
		});

		it("should stake 1,000,000 SOV with a duration of 104 weeks and a 26 week cliff", async () => {
			// let block = await web3.eth.getBlock("latest");
			let block = await lastBlock(); // ethers.provider.getBlock("latest");
			let timestamp = parseInt(block.timestamp);
			let kickoffTS = await staking.kickoffTS();
			let start = timestamp + 26 * WEEK;
			let end = timestamp + 104 * WEEK;

			let numIntervals = Math.floor((end - start) / (26 * WEEK)) + 1;
			let stakedPerInterval = ONE_MILLON / numIntervals;

			// positive case
			for (let i = start; i <= end; i += 26 * WEEK) {
				let periodFromKickoff = Math.floor((i - kickoffTS.toNumber()) / (2 * WEEK));
				let startBuf = periodFromKickoff * 2 * WEEK + kickoffTS.toNumber();

				let userStakingCheckpoints = await staking.userStakingCheckpoints(vesting.address, startBuf, 0);
				assert.equal(userStakingCheckpoints.stake.toString(), stakedPerInterval);

				let numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(vesting.address, startBuf);
				assert.equal(numUserStakingCheckpoints.toString(), "1");
			}

			// negative cases

			// start-10 to avoid coming to active checkpoint
			let periodFromKickoff = Math.floor((start - 10 - kickoffTS.toNumber()) / (2 * WEEK));
			let startBuf = periodFromKickoff * 2 * WEEK + kickoffTS.toNumber();
			let userStakingCheckpoints = await staking.userStakingCheckpoints(vesting.address, startBuf, 0);

			assert.equal(userStakingCheckpoints.fromBlock.toNumber(), 0);
			assert.equal(userStakingCheckpoints.stake.toString(), 0);

			let numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(vesting.address, startBuf);
			assert.equal(numUserStakingCheckpoints.toString(), "0");

			periodFromKickoff = Math.floor((end + 1 - kickoffTS.toNumber()) / (2 * WEEK));
			startBuf = periodFromKickoff * 2 * WEEK + kickoffTS.toNumber();
			userStakingCheckpoints = await staking.userStakingCheckpoints(vesting.address, startBuf, 0);

			// assert.equal(userStakingCheckpoints.fromBlock.toNumber(), 0);
			// assert.equal(userStakingCheckpoints.stake.toString(), 0);

			numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(vesting.address, startBuf);
			// assert.equal(numUserStakingCheckpoints.toString(), "0");
		});

		it("should not allow to stake 2 times 1,000,000 SOV with a duration of 104 weeks and a 26 week cliff", async () => {
			let amount = ONE_MILLON;
			let cliff = 26 * WEEK;
			let duration = 104 * WEEK;
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				cliff,
				duration,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await token.approve(vesting.address, amount);
			let tx = await vesting.stakeTokens(amount, 0);
			startDate = await vesting.startDate();
			let amt = new BN(ONE_MILLON).div(new BN(2));
			expectEvent(tx, "TokensStaked", {
				caller: root,
				amount: amt,
			});
			let lastStakingSchedule = await vesting.lastStakingSchedule();
			let remainingStakeAmount = await vesting.remainingStakeAmount();
			tx = await vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
			lastStakingSchedule = await vesting.lastStakingSchedule();
			remainingStakeAmount = await vesting.remainingStakeAmount();

			let block1 = await web3.eth.getBlock("latest");
			let timestamp1 = block1.timestamp;

			let start = timestamp1 + cliff;
			let end = timestamp1 + duration;

			let numIntervals = Math.floor((end - start) / (4 * WEEK)) + 1;
			let stakedPerInterval = amount / numIntervals;

			await increaseTime(52 * WEEK);
			await token.approve(vesting.address, amount);
			await expectRevert(vesting.stakeTokens(amount, 0), "create new vesting address");
		});

		it("should stake 1000 tokens with a duration of 34 weeks and a 26 week cliff (dust on rounding)", async () => {
			let amount = 1000;
			let cliff = 26 * WEEK;
			let duration = 34 * WEEK;
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				cliff,
				duration,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await token.approve(vesting.address, amount);
			await vesting.stakeTokens(amount, 0);

			let block = await web3.eth.getBlock("latest");
			let timestamp = block.timestamp;

			let start = timestamp + cliff;
			let end = timestamp + duration;

			let numIntervals = Math.floor((end - start) / (26 * WEEK)) + 1;
			let stakedPerInterval = Math.floor(amount / numIntervals);

			let stakeForFirstInterval = amount - stakedPerInterval * (numIntervals - 1);

			// positive case
			for (let i = start; i <= end; i += 26 * WEEK) {
				let periodFromKickoff = Math.floor((i - kickoffTS.toNumber()) / (2 * WEEK));
				let startBuf = periodFromKickoff * 2 * WEEK + kickoffTS.toNumber();
				let userStakingCheckpoints = await staking.userStakingCheckpoints(vesting.address, startBuf, 0);

				assert.equal(userStakingCheckpoints.fromBlock.toNumber(), block.number);
				if (i === start) {
					assert.equal(userStakingCheckpoints.stake.toString(), stakeForFirstInterval);
				} else {
					assert.equal(userStakingCheckpoints.stake.toString(), stakedPerInterval);
				}

				let numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(vesting.address, startBuf);
				assert.equal(numUserStakingCheckpoints.toString(), "1");
			}
		});
	});

	describe("stakeTokensWithApproval", () => {
		let vesting;

		it("fails if invoked directly", async () => {
			let amount = 1000;
			let cliff = 4 * WEEK;
			let duration = 39 * 4 * WEEK;
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				cliff,
				duration,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);
			await expectRevert(vesting.stakeTokensWithApproval(root, amount, 0), "unauthorized");
		});

		it("fails if pass wrong method in data", async () => {
			let amount = 1000;
			let cliff = 4 * WEEK;
			let duration = 39 * 4 * WEEK;
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				cliff,
				duration,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			let contract = new web3.eth.Contract(vesting.abi, vesting.address);
			let sender = root;
			let data = contract.methods.stakeTokens(amount, 0).encodeABI();

			await expectRevert(token.approveAndCall(vesting.address, amount, data, { from: sender }), "method is not allowed");
		});

		it("should stake ONE_MILLION tokens with a duration of 156 weeks and a 4 week cliff", async () => {
			let amount = ONE_MILLON;
			let cliff = 4 * WEEK;
			let duration = 39 * 4 * WEEK;
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				cliff,
				duration,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			let contract = new web3.eth.Contract(vesting.abi, vesting.address);
			let sender = root;
			let data = contract.methods.stakeTokensWithApproval(sender, amount, 0).encodeABI();
			await token.approveAndCall(vesting.address, amount, data, { from: sender });
			let lastStakingSchedule = await vesting.lastStakingSchedule();
			let remainingStakeAmount = await vesting.remainingStakeAmount();

			data = contract.methods.stakeTokensWithApproval(sender, remainingStakeAmount, lastStakingSchedule).encodeABI();
			await token.approveAndCall(vesting.address, remainingStakeAmount, data, { from: sender });
			lastStakingSchedule = await vesting.lastStakingSchedule();
			remainingStakeAmount = await vesting.remainingStakeAmount();

			data = contract.methods.stakeTokensWithApproval(sender, remainingStakeAmount, lastStakingSchedule).encodeABI();
			await token.approveAndCall(vesting.address, remainingStakeAmount, data, { from: sender });
			lastStakingSchedule = await vesting.lastStakingSchedule();
			remainingStakeAmount = await vesting.remainingStakeAmount();
			assert.equal(remainingStakeAmount, 0);
		});

		it("should stake 1000 tokens with a duration of 34 weeks and a 26 week cliff (dust on rounding)", async () => {
			let amount = 1000;
			let cliff = 26 * WEEK;
			let duration = 34 * WEEK;
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				cliff,
				duration,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			let contract = new web3.eth.Contract(vesting.abi, vesting.address);
			let sender = root;
			let data = contract.methods.stakeTokensWithApproval(sender, amount, 0).encodeABI();
			await token.approveAndCall(vesting.address, amount, data, { from: sender });

			let block = await web3.eth.getBlock("latest");
			let timestamp = block.timestamp;

			let start = timestamp + cliff;
			let end = timestamp + duration;

			let numIntervals = Math.floor((end - start) / (26 * WEEK)) + 1;
			let stakedPerInterval = Math.floor(amount / numIntervals);

			let stakeForFirstInterval = amount - stakedPerInterval * (numIntervals - 1);

			// positive case
			for (let i = start; i <= end; i += 26 * WEEK) {
				let periodFromKickoff = Math.floor((i - kickoffTS.toNumber()) / (2 * WEEK));
				let startBuf = periodFromKickoff * 2 * WEEK + kickoffTS.toNumber();
				let userStakingCheckpoints = await staking.userStakingCheckpoints(vesting.address, startBuf, 0);

				assert.equal(userStakingCheckpoints.fromBlock.toNumber(), block.number);
				if (i === start) {
					assert.equal(userStakingCheckpoints.stake.toString(), stakeForFirstInterval);
				} else {
					assert.equal(userStakingCheckpoints.stake.toString(), stakedPerInterval);
				}

				let numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(vesting.address, startBuf);
				assert.equal(numUserStakingCheckpoints.toString(), "1");
			}
		});
	});

	describe("withdrawTokens", () => {
		let vesting;

		it("should not withdraw unlocked tokens (cliff = 3 weeks)", async () => {
			// Save current amount
			let previousAmount = await token.balanceOf(root);
			let toStake = ONE_ETHER;

			await increaseTime(3 * WEEK);

			// Stake
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				3 * WEEK,
				3 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await token.approve(vesting.address, toStake);
			await vesting.stakeTokens(toStake, 0);

			// time travel
			await increaseTime(3 * WEEK);

			// withdraw
			await expectRevert(vesting.withdrawTokens(root), "cannot withdraw in the first year");
		});

		it("should withdraw unlocked tokens", async () => {
			// Save current amount
			let previousAmount = await token.balanceOf(root);
			let toStake = ONE_MILLON;

			// Stake
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				26 * WEEK,
				104 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await token.approve(vesting.address, toStake);
			let tx = await vesting.stakeTokens(toStake, 0);
			let lastStakingSchedule = await vesting.lastStakingSchedule();
			let remainingStakeAmount = await vesting.remainingStakeAmount();

			tx = await vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
			lastStakingSchedule = await vesting.lastStakingSchedule();
			remainingStakeAmount = await vesting.remainingStakeAmount();

			let amountAfterStake = await token.balanceOf(root);

			// time travel
			await increaseTime(104 * WEEK);

			// withdraw
			tx = await vesting.withdrawTokens(root);

			// check event
			expectEvent(tx, "TokensWithdrawn", {
				caller: root,
				receiver: root,
			});

			// verify amount
			let amount = await token.balanceOf(root);

			assert.equal(previousAmount.sub(new BN(toStake)).toString(), amountAfterStake.toString());
			assert.equal(previousAmount.toString(), amount.toString());
		});

		it("should not withdraw unlocked tokens in the first year", async () => {
			// Save current amount
			let previousAmount = await token.balanceOf(root);
			let toStake = ONE_MILLON;

			// Stake
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				16 * WEEK,
				34 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await token.approve(vesting.address, toStake);
			await vesting.stakeTokens(toStake, 0);

			// time travel
			await increaseTime(34 * WEEK);

			// withdraw
			await expectRevert(vesting.withdrawTokens(root), "cannot withdraw in the first year");
		});

		it("should not allow for 2 stakes and withdrawal for the first year", async () => {
			// Save current amount
			let previousAmount = await token.balanceOf(root);
			let toStake = ONE_ETHER;

			// Stake
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				4 * WEEK,
				20 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await token.approve(vesting.address, toStake);
			await vesting.stakeTokens(toStake, 0);

			// time travel
			await increaseTime(20 * WEEK);
			await expectRevert(vesting.stakeTokens(toStake, 0), "create new vesting address");

			// withdraw
			await expectRevert(vesting.withdrawTokens(root), "cannot withdraw in the first year");
		});

		it("should not withdraw unlocked tokens for the first years <= 52 weeks", async () => {
			// Save current amount
			let toStake = ONE_MILLON;

			// Stake
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				4 * WEEK,
				20 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await token.approve(vesting.address, toStake);
			await vesting.stakeTokens(toStake, 0);

			// time travel
			await increaseTime(18 * WEEK);

			// withdraw
			await expectRevert(vesting.withdrawTokens(root), "cannot withdraw in the first year");
		});

		it("should do nothing if withdrawing a second time", async () => {
			await expectRevert(vesting.withdrawTokens(root), "cannot withdraw in the first year");
		});

		it("should do nothing if withdrawing before reaching the cliff", async () => {
			let toStake = ONE_MILLON;

			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				a1,
				26 * WEEK,
				104 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await token.approve(vesting.address, toStake);
			await vesting.stakeTokens(toStake, 0);

			// time travel
			await increaseTime(25 * WEEK);

			await expectRevert(vesting.withdrawTokens(root, { from: a1 }), "cannot withdraw in the first year");
		});

		it("should fail if the caller is neither owner nor token owner", async () => {
			await expectRevert(vesting.withdrawTokens(root, { from: a2 }), "unauthorized");
			await expectRevert(vesting.withdrawTokens(root, { from: a3 }), "unauthorized");

			await expectRevert(vesting.withdrawTokens(root, { from: root }), "cannot withdraw in the first year");
			await increaseTime(30 * WEEK);
			await expectRevert(vesting.withdrawTokens(root, { from: a2 }), "unauthorized");
		});

		it("Shouldn't be possible to use governanceWithdrawVesting by anyone but owner", async () => {
			let toStake = ONE_MILLON;

			// Stake
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				4 * WEEK,
				156 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await token.approve(vesting.address, toStake);
			await vesting.stakeTokens(toStake, 0);

			await expectRevert(staking.governanceWithdrawVesting(vesting.address, root, { from: a1 }), "unauthorized");
		});

		it("Shouldn't be possible to use governanceWithdraw by user", async () => {
			let toStake = ONE_MILLON;

			// Stake
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				4 * WEEK,
				156 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await token.approve(vesting.address, toStake);
			await vesting.stakeTokens(toStake, 0);

			await expectRevert(staking.governanceWithdraw(100, kickoffTS.toNumber() + 52 * WEEK, root), "unauthorized");
		});

		it("Shouldn't be possible to use governanceWithdrawTokens by user", async () => {
			let toStake = ONE_ETHER;

			// Stake
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				4 * WEEK,
				156 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await token.approve(vesting.address, toStake);
			await vesting.stakeTokens(toStake, 0);

			await expectRevert(vesting.governanceWithdrawTokens(root), "operation not supported");
		});

		it("governanceWithdrawTokens", async () => {
			let previousAmount = await token.balanceOf(root);
			let toStake = ONE_ETHER;

			// Stake
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				4 * WEEK,
				156 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await token.approve(vesting.address, toStake);
			await vesting.stakeTokens(toStake, 0);

			await staking.addAdmin(a1);
			// governance withdraw must fail for four year vesting
			await expectRevert(staking.governanceWithdrawVesting(vesting.address, root, { from: a1 }), "operation not supported");
		});
	});

	describe("collectDividends", async () => {
		it("should fail if the caller is neither owner nor token owner", async () => {
			let vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				a1,
				4 * WEEK,
				156 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);
			await expectRevert(vesting.collectDividends(root, 10, a1, { from: a2 }), "unauthorized");
			await expectRevert(vesting.collectDividends(root, 10, a1, { from: a3 }), "unauthorized");
		});

		it("should collect dividends", async () => {
			let vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				a1,
				4 * WEEK,
				156 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			let maxCheckpoints = new BN(10);
			let tx = await vesting.collectDividends(a1, maxCheckpoints, a2);

			let testData = await feeSharingProxy.testData.call();
			expect(testData.loanPoolToken).to.be.equal(a1);
			expect(testData.maxCheckpoints).to.be.bignumber.equal(maxCheckpoints);
			expect(testData.receiver).to.be.equal(a2);

			expectEvent(tx, "DividendsCollected", {
				caller: root,
				loanPoolToken: a1,
				receiver: a2,
				maxCheckpoints: maxCheckpoints,
			});
		});
	});

	describe("migrateToNewStakingContract", async () => {
		let vesting;
		it("should set the new staking contract", async () => {
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				a1,
				26 * WEEK,
				104 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);
			// 1. set new staking contract address on staking contract

			let newStaking = await StakingProxy.new(token.address);
			await newStaking.setImplementation(stakingLogic.address);
			newStaking = await StakingLogic.at(newStaking.address);

			await staking.setNewStakingContract(newStaking.address);

			// 2. call migrateToNewStakingContract
			let tx = await vesting.migrateToNewStakingContract();
			expectEvent(tx, "MigratedToNewStakingContract", {
				caller: root,
				newStakingContract: newStaking.address,
			});
			let _staking = await vesting.staking();
			assert.equal(_staking, newStaking.address);
		});

		it("should fail if there is no new staking contract set", async () => {
			let newStaking = await StakingProxy.new(token.address);
			await newStaking.setImplementation(stakingLogic.address);
			newStaking = await StakingLogic.at(newStaking.address);

			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				newStaking.address,
				a1,
				26 * WEEK,
				104 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);
			await expectRevert(vesting.migrateToNewStakingContract(), "there is no new staking contract set");
		});

		it("should fail if the caller is neither owner nor token owner", async () => {
			let newStaking = await StakingProxy.new(token.address);
			await newStaking.setImplementation(stakingLogic.address);
			newStaking = await StakingLogic.at(newStaking.address);

			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				newStaking.address,
				a1,
				26 * WEEK,
				104 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await newStaking.setNewStakingContract(newStaking.address);

			await expectRevert(vesting.migrateToNewStakingContract({ from: a2 }), "unauthorized");
			await expectRevert(vesting.migrateToNewStakingContract({ from: a3 }), "unauthorized");

			await vesting.migrateToNewStakingContract();
			await vesting.migrateToNewStakingContract({ from: a1 });
		});
	});

	describe("fouryearvesting", async () => {
		let vesting, dates0, dates3, dates5;
		it("staking schedule must run for max duration", async () => {
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				4 * WEEK,
				39 * 4 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);
			await token.approve(vesting.address, ONE_MILLON);
			let tx = await vesting.stakeTokens(ONE_MILLON, 0);
			let lastStakingSchedule = await vesting.lastStakingSchedule();
			let remainingStakeAmount = await vesting.remainingStakeAmount();

			tx = await vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
			lastStakingSchedule = await vesting.lastStakingSchedule();
			remainingStakeAmount = await vesting.remainingStakeAmount();

			tx = await vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
			lastStakingSchedule = await vesting.lastStakingSchedule();
			remainingStakeAmount = await vesting.remainingStakeAmount();
			let data = await staking.getStakes.call(vesting.address);
			assert.equal(data.dates.length, 39);
			assert.equal(data.stakes.length, 39);
			expect(data.stakes[0]).to.be.bignumber.equal(data.stakes[15]);
			dates0 = data.dates[0];
			dates5 = data.dates[5];
		});

		it("should extend duration of first 5 staking periods", async () => {
			await increaseTime(20 * WEEK);
			tx = await vesting.extendStaking();
			data = await staking.getStakes.call(vesting.address);
			expect(data.stakes[0]).to.be.bignumber.equal(data.stakes[15]);
			expect(dates0).to.be.bignumber.not.equal(data.dates[0]);
			expect(dates5).to.be.bignumber.equal(data.dates[0]);
			dates0 = data.dates[0];
			dates5 = data.dates[5];
		});

		it("should extend duration of next 5 staking periods", async () => {
			await increaseTime(20 * WEEK);
			tx = await vesting.extendStaking();
			data = await staking.getStakes.call(vesting.address);
			expect(data.stakes[0]).to.be.bignumber.equal(data.stakes[15]);
			expect(dates0).to.be.bignumber.not.equal(data.dates[0]);
			expect(dates5).to.be.bignumber.equal(data.dates[0]);
			dates0 = data.dates[0];
			dates3 = data.dates[3];
		});

		it("should extend duration of next 3 staking periods only", async () => {
			await increaseTime(20 * WEEK);
			tx = await vesting.extendStaking();
			data = await staking.getStakes.call(vesting.address);
			expect(data.stakes[0]).to.be.bignumber.equal(data.stakes[15]);
			expect(dates0).to.be.bignumber.not.equal(data.dates[0]);
			expect(dates3).to.be.bignumber.equal(data.dates[0]);
		});

		it("should withdraw unlocked tokens for four year vesting after first year", async () => {
			// time travel
			await increaseTime(104 * WEEK);

			// withdraw
			tx = await vesting.withdrawTokens(root);

			// check event
			expectEvent(tx, "TokensWithdrawn", {
				caller: root,
				receiver: root,
			});
		});
	});

	describe("setMaxDuration", async () => {
		it("should set/alter maxDuration", async () => {
			let toStake = ONE_MILLON;
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				a2,
				16 * WEEK,
				26 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);
			let maxDurationOld = await vesting.maxDuration();
			await vesting.setMaxDuration(60 * WEEK);
			let maxDurationNew = await vesting.maxDuration();
			expect(maxDurationOld).to.be.bignumber.not.equal(maxDurationNew);
		});
	});
});
