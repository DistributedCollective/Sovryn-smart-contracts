/**
 * Security-perimeter delay — lender exit reroute over a NO-RETURN (USDT-style)
 * underlying.
 *
 * The delayed pull path in `_payExitUserLeg` must APPROVE the queue for the
 * user leg. The pre-fix code called a raw high-level `IERC20(underlying)
 * .approve(queue, amount)` which decodes a `bool` return — that REVERTS for a
 * USDT-style no-return ERC20 and DoS-es EVERY delayed lender burn whenever the
 * perimeter quotes `d > 0`. The fix routes both approve sites through the
 * repo's optional-return `_safeApprove` (`_callOptionalReturn`), matching how
 * `_transferUnderlyingToken` / `_safeTransfer` already tolerate no-return
 * tokens.
 *
 * This suite backs an iToken with `TestTokenNoReturn` (approve/transfer/
 * transferFrom return NOTHING, plus USDT's zero-first approve guard) and
 * asserts a delayed burn exit SUCCEEDS end-to-end:
 *   - the perimeter-ON burn escrows the user leg via `recordERC20Exit`
 *     (the iToken `_safeApprove`s the queue, which safe-pulls the amount);
 *   - `executeExit` after the delay pays the underlying to the receiver;
 *   - the zero-first approve guard on the token is never tripped, proving the
 *     allowance returns to 0 after the pull (no dangling allowance).
 * A perimeter-OFF direct burn over the same no-return underlying is also
 * asserted (the pre-fix path never approved, so this is the control).
 *
 * Run:
 *   npx hardhat test tests/perimeter/LenderExit.noReturnUnderlying.delay.test.js
 */

const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { BN } = require("@openzeppelin/test-helpers");

const LoanToken = artifacts.require("LoanToken");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");
const TestTokenNoReturn = artifacts.require("TestTokenNoReturn");
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
} = require("../Utils/initializer.js");
const mutexUtils = require("../../deployment/helpers/reentrancy/utils");
const { increaseTime } = require("../Utils/Ethereum");

const wei = web3.utils.toWei;
const DELAY = 3600;
const MIN_DELAY = 60;

contract("Perimeter delay — lender exit over a no-return (USDT-style) underlying", (accounts) => {
    let lender, user, feeReceiver;
    let SUSD, WRBTC, RBTC, BZRX, priceFeeds, sovryn;
    let NRT, iNRT;
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

        // No-return (USDT-style) underlying for the iToken.
        NRT = await TestTokenNoReturn.new("NoReturn USD", "nrUSD", 18, wei("1000000", "ether"));

        const feeds = await PriceFeedsLocal.new(WRBTC.address, sovryn.address);
        await feeds.setRates(NRT.address, WRBTC.address, wei("0.01", "ether"));
        await feeds.setRates(SUSD.address, WRBTC.address, wei("0.01", "ether"));
        const swaps = await SwapsImplSovrynSwap.new();
        const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
        await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
        await sovryn.setSupportedTokens([NRT.address, WRBTC.address], [true, true]);
        await sovryn.setPriceFeedContract(feeds.address);
        await sovryn.setSwapsImplContract(swaps.address);
        await sovryn.setFeesController(lender);
        await getSOV(sovryn, priceFeeds, SUSD, accounts);

        // iNRT — an LM iToken backed by the no-return underlying.
        const [iNRTLogic, iNRTBeacon] = await getLoanTokenLogic();
        let lt = await LoanToken.new(lender, iNRTLogic.address, sovryn.address, WRBTC.address);
        await lt.initialize(NRT.address, "iNRT", "iNRT");
        const params = [
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            false,
            lender,
            NRT.address,
            WRBTC.address,
            wei("20", "ether"),
            wei("15", "ether"),
            2419200,
        ];
        lt = await ILoanTokenLogicProxy.at(lt.address);
        await lt.setBeaconAddress(iNRTBeacon.address);
        lt = await ILoanTokenModules.at(lt.address);
        await lt.setupLoanParams([params], false);
        await sovryn.setLoanPool([lt.address], [NRT.address]);
        iNRT = lt;

        // Controller: fee OFF (net == gross), perimeter armed.
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(false);
        await controller.setActive(true);
        await controller.setRate(20);
        await controller.setFeeReceiverTest(feeReceiver);
        await controller.setSecurityPerimeterEnabledTest(true);
        await controller.setGlobalDelaySecondsTest(DELAY);
        await sovryn.setExitFeeController(controller.address, { from: lender });

        // Queue pinned on the protocol singleton; register the iToken proxy as
        // an allowed record source.
        queue = await MockExitDelayQueue.new(WRBTC.address, MIN_DELAY);
        await queue.setAllowedSource(iNRT.address, true);
        await sovryn.setExitDelayQueue(queue.address, { from: lender });

        // Seed the user and mint the iToken (mint pulls the no-return underlying
        // via the loan-token's own optional-return `_safeTransferFrom`).
        const seed = new BN(wei("1000", "ether"));
        await NRT.mint(user, seed);
        await NRT.approve(iNRT.address, seed, { from: user });
        await iNRT.mint(user, seed, { from: user });
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

    describe("perimeter ON — delayed burn over a no-return underlying", () => {
        it("does NOT revert on approve; escrows via recordERC20Exit and executeExit pays the underlying", async () => {
            const burnAmount = await iNRT.balanceOf(user);
            const nrtBefore = await NRT.balanceOf(user);
            const queueBefore = await NRT.balanceOf(queue.address);

            // Pre-fix: this burn reverted inside `_payExitUserLeg`'s raw approve.
            const tx = await iNRT.burn(user, burnAmount, false, { from: user });
            const gross = grossFromSkipped(tx.logs);

            // User NOT paid yet; the queue holds exactly `gross` of the underlying.
            expect((await NRT.balanceOf(user)).sub(nrtBefore).toString()).to.equal("0");
            expect((await NRT.balanceOf(queue.address)).sub(queueBefore).toString()).to.equal(
                gross.toString()
            );
            expect((await queue.totalEscrowed(NRT.address)).toString()).to.equal(gross.toString());

            // Allowance returned to 0 after the queue pull — the token's zero-first
            // approve guard was never tripped (no dangling allowance).
            expect((await NRT.allowance(iNRT.address, queue.address)).toString()).to.equal("0");

            const req = await queue.getRequest(1);
            expect(req.token.toLowerCase()).to.equal(NRT.address.toLowerCase());
            expect(req.amount.toString()).to.equal(gross.toString());
            expect(req.receiver.toLowerCase()).to.equal(user.toLowerCase());
            expect(req.unwrapOnDelivery).to.equal(false);

            await increaseTime(DELAY + 1);
            await queue.executeExit(1, { from: user });
            expect((await NRT.balanceOf(user)).sub(nrtBefore).toString()).to.equal(
                gross.toString()
            );
            expect((await NRT.balanceOf(queue.address)).toString()).to.equal(
                queueBefore.toString()
            );
        });
    });

    describe("perimeter OFF — direct burn over a no-return underlying (control)", () => {
        it("pays direct; the queue is never touched", async () => {
            await controller.setSecurityPerimeterEnabledTest(false);

            const burnAmount = await iNRT.balanceOf(user);
            const nrtBefore = await NRT.balanceOf(user);

            await iNRT.burn(user, burnAmount, false, { from: user });

            expect((await NRT.balanceOf(user)).sub(nrtBefore).gt(new BN(0))).to.equal(true);
            expect((await queue.totalEscrowed(NRT.address)).toString()).to.equal("0");
            expect((await NRT.balanceOf(queue.address)).toString()).to.equal("0");
            expect((await queue.lastRequestId()).toString()).to.equal("0");
        });
    });
});
