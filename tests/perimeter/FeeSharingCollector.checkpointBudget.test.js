/**
 * The checkpoint budget a batch claim carries is spent exactly: each token
 * subtracts the checkpoints it consumed — the difference of the end and start
 * indices, for a first claim and a returning staker alike — and a claim whose
 * range equals its budget completes.
 *
 * This also covers the skipped-checkpoint path (a returning staker whose
 * checkpoints predate their stake, so the range starts at the next positive
 * user checkpoint instead of index zero), the RBTC-based regular path (which
 * accounts checkpoints in its own loop, separate from the plain-token one),
 * and the boundary budgets: zero, and one larger than everything outstanding.
 *
 * Run:
 *   npx hardhat test tests/perimeter/FeeSharingCollector.checkpointBudget.test.js
 */

const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { BN, expectEvent } = require("@openzeppelin/test-helpers");

const TestToken = artifacts.require("TestToken");
const StakingProxy = artifacts.require("StakingProxy");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorProxy");
const FeeSharingCollectorMockup = artifacts.require("FeeSharingCollectorMockup");
const MockLoanTokenWrbtcPartialDelivery = artifacts.require("MockLoanTokenWrbtcPartialDelivery");

const {
    getWRBTC,
    deployAndGetIStaking,
    getStakingModulesObject,
} = require("../Utils/initializer.js");
const mutexUtils = require("../../deployment/helpers/reentrancy/utils");
const { mineBlock, increaseTime } = require("../Utils/Ethereum");

/** The collector opens a new checkpoint only once this long has passed since the last. */
const CHECKPOINT_INTERVAL = 172800;

const wei = web3.utils.toWei;
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
const TOTAL_SUPPLY = wei("1000", "ether");

contract("FeeSharingCollector — the batch claim's checkpoint budget", (accounts) => {
    let root, staker, latecomer;
    let collector, tokenA, tokenB, WRBTC, staking, SOV, RBTC_DUMMY;

    before(async () => {
        [root, staker, latecomer] = accounts;
    });

    async function fixture() {
        await mutexUtils.getOrDeployMutex();
        SOV = await TestToken.new("SOV", "SOV", 18, TOTAL_SUPPLY);
        const stakingProxy = await StakingProxy.new(SOV.address);
        staking = await deployAndGetIStaking(
            stakingProxy.address,
            await getStakingModulesObject()
        );
        WRBTC = await getWRBTC();
        const pool = await MockLoanTokenWrbtcPartialDelivery.new();
        const logic = await FeeSharingCollectorMockup.new(SOV.address, staking.address);
        const proxy = await FeeSharingCollectorProxy.new(SOV.address, staking.address);
        await proxy.setImplementation(logic.address);
        collector = await FeeSharingCollectorMockup.at(proxy.address);
        await collector.initialize(WRBTC.address, pool.address);
        tokenA = await TestToken.new("A", "A", 18, TOTAL_SUPPLY);
        tokenB = await TestToken.new("B", "B", 18, TOTAL_SUPPLY);
        await SOV.approve(staking.address, wei("100", "ether"));
        const kickoffTS = await staking.kickoffTS.call();
        await staking.stake(wei("100", "ether"), kickoffTS.add(MAX_DURATION), staker, staker);
        await mineBlock();
        // Funds `root` with WRBTC so the RBTC-based checkpoint helper can fund the
        // collector the same way the plain-token helper does.
        await WRBTC.deposit({ from: root, value: wei("50", "ether") });
    }

    beforeEach(async () => {
        await loadFixture(fixture);
        RBTC_DUMMY = await collector.RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT();
    });

    /** `count` checkpoints on `token`, each backed by tokens the collector holds. */
    async function checkpoint(token, count) {
        for (let i = 0; i < count; i++) {
            await increaseTime(CHECKPOINT_INTERVAL + 1);
            await token.transfer(collector.address, wei("1", "ether"), { from: root });
            await collector.addCheckPoint(token.address, wei("1", "ether"));
            await mineBlock();
        }
    }

    /** `count` checkpoints on the RBTC dummy token, each backed by real RBTC the collector holds. */
    async function checkpointRBTC(count) {
        for (let i = 0; i < count; i++) {
            await increaseTime(CHECKPOINT_INTERVAL + 1);
            await collector.transferRBTC({ from: root, value: wei("1", "ether") });
            await mineBlock();
        }
    }

    /** Stakes a second, later user so their claim range starts after some checkpoints already exist. */
    async function stakeLatecomer(amountEther) {
        const amount = wei(String(amountEther), "ether");
        await SOV.approve(staking.address, amount, { from: root });
        const kickoffTS = await staking.kickoffTS.call();
        await staking.stake(amount, kickoffTS.add(MAX_DURATION), latecomer, latecomer);
        await mineBlock();
    }

    const processed = async (token) =>
        Number(await collector.processedCheckpoints(staker, token.address));

    const processedFor = async (user, tokenAddress) =>
        Number(await collector.processedCheckpoints(user, tokenAddress));

    it("spends the budget exactly across tokens for a returning staker", async () => {
        // A first claim on token A, so the staker's starting index on it is above zero.
        await checkpoint(tokenA, 3);
        await collector.claimAllCollectedFees([tokenA.address], [], [], 10, staker, {
            from: staker,
        });
        expect(await processed(tokenA)).to.equal(3);

        // New checkpoints on both tokens, then a batch claim with a budget of 5.
        await checkpoint(tokenA, 2);
        await checkpoint(tokenB, 5);
        await collector.claimAllCollectedFees(
            [tokenA.address, tokenB.address],
            [],
            [],
            5,
            staker,
            { from: staker }
        );

        // Token A consumed checkpoints 3..5, two of the five; token B gets the other three.
        expect(await processed(tokenA)).to.equal(5);
        expect(await processed(tokenB)).to.equal(3);
    });

    it("completes a returning staker's claim whose range equals its whole budget", async () => {
        await checkpoint(tokenA, 3);
        await collector.claimAllCollectedFees([tokenA.address], [], [], 10, staker, {
            from: staker,
        });
        await checkpoint(tokenA, 2);
        // A budget of exactly the two new checkpoints: counting one more would
        // drive the remaining budget below zero and revert the claim.
        await collector.claimAllCollectedFees([tokenA.address], [], [], 2, staker, {
            from: staker,
        });
        expect(await processed(tokenA)).to.equal(5);
    });

    it("counts a first-time claim by the index difference alone", async () => {
        await checkpoint(tokenA, 2);
        await checkpoint(tokenB, 5);
        await collector.claimAllCollectedFees(
            [tokenA.address, tokenB.address],
            [],
            [],
            5,
            staker,
            { from: staker }
        );
        expect(await processed(tokenA)).to.equal(2);
        expect(await processed(tokenB)).to.equal(3);
    });

    it("splits a token's range across two claims with nothing paid twice and nothing skipped", async () => {
        await checkpoint(tokenA, 5);

        // First claim spends less than the full range.
        await collector.claimAllCollectedFees([tokenA.address], [], [], 2, staker, {
            from: staker,
        });
        expect(await processed(tokenA)).to.equal(2);

        // Second claim resumes exactly where the first left off and finishes the range.
        const tx = await collector.claimAllCollectedFees([tokenA.address], [], [], 10, staker, {
            from: staker,
        });
        expect(await processed(tokenA)).to.equal(5);
        expectEvent(tx, "UserFeeWithdrawn", {
            sender: staker,
            token: tokenA.address,
            // The 3 remaining checkpoints, each worth 1 ether to the sole staker.
            amount: wei("3", "ether"),
        });
    });

    it("spends the budget exactly across RBTC-based tokens for a returning staker", async () => {
        // A first claim on the RBTC dummy token, so the staker's starting index on it is above zero.
        await checkpointRBTC(3);
        await collector.claimAllCollectedFees([], [RBTC_DUMMY], [], 10, staker, {
            from: staker,
        });
        expect(await processedFor(staker, RBTC_DUMMY)).to.equal(3);

        // New checkpoints on both RBTC-based tokens, then a batch claim with a budget of 5.
        await checkpointRBTC(2);
        await checkpoint(WRBTC, 5);
        const tx = await collector.claimAllCollectedFees(
            [],
            [RBTC_DUMMY, WRBTC.address],
            [],
            5,
            staker,
            { from: staker }
        );

        // The RBTC dummy token consumed checkpoints 3..5, two of the five; WRBTC gets the other three.
        expect(await processedFor(staker, RBTC_DUMMY)).to.equal(5);
        expect(await processedFor(staker, WRBTC.address)).to.equal(3);
        expectEvent(tx, "RBTCWithdrawn", {
            sender: staker,
            receiver: staker,
            amount: wei("5", "ether"),
        });
    });

    it("completes a returning staker's RBTC-based claim whose range equals its whole budget", async () => {
        await checkpointRBTC(3);
        await collector.claimAllCollectedFees([], [RBTC_DUMMY], [], 10, staker, {
            from: staker,
        });
        await checkpointRBTC(2);
        // A budget of exactly the two new checkpoints: counting one more would
        // drive the remaining budget below zero and revert the claim.
        await collector.claimAllCollectedFees([], [RBTC_DUMMY], [], 2, staker, {
            from: staker,
        });
        expect(await processedFor(staker, RBTC_DUMMY)).to.equal(5);
    });

    it("completes a skipped-checkpoint claim whose budget equals its range", async () => {
        // Checkpoints exist before the returning staker (latecomer) had any stake.
        await checkpoint(tokenA, 3);
        // A stake equal to the existing staker's splits every later checkpoint 50/50.
        await stakeLatecomer(100);
        // Checkpoints created after the stake: latecomer's claimable range.
        await checkpoint(tokenA, 2);

        const nextPositive = await collector.getNextPositiveUserCheckpoint(
            latecomer,
            tokenA.address,
            0,
            1000
        );
        expect(nextPositive.checkpointNum.toNumber()).to.equal(4);

        const tx = await collector.claimAllCollectedFees(
            [],
            [],
            [
                {
                    tokenAddress: tokenA.address,
                    fromCheckpoint: nextPositive.checkpointNum.toNumber(),
                },
            ],
            2, // exactly the 2-checkpoint range
            latecomer,
            { from: latecomer }
        );

        expectEvent(tx, "UserFeeWithdrawn", {
            sender: latecomer,
            token: tokenA.address,
            amount: wei("1", "ether"), // 2 checkpoints * 0.5 ether share
        });
        expect(await processedFor(latecomer, tokenA.address)).to.equal(5);
    });

    it("a skipped-checkpoint claim with a smaller budget than its range resumes on the regular path without paying any checkpoint twice", async () => {
        await checkpoint(tokenA, 3);
        await stakeLatecomer(100);
        // A range of 5 checkpoints once the stake starts counting.
        await checkpoint(tokenA, 5);

        const nextPositive = await collector.getNextPositiveUserCheckpoint(
            latecomer,
            tokenA.address,
            0,
            1000
        );
        expect(nextPositive.checkpointNum.toNumber()).to.equal(4);

        // Budget smaller than the 5-checkpoint range: the claim stops partway through.
        const tx1 = await collector.claimAllCollectedFees(
            [],
            [],
            [
                {
                    tokenAddress: tokenA.address,
                    fromCheckpoint: nextPositive.checkpointNum.toNumber(),
                },
            ],
            2,
            latecomer,
            { from: latecomer }
        );
        expect(await processedFor(latecomer, tokenA.address)).to.equal(5);
        expectEvent(tx1, "UserFeeWithdrawn", {
            sender: latecomer,
            token: tokenA.address,
            amount: wei("1", "ether"), // 2 checkpoints * 0.5 ether
        });

        // The remaining 3 checkpoints are now a contiguous, un-skipped range from
        // latecomer's own processed-checkpoint position: the next claim uses the
        // regular (non-skipped) path and finishes them.
        const tx2 = await collector.claimAllCollectedFees(
            [tokenA.address],
            [],
            [],
            10,
            latecomer,
            { from: latecomer }
        );
        expect(await processedFor(latecomer, tokenA.address)).to.equal(8);
        expectEvent(tx2, "UserFeeWithdrawn", {
            sender: latecomer,
            token: tokenA.address,
            amount: wei("1.5", "ether"), // 3 checkpoints * 0.5 ether
        });

        // The 3 pre-stake checkpoints were skipped irreversibly: total paid is the
        // 5-checkpoint post-stake range, never the whole 8-checkpoint history.
    });

    it("a skipped-checkpoint claim over an RBTC-based token with a smaller budget than its range resumes without paying any checkpoint twice", async () => {
        await checkpoint(WRBTC, 3);
        await stakeLatecomer(100);
        await checkpoint(WRBTC, 5);

        const nextPositive = await collector.getNextPositiveUserCheckpoint(
            latecomer,
            WRBTC.address,
            0,
            1000
        );
        expect(nextPositive.checkpointNum.toNumber()).to.equal(4);

        const tx1 = await collector.claimAllCollectedFees(
            [],
            [],
            [
                {
                    tokenAddress: WRBTC.address,
                    fromCheckpoint: nextPositive.checkpointNum.toNumber(),
                },
            ],
            2,
            latecomer,
            { from: latecomer }
        );
        expect(await processedFor(latecomer, WRBTC.address)).to.equal(5);
        expectEvent(tx1, "RBTCWithdrawn", {
            sender: latecomer,
            receiver: latecomer,
            amount: wei("1", "ether"),
        });

        const tx2 = await collector.claimAllCollectedFees([], [WRBTC.address], [], 10, latecomer, {
            from: latecomer,
        });
        expect(await processedFor(latecomer, WRBTC.address)).to.equal(8);
        expectEvent(tx2, "RBTCWithdrawn", {
            sender: latecomer,
            receiver: latecomer,
            amount: wei("1.5", "ether"),
        });
    });

    it("a zero budget claims nothing on either regular path in the same call", async () => {
        await checkpoint(tokenA, 3);
        await checkpointRBTC(3);

        await collector.claimAllCollectedFees([tokenA.address], [RBTC_DUMMY], [], 0, staker, {
            from: staker,
        });

        expect(await processed(tokenA)).to.equal(0);
        expect(await processedFor(staker, RBTC_DUMMY)).to.equal(0);
    });

    it("a budget larger than everything outstanding claims exactly what's outstanding on both regular paths", async () => {
        await checkpoint(tokenA, 3);
        await checkpointRBTC(4);

        const tx = await collector.claimAllCollectedFees(
            [tokenA.address],
            [RBTC_DUMMY],
            [],
            1000000,
            staker,
            { from: staker }
        );

        expect(await processed(tokenA)).to.equal(3);
        expect(await processedFor(staker, RBTC_DUMMY)).to.equal(4);
        expectEvent(tx, "UserFeeWithdrawn", {
            sender: staker,
            token: tokenA.address,
            amount: wei("3", "ether"),
        });
        expectEvent(tx, "RBTCWithdrawn", {
            sender: staker,
            receiver: staker,
            amount: wei("4", "ether"),
        });
    });
});
