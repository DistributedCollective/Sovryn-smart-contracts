/** Created on branch improveTestCoverage, 2021-10-19
 * to test the contract feeds/testnet/PriceFeedsLocal.sol
 */

const { BN, constants, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { expect, waffle } = require("hardhat");
const { loadFixture } = waffle;

const TestToken = artifacts.require("TestToken");
const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");

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

contract("Affiliates", (accounts) => {
    let WRBTC;
    let doc;
    let SUSD;
    let sovryn;
    let feeds;
    let wei = web3.utils.toWei;

    async function deploymentAndInitFixture(_wallets, _provider) {
        // Deploying sovrynProtocol w/ generic function from initializer.js
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

        // Protocol token
        SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);

        // Another token
        doc = await TestToken.new("dollar on chain", "DOC", 18, wei("20000", "ether"));

        // New PriceFeeds
        feeds = await PriceFeedsLocal.new(WRBTC.address, SOV.address);
        await feeds.setRates(doc.address, WRBTC.address, wei("0.01", "ether"));
    }

    before(async () => {
        [owner, trader, referrer, account1, account2, ...accounts] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    /// @dev Test coverage of PriceFeedsLocal
    describe("PriceFeedsLocal", () => {
        let testToken1, testToken2;

        before(async () => {
            testToken1 = await TestToken.new("test token 1", "TEST1", 18, wei("20000", "ether"));
            testToken2 = await TestToken.new("test token 2", "TEST2", 16, wei("20000", "ether"));
        });

        it("PriceFeedsLocal::setGlobalPricingPaused test", async () => {
            await feeds.setGlobalPricingPaused(true);
            await expect(
                await feeds.queryReturn(
                    testToken1.address,
                    testToken2.address,
                    new BN(wei("100", "ether"))
                )
            ).to.be.bignumber.equal(new BN(wei("0", "ether")));
        });

        it("PriceFeedsLocal::queryRate should fail when paused", async () => {
            await feeds.setGlobalPricingPaused(true);
            await expectRevert(feeds.queryRate(doc.address, doc.address), "pricing is paused");
        });

        it("PriceFeedsLocal::setRates when sourceToken==destToken", async () => {
            // Check rate before setting
            let doc2doc = await feeds.queryRate(doc.address, doc.address);
            expect(doc2doc[0]).to.be.bignumber.equal(new BN(wei("1", "ether")));

            // Trying to set a new rate for doc/doc change; it doesn't revert, just ignores it.
            await feeds.setRates(doc.address, doc.address, wei("0.01", "ether"));

            // Check rate after setting, it shouldn't have changed even though we tried to
            doc2doc = await feeds.queryRate(doc.address, doc.address);
            expect(doc2doc[0]).to.be.bignumber.equal(new BN(wei("1", "ether")));
        });

        it("PriceFeedsLocal::queryRate when sourceToken or destToken == protocolTokenAddress", async () => {
            // Set protocol token price
            await feeds.setProtocolTokenEthPrice(wei("1234", "ether"));
            expect(await feeds.protocolTokenEthPrice()).to.be.bignumber.equal(
                new BN(wei("1234", "ether"))
            );

            // Check rate when sourceToken == protocolTokenAddress
            // Rate should be exactly the one previously defined w/ setProtocolTokenEthPrice() method
            let rate = await feeds.queryRate(SOV.address, doc.address);
            expect(rate[0]).to.be.bignumber.equal(new BN(wei("1234", "ether")));

            // Check rate when destToken == protocolTokenAddress
            // Rate should be the inverse of the previously defined w/ setProtocolTokenEthPrice() method
            rate = await feeds.queryRate(doc.address, SOV.address);
            expect(rate[0]).to.be.bignumber.equal(
                new BN(10).pow(new BN(36)).div(new BN(wei("1234", "ether")))
            );
        });
    });
});
