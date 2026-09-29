/**
 * Fork test for the September 2026 governance-capture recovery.
 *
 * Replays the whole plan against live RSK mainnet state:
 *   1. the Contracts Guardians Safe stakes 10M SOV inside one atomic bundle
 *      (unfreeze -> unpause -> approve -> stake -> freeze),
 *   2. the owner timelock executes the SIP (add module, recover both stakes,
 *      remove module, replace the withdraw and admin modules),
 *   3. staking is reopened and ordinary stakers work again.
 *
 * Run with:
 *   RSK_FORK_TESTS=true __decryptionAlreadyDone__=TRUE npx hardhat test tests/staking/StakingRecoveryFork.test.js
 */
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const RSK_RPC = process.env.RSK_FORK_RPC || "https://public-node.rsk.co";

const STAKING = "0x5684a06CaB22Db16d901fEe2A5C081b4C91eA40e";
const SOV = "0xEFc78fc7d48b64958315949279Ba181c2114ABBd";
const GUARDIANS_SAFE = "0xDd8e07A57560AdA0A2D84a96c457a5e6DDD488b7";
const EXCHEQUER = "0x924f5ad34698Fd20c90Fe5D5A8A0abd3b42dc711";
const TIMELOCK_OWNER = "0x967c84b731679E36A344002b8E3CE50620A7F69f";
const ATTACKER = "0xac3ecE58a142e829Ef60f224F2FA8F4c98d6dEE8";
// the second address the attack voted from
const ATTACKER_SECONDARY = "0x92972392e3AfBd8C0F417441325b8688e2b7e774";
const ATTACKER_LOCK_DATE = 1884076095;
const ATTACKER_STAKE = ethers.BigNumber.from("4960441062264694927207348");
const ATTACKER_SECONDARY_STAKE = ethers.BigNumber.from("40069437214432652562129");
// the address designated to cast the vote with the Guardians' staked power
const DELEGATEE = "0x428A80f48aB417E17A12Ec81A2671c4846BdB2be";

const STAKE_AMOUNT = ethers.utils.parseEther("10000000");

const STAKING_ABI = [
    "function frozen() view returns (bool)",
    "function paused() view returns (bool)",
    "function freezeUnfreeze(bool)",
    "function pauseUnpause(bool)",
    "function stake(uint96 amount, uint256 until, address stakeFor, address delegatee)",
    "function withdraw(uint96 amount, uint256 until, address receiver)",
    "function delegate(address delegatee, uint256 lockDate)",
    "function getCurrentVotes(address) view returns (uint96)",
    "function getPriorVotes(address,uint256,uint256) view returns (uint96)",
    "function getPriorTotalVotingPower(uint32,uint256) view returns (uint96)",
    "function getPriorWeightedStake(address,uint256,uint256) view returns (uint96)",
    "function getStakes(address) view returns (uint256[], uint96[])",
    "function timestampToLockDate(uint256) view returns (uint256)",
    "function getPriorTotalStakesForDate(uint256,uint256) view returns (uint96)",
    "function recoverAttackerStake()",
    "function recoverGuardiansStake(uint256)",
];
const PROXY_ABI = [
    "function addModule(address)",
    "function removeModule(address)",
    "function replaceModule(address,address)",
    "function getFuncImplementation(bytes4) view returns (address)",
];
const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256) returns (bool)",
    "function approve(address,uint256) returns (bool)",
];

async function impersonate(address) {
    await network.provider.request({ method: "hardhat_impersonateAccount", params: [address] });
    await network.provider.send("hardhat_setBalance", [address, "0x3635C9ADC5DEA00000"]);
    return await ethers.getSigner(address);
}

// These drive a fork of live RSK mainnet: they need network access and take
// minutes, so `npx hardhat test` skips them. Run them explicitly with
// RSK_FORK_TESTS=true.
const describeFork = process.env.RSK_FORK_TESTS === "true" ? describe : describe.skip;

describeFork("Staking recovery on an RSK mainnet fork", () => {
    let staking, proxy, sov, recoveryModule;
    let totalVotingPowerBefore, recoveredWeight;
    let guardians, timelock, exchequer;
    let voter, ordinaryStaker;
    let guardiansLockDate;

    before(async function () {
        this.timeout(600000);
        await network.provider.request({
            method: "hardhat_reset",
            params: [{ forking: { jsonRpcUrl: RSK_RPC } }],
        });

        [voter, ordinaryStaker] = await ethers.getSigners();

        staking = new ethers.Contract(STAKING, STAKING_ABI, ethers.provider);
        proxy = new ethers.Contract(STAKING, PROXY_ABI, ethers.provider);
        sov = new ethers.Contract(SOV, ERC20_ABI, ethers.provider);

        guardians = await impersonate(GUARDIANS_SAFE);
        timelock = await impersonate(TIMELOCK_OWNER);
        exchequer = await impersonate(EXCHEQUER);

        const Recovery = await ethers.getContractFactory("StakingRecoveryModule");
        recoveryModule = await Recovery.deploy();
    });

    it("starts from the live frozen state with the attacker holding voting power", async () => {
        expect(await staking.frozen()).to.equal(true);
        expect(await staking.paused()).to.equal(true);
        expect(await staking.getCurrentVotes(ATTACKER)).to.equal(ATTACKER_STAKE.mul(10));
        expect(await staking.getCurrentVotes(ATTACKER_SECONDARY)).to.equal(
            ATTACKER_SECONDARY_STAKE.mul(10)
        );
        // neither address holds voting power delegated in by anyone else
        const [, attackerStakes] = await staking.getStakes(ATTACKER);
        const [, secondaryStakes] = await staking.getStakes(ATTACKER_SECONDARY);
        expect(attackerStakes.length).to.equal(1);
        expect(secondaryStakes.length).to.equal(1);
    });

    it("stakes 10M SOV for the Guardians Safe in one atomic bundle", async () => {
        // the Exchequer funds the Guardians Safe, as planned
        await sov.connect(exchequer).transfer(GUARDIANS_SAFE, STAKE_AMOUNT);

        const now = (await ethers.provider.getBlock("latest")).timestamp;
        guardiansLockDate = await staking.timestampToLockDate(now + 1092 * 24 * 3600);

        // everything below is one Safe transaction in production
        await staking.connect(guardians).freezeUnfreeze(false);
        await staking.connect(guardians).pauseUnpause(false);
        await sov.connect(guardians).approve(STAKING, STAKE_AMOUNT);
        await staking
            .connect(guardians)
            .stake(STAKE_AMOUNT, guardiansLockDate, GUARDIANS_SAFE, DELEGATEE);
        await staking.connect(guardians).freezeUnfreeze(true);

        expect(await staking.frozen()).to.equal(true);
        expect(await staking.paused()).to.equal(true);
        // the designated voter holds the full 10x weighted power
        expect(await staking.getCurrentVotes(DELEGATEE)).to.equal(STAKE_AMOUNT.mul(10));
        expect(await staking.getCurrentVotes(ATTACKER)).to.equal(ATTACKER_STAKE.mul(10));
    });

    it("out-votes the attacker by the margin the plan assumes", async () => {
        const forVotes = await staking.getCurrentVotes(DELEGATEE);
        const against = (await staking.getCurrentVotes(ATTACKER)).add(
            await staking.getCurrentVotes(ATTACKER_SECONDARY)
        );
        const friendly = ethers.BigNumber.from("37971014262210961513481500");
        const total = forVotes.add(friendly);
        // GovernorAlpha defeats a proposal unless forVotes > 70% of votes cast
        expect(total.mul(100).gt(total.add(against).mul(70))).to.equal(true);
    });

    it("executes the SIP: recovers both stakes and removes the module", async () => {
        const exchequerBefore = await sov.balanceOf(EXCHEQUER);
        {
            const bn = (await ethers.provider.getBlockNumber()) - 1;
            const t = (await ethers.provider.getBlock(bn)).timestamp;
            totalVotingPowerBefore = await staking.getPriorTotalVotingPower(bn, t);
            recoveredWeight = ethers.BigNumber.from(0);
            for (const who of [ATTACKER, ATTACKER_SECONDARY, GUARDIANS_SAFE]) {
                recoveredWeight = recoveredWeight.add(
                    await staking.getPriorWeightedStake(who, bn, t)
                );
            }
        }
        const totalBefore = await staking.getPriorTotalStakesForDate(
            ATTACKER_LOCK_DATE,
            (await ethers.provider.getBlockNumber()) - 1
        );

        await proxy.connect(timelock).addModule(recoveryModule.address);
        const attackerTx = await (await staking.connect(timelock).recoverAttackerStake()).wait();
        const guardiansTx = await (
            await staking.connect(timelock).recoverGuardiansStake(guardiansLockDate)
        ).wait();
        // the whole SIP runs in one transaction, so both recoveries plus the
        // module changes must fit one RSK block (10M gas)
        console.log(
            `        recovery gas on mainnet state: attacker ${attackerTx.gasUsed}, ` +
                `guardians ${guardiansTx.gasUsed}`
        );
        expect(attackerTx.gasUsed.add(guardiansTx.gasUsed)).to.be.lt(500000);
        // with the positions empty, a repeat call finds nothing to move
        const afterFirstRecovery = await sov.balanceOf(EXCHEQUER);
        await expect(staking.connect(timelock).recoverAttackerStake()).to.be.revertedWith(
            "nothing staked to recover"
        );
        await expect(
            staking.connect(timelock).recoverGuardiansStake(guardiansLockDate)
        ).to.be.revertedWith("nothing staked to recover");
        expect(await sov.balanceOf(EXCHEQUER)).to.equal(afterFirstRecovery);

        await proxy.connect(timelock).removeModule(recoveryModule.address);

        // the SOV is back with the treasury, penalty free and in full
        expect(await sov.balanceOf(EXCHEQUER)).to.equal(
            exchequerBefore.add(ATTACKER_STAKE).add(ATTACKER_SECONDARY_STAKE).add(STAKE_AMOUNT)
        );

        // both positions and their voting power are gone
        expect(await staking.getCurrentVotes(ATTACKER)).to.equal(0);
        expect(await staking.getCurrentVotes(ATTACKER_SECONDARY)).to.equal(0);
        expect(await staking.getCurrentVotes(DELEGATEE)).to.equal(0);
        const [dates, stakes] = await staking.getStakes(ATTACKER);
        expect(stakes.every((s) => s.isZero())).to.equal(true);

        // totals stayed consistent - every recovered stake left the daily total.
        // The Guardians staked to the same maximum lock date as the attacker, so
        // that date carries both positions and must drop by both amounts.
        const totalAfter = await staking.getPriorTotalStakesForDate(
            ATTACKER_LOCK_DATE,
            (await ethers.provider.getBlockNumber()) - 1
        );
        const recoveredOnThatDate = guardiansLockDate.eq(ATTACKER_LOCK_DATE)
            ? ATTACKER_STAKE.add(ATTACKER_SECONDARY_STAKE).add(STAKE_AMOUNT)
            : ATTACKER_STAKE.add(ATTACKER_SECONDARY_STAKE);
        expect(totalBefore.sub(totalAfter)).to.equal(recoveredOnThatDate);

        // the one-off functions are no longer reachable
        const sel = recoveryModule.interface.getSighash("recoverAttackerStake");
        expect(await proxy.getFuncImplementation(sel)).to.equal(ethers.constants.AddressZero);
        await expect(staking.connect(timelock).recoverAttackerStake()).to.be.reverted;
    });

    it("reduces total voting power by exactly the three recovered positions", async () => {
        // measured against live mainnet state, so every other staker on the
        // contract is a real position this must not disturb
        const at = async () => {
            const bn = (await ethers.provider.getBlockNumber()) - 1;
            return { bn, t: (await ethers.provider.getBlock(bn)).timestamp };
        };
        const { bn, t } = await at();
        expect(await staking.getPriorWeightedStake(ATTACKER, bn, t)).to.equal(0);
        expect(await staking.getPriorWeightedStake(ATTACKER_SECONDARY, bn, t)).to.equal(0);
        expect(await staking.getPriorWeightedStake(GUARDIANS_SAFE, bn, t)).to.equal(0);
        // the aggregate that quorum and the proposal threshold are drawn from
        // is still readable and consistent after three positions were removed
        const total = await staking.getPriorTotalVotingPower(bn, t);
        expect(total).to.be.gt(0);
        expect(total).to.equal(totalVotingPowerBefore.sub(recoveredWeight));
    });

    it("reopens staking and lets ordinary stakers stake and withdraw again", async () => {
        await staking.connect(guardians).freezeUnfreeze(false);
        await staking.connect(guardians).pauseUnpause(false);

        const amount = ethers.utils.parseEther("1000");
        await sov.connect(exchequer).transfer(ordinaryStaker.address, amount);
        await sov.connect(ordinaryStaker).approve(STAKING, amount);

        const now = (await ethers.provider.getBlock("latest")).timestamp;
        const lockDate = await staking.timestampToLockDate(now + 60 * 24 * 3600);
        await staking
            .connect(ordinaryStaker)
            .stake(amount, lockDate, ordinaryStaker.address, ordinaryStaker.address);
        // getCurrentVotes reads the checkpoint as of block.number - 1, so the
        // stake is only visible once a further block exists
        await network.provider.send("evm_mine");
        expect(await staking.getCurrentVotes(ordinaryStaker.address)).to.be.gt(0);

        // mine a block so the withdrawal is not in the staking checkpoint block
        await network.provider.send("evm_mine");
        await expect(
            staking.connect(ordinaryStaker).withdraw(amount, lockDate, ordinaryStaker.address)
        ).to.not.be.reverted;
    });
});
