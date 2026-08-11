/**
 * LC-1 REGRESSION — `LoanClosingsShared._handleLoanTokenReturn`
 * excess-collateral refund must be ColFee-charged on a voluntary close.
 *
 * The bypass (DEPLOYMENT_RUNBOOK.md §6): `closeWithSwap` with
 * `returnTokenIsCollateral=false` and `swapAmount` sized so the partial swap
 * covers the FULL principal (`swapAmount ≈ principal/price`) pays the entire
 * remaining collateral (`collateral - sourceTokenAmountUsed`) to the borrower.
 * Pre-fix that payout went through plain `_withdrawAsset` — uncharged — while
 * every equivalent route (`closeWithDeposit`, `returnTokenIsCollateral=true`,
 * `withdrawCollateral`) charges `SURFACE_LENDING_BORROWER_WITHDRAW`, letting a
 * borrower extract the whole position equity fee-free.
 *
 * Post-fix the payout routes through `_withdrawAssetChargingExitFee` with the
 * same `_exitFeeChargeable(origin, loan)` gate as `_finalizeSwapClose`:
 * charged only on `CloseOrigin.VoluntaryClose`.
 *
 * Scenarios:
 *
 *   1. BYPASS CLOSED — voluntary closeWithSwap into the excess-collateral
 *      branch: the collateral leg emits ExitFeeApplied, fee receiver gets
 *      exactly the fee, borrower gets net. (The loan-token residual leg from
 *      `_finalizeSwapClose` stays charged as before — two Applied events.)
 *   2. Fail-open preserved — controller disabled → full excess to borrower,
 *      ExitFeeSkipped(INACTIVE) on the collateral leg.
 *   3. Rollover through the same helper stays uncharged — the tiny-position
 *      force-close (`_closeWithSwap(..., CloseOrigin.Rollover)`) runs through
 *      `_handleLoanTokenReturn` with a fully active controller and emits no
 *      ColFee events.
 *
 * Rollover always swaps the full collateral, so it can only reach the helper's
 * full-collateral branch — the excess-collateral branch is reachable from
 * `closeWithSwap` alone. Liquidation never enters `_closeWithSwap` at all
 * (`LoanClosingsLiquidation` uses `_swapBackExcess`); its no-touch property is
 * covered by Liquidation.notouch.test.js.
 *
 * Run:
 *   npx hardhat test tests/colfee/BorrowerExit.loanTokenReturn.test.js
 */

const { expect } = require("chai");
const { BN } = require("@openzeppelin/test-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const LoanMaintenance = artifacts.require("LoanMaintenance");
const SwapsImplSovrynSwapLib = artifacts.require("SwapsImplSovrynSwapLib");
const MockExitFeeController = artifacts.require("MockExitFeeController");
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
    lend_to_pool,
    getPriceFeeds,
    getSovryn,
    getSOV,
    open_margin_trade_position,
    decodeLogs,
} = require("../Utils/initializer.js");

const mutexUtils = require("../../deployment/helpers/reentrancy/utils");

const wei = web3.utils.toWei;
const oneEth = new BN(wei("1", "ether"));
const TINY_AMOUNT = new BN(25).mul(new BN(10).pow(new BN(13))); // 25 * 10**13

const SURFACE_LENDING_BORROWER_WITHDRAW = web3.utils.keccak256(
    "COLFEE:SURFACE_LENDING_BORROWER_WITHDRAW"
);

const REASON = { NONE: 0, INACTIVE: 1, DISABLED: 2, INVALID_QUOTE: 3 };

contract("ColFee — LC-1 regression: _handleLoanTokenReturn excess collateral", (accounts) => {
    let owner, account1, feeReceiver, rolloverKeeper;
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

        // Controller fully active at the surface default 25 bps — the
        // exemption scenarios below must come from the origin gate, not from
        // a disabled controller.
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(true);
        await controller.setActive(true);
        await controller.setRate(25);
        await controller.setFeeReceiverTest(feeReceiver);
        await sovryn.setExitFeeController(controller.address, { from: owner });
    }

    before(async () => {
        [owner, account1, feeReceiver, rolloverKeeper, ...accounts] = accounts;

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

    /// Opens a margin trade (SUSD loan, RBTC collateral) and sizes swapAmount
    /// per the LC-1 exploit: swapAmount ≈ principal/price (+10% buffer for
    /// swap fees) so the partial swap covers the full principal and
    /// `_handleLoanTokenReturn` pays out `collateral - swapAmount` as excess.
    async function openTradeAndSizeExploitSwap() {
        const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);
        const loan = await sovryn.getLoan(loan_id);
        const principal = new BN(loan.principal);
        const collateral = new BN(loan.collateral);

        const { rate, precision } = await priceFeeds.queryRate(RBTC.address, SUSD.address);
        const swapAmount = principal.mul(new BN(precision)).div(new BN(rate)).muln(110).divn(100);

        // Preconditions for the targeted branch: a PARTIAL swap
        // (swapAmount < collateral, and the remainder is far above the
        // tiny-position threshold so _adjustSwapAmountForTinyPosition does
        // not silently turn this into a full-collateral swap).
        expect(swapAmount.lt(collateral), "exploit sizing: swapAmount < collateral").to.equal(
            true
        );
        expect(
            collateral.sub(swapAmount).gt(TINY_AMOUNT.muln(10)),
            "remainder far above tiny threshold"
        ).to.equal(true);

        return { loan_id, borrower: owner, principal, collateral, swapAmount };
    }

    describe("1. LC-1 bypass closed (voluntary close, controller active at 25 bps)", () => {
        it("charges the excess-collateral leg: ExitFeeApplied, feeReceiver delta == fee, borrower gets net", async () => {
            const { loan_id, borrower, collateral, swapAmount } =
                await openTradeAndSizeExploitSwap();

            const borrowerRbtcBefore = await RBTC.balanceOf(borrower);
            const feeRecvRbtcBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.closeWithSwap(
                loan_id,
                account1, // receiver of the loan-token residual (≠ borrower)
                swapAmount,
                false, // returnTokenIsCollateral=false → _handleLoanTokenReturn
                "0x",
                { from: borrower }
            );

            // Loan fully closed — proves the swap covered the whole
            // principal, i.e. the excess-collateral branch actually ran.
            const endLoan = await sovryn.getLoan(loan_id);
            expect(endLoan.principal.toString(), "loan fully closed").to.equal("0");

            // Two charged legs on this voluntary close: the NEW
            // excess-collateral refund (RBTC → borrower) and the pre-existing
            // _finalizeSwapClose loan-token residual (SUSD → receiver).
            const applied = findApplied(tx.logs);
            expect(applied.length, "both payout legs charged").to.equal(2);

            const collateralLeg = applied.filter(
                (l) => l.args.asset.toLowerCase() === RBTC.address.toLowerCase()
            );
            expect(collateralLeg.length, "exactly one charge on the collateral leg").to.equal(1);
            expect(collateralLeg[0].args.surfaceId).to.equal(SURFACE_LENDING_BORROWER_WITHDRAW);
            expect(collateralLeg[0].args.subProduct.toLowerCase()).to.equal(
                loanToken.address.toLowerCase()
            );
            expect(
                collateralLeg[0].args.recipient.toLowerCase(),
                "excess collateral goes to the borrower"
            ).to.equal(borrower.toLowerCase());

            const gross = new BN(collateralLeg[0].args.grossAmount);
            const fee = new BN(collateralLeg[0].args.feeAmount);
            const net = new BN(collateralLeg[0].args.netAmount);

            // The charged gross is precisely the LC-1 leak: the entire
            // unswapped collateral.
            expect(gross.toString(), "gross == collateral - swapAmount").to.equal(
                collateral.sub(swapAmount).toString()
            );
            expect(fee.toString()).to.equal(expectedFee(gross, 25).toString());
            expect(gross.toString()).to.equal(net.add(fee).toString());

            // Balance deltas: fee receiver (vault leg) gets exactly the fee,
            // borrower gets exactly the net.
            const borrowerRbtcAfter = await RBTC.balanceOf(borrower);
            const feeRecvRbtcAfter = await RBTC.balanceOf(feeReceiver);
            expect(
                feeRecvRbtcAfter.sub(feeRecvRbtcBefore).toString(),
                "fee receiver RBTC delta == fee"
            ).to.equal(fee.toString());
            expect(
                borrowerRbtcAfter.sub(borrowerRbtcBefore).toString(),
                "borrower RBTC delta == net"
            ).to.equal(net.toString());

            // The other Applied is the unchanged _finalizeSwapClose residual
            // leg: SUSD to the receiver.
            const residualLeg = applied.filter(
                (l) => l.args.asset.toLowerCase() === SUSD.address.toLowerCase()
            );
            expect(residualLeg.length, "residual loan-token leg still charged").to.equal(1);
            expect(residualLeg[0].args.recipient.toLowerCase()).to.equal(account1.toLowerCase());
        });
    });

    describe("2. Fail-open preserved on the new leg (controller disabled)", () => {
        it("pays the full excess collateral to the borrower; ExitFeeSkipped(INACTIVE)", async () => {
            await controller.setExitFeeEnabledTest(false);

            const { loan_id, borrower, collateral, swapAmount } =
                await openTradeAndSizeExploitSwap();

            const borrowerRbtcBefore = await RBTC.balanceOf(borrower);
            const feeRecvRbtcBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.closeWithSwap(loan_id, account1, swapAmount, false, "0x", {
                from: borrower,
            });

            expect(findApplied(tx.logs).length, "nothing charged when disabled").to.equal(0);

            const skippedCollateral = findSkipped(tx.logs).filter(
                (l) => l.args.asset.toLowerCase() === RBTC.address.toLowerCase()
            );
            expect(skippedCollateral.length, "collateral leg went through the hook").to.equal(1);
            expect(skippedCollateral[0].args.reason.toString()).to.equal(
                REASON.INACTIVE.toString()
            );

            const gross = new BN(skippedCollateral[0].args.grossAmount);
            expect(gross.toString()).to.equal(collateral.sub(swapAmount).toString());

            const borrowerRbtcAfter = await RBTC.balanceOf(borrower);
            const feeRecvRbtcAfter = await RBTC.balanceOf(feeReceiver);
            expect(
                borrowerRbtcAfter.sub(borrowerRbtcBefore).toString(),
                "borrower gets the full gross"
            ).to.equal(gross.toString());
            expect(feeRecvRbtcAfter.sub(feeRecvRbtcBefore).toString()).to.equal("0");
        });
    });

    describe("3. Rollover through _handleLoanTokenReturn stays uncharged (origin gate)", () => {
        it("tiny-position force-close via rollover emits no ColFee events with the controller fully active", async () => {
            // Tiny position so a re-rating pushes the rollover into its
            // force-close branch: _closeWithSwap(..., full collateral,
            // returnTokenIsCollateral=false, CloseOrigin.Rollover) →
            // _handleLoanTokenReturn. Mirrors Rollover.notouch.test.js.
            const borrower = account1;
            const loan_token_sent = TINY_AMOUNT.add(new BN(1)).mul(new BN(10).pow(new BN(4)));
            await SUSD.mint(borrower, loan_token_sent);
            await SUSD.approve(loanToken.address, loan_token_sent, { from: borrower });

            const { receipt } = await loanToken.marginTrade(
                "0x0", // loanId
                new BN(2).mul(oneEth), // leverageAmount
                loan_token_sent, // loanTokenSent
                0, // collateralTokenSent
                RBTC.address, // collateralTokenAddress
                borrower, // trader
                0, // slippage
                "0x", // loanDataBytes
                { from: borrower }
            );
            const decoded = decodeLogs(receipt.rawLogs, LoanOpeningsEvents, "Trade");
            const loan_id = decoded[0].args["loanId"];
            const loan = await sovryn.getLoan(loan_id);

            // Expire the loan, then re-rate so the remaining principal is
            // tiny in RBTC terms → rollover force-closes the whole position.
            const num = await blockNumber();
            const currentBlock = await web3.eth.getBlock(num);
            await increaseTime(loan["endTimestamp"] - currentBlock.timestamp);
            await priceFeeds.setRates(
                WRBTC.address,
                SUSD.address,
                new BN(10).pow(new BN(23)).toString()
            );

            const tx = await sovryn.rollover(loan_id, "0x", { from: rolloverKeeper });

            // Position closed through _handleLoanTokenReturn under
            // CloseOrigin.Rollover — the gate short-circuits before any
            // controller call: no Applied, no Skipped.
            const endLoan = await sovryn.getLoan(loan_id);
            expect(endLoan.principal.toString(), "position force-closed").to.equal("0");
            expect(findApplied(tx.logs).length, "no ExitFeeApplied on rollover").to.equal(0);
            expect(findSkipped(tx.logs).length, "no ExitFeeSkipped on rollover").to.equal(0);
        });
    });
});
