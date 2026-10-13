/**
 * Security-perimeter delay — lender exit, uint128 bound on the escrowed amount
 * (`iToken.burn` / `iToken.burnToBTC`, surface
 * `PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW`).
 *
 * The queue records an amount as uint128. Both lender escrow paths refuse an
 * amount that does not fit, with `PERIMETER:amount-too-large`, instead of
 * letting it truncate:
 *   - ERC20 burn  -> `LoanTokenLogicShared._escrowExitUserLeg`
 *   - burnToBTC   -> `LoanTokenLogicWrbtcLM._payExitUserLegNative`
 *
 * Both run against the real logic contracts through the iToken proxy; the pool
 * is funded to the boundary size by minting the underlying (or, for WRBTC, by
 * setting the lender's native balance) and lending it in.
 *
 * For each path:
 *   - 2^128 - 1 is let through: the queue records exactly that amount and
 *     `executeExit` delivers all of it;
 *   - 2^128 reverts with the guard's reason and leaves the lender's balances,
 *     the pool's accounting and the queue unchanged.
 *
 * Run:
 *   __decryptionAlreadyDone__=TRUE npx hardhat test tests/perimeter/LenderExit.amountBound.test.js
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
    getLoanTokenLogicWrbtc,
    getPriceFeeds,
    getSovryn,
    getSOV,
} = require("../Utils/initializer.js");
const mutexUtils = require("../../deployment/helpers/reentrancy/utils");
const { increaseTime, setBalance } = require("../Utils/Ethereum");
const { linkIfUsed } = require("../Utils/initializer.js");

const wei = web3.utils.toWei;
const GUARD_REASON = "PERIMETER:amount-too-large";

const MAX_UINT128 = new BN(2).pow(new BN(128)).subn(1);
const ABOVE_UINT128 = MAX_UINT128.addn(1);

const MIN_DELAY = 60;
const DELAY = 3600;

contract("Perimeter delay — lender exit, uint128 bound", (accounts) => {
    let lender, user, feeReceiver, whale, receiver;
    let whaleNativeBefore;
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

        // Fee off (net == gross), perimeter armed with a delay.
        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(false);
        await controller.setActive(true);
        await controller.setRate(20);
        await controller.setFeeReceiverTest(feeReceiver);
        await controller.setSecurityPerimeterEnabledTest(true);
        await controller.setGlobalDelaySecondsTest(DELAY);
        await sovryn.setExitFeeController(controller.address, { from: lender });

        queue = await MockExitDelayQueue.new(WRBTC.address, MIN_DELAY);
        await queue.setAllowedSource(iSUSD.address, true);
        await queue.setAllowedSource(iWRBTC.address, true);
        await sovryn.setExitDelayQueue(queue.address, { from: lender });
    }

    before(async () => {
        [lender, user, feeReceiver, whale, receiver, ...accounts] = accounts;
        const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
        await linkIfUsed(SwapsImplSovrynSwap, swapsImplSovrynSwapLib);
        whaleNativeBefore = new BN(await web3.eth.getBalance(whale));
    });

    // The lender's native balance is set to the boundary size by the WRBTC
    // tests; put it back so the files that run after this one see the balance
    // the account started with.
    after(async () => {
        await setBalance(whale, whaleNativeBefore);
    });

    beforeEach(async () => {
        await loadFixture(fixture);
    });

    // Lend exactly `amount` of the underlying and return the iTokens received.
    async function lendSusd(amount) {
        await SUSD.mint(whale, amount);
        await SUSD.approve(iSUSD.address, amount, { from: whale });
        await iSUSD.mint(whale, amount, { from: whale });
        return iSUSD.balanceOf(whale);
    }

    async function lendRbtc(amount) {
        await setBalance(whale, amount.add(new BN(wei("10", "ether"))));
        await iWRBTC.mintWithBTC(whale, false, { from: whale, value: amount });
        return iWRBTC.balanceOf(whale);
    }

    // Everything a rolled-back exit must leave untouched.
    async function snapshotSusd() {
        const s = {
            whaleUnderlying: await SUSD.balanceOf(whale),
            receiverUnderlying: await SUSD.balanceOf(receiver),
            poolUnderlying: await SUSD.balanceOf(iSUSD.address),
            queueUnderlying: await SUSD.balanceOf(queue.address),
            queueAllowance: await SUSD.allowance(iSUSD.address, queue.address),
            whaleShares: await iSUSD.balanceOf(whale),
            shareSupply: await iSUSD.totalSupply(),
            totalAssetSupply: await iSUSD.totalAssetSupply(),
            tokenPrice: await iSUSD.tokenPrice(),
            escrowed: await queue.totalEscrowed(SUSD.address),
            lastRequestId: await queue.lastRequestId(),
        };
        return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.toString()]));
    }

    async function snapshotWrbtc() {
        const s = {
            whaleNative: new BN(await web3.eth.getBalance(whale)),
            receiverNative: new BN(await web3.eth.getBalance(receiver)),
            poolWrbtc: await WRBTC.balanceOf(iWRBTC.address),
            queueWrbtc: await WRBTC.balanceOf(queue.address),
            queueAllowance: await WRBTC.allowance(iWRBTC.address, queue.address),
            whaleShares: await iWRBTC.balanceOf(whale),
            shareSupply: await iWRBTC.totalSupply(),
            totalAssetSupply: await iWRBTC.totalAssetSupply(),
            tokenPrice: await iWRBTC.tokenPrice(),
            escrowed: await queue.totalEscrowed(WRBTC.address),
            escrowedNative: await queue.totalEscrowed(
                "0x0000000000000000000000000000000000000000"
            ),
            lastRequestId: await queue.lastRequestId(),
        };
        return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.toString()]));
    }

    describe("iSUSD burn (ERC20 escrow)", () => {
        it("escrows 2^128 - 1 in full and executeExit delivers all of it", async () => {
            const shares = await lendSusd(MAX_UINT128);
            expect(shares.toString(), "one share per unit lent").to.equal(MAX_UINT128.toString());

            const receiverBefore = await SUSD.balanceOf(receiver);
            await iSUSD.burn(receiver, shares, false, { from: whale });

            const req = await queue.getRequest(1);
            expect(req.amount.toString()).to.equal(MAX_UINT128.toString());
            expect(req.token.toLowerCase()).to.equal(SUSD.address.toLowerCase());
            expect(req.receiver.toLowerCase()).to.equal(receiver.toLowerCase());
            expect((await queue.totalEscrowed(SUSD.address)).toString()).to.equal(
                MAX_UINT128.toString()
            );
            expect((await SUSD.balanceOf(receiver)).sub(receiverBefore).toString()).to.equal("0");

            await increaseTime(DELAY + 1);
            await queue.executeExit(1, { from: whale });
            expect((await SUSD.balanceOf(receiver)).sub(receiverBefore).toString()).to.equal(
                MAX_UINT128.toString()
            );
            expect((await queue.totalEscrowed(SUSD.address)).toString()).to.equal("0");
        });

        it("reverts at 2^128 with the amount guard's reason and changes no state", async () => {
            const shares = await lendSusd(ABOVE_UINT128);
            expect(shares.toString(), "one share per unit lent").to.equal(
                ABOVE_UINT128.toString()
            );

            const before = await snapshotSusd();
            await expectRevert(iSUSD.burn(receiver, shares, false, { from: whale }), GUARD_REASON);
            expect(await snapshotSusd()).to.deep.equal(before);
            expect(before.tokenPrice, "payout equals shares burned").to.equal(wei("1", "ether"));
            expect(before.lastRequestId).to.equal("0");
            expect(before.queueUnderlying).to.equal("0");
        });
    });

    describe("iWRBTC burnToBTC (WRBTC escrow, deferred unwrap)", () => {
        it("escrows 2^128 - 1 in full and executeExit delivers all of it as native RBTC", async () => {
            const shares = await lendRbtc(MAX_UINT128);
            expect(shares.toString(), "one share per unit lent").to.equal(MAX_UINT128.toString());

            const receiverBefore = new BN(await web3.eth.getBalance(receiver));
            await iWRBTC.burnToBTC(receiver, shares, false, { from: whale });

            const req = await queue.getRequest(1);
            expect(req.amount.toString()).to.equal(MAX_UINT128.toString());
            expect(req.token.toLowerCase()).to.equal(WRBTC.address.toLowerCase());
            expect(req.unwrapOnDelivery).to.equal(true);
            expect(req.receiver.toLowerCase()).to.equal(receiver.toLowerCase());
            expect((await queue.totalEscrowed(WRBTC.address)).toString()).to.equal(
                MAX_UINT128.toString()
            );
            expect(
                new BN(await web3.eth.getBalance(receiver)).sub(receiverBefore).toString()
            ).to.equal("0");

            await increaseTime(DELAY + 1);
            await queue.executeExit(1, { from: whale });
            expect(
                new BN(await web3.eth.getBalance(receiver)).sub(receiverBefore).toString()
            ).to.equal(MAX_UINT128.toString());
            expect((await queue.totalEscrowed(WRBTC.address)).toString()).to.equal("0");
        });

        it("reverts at 2^128 with the amount guard's reason and changes no state", async () => {
            const shares = await lendRbtc(ABOVE_UINT128);
            expect(shares.toString(), "one share per unit lent").to.equal(
                ABOVE_UINT128.toString()
            );

            const before = await snapshotWrbtc();
            await expectRevert(
                iWRBTC.burnToBTC(receiver, shares, false, { from: whale, gasPrice: 0 }),
                GUARD_REASON
            );
            expect(await snapshotWrbtc()).to.deep.equal(before);
            expect(before.tokenPrice, "payout equals shares burned").to.equal(wei("1", "ether"));
            expect(before.lastRequestId).to.equal("0");
            expect(before.queueWrbtc).to.equal("0");
        });
    });
});
