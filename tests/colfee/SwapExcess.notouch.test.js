/**
 * Phase 3 / Task 3.4 — Swap-excess refund no-touch coverage.
 *
 * `LoanClosingsShared._handleCollateralReturn` (line 969) and
 * `_handleLoanTokenReturn` (line 1004) handle the case where the swap
 * "overfills" — destTokenAmountReceived > coveredPrincipal. The excess is
 * refunded to the borrower via `_withdrawAsset(...)` at lines 986-991 (and
 * the equivalent in the loan-token path).
 *
 * Per `colfee/docs/IMPLEMENTATION_DESIGN.md:301-309`, these refund paths
 * are NOT hooked in the initial release — they're a rare edge case
 * relative to the main `_finalizeSwapClose` payout, and the same
 * `allowDonationOnFailure` gate already routes through there.
 *
 * This test:
 *   1. Triggers the overfill by inflating the collateral-to-loan-token
 *      rate between open and close, so the swap returns more loan token
 *      than needed to repay the principal.
 *   2. Asserts the `swapExcess` event from `worthTheTransfer` fires —
 *      proves the refund branch was actually reached.
 *   3. Asserts that ONLY 1 `ExitFeeApplied` event was emitted (from the
 *      main `_finalizeSwapClose` payout) — proves the excess-refund payout
 *      did NOT emit a second event.
 *
 * Run:
 *   npx hardhat test tests/colfee/SwapExcess.notouch.test.js
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

contract("ColFee — Swap-excess refund no-touch coverage (Phase 3 / Task 3.4)", (accounts) => {
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
        await controller.setExitFeeEnabledTest(true);
        await controller.setActive(true);
        await controller.setRate(25);
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

    describe("_handleCollateralReturn excess-refund path (returnTokenIsCollateral=true)", () => {
        it("when the swap overfills the principal, the excess refund to the borrower is NOT ColFee'd — only the main _finalizeSwapClose payout fires", async () => {
            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );
            const loan = await sovryn.getLoan(loan_id);
            const collateral = new BN(loan.collateral);

            // Inflate WRBTC/SUSD price so the close-side swap returns MORE
            // SUSD per RBTC than needed to repay the principal. This pushes
            // _handleCollateralReturn into the `destTokenAmountReceived >
            // coveredPrincipal` branch.
            //
            // Default test rate is ~1e21 (1 RBTC = 1e21 SUSD). Bumping
            // to 5e21 means the same RBTC redeems 5x more SUSD — well past
            // what's needed for the principal repayment.
            await priceFeeds.setRates(
                WRBTC.address,
                SUSD.address,
                new BN(5).mul(new BN(10).pow(new BN(21))).toString()
            );

            const tx = await sovryn.closeWithSwap(
                loan_id,
                account1,
                collateral,
                true, // returnTokenIsCollateral → routes through _handleCollateralReturn
                "0x",
                { from: owner }
            );

            // Proof that the overfill path actually fired: `swapExcess`
            // event is emitted from `worthTheTransfer` (line 194). Any
            // event with that name in the receipt confirms the path was
            // reached (worthTheTransfer is only called from the excess
            // branches at lines 983 / 1054).
            const swapExcessFired = tx.receipt.rawLogs.some((log) => {
                // event signature: swapExcess(bool, uint256, uint256, uint256)
                const sig = web3.utils.keccak256("swapExcess(bool,uint256,uint256,uint256)");
                return log.topics && log.topics[0] === sig;
            });
            expect(
                swapExcessFired,
                "swapExcess event must fire — proves the overfill path was reached"
            ).to.equal(true);

            // The main `_finalizeSwapClose` payout DOES emit ExitFeeApplied
            // (this is borrower-initiated closeWithSwap; surface default
            // 25 bps applies). What we're verifying: EXACTLY ONE
            // ExitFeeApplied event — the excess-refund payout in
            // _handleCollateralReturn did NOT add a second one.
            const applied = tx.logs.filter((l) => l.event === "ExitFeeApplied");
            expect(
                applied.length,
                "exactly one ExitFeeApplied — the excess refund path is NOT hooked"
            ).to.equal(1);

            // And the asset on the ExitFeeApplied is the collateral (RBTC),
            // not the loan token (SUSD) — confirms the event came from
            // _finalizeSwapClose's collateral payout, not from
            // _handleCollateralReturn's loan-token excess refund.
            expect(applied[0].args.asset.toLowerCase()).to.equal(RBTC.address.toLowerCase());
        });
    });
});
