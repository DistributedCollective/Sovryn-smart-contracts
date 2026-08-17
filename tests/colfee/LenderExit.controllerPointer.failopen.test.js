/**
 * Security-perimeter delay — controller-POINTER fail-open vs delay-QUOTE
 * fail-closed.
 *
 * The split is deliberate and is proven here:
 *   - POINTER fail-OPEN: when the protocol singleton has NO ExitFeeController
 *     pinned (`exitFeeController()` → address(0), via the fail-open
 *     `ColFeeLib.safeControllerLookup`), the delay quote resolves to `d == 0`
 *     and the lender burn pays DIRECT — the queue is never touched. A missing
 *     pointer silently disables the perimeter for that host rather than
 *     bricking every exit on a botched module rotation (mirrors the fee path).
 *   - QUOTE fail-CLOSED: once a controller IS pinned and reachable, a
 *     `quoteExitDelayFor` that REVERTS reverts the whole exit
 *     (`COLFEE:delay-quote-failed`), so an active perimeter can never be
 *     silently bypassed.
 *
 * Run:
 *   npx hardhat test tests/colfee/LenderExit.controllerPointer.failopen.test.js
 */

const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { BN, expectRevert } = require("@openzeppelin/test-helpers");

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
    getPriceFeeds,
    getSovryn,
    getSOV,
} = require("../tests/Utils/initializer.js");
const mutexUtils = require("../deployment/helpers/reentrancy/utils");

const wei = web3.utils.toWei;
const DELAY = 3600;
const MIN_DELAY = 60;

contract("ColFee delay — controller-pointer fail-open / quote fail-closed", (accounts) => {
    let lender, user, feeReceiver;
    let SUSD, WRBTC, RBTC, BZRX, priceFeeds, sovryn;
    let iSUSD;
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

        // Controller (fee OFF, perimeter armed) and queue are DEPLOYED but the
        // controller pointer is left decidable per-test: the queue is always
        // pinned so we can assert it stays untouched on the fail-open path.
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(false);
        await controller.setActive(true);
        await controller.setRate(20);
        await controller.setFeeReceiverTest(feeReceiver);
        await controller.setSecurityPerimeterEnabledTest(true);
        await controller.setGlobalDelaySecondsTest(DELAY);

        queue = await MockExitDelayQueue.new(WRBTC.address, MIN_DELAY);
        await queue.setAllowedSource(iSUSD.address, true);
        await sovryn.setExitDelayQueue(queue.address, { from: lender });

        // Seed the user and mint iSUSD.
        const seed = new BN(wei("1000", "ether"));
        await SUSD.mint(user, seed);
        await SUSD.approve(iSUSD.address, seed, { from: user });
        await iSUSD.mint(user, seed, { from: user });
    }

    before(async () => {
        [lender, user, feeReceiver, ...accounts] = accounts;
        const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
        await SwapsImplSovrynSwap.link(swapsImplSovrynSwapLib);
    });

    beforeEach(async () => {
        await loadFixture(fixture);
    });

    describe("controller pointer UNSET — fail-OPEN (pays direct, queue untouched)", () => {
        it("burns direct with no controller pinned; totalEscrowed == 0 and lastRequestId == 0", async () => {
            // No `setExitFeeController` call ⇒ `exitFeeController()` resolves to
            // address(0) ⇒ delay quote short-circuits to d == 0 ⇒ direct pay.
            expect(await iSUSD.exitFeeController()).to.equal(
                "0x0000000000000000000000000000000000000000"
            );

            const burnAmount = await iSUSD.balanceOf(user);
            const susdBefore = await SUSD.balanceOf(user);

            await iSUSD.burn(user, burnAmount, false, { from: user });

            expect((await SUSD.balanceOf(user)).sub(susdBefore).gt(new BN(0))).to.equal(true);
            expect((await queue.totalEscrowed(SUSD.address)).toString()).to.equal("0");
            expect((await SUSD.balanceOf(queue.address)).toString()).to.equal("0");
            expect((await queue.lastRequestId()).toString()).to.equal("0");
        });
    });

    describe("controller pinned + delay quote REVERTS — fail-CLOSED (exit reverts)", () => {
        it("reverts the whole burn with COLFEE:delay-quote-failed", async () => {
            await sovryn.setExitFeeController(controller.address, { from: lender });
            await controller.setRevertOnDelayQuote(true);

            const burnAmount = await iSUSD.balanceOf(user);
            await expectRevert(
                iSUSD.burn(user, burnAmount, false, { from: user }),
                "COLFEE:delay-quote-failed"
            );
        });
    });
});
