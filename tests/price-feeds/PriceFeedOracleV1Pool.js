/** Speed optimized on branch hardhatTestRefactor, 2021-09-30
 * Bottlenecks found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 8.0s
 * After optimization: 5.7s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Updated to use the initializer.js functions for protocol deployment.
 *   Updated to use WRBTC as collateral token, instead of custom testWRBTC token.
 *   Updated to use SUSD as underlying token, instead of custom underlyingToken.
 */

const { expect } = require("chai");
const { constants, expectRevert } = require("@openzeppelin/test-helpers");
const { waffle } = require("hardhat");
const { deployMockContract, loadFixture } = waffle;

const PriceFeeds = artifacts.require("PriceFeeds");
const PriceFeedV1PoolOracle = artifacts.require("PriceFeedV1PoolOracle");
const LiquidityPoolV1ConverterMockup = artifacts.require("LiquidityPoolV1ConverterMockup");
const IV1PoolOracle = artifacts.require("IV1PoolOracle");

const LoanTokenLogicLM = artifacts.require("LoanTokenLogicLM");
const LoanToken = artifacts.require("LoanToken");

const TestToken = artifacts.require("TestToken");

const PriceFeedRSKOracle = artifacts.require("PriceFeedRSKOracle");
const PriceFeedRSKOracleMockup = artifacts.require("PriceFeedRSKOracleMockup");

const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getLoanTokenLogic,
    getLoanToken,
    getLoanTokenLogicWrbtc,
    getLoanTokenWRBTC,
    loan_pool_setup,
    set_demand_curve,
    getPriceFeeds,
    getSovryn,
    decodeLogs,
    getSOV,
} = require("../Utils/initializer.js");

contract("PriceFeedOracleV1Pool", (accounts) => {
    let loanTokenLogic;
    let WRBTC;
    let doc;
    let SOV;
    let sovryn;
    let testToken1;
    let wei = web3.utils.toWei;
    let senderMock;
    let priceFeedsV1PoolOracleTestToken1;

    async function deploymentAndInitFixture(_wallets, _provider) {
        const provider = waffle.provider;
        [senderMock] = provider.getWallets();

        // Deploying sovrynProtocol w/ generic function from initializer.js
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        await sovryn.setSovrynProtocolAddress(sovryn.address);

        // Custom tokens
        SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);

        loanTokenLogic = await LoanTokenLogicLM.new();
        doc = await TestToken.new("dollar on chain", "DOC", 18, wei("20000", "ether"));
        loanToken = await LoanToken.new(
            owner,
            loanTokenLogic.address,
            sovryn.address,
            WRBTC.address
        );
        await loanToken.initialize(doc.address, "SUSD", "SUSD");

        // Overwritting priceFeeds
        priceFeeds = await PriceFeeds.new(WRBTC.address, SOV.address, doc.address);
        testToken1Precision = 18;
        testToken2Precision = 18;
        btcPrecision = 18;
        testToken1 = await TestToken.new(
            "test token 1",
            "TEST1",
            testToken1Precision,
            wei("20000", "ether")
        );
        testToken1Price = wei("2", "ether");

        // Set v1 convert mockup
        liquidityV1ConverterMockupTestToken1 = await LiquidityPoolV1ConverterMockup.new(
            testToken1.address,
            WRBTC.address
        );

        priceFeedsV1PoolOracleMockupTestToken1 = await deployMockContract(
            senderMock,
            IV1PoolOracle.abi
        );
        await priceFeedsV1PoolOracleMockupTestToken1.mock.latestAnswer.returns(testToken1Price);
        await priceFeedsV1PoolOracleMockupTestToken1.mock.latestPrice.returns(testToken1Price);
        await priceFeedsV1PoolOracleMockupTestToken1.mock.liquidityPool.returns(
            liquidityV1ConverterMockupTestToken1.address
        );

        priceFeedsV1PoolOracleTestToken1 = await PriceFeedV1PoolOracle.new(
            priceFeedsV1PoolOracleMockupTestToken1.address,
            WRBTC.address,
            doc.address,
            testToken1.address
        );
    }

    before(async () => {
        [owner, trader, referrer, account1, account2, ...accounts] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    describe("PriceFeedOracleV1Pool unit tests", async () => {
        it("set base currency should revert if set with zero address", async () => {
            await expectRevert(
                priceFeedsV1PoolOracleTestToken1.setBaseCurrency(constants.ZERO_ADDRESS),
                "Base currency address cannot be zero address"
            );
        });

        it("set base currency should revert if set with unauthorized user", async () => {
            await expectRevert(
                priceFeedsV1PoolOracleTestToken1.setBaseCurrency(sovryn.address, {
                    from: accounts[2],
                }),
                "unauthorized"
            );
        });

        it("set base currency success", async () => {
            await priceFeedsV1PoolOracleTestToken1.setBaseCurrency(sovryn.address);
            expect(await priceFeedsV1PoolOracleTestToken1.baseCurrency()).to.be.equal(
                sovryn.address
            );
        });

        it("set doc address should revert if set with zero address", async () => {
            await expectRevert(
                priceFeedsV1PoolOracleTestToken1.setDOCAddress(constants.ZERO_ADDRESS),
                "DOC address cannot be zero address"
            );
        });

        it("set doc address should revert if set with unauthorized user", async () => {
            await expectRevert(
                priceFeedsV1PoolOracleTestToken1.setDOCAddress(sovryn.address, {
                    from: accounts[2],
                }),
                "unauthorized"
            );
        });

        it("set doc address success", async () => {
            await priceFeedsV1PoolOracleTestToken1.setDOCAddress(sovryn.address);
            expect(await priceFeedsV1PoolOracleTestToken1.docAddress()).to.be.equal(
                sovryn.address
            );
        });

        it("set wRBTC address should revert if set with zero address", async () => {
            await expectRevert(
                priceFeedsV1PoolOracleTestToken1.setRBTCAddress(constants.ZERO_ADDRESS),
                "wRBTC address cannot be zero address"
            );
        });

        it("set wRBTC address should revert if set with unauthorized user", async () => {
            await expectRevert(
                priceFeedsV1PoolOracleTestToken1.setRBTCAddress(sovryn.address, {
                    from: accounts[2],
                }),
                "unauthorized"
            );
        });

        it("set wRBTC address success", async () => {
            await priceFeedsV1PoolOracleTestToken1.setRBTCAddress(sovryn.address);
            expect(await priceFeedsV1PoolOracleTestToken1.wRBTCAddress()).to.be.equal(
                sovryn.address
            );
        });

        it("set v1PoolOracleAddress should revert if set with non-contract address", async () => {
            await expectRevert(
                priceFeedsV1PoolOracleTestToken1.setV1PoolOracleAddress(constants.ZERO_ADDRESS),
                "_v1PoolOracleAddress not a contract"
            );
        });

        it("set v1PoolOracleAddress should revert if set with unauthorized user", async () => {
            await expectRevert(
                priceFeedsV1PoolOracleTestToken1.setV1PoolOracleAddress(sovryn.address, {
                    from: accounts[2],
                }),
                "unauthorized"
            );
        });

        it("set v1PoolOracleAddress address should revert if one of the reserve tokens is wrbtc address", async () => {
            liquidityV1ConverterMockupBTC = await LiquidityPoolV1ConverterMockup.new(
                testToken1.address,
                SOV.address
            );
            priceFeedsV1PoolOracleMockupTestToken2 = await deployMockContract(
                senderMock,
                IV1PoolOracle.abi
            );
            await priceFeedsV1PoolOracleMockupTestToken2.mock.latestAnswer.returns(
                testToken1Price
            );
            await priceFeedsV1PoolOracleMockupTestToken2.mock.latestPrice.returns(testToken1Price);
            await priceFeedsV1PoolOracleMockupTestToken2.mock.liquidityPool.returns(
                liquidityV1ConverterMockupBTC.address
            );

            await expectRevert(
                priceFeedsV1PoolOracleTestToken1.setV1PoolOracleAddress(
                    priceFeedsV1PoolOracleMockupTestToken2.address
                ),
                "one of the two reserves needs to be wrbtc"
            );
        });

        it("set v1PoolOracleAddress address success", async () => {
            priceFeedsV1PoolOracleMockupTestToken2 = await deployMockContract(
                senderMock,
                IV1PoolOracle.abi
            );
            await priceFeedsV1PoolOracleMockupTestToken2.mock.latestAnswer.returns(
                testToken1Price
            );
            await priceFeedsV1PoolOracleMockupTestToken2.mock.latestPrice.returns(testToken1Price);
            await priceFeedsV1PoolOracleMockupTestToken2.mock.liquidityPool.returns(
                liquidityV1ConverterMockupTestToken1.address
            );

            await priceFeedsV1PoolOracleTestToken1.setV1PoolOracleAddress(
                priceFeedsV1PoolOracleMockupTestToken2.address
            );
            expect(await priceFeedsV1PoolOracleTestToken1.v1PoolOracleAddress()).to.be.equal(
                priceFeedsV1PoolOracleMockupTestToken2.address
            );
        });

        it("Should revert if price in usd is 0", async () => {
            const wrBTCPrice = wei("8", "ether");
            const docPrice = wei("7", "ether");
            const testToken2 = await TestToken.new(
                "test token 2",
                "TEST2",
                testToken2Precision,
                wei("20000", "ether")
            );
            priceFeedsV1PoolOracleMockupTestToken2 = await deployMockContract(
                senderMock,
                IV1PoolOracle.abi
            );
            await priceFeedsV1PoolOracleMockupTestToken2.mock.latestAnswer.returns(0);
            await priceFeedsV1PoolOracleMockupTestToken2.mock.latestPrice.returns(0);
            await priceFeedsV1PoolOracleMockupTestToken2.mock.liquidityPool.returns(
                liquidityV1ConverterMockupTestToken1.address
            );

            priceFeedsV1PoolOracleTestToken2 = await PriceFeedV1PoolOracle.new(
                priceFeedsV1PoolOracleMockupTestToken2.address,
                WRBTC.address,
                doc.address,
                testToken2.address
            );

            // // Set rBTC feed - using rsk oracle
            priceFeedsV1PoolOracleMockupBTC = await PriceFeedRSKOracleMockup.new();
            await priceFeedsV1PoolOracleMockupBTC.setValue(wrBTCPrice);
            priceFeedsV1PoolOracleBTC = await PriceFeedRSKOracle.new(
                priceFeedsV1PoolOracleMockupBTC.address
            );

            // Set DOC feed -- price 1 BTC
            liquidityV1ConverterMockupDOC = await LiquidityPoolV1ConverterMockup.new(
                doc.address,
                WRBTC.address
            );

            priceFeedsV1PoolOracleMockupDOC = await deployMockContract(
                senderMock,
                IV1PoolOracle.abi
            );
            await priceFeedsV1PoolOracleMockupDOC.mock.latestAnswer.returns(docPrice);
            await priceFeedsV1PoolOracleMockupDOC.mock.latestPrice.returns(docPrice);
            await priceFeedsV1PoolOracleMockupDOC.mock.liquidityPool.returns(
                liquidityV1ConverterMockupDOC.address
            );

            priceFeedsV1PoolOracleDOC = await PriceFeedV1PoolOracle.new(
                priceFeedsV1PoolOracleMockupDOC.address,
                WRBTC.address,
                doc.address,
                doc.address
            );

            // await priceFeeds.setPriceFeed([WRBTC.address, doc.address], [priceFeedsV1PoolOracle.address, priceFeedsV1PoolOracle.address])
            await priceFeeds.setPriceFeed(
                [testToken2.address, doc.address, WRBTC.address],
                [
                    priceFeedsV1PoolOracleTestToken2.address,
                    priceFeedsV1PoolOracleDOC.address,
                    priceFeedsV1PoolOracleBTC.address,
                ]
            );

            await expectRevert(
                priceFeeds.queryRate(testToken2.address, doc.address),
                "price error"
            );
        });
    });
});
