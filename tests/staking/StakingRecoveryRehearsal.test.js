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

describeFork("Staking recovery dress rehearsal", () => {
    let staking, sov, safe, multisig, governor, recoveryModule;
    let safeOwners, safeThreshold, msOwners, msRequired;
    let guardiansLockDate, proposalId;
    let integrity; // pre-execution snapshot, checked in step 8
    let ordinaryStaker;

    before(async function () {
        this.timeout(1800000);
        await network.provider.request({
            method: "hardhat_reset",
            params: [{ forking: { jsonRpcUrl: RSK_RPC } }],
        });
        [ordinaryStaker] = await ethers.getSigners();

        staking = new ethers.Contract(STAKING, STAKING_ABI, ethers.provider);
        sov = new ethers.Contract(SOV, ERC20_ABI, ethers.provider);
        safe = new ethers.Contract(GUARDIANS_SAFE, SAFE_ABI, ethers.provider);
        multisig = new ethers.Contract(EXCHEQUER, MULTISIG_ABI, ethers.provider);
        governor = new ethers.Contract(GOVERNOR_OWNER, GOVERNOR_ABI, ethers.provider);

        safeOwners = await safe.getOwners();
        safeThreshold = (await safe.getThreshold()).toNumber();
        msOwners = await multisig.getOwners();
        msRequired = (await multisig.required()).toNumber();
    });

    it("step 1: the Exchequer multisig sends 10M SOV to the Guardians Safe", async () => {
        const before = await sov.balanceOf(GUARDIANS_SAFE);
        const data = new ethers.utils.Interface([
            "function transfer(address,uint256)",
        ]).encodeFunctionData("transfer", [GUARDIANS_SAFE, STAKE_AMOUNT]);

        // the real 3-of-7 flow: one owner submits, two more confirm
        const submitter = await impersonate(msOwners[0]);
        const id = (await multisig.transactionCount()).toNumber();
        await multisig.connect(submitter).submitTransaction(SOV, 0, data);
        for (let i = 1; i < msRequired; i++) {
            const confirmer = await impersonate(msOwners[i]);
            await multisig.connect(confirmer).confirmTransaction(id);
        }

        expect((await multisig.transactions(id)).executed).to.equal(true);
        expect((await sov.balanceOf(GUARDIANS_SAFE)).sub(before)).to.equal(STAKE_AMOUNT);
    });

    it("step 2: the Safe executes the atomic stake JSON from this repo", async () => {
        const file = path.join(
            __dirname,
            "../../safe/mainnet/Stake 10M SOV Atomic (unfreeze-stake-refreeze).json"
        );
        const batch = JSON.parse(fs.readFileSync(file, "utf8"));
        expect(batch.chainId).to.equal("30");
        expect(batch.transactions.length).to.equal(5);

        const calls = batch.transactions.map(encodeBuilderTx);
        const multiSendData = encodeMultiSend(calls);

        // operation 1 = delegatecall into MultiSendCallOnly, one transaction
        await safeExec(safe, safeOwners, safeThreshold, MULTISEND_CALL_ONLY, multiSendData, 1);

        expect(await staking.frozen()).to.equal(true);
        expect(await staking.paused()).to.equal(true);
        await network.provider.send("evm_mine");
        expect(await staking.getCurrentVotes(DELEGATEE)).to.be.gt(0);

        const [dates, stakes] = await staking.getStakes(GUARDIANS_SAFE);
        expect(dates.length).to.equal(1);
        expect(stakes[0]).to.equal(STAKE_AMOUNT);
        guardiansLockDate = dates[0];
    });

    it("step 3: the recovery module is deployed", async () => {
        // RECOVERY_MODULE_ADDRESS points the rehearsal at a module that is
        // ALREADY deployed on the forked chain, instead of compiling a fresh
        // one. For the final rehearsal this is the point: the proposal will
        // register the mainnet artifact, so that is what must be exercised,
        // down to its deployed bytecode. Unset, it deploys a fresh copy, which
        // is what the earlier rehearsals did.
        const existing = process.env.RECOVERY_MODULE_ADDRESS;
        if (existing) {
            const code = await ethers.provider.getCode(existing);
            expect(code, `no contract at ${existing} on the fork`).to.not.equal("0x");
            recoveryModule = await ethers.getContractAt("StakingRecoveryModule", existing);
            console.log(`        using the DEPLOYED module at ${existing}`);
        } else {
            const Recovery = await ethers.getContractFactory("StakingRecoveryModule");
            recoveryModule = await Recovery.deploy();
            console.log(`        deployed a fresh module at ${recoveryModule.address}`);
        }

        // Every constant the sweep depends on, read from whichever module is in play.
        expect(await recoveryModule.ATTACKER_LOCK_DATE()).to.equal(1884076095);
        expect((await recoveryModule.ATTACKER()).toLowerCase()).to.equal(
            "0xac3ece58a142e829ef60f224f2fa8f4c98d6dee8"
        );
        expect((await recoveryModule.ATTACKER_SECONDARY()).toLowerCase()).to.equal(
            "0x92972392e3afbd8c0f417441325b8688e2b7e774"
        );
        expect((await recoveryModule.GUARDIANS_SAFE()).toLowerCase()).to.equal(
            "0xdd8e07a57560ada0a2d84a96c457a5e6ddd488b7"
        );
        expect((await recoveryModule.EXCHEQUER()).toLowerCase()).to.equal(
            "0x924f5ad34698fd20c90fe5d5a8a0abd3b42dc711"
        );
        expect(await recoveryModule.getFunctionsList()).to.deep.equal([
            "0x0b5d2269",
            "0xee7dc0b3",
        ]);
    });

    it("step 5: the proposal is created through GovernorAlpha", async () => {
        // Build the proposal with the REAL sipArgs function rather than a
        // hand-copied shape, so the description actually proposed here - SIP
        // document link and sha256 included - is the one mainnet will carry,
        // and assertDescriptionFinalized runs over it.
        //
        // getArgsSipStakingRecovery resolves StakingProxy and
        // StakingRecoveryModule through hardhat-deploy. The `hardhat` network
        // this fork runs on has no externalDeployments entry, so `get` is
        // stubbed with the two mainnet addresses instead of widening the repo
        // config the night before a deployment. Everything else - the on-chain
        // Guardians-position read, the encoding, the description - is the real
        // code path.
        const { getArgsSipStakingRecovery } = require("../../hardhat/tasks/sips/args/sipArgs");
        const known = {
            StakingProxy: STAKING,
            StakingRecoveryModule: recoveryModule.address,
        };
        const { args: sipArgs, governor: sipGovernor } = await getArgsSipStakingRecovery({
            ethers,
            deployments: {
                get: async (name) => {
                    if (!known[name]) throw new Error(`unexpected deployment lookup: ${name}`);
                    return { address: known[name] };
                },
            },
        });

        expect(sipGovernor).to.equal("GovernorOwner");

        const targets = sipArgs.targets;
        const values = sipArgs.values;
        const signatures = sipArgs.signatures;
        const calldatas = sipArgs.data;
        const description = sipArgs.description;

        // The description is what binds the calldata to an approved document.
        expect(description, "SIP description still carries placeholders").to.not.match(
            /SIP-XXXX|_{4,}/
        );
        expect(description).to.contain("SIP-0095");
        expect(description).to.contain(
            "https://github.com/DistributedCollective/SIPS/blob/a86654f/SIP-0095.md"
        );
        expect(description).to.contain(
            "sha256: 2d2b6aafb511e999f5f8d3b3f791f47e52eb4285f18915c469c413a4eda178d4"
        );

        // The builder must have read the Guardians lock date off chain, not guessed it.
        expect(calldatas[2]).to.equal(
            ethers.utils.defaultAbiCoder.encode(["uint256"], [guardiansLockDate])
        );
        expect(signatures).to.deep.equal([
            "addModule(address)",
            "recoverAttackerStake()",
            "recoverGuardiansStake(uint256)",
            "removeModule(address)",
        ]);
        console.log(
            `        proposing with the real sipArgs description:\n        ${description}`
        );

        const proposer = await impersonate(DELEGATEE);
        expect(await staking.getCurrentVotes(DELEGATEE)).to.be.gt(
            await governor.proposalThreshold()
        );
        await governor
            .connect(proposer)
            .propose(targets, values, signatures, calldatas, description);
        proposalId = (await governor.proposalCount()).toNumber();
        expect(STATE_NAMES[await governor.state(proposalId)]).to.equal("Pending");
    });

    it("step 6: it is voted through, attacker opposing", async () => {
        await network.provider.send("hardhat_mine", ["0x2"]);
        expect(STATE_NAMES[await governor.state(proposalId)]).to.equal("Active");

        const forVoter = await impersonate(DELEGATEE);
        await governor.connect(forVoter).castVote(proposalId, true);
        for (const who of FRIENDLY_VOTERS) {
            const s = await impersonate(who);
            await governor.connect(s).castVote(proposalId, true);
        }
        for (const who of [ATTACKER, ATTACKER_SECONDARY]) {
            const s = await impersonate(who);
            await governor.connect(s).castVote(proposalId, false);
        }

        const p = await governor.proposals(proposalId);
        console.log(
            `        for ${(+ethers.utils.formatEther(p.forVotes)).toFixed(0)} ` +
                `against ${(+ethers.utils.formatEther(p.againstVotes)).toFixed(0)} ` +
                `quorum ${(+ethers.utils.formatEther(p.quorum)).toFixed(0)}`
        );

        await network.provider.send("hardhat_mine", [ethers.utils.hexValue(VOTING_PERIOD + 2)]);
        expect(STATE_NAMES[await governor.state(proposalId)]).to.equal("Succeeded");
    });

    it("step 7: it is queued and executed through the timelock", async () => {
        const exchequerBefore = await sov.balanceOf(EXCHEQUER);

        // Snapshot everything step 8 needs to prove the sweep did not damage
        // the staking ledger: total voting power, the three positions that are
        // meant to move, and real third-party stakers that must not.
        const snapBlock = await ethers.provider.getBlockNumber();
        const snapTime = (await ethers.provider.getBlock(snapBlock)).timestamp;
        integrity = {
            block: snapBlock,
            time: snapTime,
            totalVP: await staking.getPriorTotalVotingPower(snapBlock - 1, snapTime),
            swept: {},
            bystanders: {},
        };
        // Voting power is counted against the DELEGATEE, not the staker. The
        // Guardians Safe delegated its 10M to DELEGATEE, so getCurrentVotes on
        // the Safe itself reads zero and the weight to account for sits with
        // the delegatee. Summing the Safe here would under-count the sweep by
        // the whole defensive stake.
        for (const who of [ATTACKER, ATTACKER_SECONDARY, DELEGATEE]) {
            integrity.swept[who] = await staking.getCurrentVotes(who);
        }
        expect(integrity.swept[GUARDIANS_SAFE], "Safe should hold no votes itself").to.equal(
            undefined
        );
        expect(await staking.getCurrentVotes(GUARDIANS_SAFE)).to.equal(0);
        for (const who of FRIENDLY_VOTERS) {
            const [dates, stakes] = await staking.getStakes(who);
            integrity.bystanders[who] = {
                votes: await staking.getCurrentVotes(who),
                priorVotes: await staking.getPriorVotes(who, snapBlock - 1, snapTime),
                dates: dates.map(String),
                stakes: stakes.map(String),
            };
        }

        await governor.connect(await impersonate(DELEGATEE)).queue(proposalId);
        expect(STATE_NAMES[await governor.state(proposalId)]).to.equal("Queued");

        await network.provider.send("evm_increaseTime", [TIMELOCK_DELAY + 60]);
        await network.provider.send("evm_mine");

        const tx = await (
            await governor.connect(await impersonate(DELEGATEE)).execute(proposalId)
        ).wait();
        console.log(`        whole proposal executed in one tx, gas ${tx.gasUsed}`);
        expect(tx.gasUsed).to.be.lt(10000000);
        expect(STATE_NAMES[await governor.state(proposalId)]).to.equal("Executed");

        // step 8: the SOV is back with the treasury
        const recovered = (await sov.balanceOf(EXCHEQUER)).sub(exchequerBefore);
        console.log(`        recovered to Exchequer: ${ethers.utils.formatEther(recovered)} SOV`);
        expect(recovered).to.equal(
            ethers.BigNumber.from("5000510499479127579769477").add(STAKE_AMOUNT)
        );

        await network.provider.send("evm_mine");
        for (const who of [ATTACKER, ATTACKER_SECONDARY, DELEGATEE]) {
            expect(await staking.getCurrentVotes(who)).to.equal(0);
        }
        for (const who of [ATTACKER, ATTACKER_SECONDARY, GUARDIANS_SAFE]) {
            const [, stakes] = await staking.getStakes(who);
            expect(stakes.every((s) => s.isZero())).to.equal(true);
        }

        // the one-off module is gone again
        const sel = recoveryModule.interface.getSighash("recoverAttackerStake");
        expect(await staking.getFuncImplementation(sel)).to.equal(ethers.constants.AddressZero);

        // --- ledger integrity -------------------------------------------------
        const nowBlock = await ethers.provider.getBlockNumber();
        const nowTime = (await ethers.provider.getBlock(nowBlock)).timestamp;

        // 1. Total voting power fell by EXACTLY the weight of the three swept
        //    positions - no more (other stakers damaged) and no less (weight
        //    left behind).
        const sweptWeight = Object.values(integrity.swept).reduce(
            (a, b) => a.add(b),
            ethers.BigNumber.from(0)
        );
        const totalVPAfter = await staking.getPriorTotalVotingPower(nowBlock - 1, nowTime);
        console.log(
            `        total VP ${ethers.utils.formatEther(integrity.totalVP)} -> ` +
                `${ethers.utils.formatEther(totalVPAfter)} ` +
                `(swept ${ethers.utils.formatEther(sweptWeight)})`
        );
        expect(integrity.totalVP.sub(totalVPAfter)).to.equal(sweptWeight);

        // 2. History is not rewritten. Asked about the pre-execution block, the
        //    contract must still return the pre-execution answer.
        expect(
            await staking.getPriorTotalVotingPower(integrity.block - 1, integrity.time)
        ).to.equal(integrity.totalVP);

        // 3. Real third-party stakers are untouched, now and historically, in
        //    both their voting power and their checkpointed positions.
        for (const who of FRIENDLY_VOTERS) {
            const before = integrity.bystanders[who];
            expect(await staking.getCurrentVotes(who), `${who} current votes`).to.equal(
                before.votes
            );
            expect(
                await staking.getPriorVotes(who, integrity.block - 1, integrity.time),
                `${who} historical votes rewritten`
            ).to.equal(before.priorVotes);
            const [dates, stakes] = await staking.getStakes(who);
            expect(dates.map(String), `${who} lock dates`).to.deep.equal(before.dates);
            expect(stakes.map(String), `${who} staked amounts`).to.deep.equal(before.stakes);
        }

        // 4. The swept accounts keep their history too - the recovery is a
        //    withdrawal, not an erasure of the record that they ever staked.
        for (const who of [ATTACKER, ATTACKER_SECONDARY, DELEGATEE]) {
            expect(
                await staking.getPriorVotes(who, integrity.block - 1, integrity.time),
                `${who} historical votes must survive the sweep`
            ).to.equal(integrity.swept[who]);
        }
        console.log("        ledger integrity: total VP, checkpoints and history all consistent");
    });

    it("step 9: staking reopens from the Safe and ordinary stakers work", async () => {
        const iface = new ethers.utils.Interface([
            "function freezeUnfreeze(bool)",
            "function pauseUnpause(bool)",
        ]);
        await safeExec(
            safe,
            safeOwners,
            safeThreshold,
            STAKING,
            iface.encodeFunctionData("freezeUnfreeze", [false]),
            0
        );
        await safeExec(
            safe,
            safeOwners,
            safeThreshold,
            STAKING,
            iface.encodeFunctionData("pauseUnpause", [false]),
            0
        );
        expect(await staking.frozen()).to.equal(false);
        expect(await staking.paused()).to.equal(false);

        const amount = ethers.utils.parseEther("1000");
        const exchequer = await impersonate(EXCHEQUER);
        await sov.connect(exchequer).transfer(ordinaryStaker.address, amount);
        await new ethers.Contract(
            SOV,
            ["function approve(address,uint256)"],
            ordinaryStaker
        ).approve(STAKING, amount);
        const now = (await ethers.provider.getBlock("latest")).timestamp;
        const lockDate = await staking.timestampToLockDate(now + 4 * 1209600);
        await staking
            .connect(ordinaryStaker)
            .stake(amount, lockDate, ordinaryStaker.address, ordinaryStaker.address);
        await network.provider.send("evm_mine");
        await expect(
            staking.connect(ordinaryStaker).withdraw(amount, lockDate, ordinaryStaker.address)
        ).to.not.be.reverted;
    });
});
