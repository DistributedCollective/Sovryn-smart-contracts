/** Speed optimized on branch hardhatTestRefactor, 2021-10-01
 * Bottleneck found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 38.3s
 * After optimization: 10.0s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Moved some initialization code from tests to fixture.
 *   Added several coverage tests
 */

const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { expectRevert, BN } = require("@openzeppelin/test-helpers");
const { increaseTime } = require("../Utils/Ethereum");

const SwapsEvents = artifacts.require("SwapsEvents");
const LoanMaintenance = artifacts.require("LoanMaintenance");
const FeesEvents = artifacts.require("FeesEvents");
const LockedSOVMockup = artifacts.require("LockedSOVMockup");
const LockedSOVFailedMockup = artifacts.require("LockedSOVFailedMockup");

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
    borrow_indefinite_loan,
    getSOV,
} = require("../Utils/initializer.js");

const wei = web3.utils.toWei;

const oneEth = new BN(wei("1", "ether"));

/*
Test extending and reducing loan durations.
1. Should fail to extend a fixed-term loan
2. Extend a loan
3. Should fail to extend a loan with 0 deposit 
4. Should fail to extend a closed loan
5. Should fail to extend another user's loan
6. Extend a loan with collateral
7. Should fail to extend a loan with collateral tokens and rBTC value
8. Should fail to reduce the duration of a fixed-term loan
9. Reduce the duration of a loan
10. Should fail to reduce the loan duration without withdrawing some funds
11. Should fail to reduce the loan duration of a closed loan
12. Should fail to reduce the loan duration of another user's loan
13. Should fail to reduce the loan duration if the max duration was already surpassed
14. Should fail to reduce the loan duration when withdrawing too much
15. Should fail to reduce the loan duration by less than an hour
*/

contract("ProtocolChangeLoanDuration", (accounts) => {
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

        // Protocol token
        SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);

        /// @dev Moved from some tests that require this initialization
        /// and is not interfering w/ any others.
        await set_demand_curve(loanToken);
        await lend_to_pool(loanToken, SUSD, owner);
    }

    before(async () => {
        [owner] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    describe("Test LoanMaintenance::getUserLoans and getActiveLoans", () => {
        it("should return empty if start >= end", async () => {
            // no loan created
            const loansData = await sovryn.getUserLoans(accounts[1], 0, 10, 0, 0, 0); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            assert.equal(loansData.length, 0);
        });

        it("should return empty if count == 0", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getUserLoans(borrower, 0, 0, 0, 0, 0); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            assert.equal(loansData.length, 0);
        });

        it("should exist a loan, check values", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getUserLoans(borrower, 0, 10, 0, 0, 0); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData[0]["loanId"], loan_id);
            assert.equal(loansData[0]["loanToken"], SUSD.address);
            assert.equal(loansData[0]["collateralToken"], RBTC.address);
        });

        it("should not exist an unsafe loan", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            // Check UnsafeOnly, no results to expect
            const loansDataUnsafeOnly = await sovryn.getUserLoans(borrower, 0, 10, 0, 0, true); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            // console.log("loansDataUnsafeOnly = ", loansDataUnsafeOnly);

            assert.equal(loansDataUnsafeOnly.length, 0);
        });

        it("should exist an active loan, check values", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getActiveLoans(0, 10, 0); /// @dev parameters: start, count, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData[0]["loanId"], loan_id);
            assert.equal(loansData[0]["loanToken"], SUSD.address);
            assert.equal(loansData[0]["collateralToken"], RBTC.address);
        });

        it("Coverage to avoid final conditional (itemCount < count) on getActiveLoans", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getActiveLoans(0, 1, 0); /// @dev parameters: start, count, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData[0]["loanId"], loan_id);
            assert.equal(loansData[0]["loanToken"], SUSD.address);
            assert.equal(loansData[0]["collateralToken"], RBTC.address);
        });

        it("Coverage to meet the conditional (start >= end) on getActiveLoans", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getActiveLoans(1, 1, 0); /// @dev parameters: start, count, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData.length, 0);
        });

        it("should not exist any active unsafe loan", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            // Check UnsafeOnly, no results to expect
            const loansDataUnsafeOnly = await sovryn.getActiveLoans(0, 10, true); /// @dev parameters: start, count, unsafeOnly
            // console.log("loansDataUnsafeOnly = ", loansDataUnsafeOnly);

            assert.equal(loansDataUnsafeOnly.length, 0);
        });

        it("should get a loanType 1: a margin trade loan", async () => {
            // prepare the test
            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                accounts[1]
            );

            const loansData = await sovryn.getUserLoans(accounts[1], 0, 10, 1, 0, 0); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData[0]["loanId"], loan_id);
            assert.equal(loansData[0]["loanToken"], SUSD.address);
            assert.equal(loansData[0]["collateralToken"], RBTC.address);
        });

        it("should get a loanType 2: a non-margin trade loan", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getUserLoans(borrower, 0, 10, 2, 0, 0); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData[0]["loanId"], loan_id);
            assert.equal(loansData[0]["loanToken"], SUSD.address);
            assert.equal(loansData[0]["collateralToken"], RBTC.address);
        });

        it("Coverage to avoid final conditional (itemCount < count) on getUserLoans", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getUserLoans(borrower, 0, 1, 2, 0, 0); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData[0]["loanId"], loan_id);
            assert.equal(loansData[0]["loanToken"], SUSD.address);
            assert.equal(loansData[0]["collateralToken"], RBTC.address);
        });

        it("Coverage to meet the conditional (start >= end) on getUserLoans", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getUserLoans(borrower, 1, 1, 2, 0, 0); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData.length, 0);
        });
    });

    describe("Test LoanMaintenance::getUserLoans and getActiveLoans (V2 LoanData)", () => {
        it("should return empty if start >= end", async () => {
            // no loan created
            const loansData = await sovryn.getUserLoansV2(accounts[1], 0, 10, 0, 0, 0); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            assert.equal(loansData.length, 0);
        });

        it("should return empty if count == 0", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getUserLoansV2(borrower, 0, 0, 0, 0, 0); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            assert.equal(loansData.length, 0);
        });

        it("should exist a loan, check values", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getUserLoansV2(borrower, 0, 10, 0, 0, 0); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData[0]["loanId"], loan_id);
            assert.equal(loansData[0]["loanToken"], SUSD.address);
            assert.equal(loansData[0]["collateralToken"], RBTC.address);
            assert.equal(loansData[0]["borrower"], borrower);
        });

        it("should not exist an unsafe loan", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            // Check UnsafeOnly, no results to expect
            const loansDataUnsafeOnly = await sovryn.getUserLoansV2(borrower, 0, 10, 0, 0, true); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            // console.log("loansDataUnsafeOnly = ", loansDataUnsafeOnly);

            assert.equal(loansDataUnsafeOnly.length, 0);
        });

        it("should exist an active loan, check values", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getActiveLoansV2(0, 10, 0); /// @dev parameters: start, count, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData[0]["loanId"], loan_id);
            assert.equal(loansData[0]["loanToken"], SUSD.address);
            assert.equal(loansData[0]["collateralToken"], RBTC.address);
            assert.equal(loansData[0]["borrower"], borrower);
        });

        it("Coverage to avoid final conditional (itemCount < count) on getActiveLoans", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getActiveLoansV2(0, 1, 0); /// @dev parameters: start, count, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData[0]["loanId"], loan_id);
            assert.equal(loansData[0]["loanToken"], SUSD.address);
            assert.equal(loansData[0]["collateralToken"], RBTC.address);
            assert.equal(loansData[0]["borrower"], borrower);
        });

        it("Coverage to meet the conditional (start >= end) on getActiveLoans", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getActiveLoansV2(1, 1, 0); /// @dev parameters: start, count, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData.length, 0);
        });

        it("should not exist any active unsafe loan", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            // Check UnsafeOnly, no results to expect
            const loansDataUnsafeOnly = await sovryn.getActiveLoansV2(0, 10, true); /// @dev parameters: start, count, unsafeOnly
            // console.log("loansDataUnsafeOnly = ", loansDataUnsafeOnly);

            assert.equal(loansDataUnsafeOnly.length, 0);
        });

        it("should get a loanType 1: a margin trade loan", async () => {
            // prepare the test
            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                accounts[1]
            );

            const loansData = await sovryn.getUserLoansV2(accounts[1], 0, 10, 1, 0, 0); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData[0]["loanId"], loan_id);
            assert.equal(loansData[0]["loanToken"], SUSD.address);
            assert.equal(loansData[0]["collateralToken"], RBTC.address);
            assert.equal(loansData[0]["borrower"], accounts[1]);
        });

        it("should get a loanType 2: a non-margin trade loan", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getUserLoansV2(borrower, 0, 10, 2, 0, 0); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData[0]["loanId"], loan_id);
            assert.equal(loansData[0]["loanToken"], SUSD.address);
            assert.equal(loansData[0]["collateralToken"], RBTC.address);
            assert.equal(loansData[0]["borrower"], borrower);
        });

        it("Coverage to avoid final conditional (itemCount < count) on getUserLoans", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getUserLoansV2(borrower, 0, 1, 2, 0, 0); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData[0]["loanId"], loan_id);
            assert.equal(loansData[0]["loanToken"], SUSD.address);
            assert.equal(loansData[0]["collateralToken"], RBTC.address);
            assert.equal(loansData[0]["borrower"], borrower);
        });

        it("Coverage to meet the conditional (start >= end) on getUserLoans", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const loansData = await sovryn.getUserLoansV2(borrower, 1, 1, 2, 0, 0); /// @dev parameters: user, start, count, loanType, isLender, unsafeOnly
            // console.log("loansData = ", loansData);

            assert.equal(loansData.length, 0);
        });
    });

    describe("Test set new special rebates.", () => {
        it("Test set new special rebates for specific pairs", async () => {
            const invalidValue = wei("1001", "ether");
            await expectRevert(
                sovryn.setSpecialRebates(SUSD.address, RBTC.address, 0, { from: accounts[8] }),
                "unauthorized"
            );
            await expectRevert(
                sovryn.setSpecialRebates(SUSD.address, RBTC.address, invalidValue),
                "Special fee rebate is too high"
            );

            const validValue = wei("200", "ether");
            await sovryn.setSpecialRebates(SUSD.address, RBTC.address, validValue);
            expect(
                (await sovryn.specialRebates(SUSD.address, RBTC.address)).toString(),
                "Incorrect new special fee rebates"
            ).to.be.equal(validValue.toString());
        });
    });

    describe("Test extending and reducing loan durations.", () => {
        /*
			At this moment the maxLoanTerm is always 28 because it is hardcoded in setupLoanParams.
			So there are only fix-term loans.
		*/
        it("Test extend fix term loan duration should fail", async () => {
            // prepare the test
            const [loan_id, trader, loan_token_sent] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );
            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            await expectRevert(
                loanMaintenance.extendLoanDuration(loan_id, loan_token_sent, false, {
                    from: trader,
                }),
                "indefinite-term only"
            );
        });

        /*
			Extend the loan duration and see if the new timestamp is the expected, the interest increase,
			the borrower SUSD balance decrease and the sovryn SUSD balance increase
		*/
        it("Test extend loan duration", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );
            const initial_loan = await sovryn.getLoan(loan_id);
            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);
            const initial_loan_token_lender_balance = await SUSD.balanceOf(sovryn.address);

            const days_to_extend = new BN(10);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const deposit_amount = owed_per_day.mul(days_to_extend);

            // Approve the transfer of loan token
            await SUSD.mint(borrower, deposit_amount);
            await SUSD.approve(sovryn.address, deposit_amount, { from: borrower });
            const initial_borrower_balance = await SUSD.balanceOf(borrower);

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            await loanMaintenance.extendLoanDuration(loan_id, deposit_amount, false, {
                from: borrower,
            });

            const end_loan_interest_data = await sovryn.getLoanInterestData(loan_id);
            const end_loan = await sovryn.getLoan(loan_id);

            expect(
                end_loan["endTimestamp"] ==
                    parseInt(initial_loan["endTimestamp"]) +
                        days_to_extend.toNumber() * 24 * 60 * 60
            ).to.be.true;
            expect(
                end_loan_interest_data["interestDepositTotal"].eq(
                    initial_loan_interest_data["interestDepositTotal"].add(deposit_amount)
                )
            ).to.be.true;
            expect(
                (await SUSD.balanceOf(borrower)).eq(initial_borrower_balance.sub(deposit_amount))
            ).to.be.true;
            // Due to block timestamp could be paying outstanding interest to lender or not
            expect(
                (await SUSD.balanceOf(sovryn.address)).lte(
                    initial_loan_token_lender_balance.add(deposit_amount)
                )
            ).to.be.true;
        });

        it("Test extend loan duration and loan endtime passed but the loan remained open", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );
            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);
            const loanMaintenance = await LoanMaintenance.at(sovryn.address);

            const days_to_extend = new BN(10);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const deposit_amount = owed_per_day.mul(days_to_extend);

            // Approve the transfer of loan token
            await SUSD.mint(borrower, deposit_amount);
            await SUSD.approve(sovryn.address, deposit_amount, { from: borrower });

            // 5 days after loan endtime is overpassed
            await increaseTime(15 * 86400);
            await expectRevert(
                loanMaintenance.extendLoanDuration(loan_id, deposit_amount, false, {
                    from: borrower,
                }),
                "loan too short"
            );

            // 20 days after loan endtime is overpassed
            await increaseTime(15 * 86400);
            await expectRevert(
                loanMaintenance.extendLoanDuration(loan_id, deposit_amount, false, {
                    from: borrower,
                }),
                "deposit cannot cover back interest"
            );
        });

        it("Test extend loan_duration 0 deposit should fail", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );
            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            await expectRevert(
                loanMaintenance.extendLoanDuration(loan_id, 0, false, { from: borrower }),
                "depositAmount is 0"
            );
        });

        it("Test extend closed loan_duration should fail", async () => {
            // prepare the test
            const [loan_id, borrower, , , , , args] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );
            const collateral = args["newCollateral"];
            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_extend = new BN(10);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const deposit_amount = owed_per_day.mul(days_to_extend);

            await sovryn.closeWithSwap(loan_id, borrower, collateral, false, {
                from: borrower,
            });

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            await expectRevert(
                loanMaintenance.extendLoanDuration(loan_id, deposit_amount, false, {
                    from: borrower,
                }),
                "loan is closed"
            );
        });

        it("Test extend loan_duration user unauthorized should fail", async () => {
            // prepare the test
            const [loan_id, , receiver, , , ,] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );
            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_extend = new BN(10);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const deposit_amount = owed_per_day.mul(days_to_extend);

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            await expectRevert(
                loanMaintenance.extendLoanDuration(loan_id, deposit_amount, true, {
                    from: receiver,
                }),
                "unauthorized"
            );
        });

        /*
			Extend the loan duration with collateral and see if the new timestamp is the expected, the interest increase,
			the loan's collateral decrease, sovryn SUSD balance increase and RBTC decrease
		*/
        it("Test extend loan_duration with collateral", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const initial_loan = await sovryn.getLoan(loan_id);
            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);
            const initial_loan_token_lender_balance = await SUSD.balanceOf(sovryn.address);
            const initial_collateral_token_lender_balance = await RBTC.balanceOf(sovryn.address);

            const days_to_extend = new BN(10);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            let deposit_amount = owed_per_day.mul(days_to_extend);

            const { rate, precision } = await priceFeeds.queryRate(RBTC.address, SUSD.address);
            let deposit_amount_in_collateral = deposit_amount.mul(precision).div(rate);

            // if the actual rate is exactly the same as the worst case rate, we get rounding issues. So, add a small buffer.
            // buffer = min(estimatedSourceAmount/1000 , sourceBuffer) with sourceBuffer = 10000
            // code from SwapsImplSovrynSwap.sol

            let buffer = deposit_amount_in_collateral.div(new BN(1000));
            if (buffer.gt(new BN(10000))) buffer = new BN(10000);
            deposit_amount_in_collateral = deposit_amount_in_collateral.add(buffer);

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            const { receipt } = await loanMaintenance.extendLoanDuration(
                loan_id,
                deposit_amount,
                true,
                { from: borrower }
            );
            const decode = decodeLogs(receipt.rawLogs, SwapsEvents, "LoanSwap");
            const loanSwapEvent = decode[0].args;
            deposit_amount = new BN(loanSwapEvent["destAmount"]);

            const end_loan_interest_data = await sovryn.getLoanInterestData(loan_id);
            const end_loan = await sovryn.getLoan(loan_id);

            expect(
                end_loan["endTimestamp"] ==
                    parseInt(initial_loan["endTimestamp"]) +
                        days_to_extend.toNumber() * 24 * 60 * 60
            ).to.be.true;
            expect(
                end_loan_interest_data["interestDepositTotal"].eq(
                    initial_loan_interest_data["interestDepositTotal"].add(deposit_amount)
                )
            ).to.be.true;
            expect(new BN(end_loan["collateral"])).to.be.a.bignumber.eq(
                new BN(initial_loan["collateral"]).sub(deposit_amount_in_collateral)
            );
            expect(await RBTC.balanceOf(sovryn.address)).to.be.a.bignumber.eq(
                initial_collateral_token_lender_balance.sub(deposit_amount_in_collateral)
            );
            expect(
                (await SUSD.balanceOf(sovryn.address)).lte(
                    initial_loan_token_lender_balance.add(deposit_amount)
                )
            ).to.be.true;
        });

        it("EarnRewardFail events should be fired if lockedSOV reverted when extend loan_duration with collateral sov token reward (special rebates not set or 0)", async () => {
            // prepare the test
            await sovryn.setLockedSOVAddress(
                (
                    await LockedSOVFailedMockup.new(SOV.address, [owner])
                ).address
            );
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts,
                (withdraw_amount = new BN(10).mul(oneEth).toString()),
                (margin = new BN(50).mul(oneEth).toString()),
                (duration_in_seconds = 60 * 60 * 24 * 20)
            );

            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_extend = new BN(10);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const deposit_amount = owed_per_day.mul(days_to_extend);

            await increaseTime(10 * 24 * 60 * 60);
            lockedSOV = await LockedSOVFailedMockup.at(await sovryn.lockedSOVAddress());
            const borrower_initial_balance_before_extend = (await SOV.balanceOf(borrower)).add(
                await lockedSOV.getLockedBalance(borrower)
            );

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            const { receipt } = await loanMaintenance.extendLoanDuration(
                loan_id,
                deposit_amount,
                true,
                { from: borrower }
            );
            const borrower_initial_balance = borrower_initial_balance_before_extend.sub(
                (await SOV.balanceOf(borrower)).add(await lockedSOV.getLockedBalance(borrower))
            );

            expect(borrower_initial_balance_before_extend.toString()).to.eq(
                borrower_initial_balance.toString()
            );

            const feeRebatePercent = await sovryn.feeRebatePercent();
            const decode = decodeLogs(receipt.rawLogs, FeesEvents, "EarnRewardFail");
            const args = decode[0].args;
            expect(args["receiver"] == borrower).to.be.true;
            expect(args["token"] == SOV.address).to.be.true;
            expect(args["loanId"] == loan_id).to.be.true;
            expect(args["feeRebatePercent"] == feeRebatePercent).to.be.true;
            expect(args["basisPoint"] == 0).to.be.true;
        });

        it("EarnRewardFail events should be fired if lockedSOV reverted when extend loan_duration with collateral sov token reward (special rebates not set or 0) with basis point applied", async () => {
            const basisPoint = 9000;
            // prepare the test
            await sovryn.setLockedSOVAddress(
                (
                    await LockedSOVFailedMockup.new(SOV.address, [owner])
                ).address
            );
            await sovryn.setTradingRebateRewardsBasisPoint(basisPoint);
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts,
                (withdraw_amount = new BN(10).mul(oneEth).toString()),
                (margin = new BN(50).mul(oneEth).toString()),
                (duration_in_seconds = 60 * 60 * 24 * 20)
            );

            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_extend = new BN(10);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const deposit_amount = owed_per_day.mul(days_to_extend);

            await increaseTime(10 * 24 * 60 * 60);
            lockedSOV = await LockedSOVFailedMockup.at(await sovryn.lockedSOVAddress());
            const borrower_initial_balance_before_extend = (await SOV.balanceOf(borrower)).add(
                await lockedSOV.getLockedBalance(borrower)
            );

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            const { receipt } = await loanMaintenance.extendLoanDuration(
                loan_id,
                deposit_amount,
                true,
                { from: borrower }
            );
            const borrower_initial_balance = borrower_initial_balance_before_extend.sub(
                (await SOV.balanceOf(borrower)).add(await lockedSOV.getLockedBalance(borrower))
            );

            expect(borrower_initial_balance_before_extend.toString()).to.eq(
                borrower_initial_balance.toString()
            );

            const feeRebatePercent = await sovryn.feeRebatePercent();
            const decode = decodeLogs(receipt.rawLogs, FeesEvents, "EarnRewardFail");
            const args = decode[0].args;
            expect(args["receiver"] == borrower).to.be.true;
            expect(args["token"] == SOV.address).to.be.true;
            expect(args["loanId"] == loan_id).to.be.true;
            expect(args["feeRebatePercent"] == feeRebatePercent).to.be.true;
            expect(args["basisPoint"] == basisPoint).to.be.true;
        });

        it("EarnRewardFail events should be fired if lockedSOV reverted when extend loan_duration with collateral sov token reward payment (special rebates is set)", async () => {
            // prepare the test
            await sovryn.setLockedSOVAddress(
                (
                    await LockedSOVFailedMockup.new(SOV.address, [owner])
                ).address
            );
            await sovryn.setSpecialRebates(SUSD.address, RBTC.address, wei("200", "ether"));
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts,
                (withdraw_amount = new BN(10).mul(oneEth).toString()),
                (margin = new BN(50).mul(oneEth).toString()),
                (duration_in_seconds = 60 * 60 * 24 * 20)
            );

            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_extend = new BN(10);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const deposit_amount = owed_per_day.mul(days_to_extend);

            await increaseTime(10 * 24 * 60 * 60);
            lockedSOV = await LockedSOVFailedMockup.at(await sovryn.lockedSOVAddress());
            const borrower_initial_balance_before_extend = (await SOV.balanceOf(borrower)).add(
                await lockedSOV.getLockedBalance(borrower)
            );

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            const { receipt } = await loanMaintenance.extendLoanDuration(
                loan_id,
                deposit_amount,
                true,
                { from: borrower }
            );
            const borrower_initial_balance = borrower_initial_balance_before_extend.sub(
                (await SOV.balanceOf(borrower)).add(await lockedSOV.getLockedBalance(borrower))
            );

            expect(borrower_initial_balance_before_extend.toString()).to.eq(
                borrower_initial_balance.toString()
            );

            const feeRebatePercent = await sovryn.specialRebates(SUSD.address, RBTC.address);
            const decode = decodeLogs(receipt.rawLogs, FeesEvents, "EarnRewardFail");
            const args = decode[0].args;
            expect(args["receiver"] == borrower).to.be.true;
            expect(args["token"] == SOV.address).to.be.true;
            expect(args["loanId"] == loan_id).to.be.true;
            expect(args["feeRebatePercent"] == feeRebatePercent).to.be.true;
            expect(args["basisPoint"] == 0).to.be.true;
        });

        it("Test extend loan_duration with collateral sov token reward payment (special rebates not set / 0)", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts,
                (withdraw_amount = new BN(10).mul(oneEth).toString()),
                (margin = new BN(50).mul(oneEth).toString()),
                (duration_in_seconds = 60 * 60 * 24 * 20)
            );

            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_extend = new BN(10);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const deposit_amount = owed_per_day.mul(days_to_extend);

            await increaseTime(10 * 24 * 60 * 60);
            lockedSOV = await LockedSOVMockup.at(await sovryn.lockedSOVAddress());
            const borrower_initial_balance_before_extend = (await SOV.balanceOf(borrower)).add(
                await lockedSOV.getLockedBalance(borrower)
            );

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            const { receipt } = await loanMaintenance.extendLoanDuration(
                loan_id,
                deposit_amount,
                true,
                { from: borrower }
            );
            const borrower_initial_balance = borrower_initial_balance_before_extend.sub(
                (await SOV.balanceOf(borrower)).add(await lockedSOV.getLockedBalance(borrower))
            );

            const feeRebatePercent = await sovryn.feeRebatePercent();
            const decode = decodeLogs(receipt.rawLogs, FeesEvents, "EarnReward");
            const args = decode[0].args;
            expect(args["receiver"] == borrower).to.be.true;
            expect(args["token"] == SOV.address).to.be.true;
            expect(args["loanId"] == loan_id).to.be.true;
            expect(args["amount"]).to.eq(
                (await SOV.balanceOf(borrower)).sub(borrower_initial_balance).toString()
            );
            expect(args["feeRebatePercent"] == feeRebatePercent).to.be.true;
            expect(args["basisPoint"] == 0).to.be.true;
        });

        it("Test extend loan_duration with collateral sov token reward payment (special rebates is set) & basis point applied", async () => {
            const basisPoint = 9000;
            // prepare the test
            await sovryn.setSpecialRebates(SUSD.address, RBTC.address, wei("200", "ether"));
            await sovryn.setTradingRebateRewardsBasisPoint(basisPoint);
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts,
                (withdraw_amount = new BN(10).mul(oneEth).toString()),
                (margin = new BN(50).mul(oneEth).toString()),
                (duration_in_seconds = 60 * 60 * 24 * 20)
            );

            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_extend = new BN(10);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const deposit_amount = owed_per_day.mul(days_to_extend);

            await increaseTime(10 * 24 * 60 * 60);
            lockedSOV = await LockedSOVMockup.at(await sovryn.lockedSOVAddress());
            const borrower_initial_balance_before_extend = (await SOV.balanceOf(borrower)).add(
                await lockedSOV.getLockedBalance(borrower)
            );
            const borrower_initial_unlock_balance_before_extend = (
                await SOV.balanceOf(borrower)
            ).add(await lockedSOV.getUnlockedBalance(borrower));

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            const { receipt } = await loanMaintenance.extendLoanDuration(
                loan_id,
                deposit_amount,
                true,
                { from: borrower }
            );

            const feeRebatePercent = await sovryn.specialRebates(SUSD.address, RBTC.address);
            const decode = decodeLogs(receipt.rawLogs, FeesEvents, "EarnReward");
            const args = decode[0].args;
            expect(args["receiver"] == borrower).to.be.true;
            expect(args["token"] == SOV.address).to.be.true;
            expect(args["loanId"] == loan_id).to.be.true;
            expect(args["feeRebatePercent"] == feeRebatePercent).to.be.true;
            expect(args["basisPoint"] == basisPoint).to.be.true;

            // vested SOV rewards
            vestedSOVRewards = new BN(args["amount"])
                .mul(new BN(10000).sub(new BN(basisPoint)))
                .divRound(new BN(10000));
            /// @dev The following check may suffer rounding error
            /// @dev So, we ignore differences in least significant digits
            expect(
                Math.abs(
                    vestedSOVRewards
                        .add(borrower_initial_balance_before_extend)
                        .sub(await lockedSOV.getLockedBalance(borrower))
                        .toNumber()
                ) < 100
            ).to.be.true;

            // liquid SOV rewards
            liquidSOVRewards = new BN(args["amount"])
                .mul(new BN(basisPoint))
                .divRound(new BN(10000));
            expect(liquidSOVRewards.toString()).to.eq(
                (await lockedSOV.getUnlockedBalance(borrower))
                    .sub(borrower_initial_unlock_balance_before_extend)
                    .toString()
            );
        });

        it("Test extend loan_duration with collateral sov token reward payment (special rebates is set)", async () => {
            // prepare the test
            await sovryn.setSpecialRebates(SUSD.address, RBTC.address, wei("200", "ether"));
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts,
                (withdraw_amount = new BN(10).mul(oneEth).toString()),
                (margin = new BN(50).mul(oneEth).toString()),
                (duration_in_seconds = 60 * 60 * 24 * 20)
            );

            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_extend = new BN(10);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const deposit_amount = owed_per_day.mul(days_to_extend);

            await increaseTime(10 * 24 * 60 * 60);
            lockedSOV = await LockedSOVMockup.at(await sovryn.lockedSOVAddress());
            const borrower_initial_balance_before_extend = (await SOV.balanceOf(borrower)).add(
                await lockedSOV.getLockedBalance(borrower)
            );

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            const { receipt } = await loanMaintenance.extendLoanDuration(
                loan_id,
                deposit_amount,
                true,
                { from: borrower }
            );
            const borrower_initial_balance = borrower_initial_balance_before_extend.sub(
                (await SOV.balanceOf(borrower)).add(await lockedSOV.getLockedBalance(borrower))
            );

            const feeRebatePercent = await sovryn.specialRebates(SUSD.address, RBTC.address);
            const decode = decodeLogs(receipt.rawLogs, FeesEvents, "EarnReward");
            const args = decode[0].args;
            expect(args["receiver"] == borrower).to.be.true;
            expect(args["token"] == SOV.address).to.be.true;
            expect(args["loanId"] == loan_id).to.be.true;
            expect(args["amount"]).to.eq(
                (await SOV.balanceOf(borrower)).sub(borrower_initial_balance).toString()
            );
            expect(args["feeRebatePercent"] == feeRebatePercent).to.be.true;
            expect(args["basisPoint"] == 0).to.be.true;
        });

        it("Test extend loan_duration with collateral and eth should fail", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_extend = new BN(10);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const deposit_amount = owed_per_day.mul(days_to_extend);

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            await expectRevert(
                loanMaintenance.extendLoanDuration(loan_id, deposit_amount, true, {
                    from: borrower,
                    value: deposit_amount,
                }),
                "wrong asset sent"
            );
        });

        it("Test reduce fix term loan duration should fail", async () => {
            // prepare the test
            const [loan_id, trader, loan_token_sent] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );
            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            await expectRevert(
                loanMaintenance.reduceLoanDuration(loan_id, trader, loan_token_sent, {
                    from: trader,
                }),
                "indefinite-term only"
            );
        });

        /*
			Reduce the loan duration and see if the new timestamp is the expected, the interest decrease,
			the receiver SUSD balance increase and the sovryn SUSD balance decrease
		*/
        it("Test reduce loan duration", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );
            const initial_loan = await sovryn.getLoan(loan_id);
            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);
            const initial_loan_token_lender_balance = await SUSD.balanceOf(sovryn.address);

            const days_to_reduce = new BN(5);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const withdraw_amount = owed_per_day.mul(days_to_reduce);

            const receiver = accounts[3];
            const initial_receiver_balance = await SUSD.balanceOf(receiver);

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            await loanMaintenance.reduceLoanDuration(loan_id, receiver, withdraw_amount, {
                from: borrower,
            });

            const end_loan_interest_data = await sovryn.getLoanInterestData(loan_id);
            const end_loan = await sovryn.getLoan(loan_id);

            expect(
                end_loan["endTimestamp"] ==
                    parseInt(initial_loan["endTimestamp"]) -
                        days_to_reduce.toNumber() * 24 * 60 * 60
            ).to.be.true;
            expect(
                end_loan_interest_data["interestDepositTotal"].eq(
                    initial_loan_interest_data["interestDepositTotal"].sub(withdraw_amount)
                )
            ).to.be.true;
            expect(
                (await SUSD.balanceOf(receiver)).eq(initial_receiver_balance.add(withdraw_amount))
            ).to.be.true;
            // Due to block timestamp could be paying outstanding interest to lender or not
            expect(
                (await SUSD.balanceOf(sovryn.address)).lte(
                    initial_loan_token_lender_balance.sub(withdraw_amount)
                )
            ).to.be.true;
        });

        it("EarnRewardFail events should be fired if lockedSOV reverted when Test reduce loan_duration with collateral sov token reward payment (special rebates not set or 0", async () => {
            // prepare the test
            await sovryn.setLockedSOVAddress(
                (
                    await LockedSOVFailedMockup.new(SOV.address, [owner])
                ).address
            );
            const duration_in_seconds = 20 * 24 * 60 * 60; // 20 days
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts,
                new BN(10).mul(oneEth).toString(),
                new BN(50).mul(oneEth).toString(),
                duration_in_seconds
            );

            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_reduce = new BN(5);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const withdraw_amount = owed_per_day.mul(days_to_reduce);

            const receiver = accounts[3];

            await increaseTime(10 * 24 * 60 * 60);
            lockedSOV = await LockedSOVMockup.at(await sovryn.lockedSOVAddress());
            const borrower_initial_balance_before_reduce = (await SOV.balanceOf(borrower)).add(
                await lockedSOV.getLockedBalance(borrower)
            );

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            const { receipt } = await loanMaintenance.reduceLoanDuration(
                loan_id,
                receiver,
                withdraw_amount,
                { from: borrower }
            );

            const borrower_initial_balance = borrower_initial_balance_before_reduce.sub(
                (await SOV.balanceOf(borrower)).add(await lockedSOV.getLockedBalance(borrower))
            );

            expect(borrower_initial_balance_before_reduce.toString()).to.eq(
                borrower_initial_balance.toString()
            );

            const feeRebatePercent = await sovryn.feeRebatePercent();
            const decode = decodeLogs(receipt.rawLogs, FeesEvents, "EarnRewardFail");
            const args = decode[0].args;
            expect(args["receiver"] == borrower).to.be.true;
            expect(args["token"] == SOV.address).to.be.true;
            expect(args["loanId"] == loan_id).to.be.true;
            expect(args["feeRebatePercent"] == feeRebatePercent).to.be.true;
            expect(args["basisPoint"] == 0).to.be.true;
        });

        it("EarnRewardFail events should be fired if lockedSOV reverted when Test reduce loan_duration with collateral sov token reward payment (special rebates is set)", async () => {
            // prepare the test
            await sovryn.setLockedSOVAddress(
                (
                    await LockedSOVFailedMockup.new(SOV.address, [owner])
                ).address
            );
            await sovryn.setSpecialRebates(SUSD.address, RBTC.address, wei("200", "ether"));
            const duration_in_seconds = 20 * 24 * 60 * 60; // 20 days
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts,
                new BN(10).mul(oneEth).toString(),
                new BN(50).mul(oneEth).toString(),
                duration_in_seconds
            );

            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_reduce = new BN(5);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const withdraw_amount = owed_per_day.mul(days_to_reduce);

            const receiver = accounts[3];

            await increaseTime(10 * 24 * 60 * 60);
            lockedSOV = await LockedSOVMockup.at(await sovryn.lockedSOVAddress());
            const borrower_initial_balance_before_reduce = (await SOV.balanceOf(borrower)).add(
                await lockedSOV.getLockedBalance(borrower)
            );

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            const { receipt } = await loanMaintenance.reduceLoanDuration(
                loan_id,
                receiver,
                withdraw_amount,
                { from: borrower }
            );

            const borrower_initial_balance = borrower_initial_balance_before_reduce.sub(
                (await SOV.balanceOf(borrower)).add(await lockedSOV.getLockedBalance(borrower))
            );

            expect(borrower_initial_balance_before_reduce.toString()).to.eq(
                borrower_initial_balance.toString()
            );

            const feeRebatePercent = await sovryn.specialRebates(SUSD.address, RBTC.address);
            const decode = decodeLogs(receipt.rawLogs, FeesEvents, "EarnRewardFail");
            const args = decode[0].args;
            expect(args["receiver"] == borrower).to.be.true;
            expect(args["token"] == SOV.address).to.be.true;
            expect(args["loanId"] == loan_id).to.be.true;
            expect(args["feeRebatePercent"] == feeRebatePercent).to.be.true;
            expect(args["basisPoint"] == 0).to.be.true;
        });

        it("EarnRewardFailed should be fired if protocol does not have enough dedicated SOV to pay the rebate rewards", async () => {
            const basisPoint = 9000;
            // prepare the test
            await set_demand_curve(loanToken);
            await lend_to_pool(loanToken, SUSD, owner);
            await sovryn.setSpecialRebates(SUSD.address, RBTC.address, wei("200", "ether"));
            await sovryn.setTradingRebateRewardsBasisPoint(basisPoint);
            await sovryn.withdrawProtocolToken(accounts[0], new BN(10).pow(new BN(20)));
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts,
                (withdraw_amount = new BN(10).mul(oneEth).toString()),
                (margin = new BN(50).mul(oneEth).toString()),
                (duration_in_seconds = 60 * 60 * 24 * 20)
            );

            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_extend = new BN(10);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const deposit_amount = owed_per_day.mul(days_to_extend);

            await increaseTime(10 * 24 * 60 * 60);
            lockedSOV = await LockedSOVMockup.at(await sovryn.lockedSOVAddress());
            const borrower_initial_balance_before_extend = (await SOV.balanceOf(borrower)).add(
                await lockedSOV.getLockedBalance(borrower)
            );
            const borrower_initial_unlock_balance_before_extend = (
                await SOV.balanceOf(borrower)
            ).add(await lockedSOV.getUnlockedBalance(borrower));

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            const { receipt } = await loanMaintenance.extendLoanDuration(
                loan_id,
                deposit_amount,
                true,
                { from: borrower }
            );

            const feeRebatePercent = await sovryn.specialRebates(SUSD.address, RBTC.address);
            const decode = decodeLogs(receipt.rawLogs, FeesEvents, "EarnRewardFail");
            const args = decode[0].args;
            expect(args["receiver"] == borrower).to.be.true;
            expect(args["token"] == SOV.address).to.be.true;
            expect(args["loanId"] == loan_id).to.be.true;
            expect(args["feeRebatePercent"] == feeRebatePercent).to.be.true;
            expect(args["basisPoint"] == basisPoint).to.be.true;

            // vested SOV rewards
            expect((await lockedSOV.getLockedBalance(borrower)).toString()).to.eq(
                new BN(0).toString()
            );

            expect((await lockedSOV.getUnlockedBalance(borrower)).toString()).to.eq(
                new BN(0).toString()
            );
        });

        it("Test reduce loan_duration 0 withdraw should fail", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );
            const receiver = accounts[3];

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            await expectRevert(
                loanMaintenance.reduceLoanDuration(loan_id, receiver, 0, { from: borrower }),
                "withdrawAmount is 0"
            );
        });

        it("Test reduce loan_duration with collateral sov token reward payment (special rebates not set or 0)", async () => {
            // prepare the test
            const duration_in_seconds = 20 * 24 * 60 * 60; // 20 days
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts,
                new BN(10).mul(oneEth).toString(),
                new BN(50).mul(oneEth).toString(),
                duration_in_seconds
            );

            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_reduce = new BN(5);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const withdraw_amount = owed_per_day.mul(days_to_reduce);

            const receiver = accounts[3];

            await increaseTime(10 * 24 * 60 * 60);
            lockedSOV = await LockedSOVMockup.at(await sovryn.lockedSOVAddress());
            const borrower_initial_balance_before_reduce = (await SOV.balanceOf(borrower)).add(
                await lockedSOV.getLockedBalance(borrower)
            );

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            const { receipt } = await loanMaintenance.reduceLoanDuration(
                loan_id,
                receiver,
                withdraw_amount,
                { from: borrower }
            );

            const borrower_initial_balance = borrower_initial_balance_before_reduce.sub(
                (await SOV.balanceOf(borrower)).add(await lockedSOV.getLockedBalance(borrower))
            );

            const feeRebatePercent = await sovryn.feeRebatePercent();
            const decode = decodeLogs(receipt.rawLogs, FeesEvents, "EarnReward");
            const args = decode[0].args;
            expect(args["receiver"] == borrower).to.be.true;
            expect(args["token"] == SOV.address).to.be.true;
            expect(args["loanId"] == loan_id).to.be.true;
            expect(args["amount"]).to.eq(
                (await SOV.balanceOf(borrower)).sub(borrower_initial_balance).toString()
            );
            expect(args["feeRebatePercent"] == feeRebatePercent).to.be.true;
            expect(args["basisPoint"] == 0).to.be.true;
        });

        it("Test reduce loan_duration with collateral sov token reward payment (special rebates is set)", async () => {
            // prepare the test
            await sovryn.setSpecialRebates(SUSD.address, RBTC.address, wei("200", "ether"));
            const duration_in_seconds = 20 * 24 * 60 * 60; // 20 days
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts,
                new BN(10).mul(oneEth).toString(),
                new BN(50).mul(oneEth).toString(),
                duration_in_seconds
            );

            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_reduce = new BN(5);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const withdraw_amount = owed_per_day.mul(days_to_reduce);

            const receiver = accounts[3];

            await increaseTime(10 * 24 * 60 * 60);
            lockedSOV = await LockedSOVMockup.at(await sovryn.lockedSOVAddress());
            const borrower_initial_balance_before_reduce = (await SOV.balanceOf(borrower)).add(
                await lockedSOV.getLockedBalance(borrower)
            );

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            const { receipt } = await loanMaintenance.reduceLoanDuration(
                loan_id,
                receiver,
                withdraw_amount,
                { from: borrower }
            );

            const borrower_initial_balance = borrower_initial_balance_before_reduce.sub(
                (await SOV.balanceOf(borrower)).add(await lockedSOV.getLockedBalance(borrower))
            );

            const feeRebatePercent = await sovryn.specialRebates(SUSD.address, RBTC.address);
            const decode = decodeLogs(receipt.rawLogs, FeesEvents, "EarnReward");
            const args = decode[0].args;
            expect(args["receiver"] == borrower).to.be.true;
            expect(args["token"] == SOV.address).to.be.true;
            expect(args["loanId"] == loan_id).to.be.true;
            expect(args["amount"]).to.eq(
                (await SOV.balanceOf(borrower)).sub(borrower_initial_balance).toString()
            );
            expect(args["feeRebatePercent"] == feeRebatePercent).to.be.true;
            expect(args["basisPoint"] == 0).to.be.true;
        });

        it("Test reduce loan_duration 0 withdraw should fail", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );
            const receiver = accounts[3];

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            await expectRevert(
                loanMaintenance.reduceLoanDuration(loan_id, receiver, 0, { from: borrower }),
                "withdrawAmount is 0"
            );
        });

        it("Test reduce closed loan_duration should fail", async () => {
            // prepare the test
            const [loan_id, borrower, , , , , args] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );
            const collateral = args["newCollateral"];
            const receiver = accounts[3];

            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);
            await sovryn.closeWithSwap(loan_id, borrower, collateral, false, {
                from: borrower,
            });

            const days_to_reduce = new BN(5);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const withdraw_amount = owed_per_day.mul(days_to_reduce);

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            await expectRevert(
                loanMaintenance.reduceLoanDuration(loan_id, receiver, withdraw_amount, {
                    from: borrower,
                }),
                "loan is closed"
            );
        });

        it("Test reduce loan_duration user unauthorized should fail", async () => {
            // prepare the test
            const [loan_id] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const receiver = accounts[3];
            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_reduce = new BN(5);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const withdraw_amount = owed_per_day.mul(days_to_reduce);

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            await expectRevert(
                loanMaintenance.reduceLoanDuration(loan_id, receiver, withdraw_amount, {
                    from: receiver,
                }),
                "unauthorized"
            );
        });

        it("Test reduce loan_duration loan term ended should fail", async () => {
            // prepare the test
            const [loan_id, borrower] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const receiver = accounts[3];
            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const days_to_reduce = new BN(5);
            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            const withdraw_amount = owed_per_day.mul(days_to_reduce);

            const initial_loan = await sovryn.getLoan(loan_id);
            const loan_end_timestamp = parseInt(initial_loan["endTimestamp"]);

            await increaseTime(loan_end_timestamp);

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            await expectRevert(
                loanMaintenance.reduceLoanDuration(loan_id, receiver, withdraw_amount, {
                    from: borrower,
                }),
                "loan term has ended"
            );
        });

        it("Test reduce loan_duration withdraw amount too high should fail", async () => {
            // prepare the test
            const [loan_id, borrower, , withdraw_amount] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const receiver = accounts[3];

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            await expectRevert(
                loanMaintenance.reduceLoanDuration(
                    loan_id,
                    receiver,
                    new BN(withdraw_amount).mul(new BN(2)),
                    { from: borrower }
                ),
                "withdraw amount too high"
            );
        });

        it("Test reduce loan_duration less than one hour should fail", async () => {
            // prepare the test
            const [loan_id, borrower, , , duration_in_seconds] = await borrow_indefinite_loan(
                loanToken,
                sovryn,
                SUSD,
                RBTC,
                accounts
            );

            const receiver = accounts[3];
            const initial_loan_interest_data = await sovryn.getLoanInterestData(loan_id);

            const owed_per_day = initial_loan_interest_data["interestOwedPerDay"];
            // reduce the loan upto 50 minutes
            const withdraw_amount = owed_per_day
                .mul(new BN(duration_in_seconds - 50 * 60))
                .div(new BN(24 * 60 * 60));

            const loanMaintenance = await LoanMaintenance.at(sovryn.address);
            await expectRevert(
                loanMaintenance.reduceLoanDuration(loan_id, receiver, withdraw_amount, {
                    from: borrower,
                }),
                "loan too short"
            );
        });
    });
});
