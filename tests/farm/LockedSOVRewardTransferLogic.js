const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");
const { etherMantissa, mineBlock, advanceBlocks } = require("../Utils/Ethereum");

const { ZERO_ADDRESS } = constants;
const TOTAL_SUPPLY = etherMantissa(1000000000);

const TestToken = artifacts.require("TestToken");
const TestLockedSOV = artifacts.require("LockedSOVMockup");
const LockedSOVRewardTransferLogic = artifacts.require("LockedSOVRewardTransferLogic");

describe("LockedSOVRewardTransferLogic", () => {
	const name = "Test SOV Token";
	const symbol = "TST";

	// The % which determines how much will be unlocked immediately.
	/// @dev 10000 is 100%
	const unlockedImmediatelyPercent = new BN(1000); //10%

	let accounts;
	let root, account1, account2, account3, account4;
	let SOVToken, token1, token2, token3;
	let rewardTransferLogic, lockedSOVAdmins, lockedSOV;

	before(async () => {
		accounts = await web3.eth.getAccounts();
		[root, account1, account2, account3, account4, ...accounts] = accounts;
	});

	beforeEach(async () => {
		SOVToken = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
		token1 = await TestToken.new("Test token 1", "TST-1", 18, TOTAL_SUPPLY);
		token2 = await TestToken.new("Test token 2", "TST-2", 18, TOTAL_SUPPLY);
		token3 = await TestToken.new("Test token 3", "TST-3", 18, TOTAL_SUPPLY);

		lockedSOVAdmins = [account1, account2];

		lockedSOV = await TestLockedSOV.new(SOVToken.address, lockedSOVAdmins);

		rewardTransferLogic = await LockedSOVRewardTransferLogic.new();
		await rewardTransferLogic.initialize(lockedSOV.address, unlockedImmediatelyPercent);
	});

	describe("initialize", () => {
		it("fails if not an owner or admin", async () => {
			rewardTransferLogic = await LockedSOVRewardTransferLogic.new();
			await expectRevert(rewardTransferLogic.initialize(SOVToken.address, unlockedImmediatelyPercent, { from: account1 }), "unauthorized");

			await rewardTransferLogic.addAdmin(account1);
			await rewardTransferLogic.initialize(SOVToken.address, unlockedImmediatelyPercent, { from: account1 });
		});


		it("sets the expected values", async () => {
			rewardTransferLogic = await LockedSOVRewardTransferLogic.new();
			await rewardTransferLogic.initialize(lockedSOV.address, unlockedImmediatelyPercent);
			let _lockedSOVAddress = await rewardTransferLogic.lockedSOV();
			let _unlockedImmediatelyPercent = await rewardTransferLogic.unlockedImmediatelyPercent();
			expect(_lockedSOVAddress).equal(lockedSOV.address);
			expect(_unlockedImmediatelyPercent).bignumber.equal(unlockedImmediatelyPercent);
		});
	});

	describe("changeLockedSOV", () => {
		it("fails if not an owner or admin", async () => {
			await expectRevert(rewardTransferLogic.changeLockedSOV(SOVToken.address, { from: account1 }), "unauthorized");

			await rewardTransferLogic.addAdmin(account1);
			await rewardTransferLogic.changeLockedSOV(SOVToken.address, { from: account1 });
		});

		it("fails if invalid address", async () => {
			await rewardTransferLogic.addAdmin(account1);
			await expectRevert(rewardTransferLogic.changeLockedSOV(ZERO_ADDRESS, { from: account1 }), "Invalid address");
		});

		it("should set a new LockedSOV", async () => {
			//first check original lockedSOV address
			let lockedSOVAddress = await rewardTransferLogic.lockedSOV();
			expect(lockedSOV.address).equal(lockedSOVAddress);

			newLockedSOV = await TestLockedSOV.new(SOVToken.address, lockedSOVAdmins);
			await rewardTransferLogic.addAdmin(account1);
			tx = await rewardTransferLogic.changeLockedSOV(newLockedSOV.address, { from: account1 });

			//then check new lockedSOV address
			let newLockedSOVAddress = await rewardTransferLogic.lockedSOV();
			expect(newLockedSOV.address).equal(newLockedSOVAddress);

			expectEvent(tx, "LockedSOVChanged", {
				_newAddress: newLockedSOVAddress,
			});
		});
	});

	describe("changeUnlockedImmediatelyPercent", async () => {
		it("fails if not an owner or admin", async () => {
			await expectRevert(
				rewardTransferLogic.changeUnlockedImmediatelyPercent(unlockedImmediatelyPercent, { from: account1 }),
				"unauthorized"
			);

			await rewardTransferLogic.addAdmin(account1);
			await rewardTransferLogic.changeUnlockedImmediatelyPercent(unlockedImmediatelyPercent, { from: account1 });
		});

		it("fails if invalid unlocked percent", async () => {
			await rewardTransferLogic.addAdmin(account1);
			await expectRevert(
				rewardTransferLogic.changeUnlockedImmediatelyPercent(new BN(10000), { from: account1 }),
				"Unlocked immediately percent has to be less than 10000."
			);
		});

		it("should set a new unlocked percent", async () => {
			//first check origin unlocked percent
			let unlockedPercent = await rewardTransferLogic.unlockedImmediatelyPercent();
			expect(unlockedPercent).bignumber.equal(unlockedImmediatelyPercent);

			const newUnlockedPercent = new BN(10);
			await rewardTransferLogic.addAdmin(account1);
			tx = await rewardTransferLogic.changeUnlockedImmediatelyPercent(newUnlockedPercent, { from: account1 });

			//then check new unlocked percent
			let newUnlockedPercentAmount = await rewardTransferLogic.unlockedImmediatelyPercent();
			expect(newUnlockedPercentAmount).bignumber.equal(newUnlockedPercent);

			expectEvent(tx, "UnlockImmediatelyPercentChanged", {
				_newAmount: newUnlockedPercentAmount,
			});
		});
	});

	describe("getRewardTokenAddress", async () => {
		it("should return SOVToken address", async () => {
			let SOVTokenAddress = await rewardTransferLogic.getRewardTokenAddress();
			expect(SOVTokenAddress).equal(SOVToken.address);
		});

		it("should change lockedSOV and return new token address", async () => {
			let newLockedSOV = await TestLockedSOV.new(token1.address, lockedSOVAdmins);
			await rewardTransferLogic.addAdmin(account1);
			await rewardTransferLogic.changeLockedSOV(newLockedSOV.address, { from: account1 });

			let token1Address = await rewardTransferLogic.getRewardTokenAddress();
			expect(token1Address).equal(token1.address);
		});
	});

	describe("senderToAuthorize", async () => {
		it("should return contract address", async () => {
			let rewardTransferLogicAddress = await rewardTransferLogic.senderToAuthorize();
			expect(rewardTransferLogicAddress).equal(rewardTransferLogic.address);
		});
	});

	describe("transferReward", async () => {
		const account1InitialBalance = new BN(100);
		const amountToTransfer = new BN(50);

		it("fails if account doesn't have reward tokens", async () => {
			await expectRevert(rewardTransferLogic.transferReward(account2, new BN(5), false, { from: account1 }), "invalid transfer");
		});

		it("fails if account didn't approve before", async () => {
			//send some SOVTokens to account1 to be able to transfer
			await SOVToken.mint(account1, new BN(10));
			await expectRevert(rewardTransferLogic.transferReward(account2, new BN(5), false, { from: account1 }), "invalid transfer");
		});

		it("fails if invalid address to transfer", async () => {
			//send some SOVTokens to account1 to be able to transfer
			await SOVToken.mint(account1, account1InitialBalance);
			await SOVToken.approve(rewardTransferLogic.address, account1InitialBalance, { from: account1 });
			await expectRevert(rewardTransferLogic.transferReward(ZERO_ADDRESS, new BN(5), false, { from: account1 }), "invalid transfer");
		});

		it("should account1 transfer reward to account2 without withdraw", async () => {
			//send some SOVTokens to account1 to be able to transfer
			await SOVToken.mint(account1, account1InitialBalance);
			await SOVToken.approve(rewardTransferLogic.address, account1InitialBalance, { from: account1 });

			await rewardTransferLogic.transferReward(account2, amountToTransfer, false, { from: account1 });
			let account1FinalBalance = await SOVToken.balanceOf(account1);
			expect(account1FinalBalance).bignumber.equal(account1InitialBalance.sub(amountToTransfer));
		});

		it("should account2 receive unlocked balance after transfer without withdraw", async () => {
			//send some SOVTokens to account1 to be able to transfer
			await SOVToken.mint(account1, account1InitialBalance);
			await SOVToken.approve(rewardTransferLogic.address, account1InitialBalance, { from: account1 });

			await rewardTransferLogic.transferReward(account2, amountToTransfer, false, { from: account1 });
			let lockedBalance = await lockedSOV.getLockedBalance(account2);
			let unlockedBalance = await lockedSOV.getUnlockedBalance(account2);

			let unlockedPercent = await rewardTransferLogic.unlockedImmediatelyPercent();
			let balancePercent = amountToTransfer.mul(unlockedPercent).div(new BN(10000));
			let balanceAccount2 = await SOVToken.balanceOf(account2);

			expect(balanceAccount2).bignumber.equal(balancePercent);
			expect(lockedBalance).bignumber.equal(new BN(0));
			expect(unlockedBalance).bignumber.equal(new BN(0));
		});

		it("should should account2 have locked and unlocked balance after transfer with withdraw", async () => {
			//send some SOVTokens to account1 to be able to transfer
			await SOVToken.mint(account1, account1InitialBalance);
			await SOVToken.approve(rewardTransferLogic.address, account1InitialBalance, { from: account1 });

			await rewardTransferLogic.transferReward(account2, amountToTransfer, true, { from: account1 });
			let lockedBalance = await lockedSOV.getLockedBalance(account2);
			let unlockedBalance = await lockedSOV.getUnlockedBalance(account2);

			let unlockedPercent = await rewardTransferLogic.unlockedImmediatelyPercent();
			let balancePercent = amountToTransfer.mul(unlockedPercent).div(new BN(10000));

			expect(lockedBalance).bignumber.equal(amountToTransfer.sub(balancePercent));
			expect(unlockedBalance).bignumber.equal(balancePercent);
		});
	});
});
