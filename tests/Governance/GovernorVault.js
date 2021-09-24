/** Speed optimized on branch hardhatTestRefactor, 2021-09-23
 * Bottlenecks found at beforeEach hook, redeploying token,
 *  and governor on each test.
 *
 * Total time elapsed: 4.3s
 * After optimization: 4.0s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");

const TestToken = artifacts.require("TestToken");
const GovernorVault = artifacts.require("GovernorVault");

const TOTAL_SUPPLY = "10000000000000000000000000";
const ZERO_ADDRESS = constants.ZERO_ADDRESS;

contract("TeamVesting", (accounts) => {
	const name = "Test token";
	const symbol = "TST";

	let root, account1, account2, account3;
	let token;
	let vault;

	async function deploymentAndInitFixture(_wallets, _provider) {
		token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

		vault = await GovernorVault.new(token.address);
	}

	before(async () => {
		[root, account1, account2, account3, ...accounts] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("transferTokens", () => {
		it("Should be able to transfer tokens", async () => {
			let amount = "1000";
			await token.transfer(vault.address, amount);

			let balance = await token.balanceOf.call(vault.address);
			expect(balance.toString()).to.be.equal(amount);

			let tx = await vault.transferTokens(account1, token.address, amount);

			balance = await token.balanceOf.call(vault.address);
			expect(balance.toString()).to.be.equal("0");
			let receiverBalance = await token.balanceOf.call(account1);
			expect(receiverBalance.toString()).to.be.equal(amount);

			expectEvent(tx, "TokensTransferred", {
				receiver: account1,
				amount: amount,
			});
		});

		it("fails if the sender is not an owner", async () => {
			await expectRevert(vault.transferTokens(account1, token.address, 100, { from: account1 }), "unauthorized");
		});

		it("fails if the 0 receiver address is passed", async () => {
			await expectRevert(vault.transferTokens(ZERO_ADDRESS, token.address, 100), "Invalid receiver address");
		});

		it("fails if the 0 token address is passed", async () => {
			await expectRevert(vault.transferTokens(account1, ZERO_ADDRESS, 100), "Invalid token address");
		});

		it("fails if wrong token address", async () => {
			await token.transfer(vault.address, 100);

			await expectRevert(vault.transferTokens(token.address, account1, 100), "revert");
		});

		it("fails if amount passed is not available", async () => {
			await expectRevert(vault.transferTokens(account1, token.address, 100), "invalid transfer");
		});
	});

	describe("transferRbtc", () => {
		it("Should be able to transfer tokens", async () => {
			let amount = "1000";
			let tx = await vault.sendTransaction({ from: root, value: amount });

			expectEvent(tx, "Deposited", {
				sender: root,
				amount: amount,
			});

			let balance = await web3.eth.getBalance(vault.address);
			expect(balance.toString()).to.be.equal(amount);

			let receiverBalanceBefore = await web3.eth.getBalance(account1);
			tx = await vault.transferRbtc(account1, amount);

			balance = await web3.eth.getBalance(vault.address);
			expect(balance.toString()).to.be.equal("0");

			let receiverBalanceAfter = await web3.eth.getBalance(account1);
			expect(new BN(receiverBalanceAfter).sub(new BN(receiverBalanceBefore)).toString()).to.be.equal(amount);

			expectEvent(tx, "RbtcTransferred", {
				receiver: account1,
				amount: amount,
			});
		});

		it("fails if the sender is not an owner", async () => {
			await expectRevert(vault.transferRbtc(account1, 100, { from: account1 }), "unauthorized");
		});

		it("fails if the 0 address is passed", async () => {
			await expectRevert(vault.transferRbtc(ZERO_ADDRESS, 100), "Invalid receiver address");
		});

		it("fails if amount passed is not available", async () => {
			await expectRevert(vault.transferRbtc(account1, 100), "revert");
		});
	});
});
