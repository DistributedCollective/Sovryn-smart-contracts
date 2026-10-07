/**
 * Lender exit — what a burn reports.
 *
 * The hooked burn entry points return `(gross, delivered)`: `gross` is the
 * underlying that left the pool for the burn, `delivered` is what reached the
 * receiver in the same call. Every situation below runs on every registered
 * burn route (both `burn` overloads on an ERC20 pool; `burn(address,uint256)`
 * and `burnToBTC` on the WRBTC pool) and checks the reported pair against the
 * pool's decrement, the receiver's balance change, the fee receiver's balance
 * change and, where the withdrawal delay holds the payout, the queue's record:
 *
 *   caller exempt / perimeter off / fee leg skipped, no hold  -> delivered == gross
 *   Perimeter fee charged, no hold                            -> delivered == gross - fee
 *   held by the delay (the net, or the full gross)            -> delivered == 0
 *   gross == 0 (a dust burn that prices to zero)              -> delivered == 0
 *
 * A contract compiled against the one-value signature reads `gross`, the first
 * word of the pair.
 *
 * Run:
 *   npx hardhat test tests/perimeter/LenderExit.delivered.test.js
 */

const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { BN } = require("@openzeppelin/test-helpers");

const LoanToken = artifacts.require("LoanToken");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");
const MockExitFeeController = artifacts.require("MockExitFeeController");
const MockExitDelayQueue = artifacts.require("MockExitDelayQueue");
const MockOneValueBurnCaller = artifacts.require("MockOneValueBurnCaller");

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
    linkIfUsed,
} = require("../Utils/initializer.js");
const mutexUtils = require("../../deployment/helpers/reentrancy/utils");

const wei = web3.utils.toWei;
const PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW = web3.utils.keccak256(
    "PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW"
);

const MIN_DELAY = 60;
const DELAY = 3600;
const FEE_RATE_BPS = 20;
// Above 10,000 bps the mock quotes a fee larger than gross. The hook rejects
// that quote as invalid, skips the fee leg and pays the full gross.
const INVALID_RATE_BPS = 10001;

contract("Perimeter — lender exit reports (gross, delivered)", (accounts) => {
    let lender, user, feeReceiver, receiver;
    let SUSD, WRBTC, RBTC, BZRX, priceFeeds, sovryn;
    let iSUSD, iWRBTC;
    let controller, queue, oneValueCaller;

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

        // iSUSD (ERC20 pool)
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

        // iWRBTC (WRBTC pool, native payout through burnToBTC)
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

        await WRBTC.mint(sovryn.address, wei("500", "ether"));

        // Controller: Perimeter fee and withdrawal delay both off; each test
        // arms what its situation needs.
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(false);
        await controller.setActive(true);
        await controller.setRate(FEE_RATE_BPS);
        await controller.setFeeReceiverTest(feeReceiver);
        await controller.setSecurityPerimeterEnabledTest(false);
        await controller.setGlobalDelaySecondsTest(DELAY);
        await sovryn.setExitFeeController(controller.address, { from: lender });

        // Queue pinned on the protocol; each iToken proxy records into it.
        queue = await MockExitDelayQueue.new(WRBTC.address, MIN_DELAY);
        await queue.setAllowedSource(iSUSD.address, true);
        await queue.setAllowedSource(iWRBTC.address, true);
        await sovryn.setExitDelayQueue(queue.address, { from: lender });

        const seedSUSD = new BN(wei("1000", "ether"));
        await SUSD.mint(user, seedSUSD);
        await SUSD.approve(iSUSD.address, seedSUSD, { from: user });
        await iSUSD.mint(user, seedSUSD, { from: user });
        await iWRBTC.mintWithBTC(user, false, { from: user, value: wei("1", "ether") });

        oneValueCaller = await MockOneValueBurnCaller.new();
    }

    before(async () => {
        [lender, user, feeReceiver, ...accounts] = accounts;
        // Receives every payout and never sends a transaction, so its native
        // balance changes only by what a burn delivers.
        receiver = accounts[3];
        const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
        await linkIfUsed(SwapsImplSovrynSwap, swapsImplSovrynSwapLib);
    });

    beforeEach(async () => {
        await loadFixture(fixture);
    });

    const ENTRY_POINTS = [
        {
            label: "ERC20 pool, burn(address,uint256)",
            pool: () => iSUSD,
            asset: () => SUSD,
            signature: "burn(address,uint256)",
            native: false,
            args: (to, amount) => [to, amount],
            viaOneValueCaller: (iToken, to, amount) =>
                oneValueCaller.callBurn(iToken, to, amount, { from: user }),
        },
        {
            label: "ERC20 pool, burn(address,uint256,bool)",
            pool: () => iSUSD,
            asset: () => SUSD,
            signature: "burn(address,uint256,bool)",
            native: false,
            args: (to, amount) => [to, amount, false],
            viaOneValueCaller: (iToken, to, amount) =>
                oneValueCaller.callBurnUseLM(iToken, to, amount, false, { from: user }),
        },
        {
            label: "WRBTC pool, burn(address,uint256)",
            pool: () => iWRBTC,
            asset: () => WRBTC,
            signature: "burn(address,uint256)",
            native: false,
            args: (to, amount) => [to, amount],
            viaOneValueCaller: (iToken, to, amount) =>
                oneValueCaller.callBurn(iToken, to, amount, { from: user }),
        },
        {
            label: "WRBTC pool, burnToBTC(address,uint256,bool)",
            pool: () => iWRBTC,
            asset: () => WRBTC,
            signature: "burnToBTC(address,uint256,bool)",
            native: true,
            args: (to, amount) => [to, amount, false],
            viaOneValueCaller: (iToken, to, amount) =>
                oneValueCaller.callBurnToBTC(iToken, to, amount, false, { from: user }),
        },
    ];

    async function armFee(rateBps) {
        await controller.setRate(rateBps);
        await controller.setExitFeeEnabledTest(true);
    }

    async function armDelay() {
        await controller.setSecurityPerimeterEnabledTest(true);
    }

    /// Balance in the currency the entry point pays out: native RBTC for
    /// burnToBTC, the pool's underlying token otherwise.
    async function payoutBalance(ep, who) {
        return ep.native ? new BN(await web3.eth.getBalance(who)) : ep.asset().balanceOf(who);
    }

    /// Reads the pair the burn reports (a static call on the same state), then
    /// sends the burn and measures what it did on chain.
    async function burnAndObserve(ep, burnAmount) {
        const pool = ep.pool();
        const method = pool.methods[ep.signature];
        const args = ep.args(receiver, burnAmount);

        const poolBefore = await ep.asset().balanceOf(pool.address);
        const receiverBefore = await payoutBalance(ep, receiver);
        const feeReceiverBefore = await payoutBalance(ep, feeReceiver);
        const lastIdBefore = await queue.lastRequestId();

        const pair = await method.call(...args, { from: user });
        expect(pair, "the burn reports a (gross, delivered) pair").to.have.property("delivered");
        await method(...args, { from: user });

        return {
            gross: new BN(pair.gross),
            delivered: new BN(pair.delivered),
            poolDecrement: poolBefore.sub(await ep.asset().balanceOf(pool.address)),
            received: (await payoutBalance(ep, receiver)).sub(receiverBefore),
            feePaid: (await payoutBalance(ep, feeReceiver)).sub(feeReceiverBefore),
            lastIdBefore,
            lastIdAfter: await queue.lastRequestId(),
        };
    }

    function expectGrossLeftPool(o) {
        expect(o.gross.gtn(0), "non-vacuous: gross > 0").to.equal(true);
        expect(o.poolDecrement.toString(), "gross is what left the pool").to.equal(
            o.gross.toString()
        );
    }

    function expectNothingQueued(o) {
        expect(o.lastIdAfter.toString(), "nothing queued").to.equal(o.lastIdBefore.toString());
    }

    async function expectQueued(o, escrowed) {
        expect(o.lastIdAfter.toString(), "one request queued").to.equal(
            o.lastIdBefore.addn(1).toString()
        );
        const req = await queue.getRequest(o.lastIdAfter);
        expect(req.amount.toString(), "the queue record carries the escrowed amount").to.equal(
            escrowed.toString()
        );
        expect(req.receiver.toLowerCase()).to.equal(receiver.toLowerCase());
    }

    const feeOn = (gross) => gross.muln(FEE_RATE_BPS).divn(10000);

    ENTRY_POINTS.forEach((ep) => {
        describe(ep.label, () => {
            it("caller exempt with the fee and the delay armed: delivered == gross", async () => {
                await armFee(FEE_RATE_BPS);
                await armDelay();
                await controller.setActorPolicyTest(user, true, 0);
                await controller.setActorBypassTest(
                    PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
                    user,
                    true,
                    true
                );

                const o = await burnAndObserve(ep, await ep.pool().balanceOf(user));

                expectGrossLeftPool(o);
                expect(o.delivered.toString()).to.equal(o.gross.toString());
                expect(o.received.toString(), "receiver got delivered").to.equal(
                    o.delivered.toString()
                );
                expect(o.feePaid.toString(), "no fee").to.equal("0");
                expectNothingQueued(o);
            });

            it("perimeter off: delivered == gross", async () => {
                const o = await burnAndObserve(ep, await ep.pool().balanceOf(user));

                expectGrossLeftPool(o);
                expect(o.delivered.toString()).to.equal(o.gross.toString());
                expect(o.received.toString(), "receiver got delivered").to.equal(
                    o.delivered.toString()
                );
                expect(o.feePaid.toString(), "no fee").to.equal("0");
                expectNothingQueued(o);
            });

            it("fee leg skipped on an invalid quote, no hold: delivered == gross", async () => {
                await armFee(INVALID_RATE_BPS);

                const o = await burnAndObserve(ep, await ep.pool().balanceOf(user));

                expectGrossLeftPool(o);
                expect(o.delivered.toString()).to.equal(o.gross.toString());
                expect(o.received.toString(), "receiver got delivered").to.equal(
                    o.delivered.toString()
                );
                expect(o.feePaid.toString(), "no fee").to.equal("0");
                expectNothingQueued(o);
            });

            it("Perimeter fee charged, no hold: delivered == gross - fee", async () => {
                await armFee(FEE_RATE_BPS);

                const o = await burnAndObserve(ep, await ep.pool().balanceOf(user));

                expectGrossLeftPool(o);
                const fee = feeOn(o.gross);
                expect(fee.gtn(0), "non-vacuous: fee > 0").to.equal(true);
                expect(o.delivered.toString()).to.equal(o.gross.sub(fee).toString());
                expect(o.received.toString(), "receiver got delivered").to.equal(
                    o.delivered.toString()
                );
                expect(o.feePaid.toString(), "fee receiver got the fee").to.equal(fee.toString());
                expectNothingQueued(o);
            });

            it("fee charged and the net held by the delay: delivered == 0", async () => {
                await armFee(FEE_RATE_BPS);
                await armDelay();

                const o = await burnAndObserve(ep, await ep.pool().balanceOf(user));

                expectGrossLeftPool(o);
                const fee = feeOn(o.gross);
                expect(fee.gtn(0), "non-vacuous: fee > 0").to.equal(true);
                expect(o.delivered.toString()).to.equal("0");
                expect(o.received.toString(), "receiver got nothing yet").to.equal("0");
                expect(o.feePaid.toString(), "fee receiver got the fee").to.equal(fee.toString());
                await expectQueued(o, o.gross.sub(fee));
            });

            it("fee leg skipped and the full gross held by the delay: delivered == 0", async () => {
                await armFee(INVALID_RATE_BPS);
                await armDelay();

                const o = await burnAndObserve(ep, await ep.pool().balanceOf(user));

                expectGrossLeftPool(o);
                expect(o.delivered.toString()).to.equal("0");
                expect(o.received.toString(), "receiver got nothing yet").to.equal("0");
                expect(o.feePaid.toString(), "no fee").to.equal("0");
                await expectQueued(o, o.gross);
            });

            it("a dust burn that prices to zero: gross == 0 and delivered == 0", async () => {
                await armFee(FEE_RATE_BPS);
                await armDelay();
                // Take most of the underlying out of the pool so the iToken
                // price falls below one unit: one wei of iToken then prices to 0.
                const pool = ep.pool();
                const poolBalance = await ep.asset().balanceOf(pool.address);
                await ep.asset().burn(pool.address, poolBalance.muln(6).divn(10));

                const o = await burnAndObserve(ep, new BN(1));

                expect(o.gross.toString()).to.equal("0");
                expect(o.delivered.toString()).to.equal("0");
                expect(o.poolDecrement.toString(), "nothing left the pool").to.equal("0");
                expect(o.received.toString(), "receiver got nothing").to.equal("0");
                expect(o.feePaid.toString(), "no fee").to.equal("0");
                expectNothingQueued(o);
            });
        });
    });

    describe("a caller compiled against the one-value signature", () => {
        ENTRY_POINTS.forEach((ep) => {
            it(`${ep.label}: decodes gross, the first word of the pair`, async () => {
                // Fee charged and the net held: the pair is (gross, 0), so a
                // decoder reading the second word would read zero.
                await armFee(FEE_RATE_BPS);
                await armDelay();

                const pool = ep.pool();
                const burnAmount = await pool.balanceOf(user);
                const pair = await pool.methods[ep.signature].call(
                    ...ep.args(receiver, burnAmount),
                    { from: user }
                );
                expect(pair, "the burn reports a (gross, delivered) pair").to.have.property(
                    "delivered"
                );
                const gross = new BN(pair.gross);
                expect(gross.gtn(0), "non-vacuous: gross > 0").to.equal(true);
                expect(new BN(pair.delivered).toString(), "held: delivered == 0").to.equal("0");

                await pool.approve(oneValueCaller.address, burnAmount, { from: user });
                const poolBefore = await ep.asset().balanceOf(pool.address);
                await ep.viaOneValueCaller(pool.address, receiver, burnAmount);

                const decoded = await oneValueCaller.lastReturned();
                expect(decoded.toString(), "the one-value caller decoded gross").to.equal(
                    gross.toString()
                );
                expect(
                    poolBefore.sub(await ep.asset().balanceOf(pool.address)).toString(),
                    "the decoded value is what left the pool"
                ).to.equal(decoded.toString());
            });
        });
    });
});
