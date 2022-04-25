/** Speed optimized on branch hardhatTestRefactor, 2021-09-24
 * Bottlenecks found at beforeEach hook, redeploying tokens,
 *  protocol, loan ... on every test.
 *
 * Total time elapsed: 10.6s
 * After optimization: 7.7s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { BN, expectRevert, constants } = require("@openzeppelin/test-helpers");

const {
    margin_trading_sending_loan_tokens,
    margin_trading_sov_reward_payment,
    margin_trading_sov_reward_payment_with_special_rebates,
    margin_trading_sending_collateral_tokens,
    margin_trading_sending_collateral_tokens_sov_reward_payment,
    margin_trading_sending_collateral_tokens_sov_reward_payment_with_special_rebates,
    close_complete_margin_trade,
    close_partial_margin_trade,
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
    getPriceFeeds,
    getSovryn,
    lend_to_pool,
    set_demand_curve,
    open_margin_trade_position,
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
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

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

    describe("test the loan token trading logic with wBTC as collateral token and the sUSD test token as underlying loan token. ", () => {
        /* tests margin trading sending loan tokens.
		   process is handled by the shared function margin_trading_sending_loan_tokens
			1. approve the transfer
			2. send the margin trade tx
			3. verify the trade event and balances are correct
			4. retrieve the loan from the smart contract and make sure all values are set as expected
		*/

        it("Test margin trading sending loan tokens", async () => {
            await expectRevert(
                loanToken.marginTrade(
                    constants.ZERO_BYTES32, // loanId  (0 for new loans)
                    oneEth.toString(), // leverageAmount
                    oneEth.toString(), // loanTokenSent
                    "0", // no collateral token sent
                    WRBTC.address, // collateralTokenAddress
                    owner, // trader,
                    0, // slippage
                    "0x" // loanDataBytes (only required with ether)
                ),
                "principal too small"
            );

            await priceFeeds.setRates(
                WRBTC.address,
                SUSD.address,
                new BN(10).pow(new BN(20)).toString()
            );
            await priceFeeds.setRates(
                RBTC.address,
                SUSD.address,
                new BN(10).pow(new BN(20)).toString()
            );

            await margin_trading_sending_loan_tokens(
                accounts,
                sovryn,
                loanToken,
                SUSD,
                WRBTC,
                priceFeeds,
                false
            );
            await margin_trading_sov_reward_payment(
                accounts,
                loanToken,
                SUSD,
                WRBTC,
                SOV,
                FeesEvents,
                sovryn
            );
            await margin_trading_sov_reward_payment_with_special_rebates(
                accounts,
                loanToken,
                SUSD,
                WRBTC,
                SOV,
                FeesEvents,
                sovryn
            );
        });

        it("Test margin trading sending collateral tokens", async () => {
            const loanSize = oneEth.mul(new BN(10000));
            await SUSD.mint(loanToken.address, loanSize.mul(new BN(12)));
            const collateralTokenSent = await sovryn.getRequiredCollateral(
                SUSD.address,
                WRBTC.address,
                loanSize.mul(new BN(2)),
                new BN(50).mul(oneEth),
                false
            );
            const leverageAmount = new BN(5).mul(oneEth);
            await margin_trading_sending_collateral_tokens(
                accounts,
                loanToken,
                SUSD,
                WRBTC,
                loanSize,
                collateralTokenSent,
                leverageAmount,
                collateralTokenSent,
                priceFeeds
            );
            await WRBTC.mint(accounts[2], collateralTokenSent);
            await WRBTC.approve(loanToken.address, collateralTokenSent, { from: accounts[2] });
            await margin_trading_sending_collateral_tokens_sov_reward_payment(
                accounts[2],
                loanToken,
                SUSD,
                WRBTC,
                collateralTokenSent,
                leverageAmount,
                0,
                FeesEvents,
                SOV,
                sovryn
            );
        });

        it("Test margin trading sending collateral tokens with special rebates", async () => {
            const loanSize = oneEth.mul(new BN(10000));
            await SUSD.mint(loanToken.address, loanSize.mul(new BN(12)));
            const collateralTokenSent = await sovryn.getRequiredCollateral(
                SUSD.address,
                WRBTC.address,
                loanSize.mul(new BN(2)),
                new BN(50).mul(oneEth),
                false
            );
            const leverageAmount = new BN(5).mul(oneEth);
            await margin_trading_sending_collateral_tokens(
                accounts,
                loanToken,
                SUSD,
                WRBTC,
                loanSize,
                collateralTokenSent,
                leverageAmount,
                collateralTokenSent,
                priceFeeds
            );
            await WRBTC.mint(accounts[2], collateralTokenSent);
            await WRBTC.approve(loanToken.address, collateralTokenSent, { from: accounts[2] });
            await margin_trading_sending_collateral_tokens_sov_reward_payment_with_special_rebates(
                accounts[2],
                loanToken,
                SUSD,
                WRBTC,
                collateralTokenSent,
                leverageAmount,
                0,
                FeesEvents,
                SOV,
                sovryn
            );
        });

        /* should completely close a position.
		   first with returning loan tokens, then with returning collateral tokens to the sender.
		   process is handled by the shared function close_complete_margin_trade
			1. prepares the test by setting up the interest rates, lending to the pool and opening a position
			2. travels in time, so interest needs to be paid
			3. makes sure closing with an unauthorized caller fails (only the trader may close his position)
			4. sends the closing tx from the trader
			5. verifies the result
		*/

        it("Test close complete margin trade", async () => {
            await close_complete_margin_trade(
                sovryn,
                loanToken,
                set_demand_curve,
                lend_to_pool,
                open_margin_trade_position,
                priceFeeds,
                true,
                RBTC,
                WRBTC,
                SUSD,
                accounts
            );
            await close_complete_margin_trade(
                sovryn,
                loanToken,
                set_demand_curve,
                lend_to_pool,
                open_margin_trade_position,
                priceFeeds,
                false,
                RBTC,
                WRBTC,
                SUSD,
                accounts
            );
        });

        /* should partially close a position.
		   first with returning loan tokens, then with returning collateral tokens to the sender.
		   process is handled by the shared function close_partial_margin_trade
			1. prepares the test by setting up the interest rates, lending to the pool and opening a position
			2. travels in time, so interest needs to be paid
			3. makes sure closing with an unauthorized caller fails (only the trader may close his position)
			4. sends the closing tx from the trader
			5. verifies the result
		*/

        it("Test close partial margin trade", async () => {
            await close_partial_margin_trade(
                sovryn,
                loanToken,
                set_demand_curve,
                lend_to_pool,
                open_margin_trade_position,
                priceFeeds,
                true,
                RBTC,
                WRBTC,
                SUSD,
                accounts
            );
            await close_partial_margin_trade(
                sovryn,
                loanToken,
                set_demand_curve,
                lend_to_pool,
                open_margin_trade_position,
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
