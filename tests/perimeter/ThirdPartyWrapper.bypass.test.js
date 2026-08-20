/**
 * Phase 2 / Task 2.3 — 3rd-party wrapper actor-attribution coverage.
 *
 * SCOPE: defensive coverage for the legacy / 3rd-party integration pattern
 * where some contract wraps `iToken.burn(...)` on behalf of a user — the
 * production analog is `oracle-based-amm/rbtcwrapperproxy/RBTCWrapperProxy`'s
 * `removeFromLendingPool`. This is NOT the Sovryn dApp's flow.
 *
 * The dApp calls the iToken **directly** with `useLM` as a flag:
 *
 *   apps/frontend/src/app/5_pages/LendPage/hooks/useHandleLending.ts#L144
 *     fnName: native ? 'burnToBTC(address,uint256,bool)'
 *                    : 'burn(address,uint256,bool)'
 *     args:   [account, withdrawAmount, poolUsesLM]
 *
 * so dApp users will always show up as `actor = user EOA` in the
 * `ExitFeeApplied` event. This file exists only to prove three things
 * about wrapper-routed callers (3rd-party contracts, NOT the dApp):
 *
 *   1. `actor = msg.sender = wrapper`, not the user EOA underneath.
 *   2. Exactly ONE `ExitFeeApplied` per wrapper call (no double-charge).
 *   3. **The fee floor is NOT bypassable** — a user with an actor-policy
 *      exemption (e.g. rate=0) cannot dodge the surface default by going
 *      through the wrapper. The surface rate still applies.
 *
 * Run:
 *   npx hardhat test tests/perimeter/ThirdPartyWrapper.bypass.test.js
 *
 * No mainnet fork — uses the same in-process Sovryn-protocol fixture as
 * `tests/loan-token/LendingTestToken.test.js` and an in-repo
 * `MockThirdPartyWrapper` to model the contract-routed-burn shape.
 */

const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { BN } = require("@openzeppelin/test-helpers");

const LoanToken = artifacts.require("LoanToken");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");
const MockExitFeeController = artifacts.require("MockExitFeeController");
const MockThirdPartyWrapper = artifacts.require("MockThirdPartyWrapper");

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
    getPriceFeeds,
    getSovryn,
    getSOV,
} = require("../Utils/initializer.js");
const mutexUtils = require("../../deployment/helpers/reentrancy/utils");

const wei = web3.utils.toWei;

const PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW = web3.utils.keccak256(
    "PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW"
);

const APPLIED_TOPIC = web3.utils.keccak256(
    "ExitFeeApplied(bytes32,address,address,address,address,uint256,uint256,uint256,address)"
);

contract("Perimeter — 3rd-party wrapper actor-attribution (Phase 2 / Task 2.3)", (accounts) => {
    let lender, user, feeReceiver;
    let SUSD, WRBTC, RBTC, BZRX, priceFeeds, sovryn;
    let loanToken; // iSUSD analog
    let controller, wrapper;

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

        // iSUSD loan-token proxy, wired through the LM beacon.
        const [loanTokenLogic, loanTokenLogicBeacon] = await getLoanTokenLogic();
        let lt = await LoanToken.new(
            lender,
            loanTokenLogic.address,
            sovryn.address,
            WRBTC.address
        );
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
        await lt.setBeaconAddress(loanTokenLogicBeacon.address);
        lt = await ILoanTokenModules.at(lt.address);

        await lt.setupLoanParams([params], false);
        await sovryn.setLoanPool([lt.address], [SUSD.address]);
        await WRBTC.mint(sovryn.address, wei("500", "ether"));

        loanToken = lt;

        // Perimeter mock controller — surface default 20 bps, no actor entries.
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(true);
        await controller.setActive(true);
        await controller.setRate(20); // 20 bps = 0.2%
        await controller.setFeeReceiverTest(feeReceiver);

        // Pin the controller on the protocol singleton (iTokens read the
        // pointer through sovrynContractAddress; `lender` owns the protocol).
        await sovryn.setExitFeeController(controller.address, { from: lender });

        wrapper = await MockThirdPartyWrapper.new();

        // Seed the user with SUSD, mint iSUSD.
        const seed = new BN(wei("1000", "ether"));
        await SUSD.mint(user, seed);
        await SUSD.approve(loanToken.address, seed, { from: user });
        await loanToken.mint(user, seed, { from: user });
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

    async function findApplied(logs) {
        return logs.filter((l) => l.event === "ExitFeeApplied");
    }

    async function findSkipped(logs) {
        return logs.filter((l) => l.event === "ExitFeeSkipped");
    }

    /// Decode an ExitFeeApplied log emitted by `loanToken` from the receipt.
    /// Returns the full structured event (indexed + data fields).
    function decodeAppliedFromReceipt(receipt) {
        const matching = receipt.rawLogs.filter(
            (l) =>
                l.address.toLowerCase() === loanToken.address.toLowerCase() &&
                l.topics[0] === APPLIED_TOPIC
        );
        return matching.map((raw) => {
            const data = web3.eth.abi.decodeParameters(
                ["address", "address", "uint256", "uint256", "uint256", "address"],
                raw.data
            );
            return {
                surfaceId: raw.topics[1],
                actor: web3.eth.abi.decodeParameter("address", raw.topics[2]),
                asset: web3.eth.abi.decodeParameter("address", raw.topics[3]),
                subProduct: data[0],
                recipient: data[1],
                grossAmount: new BN(data[2]),
                feeAmount: new BN(data[3]),
                netAmount: new BN(data[4]),
                feeReceiver: data[5],
            };
        });
    }

    // ── tests ──────────────────────────────────────────────────────────────

    describe("Direct iToken.burn (dApp's actual flow — control case)", () => {
        it("attributes actor = user EOA and charges 20 bps", async () => {
            const burnAmount = await loanToken.balanceOf(user);
            expect(burnAmount.gt(new BN(0))).to.be.true;

            const susdBefore = await SUSD.balanceOf(user);
            const feeRecvBefore = await SUSD.balanceOf(feeReceiver);

            // 3-param explicitly with useLM=false. The 2-param overload also
            // exists on the inherited Split but truffle's disambiguation
            // through the beacon proxy is fragile when both are registered.
            const tx = await loanToken.burn(user, burnAmount, false, { from: user });

            const applied = await findApplied(tx.logs);
            const skipped = await findSkipped(tx.logs);

            expect(applied.length, "ExitFeeApplied count").to.equal(1);
            expect(skipped.length, "no skip on the happy path").to.equal(0);

            const ev = applied[0].args;
            expect(ev.surfaceId).to.equal(PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW);
            expect(ev.actor.toLowerCase()).to.equal(user.toLowerCase());
            expect(ev.recipient.toLowerCase()).to.equal(user.toLowerCase());
            expect(ev.subProduct.toLowerCase()).to.equal(loanToken.address.toLowerCase());

            const gross = new BN(ev.grossAmount);
            const fee = new BN(ev.feeAmount);
            const net = new BN(ev.netAmount);
            expect(fee.add(net).toString()).to.equal(gross.toString());
            expect(fee.toString()).to.equal(gross.muln(20).divn(10_000).toString());

            const susdAfter = await SUSD.balanceOf(user);
            const feeRecvAfter = await SUSD.balanceOf(feeReceiver);
            expect(susdAfter.sub(susdBefore).toString()).to.equal(net.toString());
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal(fee.toString());
        });
    });

    describe("3rd-party-wrapper-mediated burn (defensive coverage; NOT the dApp's flow)", () => {
        it("attributes actor = WRAPPER (not the user EOA) — actor follows msg.sender", async () => {
            const burnAmount = await loanToken.balanceOf(user);
            await loanToken.approve(wrapper.address, burnAmount, { from: user });

            const susdBefore = await SUSD.balanceOf(user);
            const feeRecvBefore = await SUSD.balanceOf(feeReceiver);

            const tx = await wrapper.removeFromLendingPool(loanToken.address, burnAmount, {
                from: user,
            });

            const applied = decodeAppliedFromReceipt(tx.receipt);
            expect(applied.length, "exactly one ExitFeeApplied per wrapper call").to.equal(1);

            const ev = applied[0];
            expect(ev.surfaceId).to.equal(PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW);

            // actor follows msg.sender — that's the wrapper, not the user EOA.
            expect(ev.actor.toLowerCase()).to.equal(wrapper.address.toLowerCase());
            expect(ev.actor.toLowerCase()).to.not.equal(user.toLowerCase());

            // subProduct = iToken; underlying = SUSD; recipient = user.
            expect(ev.subProduct.toLowerCase()).to.equal(loanToken.address.toLowerCase());
            expect(ev.recipient.toLowerCase()).to.equal(user.toLowerCase());
            expect(ev.asset.toLowerCase()).to.equal(SUSD.address.toLowerCase());

            // Fee math: gross == net + fee, 20 bps (surface default).
            expect(ev.feeAmount.add(ev.netAmount).toString()).to.equal(ev.grossAmount.toString());
            expect(ev.feeAmount.toString()).to.equal(
                ev.grossAmount.muln(20).divn(10_000).toString()
            );

            // Underlying SUSD lands with the user, not the wrapper.
            const susdAfter = await SUSD.balanceOf(user);
            const feeRecvAfter = await SUSD.balanceOf(feeReceiver);
            expect(susdAfter.sub(susdBefore).toString()).to.equal(ev.netAmount.toString());
            expect(feeRecvAfter.sub(feeRecvBefore).toString()).to.equal(ev.feeAmount.toString());
            expect((await SUSD.balanceOf(wrapper.address)).toString()).to.equal("0");
        });

        it("no double-charge: ExitFeeApplied fires exactly once across the tx, only from the iToken", async () => {
            const burnAmount = await loanToken.balanceOf(user);
            await loanToken.approve(wrapper.address, burnAmount, { from: user });

            const tx = await wrapper.removeFromLendingPool(loanToken.address, burnAmount, {
                from: user,
            });

            const allMatches = tx.receipt.rawLogs.filter((l) => l.topics[0] === APPLIED_TOPIC);
            expect(allMatches.length, "exactly ONE ExitFeeApplied across the tx").to.equal(1);
            expect(allMatches[0].address.toLowerCase()).to.equal(loanToken.address.toLowerCase());
        });

        it("fee floor holds: a user's per-EOA exemption (rate=0) is NOT honored through a wrapper", async () => {
            // Setup: governance grants the user EOA an actor exemption (0 bps).
            // Directly, they would pay 0. Through a wrapper, the controller
            // looks up actorPolicy[surface][wrapperAddress] (no entry → falls
            // through), then sub-product (no entry → falls through), then
            // surface default 20 bps. So the user pays 20 bps via the wrapper
            // even though they "should" pay 0 if calling directly.
            await controller.setActorPolicyTest(user, true, 0);

            // Sanity check: a direct call honors the exemption. The hook
            // routes (active=true, rateBps=0, feeAmount=0) to ExitFeeSkipped
            // (rateBps=0, reason=NONE) — not ExitFeeApplied — because the
            // emit-gate is `q.active && q.feeAmount > 0` (see
            // LoanTokenLogicShared._chargeExitFeeAndPay). The user receives
            // the full gross, no fee transfer happens, no fee receiver
            // delta.
            const burnAmount = await loanToken.balanceOf(user);
            const half = burnAmount.div(new BN(2));

            const feeRecvBeforeDirect = await SUSD.balanceOf(feeReceiver);
            const directTx = await loanToken.burn(user, half, false, { from: user });

            const directApplied = await findApplied(directTx.logs);
            const directSkipped = await findSkipped(directTx.logs);
            expect(directApplied.length, "no Applied when exemption fires").to.equal(0);
            expect(directSkipped.length, "exactly one Skipped on exempt direct call").to.equal(1);
            expect(directSkipped[0].args.rateBps.toString(), "skip records rate=0").to.equal("0");
            // reason NONE (0) = controller computed an honest quote that
            // happened to be zero-fee (the exemption case).
            expect(directSkipped[0].args.reason.toString(), "reason=NONE").to.equal("0");
            // Fee receiver delta = 0 confirms no leg was transferred.
            expect(
                (await SUSD.balanceOf(feeReceiver)).sub(feeRecvBeforeDirect).toString(),
                "no fee transferred on direct exempt burn"
            ).to.equal("0");

            // Now route the rest through the wrapper. Controller sees
            // actor=wrapper (not user); no wrapper-actor entry exists, so it
            // falls through to the surface default. Fee = 20 bps of gross.
            const remaining = await loanToken.balanceOf(user);
            await loanToken.approve(wrapper.address, remaining, { from: user });

            const wrappedTx = await wrapper.removeFromLendingPool(loanToken.address, remaining, {
                from: user,
            });

            const wrapped = decodeAppliedFromReceipt(wrappedTx.receipt);
            expect(wrapped.length).to.equal(1);

            const ev = wrapped[0];
            // The fee is NOT zero — that's the point. The wrapper user can't
            // ride their per-EOA exemption through the wrapper.
            expect(
                ev.feeAmount.toString(),
                "wrapper: exemption bypassed but FEE STILL CHARGED"
            ).to.not.equal("0");
            // The charged rate is the surface default, 20 bps.
            expect(ev.feeAmount.toString()).to.equal(
                ev.grossAmount.muln(20).divn(10_000).toString()
            );
            // And actor is the wrapper, confirming why the exemption didn't fire.
            expect(ev.actor.toLowerCase()).to.equal(wrapper.address.toLowerCase());
        });
    });
});
