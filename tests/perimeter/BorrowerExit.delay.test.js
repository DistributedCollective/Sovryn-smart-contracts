/**
 * Security-perimeter delay — borrower/margin exit reroute
 * (`LoanMaintenance.withdrawCollateral`, surface
 * `PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW`).
 *
 * Proves the checkpoint's borrower/margin hook: when the perimeter
 * imposes a delay (`d > 0`), the (post-fee) user leg is PUSHED to the
 * ExitDelayQueue via the `sovrynProtocol` singleton (the registered allowed
 * source) and recorded via the measured-delta ingress
 * (`recordReceivedERC20Exit` / `recordReceivedNativeExit`) — NOT paid directly.
 * After `unlockAt`, the position owner (or delegated-manager originator)
 * executes the queue and the immutable receiver is paid.
 *
 * Coverage:
 *   1. ERC20 collateral, perimeter ON  -> escrowed (measured-delta), NOT paid;
 *      executeExit after unlock pays the receiver. (queue untouched below.)
 *   2. Native (WRBTC) collateral, ON   -> unwrap-to-native push +
 *      recordReceivedNativeExit; executeExit pays native.
 *   3. Fee + delay compose             -> the NET (gross - fee) is escrowed,
 *      the fee receiver still gets the fee (fee leg unchanged).
 *   4. Perimeter OFF (no-touch)        -> direct pay, queue NEVER touched
 *      (totalEscrowed == 0, lastRequestId == 0).
 *   5. Delegated-manager originator    -> still delayed (voluntary gate);
 *      request.originator == delegate, owner == borrower; delegate executes.
 *   6. queue pointer unset, ON         -> fail-CLOSED (`PERIMETER:queue-unset`),
 *      the queue is never touched until d>0 is established.
 *   7. delay below the queue floor     -> fail-CLOSED at ingress
 *      (`MockQueue: delay below floor`, mirrors the real per-request floor).
 *   8. delay-quote reverts             -> fail-CLOSED (`PERIMETER:delay-quote-failed`),
 *      NOT silently treated as d=0.
 *   9. setExitDelayQueue pointer          -> read-through, owner-gated rotation
 *      (event), non-owner + non-contract revert.
 *
 * Run:
 *   npx hardhat test tests/perimeter/BorrowerExit.delay.test.js
 */

const { expect } = require("chai");
const { expectRevert, BN, constants } = require("@openzeppelin/test-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

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
    open_margin_trade_position,
} = require("../Utils/initializer.js");

const { increaseTime } = require("../Utils/Ethereum");
const mutexUtils = require("../../deployment/helpers/reentrancy/utils");
const { linkIfUsed } = require("../Utils/initializer.js");

const ZERO = constants.ZERO_ADDRESS;
const PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW = web3.utils.keccak256(
    "PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW"
);

const MIN_DELAY = 60; // queue per-request floor (seconds)
const DELAY = 3600; // global delay used by the armed perimeter

contract("Perimeter delay — borrower/margin exit reroute", (accounts) => {
    let owner, account1, feeReceiver, delegate;
    let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, priceFeeds, sov;
    let controller, queue;

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

        // Controller pinned; fee OFF by default so `toUser == gross` and the
        // escrow accounting is clean. Perimeter starts OFF (armed per-test).
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(false);
        await controller.setActive(true);
        await controller.setRate(25);
        await controller.setFeeReceiverTest(feeReceiver);
        await sovryn.setExitFeeController(controller.address, { from: owner });

        // Queue deployed and the sovrynProtocol singleton registered as its
        // allowed source (borrower/margin records run in that context). The
        // pointer is pinned per-test via `armPerimeter` so the unset case is
        // reachable.
        queue = await MockExitDelayQueue.new(WRBTC.address, MIN_DELAY);
        await queue.setAllowedSource(sovryn.address, true);
    }

    before(async () => {
        [owner, account1, feeReceiver, delegate, ...accounts] = accounts;
        try {
            const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
            await linkIfUsed(LoanMaintenance, swapsImplSovrynSwapLib);
        } catch (_) {}
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    // Enable the perimeter with a given delay; pin the queue unless told not to.
    async function armPerimeter({ delay = DELAY, pinQueue = true } = {}) {
        await controller.setSecurityPerimeterEnabledTest(true);
        await controller.setGlobalDelaySecondsTest(delay);
        if (pinQueue) {
            await sovryn.setExitDelayQueue(queue.address, { from: owner });
        }
    }

    // ── ERC20 collateral ─────────────────────────────────────────────────────

    describe("ERC20 collateral, perimeter ON", () => {
        it("escrows the user leg into the queue (measured-delta); receiver is NOT paid until executeExit", async () => {
            await armPerimeter();

            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );

            const receiver = account1;
            const withdrawAmount = new BN(10).pow(new BN(15));

            // Static-call to learn the exact GROSS actualWithdrawAmount (== the
            // escrowed amount since the fee is off) without mutating state.
            const escrowed = await sovryn.withdrawCollateral.call(
                loan_id,
                receiver,
                withdrawAmount,
                { from: owner }
            );

            const recvBefore = await RBTC.balanceOf(receiver);
            const queueBefore = await RBTC.balanceOf(queue.address);

            await sovryn.withdrawCollateral(loan_id, receiver, withdrawAmount, { from: owner });

            // Receiver got NOTHING yet; the queue holds the escrow.
            expect((await RBTC.balanceOf(receiver)).sub(recvBefore).toString()).to.equal("0");
            expect((await RBTC.balanceOf(queue.address)).sub(queueBefore).toString()).to.equal(
                escrowed.toString()
            );
            expect((await queue.totalEscrowed(RBTC.address)).toString()).to.equal(
                escrowed.toString()
            );

            // One immutable request with the right provenance + identities.
            expect((await queue.lastRequestId()).toString()).to.equal("1");
            const req = await queue.getRequest(1);
            expect(req.amount.toString()).to.equal(escrowed.toString());
            expect(req.token.toLowerCase()).to.equal(RBTC.address.toLowerCase());
            expect(req.receiver.toLowerCase()).to.equal(receiver.toLowerCase());
            expect(req.originator.toLowerCase()).to.equal(owner.toLowerCase());
            expect(req.owner.toLowerCase()).to.equal(owner.toLowerCase());
            expect(req.surfaceId).to.equal(PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW);
            expect(req.subProduct.toLowerCase()).to.equal(loanToken.address.toLowerCase());
            expect(req.unwrapOnDelivery).to.equal(false);

            // Not executable before unlock.
            await expectRevert(queue.executeExit(1, { from: owner }), "MockQueue: not unlocked");

            // After unlock the owner executes; the immutable receiver is paid.
            await increaseTime(DELAY + 1);
            await queue.executeExit(1, { from: owner });
            expect((await RBTC.balanceOf(receiver)).sub(recvBefore).toString()).to.equal(
                escrowed.toString()
            );
            expect((await RBTC.balanceOf(queue.address)).toString()).to.equal("0");
            expect((await queue.totalEscrowed(RBTC.address)).toString()).to.equal("0");
        });
    });

    // ── Native (WRBTC) collateral ────────────────────────────────────────────

    describe("Native (WRBTC) collateral, perimeter ON", () => {
        it("unwraps WRBTC -> native into the queue (recordReceivedNativeExit); executeExit pays native RBTC", async () => {
            await armPerimeter();

            const receiver = account1;
            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner,
                "WRBTC"
            );
            const depositAmount = new BN(10).pow(new BN(15));
            await sovryn.depositCollateral(loan_id, depositAmount, { value: depositAmount });

            const withdrawAmount = new BN(10).pow(new BN(15));
            const escrowed = await sovryn.withdrawCollateral.call(
                loan_id,
                receiver,
                withdrawAmount,
                { from: owner }
            );

            const recvBefore = new BN(await web3.eth.getBalance(receiver));
            const queueNativeBefore = new BN(await web3.eth.getBalance(queue.address));

            await sovryn.withdrawCollateral(loan_id, receiver, withdrawAmount, { from: owner });

            // Queue received NATIVE RBTC (token == address(0)); receiver unpaid.
            expect(
                new BN(await web3.eth.getBalance(receiver)).sub(recvBefore).toString()
            ).to.equal("0");
            expect(
                new BN(await web3.eth.getBalance(queue.address)).sub(queueNativeBefore).toString()
            ).to.equal(escrowed.toString());
            expect((await queue.totalEscrowed(ZERO)).toString()).to.equal(escrowed.toString());

            const req = await queue.getRequest(1);
            expect(req.token).to.equal(ZERO);
            expect(req.unwrapOnDelivery).to.equal(false); // native leg, not the WRBTC-unwrap flag

            await increaseTime(DELAY + 1);
            await queue.executeExit(1, { from: owner });
            expect(
                new BN(await web3.eth.getBalance(receiver)).sub(recvBefore).toString()
            ).to.equal(escrowed.toString());
        });
    });

    // ── Fee + delay compose ──────────────────────────────────────────────────

    describe("Fee leg unchanged + delay compose", () => {
        it("escrows the NET (gross - fee); the fee receiver still gets the fee", async () => {
            await controller.setExitFeeEnabledTest(true); // 25 bps surface default
            await armPerimeter();

            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );
            const receiver = account1;
            const withdrawAmount = new BN(10).pow(new BN(15));

            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);
            await sovryn.withdrawCollateral(loan_id, receiver, withdrawAmount, { from: owner });

            const req = await queue.getRequest(1);
            const escrowedNet = new BN(req.amount);
            const feePaid = (await RBTC.balanceOf(feeReceiver)).sub(feeRecvBefore);

            // fee leg fired (fee receiver funded) and the NET was escrowed.
            expect(feePaid.gt(new BN(0)), "fee receiver funded").to.equal(true);
            expect((await queue.totalEscrowed(RBTC.address)).toString()).to.equal(
                escrowedNet.toString()
            );
            // gross == net(escrowed) + fee — the split is conserved.
            expect(escrowedNet.add(feePaid).toString()).to.equal(withdrawAmount.toString());
        });
    });

    // ── No-touch when the perimeter is OFF ───────────────────────────────────

    describe("Perimeter OFF — queue NEVER touched", () => {
        it("pays direct; totalEscrowed == 0 and lastRequestId == 0", async () => {
            // Pin the queue but leave the perimeter disabled: proves d==0 pays
            // direct and never records, even with a live queue wired.
            await sovryn.setExitDelayQueue(queue.address, { from: owner });

            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );
            const receiver = account1;
            const withdrawAmount = new BN(10).pow(new BN(15));

            const recvBefore = await RBTC.balanceOf(receiver);
            await sovryn.withdrawCollateral(loan_id, receiver, withdrawAmount, { from: owner });

            // Direct pay; queue untouched.
            expect((await RBTC.balanceOf(receiver)).sub(recvBefore).gt(new BN(0))).to.equal(true);
            expect((await queue.totalEscrowed(RBTC.address)).toString()).to.equal("0");
            expect((await RBTC.balanceOf(queue.address)).toString()).to.equal("0");
            expect((await queue.lastRequestId()).toString()).to.equal("0");
        });
    });

    // ── Delegated-manager originator still delayed (voluntary gate) ──────────

    describe("Delegated-manager exit", () => {
        it("delays with originator == delegate, owner == borrower; the delegate executes", async () => {
            await armPerimeter();

            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );
            await sovryn.setDelegatedManager(loan_id, delegate, true, { from: owner });

            const receiver = account1;
            const withdrawAmount = new BN(10).pow(new BN(15));
            await sovryn.withdrawCollateral(loan_id, receiver, withdrawAmount, { from: delegate });

            const req = await queue.getRequest(1);
            expect(req.originator.toLowerCase()).to.equal(delegate.toLowerCase());
            expect(req.owner.toLowerCase()).to.equal(owner.toLowerCase());

            // The receiver is NOT an executor even though it is a party.
            await increaseTime(DELAY + 1);
            await expectRevert(
                queue.executeExit(1, { from: receiver }),
                "MockQueue: not executor"
            );
            const recvBefore = await RBTC.balanceOf(receiver);
            await queue.executeExit(1, { from: delegate }); // originator executes
            expect((await RBTC.balanceOf(receiver)).sub(recvBefore).toString()).to.equal(
                new BN(req.amount).toString()
            );
        });
    });

    // ── Fail-CLOSED paths ────────────────────────────────────────────────────

    describe("fail-CLOSED behaviours", () => {
        it("perimeter ON but queue pointer unset -> reverts PERIMETER:queue-unset (never pays direct)", async () => {
            await armPerimeter({ pinQueue: false });

            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );
            await expectRevert(
                sovryn.withdrawCollateral(loan_id, account1, new BN(10).pow(new BN(15)), {
                    from: owner,
                }),
                "PERIMETER:queue-unset"
            );
        });

        it("delay below the queue per-request floor -> reverts at ingress", async () => {
            await armPerimeter({ delay: MIN_DELAY - 30 }); // 30 < 60 floor

            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );
            await expectRevert(
                sovryn.withdrawCollateral(loan_id, account1, new BN(10).pow(new BN(15)), {
                    from: owner,
                }),
                "MockQueue: delay below floor"
            );
        });

        it("delay quote reverts -> fail-CLOSED (PERIMETER:delay-quote-failed), NOT treated as d=0", async () => {
            await armPerimeter();
            await controller.setRevertOnDelayQuote(true);

            const [loan_id] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner
            );
            await expectRevert(
                sovryn.withdrawCollateral(loan_id, account1, new BN(10).pow(new BN(15)), {
                    from: owner,
                }),
                "PERIMETER:delay-quote-failed"
            );
        });
    });

    // ── Rotatable Owner-gated setExitDelayQueue pointer ──────────────────────

    describe("setExitDelayQueue pointer", () => {
        it("read-through after pin", async () => {
            await sovryn.setExitDelayQueue(queue.address, { from: owner });
            expect((await sovryn.exitDelayQueue()).toLowerCase()).to.equal(
                queue.address.toLowerCase()
            );
        });

        it("owner rotates the pointer; ExitDelayQueueSet(prev, current) is emitted", async () => {
            await sovryn.setExitDelayQueue(queue.address, { from: owner });
            const next = await MockExitDelayQueue.new(WRBTC.address, MIN_DELAY);
            const tx = await sovryn.setExitDelayQueue(next.address, { from: owner });
            const ev = tx.logs.find((l) => l.event === "ExitDelayQueueSet");
            expect(ev, "ExitDelayQueueSet emitted").to.not.equal(undefined);
            expect(ev.args.previous.toLowerCase()).to.equal(queue.address.toLowerCase());
            expect(ev.args.current.toLowerCase()).to.equal(next.address.toLowerCase());
            expect((await sovryn.exitDelayQueue()).toLowerCase()).to.equal(
                next.address.toLowerCase()
            );
        });

        it("non-owner cannot rotate the pointer", async () => {
            await expectRevert(
                sovryn.setExitDelayQueue(queue.address, { from: account1 }),
                "unauthorized"
            );
        });

        it("setExitDelayQueue(0) and (EOA) revert (EFC:not-contract)", async () => {
            await expectRevert(
                sovryn.setExitDelayQueue(ZERO, { from: owner }),
                "EFC:not-contract"
            );
            await expectRevert(
                sovryn.setExitDelayQueue(account1, { from: owner }),
                "EFC:not-contract"
            );
        });
    });
});
