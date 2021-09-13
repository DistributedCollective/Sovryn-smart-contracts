const { expect } = require("chai");
const { BN, constants, expectRevert } = require("@openzeppelin/test-helpers");
const { deployMockContract } = waffle;

const PriceFeeds = artifacts.require("PriceFeeds");
const PriceFeedV1PoolOracle = artifacts.require("PriceFeedV1PoolOracle");
const LiquidityPoolV1ConverterMockup = artifacts.require("LiquidityPoolV1ConverterMockup");
const sovrynProtocol = artifacts.require("sovrynProtocol");
const SOV = artifacts.require("SOV");
const ISovryn = artifacts.require("ISovryn");
const IV1PoolOracle = artifacts.require("IV1PoolOracle");

const LoanTokenLogicLM = artifacts.require("LoanTokenLogicLM");
const LoanToken = artifacts.require("LoanToken");

const TestToken = artifacts.require("TestToken");
const TestWrbtc = artifacts.require("TestWrbtc");

const PriceFeedRSKOracle = artifacts.require("PriceFeedRSKOracle");
const PriceFeedRSKOracleMockup = artifacts.require("PriceFeedRSKOracleMockup");

const TOTAL_SUPPLY = "10000000000000000000000000";

contract("PriceFeedOracleV1Pool", (accounts) => {
	let loanTokenLogic;
	let testWrbtc;
	let doc;
	let tokenSOV;
	let sovryn;
	let testToken1;
	let wei = web3.utils.toWei;
	let senderMock;
	let priceFeedsV1PoolOracleTestToken1;
	before(async () => {
		[owner, trader, referrer, account1, account2, ...accounts] = accounts;
	});
	beforeEach(async () => {
		const provider = waffle.provider;
		[senderMock] = provider.getWallets();

		// Deploying sovrynProtocol
		const sovrynproxy = await sovrynProtocol.new();
		sovryn = await ISovryn.at(sovrynproxy.address);

		loanTokenLogic = await LoanTokenLogicLM.new();
		testWrbtc = await TestWrbtc.new();
		doc = await TestToken.new("dollar on chain", "DOC", 18, wei("20000", "ether"));
		tokenSOV = await SOV.new(TOTAL_SUPPLY);
		loanToken = await LoanToken.new(owner, loanTokenLogic.address, sovryn.address, testWrbtc.address);
		await loanToken.initialize(doc.address, "SUSD", "SUSD");

		feeds = await PriceFeeds.new(testWrbtc.address, tokenSOV.address, doc.address);
		testToken1Precision = 18;
		testToken2Precision = 18;
		btcPrecision = 18;
		testToken1 = await TestToken.new("test token 1", "TEST1", testToken1Precision, wei("20000", "ether"));
		testToken1Price = wei("2", "ether");

		// Set v1 convert mockup
		liquidityV1ConverterMockupTestToken1 = await LiquidityPoolV1ConverterMockup.new(testToken1.address, testWrbtc.address);

		priceFeedsV1PoolOracleMockupTestToken1 = await deployMockContract(senderMock, IV1PoolOracle.abi);
		await priceFeedsV1PoolOracleMockupTestToken1.mock.latestAnswer.returns(testToken1Price);
		await priceFeedsV1PoolOracleMockupTestToken1.mock.latestPrice.returns(testToken1Price);
		await priceFeedsV1PoolOracleMockupTestToken1.mock.liquidityPool.returns(liquidityV1ConverterMockupTestToken1.address);

		priceFeedsV1PoolOracleTestToken1 = await PriceFeedV1PoolOracle.new(
			priceFeedsV1PoolOracleMockupTestToken1.address,
			testWrbtc.address,
			doc.address,
			testToken1.address
		);
	});

	describe("PriceFeedOracleV1Pool unit tests", async () => {
		it("set base currency should revert if set with zero address", async () => {
			await expectRevert(
				priceFeedsV1PoolOracleTestToken1.setBaseCurrency(constants.ZERO_ADDRESS),
				"Base currency address cannot be zero address"
			);
		});

		it("set base currency should revert if set with unauthorized user", async () => {
			await expectRevert(priceFeedsV1PoolOracleTestToken1.setBaseCurrency(sovryn.address, { from: accounts[2] }), "unauthorized");
		});

		it("set base currency success", async () => {
			await priceFeedsV1PoolOracleTestToken1.setBaseCurrency(sovryn.address);
			expect(await priceFeedsV1PoolOracleTestToken1.baseCurrency()).to.be.equal(sovryn.address);
		});

		it("set doc address should revert if set with zero address", async () => {
			await expectRevert(
				priceFeedsV1PoolOracleTestToken1.setDOCAddress(constants.ZERO_ADDRESS),
				"DOC address cannot be zero address"
			);
		});

		it("set doc address should revert if set with unauthorized user", async () => {
			await expectRevert(priceFeedsV1PoolOracleTestToken1.setDOCAddress(sovryn.address, { from: accounts[2] }), "unauthorized");
		});

		it("set doc address success", async () => {
			await priceFeedsV1PoolOracleTestToken1.setDOCAddress(sovryn.address);
			expect(await priceFeedsV1PoolOracleTestToken1.docAddress()).to.be.equal(sovryn.address);
		});

		it("set wRBTC address should revert if set with zero address", async () => {
			await expectRevert(
				priceFeedsV1PoolOracleTestToken1.setRBTCAddress(constants.ZERO_ADDRESS),
				"wRBTC address cannot be zero address"
			);
		});

		it("set wRBTC address should revert if set with unauthorized user", async () => {
			await expectRevert(priceFeedsV1PoolOracleTestToken1.setRBTCAddress(sovryn.address, { from: accounts[2] }), "unauthorized");
		});

		it("set wRBTC address success", async () => {
			await priceFeedsV1PoolOracleTestToken1.setRBTCAddress(sovryn.address);
			expect(await priceFeedsV1PoolOracleTestToken1.wRBTCAddress()).to.be.equal(sovryn.address);
		});

		it("set v1PoolOracleAddress should revert if set with non-contract address", async () => {
			await expectRevert(
				priceFeedsV1PoolOracleTestToken1.setV1PoolOracleAddress(constants.ZERO_ADDRESS),
				"_v1PoolOracleAddress not a contract"
			);
		});

		it("set v1PoolOracleAddress should revert if set with unauthorized user", async () => {
			await expectRevert(
				priceFeedsV1PoolOracleTestToken1.setV1PoolOracleAddress(sovryn.address, { from: accounts[2] }),
				"unauthorized"
			);
		});

		it("set v1PoolOracleAddress address should revert if one of the reserve tokens is wrbtc address", async () => {
			liquidityV1ConverterMockupBTC = await LiquidityPoolV1ConverterMockup.new(testToken1.address, tokenSOV.address);
			priceFeedsV1PoolOracleMockupTestToken2 = await deployMockContract(senderMock, IV1PoolOracle.abi);
			await priceFeedsV1PoolOracleMockupTestToken2.mock.latestAnswer.returns(testToken1Price);
			await priceFeedsV1PoolOracleMockupTestToken2.mock.latestPrice.returns(testToken1Price);
			await priceFeedsV1PoolOracleMockupTestToken2.mock.liquidityPool.returns(liquidityV1ConverterMockupBTC.address);

			await expectRevert(
				priceFeedsV1PoolOracleTestToken1.setV1PoolOracleAddress(priceFeedsV1PoolOracleMockupTestToken2.address),
				"one of the two reserves needs to be wrbtc"
			);
		});

		it("set v1PoolOracleAddress address success", async () => {
			priceFeedsV1PoolOracleMockupTestToken2 = await deployMockContract(senderMock, IV1PoolOracle.abi);
			await priceFeedsV1PoolOracleMockupTestToken2.mock.latestAnswer.returns(testToken1Price);
			await priceFeedsV1PoolOracleMockupTestToken2.mock.latestPrice.returns(testToken1Price);
			await priceFeedsV1PoolOracleMockupTestToken2.mock.liquidityPool.returns(liquidityV1ConverterMockupTestToken1.address);

			await priceFeedsV1PoolOracleTestToken1.setV1PoolOracleAddress(priceFeedsV1PoolOracleMockupTestToken2.address);
			expect(await priceFeedsV1PoolOracleTestToken1.v1PoolOracleAddress()).to.be.equal(
				priceFeedsV1PoolOracleMockupTestToken2.address
			);
		});

		it("Should revert if price in usd is 0", async () => {
			const wrBTCPrice = wei("8", "ether");
			const docPrice = wei("7", "ether");
			const testToken2 = await TestToken.new("test token 2", "TEST2", testToken2Precision, wei("20000", "ether"));
			priceFeedsV1PoolOracleMockupTestToken2 = await deployMockContract(senderMock, IV1PoolOracle.abi);
			await priceFeedsV1PoolOracleMockupTestToken2.mock.latestAnswer.returns(0);
			await priceFeedsV1PoolOracleMockupTestToken2.mock.latestPrice.returns(0);
			await priceFeedsV1PoolOracleMockupTestToken2.mock.liquidityPool.returns(liquidityV1ConverterMockupTestToken1.address);

			priceFeedsV1PoolOracleTestToken2 = await PriceFeedV1PoolOracle.new(
				priceFeedsV1PoolOracleMockupTestToken2.address,
				testWrbtc.address,
				doc.address,
				testToken2.address
			);

			// // Set rBTC feed - using rsk oracle
			priceFeedsV1PoolOracleMockupBTC = await PriceFeedRSKOracleMockup.new();
			await priceFeedsV1PoolOracleMockupBTC.setValue(wrBTCPrice);
			priceFeedsV1PoolOracleBTC = await PriceFeedRSKOracle.new(priceFeedsV1PoolOracleMockupBTC.address);

			// Set DOC feed -- price 1 BTC
			liquidityV1ConverterMockupDOC = await LiquidityPoolV1ConverterMockup.new(doc.address, testWrbtc.address);

			priceFeedsV1PoolOracleMockupDOC = await deployMockContract(senderMock, IV1PoolOracle.abi);
			await priceFeedsV1PoolOracleMockupDOC.mock.latestAnswer.returns(docPrice);
			await priceFeedsV1PoolOracleMockupDOC.mock.latestPrice.returns(docPrice);
			await priceFeedsV1PoolOracleMockupDOC.mock.liquidityPool.returns(liquidityV1ConverterMockupDOC.address);

			priceFeedsV1PoolOracleDOC = await PriceFeedV1PoolOracle.new(
				priceFeedsV1PoolOracleMockupDOC.address,
				testWrbtc.address,
				doc.address,
				doc.address
			);

			// await feeds.setPriceFeed([testWrbtc.address, doc.address], [priceFeedsV1PoolOracle.address, priceFeedsV1PoolOracle.address])
			await feeds.setPriceFeed(
				[testToken2.address, doc.address, testWrbtc.address],
				[priceFeedsV1PoolOracleTestToken2.address, priceFeedsV1PoolOracleDOC.address, priceFeedsV1PoolOracleBTC.address]
			);

			await expectRevert(feeds.queryRate(testToken2.address, doc.address), "price error");
		});
	});
});
