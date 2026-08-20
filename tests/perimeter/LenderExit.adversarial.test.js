/**
 * Phase 2 follow-up — Lender-exit ADVERSARIAL coverage (iToken tree).
 *
 * The protocol (borrower-exit) tree has its containment proven through the
 * BorrowerExitPerimeterOps delegatecall backstop; the iToken tree charges INLINE
 * (LoanTokenLogicShared._chargeExitFeeAndPay) and therefore needs its own
 * adversarial proofs. This suite closes the review gaps:
 *
 *   1. The controller pointer is the PROTOCOL SINGLETON: the iToken keeps no
 *      copy (no setExitFeeController on the beacon), its exitFeeController()
 *      reads through sovrynContractAddress, and one protocol rotation
 *      re-points every pool's quoting. Setter auth/validation (owner, zero,
 *      EOA, rotation event) lives protocol-side and is covered in
 *      BorrowerExit.withdrawCollateral.test.js.
 *   2. CONTROLLER_REVERT with an ACTUALLY-REVERTING controller (the existing
 *      protocol test only covers the short-return shape) → burn proceeds,
 *      full gross, ExitFeeSkipped(CONTROLLER_REVERT).
 *   3. CONTROLLER_REVERT with a selector-less contract (short return) on the
 *      iToken side, for symmetry with the protocol test.
 *   4. INVALID_QUOTE (mock rate > 10000 organically wraps net in 0.5.17) →
 *      burn proceeds, full gross, ExitFeeSkipped(INVALID_QUOTE).
 *   5. Live burn(useLM=true) CHARGE through the LiquidityMining redeem path
 *      (the happy-path suite only exercises useLM=false).
 *   6. All FOUR arms of the defensive quote gate, driven by an ARBITRARY-quote
 *      controller. `MockExitFeeController` models an honest controller, so it
 *      cannot express two of the shapes an upgradable controller can: it
 *      short-circuits to DISABLED when the receiver is zero, and it always
 *      derives net from gross. `MockArbitraryQuoteExitFeeController` returns
 *      the quote verbatim, which is what makes `feeReceiver == address(0)` and
 *      a desynced `netAmount` reachable on the INLINE iToken hook — the tree
 *      with no delegatecall backstop. Covers BOTH inline copies of the hook:
 *      the ERC20 payout (`LoanTokenLogicShared._chargeExitFeeAndPay`, via
 *      iSUSD.burn) and the native-RBTC payout
 *      (`LoanTokenLogicWrbtcLM._chargeExitFeeAndPayAsNative`, via
 *      iWRBTC.burnToBTC — where a zero-address fee leg would SUCCEED and burn
 *      the value outright).
 *
 * Run:
 *   npx hardhat test tests/perimeter/LenderExit.adversarial.test.js
 */

const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { BN, expectRevert, constants } = require("@openzeppelin/test-helpers");

const LoanToken = artifacts.require("LoanToken");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");
const LoanTokenLogicBeacon = artifacts.require("LoanTokenLogicBeacon");
const MockExitFeeController = artifacts.require("MockExitFeeController");
const MockMalformedExitFeeController = artifacts.require("MockMalformedExitFeeController");
const MockArbitraryQuoteExitFeeController = artifacts.require(
    "MockArbitraryQuoteExitFeeController"
);
const LiquidityMiningLogic = artifacts.require("LiquidityMiningMockup");
const LiquidityMiningProxy = artifacts.require("LiquidityMiningProxy");
const LockedSOV = artifacts.require("LockedSOV");

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

// SkipReason enum: 0 NONE 1 INACTIVE 2 DISABLED 3 INVALID_QUOTE 4 CONTROLLER_REVERT 5 VAULT_REVERT
const REASON = { NONE: 0, INACTIVE: 1, INVALID_QUOTE: 3, CONTROLLER_REVERT: 4 };

const ZERO = constants.ZERO_ADDRESS;

contract("Perimeter — lender-exit adversarial (iToken tree)", (accounts) => {
    let lender, user, feeReceiver, stranger;
    let SUSD, WRBTC, RBTC, BZRX, priceFeeds, sovryn, SOV;
    let iSUSD, iSUSDBeacon, iWRBTC;
    let controller, arbitrary, liquidityMining;

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
        SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);

        // ── iSUSD (ERC20-backed iToken) ────────────────────────────────────
        let iSUSDLogic;
        [iSUSDLogic, iSUSDBeacon] = await getLoanTokenLogic();
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

        // ── iWRBTC (native-RBTC payout path — burnToBTC) ───────────────────
        // The WRBTC logic carries its OWN inline copy of the charge hook
        // (`_chargeExitFeeAndPayAsNative`), whose fee leg is a raw
        // `call.value` — a zero-address fee receiver would SUCCEED there.
        const [iWLogic, iWBeacon] = await getLoanTokenLogicWrbtc();
        let ltw = await LoanToken.new(lender, iWLogic.address, sovryn.address, WRBTC.address);
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
        await ltw.setBeaconAddress(iWBeacon.address);
        ltw = await ILoanTokenModules.at(ltw.address);
        await ltw.setupLoanParams([wparams], false);
        await sovryn.setLoanPool([ltw.address], [WRBTC.address]);
        iWRBTC = ltw;

        // ── LiquidityMining (for the burn(useLM=true) charge case) ─────────
        const lockedSOV = await LockedSOV.new(SOV.address, lender, 1, 10, [lender]);
        const lmLogic = await LiquidityMiningLogic.new();
        const lmProxy = await LiquidityMiningProxy.new();
        await lmProxy.setImplementation(lmLogic.address);
        liquidityMining = await LiquidityMiningLogic.at(lmProxy.address);
        await liquidityMining.initialize(SOV.address, 10, 1, 1, lender, lockedSOV.address, 0);
        await iSUSD.setLiquidityMiningAddress(liquidityMining.address);
        await liquidityMining.add(iSUSD.address, 10, false);

        // ── Perimeter controller, enabled at the 20 bps surface default ───────
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(true);
        await controller.setActive(true);
        await controller.setRate(20);
        await controller.setFeeReceiverTest(feeReceiver);
        // Single protocol-singleton pin serves every pool (iTokens read the
        // pointer through sovrynContractAddress).
        await sovryn.setExitFeeController(controller.address, { from: lender });

        // Verbatim-quote controller: pinned per-test where an arbitrary
        // (possibly invalid) quote shape is required.
        arbitrary = await MockArbitraryQuoteExitFeeController.new();

        // ── Seed the user with iSUSD ───────────────────────────────────────
        const seedSUSD = new BN(wei("1000", "ether"));
        await SUSD.mint(user, seedSUSD);
        await SUSD.approve(iSUSD.address, seedSUSD, { from: user });
        await iSUSD.mint(user, seedSUSD, { from: user });

        // ── Seed the user with iWRBTC ──────────────────────────────────────
        await iWRBTC.mintWithBTC(user, false, { from: user, value: wei("1", "ether") });
    }

    before(async () => {
        [lender, user, feeReceiver, stranger, ...accounts] = accounts;

        const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
        await SwapsImplSovrynSwap.link(swapsImplSovrynSwapLib);
    });

    beforeEach(async () => {
        await loadFixture(fixture);
    });

    function findApplied(logs) {
        return logs.filter((l) => l.event === "ExitFeeApplied");
    }
    function findSkipped(logs) {
        return logs.filter((l) => l.event === "ExitFeeSkipped");
    }

    // ── 1. Controller pointer = protocol singleton ──────────────────────────
    // Setter auth/validation (owner, zero, EOA, rotation event) lives on the
    // protocol setter and is covered in BorrowerExit.withdrawCollateral.test.js;
    // here we pin the iToken-side consequences of the centralization.

    describe("controller pointer is the protocol singleton", () => {
        it("the iToken beacon no longer serves setExitFeeController(address)", async () => {
            const selector = web3.utils.keccak256("setExitFeeController(address)").slice(0, 10);
            const beacon = await LoanTokenLogicBeacon.at(iSUSDBeacon.address);
            expect(await beacon.getTarget(selector)).to.equal(constants.ZERO_ADDRESS);
        });

        it("iToken exitFeeController() reads through to the protocol-pinned address", async () => {
            expect(await iSUSD.exitFeeController()).to.equal(controller.address);
            expect(await sovryn.exitFeeController()).to.equal(controller.address);
        });

        it("one rotation on the protocol re-points every pool's quoting", async () => {
            const second = await MockExitFeeController.new();
            await second.setExitFeeEnabledTest(true);
            await second.setActive(true);
            await second.setRate(50);
            await second.setFeeReceiverTest(feeReceiver);

            await sovryn.setExitFeeController(second.address, { from: lender });
            expect(await iSUSD.exitFeeController()).to.equal(second.address);

            const burnAmount = await iSUSD.balanceOf(user);
            const tx = await iSUSD.burn(user, burnAmount, false, { from: user });
            const applied = findApplied(tx.logs);
            expect(applied.length).to.equal(1);
            const gross = new BN(applied[0].args.grossAmount);
            expect(
                applied[0].args.feeAmount.toString(),
                "fee at the NEW controller's 50 bps"
            ).to.equal(gross.muln(50).divn(10_000).toString());
        });
    });

    // ── 2+3. CONTROLLER_REVERT fail-open (the tree WITHOUT the delegatecall
    //         backstop — containment is the staticcall in PerimeterLib.safeQuote) ─

    describe("CONTROLLER_REVERT fail-open on burn", () => {
        it("controller REVERTS in quoteExitFee → burn succeeds, full gross, ExitFeeSkipped(CONTROLLER_REVERT)", async () => {
            await controller.setRevertOnQuote(true);

            const burnAmount = await iSUSD.balanceOf(user);
            const susdBefore = await SUSD.balanceOf(user);
            const feeRecvBefore = await SUSD.balanceOf(feeReceiver);

            const tx = await iSUSD.burn(user, burnAmount, false, { from: user });

            expect(findApplied(tx.logs).length, "no Applied").to.equal(0);
            const skipped = findSkipped(tx.logs);
            expect(skipped.length, "one Skipped").to.equal(1);
            expect(skipped[0].args.reason.toNumber()).to.equal(REASON.CONTROLLER_REVERT);

            const gross = new BN(skipped[0].args.grossAmount);
            expect((await SUSD.balanceOf(user)).sub(susdBefore).toString(), "full gross").to.equal(
                gross.toString()
            );
            expect(
                (await SUSD.balanceOf(feeReceiver)).sub(feeRecvBefore).toString(),
                "no fee transferred"
            ).to.equal("0");
        });

        it("controller returns LONG but MALFORMED data (192 bytes of 0xff..) → same fail-open outcome", async () => {
            // Passes the >= 192 length gate, but every word is non-canonical
            // for its target type (bool > 1, dirty uint16/address). A struct
            // abi.decode of this payload reverts under the 0.5.17 validating
            // decoder — safeQuote must contain that word-by-word and
            // synthesize CONTROLLER_REVERT instead of bricking the burn.
            const malformed = await MockMalformedExitFeeController.new();
            await sovryn.setExitFeeController(malformed.address, { from: lender });

            const burnAmount = await iSUSD.balanceOf(user);
            const susdBefore = await SUSD.balanceOf(user);

            const tx = await iSUSD.burn(user, burnAmount, false, { from: user });

            expect(findApplied(tx.logs).length, "no Applied").to.equal(0);
            const skipped = findSkipped(tx.logs);
            expect(skipped.length, "one Skipped").to.equal(1);
            expect(skipped[0].args.reason.toNumber()).to.equal(REASON.CONTROLLER_REVERT);

            const gross = new BN(skipped[0].args.grossAmount);
            expect((await SUSD.balanceOf(user)).sub(susdBefore).toString(), "full gross").to.equal(
                gross.toString()
            );
        });

        it("controller without the quoteExitFee selector (short return) → same fail-open outcome", async () => {
            // SUSD is a contract with no quoteExitFee and no data-returning
            // fallback: the staticcall fails, safeQuote synthesizes the
            // CONTROLLER_REVERT quote. Mirrors the protocol-side test shape.
            await sovryn.setExitFeeController(SUSD.address, { from: lender });

            const burnAmount = await iSUSD.balanceOf(user);
            const susdBefore = await SUSD.balanceOf(user);

            const tx = await iSUSD.burn(user, burnAmount, false, { from: user });

            const skipped = findSkipped(tx.logs);
            expect(skipped.length).to.equal(1);
            expect(skipped[0].args.reason.toNumber()).to.equal(REASON.CONTROLLER_REVERT);

            const gross = new BN(skipped[0].args.grossAmount);
            expect((await SUSD.balanceOf(user)).sub(susdBefore).toString()).to.equal(
                gross.toString()
            );
        });
    });

    // ── 4. INVALID_QUOTE fail-open ──────────────────────────────────────────

    describe("INVALID_QUOTE fail-open on burn (mock rate > 10000 wraps net)", () => {
        beforeEach(async () => {
            // rate 10001 → fee > gross and net wraps below zero in the 0.5.17
            // mock — organically fails every quoteIsValid invariant the live
            // hook checks.
            await controller.setRate(10001);
        });

        it("burn succeeds, full gross to user, ExitFeeSkipped(INVALID_QUOTE, rateBps=10001)", async () => {
            const burnAmount = await iSUSD.balanceOf(user);
            const susdBefore = await SUSD.balanceOf(user);
            const feeRecvBefore = await SUSD.balanceOf(feeReceiver);

            const tx = await iSUSD.burn(user, burnAmount, false, { from: user });

            expect(findApplied(tx.logs).length, "no Applied").to.equal(0);
            const skipped = findSkipped(tx.logs);
            expect(skipped.length).to.equal(1);
            expect(skipped[0].args.reason.toNumber()).to.equal(REASON.INVALID_QUOTE);
            expect(skipped[0].args.rateBps.toString()).to.equal("10001");

            const gross = new BN(skipped[0].args.grossAmount);
            expect((await SUSD.balanceOf(user)).sub(susdBefore).toString(), "full gross").to.equal(
                gross.toString()
            );
            expect(
                (await SUSD.balanceOf(feeReceiver)).sub(feeRecvBefore).toString(),
                "no fee transferred"
            ).to.equal("0");
        });
    });

    // ── 5. Live charge through the LM redeem path ───────────────────────────

    describe("burn(useLM=true) — LM redeem path charges like the direct path", () => {
        it("charges 20 bps on the LM-redeemed gross; user gets net, feeReceiver gets fee", async () => {
            // Move the user's full iSUSD position into LiquidityMining.
            const iBalance = await iSUSD.balanceOf(user);
            await iSUSD.approve(liquidityMining.address, iBalance, { from: user });
            await liquidityMining.deposit(iSUSD.address, iBalance, constants.ZERO_ADDRESS, {
                from: user,
            });
            expect((await iSUSD.balanceOf(user)).toString(), "all staked on LM").to.equal("0");

            const susdBefore = await SUSD.balanceOf(user);
            const feeRecvBefore = await SUSD.balanceOf(feeReceiver);

            const tx = await iSUSD.burn(user, iBalance, true, { from: user });

            const applied = findApplied(tx.logs);
            expect(applied.length, "ExitFeeApplied through the LM path").to.equal(1);
            const ev = applied[0].args;
            const gross = new BN(ev.grossAmount);
            const fee = new BN(ev.feeAmount);
            const net = new BN(ev.netAmount);

            expect(ev.actor.toLowerCase(), "actor = user EOA").to.equal(user.toLowerCase());
            expect(ev.subProduct.toLowerCase(), "subProduct = iToken proxy").to.equal(
                iSUSD.address.toLowerCase()
            );
            expect(fee.add(net).toString(), "fee + net == gross").to.equal(gross.toString());
            expect(fee.toString(), "20 bps").to.equal(gross.muln(20).divn(10_000).toString());

            expect((await SUSD.balanceOf(user)).sub(susdBefore).toString(), "user net").to.equal(
                net.toString()
            );
            expect(
                (await SUSD.balanceOf(feeReceiver)).sub(feeRecvBefore).toString(),
                "feeReceiver fee"
            ).to.equal(fee.toString());
        });
    });

    // ── 6. All four quoteIsValid arms, via an ARBITRARY-quote controller ────
    //
    // `MockExitFeeController` is an HONEST controller: it returns DISABLED
    // before ever quoting when the receiver is zero, and it always computes
    // `net = gross - fee`. Two of the four defensive arms are therefore
    // unreachable through it, and a third (rateBps > 10000) can only be
    // reached with `fee > gross` co-firing — so on the inline iToken hook the
    // gate was only ever decided by ONE arm. The controller is upgradable and
    // external, so all four shapes are reachable in production. Each test
    // below violates EXACTLY ONE invariant, everything else conserving.

    describe("arbitrary-quote controller — every quoteIsValid arm on the inline hook", () => {
        /**
         * Static-call the burn to learn the GROSS the hook will be handed,
         * without mutating state. Gross is computed by `_burnToken` before the
         * controller is ever consulted, so the pinned quote cannot influence
         * it; the probe is still taken with an INACTIVE quote pinned, because
         * a hostile net would revert the (fail-closed) user leg.
         */
        async function probeGross(token, signature, receiver, burnAmount) {
            await arbitrary.setQuote(false, 0, 0, 0, ZERO, REASON.INACTIVE);
            await sovryn.setExitFeeController(arbitrary.address, { from: lender });
            const gross = await token.contract.methods[signature](
                receiver,
                burnAmount.toString(),
                false
            ).call({ from: user });
            return new BN(gross);
        }

        // ── ERC20 payout: LoanTokenLogicShared._chargeExitFeeAndPay ─────────

        describe("iSUSD.burn (ERC20 fee leg)", () => {
            let burnAmount, gross;

            beforeEach(async () => {
                burnAmount = await iSUSD.balanceOf(user);
                gross = await probeGross(iSUSD, "burn(address,uint256,bool)", user, burnAmount);
            });

            /**
             * Burn under the currently-pinned quote and assert the universal
             * INVALID_QUOTE outcome: no charge, no fee movement, user paid the
             * FULL gross, one ExitFeeSkipped carrying reason 3.
             */
            async function expectInvalidQuoteOutcome(expectedRateBps) {
                const susdBefore = await SUSD.balanceOf(user);
                const feeRecvBefore = await SUSD.balanceOf(feeReceiver);
                const zeroBefore = await SUSD.balanceOf(ZERO);

                const tx = await iSUSD.burn(user, burnAmount, false, { from: user });

                // Values first: the money claim is what the gate protects.
                expect(
                    (await SUSD.balanceOf(user)).sub(susdBefore).toString(),
                    "user paid FULL gross"
                ).to.equal(gross.toString());
                expect(
                    (await SUSD.balanceOf(feeReceiver)).sub(feeRecvBefore).toString(),
                    "feeReceiver untouched"
                ).to.equal("0");
                expect(
                    (await SUSD.balanceOf(ZERO)).sub(zeroBefore).toString(),
                    "nothing sent to address(0)"
                ).to.equal("0");

                expect(findApplied(tx.logs).length, "no ExitFeeApplied").to.equal(0);
                const skipped = findSkipped(tx.logs);
                expect(skipped.length, "exactly one ExitFeeSkipped").to.equal(1);
                expect(skipped[0].args.reason.toNumber(), "reason = INVALID_QUOTE").to.equal(
                    REASON.INVALID_QUOTE
                );
                expect(skipped[0].args.rateBps.toString(), "rate echoed verbatim").to.equal(
                    String(expectedRateBps)
                );
                expect(skipped[0].args.grossAmount.toString(), "gross echoed").to.equal(
                    gross.toString()
                );
            }

            it("arm 1 — feeReceiver == address(0) (fee positive, split otherwise conserving)", async () => {
                const fee = gross.muln(20).divn(10_000);
                await arbitrary.setQuote(
                    true,
                    20,
                    fee,
                    gross.sub(fee), // net conserves — only the receiver is bogus
                    ZERO,
                    REASON.NONE
                );
                await expectInvalidQuoteOutcome(20);
            });

            it("arm 2 — netAmount desynced from gross - feeAmount (user would be shortchanged)", async () => {
                const fee = gross.muln(20).divn(10_000);
                await arbitrary.setQuote(
                    true,
                    20,
                    fee,
                    gross.sub(fee).subn(1), // one wei would silently vanish
                    feeReceiver,
                    REASON.NONE
                );
                await expectInvalidQuoteOutcome(20);
            });

            it("arm 3 — rateBps > 10000 (fee <= gross and split conserving)", async () => {
                // Isolates the rate arm: the 10001 case above co-fires
                // `fee > gross`, so the rate check was never the decider.
                const fee = gross.muln(20).divn(10_000);
                await arbitrary.setQuote(
                    true,
                    10001,
                    fee,
                    gross.sub(fee),
                    feeReceiver,
                    REASON.NONE
                );
                await expectInvalidQuoteOutcome(10001);
            });

            it("arm 4 — feeAmount > gross (controller overreaching into pool liquidity)", async () => {
                await arbitrary.setQuote(true, 20, gross.addn(1), 0, feeReceiver, REASON.NONE);
                await expectInvalidQuoteOutcome(20);
            });

            it("positive control — a VALID arbitrary quote still charges exactly", async () => {
                // Proves the four results above are the GATE firing, not the
                // arbitrary mock being unable to produce a charge at all.
                const fee = gross.muln(37).divn(10_000);
                const net = gross.sub(fee);
                await arbitrary.setQuote(true, 37, fee, net, feeReceiver, REASON.NONE);

                const susdBefore = await SUSD.balanceOf(user);
                const feeRecvBefore = await SUSD.balanceOf(feeReceiver);

                const tx = await iSUSD.burn(user, burnAmount, false, { from: user });

                expect(findSkipped(tx.logs).length, "no ExitFeeSkipped").to.equal(0);
                const applied = findApplied(tx.logs);
                expect(applied.length, "one ExitFeeApplied").to.equal(1);
                expect(applied[0].args.feeAmount.toString()).to.equal(fee.toString());
                expect(applied[0].args.netAmount.toString()).to.equal(net.toString());
                expect(applied[0].args.feeReceiver.toLowerCase()).to.equal(
                    feeReceiver.toLowerCase()
                );

                expect(
                    (await SUSD.balanceOf(user)).sub(susdBefore).toString(),
                    "user paid net"
                ).to.equal(net.toString());
                expect(
                    (await SUSD.balanceOf(feeReceiver)).sub(feeRecvBefore).toString(),
                    "feeReceiver paid fee"
                ).to.equal(fee.toString());
            });
        });

        // ── Native payout: LoanTokenLogicWrbtcLM._chargeExitFeeAndPayAsNative
        //
        // The native fee leg is a raw `call.value(...)`. Unlike an ERC20
        // `transfer`, a value send to address(0) SUCCEEDS — so on this path a
        // zero-receiver quote that got past the gate would not merely be
        // misclassified, it would BURN the fee and shortchange the lender.

        describe("iWRBTC.burnToBTC (native RBTC fee leg)", () => {
            it("arm 1 — feeReceiver == address(0) → INVALID_QUOTE, full gross in native RBTC, nothing burned", async () => {
                const burnAmount = await iWRBTC.balanceOf(user);
                // Pay out to `stranger` so the delta is the payout, gas-free.
                const gross = await probeGross(
                    iWRBTC,
                    "burnToBTC(address,uint256,bool)",
                    stranger,
                    burnAmount
                );

                const fee = gross.muln(20).divn(10_000);
                await arbitrary.setQuote(true, 20, fee, gross.sub(fee), ZERO, REASON.NONE);

                const strangerBefore = new BN(await web3.eth.getBalance(stranger));
                const zeroBefore = new BN(await web3.eth.getBalance(ZERO));

                const tx = await iWRBTC.burnToBTC(stranger, burnAmount, false, { from: user });

                expect(
                    new BN(await web3.eth.getBalance(ZERO)).sub(zeroBefore).toString(),
                    "no native value burned to address(0)"
                ).to.equal("0");
                expect(
                    new BN(await web3.eth.getBalance(stranger)).sub(strangerBefore).toString(),
                    "receiver paid FULL gross in native RBTC"
                ).to.equal(gross.toString());

                expect(findApplied(tx.logs).length, "no ExitFeeApplied").to.equal(0);
                const skipped = findSkipped(tx.logs);
                expect(skipped.length, "exactly one ExitFeeSkipped").to.equal(1);
                expect(skipped[0].args.reason.toNumber(), "reason = INVALID_QUOTE").to.equal(
                    REASON.INVALID_QUOTE
                );
            });

            it("arm 2 — netAmount desynced from gross - feeAmount → INVALID_QUOTE, full gross", async () => {
                const burnAmount = await iWRBTC.balanceOf(user);
                const gross = await probeGross(
                    iWRBTC,
                    "burnToBTC(address,uint256,bool)",
                    stranger,
                    burnAmount
                );

                const fee = gross.muln(20).divn(10_000);
                await arbitrary.setQuote(
                    true,
                    20,
                    fee,
                    gross.sub(fee).subn(1),
                    feeReceiver,
                    REASON.NONE
                );

                const strangerBefore = new BN(await web3.eth.getBalance(stranger));
                const feeRecvBefore = new BN(await web3.eth.getBalance(feeReceiver));

                const tx = await iWRBTC.burnToBTC(stranger, burnAmount, false, { from: user });

                expect(
                    new BN(await web3.eth.getBalance(stranger)).sub(strangerBefore).toString(),
                    "receiver paid FULL gross"
                ).to.equal(gross.toString());
                expect(
                    new BN(await web3.eth.getBalance(feeReceiver)).sub(feeRecvBefore).toString(),
                    "feeReceiver untouched"
                ).to.equal("0");

                expect(findApplied(tx.logs).length, "no ExitFeeApplied").to.equal(0);
                const skipped = findSkipped(tx.logs);
                expect(skipped.length, "exactly one ExitFeeSkipped").to.equal(1);
                expect(skipped[0].args.reason.toNumber(), "reason = INVALID_QUOTE").to.equal(
                    REASON.INVALID_QUOTE
                );
            });
        });
    });
});
