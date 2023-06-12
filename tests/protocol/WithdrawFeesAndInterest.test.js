/** Speed optimized on branch hardhatTestRefactor, 2021-10-01
 * Bottleneck found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 8.2s
 * After optimization: 5.9s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Moved some initialization code from tests to fixture.
 */

const { expect } = require("chai");

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { increaseTime, blockNumber } = require("../Utils/Ethereum.js");

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
    lend_to_pool,
    open_margin_trade_position,
} = require("../Utils/initializer.js");

const InterestUser = artifacts.require("InterestUser");

contract("ProtocolWithdrawFeeAndInterest", (accounts) => {
    let owner;
    let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, priceFeeds;

    async function deploymentAndInitFixture(_wallets, _provider) {
        // Deploying sovrynProtocol w/ generic function from initializer.js
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

        /// @dev SOV test token deployment w/ initializer.js
        sov = await getSOV(sovryn, priceFeeds, SUSD, accounts);

        loanToken = await getLoanToken(owner, sovryn, WRBTC, SUSD);
        loanTokenWRBTC = await getLoanTokenWRBTC(owner, sovryn, WRBTC, SUSD);
        await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

        /// @dev Optimization: Moved from common init for specific test
        await set_demand_curve(loanToken);
        await lend_to_pool(loanToken, SUSD, owner);
    }

    before(async () => {
        [owner] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    describe("Tests withdraw fees and interest ", () => {
        it("Test withdraw accrued interest", async () => {
            // prepare the test
            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );

            let num = await blockNumber();
            let lastBlock = await web3.eth.getBlock(num);
            const initial_block_timestamp = lastBlock.timestamp;

            const loan = await sovryn.getLoan(loan_id);
            //console.log("loan = " + loan);
            const lender = loanToken.address;

            // Time travel
            const time_until_loan_end = loan["endTimestamp"] - initial_block_timestamp;
            await increaseTime(time_until_loan_end);

            const end_interest_data_1 = await sovryn.getLenderInterestData(lender, SUSD.address);
            expect(end_interest_data_1["interestPaid"] == "0").to.be.true;
            // console.log("end_interest_data_1[interestUnPaid] = " + end_interest_data_1["interestUnPaid"]);
            // console.log("end_interest_data_1[interestFeePercent] = " + end_interest_data_1["interestFeePercent"]);

            const feesApplied = new BN(end_interest_data_1["interestUnPaid"])
                .mul(end_interest_data_1["interestFeePercent"])
                .div(new BN(10).pow(new BN(20)));

            // lend to pool to call settle interest which calls withdrawAccruedInterest
            // let tx = await lend_to_pool(loanToken, SUSD, owner);
            // Instead of using lend_to_pool, use explicit transactions in order to capture
            // the event PayInterestTransfer when loanToken.mint

            const lend_amount = new BN(10).pow(new BN(30)).toString();
            await SUSD.mint(lender, lend_amount);
            await SUSD.approve(loanToken.address, lend_amount);
            let tx = await loanToken.mint(lender, lend_amount);

            // Check the event PayInterestTransfer is reporting properly
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                InterestUser,
                "PayInterestTransfer",
                {
                    interestToken: loan["loanToken"],
                    lender: lender,
                    effectiveInterest: new BN(end_interest_data_1["interestUnPaid"]).sub(
                        feesApplied
                    ),
                }
            );

            const end_interest_data_2 = await sovryn.getLenderInterestData(lender, SUSD.address);

            num = await blockNumber();
            lastBlock = await web3.eth.getBlock(num);
            const second_block_timestamp = lastBlock.timestamp;

            const interest_owed_now = new BN(loan["endTimestamp"] - initial_block_timestamp)
                .mul(end_interest_data_1["interestOwedPerDay"])
                .div(new BN(24 * 60 * 60));

            expect(end_interest_data_2["interestOwedPerDay"].toString() != "0").to.be.true;
            expect(end_interest_data_2["interestPaid"].toString()).eq(
                interest_owed_now.toString()
            );
            expect(
                end_interest_data_2["interestPaidDate"].toNumber() - second_block_timestamp <= 2
            ).to.be.true;
            expect(
                end_interest_data_2["interestUnPaid"].eq(
                    end_interest_data_1["interestUnPaid"].sub(interest_owed_now)
                )
            );
        });

        /*
            Should successfully withdraw lending fees
            1. Set demand curve (fixture) 
            2. Lend to the pool (fixture)
            3. Make a margin trade (fixture)
            4. Set fees controller (address)
            5. Read lending fees
            6. Call withdraw lending fees
            7. Verify the right amount was paid out and the lending fees reduced on the smart contract 
        */
        it("Test withdraw lending fees", async () => {
            // prepare the test
            await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);

            await sovryn.setFeesController(accounts[0]);
            await increaseTime(100);

            await lend_to_pool(loanToken, SUSD, owner);

            // withdraw fees and verify
            const fees = await sovryn.lendingFeeTokensHeld(SUSD.address);
            await sovryn.withdrawLendingFees(SUSD.address, accounts[1], fees);
            const paid = await sovryn.lendingFeeTokensPaid(SUSD.address);

            expect(paid.eq(fees)).to.be.true;
            expect(await sovryn.lendingFeeTokensHeld(SUSD.address)).to.be.a.bignumber.eq(
                new BN(0)
            );
            expect(await SUSD.balanceOf(accounts[1])).to.be.a.bignumber.eq(fees);
        });

        it("should revert when withdrawing lending fees by no feesController", async () => {
            // Prepare the test
            await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);
            await sovryn.setFeesController(accounts[0]);
            await increaseTime(100);
            await lend_to_pool(loanToken, SUSD, owner);

            // Try to withdraw fees
            const fees = await sovryn.lendingFeeTokensHeld(SUSD.address);
            await expectRevert(
                sovryn.withdrawLendingFees(SUSD.address, accounts[1], fees, { from: accounts[1] }),
                "unauthorized"
            );
        });

        it("should ignore withdrawAmounts bigger than balance when withdrawing lending fees", async () => {
            // Prepare the test
            await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);
            await sovryn.setFeesController(accounts[0]);
            await increaseTime(100);
            await lend_to_pool(loanToken, SUSD, owner);

            // Withdraw fees and verify
            const fees = await sovryn.lendingFeeTokensHeld(SUSD.address);
            await sovryn.withdrawLendingFees(SUSD.address, accounts[1], fees.mul(new BN(2)));
            const paid = await sovryn.lendingFeeTokensPaid(SUSD.address);

            expect(paid.eq(fees)).to.be.true;
            expect(await sovryn.lendingFeeTokensHeld(SUSD.address)).to.be.a.bignumber.eq(
                new BN(0)
            );
            expect(await SUSD.balanceOf(accounts[1])).to.be.a.bignumber.eq(fees);
        });

        it("should return false when withdrawing amount 0 of lending fees", async () => {
            // Prepare the test
            await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);
            await sovryn.setFeesController(accounts[0]);
            await increaseTime(100);
            await lend_to_pool(loanToken, SUSD, owner);

            // Withdraw fees and verify
            const fees = await sovryn.lendingFeeTokensHeld(SUSD.address);
            let result = await sovryn.withdrawLendingFees.call(
                SUSD.address,
                accounts[1],
                new BN(0)
            );
            expect(result).to.be.false;
        });

        /*
            Should successfully withdraw trading fees
            1. Set demand curve (fixture) 
            2. Lend to the pool (fixture)
            3. Make a margin trade (fixture)
            4. Set fees controller (address)
            5. Read trading fees
            6. Call withdraw trading fees
            7. Verify the right amount was paid out and the trading fees reduced on the smart contract 
        */
        it("Test withdraw trading fees", async () => {
            // prepare the test
            await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);

            await sovryn.setFeesController(accounts[0]);
            await increaseTime(100);

            await lend_to_pool(loanToken, SUSD, owner);

            // withdraw fees and verify
            const fees = await sovryn.tradingFeeTokensHeld(SUSD.address);
            await sovryn.withdrawTradingFees(SUSD.address, accounts[1], fees);
            const paid = await sovryn.tradingFeeTokensPaid(SUSD.address);

            expect(paid.eq(fees)).to.be.true;
            expect(await sovryn.tradingFeeTokensHeld(SUSD.address)).to.be.a.bignumber.eq(
                new BN(0)
            );
            expect(await SUSD.balanceOf(accounts[1])).to.be.a.bignumber.eq(fees);
        });

        it("should revert when withdrawing trading fees by no feesController", async () => {
            // Prepare the test
            await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);
            await sovryn.setFeesController(accounts[0]);
            await increaseTime(100);
            await lend_to_pool(loanToken, SUSD, owner);

            // Try to withdraw fees
            const fees = await sovryn.lendingFeeTokensHeld(SUSD.address);
            await expectRevert(
                sovryn.withdrawTradingFees(SUSD.address, accounts[1], fees, { from: accounts[1] }),
                "unauthorized"
            );
        });

        it("should ignore withdrawAmounts bigger than balance when withdrawing trading fees", async () => {
            // Prepare the test
            await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);
            await sovryn.setFeesController(accounts[0]);
            await increaseTime(100);
            await lend_to_pool(loanToken, SUSD, owner);

            // Withdraw fees and verify
            const fees = await sovryn.tradingFeeTokensHeld(SUSD.address);
            await sovryn.withdrawTradingFees(SUSD.address, accounts[1], fees.mul(new BN(2)));
            const paid = await sovryn.tradingFeeTokensPaid(SUSD.address);

            expect(paid.eq(fees)).to.be.true;
            expect(await sovryn.tradingFeeTokensHeld(SUSD.address)).to.be.a.bignumber.eq(
                new BN(0)
            );
            expect(await SUSD.balanceOf(accounts[1])).to.be.a.bignumber.eq(fees);
        });

        it("should return false when withdrawing amount 0 of trading fees", async () => {
            // Prepare the test
            await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);
            await sovryn.setFeesController(accounts[0]);
            await increaseTime(100);
            await lend_to_pool(loanToken, SUSD, owner);

            // Withdraw fees and verify
            const fees = await sovryn.tradingFeeTokensHeld(SUSD.address);
            let result = await sovryn.withdrawTradingFees.call(
                SUSD.address,
                accounts[1],
                new BN(0)
            );
            expect(result).to.be.false;
        });

        /*
            Should successfully withdraw borrowing fees
            1. Set demand curve (fixture) 
            2. Lend to the pool (fixture)
            3. Make a margin trade (fixture)
            4. Set fees controller (address)
            5. Read borrowing fees
            6. Call withdraw borrowing fees
            7. Verify the right amount was paid out and the borrowing fees reduced on the smart contract 
        */
        /// @dev In this test borrowing fees are always 0
        ///   Borrowing fees are only accrued from torque loans
        ///   Added a new test on tests/other/LoanOpeningsBorrowOrTradeFromPool.test.js
        ///   checking withdrawBorrowingFees by using a torque loan.
        ///   So, this test has been commented out because it seems to be incomplete.
        // it("Test withdraw borrowing fees", async () => {
        // 	// prepare the test
        // 	await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);

        // 	await sovryn.setFeesController(accounts[0]);
        // 	await increaseTime(100);

        // 	await lend_to_pool(loanToken, SUSD, owner);

        // 	// withdraw fees and verify
        // 	const fees = await sovryn.borrowingFeeTokensHeld(SUSD.address);
        // 	console.log("fees: ", fees.toString());
        // 	await sovryn.withdrawBorrowingFees(SUSD.address, accounts[1], fees);
        // 	const paid = await sovryn.borrowingFeeTokensPaid(SUSD.address);
        // 	console.log("paid: ", paid.toString());

        // 	expect(paid.eq(fees)).to.be.true;
        // 	expect(await sovryn.borrowingFeeTokensHeld(SUSD.address)).to.be.a.bignumber.eq(new BN(0));
        // 	expect(await SUSD.balanceOf(accounts[1])).to.be.a.bignumber.eq(fees);
        // });
    });
});
