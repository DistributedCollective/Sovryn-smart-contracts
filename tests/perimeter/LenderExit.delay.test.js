/**
 * Security-perimeter delay — lender exit reroute
 * (`iToken.burn` / `iToken.burnToBTC`, surface `PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW`).
 *
 * Proves the lending hook:
 *   - ERC20 burn, perimeter ON  -> the (post-fee) user leg is escrowed via the
 *     PULL ingress `recordERC20Exit(unwrapOnDelivery=false)` (the iToken approves
 *     the queue, which `transferFrom`s and proves receipt == amount); the user
 *     is NOT paid until executeExit.
 *   - burnToBTC, perimeter ON -> the iToken transfers WRBTC (NOT
 *     native) to the queue with `unwrapOnDelivery=true`; `_transferNativeRBTC` is
 *     SKIPPED on the delayed user leg; executeExit unwraps WRBTC -> native RBTC
 *     to the receiver. The fee leg stays native/unchanged.
 *   - fee ON + delay compose -> the fee leg is paid to the feeReceiver
 *     IMMEDIATELY (never escrowed); only the NET (gross - fee) enters the
 *     queue and is delivered by executeExit.
 *   - perimeter OFF -> direct pay, queue NEVER touched.
 *
 * The iToken proxy is the registered allowed source (records run in its context).
 *
 * Run:
 *   npx hardhat test tests/perimeter/LenderExit.delay.test.js
 */

const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { BN } = require("@openzeppelin/test-helpers");

const LoanToken = artifacts.require("LoanToken");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");
const MockExitFeeController = artifacts.require("MockExitFeeController");
const MockExitDelayQueue = artifacts.require("MockExitDelayQueue");

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
const { increaseTime } = require("../Utils/Ethereum");

const wei = web3.utils.toWei;
const ZERO = "0x0000000000000000000000000000000000000000";
const PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW = web3.utils.keccak256(
    "PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW"
);

const MIN_DELAY = 60;
const DELAY = 3600;
const FEE_RATE_BPS = 20; // surface-default rate the fixture pins on the mock controller

contract("Perimeter delay — lender exit reroute", (accounts) => {
    let lender, user, feeReceiver;
    let SUSD, WRBTC, RBTC, BZRX, priceFeeds, sovryn;
    let iSUSD, iWRBTC;
    let controller, queue;

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

        // iSUSD (ERC20-backed)
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

        // iWRBTC (native-RBTC)
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

        // Controller: fee OFF (net == gross), perimeter armed.
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(false);
        await controller.setActive(true);
        await controller.setRate(FEE_RATE_BPS);
        await controller.setFeeReceiverTest(feeReceiver);
        await controller.setSecurityPerimeterEnabledTest(true);
        await controller.setGlobalDelaySecondsTest(DELAY);
        await sovryn.setExitFeeController(controller.address, { from: lender });

        // Queue: pinned on the protocol singleton (iTokens read it through
        // sovrynContractAddress). Each hooked iToken PROXY is the record-caller
        // context, so register each as an allowed source.
        queue = await MockExitDelayQueue.new(WRBTC.address, MIN_DELAY);
        await queue.setAllowedSource(iSUSD.address, true);
        await queue.setAllowedSource(iWRBTC.address, true);
        await sovryn.setExitDelayQueue(queue.address, { from: lender });

        // Seed the user and mint both iTokens.
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

    function grossFromSkipped(logs) {
        const skipped = logs.filter((l) => l.event === "ExitFeeSkipped");
        expect(skipped.length, "one ExitFeeSkipped (fee off)").to.equal(1);
        return new BN(skipped[0].args.grossAmount);
    }

    // ── ERC20 burn (pull ingress) ────────────────────────────────────────────

    describe("iSUSD burn, perimeter ON", () => {
        it("escrows the user leg via recordERC20Exit pull (unwrapOnDelivery=false); executeExit pays the underlying", async () => {
            const burnAmount = await iSUSD.balanceOf(user);
            const susdBefore = await SUSD.balanceOf(user);
            const queueBefore = await SUSD.balanceOf(queue.address);

            const tx = await iSUSD.burn(user, burnAmount, false, { from: user });
            const gross = grossFromSkipped(tx.logs);

            // User NOT paid; the queue holds exactly `gross` SUSD.
            expect((await SUSD.balanceOf(user)).sub(susdBefore).toString()).to.equal("0");
            expect((await SUSD.balanceOf(queue.address)).sub(queueBefore).toString()).to.equal(
                gross.toString()
            );
            expect((await queue.totalEscrowed(SUSD.address)).toString()).to.equal(
                gross.toString()
            );

            const req = await queue.getRequest(1);
            expect(req.token.toLowerCase()).to.equal(SUSD.address.toLowerCase());
            expect(req.amount.toString()).to.equal(gross.toString());
            expect(req.receiver.toLowerCase()).to.equal(user.toLowerCase());
            expect(req.originator.toLowerCase()).to.equal(user.toLowerCase());
            expect(req.owner.toLowerCase()).to.equal(user.toLowerCase());
            expect(req.subProduct.toLowerCase()).to.equal(iSUSD.address.toLowerCase());
            expect(req.unwrapOnDelivery).to.equal(false);

            await increaseTime(DELAY + 1);
            await queue.executeExit(1, { from: user });
            expect((await SUSD.balanceOf(user)).sub(susdBefore).toString()).to.equal(
                gross.toString()
            );
            expect((await SUSD.balanceOf(queue.address)).toString()).to.equal(
                queueBefore.toString()
            );
        });
    });

    // ── burnToBTC (WRBTC escrow + deferred unwrap) ───────────────────────────

    describe("iWRBTC burnToBTC, perimeter ON (WRBTC escrow)", () => {
        it("escrows WRBTC with unwrapOnDelivery=true (NOT native); executeExit unwraps -> native RBTC", async () => {
            const burnAmount = await iWRBTC.balanceOf(user);
            const userNativeBefore = new BN(await web3.eth.getBalance(user));
            const queueWrbtcBefore = await WRBTC.balanceOf(queue.address);

            // A non-caller receiver so the native-balance assertion isn't masked
            // by the caller's gas spend.
            const receiver = accounts[3];
            const recvNativeBefore = new BN(await web3.eth.getBalance(receiver));

            const tx = await iWRBTC.burnToBTC(receiver, burnAmount, false, { from: user });
            const gross = grossFromSkipped(tx.logs);

            // Queue holds WRBTC (NOT native); the receiver is unpaid until unlock.
            expect(
                (await WRBTC.balanceOf(queue.address)).sub(queueWrbtcBefore).toString()
            ).to.equal(gross.toString());
            expect((await queue.totalEscrowed(WRBTC.address)).toString()).to.equal(
                gross.toString()
            );
            expect((await queue.totalEscrowed(ZERO)).toString(), "no native escrowed").to.equal(
                "0"
            );
            expect(
                new BN(await web3.eth.getBalance(receiver)).sub(recvNativeBefore).toString()
            ).to.equal("0");

            const req = await queue.getRequest(1);
            expect(req.token.toLowerCase()).to.equal(WRBTC.address.toLowerCase());
            expect(req.unwrapOnDelivery).to.equal(true);
            expect(req.receiver.toLowerCase()).to.equal(receiver.toLowerCase());

            // executeExit unwraps WRBTC -> native RBTC to the receiver.
            await increaseTime(DELAY + 1);
            await queue.executeExit(1, { from: user }); // originator/owner = user
            expect(
                new BN(await web3.eth.getBalance(receiver)).sub(recvNativeBefore).toString()
            ).to.equal(gross.toString());
            expect((await WRBTC.balanceOf(queue.address)).toString()).to.equal(
                queueWrbtcBefore.toString()
            );
        });
    });

    // ── Fee + delay compose ──────────────────────────────────────────────────

    describe("Fee ON + delay compose (iSUSD burn)", () => {
        it("pays the fee leg to the feeReceiver immediately; escrows exactly the NET; executeExit pays the NET", async () => {
            await controller.setExitFeeEnabledTest(true); // fixture's 20 bps surface default

            const burnAmount = await iSUSD.balanceOf(user);
            const susdBefore = await SUSD.balanceOf(user);
            const feeRecvBefore = await SUSD.balanceOf(feeReceiver);
            const queueBefore = await SUSD.balanceOf(queue.address);

            const tx = await iSUSD.burn(user, burnAmount, false, { from: user });

            const applied = tx.logs.filter((l) => l.event === "ExitFeeApplied");
            expect(applied.length, "one ExitFeeApplied (fee on)").to.equal(1);
            const gross = new BN(applied[0].args.grossAmount);

            // Expected split from the fixture's own rate: fee = bps x gross / 10000.
            const expectedFee = gross.mul(new BN(FEE_RATE_BPS)).div(new BN(10000));
            expect(expectedFee.gt(new BN(0)), "non-vacuous: fee > 0").to.equal(true);
            const net = gross.sub(expectedFee);

            // (a) The fee leg is paid to the feeReceiver IMMEDIATELY (never escrowed).
            const feePaid = (await SUSD.balanceOf(feeReceiver)).sub(feeRecvBefore);
            expect(feePaid.toString()).to.equal(expectedFee.toString());

            // (b) Exactly the NET is escrowed; the user is NOT paid yet.
            expect((await SUSD.balanceOf(user)).sub(susdBefore).toString()).to.equal("0");
            expect((await SUSD.balanceOf(queue.address)).sub(queueBefore).toString()).to.equal(
                net.toString()
            );
            expect((await queue.totalEscrowed(SUSD.address)).toString()).to.equal(net.toString());
            const req = await queue.getRequest(1);
            expect(req.amount.toString()).to.equal(net.toString());
            expect(req.receiver.toLowerCase()).to.equal(user.toLowerCase());

            // (c) fee + net == gross — the split is conserved.
            expect(feePaid.add(new BN(req.amount)).toString()).to.equal(gross.toString());

            // (d) executeExit pays exactly the NET; the fee STAYS with the
            // feeReceiver (unchanged by execution).
            await increaseTime(DELAY + 1);
            await queue.executeExit(1, { from: user });
            expect((await SUSD.balanceOf(user)).sub(susdBefore).toString()).to.equal(
                net.toString()
            );
            expect((await SUSD.balanceOf(feeReceiver)).sub(feeRecvBefore).toString()).to.equal(
                expectedFee.toString()
            );
            expect((await SUSD.balanceOf(queue.address)).toString()).to.equal(
                queueBefore.toString()
            );
        });
    });

    // ── No-touch when the perimeter is OFF ───────────────────────────────────

    describe("Perimeter OFF — queue NEVER touched", () => {
        it("iSUSD burn pays direct; totalEscrowed == 0 and lastRequestId == 0", async () => {
            await controller.setSecurityPerimeterEnabledTest(false);

            const burnAmount = await iSUSD.balanceOf(user);
            const susdBefore = await SUSD.balanceOf(user);

            await iSUSD.burn(user, burnAmount, false, { from: user });

            expect((await SUSD.balanceOf(user)).sub(susdBefore).gt(new BN(0))).to.equal(true);
            expect((await queue.totalEscrowed(SUSD.address)).toString()).to.equal("0");
            expect((await SUSD.balanceOf(queue.address)).toString()).to.equal("0");
            expect((await queue.lastRequestId()).toString()).to.equal("0");
        });
    });
});
