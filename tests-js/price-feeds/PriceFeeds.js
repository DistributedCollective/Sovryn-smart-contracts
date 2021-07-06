const { ethers, waffle } = require("hardhat");
const { expect } = require("chai");
const { expectRevert, BN } = require("@openzeppelin/test-helpers");
const {ContractFactory, utils} = require('ethers');

const PriceFeeds = require("../../artifacts/contracts/feeds/PriceFeeds.sol/PriceFeeds.json");

const { getSUSD, getRBTC, getWRBTC, getBZRX, getSovryn, getPriceFeeds, getTestToken } = require("../Utils/initializer.js");
const wei = web3.utils.toWei;

contract("PriceFeeds", (accounts) => {
	let SUSD, WRBTC, BZRX, testTokens;
	let priceFeeds, priceFeedsMock, sovryn;
	let sender, receiver;

	describe("PriceFeed unit tests", async () => {
		beforeEach(async () => {
			[sender, receiver] = await ethers.getSigners();
			SUSD = await getSUSD();
			RBTC = await getRBTC();
			WRBTC = await getWRBTC();
			BZRX = await getBZRX();
			priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, sovryn, BZRX);
			sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
			priceFeedsMock = await waffle.deployMockContract(sender, PriceFeeds.abi);
			await priceFeedsMock.mock.queryRate.withArgs(
				accounts[9],
				accounts[10]
			).returns(30, 100);
		});

		it("amountInEth for wRBTC token should return passes amount", async () => {
			const wrbtcToken = await priceFeeds.wrbtcToken();
			await expect(await priceFeeds.amountInEth(wrbtcToken, new BN(wei("100", "ether")))).to.be.bignumber.equal(
				new BN(wei("100", "ether"))
			);
		});

		it("getMaxDrawdown collateral token == loan token & comibed > collateral", async () => {
			await expect(
				await priceFeeds.getMaxDrawdown(
					accounts[9],
					accounts[9],
					new BN(wei("100", "ether")),
					new BN(wei("100", "ether")),
					new BN(20).mul(new BN(10).pow(new BN(18)))
				)
			).to.be.bignumber.equal(new BN(0));
		});

		it("getMaxDrawdown collateral token == loan token & collateral > combined", async () => {
			await expect(
				await priceFeeds.getMaxDrawdown(
					accounts[9],
					accounts[9],
					new BN(wei("100", "ether")),
					new BN(wei("150", "ether")),
					new BN(20).mul(new BN(10).pow(new BN(18)))
				)
			).to.be.bignumber.equal(new BN(wei("30", "ether")));
		});

		it.only("getMaxDrawdown collateral token != loan token", async () => {
			await expect(
				await priceFeeds.getMaxDrawdown(
					accounts[9], //mock loan token address
					accounts[10], //mock collateral token address
					utils.parseEther('100'), //loan token amount
					utils.parseEther('150'), //collateral token amount
					utils.parseEther('20')
				)
			).to.be.bignumber.equal(new BN(wei("114", "ether")));
		});
	});
});
