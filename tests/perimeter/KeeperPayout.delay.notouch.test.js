/**
 * Security-perimeter delay — keeper/liquidation no-touch regression.
 *
 * The delay reroute fires on EXACTLY the same chargeable set as the Perimeter fee
 * gate (`_exitFeeChargeable`): only a borrower/delegate `VoluntaryClose`.
 * Rollover (`CloseOrigin.Rollover`) and liquidation
 * (`allowDonationOnFailure = true`) are EXEMPT — a keeper/liquidator payout must
 * never be escrowed behind a multi-hour delay.
 *
 * These tests wire a LIVE queue AND enable the perimeter (global delay > 0), so
 * a wrong gate would visibly escrow the payout. The assertion is that the queue
 * is NEVER touched: `totalEscrowed == 0` for both assets and `lastRequestId == 0`
 * after the rollover / liquidation. This is the delay-layer counterpart of the
 * existing fee no-touch suites (Rollover.notouch / Liquidation.notouch).
 *
 * Run:
 *   npx hardhat test tests/perimeter/KeeperPayout.delay.notouch.test.js
 */

const { expect } = require("chai");
const { BN } = require("@openzeppelin/test-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const LoanMaintenance = artifacts.require("LoanMaintenance");
const SwapsImplSovrynSwapLib = artifacts.require("SwapsImplSovrynSwapLib");
const MockExitFeeController = artifacts.require("MockExitFeeController");
const MockExitDelayQueue = artifacts.require("MockExitDelayQueue");
const LoanOpeningsEvents = artifacts.require("LoanOpeningsEvents");

const { increaseTime, blockNumber } = require("../Utils/Ethereum");
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
    decodeLogs,
} = require("../Utils/initializer.js");

const mutexUtils = require("../../deployment/helpers/reentrancy/utils");

const wei = web3.utils.toWei;
const oneEth = new BN(wei("1", "ether"));
const ZERO = "0x0000000000000000000000000000000000000000";
const TINY_AMOUNT = new BN(25).mul(new BN(10).pow(new BN(13)));

const MIN_DELAY = 60;
const DELAY = 3600;

contract("Perimeter delay — keeper/liquidation no-touch", (accounts) => {
    let lender, borrower, keeper, feeReceiver;
    let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, priceFeeds, sov;
    let controller, queue;

    async function deploymentAndInitFixture() {
        await mutexUtils.getOrDeployMutex();

        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        sov = await getSOV(sovryn, priceFeeds, SUSD, accounts);

        loanToken = await getLoanToken(lender, sovryn, WRBTC, SUSD);
        loanTokenWRBTC = await getLoanTokenWRBTC(lender, sovryn, WRBTC, SUSD);
        await loan_pool_setup(sovryn, lender, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

        // Fee controller FULLY ACTIVE and the perimeter ARMED with a live queue:
        // no-touch must come from the voluntary-exit gate, not from anything being off.
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(true);
        await controller.setActive(true);
        await controller.setRate(25);
        await controller.setFeeReceiverTest(feeReceiver);
        await controller.setSecurityPerimeterEnabledTest(true);
        await controller.setGlobalDelaySecondsTest(DELAY);
        await sovryn.setExitFeeController(controller.address, { from: lender });

        queue = await MockExitDelayQueue.new(WRBTC.address, MIN_DELAY);
        await queue.setAllowedSource(sovryn.address, true);
        await sovryn.setExitDelayQueue(queue.address, { from: lender });
    }

    before(async () => {
        [lender, borrower, keeper, feeReceiver, ...accounts] = accounts;
        try {
            const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
            await LoanMaintenance.link(swapsImplSovrynSwapLib);
        } catch (_) {}
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    async function assertQueueUntouched() {
        expect((await queue.lastRequestId()).toString(), "no request recorded").to.equal("0");
        expect((await queue.totalEscrowed(RBTC.address)).toString(), "no RBTC escrowed").to.equal(
            "0"
        );
        expect((await queue.totalEscrowed(SUSD.address)).toString(), "no SUSD escrowed").to.equal(
            "0"
        );
        expect((await queue.totalEscrowed(ZERO)).toString(), "no native escrowed").to.equal("0");
        expect(
            (await web3.eth.getBalance(queue.address)).toString(),
            "queue holds 0 RBTC"
        ).to.equal("0");
    }

    // ── Rollover ─────────────────────────────────────────────────────────────

    async function openMarginTradeAndExpire(mode) {
        await set_demand_curve(loanToken);
        await SUSD.approve(loanToken.address, new BN(10).pow(new BN(40)));
        await loanToken.mint(lender, new BN(10).pow(new BN(30)));

        const trader = accounts[1];
        const loan_token_sent =
            mode === "tiny"
                ? TINY_AMOUNT.add(new BN(1)).mul(new BN(10).pow(new BN(4)))
                : new BN(wei("100", "ether"));
        await SUSD.mint(trader, loan_token_sent);
        await SUSD.approve(loanToken.address, loan_token_sent, { from: trader });

        const { receipt } = await loanToken.marginTrade(
            "0x0",
            new BN(2).mul(oneEth),
            loan_token_sent,
            0,
            RBTC.address,
            trader,
            0,
            "0x",
            { from: trader }
        );

        const decoded = decodeLogs(receipt.rawLogs, LoanOpeningsEvents, "Trade");
        const loan_id = decoded[0].args["loanId"];
        const loan = await sovryn.getLoan(loan_id);

        const num = await blockNumber();
        const currentBlock = await web3.eth.getBlock(num);
        await increaseTime(loan["endTimestamp"] - currentBlock.timestamp);
        return { trader, loan_id };
    }

    describe("rollover keeper-reward branch (CloseOrigin.Rollover)", () => {
        it("keeper-initiated rollover does NOT escrow — queue untouched", async () => {
            const { loan_id } = await openMarginTradeAndExpire("tiny");
            await priceFeeds.setRates(
                WRBTC.address,
                RBTC.address,
                new BN(10).pow(new BN(19)).mul(new BN(3)).toString()
            );

            await sovryn.rollover(loan_id, "0x", { from: keeper });

            const endLoan = await sovryn.getLoan(loan_id);
            expect(endLoan["principal"].toString()).to.equal("0");
            await assertQueueUntouched();
        });

        it("borrower self-initiated rollover does NOT escrow either", async () => {
            const { trader, loan_id } = await openMarginTradeAndExpire("tiny");
            await priceFeeds.setRates(
                WRBTC.address,
                RBTC.address,
                new BN(10).pow(new BN(19)).mul(new BN(3)).toString()
            );

            await sovryn.rollover(loan_id, "0x", { from: trader });

            const endLoan = await sovryn.getLoan(loan_id);
            expect(endLoan["principal"].toString()).to.equal("0");
            await assertQueueUntouched();
        });
    });

    // ── Liquidation ──────────────────────────────────────────────────────────

    async function openMarginTradeForLiquidation() {
        await set_demand_curve(loanToken);
        await SUSD.approve(loanToken.address, new BN(10).pow(new BN(40)));
        await loanToken.mint(lender, new BN(10).pow(new BN(21)));

        const loan_token_sent = new BN(10).mul(oneEth);
        await SUSD.mint(borrower, loan_token_sent);
        await SUSD.mint(keeper, loan_token_sent);
        await SUSD.approve(loanToken.address, loan_token_sent, { from: borrower });
        await SUSD.approve(sovryn.address, loan_token_sent, { from: keeper });

        const { receipt } = await loanToken.marginTrade(
            "0x0",
            new BN(2).mul(oneEth),
            loan_token_sent,
            0,
            RBTC.address,
            borrower,
            0,
            "0x",
            { from: borrower }
        );
        const decoded = decodeLogs(receipt.rawLogs, LoanOpeningsEvents, "Trade");
        return { loan_id: decoded[0].args["loanId"], loan_token_sent };
    }

    describe("liquidation (allowDonationOnFailure = true)", () => {
        it("liquidating an unhealthy position does NOT escrow — queue untouched", async () => {
            const { loan_id, loan_token_sent } = await openMarginTradeForLiquidation();
            await priceFeeds.setRates(
                RBTC.address,
                SUSD.address,
                new BN(10).pow(new BN(21)).toString()
            );
            await increaseTime(10 * 24 * 60 * 60);

            await sovryn.liquidate(loan_id, keeper, loan_token_sent, {
                from: keeper,
                value: 0,
            });

            const loanAfter = await sovryn.getLoan(loan_id);
            expect(new BN(loanAfter["collateral"]).lt(new BN(10).pow(new BN(20)))).to.equal(true);
            await assertQueueUntouched();
        });
    });
});
