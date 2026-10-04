const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { BN, expectRevert } = require("@openzeppelin/test-helpers");
const { mineBlock } = require("../Utils/Ethereum");

const Collector = artifacts.require("FeeSharingCollector");
const CollectorProxy = artifacts.require("FeeSharingCollectorProxy");
const StakingProxy = artifacts.require("StakingProxy");
const ModulesProxy = artifacts.require("ModulesProxy");
const IStaking = artifacts.require("IStaking");
const Token = artifacts.require("TestToken");
const MODULES = [
    "StakingAdminModule",
    "StakingStakeModule",
    "StakingWithdrawModule",
    "WeightedStakingModule",
    "StakingGovernanceModule",
    "StakingVestingModule",
    "StakingStorageModule",
].map((name) => artifacts.require(name));
const TWO_WEEKS = 1209600;
const INTERVAL = 172800;
const MAX_DURATION = 1092 * 86400;
const amount = (n) => new BN(web3.utils.toWei(String(n), "ether"));

contract("FeeSharingCollector exact stake snapshots", ([owner, alice, bob, newcomer]) => {
    async function fixture() {
        const sov = await Token.new("Stake", "SOV", 18, 0);
        const fee = await Token.new("Fees", "FEE", 18, 1000000);
        const stakingProxy = await StakingProxy.new(sov.address);
        const registry = await ModulesProxy.new();
        await stakingProxy.setImplementation(registry.address);
        const modules = [];
        for (const Module of MODULES) modules.push((await Module.new()).address);
        await (await ModulesProxy.at(stakingProxy.address)).addModules(modules);
        const staking = await IStaking.at(stakingProxy.address);
        const implementation = await Collector.new();
        const proxy = await CollectorProxy.new(sov.address, staking.address);
        await proxy.setImplementation(implementation.address);
        const collector = await Collector.at(proxy.address);
        await staking.setFeeSharing(collector.address);
        const until = (await staking.kickoffTS()).add(new BN(MAX_DURATION));
        const f = { sov, fee, staking, collector, until };
        await stake(f, alice, 10);
        await stake(f, bob, 100);
        await fee.approve(collector.address, 1000000);
        await mineBlock();
        return f;
    }

    async function stake(f, user, n, until = f.until) {
        await f.sov.mint(user, amount(n));
        await f.sov.approve(f.staking.address, amount(n), { from: user });
        await f.staking.stake(amount(n), until, user, user, { from: user });
    }

    async function feeCheckpoint(f, n = 1100, delay = 0) {
        if (delay) await time.increase(delay);
        await f.collector.transferTokens(f.fee.address, n);
        await mineBlock();
        const count = await f.collector.totalTokenCheckpoints(f.fee.address);
        return f.collector.tokenCheckpoints(f.fee.address, count.subn(1));
    }

    async function withdrawStake(f) {
        await f.staking.unlockAllTokens();
        await f.staking.withdraw(amount(10), f.until, alice, { from: alice });
    }

    async function withdrawnFixture() {
        const f = await fixture();
        const first = await feeCheckpoint(f);
        await withdrawStake(f);
        const second = await feeCheckpoint(f, 1100, INTERVAL + 1);
        expect(first.blockNumber).bignumber.not.equal(second.blockNumber);
        expect(await f.staking.timestampToLockDate(first.timestamp)).bignumber.equal(
            await f.staking.timestampToLockDate(second.timestamp)
        );
        return f;
    }

    // Independent per-checkpoint oracle: never reuse a weight across snapshots.
    async function expectedFees(f, user, from = 0, count = 100) {
        const total = (await f.collector.totalTokenCheckpoints(f.fee.address)).toNumber();
        let result = new BN(0);
        for (let i = from; i < Math.min(total, from + count); i++) {
            const cp = await f.collector.tokenCheckpoints(f.fee.address, i);
            const weight = await f.staking.getPriorWeightedStake(
                user,
                cp.blockNumber.subn(1),
                cp.timestamp
            );
            result = result.add(cp.numTokens.mul(weight).div(cp.totalWeightedStake));
        }
        return result;
    }

    it("quotes each historical stake after a withdrawal in the same date bucket", async () => {
        const f = await loadFixture(withdrawnFixture);
        expect(await expectedFees(f, alice)).bignumber.equal(new BN(100));
        expect(await f.collector.getAccumulatedFees(alice, f.fee.address)).bignumber.equal(
            new BN(100)
        );
    });

    it("pays both stakers their exact shares without exhausting another user's claim", async () => {
        const f = await loadFixture(withdrawnFixture);
        await f.collector.withdraw(f.fee.address, 2, alice, { from: alice });
        let secondClaimError;
        try {
            await f.collector.withdraw(f.fee.address, 2, bob, { from: bob });
        } catch (error) {
            secondClaimError = error;
        }
        const firstPaid = await f.fee.balanceOf(alice);
        const secondPaid = await f.fee.balanceOf(bob);
        console.log(
            "snapshot payouts",
            firstPaid.toString(),
            secondPaid.toString(),
            !!secondClaimError
        );
        expect(firstPaid).bignumber.equal(new BN(100));
        expect(secondClaimError).equal(undefined);
        expect(secondPaid).bignumber.equal(new BN(2100));
        expect(await f.fee.balanceOf(f.collector.address)).bignumber.equal(new BN(0));
    });

    it("uses the increased stake at the later block in the same bucket", async () => {
        const f = await loadFixture(fixture);
        await feeCheckpoint(f);
        await stake(f, alice, 90);
        await feeCheckpoint(f, 1100, INTERVAL + 1);
        expect(await expectedFees(f, alice)).bignumber.equal(new BN(650));
        expect(await f.collector.getAccumulatedFees(alice, f.fee.address)).bignumber.equal(
            new BN(650)
        );
        await f.collector.withdraw(f.fee.address, 2, alice, { from: alice });
        await f.collector.withdraw(f.fee.address, 2, bob, { from: bob });
        expect(await f.fee.balanceOf(alice)).bignumber.equal(new BN(650));
        expect(await f.fee.balanceOf(bob)).bignumber.equal(new BN(1550));
        expect(await f.fee.balanceOf(f.collector.address)).bignumber.equal(new BN(0));
    });

    it("does not reuse zero stake after a new staker joins within the bucket", async () => {
        const f = await loadFixture(fixture);
        await feeCheckpoint(f);
        await stake(f, newcomer, 10);
        await feeCheckpoint(f, 1200, INTERVAL + 1);
        expect(await expectedFees(f, newcomer)).bignumber.equal(new BN(100));
        expect(await f.collector.getAccumulatedFees(newcomer, f.fee.address)).bignumber.equal(
            new BN(100)
        );
        await f.collector.withdraw(f.fee.address, 2, newcomer, { from: newcomer });
        expect(await f.fee.balanceOf(newcomer)).bignumber.equal(new BN(100));
    });

    it("preserves unchanged-stake shares over different blocks in one bucket", async () => {
        const f = await loadFixture(fixture);
        await feeCheckpoint(f);
        await feeCheckpoint(f, 1100, INTERVAL + 1);
        expect(await f.collector.getAccumulatedFees(alice, f.fee.address)).bignumber.equal(
            new BN(200)
        );
        expect(await f.collector.getAccumulatedFees(bob, f.fee.address)).bignumber.equal(
            new BN(2000)
        );
    });

    it("preserves historical accounting when the date bucket changes", async () => {
        const f = await loadFixture(fixture);
        const first = await feeCheckpoint(f);
        await withdrawStake(f);
        const second = await feeCheckpoint(f, 1100, TWO_WEEKS + 1);
        expect(await f.staking.timestampToLockDate(first.timestamp)).bignumber.not.equal(
            await f.staking.timestampToLockDate(second.timestamp)
        );
        expect(await f.collector.getAccumulatedFees(alice, f.fee.address)).bignumber.equal(
            await expectedFees(f, alice)
        );
        await f.collector.withdraw(f.fee.address, 2, alice, { from: alice });
        await f.collector.withdraw(f.fee.address, 2, bob, { from: bob });
        expect(await f.fee.balanceOf(alice)).bignumber.equal(new BN(100));
        expect(await f.fee.balanceOf(bob)).bignumber.equal(new BN(2100));
    });

    it("makes a combined range equal the sum of its independently paginated ranges", async () => {
        const f = await loadFixture(withdrawnFixture);
        const one = await f.collector.getAccumulatedFeesForCheckpointsRange(
            alice,
            f.fee.address,
            0,
            1
        );
        const two = await f.collector.getAccumulatedFeesForCheckpointsRange(
            alice,
            f.fee.address,
            1,
            1
        );
        const both = await f.collector.getAccumulatedFeesForCheckpointsRange(
            alice,
            f.fee.address,
            0,
            2
        );
        expect(one).bignumber.equal(new BN(100));
        expect(two).bignumber.equal(new BN(0));
        expect(both).bignumber.equal(one.add(two));
        const pages = await f.collector.getAllUserFeesPerMaxCheckpoints(
            alice,
            f.fee.address,
            0,
            1
        );
        expect(pages.map((n) => n.toString())).deep.equal(["100", "0"]);
    });

    it("paginates claims without double-paying or skipping a snapshot", async () => {
        const f = await loadFixture(withdrawnFixture);
        await f.collector.withdraw(f.fee.address, 1, alice, { from: alice });
        expect(await f.collector.processedCheckpoints(alice, f.fee.address)).bignumber.equal(
            new BN(1)
        );
        await f.collector.withdraw(f.fee.address, 1, alice, { from: alice });
        expect(await f.collector.processedCheckpoints(alice, f.fee.address)).bignumber.equal(
            new BN(2)
        );
        expect(await f.fee.balanceOf(alice)).bignumber.equal(new BN(100));
        expect(await f.collector.getAccumulatedFees(alice, f.fee.address)).bignumber.equal(
            new BN(0)
        );
        await f.collector.withdraw(f.fee.address, 2, bob, { from: bob });
        expect(await f.fee.balanceOf(bob)).bignumber.equal(new BN(2100));
        expect(await f.fee.balanceOf(f.collector.address)).bignumber.equal(new BN(0));
    });

    it("keeps same-block deposits pending and aggregates them at the next checkpoint", async () => {
        const f = await loadFixture(fixture);
        const c = await ethers.getContractAt("FeeSharingCollector", f.collector.address);
        const signer = (await ethers.getSigners())[0];
        const nonce = await signer.getTransactionCount();
        await network.provider.send("evm_setAutomine", [false]);
        try {
            const a = await c.transferTokens(f.fee.address, 1100, { nonce, gasLimit: 2000000 });
            const b = await c.transferTokens(f.fee.address, 1100, {
                nonce: nonce + 1,
                gasLimit: 2000000,
            });
            await network.provider.send("evm_mine");
            const ar = await a.wait();
            const br = await b.wait();
            expect(ar.blockNumber).equal(br.blockNumber);
            expect(await f.collector.totalTokenCheckpoints(f.fee.address)).bignumber.equal(
                new BN(1)
            );
            expect(await f.collector.unprocessedAmount(f.fee.address)).bignumber.equal(
                new BN(1100)
            );
        } finally {
            await network.provider.send("evm_setAutomine", [true]);
        }
        await feeCheckpoint(f, 1100, INTERVAL + 1);
        expect((await f.collector.tokenCheckpoints(f.fee.address, 1)).numTokens).bignumber.equal(
            new BN(2200)
        );
        expect(await f.collector.getAccumulatedFees(alice, f.fee.address)).bignumber.equal(
            new BN(300)
        );
        await f.collector.withdraw(f.fee.address, 2, alice, { from: alice });
        await f.collector.withdraw(f.fee.address, 2, bob, { from: bob });
        expect(await f.fee.balanceOf(f.collector.address)).bignumber.equal(new BN(0));
    });

    it("separates withheld fees and preserves owner authority and later staker distribution", async () => {
        const f = await loadFixture(fixture);
        await expectRevert(
            f.collector.addProtocolWithholdToken(f.fee.address, { from: alice }),
            "unauthorized"
        );
        await f.collector.addProtocolWithholdToken(f.fee.address);
        await f.collector.transferTokens(f.fee.address, 500);
        expect(await f.collector.totalTokenCheckpoints(f.fee.address)).bignumber.equal(new BN(0));
        expect(await f.collector.protocolWithheldFees(f.fee.address)).bignumber.equal(new BN(500));
        expect(await f.collector.getAccumulatedFees(alice, f.fee.address)).bignumber.equal(
            new BN(0)
        );
        await f.collector.withdrawProtocolWithheldFees(f.fee.address, owner);
        expect(await f.collector.protocolWithheldFees(f.fee.address)).bignumber.equal(new BN(0));
        await f.collector.removeProtocolWithholdToken(f.fee.address);
        await feeCheckpoint(f);
        await withdrawStake(f);
        await feeCheckpoint(f, 1100, INTERVAL + 1);
        expect(await f.collector.getAccumulatedFees(alice, f.fee.address)).bignumber.equal(
            new BN(100)
        );
    });

    it("bounds a dense 78-date staking claim by its requested checkpoint count", async () => {
        const f = await loadFixture(fixture);
        const kickoff = await f.staking.kickoffTS();
        for (let i = 1; i < 78; i++) {
            await stake(f, alice, 1, kickoff.add(new BN(i * TWO_WEEKS)));
        }
        await feeCheckpoint(f);
        await stake(f, alice, 1);
        await feeCheckpoint(f, 1100, INTERVAL + 1);
        await feeCheckpoint(f, 1100, INTERVAL + 1);
        const expected = await expectedFees(f, alice, 0, 2);
        const tx = await f.collector.withdraw(f.fee.address, 2, alice, {
            from: alice,
            gas: 9500000,
        });
        expect(await f.fee.balanceOf(alice)).bignumber.equal(expected);
        expect(await f.collector.processedCheckpoints(alice, f.fee.address)).bignumber.equal(
            new BN(2)
        );
        expect(new BN(tx.receipt.gasUsed)).bignumber.lt(new BN(10000000));
        console.log("dense snapshot claim gas", tx.receipt.gasUsed);
        expect(await f.collector.getAccumulatedFees(alice, f.fee.address)).bignumber.equal(
            await expectedFees(f, alice, 2, 1)
        );
    });
});
