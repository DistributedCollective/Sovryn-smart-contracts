/**
 * Fee-sharing collector — claims redeemed against the real WRBTC lending pool.
 *
 * The collector holds iWRBTC, a share of the WRBTC lending pool, and pays
 * stakers by redeeming it through the pool's `burnToBTC`. Here the collector's
 * logic runs behind the collector proxy and redeems against a real
 * `LoanTokenLogicWrbtcLM` pool. The Perimeter fee and the withdrawal delay are
 * armed through the mock controller, and a held payout is escrowed in the mock
 * queue. The pool's own fee leg and escrow run, so every effect of a claim is
 * observable: the staker's receiver, the collector's RBTC, WRBTC and iWRBTC,
 * the fee receiver, the queue's request count and the staker's checkpoints.
 *
 *   claimAllCollectedFees over RBTC, WRBTC and iWRBTC, fee charged, no hold
 *       -> the receiver gets the RBTC leg, the WRBTC leg and what the pool
 *          delivered (gross less the fee); the collector keeps exactly its
 *          own RBTC and WRBTC
 *   claimAllCollectedFees over skipped iWRBTC checkpoints, payout held
 *       -> reverts; neither the skip nor the checkpoint is written, the iWRBTC
 *          stays in the collector, no fee is paid and no queue request is left
 *   withdraw(iWRBTC), payout held
 *       -> reverts; the fee the pool paid and the request it wrote are undone
 *
 * Each held case ends with a wallet burning iWRBTC in the same configuration.
 * That burn pays the fee and writes a request, so an unchanged fee receiver and
 * request count after the collector's claim are the revert undoing both.
 *
 * Run:
 *   npx hardhat test tests/perimeter/FeeSharingCollector.realPool.test.js
 */

const { expect } = require("chai");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
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
const TestToken = artifacts.require("TestToken");
const StakingProxy = artifacts.require("StakingProxy");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorProxy");
const FeeSharingCollectorMockup = artifacts.require("FeeSharingCollectorMockup");

const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getLoanTokenLogicWrbtc,
    getPriceFeeds,
    getSovryn,
    getSOV,
    linkIfUsed,
    deployAndGetIStaking,
    getStakingModulesObject,
} = require("../Utils/initializer.js");
const mutexUtils = require("../../deployment/helpers/reentrancy/utils");
const { mineBlock } = require("../Utils/Ethereum");

const wei = web3.utils.toWei;
const MIN_DELAY = 60;
const DELAY = 3600;
const FEE_BPS = 20;
const MAX_CHECKPOINTS = 10;
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
/** The collector writes a second checkpoint of one token only this long after
 *  the first (FEE_WITHDRAWAL_INTERVAL); sooner, the amount waits for the next. */
const CHECKPOINT_SPACING_SECONDS = 172800;
const HELD = "FeeSharingCollector: redemption held";

/** RBTC lent into the pool for each iWRBTC checkpoint the collector holds. */
const IWRBTC_CHECKPOINT_RBTC = new BN(wei("1", "ether"));
const RBTC_LEG = new BN(wei("0.3", "ether"));
const WRBTC_LEG = new BN(wei("0.2", "ether"));
// What the collector holds for other stakers' claims, beside the legs.
const COLLECTOR_OWN_RBTC = new BN(wei("5", "ether"));
const COLLECTOR_OWN_WRBTC = new BN(wei("4", "ether"));

/// Asserts that `promise` reverts and that the error message carries `text`.
async function expectRevertWith(promise, text) {
    try {
        await promise;
    } catch (error) {
        expect(error.message, "revert reason").to.include(text);
        return;
    }
    expect.fail(`expected a revert carrying "${text}"`);
}

contract(
    "FeeSharingCollector — claims redeemed against the real WRBTC lending pool",
    (accounts) => {
        let lender, wallet, feeReceiver, funder, receiver, staker, lateStaker;
        let WRBTC, sovryn, iWRBTC, controller, queue, staking, collector, kickoffTS, RBTC_DUMMY;

        before(async () => {
            // `feeReceiver` and `receiver` never send a transaction, so their RBTC
            // balances change only by what the pool and the collector pay them.
            [lender, wallet, feeReceiver, funder, receiver, staker, lateStaker] = accounts;
            const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
            await linkIfUsed(SwapsImplSovrynSwap, swapsImplSovrynSwapLib);
        });

        async function fixture() {
            await mutexUtils.getOrDeployMutex();

            const SUSD = await getSUSD();
            const RBTC = await getRBTC();
            WRBTC = await getWRBTC();
            const BZRX = await getBZRX();
            const priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
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

            // iWRBTC: the WRBTC pool, paying natively through burnToBTC.
            const [iWRBTCLogic, iWRBTCBeacon] = await getLoanTokenLogicWrbtc();
            let pool = await LoanToken.new(
                lender,
                iWRBTCLogic.address,
                sovryn.address,
                WRBTC.address
            );
            await pool.initialize(WRBTC.address, "iWRBTC", "iWRBTC");
            const params = [
                "0x0000000000000000000000000000000000000000000000000000000000000000",
                false,
                lender,
                WRBTC.address,
                SUSD.address,
                wei("20", "ether"),
                wei("15", "ether"),
                2419200,
            ];
            pool = await ILoanTokenLogicProxy.at(pool.address);
            await pool.setBeaconAddress(iWRBTCBeacon.address);
            pool = await ILoanTokenModules.at(pool.address);
            await pool.setupLoanParams([params], false);
            await sovryn.setLoanPool([pool.address], [WRBTC.address]);
            iWRBTC = pool;

            // Perimeter fee and withdrawal delay both off; each test arms what its
            // situation needs.
            controller = await MockExitFeeController.new();
            await controller.setExitFeeEnabledTest(false);
            await controller.setActive(true);
            await controller.setRate(FEE_BPS);
            await controller.setFeeReceiverTest(feeReceiver);
            await controller.setSecurityPerimeterEnabledTest(false);
            await controller.setGlobalDelaySecondsTest(DELAY);
            await sovryn.setExitFeeController(controller.address, { from: lender });
            queue = await MockExitDelayQueue.new(WRBTC.address, MIN_DELAY);
            await queue.setAllowedSource(iWRBTC.address, true);
            await sovryn.setExitDelayQueue(queue.address, { from: lender });

            // The collector's logic behind its proxy. The protocol pointer is read
            // only when the collector withdraws fees from the protocol, which these
            // claims never do; the SOV address stands in for it.
            const SOV = await TestToken.new("SOV", "SOV", 18, wei("1000", "ether"));
            const stakingProxy = await StakingProxy.new(SOV.address);
            staking = await deployAndGetIStaking(
                stakingProxy.address,
                await getStakingModulesObject()
            );
            const logic = await FeeSharingCollectorMockup.new(SOV.address, staking.address);
            const proxy = await FeeSharingCollectorProxy.new(SOV.address, staking.address);
            await proxy.setImplementation(logic.address);
            collector = await FeeSharingCollectorMockup.at(proxy.address);
            await collector.initialize(WRBTC.address, iWRBTC.address);
            RBTC_DUMMY = await collector.RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT();

            // `staker` holds all the voting power at every checkpoint seeded before
            // `lateStaker` stakes.
            await SOV.approve(staking.address, wei("200", "ether"));
            kickoffTS = await staking.kickoffTS.call();
            await staking.stake(wei("100", "ether"), kickoffTS.add(MAX_DURATION), staker, staker);
            await mineBlock();

            // Liquidity beside the collector's, and the iWRBTC the wallet burns.
            await iWRBTC.mintWithBTC(wallet, false, { from: wallet, value: wei("2", "ether") });
        }

        beforeEach(async () => {
            await loadFixture(fixture);
        });

        /// Lends RBTC into the pool on the collector's behalf and checkpoints the
        /// iWRBTC minted; returns the shares.
        async function seedIwrbtcCheckpoint() {
            const held = await iWRBTC.balanceOf(collector.address);
            await iWRBTC.mintWithBTC(collector.address, false, {
                from: funder,
                value: IWRBTC_CHECKPOINT_RBTC,
            });
            const minted = (await iWRBTC.balanceOf(collector.address)).sub(held);
            await collector.addCheckPoint(iWRBTC.address, minted);
            await mineBlock();
            return minted;
        }

        async function seedRbtcCheckpoint() {
            await collector.transferRBTC({ from: funder, value: RBTC_LEG });
            await mineBlock();
        }

        /// WRBTC for a checkpoint and the collector's own WRBTC, wrapped from real
        /// RBTC so the collector's unwrap draws on real backing.
        async function seedWrbtcCheckpoint() {
            const total = WRBTC_LEG.add(COLLECTOR_OWN_WRBTC);
            await WRBTC.deposit({ from: funder, value: total });
            await WRBTC.transfer(collector.address, total, { from: funder });
            await collector.addCheckPoint(WRBTC.address, WRBTC_LEG);
            await mineBlock();
        }

        async function giveCollectorOwnRbtc() {
            await web3.eth.sendTransaction({
                from: funder,
                to: collector.address,
                value: COLLECTOR_OWN_RBTC,
            });
        }

        const armFee = () => controller.setExitFeeEnabledTest(true);
        const armDelay = () => controller.setSecurityPerimeterEnabledTest(true);

        /// Every balance, checkpoint and count a claim can move, as strings.
        async function snapshot(who) {
            return {
                receiver: await web3.eth.getBalance(receiver),
                collectorRbtc: await web3.eth.getBalance(collector.address),
                collectorWrbtc: (await WRBTC.balanceOf(collector.address)).toString(),
                collectorIwrbtc: (await iWRBTC.balanceOf(collector.address)).toString(),
                feeReceiver: await web3.eth.getBalance(feeReceiver),
                poolWrbtc: (await WRBTC.balanceOf(iWRBTC.address)).toString(),
                checkpointRbtc: (await collector.processedCheckpoints(who, RBTC_DUMMY)).toString(),
                checkpointWrbtc: (
                    await collector.processedCheckpoints(who, WRBTC.address)
                ).toString(),
                checkpointIwrbtc: (
                    await collector.processedCheckpoints(who, iWRBTC.address)
                ).toString(),
                queueRequests: (await queue.lastRequestId()).toString(),
            };
        }

        /// `minuend[field] - subtrahend[field]` as a BN.
        const difference = (minuend, subtrahend, field) =>
            new BN(minuend[field]).sub(new BN(subtrahend[field]));

        /// A wallet burns its iWRBTC in the configuration a held claim ran in: the
        /// pool pays the Perimeter fee and writes a queue request for the net, which
        /// is what it did inside the collector's reverted claim.
        async function expectWalletBurnChargedAndHeld() {
            const shares = await iWRBTC.balanceOf(wallet);
            const before = await snapshot(wallet);
            await iWRBTC.burnToBTC(wallet, shares, false, { from: wallet });
            const after = await snapshot(wallet);

            const gross = difference(before, after, "poolWrbtc");
            const fee = difference(after, before, "feeReceiver");
            expect(fee.gtn(0), "the pool pays the Perimeter fee in this configuration").to.equal(
                true
            );
            expect(fee.toString(), "at the armed rate").to.equal(
                gross.muln(FEE_BPS).divn(10000).toString()
            );
            expect(
                difference(after, before, "queueRequests").toString(),
                "and writes one queue request"
            ).to.equal("1");
            const request = await queue.getRequest(after.queueRequests);
            expect(request.originator.toLowerCase(), "under the burner's name").to.equal(
                wallet.toLowerCase()
            );
            expect(request.amount.toString(), "for the net").to.equal(gross.sub(fee).toString());
        }

        describe("claimAllCollectedFees over RBTC, WRBTC and iWRBTC, with the Perimeter fee charged", () => {
            it("pays the receiver the RBTC leg, the WRBTC leg and what the pool delivered, and leaves the collector exactly its own RBTC and WRBTC", async () => {
                const shares = await seedIwrbtcCheckpoint();
                await seedRbtcCheckpoint();
                await seedWrbtcCheckpoint();
                await giveCollectorOwnRbtc();
                await armFee();

                // Each leg is the staker's in full, and the collector holds its own
                // RBTC and WRBTC beside the legs.
                expect(
                    (await collector.getAccumulatedFees(staker, RBTC_DUMMY)).toString(),
                    "the RBTC leg is claimable"
                ).to.equal(RBTC_LEG.toString());
                expect(
                    (await collector.getAccumulatedFees(staker, WRBTC.address)).toString(),
                    "the WRBTC leg is claimable"
                ).to.equal(WRBTC_LEG.toString());
                expect(
                    (await collector.getAccumulatedFees(staker, iWRBTC.address)).toString(),
                    "the iWRBTC leg is claimable"
                ).to.equal(shares.toString());
                const before = await snapshot(staker);
                expect(before.collectorRbtc).to.equal(COLLECTOR_OWN_RBTC.add(RBTC_LEG).toString());
                expect(before.collectorWrbtc).to.equal(
                    COLLECTOR_OWN_WRBTC.add(WRBTC_LEG).toString()
                );

                await collector.claimAllCollectedFees(
                    [],
                    [RBTC_DUMMY, WRBTC.address, iWRBTC.address],
                    [],
                    MAX_CHECKPOINTS,
                    receiver,
                    { from: staker }
                );
                const after = await snapshot(staker);

                const gross = difference(before, after, "poolWrbtc");
                const fee = difference(after, before, "feeReceiver");
                const delivered = gross.sub(fee);
                expect(gross.gtn(0), "the pool paid out").to.equal(true);
                expect(fee.gtn(0), "a Perimeter fee was charged").to.equal(true);
                expect(fee.toString(), "at the armed rate").to.equal(
                    gross.muln(FEE_BPS).divn(10000).toString()
                );
                expect(
                    difference(after, before, "receiver").toString(),
                    "the RBTC leg + the WRBTC leg + delivered"
                ).to.equal(RBTC_LEG.add(WRBTC_LEG).add(delivered).toString());
                expect(after.collectorRbtc, "the collector's own RBTC").to.equal(
                    COLLECTOR_OWN_RBTC.toString()
                );
                expect(after.collectorWrbtc, "the collector's own WRBTC").to.equal(
                    COLLECTOR_OWN_WRBTC.toString()
                );
                expect(after.collectorIwrbtc, "the iWRBTC is redeemed").to.equal("0");
                expect(
                    [after.checkpointRbtc, after.checkpointWrbtc, after.checkpointIwrbtc],
                    "every leg's checkpoint advances"
                ).to.deep.equal(["1", "1", "1"]);
                expect(after.queueRequests, "nothing is queued").to.equal(before.queueRequests);
            });
        });

        describe("claimAllCollectedFees over skipped iWRBTC checkpoints, with the payout held", () => {
            /// Checkpoint 1 is written before `lateStaker` stakes and checkpoint 2
            /// after, so `lateStaker` claims from checkpoint 2 and skips checkpoint 1.
            async function seedSkippedRange() {
                await seedIwrbtcCheckpoint();
                await staking.stake(
                    wei("50", "ether"),
                    kickoffTS.add(MAX_DURATION),
                    lateStaker,
                    lateStaker
                );
                await mineBlock();
                await time.increase(CHECKPOINT_SPACING_SECONDS + 1);
                await mineBlock();
                await seedIwrbtcCheckpoint();
                await giveCollectorOwnRbtc();
            }
            const claimFromCheckpoint2 = () =>
                collector.claimAllCollectedFees(
                    [],
                    [],
                    [[iWRBTC.address, 2]],
                    MAX_CHECKPOINTS,
                    receiver,
                    { from: lateStaker }
                );

            it("reverts, writes neither the skip nor the checkpoint, keeps the iWRBTC, pays no fee and leaves no queue request", async () => {
                await seedSkippedRange();
                await armFee();
                await armDelay();

                const before = await snapshot(lateStaker);
                expect(before.checkpointIwrbtc, "nothing processed yet").to.equal("0");
                expect(
                    new BN(before.collectorIwrbtc).gtn(0),
                    "the collector holds iWRBTC"
                ).to.equal(true);

                await expectRevertWith(claimFromCheckpoint2(), HELD);
                const after = await snapshot(lateStaker);
                expect(
                    after.checkpointIwrbtc,
                    "neither the skip nor the checkpoint is written"
                ).to.equal("0");
                expect(after.collectorIwrbtc, "the iWRBTC stays in the collector").to.equal(
                    before.collectorIwrbtc
                );
                expect(after.feeReceiver, "no fee is left paid").to.equal(before.feeReceiver);
                expect(after.queueRequests, "no queue request is left").to.equal(
                    before.queueRequests
                );
                expect(after, "nothing else moves").to.deep.equal(before);

                await expectWalletBurnChargedAndHeld();

                // The range stays claimable: with the payout no longer held, the same
                // claim pays and processes through checkpoint 2.
                await controller.setSecurityPerimeterEnabledTest(false);
                const retryBefore = await snapshot(lateStaker);
                await claimFromCheckpoint2();
                const retryAfter = await snapshot(lateStaker);
                const gross = difference(retryBefore, retryAfter, "poolWrbtc");
                const fee = difference(retryAfter, retryBefore, "feeReceiver");
                expect(fee.gtn(0), "the claim is charged the Perimeter fee").to.equal(true);
                expect(
                    difference(retryAfter, retryBefore, "receiver").toString(),
                    "the receiver gets gross less the fee"
                ).to.equal(gross.sub(fee).toString());
                expect(retryAfter.checkpointIwrbtc).to.equal("2");
            });
        });

        describe("withdraw(iWRBTC), with the payout held", () => {
            it("reverts, and undoes the fee the pool paid and the queue request it wrote", async () => {
                await seedIwrbtcCheckpoint();
                await giveCollectorOwnRbtc();
                await armFee();
                await armDelay();

                const before = await snapshot(staker);
                expect(before.checkpointIwrbtc, "the checkpoint is unprocessed").to.equal("0");
                expect(
                    new BN(before.collectorIwrbtc).gtn(0),
                    "the collector holds iWRBTC"
                ).to.equal(true);

                // `trueWithdraw` is the mockup's route to the collector's own `withdraw`.
                await expectRevertWith(
                    collector.trueWithdraw(iWRBTC.address, MAX_CHECKPOINTS, receiver, {
                        from: staker,
                    }),
                    HELD
                );
                const after = await snapshot(staker);
                expect(after.feeReceiver, "the fee payment is undone").to.equal(
                    before.feeReceiver
                );
                expect(after.queueRequests, "the queue request is undone").to.equal(
                    before.queueRequests
                );
                expect(after.checkpointIwrbtc, "the checkpoint stays unprocessed").to.equal("0");
                expect(after.collectorIwrbtc, "the iWRBTC stays in the collector").to.equal(
                    before.collectorIwrbtc
                );
                expect(after, "nothing else moves").to.deep.equal(before);

                await expectWalletBurnChargedAndHeld();
            });
        });
    }
);
