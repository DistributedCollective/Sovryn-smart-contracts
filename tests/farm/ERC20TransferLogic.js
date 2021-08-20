const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");
const { etherMantissa, mineBlock, advanceBlocks } = require("../Utils/Ethereum");

const { ZERO_ADDRESS } = constants;
const TOTAL_SUPPLY = etherMantissa(1000000000);

const TestToken = artifacts.require("TestToken");
const ERC20TransferLogic = artifacts.require("ERC20TransferLogic");

describe("ERC20TransferLogic", () => {
	// The % which determines how much will be unlocked immediately.
	/// @dev 10000 is 100%
	const unlockedImmediatelyPercent = new BN(1000); //10%

	let accounts;
	let root, account1, account2, account3, account4;
	let token1, token2, token3;
	let transferLogic;

	before(async () => {
		accounts = await web3.eth.getAccounts();
		[root, account1, account2, account3, account4, ...accounts] = accounts;
	});

	beforeEach(async () => {
		token1 = await TestToken.new("Test token 1", "TST-1", 18, TOTAL_SUPPLY);
		token2 = await TestToken.new("Test token 2", "TST-2", 18, TOTAL_SUPPLY);
		token3 = await TestToken.new("Test token 3", "TST-3", 18, TOTAL_SUPPLY);

		transferLogic = await ERC20TransferLogic.new();
		await transferLogic.initialize(token1.address);
	});

	describe("initialize", () => {
		it("fails if not an owner or admin", async () => {
			transferLogic = await ERC20TransferLogic.new();
			await expectRevert(transferLogic.initialize(token1.address, { from: account1 }), "unauthorized");

			await transferLogic.addAdmin(account1);
			await transferLogic.initialize(token1.address, { from: account1 });
		});

		it("sets the expected values", async () => {
			transferLogic = await ERC20TransferLogic.new();
			await transferLogic.initialize(token1.address);
			let _tokenAddress = await transferLogic.token();
			expect(_tokenAddress).equal(token1.address);
		});
	});

	describe("setTokenAddress", () => {
		it("fails if not an owner or admin", async () => {
			await expectRevert(transferLogic.setTokenAddress(token1.address, { from: account1 }), "unauthorized");

			await transferLogic.addAdmin(account1);
			await transferLogic.setTokenAddress(token1.address, { from: account1 });
		});

		it("fails if invalid address", async () => {
			await expectRevert(transferLogic.setTokenAddress(ZERO_ADDRESS), "Invalid token address");
		});

		it("should set a new token address", async () => {
			//first check original token address
			let oldTokenAddress = await transferLogic.token();
			expect(oldTokenAddress).equal(token1.address);

			//then check new token addres
			tx = await transferLogic.setTokenAddress(token2.address);
			let newTokenAddress = await transferLogic.token();
			expect(newTokenAddress).equal(token2.address);

			expectEvent(tx, "TokenAddressUpdated", {
				_newTokenAddress: newTokenAddress,
			});
		});
	});
});
