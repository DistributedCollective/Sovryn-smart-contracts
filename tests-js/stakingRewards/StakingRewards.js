const { expect } = require("chai");
const { expectRevert, BN, constants } = require("@openzeppelin/test-helpers");

const { increaseTime, advanceBlocks } = require("../Utils/Ethereum");

const SOV_ABI = artifacts.require("SOV");
const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const StakingRewards = artifacts.require("StakingRewards");
const StakingRewardsProxy = artifacts.require("StakingRewardsProxy");
const FeeSharingProxy = artifacts.require("FeeSharingProxy");
const Protocol = artifacts.require("sovrynProtocol");

const TOTAL_SUPPLY = "10000000000000000000000000";
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

const DAY = 86400;
const TWO_WEEKS = 1209600;
const DELAY = TWO_WEEKS;

contract("StakingRewards", (accounts) => {
	let root, a1, a2, a3;
	let SOV, staking;
	let kickoffTS, inOneWeek, inOneYear, inTwoYears, inThreeYears;
	let feeSharingProxy;
	let protocol;
	let beforeBalance, afterBalance;
	let totalRewards;

	before(async () => {
		[root, a1, a2, a3, ...accounts] = accounts;
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

		//Transferred SOVs to a1
		await SOV.transfer(a1, "10000000");
		await SOV.approve(staking.address, "10000000", { from: a1 });

		//Transferred SOVs to a2
		await SOV.transfer(a2, "10000000");
		await SOV.approve(staking.address, "10000000", { from: a2 });

		//Transferred SOVs to a3
		await SOV.transfer(a3, "1000");
		await SOV.approve(staking.address, "1000", { from: a3 });

		//a2 stakes at intervals
		await increaseTime(1209600); //2 Weeks
		await staking.stake("10000", inOneYear, a1, a1, { from: a1 }); //Test - 15/07/2021
		await staking.stake("10000", inOneYear, a2, a2, { from: a2 }); //Test - 15/07/2021
		await staking.stake("100", inThreeYears, a3, a3, { from: a3 }); //Test - 15/07/2021
		await increaseTime(1209600); //2 Weeks
		await staking.stake("20000", inTwoYears, a1, a1, { from: a1 }); //Test - 29/07/2021
		await staking.stake("20000", inTwoYears, a2, a2, { from: a2 }); //Test - 29/07/2021
		await increaseTime(1209600); //2 Weeks

		//Staking Reward Program is deployed
		let stakingRewardsLogic = await StakingRewards.new();
		stakingRewards = await StakingRewardsProxy.new();
		await stakingRewards.setImplementation(stakingRewardsLogic.address);
		stakingRewards = await StakingRewards.at(stakingRewards.address); //Test - 12/08/2021
	});

	describe("Flow - StakingRewards", () => {
		it("should revert if SOV Address is not a contract address", async () => {
			await expectRevert(stakingRewards.initialize(a3, staking.address), "_SOV not a contract");
		});

		it("should revert if SOV Address is invalid", async () => {
			await expectRevert(stakingRewards.initialize(constants.ZERO_ADDRESS, staking.address), "Invalid SOV Address.");
			//Staking Rewards Contract is loaded
			await SOV.transfer(stakingRewards.address, "10000000");
			//Initialize
			await stakingRewards.initialize(SOV.address, staking.address);
			//Set Base Rate
			await stakingRewards.setMaxDuration(26 * TWO_WEEKS);
		});

		it("should revert if rewards are claimed before completion of two weeks from start date", async () => {
			await expectRevert(stakingRewards.collectReward({ from: a2 }), "allowed after 14 days of start");
		});

		it("should compute and send rewards to the staker as applicable", async () => {
			await increaseTime(1209600); //2 Weeks - First Payment
			beforeBalance = await SOV.balanceOf(a2);
			await stakingRewards.collectReward({ from: a2 }); //Test - 26/08/2021
			afterBalance = await SOV.balanceOf(a2);
			rewards = afterBalance.sub(beforeBalance);
			totalRewards = new BN(totalRewards).add(new BN(rewards));
			expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
		});

		//a2 finds the program lucrative and stakes for long term
		it("should compute send rewards to the staker including added staking", async () => {
			await increaseTime(86400); //1 Day //Test - 27/08/2021
			await staking.stake("30000", inThreeYears, a2, a2, { from: a2 });

			await increaseTime(1209600 - 86400); //Second Payment - 13 days approx
			beforeBalance = await SOV.balanceOf(a2);
			await stakingRewards.collectReward({ from: a2 }); //Test - 10/09/2021
			afterBalance = await SOV.balanceOf(a2);
			rewards = afterBalance.sub(beforeBalance);
			totalRewards = new BN(totalRewards).add(new BN(rewards));
			expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
		});

		it("should revert if the user tries to claim rewards early", async () => {
			await increaseTime(86400); //One day
			await expectRevert(stakingRewards.collectReward({ from: a2 }), "allowed after 14 days");
		});

		it("should compute and send rewards to the staker after recalculating withdrawn stake", async () => {
			await increaseTime(32659200); //More than a year - first stake expires
			await staking.withdraw("10000", inOneYear, a2, { from: a2 }); //Withdraw first stake
			beforeBalance = await SOV.balanceOf(a2);
			await stakingRewards.collectReward({ from: a2 });
			afterBalance = await SOV.balanceOf(a2);
			rewards = afterBalance.sub(beforeBalance);
			totalRewards = new BN(totalRewards).add(new BN(rewards));
			expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
		});

		it("should continue getting rewards for the staking period even after the program stops", async () => {
			await increaseTime(1209600 - 86400); //Second Payment - 13 days approx
			await stakingRewards.stop();
			beforeBalance = await SOV.balanceOf(a2);
			await stakingRewards.collectReward({ from: a2 });
			afterBalance = await SOV.balanceOf(a2);
			rewards = afterBalance.sub(beforeBalance);
			totalRewards = new BN(totalRewards).add(new BN(rewards));
			expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
		});

		it("should compute and send rewards to the staker a3 as applicable", async () => {
			beforeBalance = await SOV.balanceOf(a3);
			let tx = await stakingRewards.collectReward({ from: a3 });
			console.log("gasUsed: " + tx.receipt.gasUsed);
			afterBalance = await SOV.balanceOf(a3);
			rewards = afterBalance.sub(beforeBalance);
			totalRewards = new BN(totalRewards).add(new BN(rewards));
			expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
		});

		it("should NOT pay rewards for staking after the program stops", async () => {
			await increaseTime(1209600); //2 Weeks
			await staking.stake("10000", inTwoYears, a2, a2, { from: a2 });
			beforeBalance = await SOV.balanceOf(a2);
			await stakingRewards.collectReward({ from: a2 });
			afterBalance = await SOV.balanceOf(a2);
			rewards = afterBalance.sub(beforeBalance);
			totalRewards = new BN(totalRewards).add(new BN(rewards));
			expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
		});

		it("should stop getting rewards when the staking ends after the program stops", async () => {
			await increaseTime(1209600); //2 Weeks
			feeSharingProxy = await FeeSharingProxy.new(protocol.address, staking.address);
			await staking.setFeeSharing(feeSharingProxy.address);
			await staking.withdraw("20000", inTwoYears, a2, { from: a2 }); //Withdraw second stake
			await staking.withdraw("30000", inThreeYears, a2, { from: a2 }); //Withdraw third stake
			await staking.withdraw("10000", inTwoYears, a2, { from: a2 }); //Withdraw the last stake as well
			beforeBalance = await SOV.balanceOf(a2);
			await expectRevert(stakingRewards.collectReward({ from: a2 }), "weightedStake is zero");
			afterBalance = await SOV.balanceOf(a2);
			rewards = afterBalance.sub(beforeBalance);
			totalRewards = new BN(totalRewards).add(new BN(rewards));
			let feeSharingBalance = await SOV.balanceOf.call(feeSharingProxy.address);
			expect(afterBalance).to.be.bignumber.equal(beforeBalance);
		});

		it("should process for max duration at a time", async () => {
			await increaseTime(7890000); //3 Months
			await stakingRewards.stop();
			beforeBalance = await SOV.balanceOf(a1);
			await stakingRewards.collectReward({ from: a1 });
			afterBalance = await SOV.balanceOf(a1);
			rewards = afterBalance.sub(beforeBalance);
			totalRewards = new BN(totalRewards).add(new BN(rewards));
			expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
		});

		it("should be able to process again immdeiately when processing after the max duration", async () => {
			beforeBalance = await SOV.balanceOf(a1);
			await stakingRewards.collectReward({ from: a1 });
			afterBalance = await SOV.balanceOf(a1);
			rewards = afterBalance.sub(beforeBalance);
			totalRewards = new BN(totalRewards).add(new BN(rewards));
			expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
		});

		it("should revert withdraw all tokens if address is invalid", async () => {
			await expectRevert(stakingRewards.withdrawTokensByOwner(constants.ZERO_ADDRESS), "receiver address invalid");
		});

		it("should revert withdraw all tokens if sender isn't the owner", async () => {
			await expectRevert(stakingRewards.withdrawTokensByOwner(a3, { from: a3 }), "unauthorized");
		});

		it("should withdraw all tokens", async () => {
			beforeBalance = await SOV.balanceOf(a3);
			await stakingRewards.withdrawTokensByOwner(a3);
			afterBalance = await SOV.balanceOf(a3);
			let amount = new BN(10000000).sub(totalRewards);
			expect(afterBalance.sub(beforeBalance)).to.be.bignumber.equal(amount);
		});

		it("should revert while withdrawing 0 amount", async () => {
			await expectRevert(stakingRewards.withdrawTokensByOwner(a3), "amount invalid");
		});

		it("should revert if contract doesn't have enough funds to reward user", async () => {
			await increaseTime(1209600); //2 Weeks
			await expectRevert(stakingRewards.collectReward({ from: a1 }), "not enough funds to reward user");
		});

		it("should revert if sender is a ZERO Address", async () => {
			await expectRevert(
				stakingRewards.collectReward({ from: constants.ZERO_ADDRESS }),
				"unknown account 0x0000000000000000000000000000000000000000"
			);
		});
	});
});
