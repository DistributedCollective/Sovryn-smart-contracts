const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN, balance, time } = require("@openzeppelin/test-helpers");
const { address, minerStart, minerStop, unlockedAccount, mineBlock, etherMantissa, etherUnsigned, setTime } = require("../Utils/Ethereum");

const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
//Staking Rewards
const StakingRewards = artifacts.require("StakingRewards");
const StakingRewardsProxy = artifacts.require("StakingRewardsProxy");
const TestToken = artifacts.require("TestToken");
const Vesting = artifacts.require("TeamVesting");

const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
const TOTAL_SUPPLY = "10000000000000000000000000";

contract("TeamVesting", (accounts) => {
	const name = "Test token";
	const symbol = "TST";

	let root, a1, a2, a3;
	let token, staking;
	let kickoffTS;

	before(async () => {
		[root, a1, a2, a3, ...accounts] = accounts;
		token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

		let stakingLogic = await StakingLogic.new(token.address);
		staking = await StakingProxy.new(token.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		//Staking Reward Program is deployed
		let stakingRewardsLogic = await StakingRewards.new();
		stakingRewards = await StakingRewardsProxy.new();
		await stakingRewards.setImplementation(stakingRewardsLogic.address);
		stakingRewards = await StakingRewards.at(stakingRewards.address);
		await staking.setStakingRewards(stakingRewards.address);
		//Initialize
		await stakingRewards.initialize(SOV.address, staking.address); //Test - 24/08/2021
		await stakingRewards.setStakingAddress(staking.address);

		await token.transfer(a2, "1000");
		await token.approve(staking.address, "1000", { from: a2 });

		kickoffTS = await staking.kickoffTS.call();
	});
});
