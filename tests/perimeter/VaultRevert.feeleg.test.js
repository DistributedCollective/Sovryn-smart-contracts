/**
 * VAULT_REVERT — fee-leg failure coverage on every Perimeter transfer primitive.
 *
 * The core fail-open promise: a FAILING FEE TRANSFER can never block an exit
 * and never shortchange the user — the hook charges nothing, pays FULL gross,
 * and emits ExitFeeSkipped(VAULT_REVERT). Until this suite, that promise was
 * asserted only by code inspection. Four primitives, four proofs:
 *
 *   iToken tree (inline hook, no delegatecall backstop):
 *     1. ERC20 fee leg     — `_transferUnderlyingToken(nonBlocking=true)`
 *                            false-return decode (TestTokenBlockedRecipient).
 *     2. native fee leg    — `_transferNativeRBTC(nonBlocking=true)` receiver
 *                            revert + RE-WRAP (no orphan native in the iToken,
 *                            pool WRBTC decrements by exactly gross).
 *
 *   protocol tree (BorrowerExitPerimeterOps._payExitFeeLeg via delegatecall):
 *     3. ERC20 fee leg     — false-return decode, blocked feeReceiver.
 *     4. native fee leg    — receiver revert + RE-WRAP (no orphan native on
 *                            sovrynProtocol, vault WRBTC decrements by exactly
 *                            gross).
 *
 * The reverting fee receiver is MaliciousBorrower (fallback always reverts);
 * the false-returning ERC20 is TestTokenBlockedRecipient (returns false only
 * for blocked recipients, so the user leg in the same tx still succeeds).
 *
 * Run:
 *   npx hardhat test tests/perimeter/VaultRevert.feeleg.test.js
 */

const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { BN, balance } = require("@openzeppelin/test-helpers");

const LoanToken = artifacts.require("LoanToken");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");
const MockExitFeeController = artifacts.require("MockExitFeeController");
const MaliciousBorrower = artifacts.require("MaliciousBorrower");
const TestTokenBlockedRecipient = artifacts.require("TestTokenBlockedRecipient");

const LoanMaintenance = artifacts.require("LoanMaintenance");
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
const mutexUtils = require("../../deployment/helpers/reentrancy/utils");

const wei = web3.utils.toWei;

// SkipReason enum: 0 NONE 1 INACTIVE 2 DISABLED 3 INVALID_QUOTE 4 CONTROLLER_REVERT 5 VAULT_REVERT
const VAULT_REVERT = 5;

function findApplied(logs) {
    return logs.filter((l) => l.event === "ExitFeeApplied");
}
function findSkipped(logs) {
    return logs.filter((l) => l.event === "ExitFeeSkipped");
}

contract("Perimeter — VAULT_REVERT fee-leg failures (iToken tree)", (accounts) => {
    let lender, user, feeReceiver;
    let BLK, SUSD, WRBTC, RBTC, BZRX, priceFeeds, sovryn;
    let iBLK, iWRBTC;
    let controller, revertingReceiver;

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

        // Underlying whose `transfer` returns false for blocked recipients.
        BLK = await TestTokenBlockedRecipient.new("BLK", "BLK", 18, wei("10000", "ether"));

        const feeds = await PriceFeedsLocal.new(WRBTC.address, sovryn.address);
        await feeds.setRates(BLK.address, WRBTC.address, wei("0.01", "ether"));
        const swaps = await SwapsImplSovrynSwap.new();
        const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
        await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
        await sovryn.setSupportedTokens([BLK.address, WRBTC.address], [true, true]);
        await sovryn.setPriceFeedContract(feeds.address);
        await sovryn.setSwapsImplContract(swaps.address);
        await sovryn.setFeesController(lender);
        await getSOV(sovryn, priceFeeds, SUSD, accounts);

        // ── iBLK (pool over the false-returning ERC20) ─────────────────────
        const [iLogic, iBeacon] = await getLoanTokenLogic();
        let lt = await LoanToken.new(lender, iLogic.address, sovryn.address, WRBTC.address);
        await lt.initialize(BLK.address, "iBLK", "iBLK");
        const params = [
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            false,
            lender,
            BLK.address,
            WRBTC.address,
            wei("20", "ether"),
            wei("15", "ether"),
            2419200,
        ];
        lt = await ILoanTokenLogicProxy.at(lt.address);
        await lt.setBeaconAddress(iBeacon.address);
        lt = await ILoanTokenModules.at(lt.address);
        await lt.setupLoanParams([params], false);
        await sovryn.setLoanPool([lt.address], [BLK.address]);
        iBLK = lt;

        // ── iWRBTC (native burnToBTC path) ─────────────────────────────────
        const [iWLogic, iWBeacon] = await getLoanTokenLogicWrbtc();
        let ltw = await LoanToken.new(lender, iWLogic.address, sovryn.address, WRBTC.address);
        await ltw.initialize(WRBTC.address, "iWRBTC", "iWRBTC");
        const wparams = [
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            false,
            lender,
            WRBTC.address,
            BLK.address,
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

        // Reverting fee receiver (fallback always reverts).
        revertingReceiver = await MaliciousBorrower.new();

        // ── Controller, enabled, 20 bps ────────────────────────────────────
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(true);
        await controller.setActive(true);
        await controller.setRate(20);
        await controller.setFeeReceiverTest(feeReceiver);
        // Single protocol-singleton pin serves every pool (iTokens read the
        // pointer through sovrynContractAddress).
        await sovryn.setExitFeeController(controller.address, { from: lender });

        // ── Seed the user in both pools ────────────────────────────────────
        const seedBLK = new BN(wei("1000", "ether"));
        await BLK.mint(user, seedBLK);
        await BLK.approve(iBLK.address, seedBLK, { from: user });
        await iBLK.mint(user, seedBLK, { from: user });

        await iWRBTC.mintWithBTC(user, false, { from: user, value: wei("1", "ether") });
    }

    before(async () => {
        [lender, user, feeReceiver, ...accounts] = accounts;
        const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
        await SwapsImplSovrynSwap.link(swapsImplSovrynSwapLib);
    });

    beforeEach(async () => {
        await loadFixture(fixture);
    });

    it("ERC20 fee leg returns false → burn pays FULL gross, ExitFeeSkipped(VAULT_REVERT)", async () => {
        // Fee transfers to feeReceiver return false; the user leg (same token,
        // unblocked recipient) must still succeed fail-closed.
        await BLK.setBlockedRecipient(feeReceiver, true);

        const burnAmount = await iBLK.balanceOf(user);
        const userBefore = await BLK.balanceOf(user);
        const feeRecvBefore = await BLK.balanceOf(feeReceiver);
        const poolBefore = await BLK.balanceOf(iBLK.address);

        const tx = await iBLK.burn(user, burnAmount, false, { from: user });

        expect(findApplied(tx.logs).length, "no Applied on fee-leg failure").to.equal(0);
        const skipped = findSkipped(tx.logs);
        expect(skipped.length, "one Skipped").to.equal(1);
        expect(skipped[0].args.reason.toNumber()).to.equal(VAULT_REVERT);
        expect(skipped[0].args.rateBps.toString(), "rate echoed for diagnostics").to.equal("20");

        const gross = new BN(skipped[0].args.grossAmount);
        expect((await BLK.balanceOf(user)).sub(userBefore).toString(), "user FULL gross").to.equal(
            gross.toString()
        );
        expect(
            (await BLK.balanceOf(feeReceiver)).sub(feeRecvBefore).toString(),
            "fee receiver got nothing"
        ).to.equal("0");
        // No partial fee stuck anywhere: pool decrements by exactly gross.
        expect(
            poolBefore.sub(await BLK.balanceOf(iBLK.address)).toString(),
            "pool decrement == gross"
        ).to.equal(gross.toString());
    });

    it("native fee leg reverts → burnToBTC pays FULL gross native, re-wrap leaves no residue", async () => {
        await controller.setFeeReceiverTest(revertingReceiver.address);

        const burnAmount = await iWRBTC.balanceOf(user);
        const userRbtcBefore = await balance.current(user);
        const poolWrbtcBefore = await WRBTC.balanceOf(iWRBTC.address);

        const tx = await iWRBTC.burnToBTC(user, burnAmount, false, {
            from: user,
            gasPrice: 0, // RBTC delta == payout
        });

        expect(findApplied(tx.logs).length, "no Applied on fee-leg failure").to.equal(0);
        const skipped = findSkipped(tx.logs);
        expect(skipped.length, "one Skipped").to.equal(1);
        expect(skipped[0].args.reason.toNumber()).to.equal(VAULT_REVERT);

        const gross = new BN(skipped[0].args.grossAmount);

        // User got the FULL gross as native RBTC.
        expect(
            (await balance.current(user)).sub(userRbtcBefore).toString(),
            "user FULL gross native"
        ).to.equal(gross.toString());

        // Reverting receiver obviously got nothing.
        expect((await balance.current(revertingReceiver.address)).toString()).to.equal("0");

        // RE-WRAP invariant: the failed fee unwrap was deposited back into
        // WRBTC, so the iToken holds zero orphan native and the pool's WRBTC
        // decrements by EXACTLY gross (unwrap(fee) + rewrap(fee) net to zero;
        // only the user leg's unwrap(gross) leaves).
        expect(
            (await balance.current(iWRBTC.address)).toString(),
            "no orphan native in iToken"
        ).to.equal("0");
        expect(
            poolWrbtcBefore.sub(await WRBTC.balanceOf(iWRBTC.address)).toString(),
            "pool WRBTC decrement == gross"
        ).to.equal(gross.toString());
    });
});

contract("Perimeter — VAULT_REVERT fee-leg failures (protocol tree)", (accounts) => {
    let owner, account1, feeReceiver;
    let sovryn, BLK, SUSD, WRBTC, BZRX, loanToken, loanTokenWRBTC, priceFeeds;
    let controller, revertingReceiver;

    async function fixture() {
        await mutexUtils.getOrDeployMutex();

        SUSD = await getSUSD();
        // BLK stands in for the usual RBTC collateral TestToken everywhere —
        // same ERC20 surface, plus the blockable `transfer`.
        BLK = await TestTokenBlockedRecipient.new("BLK", "BLK", 18, wei("10000", "ether"));
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, BLK, BZRX);

        sovryn = await getSovryn(WRBTC, SUSD, BLK, priceFeeds);
        await getSOV(sovryn, priceFeeds, SUSD, accounts);

        loanToken = await getLoanToken(owner, sovryn, WRBTC, SUSD);
        loanTokenWRBTC = await getLoanTokenWRBTC(owner, sovryn, WRBTC, SUSD);
        await loan_pool_setup(sovryn, owner, BLK, WRBTC, SUSD, loanToken, loanTokenWRBTC);

        await set_demand_curve(loanToken);
        await lend_to_pool(loanToken, SUSD, owner);

        revertingReceiver = await MaliciousBorrower.new();

        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(true);
        await controller.setActive(true);
        await controller.setRate(25);
        await controller.setFeeReceiverTest(feeReceiver);
        await sovryn.setExitFeeController(controller.address, { from: owner });
    }

    before(async () => {
        [owner, account1, feeReceiver, ...accounts] = accounts;
        try {
            const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
            await LoanMaintenance.link(swapsImplSovrynSwapLib);
        } catch (_) {}
    });

    beforeEach(async () => {
        await loadFixture(fixture);
    });

    it("ERC20 fee leg returns false → withdrawCollateral pays FULL gross, ExitFeeSkipped(VAULT_REVERT)", async () => {
        const [loan_id] = await open_margin_trade_position(loanToken, BLK, WRBTC, SUSD, owner);

        // Fee transfers (BorrowerExitPerimeterOps._payExitFeeLeg ERC20 branch) return
        // false; the user leg (vaultWithdraw, fail-closed) must still succeed.
        await BLK.setBlockedRecipient(feeReceiver, true);

        const withdrawAmount = new BN(10).pow(new BN(15));
        const ownerBefore = await BLK.balanceOf(owner);
        const feeRecvBefore = await BLK.balanceOf(feeReceiver);
        const vaultBefore = await BLK.balanceOf(sovryn.address);

        const tx = await sovryn.withdrawCollateral(loan_id, owner, withdrawAmount);

        expect(findApplied(tx.logs).length, "no Applied on fee-leg failure").to.equal(0);
        const skipped = findSkipped(tx.logs);
        expect(skipped.length, "one Skipped").to.equal(1);
        expect(skipped[0].args.reason.toNumber()).to.equal(VAULT_REVERT);
        expect(skipped[0].args.rateBps.toString()).to.equal("25");

        expect(
            (await BLK.balanceOf(owner)).sub(ownerBefore).toString(),
            "borrower FULL gross"
        ).to.equal(withdrawAmount.toString());
        expect(
            (await BLK.balanceOf(feeReceiver)).sub(feeRecvBefore).toString(),
            "fee receiver got nothing"
        ).to.equal("0");
        // Atomic rollback inside the delegatecall frame: vault decrements by
        // exactly gross, no partial fee left in flight.
        expect(
            vaultBefore.sub(await BLK.balanceOf(sovryn.address)).toString(),
            "vault decrement == gross"
        ).to.equal(withdrawAmount.toString());
    });

    it("native fee leg reverts → withdrawCollateral pays FULL gross native, re-wrap leaves no residue", async () => {
        await controller.setFeeReceiverTest(revertingReceiver.address);

        // WRBTC-collateralized position; top up native headroom to withdraw.
        const [loan_id] = await open_margin_trade_position(
            loanToken,
            BLK,
            WRBTC,
            SUSD,
            owner,
            "WRBTC"
        );
        const depositAmount = new BN(10).pow(new BN(15));
        await sovryn.depositCollateral(loan_id, depositAmount, { value: depositAmount });

        const withdrawAmount = new BN(10).pow(new BN(15));
        const userReceiver = account1; // not the caller → clean native delta

        const userBefore = new BN(await web3.eth.getBalance(userReceiver));
        const vaultWrbtcBefore = await WRBTC.balanceOf(sovryn.address);

        const tx = await sovryn.withdrawCollateral(loan_id, userReceiver, withdrawAmount, {
            from: owner,
        });

        expect(findApplied(tx.logs).length, "no Applied on fee-leg failure").to.equal(0);
        const skipped = findSkipped(tx.logs);
        expect(skipped.length, "one Skipped").to.equal(1);
        expect(skipped[0].args.reason.toNumber()).to.equal(VAULT_REVERT);

        // User got the FULL gross as native RBTC (vaultEtherWithdraw leg).
        expect(
            new BN(await web3.eth.getBalance(userReceiver)).sub(userBefore).toString(),
            "user FULL gross native"
        ).to.equal(withdrawAmount.toString());

        // RE-WRAP invariant on the protocol: the failed fee unwrap was
        // re-deposited (no orphan native on sovrynProtocol), and the vault's
        // WRBTC decrements by EXACTLY gross.
        expect(
            (await balance.current(sovryn.address)).toString(),
            "no orphan native on protocol"
        ).to.equal("0");
        expect(
            vaultWrbtcBefore.sub(await WRBTC.balanceOf(sovryn.address)).toString(),
            "vault WRBTC decrement == gross"
        ).to.equal(withdrawAmount.toString());
    });
});
