/**
 * Fee-sharing collector — an iWRBTC claim acts on what the redemption delivered.
 *
 * The collector holds iWRBTC, a share of the WRBTC lending pool, and pays
 * stakers by redeeming it through the pool's `burnToBTC`. The pool reports two
 * values: `gross`, what left the pool, and `delivered`, what reached the
 * receiver in the call (`gross` less a charged Perimeter fee; 0 when the
 * withdrawal delay holds the payout in the delay queue). The collector has two
 * claim paths:
 *
 *   withdraw(iWRBTC)                the pool pays the staker's receiver itself;
 *   claimAllCollectedFees, with     the pool pays the collector, which forwards
 *   iWRBTC among the RBTC tokens    the RBTC out of its own balance, the balance
 *                                   that also backs every other staker's claim.
 *
 * On both paths:
 *
 *   gross == 0                  -> succeeds, pays zero, advances the checkpoint
 *   gross > 0, delivered == 0   -> reverts "FeeSharingCollector: redemption held";
 *                                  the checkpoint stays unprocessed and the
 *                                  iWRBTC stays in the collector
 *   otherwise                   -> the receiver gets `delivered`; the
 *                                  collector's own RBTC is untouched
 *
 * The collector decodes the pair, so against a pool whose `burnToBTC` returns a
 * single word its claim reverts: the pool must report the pair before this
 * collector is live.
 *
 * Run:
 *   npx hardhat test tests/perimeter/FeeSharingCollector.delivered.test.js
 */

const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { BN } = require("@openzeppelin/test-helpers");

const TestToken = artifacts.require("TestToken");
const StakingProxy = artifacts.require("StakingProxy");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorProxy");
const FeeSharingCollectorMockup = artifacts.require("FeeSharingCollectorMockup");
const MockLoanTokenWrbtcPartialDelivery = artifacts.require("MockLoanTokenWrbtcPartialDelivery");
const MockLoanTokenWrbtcOneValueBurn = artifacts.require("MockLoanTokenWrbtcOneValueBurn");

const {
    getWRBTC,
    deployAndGetIStaking,
    getStakingModulesObject,
} = require("../Utils/initializer.js");
const mutexUtils = require("../../deployment/helpers/reentrancy/utils");
const { mineBlock } = require("../Utils/Ethereum");

const wei = web3.utils.toWei;
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
const TOTAL_SUPPLY = wei("1000", "ether");
const MAX_CHECKPOINTS = 10;

const HELD = "FeeSharingCollector: redemption held";
const FEE_BPS = 20;
const CLAIM = new BN(wei("1", "ether"));
// RBTC the collector holds for other stakers' claims.
const COLLECTOR_OWN_RBTC = new BN(wei("5", "ether"));

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
    "FeeSharingCollector — an iWRBTC claim acts on what the redemption delivered",
    (accounts) => {
        let root, staker, receiver;
        let collector, pool;

        before(async () => {
            // `receiver` never sends a transaction, so its RBTC balance changes only
            // by what a claim pays it.
            [root, staker, receiver] = accounts;
        });

        async function fixture() {
            await mutexUtils.getOrDeployMutex();

            const SOV = await TestToken.new("SOV", "SOV", 18, TOTAL_SUPPLY);
            const stakingProxy = await StakingProxy.new(SOV.address);
            const staking = await deployAndGetIStaking(
                stakingProxy.address,
                await getStakingModulesObject()
            );
            const WRBTC = await getWRBTC();

            pool = await MockLoanTokenWrbtcPartialDelivery.new();

            // The protocol pointer is read only when the collector withdraws fees
            // from the protocol, which these claims never do; the SOV address
            // stands in for it.
            const logic = await FeeSharingCollectorMockup.new(SOV.address, staking.address);
            const proxy = await FeeSharingCollectorProxy.new(SOV.address, staking.address);
            await proxy.setImplementation(logic.address);
            collector = await FeeSharingCollectorMockup.at(proxy.address);
            await collector.initialize(WRBTC.address, pool.address);

            // One staker holds all the voting power, so each checkpoint is theirs
            // in full.
            await SOV.approve(staking.address, wei("100", "ether"));
            const kickoffTS = await staking.kickoffTS.call();
            await staking.stake(wei("100", "ether"), kickoffTS.add(MAX_DURATION), staker, staker);
            await mineBlock();
        }

        beforeEach(async () => {
            await loadFixture(fixture);
        });

        /// Gives the collector a claimable iWRBTC checkpoint of `amount` against
        /// `p`, funds `p` to pay it out, and gives the collector RBTC of its own.
        async function seedClaim(p, amount) {
            await p.mintTo(collector.address, amount);
            await collector.addCheckPoint(p.address, amount);
            await web3.eth.sendTransaction({ from: root, to: p.address, value: amount });
            await web3.eth.sendTransaction({
                from: root,
                to: collector.address,
                value: COLLECTOR_OWN_RBTC,
            });
            await mineBlock();
        }

        async function snapshot(p) {
            return {
                receiver: new BN(await web3.eth.getBalance(receiver)),
                collector: new BN(await web3.eth.getBalance(collector.address)),
                checkpoint: (await collector.processedCheckpoints(staker, p.address)).toString(),
                shares: (await p.balanceOf(collector.address)).toString(),
            };
        }

        function expectClaimable(before) {
            expect(before.checkpoint, "non-vacuous: checkpoint unprocessed").to.equal("0");
            expect(before.shares, "non-vacuous: the collector holds the iWRBTC").to.equal(
                CLAIM.toString()
            );
            expect(
                before.collector.gte(COLLECTOR_OWN_RBTC),
                "the collector holds its own RBTC"
            ).to.equal(true);
        }

        function expectPaid(before, after, amount) {
            expect(after.receiver.sub(before.receiver).toString(), "receiver paid").to.equal(
                amount.toString()
            );
            expect(after.collector.toString(), "the collector's own RBTC is untouched").to.equal(
                before.collector.toString()
            );
            expect(after.checkpoint, "checkpoint advanced").to.equal("1");
            expect(after.shares, "iWRBTC redeemed").to.equal("0");
        }

        function expectNothingConsumed(before, after) {
            expect(after.checkpoint, "checkpoint unprocessed").to.equal(before.checkpoint);
            expect(after.shares, "the iWRBTC is still in the collector").to.equal(before.shares);
            expect(after.receiver.toString(), "receiver got nothing").to.equal(
                before.receiver.toString()
            );
            expect(after.collector.toString(), "the collector's own RBTC is untouched").to.equal(
                before.collector.toString()
            );
        }

        const CLAIM_PATHS = [
            {
                label: "withdraw(iWRBTC), the pool pays the receiver",
                claim: (p) =>
                    collector.trueWithdraw(p.address, MAX_CHECKPOINTS, receiver, { from: staker }),
            },
            {
                label: "claimAllCollectedFees with iWRBTC as an RBTC token, the collector forwards",
                claim: (p) =>
                    collector.claimAllCollectedFees(
                        [],
                        [p.address],
                        [],
                        MAX_CHECKPOINTS,
                        receiver,
                        {
                            from: staker,
                        }
                    ),
            },
        ];

        CLAIM_PATHS.forEach((path) => {
            describe(path.label, () => {
                it("Perimeter fee taken: the receiver gets delivered", async () => {
                    await seedClaim(pool, CLAIM);
                    await pool.setFeeBps(FEE_BPS);
                    const delivered = CLAIM.sub(CLAIM.muln(FEE_BPS).divn(10000));
                    expect(delivered.lt(CLAIM), "non-vacuous: delivered < gross").to.equal(true);

                    const before = await snapshot(pool);
                    expectClaimable(before);
                    await path.claim(pool);
                    expectPaid(before, await snapshot(pool), delivered);
                });

                it("nothing taken: the receiver gets the full amount", async () => {
                    await seedClaim(pool, CLAIM);

                    const before = await snapshot(pool);
                    expectClaimable(before);
                    await path.claim(pool);
                    expectPaid(before, await snapshot(pool), CLAIM);
                });

                it("dust (gross == 0): succeeds, pays zero, advances the checkpoint", async () => {
                    await seedClaim(pool, CLAIM);
                    await pool.setRedeemsToZero(true);

                    const before = await snapshot(pool);
                    expectClaimable(before);
                    await path.claim(pool);
                    expectPaid(before, await snapshot(pool), new BN(0));
                });

                it("held (gross > 0, delivered == 0): reverts and consumes nothing", async () => {
                    await seedClaim(pool, CLAIM);
                    await pool.setHoldAll(true);

                    const before = await snapshot(pool);
                    expectClaimable(before);
                    await expectRevertWith(path.claim(pool), `reason string '${HELD}'`);
                    expectNothingConsumed(before, await snapshot(pool));
                });
            });
        });

        describe("a pool whose burnToBTC returns a single word", () => {
            CLAIM_PATHS.forEach((path) => {
                it(`${path.label}: reverts and consumes nothing`, async () => {
                    const oneValuePool = await MockLoanTokenWrbtcOneValueBurn.new();
                    await collector.setLoanTokenWrbtc(oneValuePool.address, { from: root });
                    await seedClaim(oneValuePool, CLAIM);

                    const before = await snapshot(oneValuePool);
                    expectClaimable(before);
                    await expectRevertWith(
                        path.claim(oneValuePool),
                        "function returned an unexpected amount of data"
                    );
                    expectNothingConsumed(before, await snapshot(oneValuePool));
                });
            });
        });
    }
);
