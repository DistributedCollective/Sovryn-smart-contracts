/** Speed optimized on branch hardhatTestRefactor, 2021-10-04
 * Small bottleneck found redeploying token on every test.
 *
 * Total time elapsed: 3.8s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   The test "does not mint tokens if initial amount is zero" makes no sense
 *   because mint is still possible even though initial supply is zero. So, it's
 *   been updated to "zero token balance if initial amount is zero"
 *
 *   Token test have been improved by adding some additional checks.
 */

const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;

const { BN, expectRevert, constants } = require("@openzeppelin/test-helpers");

const SOV = artifacts.require("SOV");

// Some constants we would be using in the contract.
const TOTAL_SUPPLY = new BN(10).pow(new BN(25));
const ZERO = new BN(0);
const zeroAddress = constants.ZERO_ADDRESS;

const NAME = "Sovryn Token";
const SYMBOL = "SOV";
const DECIMALS = 18;

contract("SOV:", (accounts) => {
	let root, account1, account2;
	let tokenSOV;
	let amount, beforeBalance1;

	async function deploymentAndInitFixture(_wallets, _provider) {
		tokenSOV = await SOV.new(TOTAL_SUPPLY);

		// Initial transfer to account 1
		amount = 1000;
		beforeBalance1 = await tokenSOV.balanceOf.call(account1);
		await tokenSOV.mint(account1, amount);
	}

	before(async () => {
		[root, account1, account2, ...accounts] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("constructor:", () => {
		it("checks the deployment values", async () => {
			expect(await tokenSOV.name.call()).to.be.equal(NAME);
			expect(await tokenSOV.symbol.call()).to.be.equal(SYMBOL);
			expect(await tokenSOV.decimals.call()).to.be.bignumber.equal(new BN(DECIMALS));

			// Check whether deployer's token balance is equal to total supply.
			expect(await tokenSOV.balanceOf.call(root)).to.be.bignumber.equal(TOTAL_SUPPLY);

			// Token contract balance is always zero
			let balance = await tokenSOV.balanceOf.call(tokenSOV.address);
			expect(balance.toNumber()).to.be.equal(0);
		});

		it("zero token balance if initial amount is zero", async () => {
			// Redeployment w/ zero initial supply.
			let tokenSOV = await SOV.new(ZERO);

			// Check whether deployer's token balance is zero.
			expect(await tokenSOV.balanceOf.call(root)).to.be.bignumber.equal(ZERO);

			// Even though initial supply is zero, it is possible to mint new tokens w/o reverting.
			await tokenSOV.mint(account1, amount);

			// Check mint has been effective, account1 holds the tokens.
			expect(await tokenSOV.balanceOf.call(account1)).to.be.bignumber.equal(new BN(amount));
		});
	});

	describe("mint:", () => {
		it("should be able to mint SOV tokens", async () => {
			let afterBalance1 = await tokenSOV.balanceOf.call(account1);
			expect(afterBalance1.sub(beforeBalance1).toNumber()).to.be.equal(amount);
		});

		it("revert if mint on behalf of zero address", async () => {
			await expectRevert(tokenSOV.mint(zeroAddress, amount), "revert ERC20: mint to the zero address");
		});
	});

	describe("transfer:", () => {
		it("should be able to transfer SOV tokens", async () => {
			let afterBalance1 = await tokenSOV.balanceOf.call(account1);
			expect(afterBalance1.sub(beforeBalance1).toNumber()).to.be.equal(amount);

			// Transfer whole amount to account2
			let beforeBalance2 = await tokenSOV.balanceOf.call(account2);
			await tokenSOV.transfer(account2, amount, { from: account1 });
			let afterBalance2 = await tokenSOV.balanceOf.call(account2);
			expect(afterBalance2.sub(beforeBalance2).toNumber()).to.be.equal(amount);
		});

		it("shouldn't be able to transfer more SOV tokens than available on balance", async () => {
			// Try to transfer double amount to account2
			await expectRevert(
				tokenSOV.transfer(account2, amount * 2, { from: account1 }),
				"revert ERC20: transfer amount exceeds balance"
			);
		});

		it("shouldn't be able to transfer SOV tokens to zero address", async () => {
			// Try to transfer amount to zero address
			await expectRevert(tokenSOV.transfer(zeroAddress, amount, { from: account1 }), "revert ERC20: transfer to the zero address");
		});

		// it("shouldn't be able to transfer SOV tokens from zero address", async () => {
		// 	// Try to transfer amount from zero address
		// 	await expectRevert(tokenSOV.transfer(account2, amount, { from: zeroAddress }), "revert ERC20: transfer from the zero address");
		// });
	});
});
