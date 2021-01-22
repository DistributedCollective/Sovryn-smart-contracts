const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN, balance, time } = require("@openzeppelin/test-helpers");
const { increaseTime } = require("../Utils/Ethereum");

const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const TestToken = artifacts.require("TestToken");
const Vesting = artifacts.require("Vesting");
const DevelopmentVesting = artifacts.require("DevelopmentVestingMockup");

const ZERO_ADDRESS = constants.ZERO_ADDRESS;

const WEEK = new BN(7 * 24 * 60 * 60);

const TOTAL_SUPPLY = "10000000000000000000000000";
const ONE_MILLON = "1000000000000000000000000";

contract("DevelopmentVesting:", (accounts) => {
	const name = "Test token";
	const symbol = "TST";

	let root, account1, account2, account3;
	let token, staking, stakingLogic;
	let vesting, tokenOwner;

	let cliff = WEEK;
	let duration = WEEK.mul(new BN(11));
	let frequency = WEEK.mul(new BN(2));

	before(async () => {
		[root, account1, account2, account3, ...accounts] = accounts;
	});

	beforeEach(async () => {
		token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

		stakingLogic = await StakingLogic.new(token.address);
		staking = await StakingProxy.new(token.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		tokenOwner = account1;
		vesting = await DevelopmentVesting.new(token.address, tokenOwner, cliff, duration, frequency);
	});

	describe("constructor:", () => {
		it("sets the expected values", async () => {
			//Check data
			let _sov = await vesting.SOV();
			let _tokenOwner = await vesting.tokenOwner();
			let _cliff = await vesting.cliff();
			let _duration = await vesting.duration();
			let _frequency = await vesting.frequency();

			assert.equal(_sov, token.address);
			assert.equal(_tokenOwner, tokenOwner);
			assert.equal(_cliff.toString(), cliff);
			assert.equal(_duration.toString(), duration);
			assert.equal(_frequency.toString(), frequency);
		});

		it("fails if the 0 address is passed as SOV address", async () => {
			await expectRevert(DevelopmentVesting.new(ZERO_ADDRESS, root, 10, 100, 30), "SOV address invalid");
		});

		it("fails if the 0 address is passed as token owner address", async () => {
			await expectRevert(DevelopmentVesting.new(token.address, ZERO_ADDRESS, 10, 100, 30), "token owner address invalid");
		});

		it("fails if the vesting duration is shorter than the cliff", async () => {
			await expectRevert(
				DevelopmentVesting.new(token.address, root, 100, 99, 100),
				"duration must be bigger than or equal to the cliff"
			);
		});

		it("fails if the vesting duration is shorter than the frequency", async () => {
			await expectRevert(DevelopmentVesting.new(token.address, root, 10, 100, 200), "frequency is bigger than (duration - cliff)");
		});
	});

	describe("setTokenOwner:", () => {
		it("sets token owner", async () => {
			await vesting.setTokenOwner(account2);

			expect(await vesting.tokenOwner()).to.be.equal(account2);
		});

		it("fails if the 0 address is passed as token owner address", async () => {
			await expectRevert(vesting.setTokenOwner(ZERO_ADDRESS), "token owner address invalid");
		});

		it("fails if the 0 address is passed as token owner address", async () => {
			await expectRevert(vesting.setTokenOwner(account2, { from: tokenOwner }), "unauthorized");
		});
	});

	describe("depositTokens:", () => {
		it("should be able to deposit tokens", async () => {
			let amount = 12345;
			await token.approve(vesting.address, amount);
			let tx = await vesting.depositTokens(amount);

			let depositedAmount = await vesting.amount();
			expect(depositedAmount.toNumber()).to.be.equal(amount);

			let vestingBalance = await token.balanceOf(vesting.address);
			expect(vestingBalance.toNumber()).to.be.equal(amount);

			expectEvent(tx, "TokensSent", {
				caller: root,
				amount: new BN(amount),
			});
		});

		it("fails if amount is 0", async () => {
			await expectRevert(vesting.depositTokens(0), "amount needs to be bigger than 0");
		});

		it("fails if transfer fails", async () => {
			await expectRevert(vesting.depositTokens(12345), "invalid transfer");
		});
	});

	describe("withdrawTokens:", () => {
		it("should be able to withdraw tokens", async () => {
			let amount = 12345;
			await token.approve(vesting.address, amount);
			await vesting.depositTokens(amount);

			let tx = await vesting.withdrawTokens(amount, account1);

			let depositedAmount = await vesting.amount();
			expect(depositedAmount.toNumber()).to.be.equal(0);

			let vestingBalance = await token.balanceOf(vesting.address);
			expect(vestingBalance.toNumber()).to.be.equal(0);

			let receiverBalance = await token.balanceOf(account1);
			expect(receiverBalance.toNumber()).to.be.equal(amount);

			expectEvent(tx, "TokensWithdrawn", {
				caller: root,
				receiver: account1,
				amount: new BN(amount),
			});
		});

		it("fails if amount is 0", async () => {
			await expectRevert(vesting.withdrawTokens(0, root), "amount needs to be bigger than 0");
		});

		it("fails if amount iss not available", async () => {
			await expectRevert(vesting.withdrawTokens(100, root), "amount is not available");
		});

		it("fails if receiver address invalid", async () => {
			let amount = 100;
			await token.approve(vesting.address, amount);
			await vesting.depositTokens(amount);

			await expectRevert(vesting.withdrawTokens(amount, ZERO_ADDRESS), "receiver address invalid");
		});
	});

	describe("changeSchedule:", () => {
		it("change schedule to unlock tokens", async () => {
			let amount = 1000;
			await token.approve(vesting.address, amount);
			await vesting.vestTokens(amount);

			let unlockedAmount = await vesting.getUnlockedAmount(0);
			expect(unlockedAmount.toNumber()).to.be.equal(0);

			await vesting.changeSchedule(0, 0, 0);

			unlockedAmount = await vesting.getUnlockedAmount(0);
			expect(unlockedAmount.toNumber()).to.be.equal(amount);
		});

		it("fails if the vesting duration is shorter than the cliff", async () => {
			await expectRevert(vesting.changeSchedule(100, 99, 100), "duration must be bigger than or equal to the cliff");
		});

		it("fails if the vesting duration is shorter than the frequency", async () => {
			await expectRevert(vesting.changeSchedule(10, 100, 200), "frequency is bigger than (duration - cliff)");
		});
	});

	describe("vestTokens:", () => {
		it("should be able to vest tokens", async () => {
			let amount = 123000;
			await token.approve(vesting.address, amount);
			let tx = await vesting.vestTokens(amount);

			let vestingBalance = await token.balanceOf(vesting.address);
			expect(vestingBalance.toNumber()).to.be.equal(amount);

			let schedule = await vesting.schedules(0);
			let block = await web3.eth.getBlock(tx.receipt.blockNumber);
			expect(schedule.startDate.toString()).to.be.equal(block.timestamp.toString());
			expect(schedule.amount.toNumber()).to.be.equal(amount);
			expect(schedule.withdrawnAmount.toNumber()).to.be.equal(0);

			expectEvent(tx, "TokensVested", {
				caller: root,
				amount: new BN(amount),
			});
		});

		it("fails if amount is 0", async () => {
			await expectRevert(vesting.vestTokens(0), "amount needs to be bigger than 0");
		});

		it("fails if transfer fails", async () => {
			await expectRevert(vesting.vestTokens(12345), "invalid transfer");
		});
	});

	describe("withdrawByAllSchedules:", () => {
		it("should be able to vest tokens", async () => {
			let amount1 = 123000;
			await token.approve(vesting.address, amount1);
			await vesting.vestTokens(amount1);

			await increaseTime(WEEK.toNumber());

			let amount2 = 567000;
			await token.approve(vesting.address, amount2);
			await vesting.vestTokens(amount2);

			await increaseTime(duration.toNumber());

			await vesting.withdrawByAllSchedules(account1);

			let vestingBalance = await token.balanceOf(vesting.address);
			expect(vestingBalance.toNumber()).to.be.equal(0);

			let receiverBalance = await token.balanceOf(account1);
			expect(receiverBalance.toNumber()).to.be.equal(amount1 + amount2);

			let schedule1 = await vesting.schedules(0);
			expect(schedule1.amount.toNumber()).to.be.equal(amount1);
			expect(schedule1.withdrawnAmount.toNumber()).to.be.equal(amount1);

			let schedule2 = await vesting.schedules(1);
			expect(schedule2.amount.toNumber()).to.be.equal(amount2);
			expect(schedule2.withdrawnAmount.toNumber()).to.be.equal(amount2);
		});

		it("fails if receiver address invalid", async () => {
			await expectRevert(vesting.withdrawByAllSchedules(ZERO_ADDRESS), "receiver address invalid");
		});

		it("fails if no available tokens", async () => {
			await expectRevert(vesting.withdrawByAllSchedules(root), "no available tokens");
		});
	});

	describe("withdrawByGivenSchedules:", () => {
		it("should be able to vest tokens", async () => {
			let amount1 = 123000;
			await token.approve(vesting.address, amount1);
			await vesting.vestTokens(amount1);

			await increaseTime(WEEK.toNumber());

			let amount2 = 567000;
			await token.approve(vesting.address, amount2);
			await vesting.vestTokens(amount2);

			await increaseTime(duration.toNumber());

			//first withdraw
			await vesting.withdrawByGivenSchedules(account1, 0, 1);

			let vestingBalance = await token.balanceOf(vesting.address);
			expect(vestingBalance.toNumber()).to.be.equal(amount2);

			let receiverBalance = await token.balanceOf(account1);
			expect(receiverBalance.toNumber()).to.be.equal(amount1);

			let schedule1 = await vesting.schedules(0);
			expect(schedule1.amount.toNumber()).to.be.equal(amount1);
			expect(schedule1.withdrawnAmount.toNumber()).to.be.equal(amount1);

			let schedule2 = await vesting.schedules(1);
			expect(schedule2.amount.toNumber()).to.be.equal(amount2);
			expect(schedule2.withdrawnAmount.toNumber()).to.be.equal(0);

			//second withdraw
			await vesting.withdrawByGivenSchedules(account1, 1, 1);

			vestingBalance = await token.balanceOf(vesting.address);
			expect(vestingBalance.toNumber()).to.be.equal(0);

			receiverBalance = await token.balanceOf(account1);
			expect(receiverBalance.toNumber()).to.be.equal(amount1 + amount2);

			schedule1 = await vesting.schedules(0);
			expect(schedule1.amount.toNumber()).to.be.equal(amount1);
			expect(schedule1.withdrawnAmount.toNumber()).to.be.equal(amount1);

			schedule2 = await vesting.schedules(1);
			expect(schedule2.amount.toNumber()).to.be.equal(amount2);
			expect(schedule2.withdrawnAmount.toNumber()).to.be.equal(amount2);
		});
	});

	describe("_getUnlockedAmount:", () => {
		it("calculate unlocked tokens", async () => {
			let amount = 1000;
			let numIntervals = (duration.toNumber() - cliff.toNumber()) / frequency.toNumber() + 1;
			let amountPerInterval = Math.floor(amount / numIntervals);

			await token.approve(vesting.address, amount);
			await vesting.vestTokens(amount);

			await increaseTime(cliff.toNumber());

			let unlockedAmount = await vesting.getUnlockedAmount(0);
			let expectedAmount = amount - amountPerInterval * numIntervals;
			expectedAmount += amountPerInterval;
			expect(unlockedAmount.toNumber()).to.be.equal(expectedAmount);

			await increaseTime(frequency.toNumber());

			unlockedAmount = await vesting.getUnlockedAmount(0);
			expectedAmount = amount - amountPerInterval * numIntervals;
			expectedAmount += amountPerInterval * 2;
			expect(unlockedAmount.toNumber()).to.be.equal(expectedAmount);
		});
	});
});
