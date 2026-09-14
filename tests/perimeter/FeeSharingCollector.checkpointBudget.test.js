/**
 * The checkpoint budget a batch claim carries is spent exactly: each token
 * subtracts the checkpoints it consumed — the difference of the end and start
 * indices, for a first claim and a returning staker alike — and a claim whose
 * range equals its budget completes.
 *
 * Run:
 *   npx hardhat test tests/perimeter/FeeSharingCollector.checkpointBudget.test.js
 */

const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { BN } = require("@openzeppelin/test-helpers");

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
    let root, staker;
    let collector, tokenA, tokenB;

    before(async () => {
        [root, staker] = accounts;
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
    }

    beforeEach(async () => {
        await loadFixture(fixture);
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

    const processed = async (token) =>
        Number(await collector.processedCheckpoints(staker, token.address));

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
});
