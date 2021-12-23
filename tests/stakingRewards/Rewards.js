const { expect } = require("chai");
const { expectRevert, BN, constants, time } = require("@openzeppelin/test-helpers");

const { increaseTime, blockNumber } = require("../Utils/Ethereum");

const SOV_ABI = artifacts.require("SOV");
const StakingLogic = artifacts.require("StakingMock");
const StakingProxyTN = artifacts.require("StakingProxyTN");
const StakingRewardsTN = artifacts.require("StakingRewardsMockUp");
const StakingRewardsProxyTN = artifacts.require("StakingRewardsProxyTN");
//Upgradable Vesting Registry
const VestingRegistryLogic = artifacts.require("VestingRegistryLogic");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");
const FeeSharingProxy = artifacts.require("FeeSharingProxy");
const Protocol = artifacts.require("sovrynProtocol");
const BlockMockUp = artifacts.require("BlockMockUp");

const wei = web3.utils.toWei;

const TOTAL_SUPPLY = "10000000000000000000000000";
const TWO_WEEKS = 1209600;
const DELAY = TWO_WEEKS;

contract("StakingRewardsTN - First Period", (accounts) => {
	let root, a1, a2, a3;
	let SOV, staking;
	let kickoffTS, inOneYear, inTwoYears, inThreeYears;
	let totalRewards;

	before(async () => {
		[root, a1, a2, a3, ...accounts] = accounts;
		SOV = await SOV_ABI.new(TOTAL_SUPPLY);

		//Protocol
		protocol = await Protocol.new();

		//BlockMockUp
		blockMockUp = await BlockMockUp.new();

		//Deployed StakingTN Functionality
		let stakingLogic = await StakingLogic.new(SOV.address);
		staking = await StakingProxyTN.new(SOV.address);
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

		//Transferred SOVs to a1
		await SOV.transfer(a1, wei("10000", "ether"));
		await SOV.approve(staking.address, wei("10000", "ether"), { from: a1 });

		//Transferred SOVs to a2
		await SOV.transfer(a2, wei("50000", "ether"));
		await SOV.approve(staking.address, wei("50000", "ether"), { from: a2 });

		//Transferred SOVs to a3
		await SOV.transfer(a3, wei("10000", "ether"));
		await SOV.approve(staking.address, wei("10000", "ether"), { from: a3 });

		let latest = await blockNumber();
		let blockNum = new BN(latest).add(new BN(291242 / 30));
		await blockMockUp.setBlockNum(blockNum);
		await increaseTime(291242);
		await staking.stake(wei("10000", "ether"), inThreeYears, a3, a3, { from: a3 });

		//StakingTN Reward Program is deployed
		let stakingRewardsLogic = await StakingRewardsTN.new();
		stakingRewards = await StakingRewardsProxyTN.new();
		await stakingRewards.setImplementation(stakingRewardsLogic.address);
		stakingRewards = await StakingRewardsTN.at(stakingRewards.address);
		await stakingRewards.setBlockMockUpAddr(blockMockUp.address);
		await staking.setBlockMockUpAddr(blockMockUp.address);
	});

	describe("Flow - StakingRewardsTN", () => {
		it("should account for stakes made till start date of the program for a1", async () => {
			await increaseTimeAndBlocks(1209614);

			let numOfIntervals = 2;
			let totalAmount = 0;
			let fullTermAvg = avgWeight(24, 26, 9, 78);
			let expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
			totalAmount = totalAmount + expectedAmount;
			console.log(new BN(Math.floor(expectedAmount * 10 ** 10)).toString());

			fullTermAvg = avgWeight(76, 78, 9, 78);
			expectedAmount = numOfIntervals * ((2000 * fullTermAvg) / 26);
			totalAmount = totalAmount + expectedAmount;
			console.log(new BN(Math.floor(expectedAmount * 10 ** 10)).toString());
			console.log(new BN(Math.floor(totalAmount * 10 ** 10)).toString());
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
