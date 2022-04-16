/** Speed optimized on branch hardhatTestRefactor, 2021-09-24
 * Bottlenecks found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 6.1s
 * After optimization: 5.1s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Updated to use the initializer.js functions for protocol deployment.
 *   Updated to use RBTC, instead of custom rBTC token.
 *   Updated to use SUSD as underlying token, instead of custom underlyingToken.
 */

const { waffle } = require("hardhat");
const { loadFixture } = waffle;

const LoanToken = artifacts.require("LoanToken");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");

const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");

const {
    lend_to_the_pool,
    cash_out_from_the_pool,
    cash_out_from_the_pool_uint256_max_should_withdraw_total_balance,
} = require("./helpers");

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

const wei = web3.utils.toWei;

contract("LoanTokenLending", (accounts) => {
    const name = "Test token";
    const symbol = "TST";

    let lender;
    let SUSD, RBTC, SOV;
    let sovryn, loanToken;

    async function deploymentAndInitFixture(_wallets, _provider) {
        // Deploying sovrynProtocol w/ generic function from initializer.js
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        await sovryn.setSovrynProtocolAddress(sovryn.address);

        feeds = await PriceFeedsLocal.new(RBTC.address, sovryn.address);
        await feeds.setRates(SUSD.address, RBTC.address, wei("0.01", "ether"));
        await sovryn.setSupportedTokens([SUSD.address, RBTC.address], [true, true]);
        await sovryn.setFeesController(lender);

        // Custom tokens
        SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);

        const initLoanTokenLogic = await getLoanTokenLogic(); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
        loanTokenLogic = initLoanTokenLogic[0];
        loanTokenLogicBeacon = initLoanTokenLogic[1];

        loanToken = await LoanToken.new(
            lender,
            loanTokenLogic.address,
            sovryn.address,
            RBTC.address
        );
        await loanToken.initialize(SUSD.address, name, symbol); //iToken

        /** Initialize the loan token logic proxy */
        loanToken = await ILoanTokenLogicProxy.at(loanToken.address);
        await loanToken.setBeaconAddress(loanTokenLogicBeacon.address);

        /** Use interface of LoanTokenModules */
        loanToken = await ILoanTokenModules.at(loanToken.address);

        params = [
            "0x0000000000000000000000000000000000000000000000000000000000000000", // bytes32 id; // id of loan params object
            false, // bool active; // if false, this object has been disabled by the owner and can't be used for future loans
            lender, // address owner; // owner of this object
            SUSD.address, // address loanToken; // the token being loaned
            RBTC.address, // address collateralToken; // the required collateral token
            wei("20", "ether"), // uint256 minInitialMargin; // the minimum allowed initial margin
            wei("15", "ether"), // uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
            2419200, // uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
        ];

        await loanToken.setupLoanParams([params], false);

        const loanTokenAddress = await loanToken.loanTokenAddress();
        if (lender == (await sovryn.owner()))
            await sovryn.setLoanPool([loanToken.address], [loanTokenAddress]);

        // const baseRate = wei("1", "ether");
        // const rateMultiplier = wei("20.25", "ether");
        // const targetLevel = wei("80", "ether");
        // const kinkLevel = wei("90", "ether");
        // const maxScaleRate = wei("100", "ether");
        // await loanToken.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier, targetLevel, kinkLevel, maxScaleRate);

        await RBTC.mint(sovryn.address, wei("500", "ether"));
    }

    before(async () => {
        [lender, ...accounts] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    describe("test lending using wRBTC as collateral", () => {
        it("test lend to the pool", async () => {
            await lend_to_the_pool(loanToken, lender, SUSD, RBTC, sovryn);
        });

        it("test cash out from the pool", async () => {
            await cash_out_from_the_pool(loanToken, lender, SUSD, false);
        });

        it("test cash out from the pool more of lender balance should not fail", async () => {
            // await cash_out_from_the_pool_more_of_lender_balance_should_not_fail(loanToken, lender, SUSD);
            await cash_out_from_the_pool_uint256_max_should_withdraw_total_balance(
                loanToken,
                lender,
                SUSD
            );
        });
    });
});
