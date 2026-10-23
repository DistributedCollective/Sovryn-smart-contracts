/**
 * Security-perimeter delay — borrower/margin exit, uint128 bound on the
 * escrowed amount (`LoanMaintenance.withdrawCollateral`, surface
 * `PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW`).
 *
 * The queue records an amount as uint128. The borrower escrow refuses an
 * amount that does not fit, with `PERIMETER:amount-too-large`, instead of
 * letting it truncate (`BorrowerExitPerimeterOps._recordBorrowerExitToQueue`).
 * The guard sits after the vault push to the queue and before the record, in
 * the same transaction, so a refused amount must also take the push back.
 *
 * The test runs against the real protocol: collateral of the boundary size is
 * minted and deposited into a real loan, then withdrawn through the delay path,
 * once for an ERC20 collateral token (measured-delta ERC20 record) and once for
 * native RBTC collateral (measured native record); both records share the guard.
 *   - 2^128 - 1 is let through: the queue records exactly that amount and
 *     `executeExit` delivers all of it to the receiver;
 *   - 2^128 reverts with the guard's reason and leaves the loan's collateral,
 *     the protocol's and the queue's balances, and the queue's accounting
 *     unchanged.
 *
 * Run:
 *   __decryptionAlreadyDone__=TRUE npx hardhat test tests/perimeter/BorrowerExit.amountBound.test.js
 */

const { expect } = require("chai");
const { expectRevert, BN } = require("@openzeppelin/test-helpers");
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

const { increaseTime, setBalance } = require("../Utils/Ethereum");
const mutexUtils = require("../../deployment/helpers/reentrancy/utils");
const { linkIfUsed } = require("../Utils/initializer.js");

const wei = web3.utils.toWei;
const ZERO = "0x0000000000000000000000000000000000000000";
const GUARD_REASON = "PERIMETER:amount-too-large";

const MAX_UINT128 = new BN(2).pow(new BN(128)).subn(1);
const ABOVE_UINT128 = MAX_UINT128.addn(1);
// Collateral deposited into the loan: enough that the drawdown limit never
// caps a withdrawal of 2^128.
const DEPOSIT = ABOVE_UINT128.muln(2);

const MIN_DELAY = 60;
const DELAY = 3600;

contract("Perimeter delay — borrower/margin exit, uint128 bound", (accounts) => {
    let owner, account1, feeReceiver;
    let ownerNativeBefore;
    let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, priceFeeds;
    let controller, queue;

    async function fixture() {
        await mutexUtils.getOrDeployMutex();

        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        await getSOV(sovryn, priceFeeds, SUSD, accounts);

        loanToken = await getLoanToken(owner, sovryn, WRBTC, SUSD);
        loanTokenWRBTC = await getLoanTokenWRBTC(owner, sovryn, WRBTC, SUSD);
        await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

        await set_demand_curve(loanToken);
        await lend_to_pool(loanToken, SUSD, owner);

        // Fee off (net == gross), perimeter armed with a delay.
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(false);
        await controller.setActive(true);
        await controller.setRate(25);
        await controller.setFeeReceiverTest(feeReceiver);
        await controller.setSecurityPerimeterEnabledTest(true);
        await controller.setGlobalDelaySecondsTest(DELAY);
        await sovryn.setExitFeeController(controller.address, { from: owner });

        // The protocol singleton is the registered source for borrower records.
        queue = await MockExitDelayQueue.new(WRBTC.address, MIN_DELAY);
        await queue.setAllowedSource(sovryn.address, true);
        await sovryn.setExitDelayQueue(queue.address, { from: owner });
    }

    before(async () => {
        [owner, account1, feeReceiver, ...accounts] = accounts;
        try {
            const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
            await linkIfUsed(LoanMaintenance, swapsImplSovrynSwapLib);
        } catch (_) {}
        ownerNativeBefore = new BN(await web3.eth.getBalance(owner));
    });

    // The owner's native balance is set to the boundary size by the native
    // collateral tests; put it back so the files that run after this one see
    // the balance the account started with.
    after(async () => {
        await setBalance(owner, ownerNativeBefore);
    });

    beforeEach(async () => {
        await loadFixture(fixture);
    });

    // A real margin-trade loan whose collateral is topped up to the boundary size.
    async function openLoanWithLargeCollateral() {
        const [loanId] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);
        await RBTC.mint(owner, DEPOSIT);
        await RBTC.approve(sovryn.address, DEPOSIT, { from: owner });
        await sovryn.depositCollateral(loanId, DEPOSIT, { from: owner });
        return loanId;
    }

    // Everything a rolled-back exit must leave untouched.
    async function snapshot(loanId, receiver) {
        const s = {
            loanCollateral: (await sovryn.getLoan(loanId)).collateral,
            protocolCollateralToken: await RBTC.balanceOf(sovryn.address),
            queueCollateralToken: await RBTC.balanceOf(queue.address),
            receiverCollateralToken: await RBTC.balanceOf(receiver),
            escrowed: await queue.totalEscrowed(RBTC.address),
            lastRequestId: await queue.lastRequestId(),
        };
        return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.toString()]));
    }

    describe("ERC20 collateral (measured-delta ERC20 record)", () => {
        it("escrows 2^128 - 1 in full and executeExit delivers all of it", async () => {
            const loanId = await openLoanWithLargeCollateral();
            const receiver = account1;

            const withdrawn = await sovryn.withdrawCollateral.call(loanId, receiver, MAX_UINT128, {
                from: owner,
            });
            expect(withdrawn.toString(), "not capped by the drawdown limit").to.equal(
                MAX_UINT128.toString()
            );

            const receiverBefore = await RBTC.balanceOf(receiver);
            await sovryn.withdrawCollateral(loanId, receiver, MAX_UINT128, { from: owner });

            const req = await queue.getRequest(1);
            expect(req.amount.toString()).to.equal(MAX_UINT128.toString());
            expect(req.token.toLowerCase()).to.equal(RBTC.address.toLowerCase());
            expect(req.receiver.toLowerCase()).to.equal(receiver.toLowerCase());
            expect((await queue.totalEscrowed(RBTC.address)).toString()).to.equal(
                MAX_UINT128.toString()
            );
            expect((await RBTC.balanceOf(queue.address)).toString()).to.equal(
                MAX_UINT128.toString()
            );
            expect((await RBTC.balanceOf(receiver)).sub(receiverBefore).toString()).to.equal("0");

            await increaseTime(DELAY + 1);
            await queue.executeExit(1, { from: owner });
            expect((await RBTC.balanceOf(receiver)).sub(receiverBefore).toString()).to.equal(
                MAX_UINT128.toString()
            );
            expect((await queue.totalEscrowed(RBTC.address)).toString()).to.equal("0");
        });

        it("reverts at 2^128 with the amount guard's reason and changes no state", async () => {
            const loanId = await openLoanWithLargeCollateral();
            const receiver = account1;

            const before = await snapshot(loanId, receiver);
            await expectRevert(
                sovryn.withdrawCollateral(loanId, receiver, ABOVE_UINT128, { from: owner }),
                GUARD_REASON
            );
            expect(await snapshot(loanId, receiver)).to.deep.equal(before);
            expect(before.lastRequestId).to.equal("0");
            expect(before.queueCollateralToken).to.equal("0");
            expect(
                new BN(before.protocolCollateralToken).gte(ABOVE_UINT128),
                "the protocol held enough for the push to succeed before the guard"
            ).to.equal(true);
        });
    });

    describe("native RBTC collateral (measured native record)", () => {
        // A real margin-trade loan on WRBTC collateral topped up to the boundary size.
        async function openNativeLoanWithLargeCollateral() {
            const [loanId] = await open_margin_trade_position(
                loanToken,
                RBTC,
                WRBTC,
                SUSD,
                owner,
                "WRBTC"
            );
            await setBalance(owner, DEPOSIT.add(new BN(wei("10", "ether"))));
            await sovryn.depositCollateral(loanId, DEPOSIT, { from: owner, value: DEPOSIT });
            return loanId;
        }

        async function snapshotNative(loanId, receiver) {
            const s = {
                loanCollateral: (await sovryn.getLoan(loanId)).collateral,
                protocolWrbtc: await WRBTC.balanceOf(sovryn.address),
                protocolNative: new BN(await web3.eth.getBalance(sovryn.address)),
                queueNative: new BN(await web3.eth.getBalance(queue.address)),
                queueWrbtc: await WRBTC.balanceOf(queue.address),
                receiverNative: new BN(await web3.eth.getBalance(receiver)),
                escrowedNative: await queue.totalEscrowed(ZERO),
                lastRequestId: await queue.lastRequestId(),
            };
            return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.toString()]));
        }

        it("escrows 2^128 - 1 in full and executeExit delivers all of it as native RBTC", async () => {
            const loanId = await openNativeLoanWithLargeCollateral();
            const receiver = account1;

            const withdrawn = await sovryn.withdrawCollateral.call(loanId, receiver, MAX_UINT128, {
                from: owner,
            });
            expect(withdrawn.toString(), "not capped by the drawdown limit").to.equal(
                MAX_UINT128.toString()
            );

            const receiverBefore = new BN(await web3.eth.getBalance(receiver));
            await sovryn.withdrawCollateral(loanId, receiver, MAX_UINT128, { from: owner });

            const req = await queue.getRequest(1);
            expect(req.amount.toString()).to.equal(MAX_UINT128.toString());
            expect(req.token).to.equal(ZERO);
            expect(req.receiver.toLowerCase()).to.equal(receiver.toLowerCase());
            expect((await queue.totalEscrowed(ZERO)).toString()).to.equal(MAX_UINT128.toString());
            expect(
                new BN(await web3.eth.getBalance(receiver)).sub(receiverBefore).toString()
            ).to.equal("0");

            await increaseTime(DELAY + 1);
            await queue.executeExit(1, { from: owner });
            expect(
                new BN(await web3.eth.getBalance(receiver)).sub(receiverBefore).toString()
            ).to.equal(MAX_UINT128.toString());
            expect((await queue.totalEscrowed(ZERO)).toString()).to.equal("0");
        });

        it("reverts at 2^128 with the amount guard's reason and changes no state", async () => {
            const loanId = await openNativeLoanWithLargeCollateral();
            const receiver = account1;

            const before = await snapshotNative(loanId, receiver);
            await expectRevert(
                sovryn.withdrawCollateral(loanId, receiver, ABOVE_UINT128, { from: owner }),
                GUARD_REASON
            );
            expect(await snapshotNative(loanId, receiver)).to.deep.equal(before);
            expect(before.lastRequestId).to.equal("0");
            expect(before.queueNative).to.equal("0");
            expect(
                new BN(before.protocolWrbtc).gte(ABOVE_UINT128),
                "the protocol held enough for the push to succeed before the guard"
            ).to.equal(true);
        });
    });
});
