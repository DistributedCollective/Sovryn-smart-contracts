/**
 * Full dress rehearsal of the staking recovery, against a fork of RSK mainnet.
 *
 * Unlike StakingRecoveryFork.test.js, which impersonates the final actor of
 * each step, this drives every step through the real machinery the operators
 * will use:
 *
 *   1. the Exchequer MultiSigWallet's submit/confirm flow sends the 10M SOV,
 *   2. the Contracts Guardians Safe executes the actual Transaction Builder
 *      JSON from this repo, through MultiSendCallOnly and execTransaction,
 *   3. the proposal is created, voted on, queued and executed through
 *      GovernorAlpha and the owner Timelock - so the signature strings and
 *      encoded calldata in sipArgs are proved, not assumed,
 *   4. staking is reopened from the Safe.
 *
 * Run with:
 *   RSK_FORK_TESTS=true __decryptionAlreadyDone__=TRUE npx hardhat test tests/staking/StakingRecoveryRehearsal.test.js
 */
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const RSK_RPC = process.env.RSK_FORK_RPC || "https://public-node.rsk.co";

const STAKING = "0x5684a06CaB22Db16d901fEe2A5C081b4C91eA40e";
const SOV = "0xEFc78fc7d48b64958315949279Ba181c2114ABBd";
const GUARDIANS_SAFE = "0xDd8e07A57560AdA0A2D84a96c457a5e6DDD488b7";
const EXCHEQUER = "0x924f5ad34698Fd20c90Fe5D5A8A0abd3b42dc711";
const GOVERNOR_OWNER = "0x6496DF39D000478a7A7352C01E0E713835051CcD";
const MULTISEND_CALL_ONLY = "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D";

const ATTACKER = "0xac3ecE58a142e829Ef60f224F2FA8F4c98d6dEE8";
const ATTACKER_SECONDARY = "0x92972392e3AfBd8C0F417441325b8688e2b7e774";
const DELEGATEE = "0x428A80f48aB417E17A12Ec81A2671c4846BdB2be";

// the three addresses that voted against the attacker's proposal
const FRIENDLY_VOTERS = [
    "0xFEe171A152C02F336021fb9E79b4fAc2304a9E7E",
    "0x163463B7DdBCE853832037A059f5c5E6606bF9c4",
    "0x0D1831ed7f1c5c55409A542D7e4Bdda0c1238E91",
];

const STAKE_AMOUNT = ethers.utils.parseEther("10000000");
const VOTING_PERIOD = 2880;
const TIMELOCK_DELAY = 172800;

const SAFE_ABI = [
    "function getOwners() view returns (address[])",
    "function getThreshold() view returns (uint256)",
    "function nonce() view returns (uint256)",
    "function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)",
    "function approveHash(bytes32 hashToApprove)",
    "function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool)",
];
const MULTISIG_ABI = [
    "function getOwners() view returns (address[])",
    "function required() view returns (uint256)",
    "function transactionCount() view returns (uint256)",
    "function submitTransaction(address destination, uint256 value, bytes data) returns (uint256)",
    "function confirmTransaction(uint256 transactionId)",
    "function transactions(uint256) view returns (address destination, uint256 value, bytes data, bool executed)",
];
const GOVERNOR_ABI = [
    "function propose(address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, string description) returns (uint256)",
    "function castVote(uint256 proposalId, bool support)",
    "function queue(uint256 proposalId)",
    "function execute(uint256 proposalId)",
    "function state(uint256 proposalId) view returns (uint8)",
    "function proposalCount() view returns (uint256)",
    "function proposalThreshold() view returns (uint96)",
    "function proposals(uint256) view returns (uint256 id, uint32 startBlock, uint32 endBlock, uint96 forVotes, uint96 againstVotes, uint96 quorum, uint96 majorityPercentage, uint64 eta, uint64 startTime, bool canceled, bool executed, address proposer)",
];
const STAKING_ABI = [
    "function frozen() view returns (bool)",
    "function paused() view returns (bool)",
    "function freezeUnfreeze(bool)",
    "function pauseUnpause(bool)",
    "function stake(uint96 amount, uint256 until, address stakeFor, address delegatee)",
    "function withdraw(uint96 amount, uint256 until, address receiver)",
    "function getCurrentVotes(address) view returns (uint96)",
    "function getPriorTotalVotingPower(uint32 blockNumber, uint256 time) view returns (uint96)",
    "function getPriorVotes(address account, uint256 blockNumber, uint256 date) view returns (uint96)",
    "function getStakes(address) view returns (uint256[], uint96[])",
    "function timestampToLockDate(uint256) view returns (uint256)",
    "function getFuncImplementation(bytes4) view returns (address)",
];
const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256) returns (bool)",
];

const STATE_NAMES = [
    "Pending",
    "Active",
    "Canceled",
    "Defeated",
    "Succeeded",
    "Queued",
    "Expired",
    "Executed",
];

async function impersonate(address) {
    await network.provider.request({ method: "hardhat_impersonateAccount", params: [address] });
    await network.provider.send("hardhat_setBalance", [address, "0x3635C9ADC5DEA00000"]);
    return ethers.getSigner(address);
}

/** Turn one Safe Transaction Builder entry into {to, data}. */
function encodeBuilderTx(entry) {
    const m = entry.contractMethod;
    const types = m.inputs.map((i) => i.type);
    const frag = `function ${m.name}(${types.join(",")})`;
    const iface = new ethers.utils.Interface([frag]);
    const args = m.inputs.map((i) => {
        const raw = entry.contractInputsValues[i.name];
        return i.type === "bool" ? raw === "true" : raw;
    });
    return { to: entry.to, data: iface.encodeFunctionData(m.name, args) };
}

/** Pack calls the way MultiSend expects: operation, to, value, len, data. */
function encodeMultiSend(calls) {
    const packed = calls
        .map((c) =>
            ethers.utils.solidityPack(
                ["uint8", "address", "uint256", "uint256", "bytes"],
                [0, c.to, 0, ethers.utils.hexDataLength(c.data), c.data]
            )
        )
        .map((h) => h.slice(2))
        .join("");
    return new ethers.utils.Interface([
        "function multiSend(bytes transactions)",
    ]).encodeFunctionData("multiSend", ["0x" + packed]);
}

/** Approve the Safe tx hash from `count` owners and build pre-validated sigs. */
async function safeExec(safe, owners, threshold, to, data, operation) {
    const nonce = await safe.nonce();
    const hash = await safe.getTransactionHash(
        to,
        0,
        data,
        operation,
        0,
        0,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        nonce
    );
    const signers = owners.slice(0, threshold);
    for (const owner of signers) {
        const s = await impersonate(owner);
        await safe.connect(s).approveHash(hash);
    }
    // pre-validated signature format: r = owner, s = 0, v = 1
    const sigs =
        "0x" +
        signers
            .slice()
            .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
            .map(
                (o) =>
                    ethers.utils.hexZeroPad(o, 32).slice(2) +
                    ethers.utils.hexZeroPad("0x00", 32).slice(2) +
                    "01"
            )
            .join("");
    const executor = await impersonate(signers[0]);
    return safe
        .connect(executor)
        .execTransaction(
            to,
            0,
            data,
            operation,
            0,
            0,
            0,
            ethers.constants.AddressZero,
            ethers.constants.AddressZero,
            sigs
        );
}

// These drive a fork of live RSK mainnet: they need network access and take
// minutes, so `npx hardhat test` skips them. Run them explicitly with
// RSK_FORK_TESTS=true.
const describeFork = process.env.RSK_FORK_TESTS === "true" ? describe : describe.skip;

/**
 * LIVE-STATE EXECUTION TEST.
 *
 * The rehearsal funds the Guardians Safe and stakes for it. That has now
 * happened for real on mainnet, so re-running those steps against a fresh fork
 * would double-stake. This test forks mainnet AS IT STANDS and exercises only
 * what is left: create the proposal with the real sipArgs builder, vote, queue,
 * wait out the timelock, execute, and check the ledger afterwards.
 *
 * Run: RSK_FORK_TESTS=true npx hardhat test tests/staking/StakingRecoveryExecuteLive.test.js
 */
describeFork("SIP-0095 execution against live mainnet state", () => {
    let staking, sov, governor, proposalId, guardiansLockDate, integrity;

    const impersonate = async (addr) => {
        await network.provider.request({ method: "hardhat_impersonateAccount", params: [addr] });
        await network.provider.send("hardhat_setBalance", [addr, "0x3635C9ADC5DEA00000"]);
        return ethers.getSigner(addr);
    };

    before(async function () {
        this.timeout(1800000);
        await network.provider.request({
            method: "hardhat_reset",
            params: [{ forking: { jsonRpcUrl: RSK_RPC } }],
        });
        staking = await ethers.getContractAt(STAKING_ABI, STAKING);
        sov = await ethers.getContractAt(ERC20_ABI, SOV);
        governor = await ethers.getContractAt(GOVERNOR_ABI, GOVERNOR_OWNER);
    });

    it("live state is ready: frozen, staked, module deployed but not registered", async () => {
        expect(await staking.frozen(), "staking must be frozen").to.equal(true);
        expect(await staking.paused(), "staking must be paused").to.equal(true);

        const [dates, stakes] = await staking.getStakes(GUARDIANS_SAFE);
        expect(dates.length, "Guardians must hold exactly one position").to.equal(1);
        expect(stakes[0]).to.equal(STAKE_AMOUNT);
        guardiansLockDate = dates[0];
        console.log(
            `        Guardians: ${ethers.utils.formatEther(stakes[0])} SOV at ${guardiansLockDate}`
        );

        const mod = await ethers.getContractAt(
            "StakingRecoveryModule",
            "0x33bE65Cc9865EF26C8997358C9705D31e6c7b4EF"
        );
        expect(await mod.ATTACKER_LOCK_DATE()).to.equal(1884076095);
        for (const sel of await mod.getFunctionsList()) {
            expect(
                await staking.getFuncImplementation(sel),
                "module must NOT be registered yet"
            ).to.equal(ethers.constants.AddressZero);
        }
    });

    it("creates the proposal from the real sipArgs builder", async () => {
        const { getArgsSipStakingRecovery } = require("../../hardhat/tasks/sips/args/sipArgs");
        const known = {
            StakingProxy: STAKING,
            StakingRecoveryModule: "0x33bE65Cc9865EF26C8997358C9705D31e6c7b4EF",
        };
        const { args } = await getArgsSipStakingRecovery({
            ethers,
            deployments: {
                get: async (n) => {
                    if (!known[n]) throw new Error(`unexpected lookup: ${n}`);
                    return { address: known[n] };
                },
            },
        });

        expect(args.description).to.not.match(/SIP-XXXX|_{4,}/);
        expect(args.description).to.contain("blob/a86654f/SIP-0095.md");
        expect(args.description).to.contain(
            "sha256: 2d2b6aafb511e999f5f8d3b3f791f47e52eb4285f18915c469c413a4eda178d4"
        );
        expect(args.data[2]).to.equal(
            ethers.utils.defaultAbiCoder.encode(["uint256"], [guardiansLockDate])
        );

        const proposer = await impersonate(FRIENDLY_VOTERS[0]);
        expect(await staking.getCurrentVotes(FRIENDLY_VOTERS[0])).to.be.gt(
            await governor.proposalThreshold()
        );
        await governor
            .connect(proposer)
            .propose(args.targets, args.values, args.signatures, args.data, args.description);
        proposalId = (await governor.proposalCount()).toNumber();
        expect(STATE_NAMES[await governor.state(proposalId)]).to.equal("Pending");
        console.log(`        proposal ${proposalId} created`);
    });

    it("passes the vote with the real voters", async () => {
        await network.provider.send("hardhat_mine", ["0x2"]);
        expect(STATE_NAMES[await governor.state(proposalId)]).to.equal("Active");

        for (const who of [DELEGATEE, ...FRIENDLY_VOTERS]) {
            await governor.connect(await impersonate(who)).castVote(proposalId, true);
        }
        for (const who of [ATTACKER, ATTACKER_SECONDARY]) {
            await governor.connect(await impersonate(who)).castVote(proposalId, false);
        }

        const p = await governor.proposals(proposalId);
        console.log(
            `        for ${ethers.utils.formatEther(p.forVotes)} | against ${ethers.utils.formatEther(p.againstVotes)} | quorum ${ethers.utils.formatEther(p.quorum)}`
        );
        await network.provider.send("hardhat_mine", ["0x" + (VOTING_PERIOD + 2).toString(16)]);
        expect(STATE_NAMES[await governor.state(proposalId)]).to.equal("Succeeded");
    });

    it("queues, waits the timelock, executes and leaves the ledger intact", async () => {
        const exchequerBefore = await sov.balanceOf(EXCHEQUER);
        const snapBlock = await ethers.provider.getBlockNumber();
        const snapTime = (await ethers.provider.getBlock(snapBlock)).timestamp;
        integrity = { block: snapBlock, time: snapTime, swept: {}, bystanders: {} };
        integrity.totalVP = await staking.getPriorTotalVotingPower(snapBlock - 1, snapTime);
        for (const who of [ATTACKER, ATTACKER_SECONDARY, DELEGATEE]) {
            integrity.swept[who] = await staking.getCurrentVotes(who);
        }
        for (const who of FRIENDLY_VOTERS) {
            const [d, s] = await staking.getStakes(who);
            integrity.bystanders[who] = {
                votes: await staking.getCurrentVotes(who),
                dates: d.map(String),
                stakes: s.map(String),
            };
        }

        await governor.connect(await impersonate(DELEGATEE)).queue(proposalId);
        expect(STATE_NAMES[await governor.state(proposalId)]).to.equal("Queued");
        await network.provider.send("evm_increaseTime", [TIMELOCK_DELAY + 60]);
        await network.provider.send("evm_mine");

        const tx = await (
            await governor.connect(await impersonate(DELEGATEE)).execute(proposalId)
        ).wait();
        expect(STATE_NAMES[await governor.state(proposalId)]).to.equal("Executed");
        console.log(`        executed in one tx, gas ${tx.gasUsed}`);

        const recovered = (await sov.balanceOf(EXCHEQUER)).sub(exchequerBefore);
        console.log(`        recovered: ${ethers.utils.formatEther(recovered)} SOV`);
        expect(recovered).to.equal(
            ethers.BigNumber.from("5000510499479127579769477").add(STAKE_AMOUNT)
        );

        await network.provider.send("evm_mine");
        for (const who of [ATTACKER, ATTACKER_SECONDARY, DELEGATEE]) {
            expect(await staking.getCurrentVotes(who)).to.equal(0);
        }
        for (const who of [ATTACKER, ATTACKER_SECONDARY, GUARDIANS_SAFE]) {
            const [, s] = await staking.getStakes(who);
            expect(s.every((x) => x.isZero())).to.equal(true);
        }
        const mod = await ethers.getContractAt(
            "StakingRecoveryModule",
            "0x33bE65Cc9865EF26C8997358C9705D31e6c7b4EF"
        );
        for (const sel of await mod.getFunctionsList()) {
            expect(await staking.getFuncImplementation(sel)).to.equal(
                ethers.constants.AddressZero
            );
        }

        const nowBlock = await ethers.provider.getBlockNumber();
        const nowTime = (await ethers.provider.getBlock(nowBlock)).timestamp;
        const sweptWeight = Object.values(integrity.swept).reduce(
            (a, b) => a.add(b),
            ethers.BigNumber.from(0)
        );
        const totalAfter = await staking.getPriorTotalVotingPower(nowBlock - 1, nowTime);
        console.log(
            `        total VP ${ethers.utils.formatEther(integrity.totalVP)} -> ${ethers.utils.formatEther(totalAfter)} (swept ${ethers.utils.formatEther(sweptWeight)})`
        );
        expect(integrity.totalVP.sub(totalAfter)).to.equal(sweptWeight);
        expect(
            await staking.getPriorTotalVotingPower(integrity.block - 1, integrity.time)
        ).to.equal(integrity.totalVP);
        for (const who of FRIENDLY_VOTERS) {
            const b = integrity.bystanders[who];
            expect(await staking.getCurrentVotes(who), `${who} votes`).to.equal(b.votes);
            const [d, s] = await staking.getStakes(who);
            expect(d.map(String), `${who} dates`).to.deep.equal(b.dates);
            expect(s.map(String), `${who} stakes`).to.deep.equal(b.stakes);
        }
        console.log("        ledger integrity: total VP, positions and history consistent");
    });
});
