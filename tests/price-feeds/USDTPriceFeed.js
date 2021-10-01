/** Speed optimized on branch hardhatTestRefactor, 2021-10-01
 * No bottlenecks found. No beforeEach hook, and flow is very simple.
 *   There is just one deployment for USDTPriceFeed contract.
 *
 * Total time elapsed: 3.7s
 */

const { expect } = require("chai");
const { BN } = require("@openzeppelin/test-helpers");

const USDTPriceFeed = artifacts.require("USDTPriceFeed");

contract("USDTPriceFeed", (accounts) => {
	let priceFeed;
	before(async () => {
		priceFeed = await USDTPriceFeed.new();
	});
	describe("USDTPriceFeed unit tests", async () => {
		it("Exchange rate USDT/USDT should be 1", async () => {
			await expect(await priceFeed.latestAnswer()).to.be.bignumber.equal(new BN(10).pow(new BN(18)));
		});

		it("Returns current block timestamp", async () => {
			let block = await web3.eth.getBlock("latest");
			await expect(await priceFeed.latestTimestamp()).to.be.bignumber.equal(new BN(block.timestamp));
		});
	});
});
