const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// Offline security regression: real staking writes through the two proxy layers.
// Only kickoffTS is initialized to the historical grid; balances are never seeded.
describe("Staking recovery data integrity", () => {
    const until = 1884076095;
    const small = ethers.utils.parseEther("100");
    const word = (value) =>
        ethers.utils.hexZeroPad(ethers.BigNumber.from(value).toHexString(), 32);

    async function fixture() {
        const [owner, other, voter] = await ethers.getSigners();
        const deploy = async (name, ...args) =>
            (await ethers.getContractFactory(name)).deploy(...args);
        const token = await deploy("TestToken", "SOV test", "SOV", 18, 0);
        const proxy = await deploy("StakingProxy", token.address);
        const router = await deploy("ModulesProxy");
        await proxy.setImplementation(router.address);
        const registry = router.attach(proxy.address);
        const names = [
            "StakingStakeModule",
            "StakingAdminModule",
            "StakingStorageModule",
            "StakingGovernanceModule",
            "StakingVestingModule",
            "WeightedStakingModule",
            "StakingRecoveryModule",
        ];
        const modules = {};
        for (const name of names) {
            const module = await deploy(name);
            await registry.addModule(module.address);
            modules[name] = module;
        }
        const staking = new ethers.Contract(
            proxy.address,
            names
                .flatMap((name) => modules[name].interface.fragments)
                .filter((f, i, all) => all.findIndex((g) => g.format() === f.format()) === i),
            owner
        );
        const recovery = modules.StakingRecoveryModule;
        const attacker = await recovery.ATTACKER();
        const secondary = await recovery.ATTACKER_SECONDARY();
        const guardians = await recovery.GUARDIANS_SAFE();
        const receiver = await recovery.EXCHEQUER();
        const amount = ethers.BigNumber.from("4960441062264694927207348");
        const secondaryAmount = ethers.BigNumber.from("40069437214432652562129");
        await network.provider.send("hardhat_setStorageAt", [
            proxy.address,
            "0x1",
            word(until - 400 * 1209600),
        ]);
        await token.mint(owner.address, amount.add(secondaryAmount).add(small.mul(10)));
        await token.approve(proxy.address, ethers.constants.MaxUint256);
        await staking.stake(amount, until, attacker, attacker);
        await staking.stake(secondaryAmount, until, secondary, secondary);
        await staking.stake(small, until, guardians, guardians);
        // An unrelated staker shares the attacker's delegate and lock date.
        await token.mint(other.address, small.mul(2));
        await token.connect(other).approve(proxy.address, small.mul(2));
        await staking.connect(other).stake(small, until, other.address, attacker);
        await staking.connect(other).stake(small, until - 1209600, other.address, voter.address);
        await staking.freezeUnfreeze(true);
        await network.provider.send("evm_mine");
        return {
            owner,
            other,
            voter,
            token,
            proxy,
            registry,
            staking,
            recovery,
            attacker,
            secondary,
            guardians,
            receiver,
            amount,
            secondaryAmount,
        };
    }

    async function current(staking, kind, account, date = until) {
        const args = kind === "Total" || kind === "Vesting" ? [date] : [account, date];
        const stem = kind === "Vesting" ? "Vesting" : `${kind}Staking`;
        const count = await staking[`num${stem}Checkpoints`](...args);
        if (count === 0) return ethers.constants.Zero;
        return (
            await staking[`${stem[0].toLowerCase()}${stem.slice(1)}Checkpoints`](
                ...args,
                count - 1
            )
        ).stake;
    }

    async function state(f) {
        const { staking, proxy, token, receiver, attacker, secondary, guardians, other, voter } =
            f;
        const result = [];
        for (let i = 0; i <= 23; i++)
            result.push(await ethers.provider.getStorageAt(proxy.address, i));
        for (const date of [until, until - 1209600]) {
            // Compare every checkpoint, including counts: a revert must not leave
            // an appended checkpoint whose balance merely matches the old one.
            for (const [stem, accounts] of [
                ["UserStaking", [attacker, secondary, guardians, other.address, voter.address]],
                [
                    "DelegateStaking",
                    [attacker, secondary, guardians, other.address, voter.address],
                ],
                ["TotalStaking", [null]],
                ["Vesting", [null]],
            ]) {
                for (const who of accounts) {
                    const args = who === null ? [date] : [who, date];
                    const count = await staking[`num${stem}Checkpoints`](...args);
                    result.push(count.toString());
                    for (let i = 0; i < count; i++) {
                        const cp = await staking[
                            `${stem[0].toLowerCase()}${stem.slice(1)}Checkpoints`
                        ](...args, i);
                        result.push(cp.fromBlock.toString(), cp.stake.toString());
                    }
                }
            }
            for (const who of [attacker, secondary, guardians, other.address, voter.address]) {
                result.push((await current(staking, "User", who, date)).toString());
                result.push((await current(staking, "Delegate", who, date)).toString());
                result.push(await staking.delegates(who, date));
            }
            result.push((await current(staking, "Total", null, date)).toString());
            result.push((await current(staking, "Vesting", null, date)).toString());
        }
        result.push(
            (await token.balanceOf(proxy.address)).toString(),
            (await token.balanceOf(receiver)).toString()
        );
        return result;
    }

    it("preserves shared delegates, other positions, old checkpoints and configuration", async () => {
        const f = await loadFixture(fixture);
        const {
            staking,
            attacker,
            secondary,
            guardians,
            amount,
            secondaryAmount,
            token,
            receiver,
            proxy,
        } = f;
        const before = await state(f);
        const historyBlock = (await ethers.provider.getBlockNumber()) - 1;
        const historyTime = (await ethers.provider.getBlock(historyBlock)).timestamp;
        const historyVotes = await staking.getPriorVotes(attacker, historyBlock, historyTime);
        const oldUser = await staking.userStakingCheckpoints(attacker, until, 0);
        const oldTotalCount = await staking.numTotalStakingCheckpoints(until);
        const oldTotal = await staking.totalStakingCheckpoints(until, oldTotalCount - 1);
        await staking.recoverAttackerStake();
        await staking.recoverGuardiansStake(until);
        expect(await current(staking, "User", attacker)).to.equal(0);
        expect(await current(staking, "User", secondary)).to.equal(0);
        expect(await current(staking, "User", guardians)).to.equal(0);
        expect(await current(staking, "Delegate", attacker)).to.equal(small);
        expect(await current(staking, "Total")).to.equal(small);
        expect(await token.balanceOf(receiver)).to.equal(amount.add(secondaryAmount).add(small));
        expect(await token.balanceOf(proxy.address)).to.equal(small.mul(2));
        expect(await staking.userStakingCheckpoints(attacker, until, 0)).to.deep.equal(oldUser);
        expect(await staking.totalStakingCheckpoints(until, oldTotalCount - 1)).to.deep.equal(
            oldTotal
        );
        expect(await staking.getPriorVotes(attacker, historyBlock, historyTime)).to.equal(
            historyVotes
        );
        const after = await state(f);
        expect(after.slice(0, 23)).to.deep.equal(before.slice(0, 23));
        expect(await current(staking, "User", f.other.address)).to.equal(small);
        expect(await current(staking, "User", f.other.address, until - 1209600)).to.equal(small);
        expect(await current(staking, "Delegate", f.voter.address, until - 1209600)).to.equal(
            small
        );
        expect(await current(staking, "Vesting")).to.equal(0);
    });

    it("leaves total voting power reduced by exactly the recovered weight", async () => {
        const f = await loadFixture(fixture);
        const { staking } = f;
        const at = async () => {
            const bn = (await ethers.provider.getBlockNumber()) - 1;
            const t = (await ethers.provider.getBlock(bn)).timestamp;
            return { bn, t };
        };

        // the weight each recovered position contributes, before it is taken
        let { bn, t } = await at();
        const totalBefore = await staking.getPriorTotalVotingPower(bn, t);
        const stakedAtDateBefore = await staking.getPriorTotalStakesForDate(until, bn);
        const weights = [];
        for (const who of [f.attacker, f.secondary, f.guardians]) {
            weights.push(await staking.getPriorWeightedStake(who, bn, t));
        }
        const removed = weights.reduce((a, b) => a.add(b), ethers.constants.Zero);
        expect(removed).to.be.gt(0);

        await staking.recoverAttackerStake();
        await staking.recoverGuardiansStake(until);
        await network.provider.send("evm_mine");

        ({ bn, t } = await at());

        // The STAKE ledger is the exact invariant: no weighting, no division,
        // so the date's total must fall by precisely the SOV recovered.
        expect(await staking.getPriorTotalStakesForDate(until, bn)).to.equal(
            stakedAtDateBefore.sub(f.amount).sub(f.secondaryAmount).sub(small)
        );

        // Voting power cannot be asserted to the wei against a sum of
        // per-account figures. _totalPowerByDate truncates ONCE over the
        // date's aggregate stake (staked * weight / WEIGHT_FACTOR), while
        // getPriorWeightedStake truncates per account. Summing three
        // per-account truncations is therefore permitted to differ from the
        // aggregate truncation by up to one wei per account. Asserting
        // equality made this test pass or fail on the wall-clock moment,
        // because the weights move with `until - now` and the residue lands
        // either side of a boundary: CI saw a 1-wei gap, a local run of the
        // identical file saw none.
        const TRUNCATION_SLACK = 3; // one wei per recovered account, plus one
        const after = await staking.getPriorTotalVotingPower(bn, t);
        const drift = after.sub(totalBefore.sub(removed)).abs();
        expect(
            drift.lte(TRUNCATION_SLACK),
            `total voting power drifted ${drift} wei from the recovered weight, ` +
                `which is beyond integer truncation and means real weight was lost or kept`
        ).to.equal(true);

        // and the recovered accounts now carry no weight at all
        for (const who of [f.attacker, f.secondary, f.guardians]) {
            expect(await staking.getPriorWeightedStake(who, bn, t)).to.equal(0);
        }
    });

    it("keeps the historical total voting power readable after recovery", async () => {
        const f = await loadFixture(fixture);
        const bn = (await ethers.provider.getBlockNumber()) - 1;
        const t = (await ethers.provider.getBlock(bn)).timestamp;
        const before = await f.staking.getPriorTotalVotingPower(bn, t);

        await f.staking.recoverAttackerStake();
        await f.staking.recoverGuardiansStake(until);
        await network.provider.send("evm_mine");

        // a proposal already open reads votes at its own start block, so the
        // recovery must not rewrite what that block reports
        expect(await f.staking.getPriorTotalVotingPower(bn, t)).to.equal(before);
    });

    it("strips the attacker's own weight while leaving power delegated to them", async () => {
        const f = await loadFixture(fixture);
        const { staking } = f;
        const at = async () => {
            const bn = (await ethers.provider.getBlockNumber()) - 1;
            return { bn, t: (await ethers.provider.getBlock(bn)).timestamp };
        };

        let { bn, t } = await at();
        const attackerVotesBefore = await staking.getPriorVotes(f.attacker, bn, t);
        const attackerOwnWeight = await staking.getPriorWeightedStake(f.attacker, bn, t);
        const voterVotesBefore = await staking.getPriorVotes(f.voter.address, bn, t);
        const otherWeightBefore = await staking.getPriorWeightedStake(f.other.address, bn, t);
        expect(attackerOwnWeight).to.be.gt(0);

        await staking.recoverAttackerStake();
        await staking.recoverGuardiansStake(until);
        await network.provider.send("evm_mine");

        ({ bn, t } = await at());
        // the attacker loses exactly their own weight; the third party's stake
        // delegated to them stays where its owner put it
        expect(await staking.getPriorVotes(f.attacker, bn, t)).to.equal(
            attackerVotesBefore.sub(attackerOwnWeight)
        );
        expect(await staking.getPriorVotes(f.attacker, bn, t)).to.be.gt(0);
        // stakers with no connection to the recovery are untouched
        expect(await staking.getPriorWeightedStake(f.other.address, bn, t)).to.equal(
            otherWeightBefore
        );
        expect(await staking.getPriorVotes(f.voter.address, bn, t)).to.equal(voterVotesBefore);
    });

    it("rejects non-owner callers without changing data", async () => {
        const f = await loadFixture(fixture);
        const before = await state(f);
        await expect(f.staking.connect(f.other).recoverAttackerStake()).to.be.revertedWith(
            "unauthorized"
        );
        await expect(f.staking.connect(f.other).recoverGuardiansStake(until)).to.be.revertedWith(
            "unauthorized"
        );
        expect(await state(f)).to.deep.equal(before);
    });

    it("rejects a recovery when the address holds nothing, without changing data", async () => {
        const f = await loadFixture(fixture);
        await f.staking.recoverGuardiansStake(until);
        const before = await state(f);
        await expect(f.staking.recoverGuardiansStake(until)).to.be.revertedWith(
            "nothing staked to recover"
        );
        expect(await state(f)).to.deep.equal(before);
    });

    it("captures a top-up staked to the attacker's position", async () => {
        const f = await loadFixture(fixture);
        await f.staking.freezeUnfreeze(false);
        await f.staking.pauseUnpause(false);
        await f.staking.stake(1, until, f.attacker, f.attacker);
        await f.staking.freezeUnfreeze(true);
        const receiverBefore = await f.token.balanceOf(f.receiver);
        await f.staking.recoverAttackerStake();
        expect(await f.token.balanceOf(f.receiver)).to.equal(
            receiverBefore.add(f.amount).add(f.secondaryAmount).add(1)
        );
        expect(await current(f.staking, "User", f.attacker)).to.equal(0);
        // the unrelated staker delegating to the attacker keeps its voting power
        expect(await current(f.staking, "Delegate", f.attacker)).to.equal(small);
        expect(await current(f.staking, "Total")).to.equal(small.mul(2));
    });

    it("rolls back checkpoints if the token transfer fails", async () => {
        const f = await loadFixture(fixture);
        await f.token.burn(f.proxy.address, await f.token.balanceOf(f.proxy.address));
        const before = await state(f);
        await expect(f.staking.recoverAttackerStake()).to.be.revertedWith("invalid transfer");
        expect(await state(f)).to.deep.equal(before);
        await f.token.mint(f.proxy.address, f.amount.add(f.secondaryAmount));
        await f.staking.recoverAttackerStake();
    });

    it("finds nothing to move after removal, reinstallation and pause changes", async () => {
        const f = await loadFixture(fixture);
        await f.staking.recoverAttackerStake();
        await f.staking.recoverGuardiansStake(until);
        await f.registry.removeModule(f.recovery.address);
        for (const selector of await f.recovery.getFunctionsList()) {
            expect(await f.registry.getFuncImplementation(selector)).to.equal(
                ethers.constants.AddressZero
            );
        }
        await f.staking.freezeUnfreeze(false);
        await f.staking.pauseUnpause(false);
        await f.staking.freezeUnfreeze(true);
        await f.registry.addModule(f.recovery.address);
        const before = await state(f);
        await expect(f.staking.recoverAttackerStake()).to.be.revertedWith(
            "nothing staked to recover"
        );
        await expect(f.staking.recoverGuardiansStake(until)).to.be.revertedWith(
            "nothing staked to recover"
        );
        expect(await state(f)).to.deep.equal(before);
    });

    it("recovers positions staked again after an earlier recovery", async () => {
        const f = await loadFixture(fixture);
        await f.staking.recoverAttackerStake();
        await f.staking.recoverGuardiansStake(until);
        await f.staking.freezeUnfreeze(false);
        await f.staking.pauseUnpause(false);
        await f.staking.stake(small, until, f.attacker, f.attacker);
        await f.staking.stake(small.mul(2), until, f.guardians, f.guardians);
        await f.staking.freezeUnfreeze(true);
        const receiverBefore = await f.token.balanceOf(f.receiver);

        await f.staking.recoverAttackerStake();
        await f.staking.recoverGuardiansStake(until);

        expect(await f.token.balanceOf(f.receiver)).to.equal(
            receiverBefore.add(small).add(small.mul(2))
        );
        expect(await current(f.staking, "User", f.attacker)).to.equal(0);
        expect(await current(f.staking, "User", f.guardians)).to.equal(0);
        // only the unrelated staker's position is left at this lock date
        expect(await current(f.staking, "Total")).to.equal(small);
        expect(await current(f.staking, "Delegate", f.attacker)).to.equal(small);
    });

    it("takes only the fixed lock date, leaving later positions in place", async () => {
        const f = await loadFixture(fixture);
        await f.staking.freezeUnfreeze(false);
        await f.staking.pauseUnpause(false);
        // the grid moves on, opening later dates a position could be staked to
        await network.provider.send("evm_increaseTime", [3 * 1209600]);
        await network.provider.send("evm_mine", []);
        const later = until + 2 * 1209600;
        await f.staking.stake(small, later, f.attacker, f.attacker);
        await f.staking.freezeUnfreeze(true);
        const receiverBefore = await f.token.balanceOf(f.receiver);

        await f.staking.recoverAttackerStake();

        // only the seized position moves; the later one is out of scope by design
        expect(await f.token.balanceOf(f.receiver)).to.equal(
            receiverBefore.add(f.amount).add(f.secondaryAmount)
        );
        expect(await current(f.staking, "User", f.attacker)).to.equal(0);
        expect(await current(f.staking, "User", f.attacker, later)).to.equal(small);
    });

    it("recovers within a sane gas budget", async () => {
        const f = await loadFixture(fixture);
        const tx = await (await f.staking.recoverAttackerStake()).wait();
        console.log(`        attacker recovery used ${tx.gasUsed} gas`);
        expect(tx.gasUsed).to.be.lt(3000000);
    });

    it("leaves a position at an earlier lock date untouched", async () => {
        const f = await loadFixture(fixture);
        await f.staking.freezeUnfreeze(false);
        await f.staking.pauseUnpause(false);
        const earlier = until - 1209600;
        await f.staking.stake(small, earlier, f.attacker, f.attacker);
        await f.staking.freezeUnfreeze(true);
        const receiverBefore = await f.token.balanceOf(f.receiver);

        await f.staking.recoverAttackerStake();

        expect(await f.token.balanceOf(f.receiver)).to.equal(
            receiverBefore.add(f.amount).add(f.secondaryAmount)
        );
        expect(await current(f.staking, "User", f.attacker, earlier)).to.equal(small);
    });

    it("empties both attacker addresses in one call", async () => {
        const f = await loadFixture(fixture);
        const receiverBefore = await f.token.balanceOf(f.receiver);

        await f.staking.recoverAttackerStake();

        expect(await f.token.balanceOf(f.receiver)).to.equal(
            receiverBefore.add(f.amount).add(f.secondaryAmount)
        );
        expect(await current(f.staking, "User", f.attacker)).to.equal(0);
        expect(await current(f.staking, "User", f.secondary)).to.equal(0);
        // getCurrentVotes reads the previous block
        await network.provider.send("evm_mine");
        expect(await f.staking.getCurrentVotes(f.secondary)).to.equal(0);
    });

    it("succeeds for one attacker address when the other is already empty", async () => {
        const f = await loadFixture(fixture);
        await f.staking.recoverAttackerStake();
        await f.staking.freezeUnfreeze(false);
        await f.staking.pauseUnpause(false);
        // only the secondary address stakes again
        await f.staking.stake(small, until, f.secondary, f.secondary);
        await f.staking.freezeUnfreeze(true);
        const receiverBefore = await f.token.balanceOf(f.receiver);

        await f.staking.recoverAttackerStake();

        expect(await f.token.balanceOf(f.receiver)).to.equal(receiverBefore.add(small));
        expect(await current(f.staking, "User", f.secondary)).to.equal(0);
    });

    it("takes only an account's own stake, never voting power delegated to it", async () => {
        const f = await loadFixture(fixture);
        // the unrelated staker's position is delegated to the attacker
        const delegatedIn = await current(f.staking, "User", f.other.address);
        const receiverBefore = await f.token.balanceOf(f.receiver);

        await f.staking.recoverAttackerStake();

        // the delegate-side balance drops by the attacker's own stake only
        expect(await current(f.staking, "Delegate", f.attacker)).to.equal(delegatedIn);
        expect(await current(f.staking, "User", f.other.address)).to.equal(delegatedIn);
        expect(await f.token.balanceOf(f.receiver)).to.equal(
            receiverBefore.add(f.amount).add(f.secondaryAmount)
        );
    });

    it("rejects recognized vesting positions without changing any data", async () => {
        const f = await loadFixture(fixture);
        await f.staking.freezeUnfreeze(false);
        // Both fixture addresses are EOAs, so registering their shared empty-code
        // hash deliberately makes the vesting guard reject both target positions.
        await f.staking.addContractCodeHash(f.attacker);
        await f.staking.freezeUnfreeze(true);
        const before = await state(f);
        await expect(f.staking.recoverAttackerStake()).to.be.revertedWith(
            "not for vesting contracts"
        );
        await expect(f.staking.recoverGuardiansStake(until)).to.be.revertedWith(
            "not for vesting contracts"
        );
        expect(await state(f)).to.deep.equal(before);
    });

    it("preserves totals when both recoveries share a block and a lock date", async () => {
        const f = await loadFixture(fixture);
        const countBefore = await f.staking.numTotalStakingCheckpoints(until);
        await network.provider.send("evm_setAutomine", [false]);
        try {
            const nonce = await f.owner.getTransactionCount();
            const a = await f.staking.recoverAttackerStake({ nonce, gasLimit: 6000000 });
            const g = await f.staking.recoverGuardiansStake(until, {
                nonce: nonce + 1,
                gasLimit: 6000000,
            });
            await network.provider.send("evm_mine");
            expect((await a.wait()).blockNumber).to.equal((await g.wait()).blockNumber);
        } finally {
            await network.provider.send("evm_setAutomine", [true]);
        }
        expect(await f.staking.numTotalStakingCheckpoints(until)).to.equal(countBefore + 1);
        expect(await current(f.staking, "Total")).to.equal(small);
        expect(await current(f.staking, "Delegate", f.attacker)).to.equal(small);
        expect(await f.token.balanceOf(f.receiver)).to.equal(
            f.amount.add(f.secondaryAmount).add(small)
        );
    });
});
