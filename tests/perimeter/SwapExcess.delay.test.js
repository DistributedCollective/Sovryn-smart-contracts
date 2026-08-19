/**
 * closeWithSwap excess-collateral refund leg — delay coverage.
 *
 * `LoanClosingsShared._handleLoanTokenReturn` (returnTokenIsCollateral=false)
 * fully closes the loan when the swap covers the whole principal
 * (`destTokenAmountReceived >= loanLocal.principal`) and refunds
 * `excessCollateral = collateral - swapAmount` straight to the borrower. Because
 * **`swapAmount` is CALLER-selectable**, a stolen-borrower-key / forged-loan
 * exploiter can size the swap so ~the entire equity leaves through this refund,
 * escaping the security-perimeter delay window (the exact theft the perimeter
 * exists to catch). This leg was previously un-hooked ("rare overfill edge") —
 * The refund is rerouted into the ExitDelayQueue when `d > 0`, under the SAME
 * voluntary-only `_exitFeeChargeable` gate (rollover/liquidation stay direct),
 * via `_refundExcessCollateralWithDelay` -> `_maybeDelayBorrowerExit` (PUSH to
 * the queue through the `sovrynProtocol` singleton, then measured-delta record).
 * The swap itself is never delayed — only the borrower's collateral refund is.
 *
 * Coverage:
 *   1. Attacker-sized swap, perimeter ON -> the excess-collateral refund
 *      (collateral - swapAmount) is ESCROWED (measured-delta), NOT paid to the
 *      borrower; request provenance (token=collateral, receiver=borrower,
 *      surface, subProduct); executeExit after unlock pays the borrower.
 *   2. Perimeter OFF (no-touch) -> the refund is paid DIRECT to the
 *      borrower and the queue is NEVER touched (lastRequestId == 0).
 *   3. Rollover force-close through the swap path, perimeter ON -> queue NEVER
 *      touched (CloseOrigin.Rollover exempt from the delay reroute).
 *   4. Liquidation through the swap path, perimeter ON -> queue NEVER touched
 *      (CloseOrigin.Liquidation exempt).
 *
 * Run:
 *   npx hardhat test tests/perimeter/SwapExcess.delay.test.js
 */

const { expect } = require("chai");
const { expectRevert, BN, constants } = require("@openzeppelin/test-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const LoanMaintenance = artifacts.require("LoanMaintenance");
const SwapsImplSovrynSwapLib = artifacts.require("SwapsImplSovrynSwapLib");
const MockExitFeeController = artifacts.require("MockExitFeeController");
const MockExitDelayQueue = artifacts.require("MockExitDelayQueue");
const LoanOpeningsEvents = artifacts.require("LoanOpeningsEvents");

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
    getSOV,
    open_margin_trade_position,
    decodeLogs,
} = require("../Utils/initializer.js");

const { increaseTime, blockNumber } = require("../Utils/Ethereum");
const mutexUtils = require("../../deployment/helpers/reentrancy/utils");

const wei = web3.utils.toWei;
const oneEth = new BN(wei("1", "ether"));
const ZERO = constants.ZERO_ADDRESS;
const TINY_AMOUNT = new BN(25).mul(new BN(10).pow(new BN(13))); // 25 * 10**13
const SURFACE_LENDING_BORROWER_WITHDRAW = web3.utils.keccak256(
    "COLFEE:SURFACE_LENDING_BORROWER_WITHDRAW"
);

const MIN_DELAY = 60; // queue per-request floor (seconds)
const DELAY = 3600; // global delay used by the armed perimeter

contract("Perimeter delay — closeWithSwap excess-collateral refund", (accounts) => {
    let owner, borrower, liquidator, feeReceiver, receiver;
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

        loanToken = await getLoanToken(owner, sovryn, WRBTC, SUSD);
        loanTokenWRBTC = await getLoanTokenWRBTC(owner, sovryn, WRBTC, SUSD);
        await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

        await set_demand_curve(loanToken);
        await lend_to_pool(loanToken, SUSD, owner);

        // Controller pinned; fee OFF so `toUser == gross` and the escrow
        // accounting is clean. Perimeter starts OFF (armed per-test).
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(false);
        await controller.setActive(true);
        await controller.setRate(25);
        await controller.setFeeReceiverTest(feeReceiver);
        await sovryn.setExitFeeController(controller.address, { from: owner });

        // Queue deployed; sovrynProtocol singleton registered as its allowed
        // source (borrower/margin records run in that context). Pointer pinned
        // per-test via `armPerimeter` so the OFF case leaves it unwired.
        queue = await MockExitDelayQueue.new(WRBTC.address, MIN_DELAY);
        await queue.setAllowedSource(sovryn.address, true);
    }

    before(async () => {
        [owner, borrower, liquidator, feeReceiver, receiver, ...accounts] = accounts;
        try {
            const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
            await LoanMaintenance.link(swapsImplSovrynSwapLib);
        } catch (_) {}
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    async function armPerimeter({ delay = DELAY, pinQueue = true } = {}) {
        await controller.setSecurityPerimeterEnabledTest(true);
        await controller.setGlobalDelaySecondsTest(delay);
        if (pinQueue) {
            await sovryn.setExitDelayQueue(queue.address, { from: owner });
        }
    }

    // Open a SUSD/RBTC margin trade (borrower == owner). Then inflate the
    // collateral(RBTC) -> loan(SUSD) swap rate so a PARTIAL swap of the
    // collateral already covers the full principal — that is exactly the
    // attacker-selectable "route ~full equity through the un-delayed refund"
    // shape: a SMALL swapAmount closes the loan and the LARGE remainder
    // (collateral - swapAmount) is refunded to the borrower.
    async function openTradeAndInflateRate() {
        const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);
        const loan = await sovryn.getLoan(loan_id);
        const collateral = new BN(loan.collateral);

        // 5x the current collateral->loan rate: even at 1x collateralization a
        // half-collateral swap then covers the full principal, so the excess-
        // collateral refund branch (destTokenAmountReceived >= principal with
        // swapAmount < collateral) fires deterministically regardless of the
        // opening leverage.
        const { rate } = await priceFeeds.queryRate(RBTC.address, SUSD.address);
        await priceFeeds.setRates(RBTC.address, SUSD.address, new BN(rate).muln(5).toString());

        // swapAmount = half the collateral -> the other half is the excess
        // refund. The remainder is far above TINY_AMOUNT so
        // `_adjustSwapAmountForTinyPosition` does NOT bump it up to the full
        // collateral (which would take the swapAmount==collateral branch).
        const swapAmount = collateral.div(new BN(2));
        expect(
            swapAmount.gt(TINY_AMOUNT),
            "remainder must exceed TINY so the partial-swap branch is kept"
        ).to.equal(true);

        return { loan_id, collateral, swapAmount };
    }

    // ── 1. Attacker-sized swap, perimeter ON — excess refund is ESCROWED ──────

    describe("attacker-sized swap, perimeter ON", () => {
        it("escrows the excess-collateral refund (collateral - swapAmount) into the queue; borrower is NOT paid until executeExit", async () => {
            await armPerimeter();
            const { loan_id, collateral, swapAmount } = await openTradeAndInflateRate();
            const expectedExcess = collateral.sub(swapAmount);

            const borrowerRbtcBefore = await RBTC.balanceOf(owner);
            const queueRbtcBefore = await RBTC.balanceOf(queue.address);

            // returnTokenIsCollateral = false -> _handleLoanTokenReturn; the
            // main SUSD residual pays to `receiver`, the RBTC excess refunds to
            // the borrower (owner).
            await sovryn.closeWithSwap(loan_id, receiver, swapAmount, false, "0x", {
                from: owner,
            });

            // Locate the excess-collateral request (token == collateral RBTC).
            const lastId = new BN(await queue.lastRequestId());
            expect(lastId.gt(new BN(0)), "at least one request recorded").to.equal(true);
            let excessReq = null;
            for (let i = 1; i <= lastId.toNumber(); i++) {
                const r = await queue.getRequest(i);
                if (r.token.toLowerCase() === RBTC.address.toLowerCase()) excessReq = r;
            }
            expect(excessReq, "an RBTC (collateral) excess request exists").to.not.equal(null);

            // The refund is the borrower's collateral, so the immutable receiver
            // is the BORROWER (owner) — NOT the closeWithSwap `receiver` arg.
            expect(excessReq.receiver.toLowerCase()).to.equal(owner.toLowerCase());
            expect(excessReq.owner.toLowerCase()).to.equal(owner.toLowerCase());
            expect(excessReq.originator.toLowerCase()).to.equal(owner.toLowerCase());
            expect(excessReq.surfaceId).to.equal(SURFACE_LENDING_BORROWER_WITHDRAW);
            expect(excessReq.subProduct.toLowerCase()).to.equal(loanToken.address.toLowerCase());
            expect(excessReq.unwrapOnDelivery).to.equal(false);
            expect(excessReq.amount.toString()).to.equal(expectedExcess.toString());

            // The excess is behind the delay: the borrower got NOTHING directly,
            // the queue holds the backing.
            expect((await RBTC.balanceOf(owner)).sub(borrowerRbtcBefore).toString()).to.equal("0");
            expect((await RBTC.balanceOf(queue.address)).sub(queueRbtcBefore).toString()).to.equal(
                expectedExcess.toString()
            );
            expect((await queue.totalEscrowed(RBTC.address)).toString()).to.equal(
                expectedExcess.toString()
            );

            // After unlock the borrower (owner/originator) executes; the excess
            // is paid to the immutable receiver (the borrower).
            await increaseTime(DELAY + 1);
            const req1 = await queue.getRequest(1);
            const excessId = req1.token.toLowerCase() === RBTC.address.toLowerCase() ? 1 : 2;
            await queue.executeExit(excessId, { from: owner });
            expect((await RBTC.balanceOf(owner)).sub(borrowerRbtcBefore).toString()).to.equal(
                expectedExcess.toString()
            );
            expect((await queue.totalEscrowed(RBTC.address)).toString()).to.equal("0");
        });
    });

    // ── 1b. Fee ON + perimeter ON — composed fee × delay semantics ───────────
    // Pins the composed shape: the chargeable excess-collateral refund
    // first pays the exit fee, then escrows only the NET behind the
    // delay. fee + net == excess; the borrower gets nothing direct.

    describe("attacker-sized swap, fee ON + perimeter ON (fee × delay composed)", () => {
        it("charges the exit fee on the refund and escrows only the NET; fee + net == excess", async () => {
            await controller.setExitFeeEnabledTest(true); // fixture rate: 25 bps
            await armPerimeter();
            const { loan_id, collateral, swapAmount } = await openTradeAndInflateRate();
            const expectedExcess = collateral.sub(swapAmount);
            const expectedFee = expectedExcess.muln(25).divn(10000);
            const expectedNet = expectedExcess.sub(expectedFee);
            expect(expectedFee.gt(new BN(0)), "non-vacuous: refund fee must be > 0").to.equal(
                true
            );

            const borrowerRbtcBefore = await RBTC.balanceOf(owner);
            const feeReceiverRbtcBefore = await RBTC.balanceOf(feeReceiver);
            const queueRbtcBefore = await RBTC.balanceOf(queue.address);

            await sovryn.closeWithSwap(loan_id, receiver, swapAmount, false, "0x", {
                from: owner,
            });

            // Locate the excess-collateral request (token == collateral RBTC).
            const lastId = new BN(await queue.lastRequestId());
            expect(lastId.gt(new BN(0)), "at least one request recorded").to.equal(true);
            let excessReq = null;
            let excessId = 0;
            for (let i = 1; i <= lastId.toNumber(); i++) {
                const r = await queue.getRequest(i);
                if (r.token.toLowerCase() === RBTC.address.toLowerCase()) {
                    excessReq = r;
                    excessId = i;
                }
            }
            expect(excessReq, "an RBTC (collateral) excess request exists").to.not.equal(null);

            // Fee leg settled immediately to the fee receiver; ONLY the net is
            // escrowed; the borrower is paid nothing until executeExit.
            expect(excessReq.amount.toString()).to.equal(expectedNet.toString());
            expect(
                (await RBTC.balanceOf(feeReceiver)).sub(feeReceiverRbtcBefore).toString()
            ).to.equal(expectedFee.toString());
            expect((await RBTC.balanceOf(owner)).sub(borrowerRbtcBefore).toString()).to.equal("0");
            expect((await RBTC.balanceOf(queue.address)).sub(queueRbtcBefore).toString()).to.equal(
                expectedNet.toString()
            );

            // After unlock the borrower receives exactly the NET (fee stays paid).
            await increaseTime(DELAY + 1);
            await queue.executeExit(excessId, { from: owner });
            expect((await RBTC.balanceOf(owner)).sub(borrowerRbtcBefore).toString()).to.equal(
                expectedNet.toString()
            );
            expect(
                (await RBTC.balanceOf(feeReceiver)).sub(feeReceiverRbtcBefore).toString()
            ).to.equal(expectedFee.toString());
        });
    });

    // ── 2. Perimeter OFF — the refund pays DIRECT, queue NEVER touched ────────

    describe("perimeter OFF — no-touch", () => {
        it("pays the excess-collateral refund direct to the borrower; the queue is never touched", async () => {
            // Pin the queue but leave the perimeter disabled: proves d==0 pays
            // direct and never records, even with a live queue wired.
            await sovryn.setExitDelayQueue(queue.address, { from: owner });
            const { loan_id, collateral, swapAmount } = await openTradeAndInflateRate();
            const expectedExcess = collateral.sub(swapAmount);

            const borrowerRbtcBefore = await RBTC.balanceOf(owner);

            await sovryn.closeWithSwap(loan_id, receiver, swapAmount, false, "0x", {
                from: owner,
            });

            // Direct pay of the excess to the borrower; queue untouched.
            expect((await RBTC.balanceOf(owner)).sub(borrowerRbtcBefore).toString()).to.equal(
                expectedExcess.toString()
            );
            expect((await RBTC.balanceOf(queue.address)).toString()).to.equal("0");
            expect((await queue.totalEscrowed(RBTC.address)).toString()).to.equal("0");
            expect((await queue.lastRequestId()).toString()).to.equal("0");
        });
    });

    // ── 3. Rollover through the swap path, perimeter ON — no-touch ────────────

    describe("rollover force-close through the swap path, perimeter ON — no-touch", () => {
        it("CloseOrigin.Rollover is exempt: a rollover swap-close never escrows into the queue", async () => {
            await armPerimeter();

            // Open a margin trade with a tiny loan so an expiry + re-rate pushes
            // rollover into the tiny-position force-close branch
            // (`_closeWithSwap(... CloseOrigin.Rollover)`), mirroring
            // Rollover.notouch.test.js.
            await SUSD.approve(loanToken.address, new BN(10).pow(new BN(40)));
            await loanToken.mint(owner, new BN(10).pow(new BN(30)));

            const loan_token_sent = TINY_AMOUNT.add(new BN(1)).mul(new BN(10).pow(new BN(4)));
            await SUSD.mint(borrower, loan_token_sent);
            await SUSD.approve(loanToken.address, loan_token_sent, { from: borrower });

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
            const loan_id = decoded[0].args["loanId"];
            const loan = await sovryn.getLoan(loan_id);

            const num = await blockNumber();
            const currentBlock = await web3.eth.getBlock(num);
            await increaseTime(loan["endTimestamp"] - currentBlock.timestamp);

            // Re-rate so closing leaves a tiny dust position -> the tiny-position
            // force-close swap path (allowDonationOnFailure = true).
            await priceFeeds.setRates(
                WRBTC.address,
                SUSD.address,
                new BN(10).pow(new BN(23)).toString()
            );

            await sovryn.rollover(loan_id, "0x", { from: liquidator });

            // Even with the perimeter armed, a rollover swap-close never escrows.
            expect((await queue.lastRequestId()).toString()).to.equal("0");
            expect((await queue.totalEscrowed(RBTC.address)).toString()).to.equal("0");
            expect((await queue.totalEscrowed(ZERO)).toString()).to.equal("0");
        });
    });

    // ── 4. Liquidation through the swap path, perimeter ON — no-touch ─────────

    describe("liquidation through the swap path, perimeter ON — no-touch", () => {
        it("CloseOrigin.Liquidation is exempt: liquidating an unhealthy position never escrows into the queue", async () => {
            await armPerimeter();

            await SUSD.approve(loanToken.address, new BN(10).pow(new BN(40)));
            await loanToken.mint(owner, new BN(10).pow(new BN(21)));

            const loan_token_sent = new BN(10).mul(oneEth);
            await SUSD.mint(borrower, loan_token_sent);
            await SUSD.mint(liquidator, loan_token_sent);
            await SUSD.approve(loanToken.address, loan_token_sent, { from: borrower });
            await SUSD.approve(sovryn.address, loan_token_sent, { from: liquidator });

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
            const loan_id = decoded[0].args["loanId"];

            // Re-rate RBTC/SUSD so the position becomes liquidatable.
            await priceFeeds.setRates(
                RBTC.address,
                SUSD.address,
                new BN(10).pow(new BN(21)).toString()
            );
            await increaseTime(10 * 24 * 60 * 60);

            await sovryn.liquidate(loan_id, liquidator, loan_token_sent, {
                from: liquidator,
                value: 0,
            });

            // Liquidation never escrows, even with the perimeter armed.
            expect((await queue.lastRequestId()).toString()).to.equal("0");
            expect((await queue.totalEscrowed(RBTC.address)).toString()).to.equal("0");
            expect((await queue.totalEscrowed(ZERO)).toString()).to.equal("0");
        });
    });
});
