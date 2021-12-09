/** Speed optimized on branch hardhatTestRefactor, 2021-09-30
 * No bottlenecks found.
 *
 * Total time elapsed: 5.6s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes:
 *   Updated to spare the protocol deployment. Tests don't need it.
 */

const { expect } = require("chai");
const { expectRevert, BN, constants } = require("@openzeppelin/test-helpers");
const { increaseTime, blockNumber } = require("../Utils/Ethereum");

const SOV_ABI = artifacts.require("SOV");
const StakingLogic = artifacts.require("StakingMock");
const StakingProxy = artifacts.require("StakingProxy");
const StakingRewards = artifacts.require("StakingRewardsMockUp");
const StakingRewardsProxy = artifacts.require("StakingRewardsProxy");

// Upgradable Vesting Registry
const VestingRegistryLogic = artifacts.require("VestingRegistryLogic");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");
const BlockMockUp = artifacts.require("BlockMockUp");

const wei = web3.utils.toWei;

const TOTAL_SUPPLY = "10000000000000000000000000";
const TWO_WEEKS = 1209600;
const DELAY = TWO_WEEKS;

contract("StakingRewards - First Period", (accounts) => {
	let root, a1, a2, a3;
	let SOV, staking;
	let kickoffTS, inOneYear, inTwoYears, inThreeYears;

	before(async () => {
		[root, a1, a2, a3, ...accounts] = accounts;
		SOV = await SOV_ABI.new(TOTAL_SUPPLY);

		// BlockMockUp
		blockMockUp = await BlockMockUp.new();

		// Deployed Staking Functionality
		let stakingLogic = await StakingLogic.new(SOV.address);
		staking = await StakingProxy.new(SOV.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		//Upgradable Vesting Registry
		vestingRegistryLogic = await VestingRegistryLogic.new();
		vesting = await VestingRegistryProxy.new();
		await vesting.setImplementation(vestingRegistryLogic.address);
		vesting = await VestingRegistryLogic.at(vesting.address);
		await staking.setVestingRegistry(vesting.address);

		kickoffTS = await staking.kickoffTS.call();
		inOneWeek = kickoffTS.add(new BN(DELAY));
		inOneYear = kickoffTS.add(new BN(DELAY * 26));
		inTwoYears = kickoffTS.add(new BN(DELAY * 26 * 2));
		inThreeYears = kickoffTS.add(new BN(DELAY * 26 * 3));

		// Transferred SOVs to a1
		await SOV.transfer(a1, wei("10000", "ether"));
		await SOV.approve(staking.address, wei("10000", "ether"), { from: a1 });

		// Transferred SOVs to a2
		await SOV.transfer(a2, wei("50000", "ether"));
		await SOV.approve(staking.address, wei("50000", "ether"), { from: a2 });

		// Transferred SOVs to a3
		await SOV.transfer(a3, wei("10000", "ether"));
		await SOV.approve(staking.address, wei("10000", "ether"), { from: a3 });

		let latest = await blockNumber();
		let blockNum = new BN(latest).add(new BN(291242 / 30));
		await blockMockUp.setBlockNum(blockNum);
		await increaseTime(291242);
		await staking.stake(wei("10000", "ether"), inThreeYears, a3, a3, { from: a3 });

		// Staking Reward Program is deployed
		let stakingRewardsLogic = await StakingRewards.new();
		stakingRewards = await StakingRewardsProxy.new();
		await stakingRewards.setImplementation(stakingRewardsLogic.address);
		stakingRewards = await StakingRewards.at(stakingRewards.address);
		await stakingRewards.setBlockMockUpAddr(blockMockUp.address);
		await staking.setBlockMockUpAddr(blockMockUp.address);
	});

	describe("Flow - StakingRewards", () => {
		it("should revert if SOV Address is invalid", async () => {
			await expectRevert(stakingRewards.initialize(constants.ZERO_ADDRESS, staking.address), "Invalid SOV Address.");
			// Staking Rewards Contract is loaded
			await SOV.transfer(stakingRewards.address, wei("1000000", "ether"));
			// Initialize
			await stakingRewards.initialize(SOV.address, staking.address); // Test - 24/08/2021
			await increaseTimeAndBlocks(100800);
			await staking.stake(wei("1000", "ether"), inOneYear, a1, a1, { from: a1 }); // Staking after program is initialised
			await increaseTimeAndBlocks(100800);
			await staking.stake(wei("50000", "ether"), inTwoYears, a2, a2, { from: a2 });
		});

		it("should account for stakes made till start date of the program for a1", async () => {
			await increaseTimeAndBlocks(1209614);

			let fields = await stakingRewards.getStakerCurrentReward(true, { from: a1 });
			let numOfIntervals = 1;
			let fullTermAvg = avgWeight(26, 27, 9, 78);
			let expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
			expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
				new BN(fields.amount).div(new BN(10).pow(new BN(8)))
			);
		});

		it("should account for stakes made till start date of the program for a2", async () => {
			let numOfIntervals = 1;
			fields = await stakingRewards.getStakerCurrentReward(true, { from: a2 });
			fullTermAvg = avgWeight(52, 53, 9, 78);
			expectedAmount = numOfIntervals * ((50000 * fullTermAvg) / 26);
			expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
				new BN(fields.amount).div(new BN(10).pow(new BN(8)))
			);

			fields = await stakingRewards.getStakerCurrentReward(true, { from: a3 });
			fullTermAvg = avgWeight(78, 79, 9, 78);
			expectedAmount = numOfIntervals * ((10000 * fullTermAvg) / 26);
			expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
				new BN(fields.amount).div(new BN(10).pow(new BN(8)))
			);
		});

		it("should account for stakes made till start date of the program for a3", async () => {
			let numOfIntervals = 1;
			fields = await stakingRewards.getStakerCurrentReward(true, { from: a3 });
			fullTermAvg = avgWeight(78, 79, 9, 78);
			expectedAmount = numOfIntervals * ((10000 * fullTermAvg) / 26);
			expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
				new BN(fields.amount).div(new BN(10).pow(new BN(8)))
			);
		});

		it("should compute and send Rewards to the stakers a1, a2 and a3 correctly after 4 weeks", async () => {
			await increaseTimeAndBlocks(1209614);
			let fields = await stakingRewards.getStakerCurrentReward(true, { from: a1 });
			let numOfIntervals = 2;
			let fullTermAvg = avgWeight(25, 27, 9, 78);
			expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
			expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
				new BN(fields.amount).div(new BN(10).pow(new BN(8)))
			);

			fields = await stakingRewards.getStakerCurrentReward(true, { from: a2 });
			fullTermAvg = avgWeight(51, 53, 9, 78);
			expectedAmount = numOfIntervals * ((50000 * fullTermAvg) / 26);
			expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
				new BN(fields.amount).div(new BN(10).pow(new BN(8)))
			);

			fields = await stakingRewards.getStakerCurrentReward(true, { from: a3 });
			fullTermAvg = avgWeight(77, 79, 9, 78);
			expectedAmount = numOfIntervals * ((10000 * fullTermAvg) / 26);
			expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
				new BN(fields.amount).div(new BN(10).pow(new BN(8)))
			);
		});
	});

	function avgWeight(from, to, maxWeight, maxDuration) {
		let weight = 0;
		for (let i = from; i < to; i++) {
			weight += Math.floor(((maxWeight * (maxDuration ** 2 - (maxDuration - i) ** 2)) / maxDuration ** 2 + 1) * 10, 2);
		}
		weight /= to - from;
		return (weight / 100) * 0.2975;
	}

	async function increaseTimeAndBlocks(seconds) {
		let latest = await blockMockUp.getBlockNum();
		let blockNum = new BN(latest).add(new BN(seconds / 30));
		await blockMockUp.setBlockNum(blockNum);
		await increaseTime(seconds);
	}
});
