const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN, balance, time } = require("@openzeppelin/test-helpers");

const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const SOV = artifacts.require("SOV");
const TestToken = artifacts.require("TestToken");
const FeeSharingProxy = artifacts.require("FeeSharingProxyMockup");
const VestingFactory = artifacts.require("VestingFactory");
const VestingRegistry = artifacts.require("VestingRegistry");

const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
const WEEK = new BN(7 * 24 * 60 * 60);

const TOTAL_SUPPLY = "100000000000000000000000000";
const ONE_MILLON = "1000000000000000000000000";
const ZERO_ADDRESS = constants.ZERO_ADDRESS;

contract("VestingRegistry", (accounts) => {
	let root, account1, account2, account3;
	let token, cSOV1, cSOV2;
	let staking, stakingLogic, feeSharingProxy;
	let vestingFactory, vestingRegistry;

	before(async () => {
		[root, account1, account2, account3, ...accounts] = accounts;
	});

	beforeEach(async () => {
		token = await SOV.new(TOTAL_SUPPLY);
		cSOV1 = await TestToken.new("cSOV1", "cSOV1", 18, TOTAL_SUPPLY);
		cSOV2 = await TestToken.new("cSOV2", "cSOV2", 18, TOTAL_SUPPLY);

		stakingLogic = await StakingLogic.new(token.address);
		staking = await StakingProxy.new(token.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		feeSharingProxy = await FeeSharingProxy.new(ZERO_ADDRESS, staking.address);

		vestingFactory = await VestingFactory.new();
		vestingRegistry = await VestingRegistry.new(vestingFactory.address, token.address, [cSOV1.address, cSOV2.address], staking.address, feeSharingProxy.address, account1);
	});

	describe("constructor", () => {
		it("sets the expected values", async () => {
			//Check data
			let _sov = await vestingRegistry.SOV();
			let _CSOV1 = await vestingRegistry.CSOVtokens(0);
			let _CSOV2 = await vestingRegistry.CSOVtokens(1);
			let _stacking = await vestingRegistry.staking();
			let _feeSharingProxy = await vestingRegistry.feeSharingProxy();
			let _governanceTimelock = await vestingRegistry.governanceTimelock();

			assert.equal(_sov, token.address);
			assert.equal(_CSOV1, cSOV1.address);
			assert.equal(_CSOV2, cSOV2.address);
			assert.equal(_stacking, staking.address);
			assert.equal(_feeSharingProxy, feeSharingProxy.address);
			assert.equal(_governanceTimelock, account1);
		});

		it("fails if the 0 address is passed as vestingFactory address", async () => {
			await expectRevert(
				VestingRegistry.new(ZERO_ADDRESS, token.address, [cSOV1.address, cSOV2.address], staking.address, feeSharingProxy.address, account1),
				"vestingFactory address invalid"
			);
		});

		it("fails if the 0 address is passed as SOV address", async () => {
			await expectRevert(
				VestingRegistry.new(vestingFactory.address, ZERO_ADDRESS, [cSOV1.address, cSOV2.address], staking.address, feeSharingProxy.address, account1),
				"SOV address invalid"
			);
		});

		it("fails if the 0 address is passed as cSOV address", async () => {
			await expectRevert(
				VestingRegistry.new(vestingFactory.address, token.address, [cSOV1.address, cSOV2.address, ZERO_ADDRESS], staking.address, feeSharingProxy.address, account1),
				"CSOV address invalid"
			);
		});

		it("fails if the 0 address is passed as staking address", async () => {
			await expectRevert(
				VestingRegistry.new(vestingFactory.address, token.address, [cSOV1.address, cSOV2.address], ZERO_ADDRESS, feeSharingProxy.address, account1),
				"staking address invalid"
			);
		});

		it("fails if the 0 address is passed as feeSharingProxy address", async () => {
			await expectRevert(
				VestingRegistry.new(vestingFactory.address, token.address, [cSOV1.address, cSOV2.address], staking.address, ZERO_ADDRESS, account1),
				"feeSharingProxy address invalid"
			);
		});

		it("fails if the 0 address is passed as governanceTimelock address", async () => {
			await expectRevert(
				VestingRegistry.new(vestingFactory.address, token.address, [cSOV1.address, cSOV2.address], staking.address, feeSharingProxy.address, ZERO_ADDRESS),
				"governanceTimelock address invalid"
			);
		});
	});
/*
	describe("stakeTokens", () => {
		let vesting;
		it("should stake 1,000,000 SOV with a duration of 104 weeks and a 26 week cliff", async () => {
			vesting = await Vesting.new(token.address, staking.address, root, 26 * WEEK, 104 * WEEK, feeSharingProxy.address);
			await token.approve(vesting.address, ONE_MILLON);
			let tx = await vesting.stakeTokens(ONE_MILLON);

			expectEvent(tx, "TokensStaked", {
				caller: root,
				amount: ONE_MILLON,
			});
		});

		it("should stake 1,000,000 SOV with a duration of 104 weeks and a 26 week cliff", async () => {
			let block = await web3.eth.getBlock("latest");
			let timestamp = block.timestamp;

			let kickoffTS = await staking.kickoffTS();

			let start = timestamp + 26 * WEEK;
			let end = timestamp + 104 * WEEK;

			let numIntervals = Math.floor((end - start) / (4 * WEEK)) + 1;
			let stakedPerInterval = ONE_MILLON / numIntervals;

			//positive case
			for (let i = start; i <= end; i += 4 * WEEK) {
				let periodFromKickoff = Math.floor((i - kickoffTS.toNumber()) / (2 * WEEK));
				let startBuf = periodFromKickoff * 2 * WEEK + kickoffTS.toNumber();
				let userStakingCheckpoints = await staking.userStakingCheckpoints(vesting.address, startBuf, 0);

				assert.equal(userStakingCheckpoints.fromBlock.toNumber(), block.number);
				assert.equal(userStakingCheckpoints.stake.toString(), stakedPerInterval);

				let numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(vesting.address, startBuf);
				assert.equal(numUserStakingCheckpoints.toString(), "1");
			}

			//negative cases

			//start-10 to avoid coming to active checkpoint
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

			assert.equal(userStakingCheckpoints.fromBlock.toNumber(), 0);
			assert.equal(userStakingCheckpoints.stake.toString(), 0);

			numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(vesting.address, startBuf);
			assert.equal(numUserStakingCheckpoints.toString(), "0");
		});

		it("should stake 2 times 1,000,000 SOV with a duration of 104 weeks and a 26 week cliff", async () => {
			let amount = 1000;
			let cliff = 28 * WEEK;
			let duration = 104 * WEEK;
			vesting = await Vesting.new(token.address, staking.address, root, cliff, duration, feeSharingProxy.address);

			await token.approve(vesting.address, amount);
			await vesting.stakeTokens(amount);

			let block1 = await web3.eth.getBlock("latest");
			let timestamp1 = block1.timestamp;

			let start = timestamp1 + cliff;
			let end = timestamp1 + duration;

			let numIntervals = Math.floor((end - start) / (4 * WEEK)) + 1;
			let stakedPerInterval = amount / numIntervals;

			await time.increase(52 * WEEK);
			await token.approve(vesting.address, amount);
			await vesting.stakeTokens(amount);

			let block2 = await web3.eth.getBlock("latest");
			let timestamp2 = block2.timestamp;

			let start2 = await staking.timestampToLockDate(timestamp2 + cliff);
			let end2 = timestamp2 + duration;

			//positive case
			for (let i = start; i <= end2; i += 4 * WEEK) {
				let lockedTS = await staking.timestampToLockDate(i);
				let numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(vesting.address, lockedTS);
				let userStakingCheckpoints = await staking.userStakingCheckpoints(vesting.address, lockedTS, numUserStakingCheckpoints - 1);
				if (i < start2 || i > end) {
					assert.equal(numUserStakingCheckpoints.toString(), "1");
					assert.equal(userStakingCheckpoints.stake.toString(), stakedPerInterval);
				} else {
					assert.equal(numUserStakingCheckpoints.toString(), "2");
					assert.equal(userStakingCheckpoints.stake.toString(), stakedPerInterval * 2);
				}
			}
		});

		it("should stake 1000 tokens with a duration of 34 weeks and a 26 week cliff (dust on rounding)", async () => {
			let amount = 1000;
			let cliff = 26 * WEEK;
			let duration = 34 * WEEK;
			vesting = await Vesting.new(token.address, staking.address, root, cliff, duration, feeSharingProxy.address);

			await token.approve(vesting.address, amount);
			await vesting.stakeTokens(amount);

			let block = await web3.eth.getBlock("latest");
			let timestamp = block.timestamp;

			let start = timestamp + cliff;
			let end = timestamp + duration;

			let numIntervals = Math.floor((end - start) / (4 * WEEK)) + 1;
			let stakedPerInterval = Math.floor(amount / numIntervals);

			let stakeForFirstInterval = amount - stakedPerInterval * (numIntervals - 1);

			//positive case
			for (let i = start; i <= end; i += 4 * WEEK) {
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
*/
});
