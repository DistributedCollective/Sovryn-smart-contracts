const { expect } = require("chai");
const { expectRevert, BN, constants, time } = require("@openzeppelin/test-helpers");

const { increaseTime, blockNumber } = require("../Utils/Ethereum");

const SOV_ABI = artifacts.require("SOV");
const StakingLogic = artifacts.require("StakingMockOld");
const StakingLogicNew = artifacts.require("StakingMock");
const StakingProxy = artifacts.require("StakingProxy");
const StakingRewards = artifacts.require("StakingRewardsMockUpOld");
const StakingRewardsNew = artifacts.require("StakingRewardsMockUp");
const StakingRewardsProxy = artifacts.require("StakingRewardsProxy");
const FeeSharingLogic = artifacts.require("FeeSharingLogic");
const FeeSharingProxy = artifacts.require("FeeSharingProxy");
const Protocol = artifacts.require("sovrynProtocol");
const BlockMockUp = artifacts.require("BlockMockUp");
//Upgradable Vesting Registry
const VestingRegistryLogic = artifacts.require("VestingRegistryLogic");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");

const wei = web3.utils.toWei;

const TOTAL_SUPPLY = "10000000000000000000000000";
const TWO_WEEKS = 1209600;
const DELAY = TWO_WEEKS;

contract("StakingRewards - Upgrade", (accounts) => {
	let root, a1, a2, a3;
	let SOV, staking;
	let kickoffTS, inOneYear, inTwoYears, inThreeYears;

	before(async () => {
		[root, a1, a2, a3, ...accounts] = accounts;
		SOV = await SOV_ABI.new(TOTAL_SUPPLY);

		//Protocol
		protocol = await Protocol.new();

		//BlockMockUp
		blockMockUp = await BlockMockUp.new();

		//Deployed Staking Functionality
		let stakingLogic = await StakingLogic.new(SOV.address);
		stakingObj = await StakingProxy.new(SOV.address);
		await stakingObj.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(stakingObj.address);

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

		//Staking Reward Program is deployed
		let stakingRewardsLogic = await StakingRewards.new();
		stakingRewardsObj = await StakingRewardsProxy.new();
		await stakingRewardsObj.setImplementation(stakingRewardsLogic.address);
		stakingRewards = await StakingRewards.at(stakingRewardsObj.address);
		await stakingRewards.setBlockMockUpAddr(blockMockUp.address);
		await staking.setBlockMockUpAddr(blockMockUp.address);
	});

	describe("Flow - StakingRewards", () => {
		it("should revert if SOV Address is invalid", async () => {
			await expectRevert(stakingRewards.initialize(constants.ZERO_ADDRESS, staking.address), "Invalid SOV Address.");
			//Staking Rewards Contract is loaded
			await SOV.transfer(stakingRewards.address, wei("1000000", "ether"));
			//Initialize
			await stakingRewards.initialize(SOV.address, staking.address); //Test - 24/08/2021
			await increaseTimeAndBlocks(100800);
			await staking.stake(wei("1000", "ether"), inOneYear, a1, a1, { from: a1 }); //Staking after program is initialised
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

		it("should upgrade the staking contracts", async () => {
			const newStakingLogic = await StakingLogicNew.new();
			await stakingObj.setImplementation(newStakingLogic.address);
			staking = await StakingLogicNew.at(stakingObj.address);
			const newImplementation = await stakingObj.getImplementation();

			expect(newImplementation).to.be.equal(newStakingLogic.address);
		});

		it("should upgrade the staking rewards contracts", async () => {
			const newStakingRewardsLogic = await StakingRewardsNew.new();
			await stakingRewardsObj.setImplementation(newStakingRewardsLogic.address);
			stakingRewards = await StakingRewardsNew.at(stakingRewardsObj.address);
			const newImplementation = await stakingRewardsObj.getImplementation();

			expect(newImplementation).to.be.equal(newStakingRewardsLogic.address);
			//Initialize
			await stakingRewards.setBlockMockUpAddr(blockMockUp.address);
			await staking.setBlockMockUpAddr(blockMockUp.address);
			await staking.setStakingRewards(stakingRewards.address);
			await stakingRewards.setStakingAddress(staking.address);

			//FeeSharingProxy
			let feeSharingLogic = await FeeSharingLogic.new();
			feeSharingProxyObj = await FeeSharingProxy.new(protocol.address, staking.address);
			await feeSharingProxyObj.setImplementation(feeSharingLogic.address);
			feeSharingProxy = await FeeSharingLogic.at(feeSharingProxyObj.address);
			await staking.setFeeSharing(feeSharingProxy.address);
		});

		it("should compute and send Rewards to the stakers a1, a2 and a3 correctly after 6 weeks", async () => {
			await increaseTimeAndBlocks(1209614);
			let fields = await stakingRewards.getStakerCurrentReward(true, a1, { from: a1 });
			let numOfIntervals = 3;
			let fullTermAvg = avgWeight(24, 27, 9, 78);
			expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
			expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
				new BN(fields.amount).div(new BN(10).pow(new BN(8)))
			);

			fields = await stakingRewards.getStakerCurrentReward(true, a2, { from: a2 });
			fullTermAvg = avgWeight(50, 53, 9, 78);
			expectedAmount = numOfIntervals * ((50000 * fullTermAvg) / 26);
			expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
				new BN(fields.amount).div(new BN(10).pow(new BN(8)))
			);

			fields = await stakingRewards.getStakerCurrentReward(true, a3, { from: a3 });
			fullTermAvg = avgWeight(76, 79, 9, 78);
			expectedAmount = numOfIntervals * ((10000 * fullTermAvg) / 26);
			expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
				new BN(fields.amount).div(new BN(10).pow(new BN(8)))
			);
		});

		it("should compute and send Rewards to the stakers a1, a2 and a3 correctly after 8 weeks", async () => {
			await increaseTimeAndBlocks(1209614);
			await staking.stake(wei("1000", "ether"), inOneYear, a1, a1, { from: a1 }); //Add Stakes
			let fields = await stakingRewards.getAccumulatedReward({ from: a1 });
			let numOfIntervals = 4;
			let fullTermAvg = avgWeight(23, 27, 9, 78);
			expectedAmount = numOfIntervals * ((2000 * fullTermAvg) / 26);
			expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(new BN(fields).div(new BN(10).pow(new BN(8))));

			await staking.extendStakingDuration(inTwoYears, inThreeYears, { from: a2 }); //Extend Duration
			fields = await stakingRewards.getAccumulatedReward({ from: a2 });
			fullTermAvg = avgWeight(75, 79, 9, 78);
			expectedAmount = numOfIntervals * ((50000 * fullTermAvg) / 26);
			expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(new BN(fields).div(new BN(10).pow(new BN(8))));

			await staking.withdraw(wei("1000", "ether"), inThreeYears, a3, { from: a3 }); //Withdraw
			fields = await stakingRewards.getAccumulatedReward({ from: a3 });
			fullTermAvg = avgWeight(75, 79, 9, 78);
			expectedAmount = numOfIntervals * ((9000 * fullTermAvg) / 26);
			expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(new BN(fields).div(new BN(10).pow(new BN(8))));
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
