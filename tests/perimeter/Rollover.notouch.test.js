/**
 * Phase 3 — Rollover no-touch coverage.
 *
 * `LoanClosingsRollover.rollover` closes via
 * `_closeWithSwap(..., CloseOrigin.Rollover)`. Per
 * `perimeter/docs/IMPLEMENTATION_DESIGN.md` §rollover, rollover payouts are
 * keeper/maintenance compensation and must not be Perimeter-charged.
 *
 * The gate at `ModuleCommonFunctionalities._exitFeeChargeable` charges only a
 * `CloseOrigin.VoluntaryClose` initiated by the borrower/delegate. Rollover is
 * exempt by origin — for any caller of `rollover()` (keeper or borrower) and
 * any branch — so Perimeter short-circuits: no `ExitFeeApplied`, no
 * `ExitFeeSkipped`. The borrower-self-rollover case covers the keeper-reward
 * branch with the borrower as caller.
 *
 * Run:
 *   npx hardhat test tests/perimeter/Rollover.notouch.test.js
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
    getPriceFeeds,
    getSovryn,
    getSOV,
    decodeLogs,
} = require("../Utils/initializer.js");

const mutexUtils = require("../../deployment/helpers/reentrancy/utils");
const { linkIfUsed } = require("../Utils/initializer.js");

const wei = web3.utils.toWei;
const oneEth = new BN(wei("1", "ether"));
const TINY_AMOUNT = new BN(25).mul(new BN(10).pow(new BN(13))); // 25 * 10**13

contract("Perimeter — Rollover no-touch coverage (Phase 3 / regression)", (accounts) => {
    let lender, feeReceiver, rolloverKeeper;
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

        // Perimeter controller wired and FULLY ACTIVE — this proves the
        // no-touch property comes from the gate at the hook, not from the
        // controller being inactive.
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(true);
        await controller.setActive(true);
        await controller.setRate(25); // surface default 25 bps
        await controller.setFeeReceiverTest(feeReceiver);
        await sovryn.setExitFeeController(controller.address, { from: lender });
    }

    before(async () => {
        [lender, feeReceiver, rolloverKeeper, ...accounts] = accounts;

        try {
            const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
            await linkIfUsed(LoanMaintenance, swapsImplSovrynSwapLib);
        } catch (_) {}
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    // Value-level counterpart to the "no Perimeter event" assertions: the fee
    // receiver's balances must not move in EITHER asset. An event-only check
    // would miss a transfer that failed to emit.
    async function expectNoFeeSkimmed(rbtcBefore, susdBefore) {
        expect(
            (await RBTC.balanceOf(feeReceiver)).sub(rbtcBefore).toString(),
            "feeReceiver RBTC delta == 0"
        ).to.equal("0");
        expect(
            (await SUSD.balanceOf(feeReceiver)).sub(susdBefore).toString(),
            "feeReceiver SUSD delta == 0"
        ).to.equal("0");
    }

    // Mirrors the `setup_rollover_test` helper in tests/protocol/RolloverTestToken.test.js.
    //   `mode === "tiny"`   → loan_token_sent just above TINY_AMOUNT so a
    //                         small re-rating can push the position into
    //                         the tiny-dust or keeper-reward branches.
    //   `mode === "normal"` → loan_token_sent = 100 SUSD so the rollover
    //                         renews the loan without invoking
    //                         `_closeWithSwap` at all.
    async function openMarginTradeAndExpire(mode) {
        await set_demand_curve(loanToken);
        await SUSD.approve(loanToken.address, new BN(10).pow(new BN(40)));
        await loanToken.mint(lender, new BN(10).pow(new BN(30)));

        const borrower = accounts[1];
        const loan_token_sent =
            mode === "tiny"
                ? TINY_AMOUNT.add(new BN(1)).mul(new BN(10).pow(new BN(4)))
                : new BN(wei("100", "ether"));
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

        // Skip past loan end so rollover is eligible.
        const num = await blockNumber();
        const currentBlock = await web3.eth.getBlock(num);
        const time_until_loan_end = loan["endTimestamp"] - currentBlock.timestamp;
        await increaseTime(time_until_loan_end);

        return { borrower, loan_id, loan };
    }

    // POSITIVE CONTROL for every no-touch claim in this file. Four tests that
    // all assert "no Perimeter event" would pass identically if the fee system
    // were inert in this fixture (unpinned controller, unwired charge-hook
    // pointer, wrong event ABI). This proves the SAME fixture charges a real,
    // settled fee on a chargeable borrower exit, so the exemptions below are
    // attributable to `CloseOrigin.Rollover` and nothing else.
    describe("CONTROL — the same fixture DOES charge on a chargeable exit", () => {
        it("withdrawCollateral on a healthy loan charges 25 bps and the fee leg settles", async () => {
            await set_demand_curve(loanToken);
            await SUSD.approve(loanToken.address, new BN(10).pow(new BN(40)));
            await loanToken.mint(lender, new BN(10).pow(new BN(30)));

            const borrower = accounts[1];
            const loan_token_sent = new BN(wei("100", "ether"));
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

            // Non-round, derived from the loan's own collateral (0.1%, safely
            // inside maxDrawdown).
            const loan = await sovryn.getLoan(loan_id);
            const withdrawAmount = new BN(loan["collateral"]).divn(1000).addn(333);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.withdrawCollateral(loan_id, borrower, withdrawAmount, {
                from: borrower,
            });

            const applied = tx.logs.filter((l) => l.event === "ExitFeeApplied");
            expect(applied.length, "fee system is ACTIVE in this fixture").to.equal(1);
            const gross = new BN(applied[0].args.grossAmount);
            const fee = new BN(applied[0].args.feeAmount);
            expect(gross.toString()).to.equal(withdrawAmount.toString());
            expect(fee.gt(new BN(0)), "a non-zero fee was actually charged").to.equal(true);
            expect(fee.toString()).to.equal(withdrawAmount.muln(25).divn(10_000).toString());
            expect(
                (await RBTC.balanceOf(feeReceiver)).sub(feeRecvBefore).toString(),
                "feeReceiver delta == fee (the fee leg really settled)"
            ).to.equal(fee.toString());
        });
    });

    describe("normal rollover (rolloverReward != 0 and <= collateral; loan stays open)", () => {
        it("Perimeter does NOT fire — no _closeWithSwap at all, just interest renewal + keeper reward", async () => {
            const { loan_id } = await openMarginTradeAndExpire("normal");

            // No price re-rating → rollover stays in the normal branch
            // (Rollover.sol:234 path; collateral is reduced by the reward
            // and the loan is renewed, no `_closeWithSwap` is invoked).
            const loanBefore = await sovryn.getLoan(loan_id);
            const feeRecvRbtcBefore = await RBTC.balanceOf(feeReceiver);
            const feeRecvSusdBefore = await SUSD.balanceOf(feeReceiver);

            const tx = await sovryn.rollover(loan_id, "0x", { from: rolloverKeeper });

            const applied = tx.logs.filter((l) => l.event === "ExitFeeApplied");
            const skipped = tx.logs.filter((l) => l.event === "ExitFeeSkipped");
            expect(applied.length, "no ExitFeeApplied on normal rollover").to.equal(0);
            expect(skipped.length, "no ExitFeeSkipped on normal rollover").to.equal(0);
            await expectNoFeeSkimmed(feeRecvRbtcBefore, feeRecvSusdBefore);

            // Sanity: loan is still open (renew-not-close path). `principal`
            // and `collateral` must both still be non-zero post-rollover, and
            // the rollover was NOT blocked — the term was actually extended.
            const loan = await sovryn.getLoan(loan_id);
            expect(new BN(loan["principal"]).gt(new BN(0))).to.equal(true);
            expect(new BN(loan["collateral"]).gt(new BN(0))).to.equal(true);
            expect(
                new BN(loan["endTimestamp"]).gt(new BN(loanBefore["endTimestamp"])),
                "loan term extended — the rollover was not blocked"
            ).to.equal(true);
        });
    });

    describe("rollover tiny-position branch (Rollover.sol:244, allowDonationOnFailure = true)", () => {
        it("Perimeter does NOT fire — exempt by CloseOrigin.Rollover (independent of allowDonationOnFailure)", async () => {
            const { borrower, loan_id } = await openMarginTradeAndExpire("tiny");

            // Re-rate WRBTC/SUSD so that closing the loan would leave a
            // tiny dust position (mirrors the trigger used in the existing
            // `Test rollover tiny amount` test in RolloverTestToken.test.js).
            // This forces Rollover.sol:244 → `_closeWithSwap(... allowDonationOnFailure = true)`.
            await priceFeeds.setRates(
                WRBTC.address,
                SUSD.address,
                new BN(10).pow(new BN(23)).toString()
            );

            const feeRecvRbtcBefore = await RBTC.balanceOf(feeReceiver);
            const feeRecvSusdBefore = await SUSD.balanceOf(feeReceiver);

            const tx = await sovryn.rollover(loan_id, "0x", { from: rolloverKeeper });

            const applied = tx.logs.filter((l) => l.event === "ExitFeeApplied");
            const skipped = tx.logs.filter((l) => l.event === "ExitFeeSkipped");
            expect(applied.length, "no ExitFeeApplied on tiny-position force-close").to.equal(0);
            expect(
                skipped.length,
                "no ExitFeeSkipped — CloseOrigin.Rollover short-circuits the gate before any controller call"
            ).to.equal(0);
            await expectNoFeeSkimmed(feeRecvRbtcBefore, feeRecvSusdBefore);

            // Sanity: position closed.
            const loan = await sovryn.getLoan(loan_id);
            expect(loan["principal"].toString()).to.equal("0");
            expect(loan["collateral"].toString()).to.equal("0");
            expect(borrower).to.not.equal(rolloverKeeper);
        });
    });

    describe("rollover keeper-reward branch (Rollover.sol:224, rolloverReward > collateral)", () => {
        it("Perimeter does NOT fire — no ExitFeeApplied, no ExitFeeSkipped — and the keeper still receives the residual", async () => {
            const { borrower, loan_id } = await openMarginTradeAndExpire("tiny");

            // Re-price collateral so reward > collateral and the keeper-
            // reward branch is taken.
            await priceFeeds.setRates(
                WRBTC.address,
                RBTC.address,
                new BN(10).pow(new BN(19)).mul(new BN(3)).toString()
            );

            const keeperSusdBefore = await SUSD.balanceOf(rolloverKeeper);
            const feeRecvRbtcBefore = await RBTC.balanceOf(feeReceiver);
            const feeRecvSusdBefore = await SUSD.balanceOf(feeReceiver);

            const tx = await sovryn.rollover(loan_id, "0x", { from: rolloverKeeper });

            // CloseOrigin.Rollover → `_exitFeeChargeable` returns false → Perimeter
            // is skipped silently (no ExitFeeApplied, and no ExitFeeSkipped
            // either — the gate short-circuits before any controller call).
            const applied = tx.logs.filter((l) => l.event === "ExitFeeApplied");
            const skipped = tx.logs.filter((l) => l.event === "ExitFeeSkipped");
            expect(applied.length, "no ExitFeeApplied on rollover keeper-reward branch").to.equal(
                0
            );
            expect(
                skipped.length,
                "no ExitFeeSkipped either — the gate short-circuits before any quote"
            ).to.equal(0);
            await expectNoFeeSkimmed(feeRecvRbtcBefore, feeRecvSusdBefore);

            // Sanity: rollover actually happened (loan closed) and keeper
            // received the residual collateral (in SUSD form after the swap).
            const endLoan = await sovryn.getLoan(loan_id);
            expect(endLoan["principal"].toString()).to.equal("0");
            expect(endLoan["collateral"].toString()).to.equal("0");

            const keeperSusdAfter = await SUSD.balanceOf(rolloverKeeper);
            expect(
                keeperSusdAfter.gt(keeperSusdBefore),
                "keeper SUSD balance increased by the residual"
            ).to.equal(true);

            // The borrower's loan is gone, but no Perimeter was charged on the
            // keeper's payout.
            expect(borrower).to.not.equal(rolloverKeeper);
        });
    });

    describe("rollover keeper-reward branch (Rollover.sol:224) — BORROWER self-initiated", () => {
        it("Perimeter does NOT fire even when msg.sender == borrower — exempt by CloseOrigin.Rollover", async () => {
            const { borrower, loan_id } = await openMarginTradeAndExpire("tiny");

            // Same keeper-reward trigger as above (reward > collateral)...
            await priceFeeds.setRates(
                WRBTC.address,
                RBTC.address,
                new BN(10).pow(new BN(19)).mul(new BN(3)).toString()
            );

            const borrowerSusdBefore = await SUSD.balanceOf(borrower);
            const feeRecvRbtcBefore = await RBTC.balanceOf(feeReceiver);
            const feeRecvSusdBefore = await SUSD.balanceOf(feeReceiver);

            // ...but the BORROWER calls rollover on their own position. The
            // keeper-reward branch sets `receiver = msg.sender = borrower`, yet
            // `CloseOrigin.Rollover` keeps it exempt — rollover compensation is
            // never a borrower exit.
            const tx = await sovryn.rollover(loan_id, "0x", { from: borrower });

            const applied = tx.logs.filter((l) => l.event === "ExitFeeApplied");
            const skipped = tx.logs.filter((l) => l.event === "ExitFeeSkipped");
            expect(
                applied.length,
                "no ExitFeeApplied on borrower self-initiated rollover keeper-reward branch"
            ).to.equal(0);
            expect(
                skipped.length,
                "no ExitFeeSkipped — CloseOrigin.Rollover short-circuits before any quote"
            ).to.equal(0);
            await expectNoFeeSkimmed(feeRecvRbtcBefore, feeRecvSusdBefore);

            // Sanity: rollover actually happened (loan closed) and the borrower
            // received the residual collateral (as SUSD) in full — unfee'd.
            const endLoan = await sovryn.getLoan(loan_id);
            expect(endLoan["principal"].toString()).to.equal("0");
            expect(endLoan["collateral"].toString()).to.equal("0");

            const borrowerSusdAfter = await SUSD.balanceOf(borrower);
            expect(
                borrowerSusdAfter.gt(borrowerSusdBefore),
                "borrower received the residual, no fee skimmed"
            ).to.equal(true);
        });
    });
});
