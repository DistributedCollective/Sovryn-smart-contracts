/** Speed optimized on branch hardhatTestRefactor, 2021-10-01
 * Bottleneck found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 8.1s
 * After optimization: 6.2s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Moved some initialization code from tests to fixture.
 */

const { expect } = require("chai");

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expectRevert, BN } = require("@openzeppelin/test-helpers");
const { increaseTime, blockNumber } = require("../Utils/Ethereum");

const FeesEvents = artifacts.require("FeesEvents");
const LoanClosingsEvents = artifacts.require("LoanClosingsEvents");
const IERC20 = artifacts.require("contracts/interfaces/IERC20.sol:IERC20");
const LockedSOVMockup = artifacts.require("LockedSOVMockup");

const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getLoanToken,
    getLoanTokenWRBTC,
    loan_pool_setup,
    set_demand_curve,
    lend_to_pool,
    getPriceFeeds,
    getSovryn,
    decodeLogs,
    open_margin_trade_position,
    getSOV,
    verify_sov_reward_payment,
} = require("../Utils/initializer.js");

const wei = web3.utils.toWei;

const oneEth = new BN(wei("1", "ether"));
const hunEth = new BN(wei("100", "ether"));
const TINY_AMOUNT = new BN(25).mul(new BN(10).pow(new BN(13))); // 25 * 10**13

/*
Tests the close with deposit. 
Note: close with swap is tested in loanToken/trading

1. Test a full closure with deposit
2. Test a partial closure with deposit
3. Should fail to close with 0 deposit 
*/

contract("ProtocolCloseDeposit", (accounts) => {
    let owner;
    let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, priceFeeds, SOV;
    let borrower, receiver;

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

        /// @dev Moved from some tests that require this initialization
        /// and is not interfering w/ any others.
        borrower = accounts[3];
        receiver = accounts[4];
        await set_demand_curve(loanToken);
        await lend_to_pool(loanToken, SUSD, accounts[2]);
    }

    before(async () => {
        [owner] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    const internal_test_close_with_deposit = async (
        deposit_amount,
        RBTC,
        SUSD,
        borrower,
        collateral,
        initial_loan,
        initial_loan_interest,
        loanToken,
        loan_id,
        priceFeeds,
        principal,
        receiver,
        sovryn,
        LoanClosingsEvents,
        FeesEvents,
        SOV
    ) => {
        await SUSD.mint(borrower, deposit_amount);
        await SUSD.approve(sovryn.address, deposit_amount, { from: borrower });
        const { rate, precision } = await priceFeeds.queryRate(
            initial_loan["collateralToken"],
            initial_loan["loanToken"]
        );

        lockedSOV = await LockedSOVMockup.at(await sovryn.lockedSOVAddress());
        const sov_borrower_initial_balance = (await SOV.balanceOf(borrower)).add(
            await lockedSOV.getLockedBalance(borrower)
        );

        let loan_close_amount = deposit_amount.gt(principal) ? principal : deposit_amount;
        let checkTinyPosition;

        // Check that tiny position won't be created
        // Comparison must be in wrbtc format because TINY_AMOUNT is assumed as WRBTC
        const remainingAmount = principal.sub(loan_close_amount);
        if (remainingAmount.gt(new BN(0))) {
            const { rate, precision } = await priceFeeds.queryRate(
                initial_loan["loanToken"],
                WRBTC.address
            );
            remainingAmountInWRBTC = remainingAmount.mul(rate).div(precision);

            if (remainingAmountInWRBTC.cmp(TINY_AMOUNT) <= 0) {
                checkTinyPosition = await sovryn.checkCloseWithDepositIsTinyPosition(
                    loan_id,
                    deposit_amount
                );
                expect(checkTinyPosition.isTinyPosition).to.equal(true);
                expect(checkTinyPosition.tinyPositionAmount.toString()).to.equal(
                    remainingAmountInWRBTC.toString()
                );

                await expectRevert(
                    sovryn.closeWithDeposit(loan_id, receiver, deposit_amount, {
                        from: borrower,
                    }),
                    "Tiny amount when closing with deposit"
                );
                return;
            }
        }

        checkTinyPosition = await sovryn.checkCloseWithDepositIsTinyPosition(
            loan_id,
            deposit_amount
        );
        expect(checkTinyPosition.isTinyPosition).to.equal(false);
        expect(checkTinyPosition.tinyPositionAmount.toString()).to.equal("0");

        const tx = await sovryn.closeWithDeposit(loan_id, receiver, deposit_amount, {
            from: borrower,
        });
        const receipt = tx.receipt;

        const withdraw_amount = loan_close_amount.eq(principal)
            ? collateral
            : collateral.mul(loan_close_amount).div(principal);
        const end_collateral = collateral.sub(withdraw_amount);
        const end_principal = loan_close_amount.eq(principal)
            ? new BN(0)
            : principal.sub(loan_close_amount);
        const collateral_to_loan_rate = new BN(rate).mul(oneEth).div(new BN(precision));
        const collateral_to_loan_amount = end_collateral.mul(collateral_to_loan_rate).div(oneEth);
        const current_margin =
            end_principal.lte(collateral_to_loan_amount) && !end_principal.eq(new BN(0))
                ? collateral_to_loan_amount.sub(end_principal).mul(hunEth).div(end_principal)
                : new BN(0);

        const owed_per_day = new BN(initial_loan_interest["interestOwedPerDay"]);
        const end_timestamp = initial_loan["endTimestamp"];
        const owed_per_day_refund = owed_per_day.mul(loan_close_amount).div(principal);
        // (loan end timestamp - block timestamp) * owedPerDayRefund / 24*60*60
        const num = await blockNumber();
        let lastBlock = await web3.eth.getBlock(num);
        const block_timestamp = lastBlock.timestamp;
        const interest_refund_to_borrower_1 = new BN(end_timestamp - block_timestamp)
            .mul(owed_per_day_refund)
            .div(new BN(24 * 60 * 60));
        const interest_refund_to_borrower = interest_refund_to_borrower_1.lte(loan_close_amount)
            ? new BN(0)
            : interest_refund_to_borrower_1.sub(loan_close_amount);

        // Test CloseWithDeposit event parameters
        // When all the tests are run, the event is not recognized so we have to decode it manually
        const decode = decodeLogs(receipt.rawLogs, LoanClosingsEvents, "CloseWithDeposit");
        const close_event = decode[0].args;

        expect(close_event["user"] == borrower).to.be.true;
        expect(close_event["lender"] == loanToken.address).to.be.true;
        expect(close_event["loanId"] == loan_id).to.be.true;
        expect(close_event["closer"] == borrower).to.be.true;
        expect(close_event["loanToken"] == initial_loan["loanToken"]).to.be.true;
        expect(close_event["collateralToken"] == initial_loan["collateralToken"]).to.be.true;
        expect(close_event["repayAmount"] == loan_close_amount.toString()).to.be.true;
        expect(close_event["collateralWithdrawAmount"] == withdraw_amount.toString()).to.be.true;
        expect(close_event["collateralToLoanRate"] == collateral_to_loan_rate.toString()).to.be
            .true;
        expect(close_event["currentMargin"] == current_margin.toString()).to.be.true;

        // Test refund collateral to receiver
        // Test refund interest to receiver
        expect((await RBTC.balanceOf(receiver)).eq(withdraw_amount)).to.be.true;
        expect((await SUSD.balanceOf(receiver)).eq(interest_refund_to_borrower)).to.be.true;

        // Test loan update
        const end_loan = await sovryn.getLoan(loan_id);
        const new_principal = loan_close_amount.eq(principal)
            ? new BN(0)
            : principal.sub(loan_close_amount);
        expect(end_loan["principal"] == new_principal.toString()).to.be.true;
        if (loan_close_amount.eq(principal)) {
            const last_block_timestamp = block_timestamp;
            expect(end_loan["endTimestamp"] <= last_block_timestamp);
        }

        // Test returning principal to lender with deposit
        const loan_close_amount_less_interest = loan_close_amount.gte(
            interest_refund_to_borrower_1
        )
            ? loan_close_amount.sub(interest_refund_to_borrower_1)
            : new BN(0);

        const decode2 = decodeLogs(receipt.rawLogs, IERC20, "Transfer");
        let transfer_to_lender = decode2.filter((tx_event) => tx_event.args["from"] == borrower);
        expect(transfer_to_lender.length == 1).to.be.true;
        transfer_to_lender = transfer_to_lender[0].args;
        expect(transfer_to_lender["to"] == loanToken.address).to.be.true;
        expect(transfer_to_lender["value"]).eq(loan_close_amount_less_interest.toString());

        await verify_sov_reward_payment(
            receipt.rawLogs,
            FeesEvents,
            SOV,
            borrower,
            loan_id,
            sov_borrower_initial_balance,
            1,
            SUSD.address,
            RBTC.address,
            sovryn
        );
    };

    describe("Tests the close with deposit. ", () => {
        /*
            Test CloseWithDeposit event parameters
            Test refund collateral to receiver
            Test refund interest to receiver
            Test loan update
            Test returning principal to lender with deposit	
        */
        it("Test full close with deposit", async () => {
            // Prepare the test
            const borrower = accounts[3];
            const receiver = accounts[4];
            await set_demand_curve(loanToken);
            await lend_to_pool(loanToken, SUSD, accounts[2]);
            // prepare the test
            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                borrower
            );

            await increaseTime(10 * 24 * 60 * 60);
            const initial_loan = await sovryn.getLoan(loan_id);
            const principal = new BN(initial_loan["principal"]);
            const collateral = new BN(initial_loan["collateral"]);
            const initial_loan_interest = await sovryn.getLoanInterestData(loan_id);

            const deposit_amount = principal;
            await internal_test_close_with_deposit(
                deposit_amount,
                RBTC,
                SUSD,
                borrower,
                collateral,
                initial_loan,
                initial_loan_interest,
                loanToken,
                loan_id,
                priceFeeds,
                principal,
                receiver,
                sovryn,
                LoanClosingsEvents,
                FeesEvents,
                SOV
            );
        });

        it("Test full close with deposit with special rebates", async () => {
            // Prepare the test
            const borrower = accounts[3];
            const receiver = accounts[4];
            await set_demand_curve(loanToken);
            await lend_to_pool(loanToken, SUSD, accounts[2]);

            // prepare the test
            await sovryn.setSpecialRebates(SUSD.address, RBTC.address, wei("300", "ether"));
            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                borrower
            );

            await increaseTime(10 * 24 * 60 * 60);
            const initial_loan = await sovryn.getLoan(loan_id);
            const principal = new BN(initial_loan["principal"]);
            const collateral = new BN(initial_loan["collateral"]);
            const initial_loan_interest = await sovryn.getLoanInterestData(loan_id);

            const deposit_amount = principal;
            await internal_test_close_with_deposit(
                deposit_amount,
                RBTC,
                SUSD,
                borrower,
                collateral,
                initial_loan,
                initial_loan_interest,
                loanToken,
                loan_id,
                priceFeeds,
                principal,
                receiver,
                sovryn,
                LoanClosingsEvents,
                FeesEvents,
                SOV
            );
        });

        it("Test partial close with deposit", async () => {
            // Prepare the test
            const borrower = accounts[3];
            const receiver = accounts[4];
            await set_demand_curve(loanToken);
            await lend_to_pool(loanToken, SUSD, accounts[2]);
            // prepare the test
            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                borrower
            );

            await increaseTime(10 * 24 * 60 * 60);
            const initial_loan = await sovryn.getLoan(loan_id);
            const principal = new BN(initial_loan["principal"]);
            const collateral = new BN(initial_loan["collateral"]);
            const initial_loan_interest = await sovryn.getLoanInterestData(loan_id);

            const deposit_amount = principal.div(new BN(2));
            await internal_test_close_with_deposit(
                deposit_amount,
                RBTC,
                SUSD,
                borrower,
                collateral,
                initial_loan,
                initial_loan_interest,
                loanToken,
                loan_id,
                priceFeeds,
                principal,
                receiver,
                sovryn,
                LoanClosingsEvents,
                FeesEvents,
                SOV
            );
        });

        it("Test partial close w/ deposit tiny position", async () => {
            // Prepare the test
            const borrower = accounts[3];
            const receiver = accounts[4];
            await set_demand_curve(loanToken);
            await lend_to_pool(loanToken, SUSD, accounts[2]);
            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                borrower
            );

            await increaseTime(10 * 24 * 60 * 60);
            const initial_loan = await sovryn.getLoan(loan_id);
            const principal = new BN(initial_loan["principal"]);
            const collateral = new BN(initial_loan["collateral"]);
            const initial_loan_interest = await sovryn.getLoanInterestData(loan_id);
            const deposit_amount = principal.sub(TINY_AMOUNT);
            await internal_test_close_with_deposit(
                deposit_amount,
                RBTC,
                SUSD,
                borrower,
                collateral,
                initial_loan,
                initial_loan_interest,
                loanToken,
                loan_id,
                priceFeeds,
                principal,
                receiver,
                sovryn,
                LoanClosingsEvents,
                FeesEvents,
                SOV
            );
        });

        it("Test partial close w/ deposit small not so tiny position is failing!", async () => {
            // Prepare the test
            const borrower = accounts[3];
            const receiver = accounts[4];
            await set_demand_curve(loanToken);
            await lend_to_pool(loanToken, SUSD, accounts[2]);
            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                borrower
            );

            await increaseTime(10 * 24 * 60 * 60);
            const initial_loan = await sovryn.getLoan(loan_id);
            const principal = new BN(initial_loan["principal"]);
            const collateral = new BN(initial_loan["collateral"]);
            const initial_loan_interest = await sovryn.getLoanInterestData(loan_id);
            const deposit_amount = principal.div(new BN(300)).mul(new BN(299));
            await internal_test_close_with_deposit(
                deposit_amount,
                RBTC,
                SUSD,
                borrower,
                collateral,
                initial_loan,
                initial_loan_interest,
                loanToken,
                loan_id,
                priceFeeds,
                principal,
                receiver,
                sovryn,
                LoanClosingsEvents,
                FeesEvents,
                SOV
            );
        });

        it("Test partial close w/ swap tiny position", async () => {
            // Prepare the test
            const borrower = accounts[3];
            const receiver = accounts[4];
            await set_demand_curve(loanToken);
            await lend_to_pool(loanToken, SUSD, accounts[2]);
            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                borrower
            );

            await increaseTime(10 * 24 * 60 * 60);
            const initial_loan = await sovryn.getLoan(loan_id);
            const principal = new BN(initial_loan["principal"]);
            const collateral = new BN(initial_loan["collateral"]);
            const initial_loan_interest = await sovryn.getLoanInterestData(loan_id);
            const swap_amount = principal.sub(TINY_AMOUNT);
            const return_token_is_collateral = true; // true: withdraws collateralToken, false: withdraws loanToken
            const { receipt } = await sovryn.closeWithSwap(
                loan_id,
                borrower,
                swap_amount,
                return_token_is_collateral,
                "0x",
                {
                    from: borrower,
                }
            );

            // Test loan update
            end_loan = await sovryn.getLoan.call(loan_id);
            expect(end_loan["principal"]).to.be.bignumber.equal(
                new BN(0),
                "principal should be 0"
            );
            expect(end_loan["collateral"]).to.be.bignumber.equal(
                new BN(0),
                "collateral should be 0"
            );
        });

        it("Test close with zero deposit should fail", async () => {
            // Prepare the test
            const borrower = accounts[3];
            const receiver = accounts[4];
            await set_demand_curve(loanToken);
            await lend_to_pool(loanToken, SUSD, accounts[2]);
            // prepare the test
            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                borrower
            );

            await increaseTime(10 * 24 * 60 * 60);

            await expectRevert(
                sovryn.closeWithDeposit(loan_id, receiver, 0, { from: borrower }),
                "depositAmount == 0"
            );
        });
    });
});
