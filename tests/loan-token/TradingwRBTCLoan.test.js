/** Speed optimized on branch hardhatTestRefactor, 2021-09-24
 * Bottlenecks found at beforeEach hook, redeploying tokens,
 *  protocol, loan ... on every test.
 *
 * Total time elapsed: 8.6s
 * After optimization: 6.9s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { BN } = require("@openzeppelin/test-helpers");

const {
    margin_trading_sending_loan_tokens,
    margin_trading_sov_reward_payment,
    margin_trading_sov_reward_payment_with_special_rebates,
    margin_trading_sending_collateral_tokens,
    margin_trading_sending_collateral_tokens_sov_reward_payment,
    margin_trading_sending_collateral_tokens_sov_reward_payment_with_special_rebates,
    close_complete_margin_trade_wrbtc,
    close_partial_margin_trade_wrbtc,
} = require("./tradingFunctions");

const FeesEvents = artifacts.require("FeesEvents");

const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getSOV,
    getLoanToken,
    getLoanTokenWRBTC,
    loan_pool_setup,
    set_demand_curve,
    lend_to_pool_iBTC,
    getPriceFeedsRBTC,
    getSovryn,
    open_margin_trade_position_iBTC,
} = require("../Utils/initializer.js");

const wei = web3.utils.toWei;

const oneEth = new BN(wei("1", "ether"));

contract("LoanTokenTrading", (accounts) => {
    let owner;
    let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, SOV, priceFeeds;

    async function deploymentAndInitFixture(_wallets, _provider) {
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeedsRBTC(WRBTC, SUSD, RBTC, sovryn, BZRX);

        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

        loanToken = await getLoanToken(owner, sovryn, WRBTC, SUSD);
        loanTokenWRBTC = await getLoanTokenWRBTC(owner, sovryn, WRBTC, SUSD);
        await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

        SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);
    }

    before(async () => {
        [owner] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    describe("test the loan token trading logic with SUSD test token as collateral token and the wBTC as underlying loan token. ", () => {
        /*
        tests margin trading sending loan tokens.
            process is handled by the shared function margin_trading_sending_loan_tokens
            1. approve the transfer
            2. send the margin trade tx
            3. verify the trade event and balances are correct
            4. retrieve the loan from the smart contract and make sure all values are set as expected
        */
        it("Test margin trading sending loan tokens", async () => {
            await margin_trading_sending_loan_tokens(
                accounts,
                sovryn,
                loanTokenWRBTC,
                WRBTC,
                SUSD,
                priceFeeds,
                false
            );
            await margin_trading_sov_reward_payment(
                accounts,
                loanTokenWRBTC,
                WRBTC,
                SUSD,
                SOV,
                FeesEvents,
                sovryn
            );
            await margin_trading_sov_reward_payment_with_special_rebates(
                accounts,
                loanTokenWRBTC,
                WRBTC,
                SUSD,
                SOV,
                FeesEvents,
                sovryn
            );
        });
        it("Test margin trading sending collateral tokens", async () => {
            const loanSize = oneEth;
            //  make sure there are sufficient funds on the contract
            await loanTokenWRBTC.mintWithBTC(accounts[0], false, {
                value: loanSize.mul(new BN(6)),
            });
            await loanTokenWRBTC.mintWithBTC(accounts[2], false, {
                value: loanSize.mul(new BN(6)),
            });
            // compute the amount of collateral tokens needed
            const collateralTokenSent = await sovryn.getRequiredCollateral(
                WRBTC.address,
                SUSD.address,
                loanSize.mul(new BN(2)),
                new BN(50).mul(oneEth),
                false
            );
            await SUSD.mint(accounts[0], collateralTokenSent);
            await SUSD.mint(accounts[2], collateralTokenSent);
            // important! WRBTC is being held by the loanToken contract itself, all other tokens are transfered directly from
            // the sender and need approval
            await SUSD.approve(loanTokenWRBTC.address, collateralTokenSent);
            await SUSD.approve(loanTokenWRBTC.address, collateralTokenSent, { from: accounts[2] });
            const leverageAmount = new BN(5).mul(oneEth);
            const value = 0;
            await margin_trading_sending_collateral_tokens(
                accounts,
                loanTokenWRBTC,
                WRBTC,
                SUSD,
                loanSize,
                collateralTokenSent,
                leverageAmount,
                value,
                priceFeeds
            );
            await margin_trading_sending_collateral_tokens_sov_reward_payment(
                accounts[2],
                loanTokenWRBTC,
                WRBTC,
                SUSD,
                collateralTokenSent,
                leverageAmount,
                value,
                FeesEvents,
                SOV,
                sovryn
            );
        });

        it("Test margin trading sending collateral tokens with special rebates", async () => {
            const loanSize = oneEth;
            //  make sure there are sufficient funds on the contract
            await loanTokenWRBTC.mintWithBTC(accounts[0], false, {
                value: loanSize.mul(new BN(6)).toString(),
            });
            await loanTokenWRBTC.mintWithBTC(accounts[2], false, {
                value: loanSize.mul(new BN(6)).toString(),
            });
            // compute the amount of collateral tokens needed
            const collateralTokenSent = await sovryn.getRequiredCollateral(
                WRBTC.address,
                SUSD.address,
                loanSize.mul(new BN(2)),
                new BN(50).mul(oneEth),
                false
            );

            await SUSD.mint(accounts[0], collateralTokenSent);
            await SUSD.mint(accounts[2], collateralTokenSent);
            // important! WRBTC is being held by the loanToken contract itself, all other tokens are transfered directly from
            // the sender and need approval
            await SUSD.approve(loanTokenWRBTC.address, collateralTokenSent);
            await SUSD.approve(loanTokenWRBTC.address, collateralTokenSent, { from: accounts[2] });
            const leverageAmount = new BN(5).mul(oneEth);
            const value = 0;

            await margin_trading_sending_collateral_tokens(
                accounts,
                loanTokenWRBTC,
                WRBTC,
                SUSD,
                loanSize,
                collateralTokenSent,
                leverageAmount,
                value,
                priceFeeds
            );

            await margin_trading_sending_collateral_tokens_sov_reward_payment_with_special_rebates(
                accounts[2],
                loanTokenWRBTC,
                WRBTC,
                SUSD,
                collateralTokenSent,
                leverageAmount,
                value,
                FeesEvents,
                SOV,
                sovryn
            );
        });

        it("Test close complete margin trade", async () => {
            await close_complete_margin_trade_wrbtc(
                sovryn,
                loanToken,
                loanTokenWRBTC,
                set_demand_curve,
                lend_to_pool_iBTC,
                open_margin_trade_position_iBTC,
                priceFeeds,
                true,
                RBTC,
                WRBTC,
                SUSD,
                accounts
            );
            await close_complete_margin_trade_wrbtc(
                sovryn,
                loanToken,
                loanTokenWRBTC,
                set_demand_curve,
                lend_to_pool_iBTC,
                open_margin_trade_position_iBTC,
                priceFeeds,
                false,
                RBTC,
                WRBTC,
                SUSD,
                accounts
            );
        });

        it("Test close partial margin trade", async () => {
            await close_partial_margin_trade_wrbtc(
                sovryn,
                loanToken,
                loanTokenWRBTC,
                set_demand_curve,
                lend_to_pool_iBTC,
                open_margin_trade_position_iBTC,
                priceFeeds,
                true,
                RBTC,
                WRBTC,
                SUSD,
                accounts
            );
            await close_partial_margin_trade_wrbtc(
                sovryn,
                loanToken,
                loanTokenWRBTC,
                set_demand_curve,
                lend_to_pool_iBTC,
                open_margin_trade_position_iBTC,
                priceFeeds,
                false,
                RBTC,
                WRBTC,
                SUSD,
                accounts
            );
        });
    });
});
