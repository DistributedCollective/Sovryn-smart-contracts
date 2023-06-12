/** Speed optimized on branch hardhatTestRefactor, 2021-10-01
 * Bottleneck found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 7.0s
 * After optimization: 5.8s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { BN } = require("@openzeppelin/test-helpers");

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const FeesEvents = artifacts.require("FeesEvents");

const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getLoanToken,
    getLoanTokenWRBTC,
    loan_pool_setup,
    set_demand_curve,
    getPriceFeeds,
    getSovryn,
    getSOV,
} = require("../Utils/initializer.js");

const { liquidate, liquidate_healthy_position_should_fail } = require("./liquidationFunctions");

/*
Should test the liquidation handling
1. Liquidate a position
2. Should fail to liquidate a healthy position
*/

contract("ProtocolLiquidationTestToken", (accounts) => {
    let owner;
    let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, priceFeeds, SOV;

    async function deploymentAndInitFixture(_wallets, _provider) {
        // Deploying sovrynProtocol w/ generic function from initializer.js
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

        loanToken = await getLoanToken(owner, sovryn, WRBTC, SUSD);
        loanTokenWRBTC = await getLoanTokenWRBTC(owner, sovryn, WRBTC, SUSD);
        await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

        /// @dev SOV test token deployment w/ initializer.js
        SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);
    }

    before(async () => {
        [owner] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    describe("Tests liquidation handling ", () => {
        /*
            Test with different rates so the currentMargin is <= liquidationIncentivePercent
            or > liquidationIncentivePercent
            liquidationIncentivePercent = 5e18 by default
        */
        it("Test liquidate with rate 1e23", async () => {
            const rate = new BN(10).pow(new BN(23));
            await liquidate(
                accounts,
                loanTokenWRBTC,
                WRBTC,
                set_demand_curve,
                SUSD,
                sovryn,
                priceFeeds,
                rate,
                WRBTC,
                FeesEvents,
                SOV
            );
        });

        it("Test liquidate with rate 1.34e22", async () => {
            const rate = new BN(134).mul(new BN(10).pow(new BN(20)));
            await liquidate(
                accounts,
                loanTokenWRBTC,
                WRBTC,
                set_demand_curve,
                SUSD,
                sovryn,
                priceFeeds,
                rate,
                WRBTC,
                FeesEvents,
                SOV
            );
        });

        /*
            Test if fails when the position is healthy currentMargin > maintenanceRate
        */
        it("Test liquidate healthy position should fail", async () => {
            await liquidate_healthy_position_should_fail(
                accounts,
                loanTokenWRBTC,
                WRBTC,
                set_demand_curve,
                SUSD,
                sovryn,
                priceFeeds,
                WRBTC
            );
        });
    });
});
