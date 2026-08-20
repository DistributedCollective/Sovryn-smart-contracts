/**
 * Phase 3 / Task 3.4 — Liquidation no-touch coverage.
 *
 * `LoanClosingsLiquidation.liquidate(...)` calls `_closeWithSwap(...)` with
 * `allowDonationOnFailure = true` (the liquidator may be a contract whose
 * `receive()`/`fallback()` reverts; donate-on-failure protects the
 * liquidation from being bricked by a bad receiver). The two-condition
 * gate at `_finalizeSwapClose` is:
 *
 *   !params.allowDonationOnFailure AND msg.sender ∈ {borrower, delegatedManagers}
 *
 * The first condition alone is enough to exclude liquidation — even if the
 * liquidator happens to be the borrower (which doesn't make economic
 * sense, but isn't blocked by the protocol). The `allowDonationOnFailure`
 * flag captures the "this is a forced close, not an exit" semantic.
 *
 * This test asserts: when an unhealthy position is liquidated, NO Perimeter
 * event is emitted, regardless of controller state.
 *
 * Run:
 *   npx hardhat test tests/perimeter/Liquidation.notouch.test.js
 */

const { expect } = require("chai");
const { BN } = require("@openzeppelin/test-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const LoanMaintenance = artifacts.require("LoanMaintenance");
const SwapsImplSovrynSwapLib = artifacts.require("SwapsImplSovrynSwapLib");
const MockExitFeeController = artifacts.require("MockExitFeeController");
const LoanOpeningsEvents = artifacts.require("LoanOpeningsEvents");

const { increaseTime } = require("../Utils/Ethereum");

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

contract("Perimeter — Liquidation no-touch coverage (Phase 3 / Task 3.4)", (accounts) => {
    let lender, borrower, liquidator, feeReceiver;
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

        loanToken = await getLoanToken(lender, sovryn, WRBTC, SUSD);
        loanTokenWRBTC = await getLoanTokenWRBTC(lender, sovryn, WRBTC, SUSD);
        await loan_pool_setup(sovryn, lender, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

        // Perimeter controller FULLY ACTIVE — proves the no-touch property
        // comes from the gate at the hook, not from the controller being
        // inactive.
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(true);
        await controller.setActive(true);
        await controller.setRate(25);
        await controller.setFeeReceiverTest(feeReceiver);
        await sovryn.setExitFeeController(controller.address, { from: lender });
    }

    before(async () => {
        [lender, borrower, liquidator, feeReceiver, ...accounts] = accounts;

        try {
            const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
            await LoanMaintenance.link(swapsImplSovrynSwapLib);
        } catch (_) {}
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    // Mirrors `prepare_liquidation` from tests/protocol/liquidationFunctions.js.
    async function openMarginTradeForLiquidation() {
        await set_demand_curve(loanToken);
        await SUSD.approve(loanToken.address, new BN(10).pow(new BN(40)));
        await loanToken.mint(lender, new BN(10).pow(new BN(21)));

        const loan_token_sent = new BN(10).mul(oneEth);
        await SUSD.mint(borrower, loan_token_sent);
        await SUSD.mint(liquidator, loan_token_sent);
        await SUSD.approve(loanToken.address, loan_token_sent, { from: borrower });
        await SUSD.approve(sovryn.address, loan_token_sent, { from: liquidator });

        const { receipt } = await loanToken.marginTrade(
            "0x0",
            new BN(2).mul(oneEth), // leverageAmount
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

    describe("liquidate (allowDonationOnFailure=true gate)", () => {
        // POSITIVE CONTROL for the no-touch claim below. Without it, "no Perimeter
        // event on liquidation" is indistinguishable from "the Perimeter system is
        // inert in this fixture" — an unwired charge-hook pointer, an unpinned
        // controller, or a burnt-out event ABI would all make the no-touch
        // assertion pass for the wrong reason. This test proves the SAME fixture
        // charges a real fee on a chargeable borrower exit, so the exemption
        // below is attributable to the origin gate and nothing else.
        it("CONTROL: the same fixture DOES charge on a chargeable exit (withdrawCollateral, 25 bps)", async () => {
            const { loan_id } = await openMarginTradeForLiquidation();

            // Sized from the loan's own collateral (0.1%, safely inside
            // maxDrawdown) and deliberately NOT round, so a fee derived by
            // different arithmetic than the controller's would mismatch.
            const loan = await sovryn.getLoan(loan_id);
            const withdrawAmount = new BN(loan["collateral"]).divn(1000).addn(333);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.withdrawCollateral(loan_id, borrower, withdrawAmount, {
                from: borrower,
            });

            const applied = tx.logs.filter((l) => l.event === "ExitFeeApplied");
            expect(applied.length, "fee system is ACTIVE in this fixture").to.equal(1);
            const fee = new BN(applied[0].args.feeAmount);
            const gross = new BN(applied[0].args.grossAmount);
            expect(
                gross.toString(),
                "the whole request was withdrawn (below maxDrawdown)"
            ).to.equal(withdrawAmount.toString());
            expect(fee.gt(new BN(0)), "a non-zero fee was actually charged").to.equal(true);
            expect(fee.toString(), "fee == gross * 25/10_000").to.equal(
                withdrawAmount.muln(25).divn(10_000).toString()
            );
            expect(
                (await RBTC.balanceOf(feeReceiver)).sub(feeRecvBefore).toString(),
                "feeReceiver delta == fee (the fee leg really settled)"
            ).to.equal(fee.toString());
        });

        it("Perimeter does NOT fire when an unhealthy position is liquidated — no ExitFeeApplied, no ExitFeeSkipped", async () => {
            const { loan_id, loan_token_sent } = await openMarginTradeForLiquidation();

            // Re-rate RBTC/SUSD so the position becomes liquidatable
            // (rate = 1e21 matches the existing "Test liquidate with rate
            // 1e21" in LiquidationTestToken.test.js).
            await priceFeeds.setRates(
                RBTC.address,
                SUSD.address,
                new BN(10).pow(new BN(21)).toString()
            );

            // Time travel so back interest can accrue (matches the existing
            // liquidate(...) helper pattern).
            await increaseTime(10 * 24 * 60 * 60);

            const loanBefore = await sovryn.getLoan(loan_id);
            const feeRecvRbtcBefore = await RBTC.balanceOf(feeReceiver);
            const feeRecvSusdBefore = await SUSD.balanceOf(feeReceiver);

            const tx = await sovryn.liquidate(loan_id, liquidator, loan_token_sent, {
                from: liquidator,
                value: 0,
            });

            const applied = tx.logs.filter((l) => l.event === "ExitFeeApplied");
            const skipped = tx.logs.filter((l) => l.event === "ExitFeeSkipped");
            expect(applied.length, "no ExitFeeApplied on liquidation").to.equal(0);
            expect(
                skipped.length,
                "no ExitFeeSkipped either — the gate short-circuits before any controller call"
            ).to.equal(0);

            // Value-level proof, independent of the event stream: the fee
            // receiver's balances do not move in either asset.
            expect(
                (await RBTC.balanceOf(feeReceiver)).sub(feeRecvRbtcBefore).toString(),
                "feeReceiver RBTC delta == 0"
            ).to.equal("0");
            expect(
                (await SUSD.balanceOf(feeReceiver)).sub(feeRecvSusdBefore).toString(),
                "feeReceiver SUSD delta == 0"
            ).to.equal("0");

            // Sanity: the liquidation was not blocked — collateral was seized.
            const loanAfter = await sovryn.getLoan(loan_id);
            expect(
                new BN(loanAfter["collateral"]).lt(new BN(loanBefore["collateral"])),
                "collateral strictly decreased — the liquidation actually executed"
            ).to.equal(true);
        });
    });
});
