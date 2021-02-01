const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN, balance, time } = require("@openzeppelin/test-helpers");

const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const SOV_ABI = artifacts.require("SOV");
const TestToken = artifacts.require("TestToken");
const FeeSharingProxy = artifacts.require("FeeSharingProxyMockup");
const VestingFactory = artifacts.require("VestingFactory");
const VestingRegistry = artifacts.require("VestingRegistry");
const Vesting = artifacts.require("TeamVesting");

const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
const FOUR_WEEKS = new BN(4 * 7 * 24 * 60 * 60);

const TOTAL_SUPPLY = "100000000000000000000000000";
const ONE_MILLON = "1000000000000000000000000";
const ZERO_ADDRESS = constants.ZERO_ADDRESS;

contract("VestingRegistry", (accounts) => {
	let root, account1, account2, account3;
	let SOV, cSOV1, cSOV2;
	let staking, stakingLogic, feeSharingProxy;
	let vestingFactory, vestingRegistry;

	before(async () => {
		[root, account1, account2, account3, ...accounts] = accounts;
	});

	beforeEach(async () => {
		SOV = await SOV_ABI.new(TOTAL_SUPPLY);
		cSOV1 = await TestToken.new("cSOV1", "cSOV1", 18, TOTAL_SUPPLY);
		cSOV2 = await TestToken.new("cSOV2", "cSOV2", 18, TOTAL_SUPPLY);

		stakingLogic = await StakingLogic.new(SOV.address);
		staking = await StakingProxy.new(SOV.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		feeSharingProxy = await FeeSharingProxy.new(ZERO_ADDRESS, staking.address);

		vestingFactory = await VestingFactory.new();
		vestingRegistry = await VestingRegistry.new(vestingFactory.address, SOV.address, [cSOV1.address, cSOV2.address], staking.address, feeSharingProxy.address, account1);
		vestingFactory.transferOwnership(vestingRegistry.address);
	});

	// describe("constructor", () => {
	// 	it("sets the expected values", async () => {
	// 		let _sov = await vestingRegistry.SOV();
	// 		let _CSOV1 = await vestingRegistry.CSOVtokens(0);
	// 		let _CSOV2 = await vestingRegistry.CSOVtokens(1);
	// 		let _stacking = await vestingRegistry.staking();
	// 		let _feeSharingProxy = await vestingRegistry.feeSharingProxy();
	// 		let _governanceTimelock = await vestingRegistry.governanceTimelock();
	//
	// 		expect(_sov).equal(SOV.address);
	// 		expect(_CSOV1).equal(cSOV1.address);
	// 		expect(_CSOV2).equal(cSOV2.address);
	// 		expect(_stacking).equal(staking.address);
	// 		expect(_feeSharingProxy).equal(feeSharingProxy.address);
	// 		expect(_governanceTimelock).equal(account1);
	// 	});
	//
	// 	it("fails if the 0 address is passed as vestingFactory address", async () => {
	// 		await expectRevert(
	// 			VestingRegistry.new(ZERO_ADDRESS, SOV.address, [cSOV1.address, cSOV2.address], staking.address, feeSharingProxy.address, account1),
	// 			"vestingFactory address invalid"
	// 		);
	// 	});
	//
	// 	it("fails if the 0 address is passed as SOV address", async () => {
	// 		await expectRevert(
	// 			VestingRegistry.new(vestingFactory.address, ZERO_ADDRESS, [cSOV1.address, cSOV2.address], staking.address, feeSharingProxy.address, account1),
	// 			"SOV address invalid"
	// 		);
	// 	});
	//
	// 	it("fails if the 0 address is passed as cSOV address", async () => {
	// 		await expectRevert(
	// 			VestingRegistry.new(vestingFactory.address, SOV.address, [cSOV1.address, cSOV2.address, ZERO_ADDRESS], staking.address, feeSharingProxy.address, account1),
	// 			"CSOV address invalid"
	// 		);
	// 	});
	//
	// 	it("fails if the 0 address is passed as staking address", async () => {
	// 		await expectRevert(
	// 			VestingRegistry.new(vestingFactory.address, SOV.address, [cSOV1.address, cSOV2.address], ZERO_ADDRESS, feeSharingProxy.address, account1),
	// 			"staking address invalid"
	// 		);
	// 	});
	//
	// 	it("fails if the 0 address is passed as feeSharingProxy address", async () => {
	// 		await expectRevert(
	// 			VestingRegistry.new(vestingFactory.address, SOV.address, [cSOV1.address, cSOV2.address], staking.address, ZERO_ADDRESS, account1),
	// 			"feeSharingProxy address invalid"
	// 		);
	// 	});
	//
	// 	it("fails if the 0 address is passed as governanceTimelock address", async () => {
	// 		await expectRevert(
	// 			VestingRegistry.new(vestingFactory.address, SOV.address, [cSOV1.address, cSOV2.address], staking.address, feeSharingProxy.address, ZERO_ADDRESS),
	// 			"governanceTimelock address invalid"
	// 		);
	// 	});
	// });
	//
	// describe("transferSOV", () => {
	// 	it("should be able to transfer SOV", async () => {
	// 		let amount = new BN(1000);
	// 		await SOV.transfer(vestingRegistry.address, amount);
	//
	// 		let balanceBefore = await SOV.balanceOf(account1);
	// 		await vestingRegistry.transferSOV(account1, amount);
	// 		let balanceAfter = await SOV.balanceOf(account1);
	//
	// 		expect(amount).to.be.bignumber.equal(balanceAfter.sub(balanceBefore));
	// 	});
	//
	// 	it("only owner should be able to transfer", async () => {
	// 		await expectRevert(
	// 			vestingRegistry.transferSOV(account1, 1000, {from: account1}),
	// 			"unauthorized"
	// 		);
	// 	});
	//
	// 	it("fails if the 0 address is passed as receiver address", async () => {
	// 		await expectRevert(
	// 			vestingRegistry.transferSOV(ZERO_ADDRESS, 1000),
	// 			"receiver address invalid"
	// 		);
	// 	});
	//
	// 	it("fails if the 0 is passed as an amount", async () => {
	// 		await expectRevert(
	// 			vestingRegistry.transferSOV(account1, 0),
	// 			"amount invalid"
	// 		);
	// 	});
	//
	// });

	// describe("exchangeAllCSOV", () => {
	// 	it("should be able to exchange CSOV", async () => {
	// 		let amount1 = new BN(1000);
	// 		let amount2 = new BN(2000);
	// 		await cSOV1.transfer(account2, amount1);
	// 		await cSOV2.transfer(account2, amount2);
	// 		let amount = amount1.add(amount2);
	// 		await SOV.transfer(vestingRegistry.address, amount);
	//
	// 		await cSOV1.approve(vestingRegistry.address, amount1, {from: account2})
	// 		await cSOV2.approve(vestingRegistry.address, amount2, {from: account2})
	//
	// 		let tx = await vestingRegistry.exchangeAllCSOV({from: account2});
	//
	// 		expectEvent(tx, "CSOVTokensExchanged", {
	// 			caller: account2,
	// 			amount: amount,
	// 		});
	//
	// 		let cSOV1balance = await cSOV1.balanceOf(account2);
	// 		expect(cSOV1balance.toString()).equal("0");
	// 		let cSOV2balance = await cSOV1.balanceOf(account2);
	// 		expect(cSOV2balance.toString()).equal("0");
	//
	// 		let cliff = await vestingRegistry.CSOV_VESTING_CLIFF();
	// 		let duration = await vestingRegistry.CSOV_VESTING_DURATION()
	//
	// 		await checkVesting(account2, cliff, duration, amount);
	// 	});
	//
	// 	it("fails if the 0 is cSOV amount", async () => {
	// 		await expectRevert(
	// 			vestingRegistry.exchangeAllCSOV({from: account2}),
	// 			"amount invalid"
	// 		);
	// 	});
	//
	// 	it("fails if the 0 cSOV transfer is not approved", async () => {
	// 		let amount = new BN(1000);
	// 		await cSOV1.transfer(account2, amount);
	//
	// 		await expectRevert(
	// 			vestingRegistry.exchangeAllCSOV({from: account2}),
	// 			"invalid transfer"
	// 		);
	// 	});
	//
	// 	it("fails if vestingRegistry doesn't have enough SOV", async () => {
	// 		let amount = new BN(1000);
	// 		await cSOV1.transfer(account2, amount);
	//
	// 		await cSOV1.approve(vestingRegistry.address, amount, {from: account2})
	//
	// 		await expectRevert(
	// 			vestingRegistry.exchangeAllCSOV({from: account2}),
	// 			"ERC20: transfer amount exceeds balance"
	// 		);
	// 	});
	//
	// });

	describe("exchangeCSOV", () => {
		//TODO implement if we need this method

	});



	async function checkVesting(account, cliff, duration, amount) {
		let vestingAddress = await vestingRegistry.getVesting(account);
		let vesting = await Vesting.at(vestingAddress);

		let startDate = await vesting.startDate();
		let start = startDate.toNumber() + cliff.toNumber();
		let end = startDate.toNumber() + duration.toNumber();

		let numIntervals = Math.floor((end - start) / FOUR_WEEKS) + 1;
		let stakedPerInterval = amount / numIntervals;

		expect(await vesting.cliff()).to.be.bignumber.equal(cliff);
		expect(await vesting.duration()).to.be.bignumber.equal(duration);

		for (let i = start; i <= end; i += FOUR_WEEKS) {
			let lockedTS = await staking.timestampToLockDate(i);

			let numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(vesting.address, lockedTS);
			let userStakingCheckpoints = await staking.userStakingCheckpoints(vesting.address, lockedTS, numUserStakingCheckpoints - 1);
			assert.equal(numUserStakingCheckpoints.toString(), "1");
			assert.equal(userStakingCheckpoints.stake.toString(), stakedPerInterval);

			let numDelegateStakingCheckpoints = await staking.numDelegateStakingCheckpoints(account, lockedTS);
			let delegateStakingCheckpoints = await staking.delegateStakingCheckpoints(account, lockedTS, numUserStakingCheckpoints - 1);
			assert.equal(numDelegateStakingCheckpoints.toString(), "1");
			assert.equal(delegateStakingCheckpoints.stake.toString(), stakedPerInterval);
		}
	}

});
