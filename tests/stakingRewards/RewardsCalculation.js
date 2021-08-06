const { expect } = require("chai");
const { expectRevert, BN, constants, time } = require("@openzeppelin/test-helpers");

const { increaseTime, mineBlock, blockNumber, increaseTimeOnly } = require("../Utils/Ethereum");

const SOV_ABI = artifacts.require("SOV");
const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const StakingRewards = artifacts.require("StakingRewards");
const StakingRewardsProxy = artifacts.require("StakingRewardsProxy");
const FeeSharingProxy = artifacts.require("FeeSharingProxy");
const Protocol = artifacts.require("sovrynProtocol");

const wei = web3.utils.toWei;

const TOTAL_SUPPLY = "10000000000000000000000000";
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
const DAY = 86400;
const TWO_WEEKS = 1209600;
const DELAY = TWO_WEEKS;

contract("StakingRewards", (accounts) => {
	let root, a4, a5, a6;
	let SOV, staking;
	let kickoffTS, inOneYear, inTwoYears, inThreeYears;

	before(async () => {
		[root, a4, a5, a6, ...accounts] = accounts;
		SOV = await SOV_ABI.new(TOTAL_SUPPLY);

		//Protocol
		protocol = await Protocol.new();

		//Deployed Staking Functionality
		let stakingLogic = await StakingLogic.new(SOV.address);
		staking = await StakingProxy.new(SOV.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address); //Test - 01/07/2021

		kickoffTS = await staking.kickoffTS.call();
		inOneWeek = kickoffTS.add(new BN(DELAY));
		inOneYear = kickoffTS.add(new BN(DELAY * 26));
		inTwoYears = kickoffTS.add(new BN(DELAY * 26 * 2));
		inThreeYears = kickoffTS.add(new BN(DELAY * 26 * 3));

		//Transferred SOVs to a4
		await SOV.transfer(a4, wei("10000", "ether"));
		await SOV.approve(staking.address, wei("10000", "ether"), { from: a4 });

		//Transferred SOVs to a5
		await SOV.transfer(a5, wei("10000", "ether"));
		await SOV.approve(staking.address, wei("10000", "ether"), { from: a5 });

		//Transferred SOVs to a6
		await SOV.transfer(a6, wei("10000", "ether"));
		await SOV.approve(staking.address, wei("10000", "ether"), { from: a6 });

		await staking.stake(wei("1000", "ether"), inOneYear, a4, a4, { from: a4 }); //Test - 15/07/2021
		await staking.stake(wei("1000", "ether"), inTwoYears, a5, a5, { from: a5 }); //Test - 15/07/2021
		await staking.stake(wei("1000", "ether"), inThreeYears, a6, a6, { from: a6 });

		await increaseTimeAndBlocks(864000);

		//Staking Reward Program is deployed
		let stakingRewardsLogic = await StakingRewards.new();
		stakingRewards = await StakingRewardsProxy.new();
		await stakingRewards.setImplementation(stakingRewardsLogic.address);
		stakingRewards = await StakingRewards.at(stakingRewards.address); //Test - 12/08/2021
	});

	describe("Flow - StakingRewards", () => {
		it.only("should revert if SOV Address is invalid", async () => {
			await expectRevert(stakingRewards.initialize(constants.ZERO_ADDRESS, staking.address), "Invalid SOV Address.");
			//Staking Rewards Contract is loaded
			await SOV.transfer(stakingRewards.address, "10000000");
			//Initialize
			await stakingRewards.initialize(SOV.address, staking.address);
		});

		it("should compute and send rewards to the stakers a4, a5 and a6 correctly after 2 weeks", async () => {
			await increaseTimeAndBlocks(1296000); //2 Weeks
			let fields = await stakingRewards.getStakerCurrentReward(true, { from: a4 });
			let numOfIntervals = 1;
			let fullTermAvg = avgWeight(26, 27, 9, 78);
			console.log(round(fullTermAvg, 4));
			let expectedAmount = numOfIntervals * Math.floor((1000 * round(fullTermAvg, 4)) / 26);
			console.log(expectedAmount);
			console.log(fields.amount.toString());
			//expect(new BN(expectedAmount)).to.be.bignumber.equal(fields.amount);

			fields = await stakingRewards.getStakerCurrentReward(true, { from: a5 });
			fullTermAvg = avgWeight(52, 53, 9, 78);
			console.log(fullTermAvg);
			console.log(round(fullTermAvg, 4));
			expectedAmount = numOfIntervals * Math.floor((1000 * fullTermAvg) / 26);
			console.log(expectedAmount);
			console.log(fields.amount.toString());
			//expect(new BN(expectedAmount)).to.be.bignumber.equal(fields.amount);

			fields = await stakingRewards.getStakerCurrentReward(true, { from: a6 });
			fullTermAvg = avgWeight(78, 79, 9, 78);
			console.log(round(fullTermAvg, 4));
			expectedAmount = numOfIntervals * Math.floor((1000 * round(fullTermAvg, 4)) / 26);
			console.log(expectedAmount);
			console.log(fields.amount.toString());
			//expect(new BN(expectedAmount)).to.be.bignumber.equal(fields.amount);
		});

		it.only("should compute and send rewards to the stakers a4, a5 and a6 correctly after 4 weeks", async () => {
			await increaseTimeAndBlocks(2592000); //2 Weeks
			let fields = await stakingRewards.getStakerCurrentReward(true, { from: a4 });
			let numOfIntervals = 2;
			let fullTermAvg = avgWeight(25, 27, 9, 78);
			console.log(round(fullTermAvg, 4));
			expectedAmount = numOfIntervals * (1000 * round(fullTermAvg, 4) / 26);
			console.log(expectedAmount);
			console.log(fields.amount.toString());
			//expect(new BN(expectedAmount)).to.be.bignumber.equal(fields.amount);

			fields = await stakingRewards.getStakerCurrentReward(true, { from: a5 });
			fullTermAvg = avgWeight(51, 53, 9, 78);
			console.log(round(fullTermAvg, 4));
			expectedAmount = numOfIntervals * (1000 * round(fullTermAvg, 4) / 26);
			console.log(expectedAmount);
			console.log(fields.amount.toString());
			//expect(new BN(expectedAmount)).to.be.bignumber.equal(fields.amount);

			fields = await stakingRewards.getStakerCurrentReward(true, { from: a6 });
			fullTermAvg = avgWeight(77, 79, 9, 78);
			console.log(round(fullTermAvg, 4));
			expectedAmount = numOfIntervals * (1000 * round(fullTermAvg, 4) / 26);
			console.log(expectedAmount);
			console.log(fields.amount.toString());
			//expect(new BN(expectedAmount)).to.be.bignumber.equal(fields.amount);
		});
	});

	function avgWeight(from, to, maxWeight, maxDuration) {
		let weight = 0;
		for (let i = from; i < to; i++) {
			weight += (maxWeight * (maxDuration ** 2 - (maxDuration - i) ** 2)) / maxDuration ** 2 + 1;
		}
		weight /= to - from;
		return (weight / 10) * 0.2975;
	}

	function round(value, decimals) {
		return Number(Math.round(value + "e" + decimals) + "e-" + decimals);
	}

	async function increaseTimeAndBlocks(seconds) {
		let totalBlocks = (seconds / 30);
		for (let i = 1; i < totalBlocks; i++) {
			await mineBlock();
		}
		await increaseTime(seconds - totalBlocks + 1);
	}
});
