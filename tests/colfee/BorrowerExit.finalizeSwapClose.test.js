/**
 * Phase 3 / Task 3.3 — Borrower-exit (`LoanClosingsShared._finalizeSwapClose`,
 * reached via `LoanClosingsWith.closeWithSwap`) ColFee coverage.
 *
 * Surface: `SURFACE_LENDING_BORROWER_WITHDRAW` (same as Tasks 3.1 / 3.2).
 *
 * Scenarios:
 *
 *   1. ColFee globally disabled  → borrower gets full residual collateral;
 *                                   ExitFeeSkipped(INACTIVE).
 *   2. Surface default 25 bps    → fee receiver gets 25 bps of residual;
 *                                   borrower gets net; gross == net + fee.
 *   3. Sub-product override key  → REGRESSION for review Finding 1. With
 *                                   policy keyed by `loanLocal.lender`
 *                                   (== loanToken.address) at 50 bps AND
 *                                   policy keyed by underlying SUSD at
 *                                   999 bps, the borrower is charged 50 bps.
 *   4. INVALID_QUOTE fallback    → controller returns rateBps > 10_000 →
 *                                   borrower gets full residual,
 *                                   ExitFeeSkipped(INVALID_QUOTE).
 *
 * The `allowDonationOnFailure=true` gate (which causes ColFee to be skipped
 * in liquidation / rollover paths) is verified separately in Task 3.4's
 * no-touch coverage suite.
 *
 * Run:
 *   npx hardhat test tests/colfee/BorrowerExit.finalizeSwapClose.test.js
 */

const { expect } = require("chai");
const { BN } = require("@openzeppelin/test-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const LoanMaintenance = artifacts.require("LoanMaintenance");
const SwapsImplSovrynSwapLib = artifacts.require("SwapsImplSovrynSwapLib");
const MockExitFeeController = artifacts.require("MockExitFeeController");

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
} = require("../Utils/initializer.js");

const mutexUtils = require("../../deployment/helpers/reentrancy/utils");

const wei = web3.utils.toWei;

const SURFACE_LENDING_BORROWER_WITHDRAW = web3.utils.keccak256(
    "COLFEE:SURFACE_LENDING_BORROWER_WITHDRAW"
);

const REASON = { NONE: 0, INACTIVE: 1, DISABLED: 2, INVALID_QUOTE: 3 };

contract("ColFee — borrower-exit finalizeSwapClose (Phase 3 / Task 3.3)", (accounts) => {
    let owner, account1, feeReceiver;
    let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, priceFeeds, sov;
    let controller;

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

        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(false);
        await controller.setActive(true);
        await controller.setRate(25); // surface default
        await controller.setFeeReceiverTest(feeReceiver);

        await sovryn.setExitFeeController(controller.address, { from: owner });
    }

    before(async () => {
        [owner, account1, feeReceiver, ...accounts] = accounts;

        try {
            const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
            await LoanMaintenance.link(swapsImplSovrynSwapLib);
        } catch (_) {}
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    function findApplied(logs) {
        return logs.filter((l) => l.event === "ExitFeeApplied");
    }
    function findSkipped(logs) {
        return logs.filter((l) => l.event === "ExitFeeSkipped");
    }
    function expectedFee(gross, rateBps) {
        return new BN(gross).muln(rateBps).divn(10_000);
    }

    /// Opens a margin trade (SUSD loan, RBTC collateral) and returns
    ///   { loan_id, borrower, collateral }
    /// ready for closeWithSwap. `borrower` here is `owner` (the trader).
    async function openMarginTradeAndPrepare() {
        const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);
        const loan = await sovryn.getLoan(loan_id);
        return { loan_id, borrower: owner, collateral: new BN(loan.collateral) };
    }

    describe("ColFee globally disabled (controller.exitFeeEnabled = false)", () => {
        it("closeWithSwap returns the full collateral residual to receiver; ExitFeeSkipped(INACTIVE)", async () => {
            const { loan_id, borrower, collateral } = await openMarginTradeAndPrepare();

            const receiver = account1; // distinct from msg.sender
            const rbtcBefore = await RBTC.balanceOf(receiver);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.closeWithSwap(
                loan_id,
                receiver,
                collateral, // swap full collateral
                true, // returnTokenIsCollateral
                "0x",
                { from: borrower }
            );

            const applied = findApplied(tx.logs);
            const skipped = findSkipped(tx.logs);
            expect(applied.length, "no Applied when colfee disabled").to.equal(0);
            expect(skipped.length, "one Skipped event").to.equal(1);
            expect(skipped[0].args.reason.toString()).to.equal(REASON.INACTIVE.toString());

            const gross = new BN(skipped[0].args.grossAmount);
            const rbtcAfter = await RBTC.balanceOf(receiver);
            const feeRecvAfter = await RBTC.balanceOf(feeReceiver);
            expect(rbtcAfter.sub(rbtcBefore).toString()).to.equal(gross.toString());
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal("0");
        });
    });

    describe("Surface default 25 bps (no sub-product override)", () => {
        it("closeWithSwap charges 25 bps on the borrower-bound residual; gross == net + fee", async () => {
            await controller.setExitFeeEnabledTest(true);

            const { loan_id, borrower, collateral } = await openMarginTradeAndPrepare();

            const receiver = account1;
            const rbtcBefore = await RBTC.balanceOf(receiver);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.closeWithSwap(loan_id, receiver, collateral, true, "0x", {
                from: borrower,
            });

            const applied = findApplied(tx.logs);
            const skipped = findSkipped(tx.logs);
            expect(applied.length).to.equal(1);
            expect(skipped.length).to.equal(0);
            expect(applied[0].args.surfaceId).to.equal(SURFACE_LENDING_BORROWER_WITHDRAW);

            const gross = new BN(applied[0].args.grossAmount);
            const fee = new BN(applied[0].args.feeAmount);
            const net = new BN(applied[0].args.netAmount);
            expect(fee.toString()).to.equal(expectedFee(gross, 25).toString());
            expect(gross.toString()).to.equal(net.add(fee).toString());

            const rbtcAfter = await RBTC.balanceOf(receiver);
            const feeRecvAfter = await RBTC.balanceOf(feeReceiver);
            expect(rbtcAfter.sub(rbtcBefore).toString()).to.equal(net.toString());
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal(fee.toString());

            // The withdrawn asset is collateral (RBTC) because
            // returnTokenIsCollateral=true above.
            expect(applied[0].args.asset.toLowerCase()).to.equal(RBTC.address.toLowerCase());
        });
    });

    describe("Sub-product override REGRESSION (Finding 1: subProduct == loanLocal.lender)", () => {
        it("policy keyed by iToken pool (loanLocal.lender) is honored; underlying-token key is NOT", async () => {
            await controller.setExitFeeEnabledTest(true);
            await controller.setSubProductPolicyTest(loanToken.address, true, 50);
            await controller.setSubProductPolicyTest(SUSD.address, true, 999);

            const { loan_id, borrower, collateral } = await openMarginTradeAndPrepare();

            const tx = await sovryn.closeWithSwap(loan_id, account1, collateral, true, "0x", {
                from: borrower,
            });

            const applied = findApplied(tx.logs);
            expect(applied.length).to.equal(1);

            const gross = new BN(applied[0].args.grossAmount);
            const fee = new BN(applied[0].args.feeAmount);
            expect(fee.toString()).to.equal(expectedFee(gross, 50).toString());
            expect(applied[0].args.subProduct.toLowerCase()).to.equal(
                loanToken.address.toLowerCase()
            );
            expect(applied[0].args.subProduct.toLowerCase()).to.not.equal(
                SUSD.address.toLowerCase()
            );
        });
    });

    describe("INVALID_QUOTE fallback (defensive _quoteIsValid)", () => {
        it("controller returns rateBps > MAX_BPS → full gross to user, ExitFeeSkipped(INVALID_QUOTE)", async () => {
            await controller.setExitFeeEnabledTest(true);
            await controller.setSubProductPolicyTest(loanToken.address, true, 10001);

            const { loan_id, borrower, collateral } = await openMarginTradeAndPrepare();

            const receiver = account1;
            const rbtcBefore = await RBTC.balanceOf(receiver);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.closeWithSwap(loan_id, receiver, collateral, true, "0x", {
                from: borrower,
            });

            const applied = findApplied(tx.logs);
            const skipped = findSkipped(tx.logs);
            expect(applied.length, "no Applied on invalid quote").to.equal(0);
            expect(skipped.length).to.equal(1);
            expect(skipped[0].args.reason.toString()).to.equal(REASON.INVALID_QUOTE.toString());

            const gross = new BN(skipped[0].args.grossAmount);
            const rbtcAfter = await RBTC.balanceOf(receiver);
            const feeRecvAfter = await RBTC.balanceOf(feeReceiver);
            expect(rbtcAfter.sub(rbtcBefore).toString()).to.equal(gross.toString());
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal("0");
        });
    });
});
