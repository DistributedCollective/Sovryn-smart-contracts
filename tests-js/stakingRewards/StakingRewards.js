const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN, balance, time } = require("@openzeppelin/test-helpers");

const {
	address,
	minerStart,
	minerStop,
	unlockedAccount,
	mineBlock,
	etherMantissa,
	etherUnsigned,
	setTime,
	advanceBlocks,
} = require("../Utils/Ethereum");

const SOV_ABI = artifacts.require("SOV");
const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const StakingRewards = artifacts.require("StakingRewards");
const StakingRewardsProxy = artifacts.require("StakingRewardsProxy");

const TOTAL_SUPPLY = "10000000000000000000000000";
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

const DAY = 86400;
const TWO_WEEKS = 1209600;
const DELAY = TWO_WEEKS;

contract("WeightedStaking", (accounts) => {
	let root, a1, a2, a3;
	let SOV, staking;
	let kickoffTS, inOneWeek, inOneYear, inTwoYears, inThreeYears;

	before(async () => {
		[root, a1, a2, a3, ...accounts] = accounts;
	});

	beforeEach(async () => {
		SOV = await SOV_ABI.new(TOTAL_SUPPLY);

		let stakingLogic = await StakingLogic.new(SOV.address);
		staking = await StakingProxy.new(SOV.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		await advanceBlocks(20000);

		let stakingRewardsLogic = await StakingRewards.new();
		stakingRewards = await StakingRewardsProxy.new();
		await stakingRewards.setImplementation(stakingRewardsLogic.address);
		stakingRewards = await StakingRewards.at(stakingRewards.address);

		await stakingRewards.initialize(SOV.address, staking.address);

		await SOV.transfer(a2, "10000000");
		await SOV.approve(staking.address, "10000000", { from: a2 });

		await SOV.transfer(stakingRewards.address, "10000000");

		kickoffTS = await staking.kickoffTS.call();
		inOneWeek = kickoffTS.add(new BN(DELAY));
		inOneYear = kickoffTS.add(new BN(DELAY * 26));
		inTwoYears = kickoffTS.add(new BN(DELAY * 26 * 2));
		inThreeYears = kickoffTS.add(new BN(DELAY * 26 * 3));
	});

	describe("Flow - StakingRewards", () => {
		it.only("should compute the expected weighted stake", async () => {
			let beforeBalance = await SOV.balanceOf(a2);
			console.log(beforeBalance.toString());
			await advanceBlocks(20000);
			await staking.stake("10000", inOneYear, a2, a2, { from: a2 });
			await advanceBlocks(20000);
			await staking.stake("10000", inThreeYears, a2, a2, { from: a2 });
			await advanceBlocks(20000);
			await staking.stake("10000", inThreeYears, a2, a2, { from: a2 });

			await advanceBlocks(20000);
			//Set Base Rate
			await stakingRewards.setBaseRate(2975, 2600000);

			//Collect Rewards - User a2
			//await increaseTime(TWO_WEEKS);
			await advanceBlocks(20000);
			beforeBalance = await SOV.balanceOf(a2);
			console.log(beforeBalance.toString());
			let tx = await stakingRewards.collectReward({ from: a2 });
			//console.log(tx.receipt.blockNumber);
			let afterBalance = await SOV.balanceOf(a2);
			console.log(beforeBalance.toString(), afterBalance.toString());
		});
	});
});
