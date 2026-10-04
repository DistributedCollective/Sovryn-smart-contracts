const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { BN, constants, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { advanceBlocks, mineBlock } = require("../Utils/Ethereum");

const Mining = artifacts.require("LiquidityMiningMockup");
const Proxy = artifacts.require("LiquidityMiningProxy");
const Token = artifacts.require("TestToken");
const LockedSOV = artifacts.require("LockedSOVMockup");
const Wrapper = artifacts.require("RBTCWrapperProxyMockup");
const ZERO = constants.ZERO_ADDRESS;
const AMOUNT = new BN(1000);
const RATE = new BN(10);

contract("LiquidityMining stopped reward intervals", ([owner, user, newcomer, admin]) => {
    async function deploy(startDelay = 1, bonusBlocks = 50) {
        const sov = await Token.new("Reward", "R", 18, 1000000);
        const lp = await Token.new("Pool", "LP", 18, 0);
        const locked = await LockedSOV.new(sov.address, [owner]);
        const implementation = await Mining.new();
        const proxy = await Proxy.new();
        await proxy.setImplementation(implementation.address);
        const mining = await Mining.at(proxy.address);
        const wrapper = await Wrapper.new(mining.address);
        await mining.initialize(
            sov.address,
            RATE,
            startDelay,
            bonusBlocks,
            wrapper.address,
            locked.address,
            9999
        );
        await mining.setUnlockedImmediatelyPercent(10000);
        await mining.add(lp.address, 1, false);
        await lp.mint(user, AMOUNT);
        await lp.approve(mining.address, AMOUNT, { from: user });
        await sov.transfer(mining.address, 1000000);
        const deposit = await mining.deposit(lp.address, AMOUNT, ZERO, { from: user });
        return { mining, lp, sov, locked, wrapper, deposit };
    }

    async function fixture() {
        return deploy();
    }

    async function stopAndUpdate(f) {
        const stop = await f.mining.stopMining();
        await mineBlock();
        await f.mining.updatePool(f.lp.address);
        const pool = await f.mining.getPoolInfo(f.lp.address);
        expect(pool.lastRewardBlock).bignumber.gt(new BN(stop.receipt.blockNumber));
        return {
            pool,
            reward: await f.mining.getUserAccumulatedReward(f.lp.address, user),
            total: await f.mining.totalUsersBalance(),
        };
    }

    async function principalReturned(f, receiver = user) {
        expect(await f.lp.balanceOf(receiver)).bignumber.equal(AMOUNT);
        expect(await f.lp.balanceOf(f.mining.address)).bignumber.equal(new BN(0));
        const info = await f.mining.getUserInfo(f.lp.address, user);
        expect(info.amount).bignumber.equal(new BN(0));
        expect(info.rewardDebt).bignumber.equal(new BN(0));
    }

    it("preserves positive reward intervals across start and bonus boundaries", async () => {
        const { mining } = await loadFixture(fixture);
        const start = await mining.startBlock();
        const bonus = await mining.bonusEndBlock();
        const cases = [
            [start.subn(1), start.addn(1), 10],
            [start, bonus, 500],
            [bonus.subn(1), bonus.addn(1), 11],
            [bonus, bonus.addn(3), 3],
        ];
        for (const [from, to, expected] of cases) {
            expect(await mining.getPassedBlocksWithBonusMultiplier(from, to)).bignumber.equal(
                new BN(expected)
            );
        }
    });

    it("returns zero for empty or reversed intervals after start clamping", async () => {
        const { mining } = await loadFixture(fixture);
        const start = await mining.startBlock();
        const bonus = await mining.bonusEndBlock();
        for (const [from, to] of [
            [start.subn(2), start.subn(1)],
            [start, start],
            [start.addn(1), start],
            [bonus.addn(1), bonus],
        ]) {
            expect(await mining.getPassedBlocksWithBonusMultiplier(from, to)).bignumber.equal(
                new BN(0)
            );
        }
    });

    it("returns zero at and beyond the stop boundary without adding bonus rewards", async () => {
        const f = await loadFixture(fixture);
        await stopAndUpdate(f);
        const end = await f.mining.endBlock();
        for (const from of [end, end.addn(1), end.addn(100)]) {
            expect(
                await f.mining.getPassedBlocksWithBonusMultiplier(from, end.addn(101))
            ).bignumber.equal(new BN(0));
        }
        expect(
            await f.mining.getPassedBlocksWithBonusMultiplier(end.subn(1), end.addn(100))
        ).bignumber.equal(new BN(10));
    });

    it("caps a reward interval that crosses the bonus and stop boundaries", async () => {
        const f = await loadFixture(fixture);
        const bonus = await f.mining.bonusEndBlock();
        await advanceBlocks(bonus.addn(3));
        await f.mining.stopMining();
        const end = await f.mining.endBlock();
        expect(
            await f.mining.getPassedBlocksWithBonusMultiplier(bonus.subn(1), end.addn(5))
        ).bignumber.equal(end.sub(bonus).addn(10));
        expect(
            await f.mining.getPassedBlocksWithBonusMultiplier(end.addn(1), end.addn(5))
        ).bignumber.equal(new BN(0));
    });

    it("repeated post-stop updates preserve reward and liability totals", async () => {
        const f = await loadFixture(fixture);
        const before = await stopAndUpdate(f);
        await f.mining.updatePool(f.lp.address, { from: newcomer });
        await f.mining.updateAllPools();
        expect(
            (await f.mining.getPoolInfo(f.lp.address)).accumulatedRewardPerShare
        ).bignumber.equal(before.pool.accumulatedRewardPerShare);
        expect(await f.mining.totalUsersBalance()).bignumber.equal(before.total);
    });

    it("post-stop reward views remain usable and estimates return zero", async () => {
        const f = await loadFixture(fixture);
        const before = await stopAndUpdate(f);
        await mineBlock();
        expect(await f.mining.getUserAccumulatedReward(f.lp.address, user)).bignumber.equal(
            before.reward
        );
        expect((await f.mining.getUserAccumulatedRewardList(user))[0]).bignumber.equal(
            before.reward
        );
        expect((await f.mining.getUserBalanceList(user))[0][1]).bignumber.equal(before.reward);
        expect(await f.mining.getEstimatedReward(f.lp.address, AMOUNT, 300)).bignumber.equal(
            new BN(0)
        );
    });

    it("returns all normal-withdraw principal and pays only accrued pre-stop rewards", async () => {
        const f = await loadFixture(fixture);
        const before = await stopAndUpdate(f);
        const expected = new BN(await f.mining.endBlock())
            .sub(new BN(f.deposit.receipt.blockNumber))
            .mul(RATE)
            .muln(10);
        expect(before.reward).bignumber.equal(expected);
        const tx = await f.mining.withdraw(f.lp.address, AMOUNT, ZERO, { from: user });
        await principalReturned(f);
        expect(await f.sov.balanceOf(user)).bignumber.equal(expected);
        expect(await f.mining.totalUsersBalance()).bignumber.equal(new BN(0));
        expectEvent(tx, "RewardClaimed", { user, poolToken: f.lp.address, amount: expected });
    });

    it("returns all emergency-withdraw principal and forfeits only accrued rewards", async () => {
        const f = await loadFixture(fixture);
        const before = await stopAndUpdate(f);
        const tx = await f.mining.emergencyWithdraw(f.lp.address, { from: user });
        await principalReturned(f);
        expect(await f.sov.balanceOf(user)).bignumber.equal(new BN(0));
        expect(await f.mining.totalUsersBalance()).bignumber.equal(new BN(0));
        expectEvent(tx, "EmergencyWithdraw", {
            user,
            poolToken: f.lp.address,
            amount: AMOUNT,
            accumulatedReward: before.reward,
        });
    });

    it("preserves principal withdrawal and reward debt when reward funding is absent", async () => {
        const f = await loadFixture(fixture);
        await f.mining.transferSOV(owner, 1000000);
        const before = await stopAndUpdate(f);
        await f.mining.withdraw(f.lp.address, AMOUNT, ZERO, { from: user });
        await principalReturned(f);
        expect((await f.mining.getUserInfo(f.lp.address, user)).accumulatedReward).bignumber.equal(
            before.reward
        );
        expect(await f.mining.totalUsersBalance()).bignumber.equal(before.total);
        expect(await f.sov.balanceOf(user)).bignumber.equal(new BN(0));
    });

    it("claims pre-stop rewards once and adds none during later withdrawal", async () => {
        const f = await loadFixture(fixture);
        const before = await stopAndUpdate(f);
        await f.mining.claimReward(f.lp.address, ZERO, { from: user });
        expect(await f.sov.balanceOf(user)).bignumber.equal(before.reward);
        await f.mining.withdraw(f.lp.address, AMOUNT, ZERO, { from: user });
        await principalReturned(f);
        expect(await f.sov.balanceOf(user)).bignumber.equal(before.reward);
    });

    it("preserves the configured locked/liquid reward split on post-stop withdrawal", async () => {
        const f = await loadFixture(fixture);
        await f.mining.setUnlockedImmediatelyPercent(1000);
        const before = await stopAndUpdate(f);
        await f.mining.withdraw(f.lp.address, AMOUNT, ZERO, { from: user });
        await principalReturned(f);
        const liquid = before.reward.divn(10);
        expect(await f.locked.getUnlockedBalance(user)).bignumber.equal(liquid);
        expect(await f.locked.getLockedBalance(user)).bignumber.equal(before.reward.sub(liquid));
        expect(await f.sov.balanceOf(f.locked.address)).bignumber.equal(before.reward);
    });

    it("preserves wrapper routing and rejects unauthorized withdrawal for another user", async () => {
        const f = await loadFixture(fixture);
        await stopAndUpdate(f);
        await expectRevert(
            f.mining.withdraw(f.lp.address, AMOUNT, user, { from: newcomer }),
            "only wrapper or pools may withdraw for a user"
        );
        await f.wrapper.withdraw(f.lp.address, AMOUNT, { from: user });
        await principalReturned(f, f.wrapper.address);
    });

    it("allows a later deposit and withdrawal without earning post-stop rewards", async () => {
        const f = await loadFixture(fixture);
        await stopAndUpdate(f);
        await f.lp.mint(newcomer, AMOUNT);
        await f.lp.approve(f.mining.address, AMOUNT, { from: newcomer });
        await f.mining.deposit(f.lp.address, AMOUNT, ZERO, { from: newcomer });
        await f.mining.withdraw(f.lp.address, AMOUNT, ZERO, { from: newcomer });
        expect(await f.lp.balanceOf(newcomer)).bignumber.equal(AMOUNT);
        expect(await f.sov.balanceOf(newcomer)).bignumber.equal(new BN(0));
        expect((await f.mining.getUserInfo(f.lp.address, newcomer)).amount).bignumber.equal(
            new BN(0)
        );
    });

    it("allows a pool added after stop to return principal without rewards", async () => {
        const f = await loadFixture(fixture);
        await stopAndUpdate(f);
        const laterLP = await Token.new("Later pool", "LP2", 18, 0);
        await f.mining.add(laterLP.address, 1, false);
        await laterLP.mint(newcomer, AMOUNT);
        await laterLP.approve(f.mining.address, AMOUNT, { from: newcomer });
        await f.mining.deposit(laterLP.address, AMOUNT, ZERO, { from: newcomer });
        await f.mining.withdraw(laterLP.address, AMOUNT, ZERO, { from: newcomer });
        expect(await laterLP.balanceOf(newcomer)).bignumber.equal(AMOUNT);
        expect(await laterLP.balanceOf(f.mining.address)).bignumber.equal(new BN(0));
        expect(await f.sov.balanceOf(newcomer)).bignumber.equal(new BN(0));
    });

    it("handles an empty pool updated after stop before a new deposit", async () => {
        const f = await loadFixture(fixture);
        await f.mining.withdraw(f.lp.address, AMOUNT, ZERO, { from: user });
        await f.mining.stopMining();
        await f.mining.updatePool(f.lp.address);
        await f.lp.approve(f.mining.address, AMOUNT, { from: user });
        const rewardBefore = await f.sov.balanceOf(user);
        await f.mining.deposit(f.lp.address, AMOUNT, ZERO, { from: user });
        await f.mining.withdraw(f.lp.address, AMOUNT, ZERO, { from: user });
        await principalReturned(f);
        expect(await f.sov.balanceOf(user)).bignumber.equal(rewardBefore);
    });

    it("returns principal with zero rewards if mining is stopped before it starts", async () => {
        const f = await deploy(100);
        await f.mining.stopMining();
        const start = await f.mining.startBlock();
        expect(await f.mining.endBlock()).bignumber.lt(start);
        await advanceBlocks(start.addn(1));
        await f.mining.updatePool(f.lp.address);
        await f.mining.withdraw(f.lp.address, AMOUNT, ZERO, { from: user });
        await principalReturned(f);
        expect(await f.sov.balanceOf(user)).bignumber.equal(new BN(0));
    });

    it("preserves owner/admin stop authority and rejects repeated stopping", async () => {
        const f = await loadFixture(fixture);
        await expectRevert(f.mining.stopMining({ from: newcomer }), "unauthorized");
        await f.mining.addAdmin(admin);
        await f.mining.stopMining({ from: admin });
        await expectRevert(f.mining.stopMining(), "Already stopped");
        expect(await f.mining.owner()).equal(owner);
        expect(await f.mining.admins(admin)).equal(true);
    });
});
