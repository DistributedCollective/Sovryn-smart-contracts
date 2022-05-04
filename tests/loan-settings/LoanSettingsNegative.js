/** Speed optimized on branch hardhatTestRefactor, 2021-09-23
 * Bottlenecks found at beforeEach hook, redeploying token,
 *  protocol, price feeds and loan on every test.
 *
 * Total time elapsed: 5.5s
 * After optimization: 4.6s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Actually no need to apply fixture, instead move init code
 *   from beforeEach hook into the before hook, because tests are ok
 *   by using the previous state.
 *
 *   Updated to use the initializer.js functions for protocol deployment.
 *   Updated to use SUSD as underlying token, instead of custom underlyingToken.
 *   Updated to use WRBTC as collateral token, instead of custom testWrbtc.
 */

const { expectRevert, constants, ether } = require("@openzeppelin/test-helpers");

const LoanToken = artifacts.require("LoanToken");
const LoanTokenLogicWrbtc = artifacts.require("LoanTokenLogicWrbtc");

const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsImplLocal = artifacts.require("SwapsImplLocal");

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

contract("LoanSettingsNegative", (accounts) => {
    let lender, account1;
    let SUSD, WRBTC;
    let sovryn, loanToken;
    let loanParams, loanParamsId, tx;

    before(async () => {
        [lender, account1, ...accounts] = accounts;

        // Deploying sovrynProtocol w/ generic function from initializer.js
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        await sovryn.setSovrynProtocolAddress(sovryn.address);

        feeds = await PriceFeedsLocal.new(WRBTC.address, sovryn.address);
        await feeds.setRates(SUSD.address, WRBTC.address, ether("0.01"));
        const swaps = await SwapsImplLocal.new();
        const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
        await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
        await sovryn.setSupportedTokens([SUSD.address, WRBTC.address], [true, true]);
        await sovryn.setPriceFeedContract(
            feeds.address // priceFeeds
        );
        await sovryn.setSwapsImplContract(
            swaps.address // swapsImpl
        );
        await sovryn.setFeesController(lender);

        loanTokenLogicWrbtc = await LoanTokenLogicWrbtc.new();
        loanToken = await LoanToken.new(
            lender,
            loanTokenLogicWrbtc.address,
            sovryn.address,
            WRBTC.address
        );
        await loanToken.initialize(WRBTC.address, "iWRBTC", "iWRBTC"); // iToken
        loanToken = await LoanTokenLogicWrbtc.at(loanToken.address);

        const loanTokenAddress = await loanToken.loanTokenAddress();
        if (lender == (await sovryn.owner()))
            await sovryn.setLoanPool([loanToken.address], [loanTokenAddress]);

        await WRBTC.mint(sovryn.address, ether("500"));

        loanParams = {
            id: "0x0000000000000000000000000000000000000000000000000000000000000000",
            active: false,
            owner: constants.ZERO_ADDRESS,
            loanToken: SUSD.address,
            collateralToken: WRBTC.address,
            minInitialMargin: ether("50"),
            maintenanceMargin: ether("15"),
            maxLoanTerm: "2419200",
        };

        tx = await sovryn.setupLoanParams([Object.values(loanParams)]);
        loanParamsId = tx.logs[1].args.id;
    });

    describe("test LoanSettingsNegative", async () => {
        it("test disable unauthorized owner LoanSettings", async () => {
            await expectRevert(
                sovryn.disableLoanParams([loanParamsId], { from: account1 }),
                "unauthorized owner"
            );
        });

        it("test LoanSettings loanParam exists", async () => {
            await expectRevert(
                sovryn.setupLoanParams([Object.values(loanParams), Object.values(loanParams)]),
                "loanParams exists"
            );
        });

        it("test LoanSettings other requires", async () => {
            let localLoanParams;

            localLoanParams = JSON.parse(JSON.stringify(loanParams));
            localLoanParams["minInitialMargin"] = ether("50");
            localLoanParams["maintenanceMargin"] = ether("15");
            localLoanParams["loanToken"] = constants.ZERO_ADDRESS;
            await expectRevert(
                sovryn.setupLoanParams([Object.values(localLoanParams)]),
                "invalid params"
            );

            localLoanParams = JSON.parse(JSON.stringify(loanParams));
            localLoanParams["minInitialMargin"] = ether("50");
            localLoanParams["maintenanceMargin"] = ether("15");
            localLoanParams["collateralToken"] = constants.ZERO_ADDRESS;
            await expectRevert(
                sovryn.setupLoanParams([Object.values(localLoanParams)]),
                "invalid params"
            );

            localLoanParams = JSON.parse(JSON.stringify(loanParams));
            localLoanParams["maintenanceMargin"] = ether("15");
            localLoanParams["minInitialMargin"] = ether("10");
            await expectRevert(
                sovryn.setupLoanParams([Object.values(localLoanParams)]),
                "invalid params"
            );

            localLoanParams = JSON.parse(JSON.stringify(loanParams));
            localLoanParams["minInitialMargin"] = ether("50");
            localLoanParams["maintenanceMargin"] = ether("15");
            localLoanParams["maxLoanTerm"] = 1;
            await expectRevert(
                sovryn.setupLoanParams([Object.values(localLoanParams)]),
                "invalid params"
            );
        });
    });
});
