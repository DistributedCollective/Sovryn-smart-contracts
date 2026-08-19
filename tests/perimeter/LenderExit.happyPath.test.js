/**
 * Phase 2 / Task 2.2 — Lender-exit happy-path coverage.
 *
 * Covers the dApp's actual lender-exit flow (`iToken.burn(...)` and
 * `iToken.burnToBTC(...)` called directly by the user EOA — see
 * `sovryn-dapp/apps/frontend/src/app/5_pages/LendPage/hooks/useHandleLending.ts`).
 * The `useLM` flag is orthogonal to Perimeter: both branches converge on
 * `_chargeExitFeeAndPay(receiver, gross)` after the redemption. We exercise
 * `useLM=false` here for fixture simplicity; the LM-routed path adds a
 * pre-step (`_burnFromLM`) that doesn't touch the Perimeter surface.
 *
 * Scenarios (from the perimeter plan, Task 2.2 Step 1):
 *   1. Perimeter globally disabled  → ExitFeeSkipped(reason=INACTIVE, rate=0),
 *                                   user receives full gross, no fee transfer.
 *   2. Surface default 20 bps    → user charged 20 bps; gross = net + fee.
 *   3. iSUSD sub-product 50 bps  → overrides the 20 bps surface default.
 *   4. iWRBTC sub-product 30 bps → burnToBTC charges 30 bps in NATIVE RBTC.
 *   5. Pool-balance invariant    → iToken's underlying balance decrements by
 *                                   exactly `gross` (no fee residue).
 *
 * Run:
 *   npx hardhat test tests/perimeter/LenderExit.happyPath.test.js
 */

const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { BN, balance } = require("@openzeppelin/test-helpers");

const LoanToken = artifacts.require("LoanToken");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");
const MockExitFeeController = artifacts.require("MockExitFeeController");

const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsImplSovrynSwap = artifacts.require("SwapsImplSovrynSwapModule");
const SwapsImplSovrynSwapLib = artifacts.require("SwapsImplSovrynSwapLib");

const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getLoanTokenLogic,
    getLoanTokenLogicWrbtc,
    getPriceFeeds,
    getSovryn,
    getSOV,
} = require("../Utils/initializer.js");
const mutexUtils = require("../../deployment/helpers/reentrancy/utils");

const wei = web3.utils.toWei;

const SURFACE_LENDING_LENDER_WITHDRAW = web3.utils.keccak256(
    "COLFEE:SURFACE_LENDING_LENDER_WITHDRAW"
);

contract("Perimeter — lender-exit happy path (Phase 2 / Task 2.2)", (accounts) => {
    let lender, user, feeReceiver;
    let SUSD, WRBTC, RBTC, BZRX, priceFeeds, sovryn;
    let iSUSD, iWRBTC;
    let controller;

    async function fixture() {
        await mutexUtils.getOrDeployMutex();

        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        await sovryn.setSovrynProtocolAddress(sovryn.address);
        await sovryn.setWrbtcToken(WRBTC.address);

        const feeds = await PriceFeedsLocal.new(WRBTC.address, sovryn.address);
        await feeds.setRates(SUSD.address, WRBTC.address, wei("0.01", "ether"));
        const swaps = await SwapsImplSovrynSwap.new();
        const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
        await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
        await sovryn.setSupportedTokens([SUSD.address, WRBTC.address], [true, true]);
        await sovryn.setPriceFeedContract(feeds.address);
        await sovryn.setSwapsImplContract(swaps.address);
        await sovryn.setFeesController(lender);
        await getSOV(sovryn, priceFeeds, SUSD, accounts);

        // ── iSUSD (ERC20-backed iToken) ────────────────────────────────────
        const [iSUSDLogic, iSUSDBeacon] = await getLoanTokenLogic();
        let lt = await LoanToken.new(lender, iSUSDLogic.address, sovryn.address, WRBTC.address);
        await lt.initialize(SUSD.address, "iSUSD", "iSUSD");
        const params = [
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            false,
            lender,
            SUSD.address,
            WRBTC.address,
            wei("20", "ether"),
            wei("15", "ether"),
            2419200,
        ];
        lt = await ILoanTokenLogicProxy.at(lt.address);
        await lt.setBeaconAddress(iSUSDBeacon.address);
        lt = await ILoanTokenModules.at(lt.address);
        await lt.setupLoanParams([params], false);
        await sovryn.setLoanPool([lt.address], [SUSD.address]);
        iSUSD = lt;

        // ── iWRBTC (native-RBTC iToken) ────────────────────────────────────
        const [iWRBTCLogic, iWRBTCBeacon] = await getLoanTokenLogicWrbtc();
        let ltw = await LoanToken.new(lender, iWRBTCLogic.address, sovryn.address, WRBTC.address);
        await ltw.initialize(WRBTC.address, "iWRBTC", "iWRBTC");
        const wparams = [
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            false,
            lender,
            WRBTC.address,
            SUSD.address,
            wei("20", "ether"),
            wei("15", "ether"),
            2419200,
        ];
        ltw = await ILoanTokenLogicProxy.at(ltw.address);
        await ltw.setBeaconAddress(iWRBTCBeacon.address);
        ltw = await ILoanTokenModules.at(ltw.address);
        await ltw.setupLoanParams([wparams], false);
        await sovryn.setLoanPool([ltw.address], [WRBTC.address]);
        iWRBTC = ltw;

        // Liquidity for the WRBTC pool to draw from.
        await WRBTC.mint(sovryn.address, wei("500", "ether"));

        // ── Perimeter controller wired into both iTokens, default OFF ─────────
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(false); // off by default per spec
        await controller.setActive(true); // surface active when enabled
        await controller.setRate(20); // surface default 20 bps
        await controller.setFeeReceiverTest(feeReceiver);

        // Single protocol-singleton pin serves every pool (iTokens read the
        // pointer through sovrynContractAddress).
        await sovryn.setExitFeeController(controller.address, { from: lender });

        // ── Seed the user and mint both iTokens ────────────────────────────
        // Truffle's overload disambiguation is fragile when both
        // mint(address,uint256) and mint(address,uint256,bool) are visible
        // on the beacon proxy. Call the unambiguous 2-arg / 1-arg variants
        // (useLM defaults to false in the underlying LoanTokenLogicStandard
        // code path).
        const seedSUSD = new BN(wei("1000", "ether"));
        await SUSD.mint(user, seedSUSD);
        await SUSD.approve(iSUSD.address, seedSUSD, { from: user });
        await iSUSD.mint(user, seedSUSD, { from: user });

        const seedRBTC = new BN(wei("1", "ether"));
        await iWRBTC.mintWithBTC(user, false, { from: user, value: seedRBTC });
    }

    before(async () => {
        [lender, user, feeReceiver, ...accounts] = accounts;

        const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
        await SwapsImplSovrynSwap.link(swapsImplSovrynSwapLib);
    });

    beforeEach(async () => {
        await loadFixture(fixture);
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
        it("iSUSD burn pays full gross to user; emits ExitFeeSkipped(INACTIVE)", async () => {
            // Controller is off in the fixture; just confirm.
            expect(await controller.exitFeeEnabled()).to.equal(false);

            const burnAmount = await iSUSD.balanceOf(user);
            const susdBefore = await SUSD.balanceOf(user);
            const feeRecvBefore = await SUSD.balanceOf(feeReceiver);

            const tx = await iSUSD.burn(user, burnAmount, false, { from: user });

            const applied = findApplied(tx.logs);
            const skipped = findSkipped(tx.logs);

            expect(applied.length, "no Applied when perimeter disabled").to.equal(0);
            expect(skipped.length, "one Skipped event").to.equal(1);
            // INACTIVE = 1 in the SkipReason enum.
            expect(skipped[0].args.reason.toString()).to.equal("1");
            expect(skipped[0].args.rateBps.toString()).to.equal("0");

            // User received full gross; fee receiver untouched.
            const susdAfter = await SUSD.balanceOf(user);
            const feeRecvAfter = await SUSD.balanceOf(feeReceiver);
            const gross = new BN(skipped[0].args.grossAmount);
            expect(susdAfter.sub(susdBefore).toString()).to.equal(gross.toString());
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal("0");
        });
    });

    describe("Surface default 20 bps (no sub-product override)", () => {
        it("iSUSD burn charges 20 bps; gross = net + fee", async () => {
            await controller.setExitFeeEnabledTest(true);

            const burnAmount = await iSUSD.balanceOf(user);
            const susdBefore = await SUSD.balanceOf(user);
            const feeRecvBefore = await SUSD.balanceOf(feeReceiver);

            const tx = await iSUSD.burn(user, burnAmount, false, { from: user });
            const applied = findApplied(tx.logs);
            expect(applied.length).to.equal(1);

            const ev = applied[0].args;
            const gross = new BN(ev.grossAmount);
            const fee = new BN(ev.feeAmount);
            const net = new BN(ev.netAmount);

            // Event-metadata assertions — guard against selector/surface
            // wiring regressions (not just fee math). Once-per-suite for the
            // ERC20 burn path; the burnToBTC test does the same for native.
            expect(ev.surfaceId, "surfaceId").to.equal(SURFACE_LENDING_LENDER_WITHDRAW);
            expect(ev.actor.toLowerCase(), "actor = user EOA on direct call").to.equal(
                user.toLowerCase()
            );
            expect(ev.asset.toLowerCase(), "asset = underlying loanToken (SUSD)").to.equal(
                SUSD.address.toLowerCase()
            );
            expect(ev.subProduct.toLowerCase(), "subProduct = iToken proxy").to.equal(
                iSUSD.address.toLowerCase()
            );
            expect(ev.recipient.toLowerCase(), "recipient = burn receiver").to.equal(
                user.toLowerCase()
            );
            expect(ev.feeReceiver.toLowerCase(), "feeReceiver from controller").to.equal(
                feeReceiver.toLowerCase()
            );

            expect(fee.add(net).toString()).to.equal(gross.toString());
            expect(fee.toString()).to.equal(expectedFee(gross, 20).toString());

            const susdAfter = await SUSD.balanceOf(user);
            const feeRecvAfter = await SUSD.balanceOf(feeReceiver);
            expect(susdAfter.sub(susdBefore).toString()).to.equal(net.toString());
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal(fee.toString());
        });
    });

    describe("Per-iToken sub-product override (iSUSD 50 bps)", () => {
        it("iSUSD burn charges 50 bps, overriding the 20 bps surface default", async () => {
            await controller.setExitFeeEnabledTest(true);
            await controller.setSubProductPolicyTest(iSUSD.address, true, 50);

            const burnAmount = await iSUSD.balanceOf(user);
            const susdBefore = await SUSD.balanceOf(user);
            const feeRecvBefore = await SUSD.balanceOf(feeReceiver);

            const tx = await iSUSD.burn(user, burnAmount, false, { from: user });
            const applied = findApplied(tx.logs);
            expect(applied.length).to.equal(1);

            const ev = applied[0].args;
            const gross = new BN(ev.grossAmount);
            const fee = new BN(ev.feeAmount);
            const net = new BN(ev.netAmount);

            // ExitFeeApplied carries gross/fee/net but not the explicit rate
            // (only ExitFeeSkipped does). Validate the rate via fee math.
            expect(fee.toString(), "fee == gross * 50/10_000 (sub-product override)").to.equal(
                expectedFee(gross, 50).toString()
            );

            // Transfer-delta check: the override path is now self-contained
            // (doesn't rely on the surface-default test to prove delivery).
            const susdAfter = await SUSD.balanceOf(user);
            const feeRecvAfter = await SUSD.balanceOf(feeReceiver);
            expect(susdAfter.sub(susdBefore).toString(), "user got net").to.equal(net.toString());
            expect(
                feeRecvAfter.sub(feeRecvBefore).toString(),
                "feeReceiver got fee at 50 bps"
            ).to.equal(fee.toString());
        });
    });

    describe("iWRBTC burnToBTC with sub-product 30 bps (native RBTC)", () => {
        it("delivers net to user as NATIVE RBTC, fee to feeReceiver as NATIVE RBTC", async () => {
            await controller.setExitFeeEnabledTest(true);
            await controller.setSubProductPolicyTest(iWRBTC.address, true, 30);

            const burnAmount = await iWRBTC.balanceOf(user);

            const userRbtcBefore = await balance.current(user);
            const feeRcvRbtcBefore = await balance.current(feeReceiver);
            const userWrbtcBefore = await WRBTC.balanceOf(user);
            const feeRcvWrbtcBefore = await WRBTC.balanceOf(feeReceiver);

            const tx = await iWRBTC.burnToBTC(user, burnAmount, false, {
                from: user,
                gasPrice: 0, // makes RBTC delta == net for the user
            });
            const applied = findApplied(tx.logs);
            expect(applied.length).to.equal(1);

            const ev = applied[0].args;
            const gross = new BN(ev.grossAmount);
            const fee = new BN(ev.feeAmount);
            const net = new BN(ev.netAmount);

            // Same as the iSUSD case: rate validated via fee math, since
            // ExitFeeApplied doesn't carry rateBps.
            expect(fee.toString(), "fee == gross * 30/10_000 (sub-product override)").to.equal(
                expectedFee(gross, 30).toString()
            );

            // Event-metadata assertions for the native path — counterpart to
            // the iSUSD surface-default test above, ensures the burnToBTC
            // beacon route still carries the right surfaceId / actor / asset
            // shape.
            expect(ev.surfaceId, "surfaceId").to.equal(SURFACE_LENDING_LENDER_WITHDRAW);
            expect(ev.actor.toLowerCase(), "actor = user EOA on direct burnToBTC").to.equal(
                user.toLowerCase()
            );
            // For iWRBTC the underlying loanToken is WRBTC even though the
            // payout is native — the event's `asset` tracks the iToken's
            // loanTokenAddress, not the delivery primitive.
            expect(ev.asset.toLowerCase(), "asset = WRBTC (iToken's underlying)").to.equal(
                WRBTC.address.toLowerCase()
            );
            expect(ev.subProduct.toLowerCase(), "subProduct = iWRBTC proxy").to.equal(
                iWRBTC.address.toLowerCase()
            );
            expect(ev.recipient.toLowerCase(), "recipient = burn receiver").to.equal(
                user.toLowerCase()
            );
            expect(ev.feeReceiver.toLowerCase(), "feeReceiver from controller").to.equal(
                feeReceiver.toLowerCase()
            );

            // Native deltas
            const userRbtcAfter = await balance.current(user);
            const feeRcvRbtcAfter = await balance.current(feeReceiver);
            expect(userRbtcAfter.sub(userRbtcBefore).toString(), "user got native net").to.equal(
                net.toString()
            );
            expect(
                feeRcvRbtcAfter.sub(feeRcvRbtcBefore).toString(),
                "feeReceiver got native fee"
            ).to.equal(fee.toString());

            // WRBTC deltas should be zero — `burnToBTC` is the explicit native
            // entry point. The WRBTC.Transfer log stream that `burn(...)` would
            // emit should NOT fire here for the user or feeReceiver leg.
            const userWrbtcAfter = await WRBTC.balanceOf(user);
            const feeRcvWrbtcAfter = await WRBTC.balanceOf(feeReceiver);
            expect(userWrbtcAfter.sub(userWrbtcBefore).toString()).to.equal("0");
            expect(feeRcvWrbtcAfter.sub(feeRcvWrbtcBefore).toString()).to.equal("0");
        });
    });

    describe("Pool-balance invariant — no fee residue", () => {
        it("iSUSD's underlying balance decrements by EXACTLY gross (fee leaves the pool)", async () => {
            await controller.setExitFeeEnabledTest(true);
            await controller.setSubProductPolicyTest(iSUSD.address, true, 50);

            const poolUnderlyingBefore = await SUSD.balanceOf(iSUSD.address);
            const burnAmount = await iSUSD.balanceOf(user);

            const tx = await iSUSD.burn(user, burnAmount, false, { from: user });
            const ev = findApplied(tx.logs)[0].args;
            const gross = new BN(ev.grossAmount);

            const poolUnderlyingAfter = await SUSD.balanceOf(iSUSD.address);

            // Pool balance decrements by exactly gross. If any "fee residue"
            // were retained, the delta would be (gross - fee) instead.
            // This is the tokenPrice()/assetBalanceOf invariant referenced
            // in the perimeter plan: no value sticks in the iToken contract.
            expect(
                poolUnderlyingBefore.sub(poolUnderlyingAfter).toString(),
                "pool decrement == gross (no fee residue)"
            ).to.equal(gross.toString());
        });

        it("iWRBTC's underlying WRBTC balance decrements by EXACTLY gross via burnToBTC", async () => {
            await controller.setExitFeeEnabledTest(true);
            await controller.setSubProductPolicyTest(iWRBTC.address, true, 30);

            const poolWrbtcBefore = await WRBTC.balanceOf(iWRBTC.address);
            const burnAmount = await iWRBTC.balanceOf(user);

            const tx = await iWRBTC.burnToBTC(user, burnAmount, false, {
                from: user,
                gasPrice: 0,
            });
            const ev = findApplied(tx.logs)[0].args;
            const gross = new BN(ev.grossAmount);

            const poolWrbtcAfter = await WRBTC.balanceOf(iWRBTC.address);

            // Same invariant: gross WRBTC leaves the pool (then each leg is
            // unwrapped to native and sent separately to user and feeReceiver).
            // No WRBTC residue stays behind in the iToken.
            expect(
                poolWrbtcBefore.sub(poolWrbtcAfter).toString(),
                "pool decrement == gross (no fee residue in WRBTC)"
            ).to.equal(gross.toString());

            // iToken's own native balance must be zero after the unwrap+send.
            const iTokenNative = await balance.current(iWRBTC.address);
            expect(iTokenNative.toString(), "no orphan native in iToken").to.equal("0");
        });
    });
});
