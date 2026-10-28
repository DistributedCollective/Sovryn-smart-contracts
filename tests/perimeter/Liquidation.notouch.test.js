/**
 * Liquidation is not charged the Perimeter fee.
 *
 * `LoanClosingsLiquidation.liquidate(...)` pays seized collateral through
 * the plain `_withdrawAsset` helper inherited from the uncharged close base.
 * Interest settlement threads `CloseOrigin.Liquidation` through that same
 * base. Liquidation does not inherit the charged/delayed payout wrappers:
 * its exemption is structural even when the borrower is the liquidator.
 * A refusing liquidator receiver still reverts; donation on failed native
 * receipt applies only to the borrower's excess refund.
 *
 * This test asserts: when an unhealthy position is liquidated, NO Perimeter
 * event is emitted, regardless of controller state.
 *
 * Run:
 *   npx hardhat test tests/perimeter/Liquidation.notouch.test.js
 */

const { expect } = require("chai");
const { BN } = require("@openzeppelin/test-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");
const {
    loadOriginalLiquidation,
    assertRetainedLiquidation,
} = require("../../deployment/helpers/liquidationRetention");

const LoanMaintenance = artifacts.require("LoanMaintenance");
const SwapsImplSovrynSwapLib = artifacts.require("SwapsImplSovrynSwapLib");
const MockExitFeeController = artifacts.require("MockExitFeeController");
const MockExitDelayQueue = artifacts.require("MockExitDelayQueue");
const LoanOpeningsEvents = artifacts.require("LoanOpeningsEvents");

const { increaseTime } = require("../Utils/Ethereum");

const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getLoanToken,
    getLoanTokenWRBTC,
    loan_pool_setup,
    set_demand_curve,
    getPriceFeeds,
    getSovryn,
    getSOV,
    decodeLogs,
} = require("../Utils/initializer.js");

const mutexUtils = require("../../deployment/helpers/reentrancy/utils");
const { linkIfUsed } = require("../Utils/initializer.js");

const wei = web3.utils.toWei;
const oneEth = new BN(wei("1", "ether"));

contract("Perimeter — liquidation is not charged", (accounts) => {
    let lender, borrower, liquidator, feeReceiver;
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
        // Mix current changed modules with the exact original registered liquidation.
        // This is an isolated in-process VM, never the owner's shared fork.
        const original = loadOriginalLiquidation();
        await hre.network.provider.send("hardhat_setCode", [
            original.address,
            original.record.deployedBytecode,
        ]);
        await sovryn.replaceContract(original.address, { from: lender });
        await assertRetainedLiquidation(hre, sovryn);
        sov = await getSOV(sovryn, priceFeeds, SUSD, accounts);

        loanToken = await getLoanToken(lender, sovryn, WRBTC, SUSD);
        loanTokenWRBTC = await getLoanTokenWRBTC(lender, sovryn, WRBTC, SUSD);
        await loan_pool_setup(sovryn, lender, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

        // Perimeter controller FULLY ACTIVE — proves the no-touch property
        // comes from the gate at the hook, not from the controller being
        // inactive.
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(true);
        await controller.setActive(true);
        await controller.setRate(25);
        await controller.setFeeReceiverTest(feeReceiver);
        await sovryn.setExitFeeController(controller.address, { from: lender });
        queue = await MockExitDelayQueue.new(WRBTC.address, 60);
        await queue.setAllowedSource(sovryn.address, true);
        await sovryn.setExitDelayQueue(queue.address, { from: lender });
        await controller.setGlobalDelaySecondsTest(86400);
        await controller.setSecurityPerimeterEnabledTest(true);
    }

    before(async () => {
        [lender, borrower, liquidator, feeReceiver, ...accounts] = accounts;

        try {
            const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
            await linkIfUsed(LoanMaintenance, swapsImplSovrynSwapLib);
        } catch (_) {}
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    // Mirrors `prepare_liquidation` from tests/protocol/liquidationFunctions.js.
    async function openMarginTradeForLiquidation() {
        await set_demand_curve(loanToken);
        await SUSD.approve(loanToken.address, new BN(10).pow(new BN(40)));
        await loanToken.mint(lender, new BN(10).pow(new BN(21)));

        const loan_token_sent = new BN(10).mul(oneEth);
        await SUSD.mint(borrower, loan_token_sent);
        await SUSD.mint(liquidator, loan_token_sent);
        await SUSD.approve(loanToken.address, loan_token_sent, { from: borrower });
        await SUSD.approve(sovryn.address, loan_token_sent, { from: liquidator });

        const { receipt } = await loanToken.marginTrade(
            "0x0",
            new BN(2).mul(oneEth), // leverageAmount
            loan_token_sent,
            0,
            RBTC.address,
            borrower,
            0,
            "0x",
            { from: borrower }
        );

        const decoded = decodeLogs(receipt.rawLogs, LoanOpeningsEvents, "Trade");
        return { loan_id: decoded[0].args["loanId"], loan_token_sent };
    }

    describe("retained liquidation with current fee and delay modules", () => {
        // POSITIVE CONTROL for the no-touch claim below. Without it, "no Perimeter
        // event on liquidation" is indistinguishable from "the Perimeter system is
        // inert in this fixture" — an unwired charge-hook pointer, an unpinned
        // controller, or a burnt-out event ABI would all make the no-touch
        // assertion pass for the wrong reason. This test proves the SAME fixture
        // charges and escrows a real voluntary exit, so retention does not
        // pass merely because the current Perimeter is inactive.
        it("CONTROL: the same fixture DOES charge on a chargeable exit (withdrawCollateral, 25 bps)", async () => {
            const { loan_id } = await openMarginTradeForLiquidation();

            // Sized from the loan's own collateral (0.1%, safely inside
            // maxDrawdown) and deliberately NOT round, so a fee derived by
            // different arithmetic than the controller's would mismatch.
            const loan = await sovryn.getLoan(loan_id);
            const withdrawAmount = new BN(loan["collateral"]).divn(1000).addn(333);
            const feeRecvBefore = await RBTC.balanceOf(feeReceiver);

            const tx = await sovryn.withdrawCollateral(loan_id, borrower, withdrawAmount, {
                from: borrower,
            });

            const applied = tx.logs.filter((l) => l.event === "ExitFeeApplied");
            expect(applied.length, "fee system is ACTIVE in this fixture").to.equal(1);
            const fee = new BN(applied[0].args.feeAmount);
            const gross = new BN(applied[0].args.grossAmount);
            expect(
                gross.toString(),
                "the whole request was withdrawn (below maxDrawdown)"
            ).to.equal(withdrawAmount.toString());
            expect(fee.gt(new BN(0)), "a non-zero fee was actually charged").to.equal(true);
            expect(fee.toString(), "fee == gross * 25/10_000").to.equal(
                withdrawAmount.muln(25).divn(10_000).toString()
            );
            expect(
                (await RBTC.balanceOf(feeReceiver)).sub(feeRecvBefore).toString(),
                "feeReceiver delta == fee (the fee leg really settled)"
            ).to.equal(fee.toString());
            expect((await queue.lastRequestId()).toString()).to.equal("1");
            expect((await queue.totalEscrowed(RBTC.address)).toString()).to.equal(
                withdrawAmount.sub(fee).toString()
            );
        });

        it("Perimeter does NOT fire when an unhealthy position is liquidated — no ExitFeeApplied, no ExitFeeSkipped", async () => {
            const { loan_id, loan_token_sent } = await openMarginTradeForLiquidation();

            // Re-rate RBTC/SUSD so the position becomes liquidatable
            // (rate = 1e21 matches the existing "Test liquidate with rate
            // 1e21" in LiquidationTestToken.test.js).
            await priceFeeds.setRates(
                RBTC.address,
                SUSD.address,
                new BN(10).pow(new BN(21)).toString()
            );

            // Time travel so back interest can accrue (matches the existing
            // liquidate(...) helper pattern).
            await increaseTime(10 * 24 * 60 * 60);

            const loanBefore = await sovryn.getLoan(loan_id);
            const feeRecvRbtcBefore = await RBTC.balanceOf(feeReceiver);
            const feeRecvSusdBefore = await SUSD.balanceOf(feeReceiver);
            const receiverBefore = await RBTC.balanceOf(liquidator);
            // If a retained path accidentally quotes a hold, the current
            // delay fail-closed guard would reject this liquidation.
            await controller.setRevertOnDelayQuote(true);

            const tx = await sovryn.liquidate(loan_id, liquidator, loan_token_sent, {
                from: liquidator,
                value: 0,
            });

            const applied = tx.logs.filter((l) => l.event === "ExitFeeApplied");
            const skipped = tx.logs.filter((l) => l.event === "ExitFeeSkipped");
            expect(applied.length, "no ExitFeeApplied on liquidation").to.equal(0);
            expect(
                skipped.length,
                "no ExitFeeSkipped either — the gate short-circuits before any controller call"
            ).to.equal(0);

            // Value-level proof, independent of the event stream: the fee
            // receiver's balances do not move in either asset.
            expect(
                (await RBTC.balanceOf(feeReceiver)).sub(feeRecvRbtcBefore).toString(),
                "feeReceiver RBTC delta == 0"
            ).to.equal("0");
            expect(
                (await SUSD.balanceOf(feeReceiver)).sub(feeRecvSusdBefore).toString(),
                "feeReceiver SUSD delta == 0"
            ).to.equal("0");

            // Sanity: the liquidation was not blocked — collateral was seized.
            const loanAfter = await sovryn.getLoan(loan_id);
            expect(
                new BN(loanAfter["collateral"]).lt(new BN(loanBefore["collateral"])),
                "collateral strictly decreased — the liquidation actually executed"
            ).to.equal(true);
            expect(
                (await RBTC.balanceOf(liquidator)).gt(receiverBefore),
                "seized collateral reached the liquidator immediately"
            ).to.equal(true);
            expect((await queue.lastRequestId()).toString()).to.equal("0");
            expect((await queue.totalEscrowed(RBTC.address)).toString()).to.equal("0");
            expect((await queue.totalEscrowed(SUSD.address)).toString()).to.equal("0");
        });
    });

    /**
     * Pin the mechanism, because the behavioural tests above cannot.
     *
     * Mutation testing showed they survive every change to the fee logic --
     * including deleting both exemption guards in `_exitFeeChargeable` and
     * making it return true unconditionally. That is not a weak assertion: it
     * is because liquidation never reaches the charging code at all. It calls
     * the plain `_withdrawAsset`, while charged exits call
     * `_withdrawAssetChargingExitFee`.
     *
     * So the exemption is structural, not a runtime check, and describing it as
     * "exempt by CloseOrigin.Liquidation" is misleading -- the origin gate is
     * not what protects this path. This test fails on the change that would
     * actually break it: wiring a charging helper into the liquidation module.
     */
    it("the liquidation module never calls a charging withdrawal helper", () => {
        const fs = require("fs");
        const src = fs
            .readFileSync("contracts/modules/LoanClosingsLiquidation.sol", "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/.*$/gm, "");

        ["_withdrawAssetChargingExitFee", "_chargeExitFeeReturnNet"].forEach((helper) => {
            expect(
                src.includes(helper),
                `LoanClosingsLiquidation calls ${helper}. Liquidation is a forced ` +
                    `close and must never charge an exit fee; it is exempt because it ` +
                    `calls the plain _withdrawAsset, not because of any runtime check.`
            ).to.be.false;
        });

        expect(
            src.includes("_withdrawAsset("),
            "liquidation should still pay out through the plain withdrawal helper"
        ).to.be.true;
    });
});
