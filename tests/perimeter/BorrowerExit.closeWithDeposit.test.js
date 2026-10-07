/**
 * Borrower-exit (`LoanClosingsWith.closeWithDeposit`)
 * Perimeter coverage.
 *
 * Surface: `PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW` (same as `withdrawCollateral`).
 *
 * Scenarios:
 *
 *   1. Perimeter globally disabled  → borrower gets full residual collateral;
 *                                   ExitFeeSkipped(INACTIVE).
 *   2. Surface default 25 bps    → fee receiver gets 25 bps of the residual;
 *                                   borrower gets net; gross == net + fee.
 *   3. Sub-product override key  → the policy key is the pool (loanLocal.lender),
 *                                   not the loan token. With
 *                                   policy keyed by `loanLocal.lender`
 *                                   (the iToken proxy = `loanToken.address`)
 *                                   at 50 bps AND policy keyed by the
 *                                   underlying `SUSD` at 999 bps, the
 *                                   borrower must be charged 50 bps.
 *   4. Senior accounting senior  → Lender (iToken) is repaid the loan
 *                                   principal in loanToken (SUSD); only the
 *                                   borrower-bound residual (RBTC) is
 *                                   subject to Perimeter.
 *   5. INVALID_QUOTE fallback    → controller returns `fee > gross` →
 *                                   borrower gets full residual,
 *                                   ExitFeeSkipped(INVALID_QUOTE).
 *
 * Run:
 *   npx hardhat test tests/perimeter/BorrowerExit.closeWithDeposit.test.js
 */

const { expect } = require("chai");
const { BN, constants, expectRevert } = require("@openzeppelin/test-helpers");
const { loadFixture, takeSnapshot } = require("@nomicfoundation/hardhat-network-helpers");

const LoanMaintenance = artifacts.require("LoanMaintenance");
const SwapsImplSovrynSwapLib = artifacts.require("SwapsImplSovrynSwapLib");
const MockExitFeeController = artifacts.require("MockExitFeeController");
const MockExitDelayQueue = artifacts.require("MockExitDelayQueue");

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
    borrow_indefinite_loan,
} = require("../Utils/initializer.js");

const mutexUtils = require("../../deployment/helpers/reentrancy/utils");
const { linkIfUsed } = require("../Utils/initializer.js");

const wei = web3.utils.toWei;

const PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW = web3.utils.keccak256(
    "PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW"
);

const REASON = { NONE: 0, INACTIVE: 1, DISABLED: 2, INVALID_QUOTE: 3 };

contract("Perimeter — borrower-exit closeWithDeposit", (accounts) => {
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
            await linkIfUsed(LoanMaintenance, swapsImplSovrynSwapLib);
        } catch (_) {}
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    // ── helpers ────────────────────────────────────────────────────────────

    function findApplied(logs) {
        return logs.filter((l) => l.event === "ExitFeeApplied");
    }
    function findSkipped(logs) {
        return logs.filter((l) => l.event === "ExitFeeSkipped");
    }
    function expectedFee(gross, rateBps) {
        return new BN(gross).muln(rateBps).divn(10_000);
    }

    /// Opens a SUSD/RBTC indefinite loan and returns
    ///   { loan_id, borrower, receiver, principal, residual }
    /// where `residual` is the borrower-bound collateral once the loan is
    /// closed in full (loanLocal.collateral after `_returnPrincipalWithDeposit`
    /// has consumed the senior repayment).
    async function openLoanAndPrepareForFullClose() {
        const [loan_id, borrower, receiver, withdraw_amount] = await borrow_indefinite_loan(
            loanToken,
            sovryn,
            SUSD,
            RBTC,
            [owner, account1, accounts[2]]
        );
        // Loan is open with SUSD principal + RBTC collateral. To closeWithDeposit
        // in full, the borrower needs SUSD equal to the principal (plus a buffer
        // for interest). Seed and approve.
        const loan = await sovryn.getLoan(loan_id);
        const principal = new BN(loan.principal);
        const collateral = new BN(loan.collateral);
        const seed = principal.muln(2); // generous buffer for interest accrual
        await SUSD.mint(borrower, seed);
        await SUSD.approve(sovryn.address, seed, { from: borrower });
        return { loan_id, borrower, receiver, principal, collateral };
    }

    // ── tests ──────────────────────────────────────────────────────────────

    describe("Perimeter globally disabled (controller.exitFeeEnabled = false)", () => {
        it("closeWithDeposit returns full collateral residual to receiver; ExitFeeSkipped(INACTIVE)", async () => {
            const { loan_id, borrower, receiver, principal, collateral } =
                await openLoanAndPrepareForFullClose();

            const rbtcBefore = await RBTC.balanceOf(receiver);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.closeWithDeposit(loan_id, receiver, principal, {
                from: borrower,
            });

            const applied = findApplied(tx.logs);
            const skipped = findSkipped(tx.logs);
            expect(applied.length, "no Applied when perimeter disabled").to.equal(0);
            expect(skipped.length, "one Skipped event").to.equal(1);
            expect(skipped[0].args.reason.toString()).to.equal(REASON.INACTIVE.toString());

            const gross = new BN(skipped[0].args.grossAmount);
            const rbtcAfter = await RBTC.balanceOf(receiver);
            const feeRecvAfter = await RBTC.balanceOf(feeReceiver);
            expect(rbtcAfter.sub(rbtcBefore).toString()).to.equal(gross.toString());
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal("0");
            expect(gross.toString()).to.equal(collateral.toString());
        });
    });

    describe("Surface default 25 bps (no sub-product override)", () => {
        it("closeWithDeposit charges 25 bps on the borrower-bound residual; gross == net + fee", async () => {
            await controller.setExitFeeEnabledTest(true);

            const { loan_id, borrower, receiver, principal } =
                await openLoanAndPrepareForFullClose();

            const rbtcBefore = await RBTC.balanceOf(receiver);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.closeWithDeposit(loan_id, receiver, principal, {
                from: borrower,
            });

            const applied = findApplied(tx.logs);
            const skipped = findSkipped(tx.logs);
            expect(applied.length).to.equal(1);
            expect(skipped.length).to.equal(0);
            expect(applied[0].args.surfaceId).to.equal(
                PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW
            );

            const gross = new BN(applied[0].args.grossAmount);
            const fee = new BN(applied[0].args.feeAmount);
            const net = new BN(applied[0].args.netAmount);
            expect(fee.toString()).to.equal(expectedFee(gross, 25).toString());
            expect(gross.toString()).to.equal(net.add(fee).toString());

            const rbtcAfter = await RBTC.balanceOf(receiver);
            const feeRecvAfter = await RBTC.balanceOf(feeReceiver);
            expect(rbtcAfter.sub(rbtcBefore).toString()).to.equal(net.toString());
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal(fee.toString());
        });
    });

    describe("the sub-product key is the pool, not the loan token", () => {
        it("policy keyed by iToken pool (loanLocal.lender) is honored; underlying-token key is NOT", async () => {
            await controller.setExitFeeEnabledTest(true);
            // 50 bps on the iToken (correct key); 999 bps on the underlying
            // SUSD (the buggy key). A 50 bps fee proves the hook routes the
            // policy lookup through `loanLocal.lender`, not
            // `loanParamsLocal.loanToken`.
            await controller.setSubProductPolicyTest(loanToken.address, true, 50);
            await controller.setSubProductPolicyTest(SUSD.address, true, 999);

            const { loan_id, borrower, receiver, principal } =
                await openLoanAndPrepareForFullClose();

            const tx = await sovryn.closeWithDeposit(loan_id, receiver, principal, {
                from: borrower,
            });

            const applied = findApplied(tx.logs);
            expect(applied.length).to.equal(1);

            const gross = new BN(applied[0].args.grossAmount);
            const fee = new BN(applied[0].args.feeAmount);
            expect(fee.toString()).to.equal(expectedFee(gross, 50).toString());

            // Direct cross-check on the event's `subProduct` field.
            expect(applied[0].args.subProduct.toLowerCase()).to.equal(
                loanToken.address.toLowerCase()
            );
            expect(applied[0].args.subProduct.toLowerCase()).to.not.equal(
                SUSD.address.toLowerCase()
            );
        });
    });

    describe("Senior accounting (lender repayment + interest) unchanged by Perimeter", () => {
        it("the residual that Perimeter charges is collateral only — lender's loanToken account is untouched by the fee leg", async () => {
            await controller.setExitFeeEnabledTest(true);

            const { loan_id, borrower, receiver, principal } =
                await openLoanAndPrepareForFullClose();

            // Lender (iToken) holds its principal in SUSD post-close. The fee
            // leg fires on RBTC (the collateral / residual asset), so the
            // lender's SUSD balance accounting must be untouched by Perimeter.
            const lenderSusdBefore = await SUSD.balanceOf(loanToken.address);
            const lenderRbtcBefore = await RBTC.balanceOf(loanToken.address);
            const feeRecvSusdBefore = await SUSD.balanceOf(feeReceiver);

            const tx = await sovryn.closeWithDeposit(loan_id, receiver, principal, {
                from: borrower,
            });

            const applied = findApplied(tx.logs);
            expect(applied.length).to.equal(1);
            // The asset that got the fee is RBTC (collateral), not SUSD (loan).
            expect(applied[0].args.asset.toLowerCase()).to.equal(RBTC.address.toLowerCase());

            // Lender's SUSD balance MUST have grown by the senior repayment
            // (principal + interest); the fee receiver's SUSD balance MUST
            // be unchanged (the fee is in RBTC, not SUSD).
            const lenderSusdAfter = await SUSD.balanceOf(loanToken.address);
            const lenderRbtcAfter = await RBTC.balanceOf(loanToken.address);
            const feeRecvSusdAfter = await SUSD.balanceOf(feeReceiver);

            expect(lenderSusdAfter.sub(lenderSusdBefore).gt(new BN(0))).to.equal(true);
            expect(lenderRbtcAfter.sub(lenderRbtcBefore).toString()).to.equal("0");
            expect(feeRecvSusdAfter.sub(feeRecvSusdBefore).toString()).to.equal("0");
        });
    });

    describe("INVALID_QUOTE fallback (defensive _quoteIsValid)", () => {
        it("controller returns rateBps > MAX_BPS → full gross to user, ExitFeeSkipped(INVALID_QUOTE)", async () => {
            await controller.setExitFeeEnabledTest(true);
            await controller.setSubProductPolicyTest(loanToken.address, true, 10001);

            const { loan_id, borrower, receiver, principal } =
                await openLoanAndPrepareForFullClose();

            const rbtcBefore = await RBTC.balanceOf(receiver);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.closeWithDeposit(loan_id, receiver, principal, {
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

    it("restores principal, interest, collateral, deposit approval and fee after close ingress rejection", async () => {
        const { loan_id, borrower, receiver, principal } = await openLoanAndPrepareForFullClose();
        await controller.setExitFeeEnabledTest(true);
        await controller.setSecurityPerimeterEnabledTest(true);
        await controller.setGlobalDelaySecondsTest(3600);
        const queue = await MockExitDelayQueue.new(WRBTC.address, 60);
        await queue.setAllowedSource(sovryn.address, true);
        await sovryn.setExitDelayQueue(queue.address, { from: owner });
        const raw = (signature, types, args) =>
            web3.eth.call({
                to: sovryn.address,
                data:
                    web3.eth.abi.encodeFunctionSignature(signature) +
                    web3.eth.abi.encodeParameters(types, args).slice(2),
            });
        const snapshot = async () => ({
            loan: await raw("loans(bytes32)", ["bytes32"], [loan_id]),
            loanInterest: await raw("loanInterest(bytes32)", ["bytes32"], [loan_id]),
            lenderInterest: await raw(
                "lenderInterest(address,address)",
                ["address", "address"],
                [loanToken.address, SUSD.address]
            ),
            borrower: (await SUSD.balanceOf(borrower)).toString(),
            depositAllowance: (await SUSD.allowance(borrower, sovryn.address)).toString(),
            lender: (await SUSD.balanceOf(loanToken.address)).toString(),
            protocolLoanToken: (await SUSD.balanceOf(sovryn.address)).toString(),
            protocolCollateral: (await RBTC.balanceOf(sovryn.address)).toString(),
            receiver: (await RBTC.balanceOf(receiver)).toString(),
            fee: (await RBTC.balanceOf(feeReceiver)).toString(),
            queue: (await RBTC.balanceOf(queue.address)).toString(),
            escrow: (await queue.totalEscrowed(RBTC.address)).toString(),
            requests: (await queue.lastRequestId()).toString(),
        });
        const checkpoint = await takeSnapshot();
        const positive = await sovryn.closeWithDeposit(loan_id, receiver, principal, {
            from: borrower,
        });
        const applied = findApplied(positive.logs)[0];
        expect(new BN(applied.args.feeAmount).gtn(0)).to.equal(true);
        expect((await queue.getRequest(1)).amount.toString()).to.equal(
            applied.args.netAmount.toString()
        );
        await checkpoint.restore();
        await queue.setAllowedSource(sovryn.address, false);
        const before = await snapshot();
        await expectRevert(
            sovryn.closeWithDeposit(loan_id, receiver, principal, {
                from: borrower,
                gas: 6000000,
            }),
            "MockQueue: unregistered source"
        );
        expect(await snapshot()).to.deep.equal(before);
        await queue.setAllowedSource(sovryn.address, true);
        await sovryn.closeWithDeposit(loan_id, receiver, principal, { from: borrower });
        expect((await queue.lastRequestId()).toString()).to.equal("1");
    });
});
