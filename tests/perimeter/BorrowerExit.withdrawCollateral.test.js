/**
 * Phase 3 / Task 3.1 — Borrower-exit (`LoanMaintenance.withdrawCollateral`)
 * Perimeter coverage.
 *
 * Surface: `SURFACE_LENDING_BORROWER_WITHDRAW`.
 *
 * Scenarios (the first three mirror Phase 2 lender shape; the last two are
 * regression tests for Phase 3 review findings):
 *
 *   1. Perimeter globally disabled  → full gross to borrower, ExitFeeSkipped(INACTIVE).
 *   2. Surface default 25 bps    → fee receiver gets 25 bps of withdrawal,
 *                                   borrower gets net; gross == net + fee.
 *   3. WRBTC collateral path     → fee leg unwraps WRBTC → native, sent to
 *                                   feeReceiver; borrower receives net RBTC.
 *   4. Sub-product override key  → REGRESSION for review Finding 1. With
 *                                   `subProductPolicy[lender] = 50 bps` AND
 *                                   `subProductPolicy[loanParams.loanToken]
 *                                   = 999 bps` (the wrong key), the borrower
 *                                   must be charged 50 bps. Charging 999 bps
 *                                   (or 25 bps surface default) would prove
 *                                   the hook is wired to the wrong subProduct.
 *   5. INVALID_QUOTE fallback    → controller returns `fee > gross` → full
 *                                   gross to user, ExitFeeSkipped(INVALID_QUOTE).
 *   6. Proxy routing             → REGRESSION for review Finding 2.
 *                                   `sovryn.exitFeeController()` and
 *                                   `sovryn.setExitFeeController(addr)` are
 *                                   reachable through sovrynProtocol (proves
 *                                   the new selectors landed in
 *                                   LoanMaintenance.initialize).
 *
 * Run:
 *   npx hardhat test tests/perimeter/BorrowerExit.withdrawCollateral.test.js
 */

const { expect } = require("chai");
const { expectRevert, BN, constants } = require("@openzeppelin/test-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const LoanMaintenance = artifacts.require("LoanMaintenance");
const SwapsImplSovrynSwapLib = artifacts.require("SwapsImplSovrynSwapLib");
const MockExitFeeController = artifacts.require("MockExitFeeController");
const MockMalformedExitFeeController = artifacts.require("MockMalformedExitFeeController");
const MockShortReturnExitFeeController = artifacts.require("MockShortReturnExitFeeController");
const BorrowerExitPerimeterOps = artifacts.require("BorrowerExitPerimeterOps");

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
const ZERO = constants.ZERO_ADDRESS;

const SURFACE_LENDING_BORROWER_WITHDRAW = web3.utils.keccak256(
    "COLFEE:SURFACE_LENDING_BORROWER_WITHDRAW"
);

// SkipReason enum (from IExitFeeController):
//   0 NONE  1 INACTIVE  2 DISABLED  3 INVALID_QUOTE  4 CONTROLLER_REVERT  5 VAULT_REVERT
const REASON = { NONE: 0, INACTIVE: 1, DISABLED: 2, INVALID_QUOTE: 3 };

contract("Perimeter — borrower-exit withdrawCollateral (Phase 3 / Task 3.1)", (accounts) => {
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

        // ── Perimeter controller wired into the protocol, default OFF ─────────
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(false); // off by default per spec
        await controller.setActive(true); // surface active when enabled
        await controller.setRate(25); // surface default 25 bps
        await controller.setFeeReceiverTest(feeReceiver);

        // Proves Finding 2's fix: `setExitFeeController` is reachable through
        // sovrynProtocol because LoanMaintenance.initialize registered it.
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

    // ── helpers ────────────────────────────────────────────────────────────

    function findApplied(logs) {
        return logs.filter((l) => l.event === "ExitFeeApplied");
    }
    function findSkipped(logs) {
        return logs.filter((l) => l.event === "ExitFeeSkipped");
    }

    /// Compute fee = gross * rateBps / 10_000 using BN math.
    function expectedFee(gross, rateBps) {
        return new BN(gross).muln(rateBps).divn(10_000);
    }

    // ── tests ──────────────────────────────────────────────────────────────

    describe("Perimeter globally disabled (controller.exitFeeEnabled = false)", () => {
        it("withdrawCollateral pays full gross; emits ExitFeeSkipped(INACTIVE)", async () => {
            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );

            const withdrawAmount = new BN(10).pow(new BN(15));
            const rbtcBefore = await RBTC.balanceOf(owner);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.withdrawCollateral(loan_id, owner, withdrawAmount);

            const applied = findApplied(tx.logs);
            const skipped = findSkipped(tx.logs);

            expect(applied.length, "no Applied when perimeter disabled").to.equal(0);
            expect(skipped.length, "one Skipped event").to.equal(1);
            expect(skipped[0].args.reason.toString()).to.equal(REASON.INACTIVE.toString());
            expect(skipped[0].args.rateBps.toString()).to.equal("0");

            // Borrower received full gross; fee receiver untouched.
            const rbtcAfter = await RBTC.balanceOf(owner);
            const feeRecvAfter = await RBTC.balanceOf(feeReceiver);
            expect(rbtcAfter.sub(rbtcBefore).toString()).to.equal(withdrawAmount.toString());
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal("0");
        });
    });

    describe("Surface default 25 bps (no sub-product override)", () => {
        it("withdrawCollateral charges 25 bps; gross == net + fee", async () => {
            await controller.setExitFeeEnabledTest(true);

            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );

            // Deliberately NOT a round number: 1e15 divides evenly by 25 bps,
            // so a fee derived with the wrong rounding would still match. The
            // trailing 333 wei forces a truncating division and pins that the
            // product pays exactly the controller's quoted fee, no re-derivation.
            const withdrawAmount = new BN(10).pow(new BN(15)).addn(333);
            const rbtcBefore = await RBTC.balanceOf(owner);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.withdrawCollateral(loan_id, owner, withdrawAmount);

            const applied = findApplied(tx.logs);
            const skipped = findSkipped(tx.logs);
            expect(applied.length, "one Applied").to.equal(1);
            expect(skipped.length, "no Skipped on happy path").to.equal(0);

            const expectedFeeAmount = expectedFee(withdrawAmount, 25);
            // Guard the guard: this scenario must exercise a TRUNCATING split.
            expect(
                expectedFeeAmount.muln(10_000).eq(withdrawAmount.muln(25)),
                "gross*25/10000 must not divide evenly here"
            ).to.equal(false);
            const expectedNet = withdrawAmount.sub(expectedFeeAmount);

            expect(applied[0].args.feeAmount.toString()).to.equal(expectedFeeAmount.toString());
            expect(applied[0].args.netAmount.toString()).to.equal(expectedNet.toString());
            expect(applied[0].args.grossAmount.toString()).to.equal(withdrawAmount.toString());
            // surface = SURFACE_LENDING_BORROWER_WITHDRAW
            expect(applied[0].args.surfaceId).to.equal(SURFACE_LENDING_BORROWER_WITHDRAW);

            // Borrower received net, fee receiver received fee.
            const rbtcAfter = await RBTC.balanceOf(owner);
            const feeRecvAfter = await RBTC.balanceOf(feeReceiver);
            expect(rbtcAfter.sub(rbtcBefore).toString()).to.equal(expectedNet.toString());
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal(
                expectedFeeAmount.toString()
            );
        });
    });

    describe("Native collateral (WRBTC) path", () => {
        it("withdrawCollateral on a WRBTC-collateral loan unwraps fee + user legs to native RBTC", async () => {
            await controller.setExitFeeEnabledTest(true);

            // Use a non-sender `userReceiver` so the user-leg assertion is
            // independent of any RBTC the borrower (`owner`, msg.sender)
            // happens to spend/earn on gas in this transaction.
            const userReceiver = account1;

            // Open a WRBTC-collateralized position. Standard helper supports
            // the "WRBTC" override on the last param (see DepositCollateralTestToken).
            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner,
                "WRBTC"
            );

            // Top up some native collateral so we have headroom to withdraw.
            const depositAmount = new BN(10).pow(new BN(15));
            await sovryn.depositCollateral(loan_id, depositAmount, { value: depositAmount });

            const withdrawAmount = new BN(10).pow(new BN(15));

            const feeRecvBefore = new BN(await web3.eth.getBalance(feeReceiver));
            const userRecvBefore = new BN(await web3.eth.getBalance(userReceiver));

            const tx = await sovryn.withdrawCollateral(loan_id, userReceiver, withdrawAmount, {
                from: owner,
            });

            const applied = findApplied(tx.logs);
            expect(applied.length, "one Applied on native path").to.equal(1);

            const expectedFeeAmount = expectedFee(withdrawAmount, 25);
            const expectedNet = withdrawAmount.sub(expectedFeeAmount);

            // Fee leg → native RBTC to feeReceiver (NOT WRBTC).
            const feeRecvAfter = new BN(await web3.eth.getBalance(feeReceiver));
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal(
                expectedFeeAmount.toString()
            );

            // User leg → native RBTC to userReceiver. userReceiver is NOT
            // the caller, so its balance delta isn't masked by gas spent on
            // this tx; the protocol's vaultEtherWithdraw path is what's
            // being exercised here.
            const userRecvAfter = new BN(await web3.eth.getBalance(userReceiver));
            expect(userRecvAfter.sub(userRecvBefore).toString()).to.equal(expectedNet.toString());

            // Cross-checks on the emitted event.
            expect(applied[0].args.asset.toLowerCase()).to.equal(WRBTC.address.toLowerCase());
            expect(applied[0].args.recipient.toLowerCase()).to.equal(userReceiver.toLowerCase());
        });
    });

    describe("Sub-product override REGRESSION (Finding 1: subProduct == loanLocal.lender)", () => {
        it("policy keyed by iToken pool (loanLocal.lender) is honored; underlying-token key is NOT", async () => {
            await controller.setExitFeeEnabledTest(true);

            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );

            // Configure BOTH possible policy keys with WILDLY different rates.
            //
            //   Correct key (loanLocal.lender == loanToken proxy) → 50 bps
            //   Wrong key   (loanParamsLocal.loanToken == SUSD)   → 999 bps
            //
            // If the hook is wired to `loanParamsLocal.loanToken` (the bug),
            // the borrower would get charged 999 bps. With the fix, the
            // applied rate is 50 bps. The surface default is 25 bps, so a
            // missed-match would fall back to that — also visibly distinct.
            //
            // Note: `loanLocal.lender` is the iToken proxy address — set as
            // `address(this)` of the loan token contract at open time
            // (LoanTokenLogicStandard:134) and equal to `loanToken.address`
            // for any loan originated via this lender.
            await controller.setSubProductPolicyTest(loanToken.address, true, 50);
            await controller.setSubProductPolicyTest(SUSD.address, true, 999);

            const withdrawAmount = new BN(10).pow(new BN(15));
            const tx = await sovryn.withdrawCollateral(loan_id, owner, withdrawAmount);

            const applied = findApplied(tx.logs);
            expect(applied.length).to.equal(1);

            // 50 bps applied → keyed by lender (iToken).
            // 999 bps would prove the hook used loanParamsLocal.loanToken.
            // 25 bps would prove the hook missed both overrides entirely.
            const expectedFeeAmount = expectedFee(withdrawAmount, 50);
            expect(applied[0].args.feeAmount.toString()).to.equal(expectedFeeAmount.toString());

            // Cross-check via the event's `subProduct` field (a direct
            // observation of what the hook actually passed to the controller).
            expect(applied[0].args.subProduct.toLowerCase()).to.equal(
                loanToken.address.toLowerCase()
            );
            expect(applied[0].args.subProduct.toLowerCase()).to.not.equal(
                SUSD.address.toLowerCase()
            );
        });
    });

    describe("INVALID_QUOTE fallback (defensive _quoteIsValid)", () => {
        it("controller returns a quote with fee>gross → full gross to user, ExitFeeSkipped(INVALID_QUOTE)", async () => {
            await controller.setExitFeeEnabledTest(true);

            // Configure a malicious rate that makes _quoteIsValid fail.
            // The mock computes fee = gross * rateBps / 10_000, so rate > 10000
            // yields fee > gross and is rejected by _quoteIsValid
            // (it caps rateBps <= 10_000). The downstream hook must skip the
            // fee leg and pay full gross.
            await controller.setSubProductPolicyTest(loanToken.address, true, 10001);

            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );

            const withdrawAmount = new BN(10).pow(new BN(15));
            const rbtcBefore = await RBTC.balanceOf(owner);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.withdrawCollateral(loan_id, owner, withdrawAmount);

            const applied = findApplied(tx.logs);
            const skipped = findSkipped(tx.logs);
            expect(applied.length, "no Applied when quote invalid").to.equal(0);
            expect(skipped.length, "one Skipped event").to.equal(1);
            expect(skipped[0].args.reason.toString()).to.equal(REASON.INVALID_QUOTE.toString());

            // Full gross to borrower; fee receiver untouched.
            const rbtcAfter = await RBTC.balanceOf(owner);
            const feeRecvAfter = await RBTC.balanceOf(feeReceiver);
            expect(rbtcAfter.sub(rbtcBefore).toString()).to.equal(withdrawAmount.toString());
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal("0");
        });
    });

    describe("Proxy routing REGRESSION (Finding 2: selectors registered on sovrynProtocol)", () => {
        it("sovryn.exitFeeController() returns the pinned address", async () => {
            // Set in the fixture; just confirm read-through.
            const got = await sovryn.exitFeeController();
            expect(got.toLowerCase()).to.equal(controller.address.toLowerCase());
        });

        it("sovryn.setExitFeeController(addr) updates the pinned address (onlyOwner via TimelockOwner / accounts[0])", async () => {
            const next = await MockExitFeeController.new();
            const tx = await sovryn.setExitFeeController(next.address, { from: owner });

            // ExitFeeControllerSet(prev, current) — emit from the proxy.
            const ev = tx.logs.find((l) => l.event === "ExitFeeControllerSet");
            expect(ev, "ExitFeeControllerSet emitted").to.not.equal(undefined);
            expect(ev.args.previous.toLowerCase()).to.equal(controller.address.toLowerCase());
            expect(ev.args.current.toLowerCase()).to.equal(next.address.toLowerCase());

            const got = await sovryn.exitFeeController();
            expect(got.toLowerCase()).to.equal(next.address.toLowerCase());
        });

        it("sovryn.setExitFeeController(addr) reverts when called by a non-owner", async () => {
            const next = await MockExitFeeController.new();
            await expectRevert(
                sovryn.setExitFeeController(next.address, { from: account1 }),
                "unauthorized"
            );
        });

        it("sovryn.setExitFeeController(0) reverts (EFC:not-contract)", async () => {
            await expectRevert(
                sovryn.setExitFeeController(ZERO, { from: owner }),
                "EFC:not-contract"
            );
        });

        it("sovryn.setExitFeeController(EOA) reverts (EFC:not-contract)", async () => {
            await expectRevert(
                sovryn.setExitFeeController(account1, { from: owner }),
                "EFC:not-contract"
            );
        });
    });

    describe("Delegated-manager path (gate's `delegatedManagers[loanLocal.id][msg.sender]` arm)", () => {
        it("a delegated manager calling withdrawCollateral charges Perimeter — proves the second arm of `isBorrowerExit`", async () => {
            await controller.setExitFeeEnabledTest(true);

            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner // borrower
            );

            // accounts[2] takes the delegated-manager role on this loan.
            const delegate = accounts[2];
            await sovryn.setDelegatedManager(loan_id, delegate, true, { from: owner });

            const withdrawAmount = new BN(10).pow(new BN(15));
            const rbtcBefore = await RBTC.balanceOf(owner);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            // The delegate calls withdrawCollateral. msg.sender is the
            // delegate, NOT the borrower, so the first arm of `isBorrowerExit`
            // is false; the test passes only if the second arm
            // (`delegatedManagers[loanLocal.id][delegate]`) is true and
            // Perimeter fires.
            const tx = await sovryn.withdrawCollateral(loan_id, owner, withdrawAmount, {
                from: delegate,
            });

            const applied = findApplied(tx.logs);
            expect(
                applied.length,
                "ExitFeeApplied must fire for delegated-manager exits"
            ).to.equal(1);
            // `actor` on the event is msg.sender = delegate, not the borrower.
            // Documents the actor-policy implication for governance: a
            // per-actor exemption needs the delegate's address, not the
            // borrower's.
            expect(applied[0].args.actor.toLowerCase()).to.equal(delegate.toLowerCase());

            const expectedFeeAmount = expectedFee(withdrawAmount, 25);
            const expectedNet = withdrawAmount.sub(expectedFeeAmount);
            expect(applied[0].args.feeAmount.toString()).to.equal(expectedFeeAmount.toString());

            // Borrower still receives the net (receiver was `owner`).
            const rbtcAfter = await RBTC.balanceOf(owner);
            const feeRecvAfter = await RBTC.balanceOf(feeReceiver);
            expect(rbtcAfter.sub(rbtcBefore).toString()).to.equal(expectedNet.toString());
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal(
                expectedFeeAmount.toString()
            );
        });
    });

    describe("CONTROLLER_REVERT fallback (controller staticcall fails / returns short data)", () => {
        it("when the controller is pinned but the staticcall returns short data, Perimeter fails open → full gross to user, ExitFeeSkipped(CONTROLLER_REVERT)", async () => {
            // Pin a controller whose `quoteExitFee(...)` returns a too-short
            // payload (empty fallback → 0 bytes < 192): _safeQuote's length-gated
            // abi.decode synthesizes a CONTROLLER_REVERT quote and the hook falls
            // through to full gross. The double answers the delay quote cleanly
            // (disabled perimeter) — as a real ExitFeeController does — so the
            // fail-CLOSED delay leg does not brick this fee-leg test.
            const shortCtrl = await MockShortReturnExitFeeController.new();
            await sovryn.setExitFeeController(shortCtrl.address, { from: owner });

            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );

            const withdrawAmount = new BN(10).pow(new BN(15));
            const rbtcBefore = await RBTC.balanceOf(owner);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.withdrawCollateral(loan_id, owner, withdrawAmount);

            const applied = findApplied(tx.logs);
            const skipped = findSkipped(tx.logs);
            expect(applied.length, "no Applied when the controller misbehaves").to.equal(0);
            expect(skipped.length, "one Skipped event").to.equal(1);
            // CONTROLLER_REVERT = 4 in the SkipReason enum.
            expect(skipped[0].args.reason.toString()).to.equal("4");

            // Full gross to user; fee receiver untouched.
            const rbtcAfter = await RBTC.balanceOf(owner);
            const feeRecvAfter = await RBTC.balanceOf(feeReceiver);
            expect(rbtcAfter.sub(rbtcBefore).toString()).to.equal(withdrawAmount.toString());
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal("0");
        });

        it("controller returns LONG but MALFORMED data (192 bytes of 0xff..) → full gross, ExitFeeSkipped(CONTROLLER_REVERT)", async () => {
            // Passes safeQuote's >= 192 length gate with every word
            // non-canonical for its target type. The word-wise bounds checks
            // must route this to CONTROLLER_REVERT — protocol-side
            // counterpart of the iToken test in LenderExit.adversarial.
            const malformed = await MockMalformedExitFeeController.new();
            await sovryn.setExitFeeController(malformed.address, { from: owner });

            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );

            const withdrawAmount = new BN(10).pow(new BN(15));
            const rbtcBefore = await RBTC.balanceOf(owner);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.withdrawCollateral(loan_id, owner, withdrawAmount);

            expect(findApplied(tx.logs).length, "no Applied").to.equal(0);
            const skipped = findSkipped(tx.logs);
            expect(skipped.length, "one Skipped event").to.equal(1);
            expect(skipped[0].args.reason.toString()).to.equal("4"); // CONTROLLER_REVERT

            const rbtcAfter = await RBTC.balanceOf(owner);
            const feeRecvAfter = await RBTC.balanceOf(feeReceiver);
            expect(rbtcAfter.sub(rbtcBefore).toString()).to.equal(withdrawAmount.toString());
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal("0");
        });
    });

    // The borrower-exit charge hook is a DEPLOYED CONTRACT (BorrowerExitPerimeterOps)
    // reached by delegatecall through a STORED pointer (set in the fixture via
    // sovryn.setBorrowerExitPerimeterOps), not a link-time library. These pin the
    // new pointer's behavior: read-through, owner-gated rotation, and the
    // fail-open backstop when the pointer is mis-set.
    describe("BorrowerExitPerimeterOps pointer (the delegatecall charge hook)", () => {
        it("borrowerExitPerimeterOps() returns the pinned Ops address", async () => {
            const got = await sovryn.borrowerExitPerimeterOps();
            expect(got).to.not.equal(ZERO);
            // It is a contract (the fixture deployed + pinned it).
            expect((await web3.eth.getCode(got)).length).to.be.greaterThan(2);
        });

        it("owner can rotate the Ops pointer; charging flows through the NEW hook", async () => {
            await controller.setExitFeeEnabledTest(true);

            const newOps = await BorrowerExitPerimeterOps.new();
            const tx = await sovryn.setBorrowerExitPerimeterOps(newOps.address, { from: owner });
            const ev = tx.logs.find((l) => l.event === "BorrowerExitPerimeterOpsSet");
            expect(ev, "BorrowerExitPerimeterOpsSet emitted").to.not.equal(undefined);
            expect(ev.args.current.toLowerCase()).to.equal(newOps.address.toLowerCase());
            expect((await sovryn.borrowerExitPerimeterOps()).toLowerCase()).to.equal(
                newOps.address.toLowerCase()
            );

            // A charge through the rotated hook still applies the fee.
            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );
            const withdrawAmount = new BN(10).pow(new BN(15));
            const txw = await sovryn.withdrawCollateral(loan_id, owner, withdrawAmount);
            const applied = findApplied(txw.logs);
            expect(applied.length, "fee applied via the rotated Ops").to.equal(1);
            expect(applied[0].args.feeAmount.toString()).to.equal(
                expectedFee(withdrawAmount, 25).toString()
            );
        });

        it("mis-set Ops pointer (a contract without the charge selector) → fail-open full gross", async () => {
            // Set the pointer to a real contract that has NO chargeExitFeeAndPay
            // (the SUSD token). The stub's delegatecall hits its fallback /
            // reverts → the `ret.length == 32` gate fails → full gross. This is
            // the same backstop that covers the pre-pin unset (address(0))
            // state, which the onlyOwner setter's isContract guard otherwise
            // forbids re-entering.
            await controller.setExitFeeEnabledTest(true);
            await sovryn.setBorrowerExitPerimeterOps(SUSD.address, { from: owner });

            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );
            const withdrawAmount = new BN(10).pow(new BN(15));
            const rbtcBefore = await RBTC.balanceOf(owner);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.withdrawCollateral(loan_id, owner, withdrawAmount);

            expect(findApplied(tx.logs).length, "no Applied on mis-set hook").to.equal(0);
            // Borrower keeps the FULL gross; fee receiver untouched. The exit is
            // never blocked by a bad hook pointer.
            expect((await RBTC.balanceOf(owner)).sub(rbtcBefore).toString()).to.equal(
                withdrawAmount.toString()
            );
            expect((await RBTC.balanceOf(feeReceiver)).sub(feeRecvBefore).toString()).to.equal(
                "0"
            );
        });

        it("setBorrowerExitPerimeterOps reverts for a non-owner", async () => {
            const newOps = await BorrowerExitPerimeterOps.new();
            await expectRevert(
                sovryn.setBorrowerExitPerimeterOps(newOps.address, { from: account1 }),
                "unauthorized"
            );
        });

        it("setBorrowerExitPerimeterOps(0) and (EOA) revert (EFC:not-contract)", async () => {
            await expectRevert(
                sovryn.setBorrowerExitPerimeterOps(ZERO, { from: owner }),
                "EFC:not-contract"
            );
            await expectRevert(
                sovryn.setBorrowerExitPerimeterOps(account1, { from: owner }),
                "EFC:not-contract"
            );
        });
    });
});
