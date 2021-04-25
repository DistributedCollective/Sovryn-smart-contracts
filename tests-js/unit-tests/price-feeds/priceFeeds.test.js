const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN, balance, time } = require("@openzeppelin/test-helpers");

const USDTPriceFeed = artifacts.require("USDTPriceFeed");
const PriceFeeds = artifacts.require("PriceFeeds");
const PriceFeedsMock = artifacts.require("PriceFeedsMock");

const { getSUSD, getRBTC, getWRBTC, getBZRX, getSovryn, getPriceFeeds, getTestToken } = require("../../Utils/initializer.js");
const wei = web3.utils.toWei;

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

contract("PriceFeeds", (accounts) => {
	let sovryn, SUSD, WRBTC, RBTC, BZRX, priceFeeds, testTokens;
	let priceFeedsMock;
	/*before(async () => {
		//priceFeedsMock = await PriceFeedsMock.new(WRBTC.address, BZRX.address, SUSD.address);
	});*/
	before(async () => {
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, sovryn, BZRX);
		priceFeedsMock = await PriceFeedsMock.new(
			WRBTC.address,
			BZRX.address,
			SUSD.address,
			wei("30", "ether"), //mock rate
			wei("100", "ether") //mock precision
		);
		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
		//swapsImpl = await SwapsImplSovrynSwap.new();
	});

	describe("PriceFeed unit tests", async () => {
		it("amountInEth for wRBTC token should return passes amount", async () => {
			const wrbtcToken = await priceFeeds.wrbtcToken();
			await expect(await priceFeeds.amountInEth(wrbtcToken, new BN(wei("100", "ether")))).to.be.bignumber.equal(
				new BN(wei("100", "ether"))
			);
		});

		it("getMaxDrawdown collateral token == loan token", async () => {
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

		it("getMaxDrawdown collateral token == loan token", async () => {
			await expect(
				await priceFeeds.getMaxDrawdown(
					accounts[9],
					accounts[9],
					new BN(wei("100", "ether")),
					new BN(wei("150", "ether")),
					new BN(20).mul(new BN(10).pow(new BN(18)))
				)
			).to.be.bignumber.equal(new BN(wei("30", "ether")));
			await expect(
				await priceFeeds.getMaxDrawdown(
					accounts[9],
					accounts[9],
					new BN(wei("100", "ether")),
					new BN(wei("0", "ether")),
					new BN(20).mul(new BN(10).pow(new BN(18)))
				)
			).to.be.bignumber.equal(new BN(0));
		});

		it("getMaxDrawdown collateral token != loan token", async () => {
			await await expect(
				await priceFeedsMock.getMaxDrawdown(
					accounts[9], //mock loan token address
					accounts[10], //mock collateral token address
					new BN(wei("100", "ether")), //loan token amount
					new BN(wei("150", "ether")), //collateral token amount
					new BN(20).mul(new BN(10).pow(new BN(18)))
				)
			).to.be.bignumber.equal(new BN(wei("114", "ether")));
			await expect(
				await priceFeedsMock.getMaxDrawdown(
					accounts[9],
					accounts[10],
					new BN(wei("100", "ether")),
					new BN(wei("30", "ether")), // <36
					new BN(20).mul(new BN(wei("1", "ether")))
				)
			).to.be.bignumber.equal(new BN(0));
		});

		it("getCurrentMargin collateralToken == loanToken", async () => {
			let ret = await priceFeedsMock.getCurrentMargin(
				accounts[9], //mock loan token address
				accounts[9], //mock collateral token address
				new BN(wei("100", "ether")), //loan token amount
				new BN(wei("150", "ether")) //collateral token amount
			);
			await expect(ret[0]).to.be.bignumber.equal(new BN(wei("50", "ether")));
			await expect(ret[1]).to.be.bignumber.equal(new BN(wei("1", "ether")));

			ret = await priceFeedsMock.getCurrentMargin(
				accounts[9], //mock loan token address
				accounts[9], //mock collateral token address
				new BN(wei("100", "ether")), //loan token amount
				new BN(wei("30", "ether")) //collateral token amount
			);
			await expect(ret[0]).to.be.bignumber.equal(new BN(0));
			await expect(ret[1]).to.be.bignumber.equal(new BN(wei("1", "ether")));

			ret = await priceFeedsMock.getCurrentMargin(
				accounts[9], //mock loan token address
				accounts[9], //mock collateral token address
				new BN(wei("0", "ether")), //loan token amount
				new BN(wei("30", "ether")) //collateral token amount
			);
			await expect(ret[0]).to.be.bignumber.equal(new BN(0));
			await expect(ret[1]).to.be.bignumber.equal(new BN(wei("1", "ether")));
		});
		it("shouldLiquidate(...) runs correctly", async () => {
			//30% margin initialized
			let ret = await priceFeedsMock.shouldLiquidate(
				accounts[9], //mock loan token address
				accounts[9], //mock collateral token address
				new BN(wei("100", "ether")), //loan token amount
				new BN(wei("150", "ether")), //collateral token amount
				new BN(10).mul(new BN(wei("1", "ether"))) //maintenance margin threshold 10%
			);
			expect(ret).to.be.false; //50>10
			/*
			ret = await priceFeedsMock.getCurrentMargin(
				accounts[9], //mock loan token address
				accounts[9], //mock collateral token address
				new BN(wei("100", "ether")), //loan token amount
				new BN(wei("150", "ether")) //collateral token amount
			);
			console.log(ret[0].div(new BN(wei("1", "ether"))).toString());
			ret = await priceFeedsMock.getCurrentMargin(
				accounts[9], //mock loan token address
				accounts[10], //mock collateral token address
				new BN(wei("100", "ether")), //loan token amount
				new BN(wei("450", "ether")) //collateral token amount
			);
			console.log(ret[0].div(new BN(wei("1", "ether"))).toString());
*/
			ret = await priceFeedsMock.shouldLiquidate(
				accounts[9], //mock loan token address
				accounts[10], //mock collateral token address
				new BN(wei("100", "ether")), //loan token amount
				new BN(wei("450", "ether")), //collateral token amount
				new BN(30).mul(new BN(wei("1", "ether"))) //maintenance margin
			);
			expect(ret).to.be.false; //30<35

			ret = await priceFeedsMock.shouldLiquidate(
				accounts[9], //mock loan token address
				accounts[10], //mock collateral token address
				new BN(wei("100", "ether")), //loan token amount
				new BN(wei("450", "ether")), //collateral token amount
				new BN(40).mul(new BN(wei("1", "ether"))) //maintenance margin
			);
			expect(ret).to.be.true; //40>35
		});
		it("setProtocolTokenEthPrice runs correctly", async () => {
			expect(await priceFeeds.protocolTokenEthPrice()).to.be.bignumber.equal(new BN(2).mul(new BN(10).pow(new BN(14))));

			await priceFeeds.setProtocolTokenEthPrice(wei("10", "ether"));
			expect(await priceFeeds.protocolTokenEthPrice()).to.be.bignumber.equal(new BN(wei("10", "ether")));

			await expectRevert(priceFeeds.setProtocolTokenEthPrice(new BN(0)), "invalid price");
			await expectRevert(priceFeeds.setProtocolTokenEthPrice(wei("10", "ether"), { from: accounts[10] }), "unauthorized");
		});
		it("setGlobalPricingPaused", async () => {
			let isPaused = await priceFeeds.globalPricingPaused();
			await priceFeeds.setGlobalPricingPaused(true);
			expect(await priceFeeds.globalPricingPaused()).to.not.equal(isPaused);
			await priceFeeds.setGlobalPricingPaused(false);
			expect(await priceFeeds.globalPricingPaused()).to.equal(isPaused);
		});
		it("setDecimals", async () => {
			testTokens = [];
			let decimals = [];
			for (let i = 0; i < 3; i++) {
				decimals[i] = Math.round(Math.random() * 10 + 8);
				testTokens[i] = await getTestToken({ decimals: decimals[i] });
			}
			await priceFeeds.setDecimals(testTokens.map((item) => item.address));
			for (i = 0; i < 3; i++) {
				expect((await priceFeeds.decimals(await testTokens[i].address)).toNumber()).to.be.eq(decimals[i]);
			}
		});

		it("_queryRate internal", async () => {
			testTokens = [];
			let decimals = [];
			let addresses = [];
			for (let i = 0; i < 2; i++) {
				decimals[i] = (i + 1) * 10 + i;
				testTokens[i] = await getTestToken({ decimals: decimals[i] });
				addresses[i] = testTokens[i].address;
			}
			expect(await priceFeeds.queryPrecision(addresses[0], addresses[0])).to.be.bignumber.equal(new BN(wei("1", "ether")));
			expect(await priceFeeds.queryPrecision(addresses[1], addresses[1])).to.be.bignumber.equal(new BN(wei("1", "ether")));
			//source decimals > dest decimals
			expect(await priceFeeds.queryPrecision(addresses[1], addresses[0])).to.be.bignumber.equal(new BN(10).pow(new BN(29))); //10^7 (18+diff)
			//source decimals < dest decimals
			expect(await priceFeeds.queryPrecision(addresses[0], addresses[1])).to.be.bignumber.equal(new BN(10).pow(new BN(7))); //10^29 (18-diff)
		});
	});
});
