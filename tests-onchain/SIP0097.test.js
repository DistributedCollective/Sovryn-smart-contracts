// Manual release proof only. CI runs tests/, never this actual-mainnet-fork suite.
// env -i HOME=... PATH=... SIP0097_FORK_URL=http://127.0.0.1:18597 \
// SIP0097_DOCUMENT=/path/to/reviewed/SIP-0097.md node node_modules/mocha/bin/mocha --no-config --no-package --exit tests-onchain/SIP0097.test.js
const { assertNoSigningInputs } = require("../scripts/zero-emergency-halt/keyless");
assertNoSigningInputs();
const assert = require("assert");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { ethers: E } = require("ethers");
const sip = require("../hardhat/tasks/sips/args/sip0097");
const fixture = require("../tests/zero-emergency-halt/fixtures/ZeroSignatures.json");
const aftermath = require("./helpers/Sip0097Aftermath");
const root = path.resolve(__dirname, "..");
const ZERO = E.constants.AddressZero;
const low = (x) => x.toLowerCase();
const sha = (x) => crypto.createHash("sha256").update(x).digest("hex");
const errorData = E.utils.hexConcat([
    "0x08c379a0",
    E.utils.defaultAbiCoder.encode(["string"], ["Zero: emergency shutdown"]),
]);
const native = new Set([
    "getOwner()",
    "setOwner(address)",
    "getImplementation()",
    "setImplementation(address)",
]);
const voters = [
    "0xfee171a152c02f336021fb9e79b4fac2304a9e7e",
    "0x163463b7ddbce853832037a059f5c5e6606bf9c4",
    "0x78a0de7a48cce1a8759f353987731394d5c0ffa7",
    "0x3d170616c9402a2ff5771d85f38bd8f87f97d297",
];
const out = {
    startedUTC: new Date().toISOString(),
    baseline: sip.MANIFEST,
    scope: "Owned localhost actual RSK mainnet fork; real existing Governor, Timelock and prior votes; native gas funding only; no SOV mint/stake/storage/code changes",
    steps: [],
    proposals: [],
    selectorCoverage: [],
};
let p, hre, actor, governor, timelock, staking, halt, proposer, amm;
const result = process.env.SIP0097_RESULT || "/private/tmp/sip0097-fork-result.json";
function save() {
    fs.writeFileSync(result, JSON.stringify(out, null, 2) + "\n");
}
async function guard() {
    await sip.assertLocalFork(hre, sip.MANIFEST);
}
async function mutate(method, params = []) {
    await guard();
    return p.send(method, params);
}
async function tx(label, contract, method, args = [], signer = actor, extra = {}) {
    await guard();
    const request = await contract.populateTransaction[method](...args, {
        gasLimit: 9500000,
        ...extra,
    });
    const hash = await p.send("eth_sendTransaction", [
        {
            from: await signer.getAddress(),
            to: contract.address,
            data: request.data,
            gas: E.utils.hexValue(request.gasLimit),
            value: E.utils.hexValue(request.value || 0),
        },
    ]);
    const t = { hash };
    let raw;
    const receiptDeadline = Date.now() + 300000;
    while (!raw && Date.now() < receiptDeadline) {
        raw = await p.send("eth_getTransactionReceipt", [t.hash]);
        if (!raw) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert(raw, "owned automining receipt required");
    const r = p.formatter.receipt(raw);
    const transaction = await p.send("eth_getTransactionByHash", [hash]);
    const calldata = E.utils.arrayify(request.data);
    out.steps.push({
        label,
        hash: t.hash,
        block: r.blockNumber,
        status: r.status,
        gasUsed: r.gasUsed.toString(),
        gasLimit: request.gasLimit.toString(),
        calldataBytes: calldata.length,
        calldataSha256: sha(calldata),
        transaction,
        rawReceipt: raw,
        meter: "Anvil EVM receipt; not a Rootstock gas-meter guarantee",
    });
    save();
    if (r.status === 0)
        throw Object.assign(new Error("Actual governed transaction reverted"), { receipt: r });
    assert.equal(r.status, 1);
    save();
    console.log(label + " PASS");
    return r;
}
function contract(name) {
    const t = sip.MANIFEST.targets.find((x) => x.name === name);
    return new E.Contract(t.address, fixture.records[name].abi, p);
}
function proxy(t) {
    return new E.Contract(
        t.address,
        [...sip.PROXY_ABI, "function setImplementation(address)", "function setOwner(address)"],
        p
    );
}
let activeReads = 0;
const pendingReads = [];
async function readStorage(address, slot) {
    if (activeReads >= 8) await new Promise((resolve) => pendingReads.push(resolve));
    else activeReads++;
    try {
        return await p.getStorageAt(address, slot);
    } finally {
        const next = pendingReads.shift();
        if (next) next();
        else activeReads--;
    }
}
const linearSlotCounts = {
    BorrowerOperations: 16,
    TroveManager: 28,
    StabilityPool: 32,
    ZUSDToken: 16,
    ZEROToken: 16,
    ZEROStaking: 16,
    ActivePool: 8,
    CollSurplusPool: 8,
    DefaultPool: 8,
    FeeDistributor: 12,
    CommunityIssuance: 8,
    SortedTroves: 8,
    PriceFeed: 8,
    LiquityBaseParams: 12,
    HintHelpers: 8,
    MultiTroveGetter: 4,
};
async function snapshot() {
    const a = {};
    await Promise.all(
        sip.MANIFEST.targets.map(async (t) => {
            const slots = [
                ...Array(linearSlotCounts[t.name]).keys(),
                E.utils.id("key.ownable.owner"),
            ];
            // Explicit user token mappings, nonces and allowance, in addition to linear protocol state.
            if (["ZUSDToken", "ZEROToken"].includes(t.name)) {
                const balance = t.name === "ZUSDToken" ? 7 : 1,
                    allowance = t.name === "ZUSDToken" ? 8 : 2,
                    nonce = t.name === "ZUSDToken" ? 6 : 8;
                for (const who of [
                    await actor.getAddress(),
                    ...sip.MANIFEST.targets.map((x) => x.address),
                ]) {
                    for (const k of [balance, nonce])
                        slots.push(
                            E.utils.keccak256(
                                E.utils.defaultAbiCoder.encode(["address", "uint256"], [who, k])
                            )
                        );
                    const inner = E.utils.keccak256(
                        E.utils.defaultAbiCoder.encode(["address", "uint256"], [who, allowance])
                    );
                    slots.push(
                        E.utils.keccak256(
                            E.utils.defaultAbiCoder.encode(
                                ["address", "bytes32"],
                                [await actor.getAddress(), inner]
                            )
                        )
                    );
                }
            }
            if (t.name === "TroveManager") {
                const at = E.BigNumber.from(
                    E.utils.keccak256(
                        E.utils.defaultAbiCoder.encode(
                            ["address", "uint256"],
                            [await actor.getAddress(), 16]
                        )
                    )
                );
                for (let i = 0; i < 4; i++) slots.push(at.add(i).toHexString());
            }
            const values = await Promise.all(slots.map((k) => readStorage(t.address, k)));
            a[t.name] = {
                owner: low(await proxy(t).getOwner()),
                native: (await p.getBalance(t.address)).toString(),
                storage: values,
            };
        })
    );
    a.amm = await amm.snapshot();
    return a;
}
function custody(state) {
    const copy = JSON.parse(JSON.stringify(state));
    delete copy.amm.registry;
    return copy;
}
async function pointers(part, expected) {
    for (const t of sip.MANIFEST.targets.filter((t) => !part || t.part === part))
        assert.equal(
            low(await proxy(t).getImplementation()),
            low(expected === "baseline" ? t.implementation : halt.address),
            t.name + " implementation"
        );
}
async function exactRevert(to, data, value = "0x0") {
    let actual,
        accepted = false;
    try {
        actual = await p.send("eth_call", [
            { to, data, value, from: await actor.getAddress() },
            "latest",
        ]);
        accepted = true;
    } catch (e) {
        actual = e.error?.data ?? e.data;
        if (actual && typeof actual === "object") actual = actual.data ?? actual.result;
    }
    assert.equal(
        actual,
        errorData,
        `${to} ${data}: expected exact shutdown revert, ${accepted ? "call accepted" : "different revert"} ${JSON.stringify(actual)}`
    );
    assert.equal(accepted, false, "call must revert, not return encoded error");
}
async function selectors(targets) {
    for (const t of targets) {
        const iface = contract(t.name).interface;
        let count = 0;
        for (const signature of Object.keys(iface.functions)) {
            if (native.has(signature)) continue;
            await exactRevert(t.address, iface.getSighash(signature));
            count++;
        }
        for (const data of [
            "0x",
            "0x01",
            "0x0102",
            "0x010203",
            "0xdeadbeef",
            "0xdeadbeef1122334455",
        ])
            for (const value of ["0x0", "0x1"]) await exactRevert(t.address, data, value);
        out.selectorCoverage.push({
            name: t.name,
            delegatedSelectors: count,
            arbitraryValueCalls: 12,
        });
        save();
    }
}
async function mine(n) {
    if (n > 0) await mutate("anvil_mine", [E.utils.hexValue(n), "0x1e"]);
}
function arrays(args) {
    return [args.targets, args.values, args.signatures, args.data];
}
async function governed(label, args, fail = false) {
    const b = await p.getBlock("latest"),
        power = await staking.getPriorVotes(proposer, b.number - 1, b.timestamp);
    assert(power.gt(await governor.proposalThreshold()), "real proposer eligibility");
    const latest = await governor.latestProposalIds(proposer);
    if (!latest.isZero()) {
        const state = await governor.state(latest);
        assert(
            ![0, 1].includes(state),
            "existing proposer must have no pending or active proposal"
        );
    }
    const rec = {
        label,
        proposer,
        priorVotes: power.toString(),
        actions: args,
        votes: [],
        previousProposalId: latest.toString(),
    };
    out.proposals.push(rec);
    save();
    const gr = await tx(
        label + " propose",
        governor,
        "propose",
        [...arrays(args), args.description],
        p.getSigner(proposer)
    );
    rec.proposeReceiptHash = gr.transactionHash;
    const proposed = governor.interface.parseTransaction(
        await p.getTransaction(gr.transactionHash)
    );
    assert.equal(proposed.name, "propose");
    assert.equal(proposed.args[4], args.description, "exact stored description calldata");
    rec.descriptionUtf8Bytes = Buffer.byteLength(args.description);
    rec.descriptionSha256 = sha(args.description);
    rec.id = (await governor.proposalCount()).toString();
    const created = await governor.proposals(rec.id);
    rec.created = {
        startBlock: created.startBlock.toString(),
        endBlock: created.endBlock.toString(),
        startTime: created.startTime.toString(),
    };
    const actions = await governor.getActions(rec.id);
    for (let i = 0; i < 4; i++)
        assert.deepEqual(
            actions[i].map((x) => (typeof x === "string" ? low(x) : x.toString())),
            arrays(args)[i].map((x) => (typeof x === "string" ? low(x) : x.toString()))
        );
    await mine(
        Number(created.startBlock) - (await p.send("eth_blockNumber", []).then(Number)) + 1
    );
    assert.equal(await governor.state(rec.id), 1);
    for (const voter of voters) {
        const votes = await staking.getPriorVotes(voter, created.startBlock, created.startTime);
        if (votes.isZero()) continue;
        await tx(label + " vote", governor, "castVote", [rec.id, true], p.getSigner(voter));
        const receipt = await governor.getReceipt(rec.id, voter);
        assert(receipt.hasVoted && receipt.support && receipt.votes.eq(votes));
        rec.votes.push({
            voter,
            actualPriorVotes: votes.toString(),
            receiptVotes: receipt.votes.toString(),
        });
    }
    const voted = await governor.proposals(rec.id);
    assert(
        voted.forVotes.eq(
            rec.votes.reduce((s, v) => s.add(v.actualPriorVotes), E.BigNumber.from(0))
        )
    );
    assert(voted.forVotes.gte(voted.quorum), "real votes must meet quorum");
    await mine(Number(created.endBlock) - (await p.send("eth_blockNumber", []).then(Number)) + 1);
    assert.equal(await governor.state(rec.id), 4);
    const qr = await tx(label + " queue", governor, "queue", [rec.id]);
    const queued = await governor.proposals(rec.id);
    const delay = await timelock.delay();
    assert.equal(
        queued.eta.toNumber() - (await p.getBlock(qr.blockNumber)).timestamp,
        delay.toNumber()
    );
    assert.equal(delay.toString(), "172800");
    rec.eta = queued.eta.toString();
    rec.delaySeconds = delay.toString();
    rec.queueHashes = args.targets.map((target, i) =>
        E.utils.keccak256(
            E.utils.defaultAbiCoder.encode(
                ["address", "uint256", "string", "bytes", "uint256"],
                [target, args.values[i], args.signatures[i], args.data[i], queued.eta]
            )
        )
    );
    for (const hash of rec.queueHashes)
        assert.equal(await timelock.queuedTransactions(hash), true);
    let early = false;
    try {
        await governor.callStatic.execute(rec.id);
    } catch (e) {
        early = true;
    }
    assert(early, "timelock must reject early execution");
    await mutate("evm_setNextBlockTimestamp", [queued.eta.toNumber()]);
    await mutate("evm_mine");
    await amm.executionPrecheck();
    const before = await snapshot();
    rec.before = before;
    const beforePointers = await Promise.all(
        sip.MANIFEST.targets.map((t) => proxy(t).getImplementation())
    );
    if (fail) {
        let failure;
        try {
            await tx(label + " invalid execute", governor, "execute", [rec.id]);
        } catch (e) {
            failure = e;
        }
        assert(
            failure?.receipt && failure.receipt.status === 0,
            "actual failed transaction receipt required"
        );
        assert.equal(failure.receipt.logs.length, 0);
        assert.equal(await governor.state(rec.id), 5);
        assert.deepEqual(await snapshot(), before);
        assert.deepEqual(
            await Promise.all(sip.MANIFEST.targets.map((t) => proxy(t).getImplementation())),
            beforePointers
        );
        const after = await governor.proposals(rec.id);
        assert.equal(after.executed, false);
        for (const hash of rec.queueHashes)
            assert.equal(await timelock.queuedTransactions(hash), true);
        const failedTrace = await p.send("debug_traceTransaction", [
            failure.receipt.transactionHash,
            { tracer: "callTracer" },
        ]);
        const expectedSelectors = args.signatures.map((s) => E.utils.id(s).slice(0, 10)),
            attempted = [];
        function visit(call) {
            if (
                args.targets.some((t) => low(t) === low(call.to || "")) &&
                expectedSelectors.some((s) => call.input?.startsWith(s))
            )
                attempted.push(call);
            for (const child of call.calls || []) visit(child);
        }
        visit(failedTrace);
        assert(failedTrace.error);
        assert.equal(
            attempted.length,
            args.targets.length,
            "failed final action must actually be reached"
        );
        attempted.forEach((call, i) => {
            assert.equal(low(call.from), low(timelock.address));
            assert.equal(low(call.to), low(args.targets[i]));
            assert.equal(low(call.input), low(expectedSelectors[i] + args.data[i].slice(2)));
            if (i < attempted.length - 1) assert(!call.error);
            else assert(call.error);
        });
        rec.executedPrefixBeforeRollback = attempted.length - 1;
        rec.invalidFinalActionReached = true;
        rec.actualFailedReceipt = failure.receipt.transactionHash;
        rec.atomicRollback = true;
        rec.after = await snapshot();
        rec.trace = failedTrace;
    } else {
        const er = await tx(label + " execute", governor, "execute", [rec.id]);
        assert.equal(await governor.state(rec.id), 7);
        for (const hash of rec.queueHashes)
            assert.equal(await timelock.queuedTransactions(hash), false);
        assert.deepEqual(
            custody(await snapshot()),
            custody(before),
            "proxy raw storage/custody must only change at excluded implementation slot"
        );
        const trace = await p.send("debug_traceTransaction", [
            er.transactionHash,
            { tracer: "callTracer" },
        ]);
        const expectedSelectors = args.signatures.map((s) => E.utils.id(s).slice(0, 10));
        const found = [];
        function walk(c) {
            if (
                args.targets.some((t) => low(t) === low(c.to || "")) &&
                expectedSelectors.some((s) => c.input?.startsWith(s))
            ) {
                assert.equal(low(c.from), low(timelock.address));
                found.push(c);
            }
            for (const child of c.calls || []) walk(child);
        }
        walk(trace);
        assert.equal(found.length, args.targets.length);
        for (let i = 0; i < found.length; i++) {
            assert.equal(low(found[i].to), low(args.targets[i]));
            assert.equal(low(found[i].input), low(expectedSelectors[i] + args.data[i].slice(2)));
            assert(!found[i].error);
        }
        rec.genuineTimelockTargetCalls = found.length;
        rec.after = await snapshot();
        rec.trace = trace;
        rec.executionHash = er.transactionHash;
    }
    save();
    return rec;
}
function restoreArgs(part) {
    const t = sip.MANIFEST.targets.filter((x) => x.part === part);
    const keys = part === 0 ? sip.AMM.keys : [];
    return {
        targets: [...keys.map(() => sip.AMM.registry.address), ...t.map((x) => x.address)],
        values: [...keys.map(() => 0), ...t.map(() => 0)],
        signatures: [
            ...keys.map(() => "registerAddress(bytes32,address)"),
            ...t.map(() => "setImplementation(address)"),
        ],
        data: [
            ...keys.map((x) =>
                E.utils.defaultAbiCoder.encode(["bytes32", "address"], [x.key, x.address])
            ),
            ...t.map((x) => E.utils.defaultAbiCoder.encode(["address"], [x.implementation])),
        ],
        description:
            "LOCAL ONLY governed restoration proof; no production reopening authorization",
    };
}

// Representative genuine V1 controls. This is deliberately finite; no token
// balance/code/storage replacement, token-freeze test or synthetic converter.
function createAmm() {
    const converterAddress = "0xa9c3d9681215ef7623dc28ea6b75bf87fdf285d9";
    const converterHash = "0xe110f7f40508fa672a4dccbb09e45a3566382f75b40dc9bbce09ce28c0496417";
    const anchorAddress = "0x6f96096687952349dd5944e0eb1be327dcdeb705";
    const wrbtcAddress = "0x542fda317318ebf1d3deaf76e0b632741a7e677d";
    const xusdAddress = "0xb5999795be0ebb5bab23144aa5fd6a02d080299f";
    const registry = new E.Contract(
        sip.AMM.registry.address,
        [
            "function addressOf(bytes32) view returns(address)",
            "function owner() view returns(address)",
            "function newOwner() view returns(address)",
            "function itemCount() view returns(uint256)",
            "function contractNames(uint256) view returns(string)",
        ],
        p
    );
    const tokenAbi = [
        "function balanceOf(address) view returns(uint256)",
        "function totalSupply() view returns(uint256)",
        "function approve(address,uint256) returns(bool)",
        "function deposit() payable",
        "function owner() view returns(address)",
        "function transfersEnabled() view returns(bool)",
    ];
    const wrbtc = new E.Contract(wrbtcAddress, tokenAbi, p);
    const xusd = new E.Contract(xusdAddress, tokenAbi, p);
    const anchor = new E.Contract(anchorAddress, tokenAbi, p);
    const converter = new E.Contract(
        converterAddress,
        [
            "function anchor() view returns(address)",
            "function owner() view returns(address)",
            "function newOwner() view returns(address)",
            "function registry() view returns(address)",
            "function prevRegistry() view returns(address)",
            "function isActive() view returns(bool)",
            "function reserveBalance(address) view returns(uint256)",
            "function protocolFeeTokensHeld(address) view returns(uint256)",
            "function addLiquidity(address[],uint256[],uint256) payable",
            "function removeLiquidity(uint256,address[],uint256[])",
            "function fund(uint256) payable",
            "function liquidate(uint256)",
            "function convert(address,address,uint256,address,address) returns(uint256)",
        ],
        p
    );
    const network = new E.Contract(
        sip.AMM.keys[0].address,
        [
            "function convertByPath(address[],uint256,uint256,address,address,uint256) payable returns(uint256)",
        ],
        p
    );
    const catalog = new E.Contract(
        "0x31a0f8400c75d52fdb413372233f28e3bdfb1c06",
        ["function getAnchors() view returns(address[])"],
        p
    );
    const collector = new E.Contract(
        sip.AMM.fsc.address,
        [
            "function getWhitelistedConverterList() view returns(address[])",
            "function owner() view returns(address)",
            "function getProxyOwner() view returns(address)",
            "function getImplementation() view returns(address)",
            "function withdrawFeesAMM(address[])",
        ],
        p
    );
    const settings = new E.Contract(
        sip.AMM.settings.address,
        ["function feesController() view returns(address)"],
        p
    );
    let calls;
    out.ammControls = [];
    async function executionPrecheck() {
        assert.deepEqual(await collector.getWhitelistedConverterList(), []);
        assert.equal(low(await collector.owner()), low(sip.AMM.fsc.owner));
        assert.equal(low(await collector.getProxyOwner()), low(sip.AMM.fsc.owner));
        assert.equal(low(await collector.getImplementation()), low(sip.AMM.fsc.implementation));
        assert.equal(low(await settings.feesController()), low(sip.AMM.fsc.address));
        assert.equal(low(await registry.owner()), low(sip.AMM.registry.owner));
        assert.equal(low(await registry.newOwner()), low(sip.AMM.registry.newOwner));
        assert.equal(
            low(await registry.addressOf(E.utils.formatBytes32String("ContractRegistry"))),
            low(registry.address)
        );
        assert.equal(low(await registry.addressOf(sip.AMM.settings.key)), low(settings.address));
        for (const [address, hash] of [
            [registry.address, sip.AMM.registry.codeHash],
            [sip.AMM.inert.address, sip.AMM.inert.codeHash],
            [settings.address, sip.AMM.settings.codeHash],
            [collector.address, sip.AMM.fsc.codeHash],
            [sip.AMM.fsc.implementation, sip.AMM.fsc.implementationCodeHash],
        ])
            assert.equal(E.utils.keccak256(await p.getCode(address)), hash);
    }
    async function assertBindings(expected) {
        assert.deepEqual(
            await Promise.all(sip.AMM.keys.map(async (k) => low(await registry.addressOf(k.key)))),
            expected.map(low)
        );
    }
    async function snapshot() {
        await executionPrecheck();
        const user = await actor.getAddress();
        const entries = [];
        const count = (await registry.itemCount()).toNumber();
        for (let i = 0; i < count; i++) {
            const name = await registry.contractNames(i);
            entries.push({
                index: i,
                name,
                address: low(
                    await registry.addressOf(
                        E.utils.hexlify(
                            E.utils.concat([
                                E.utils.toUtf8Bytes(name),
                                new Uint8Array(32 - E.utils.toUtf8Bytes(name).length),
                            ])
                        )
                    )
                ),
            });
        }
        const tokens = [];
        for (const t of [wrbtc, xusd])
            tokens.push({
                address: low(t.address),
                supply: (await t.totalSupply()).toString(),
                physical: (await t.balanceOf(converter.address)).toString(),
                stored: (await converter.reserveBalance(t.address)).toString(),
                heldFees: (await converter.protocolFeeTokensHeld(t.address)).toString(),
                actorBalance: (await t.balanceOf(user)).toString(),
                networkBalance: (await t.balanceOf(network.address)).toString(),
            });
        return {
            registry: entries,
            converter: low(converter.address),
            owner: low(await converter.owner()),
            newOwner: low(await converter.newOwner()),
            converterRegistry: low(await converter.registry()),
            prevRegistry: low(await converter.prevRegistry()),
            active: await converter.isActive(),
            anchor: low(await converter.anchor()),
            anchorOwner: low(await anchor.owner()),
            transfersEnabled: await anchor.transfersEnabled(),
            lpSupply: (await anchor.totalSupply()).toString(),
            lpActor: (await anchor.balanceOf(user)).toString(),
            whitelist: await collector.getWhitelistedConverterList(),
            settings: low(settings.address),
            feeController: low(await settings.feesController()),
            tokens,
        };
    }
    async function bind() {
        assert.equal(E.utils.keccak256(await p.getCode(converter.address)), converterHash);
        assert.equal(low(await converter.anchor()), anchorAddress);
        assert.equal(low(await converter.registry()), low(sip.AMM.registry.address));
        assert.equal(low(await converter.owner()), low(sip.AMM.registry.owner));
        assert.equal(low(await anchor.owner()), converterAddress);
        assert.equal(await anchor.transfersEnabled(), true);
        await executionPrecheck();
        out.ammRepresentative = {
            converter: converterAddress,
            converterHash,
            anchor: anchorAddress,
            reserves: [wrbtcAddress, xusdAddress],
            original: await snapshot(),
        };
    }
    async function setup() {
        const user = await actor.getAddress();
        await tx("AMM genuine WRBTC wrap", wrbtc, "deposit", [], actor, {
            value: E.utils.parseEther("1"),
        });
        for (const t of [wrbtc, xusd])
            for (const spender of [network.address, converter.address])
                await tx("AMM genuine reserve approval", t, "approve", [
                    spender,
                    E.constants.MaxUint256,
                ]);
        const swapAmount = (await converter.reserveBalance(wrbtc.address)).div(100000);
        const before = await xusd.balanceOf(user);
        await tx("AMM positive installed Network direct swap forward", network, "convertByPath", [
            [wrbtc.address, anchor.address, xusd.address],
            swapAmount,
            1,
            user,
            ZERO,
            0,
        ]);
        const received = (await xusd.balanceOf(user)).sub(before);
        assert(received.gt(0));
        const reverse = received.div(4);
        const beforeWrbtc = await wrbtc.balanceOf(user);
        await tx("AMM positive installed Network direct swap reverse", network, "convertByPath", [
            [xusd.address, anchor.address, wrbtc.address],
            reverse,
            1,
            user,
            ZERO,
            0,
        ]);
        assert((await wrbtc.balanceOf(user)).gt(beforeWrbtc));
        const peer = received.div(4);
        const wrapped = peer
            .mul(await converter.reserveBalance(wrbtc.address))
            .div(await converter.reserveBalance(xusd.address))
            .add(1);
        const beforeLp = await anchor.balanceOf(user);
        await tx("AMM genuine LP acquisition", converter, "addLiquidity", [
            [wrbtc.address, xusd.address],
            [wrapped, peer],
            1,
        ]);
        const minted = (await anchor.balanceOf(user)).sub(beforeLp);
        assert(minted.gt(20));
        calls = {
            "swap forward": [
                network,
                "convertByPath",
                [[wrbtc.address, anchor.address, xusd.address], swapAmount, 1, user, ZERO, 0],
            ],
            "swap reverse": [
                network,
                "convertByPath",
                [[xusd.address, anchor.address, wrbtc.address], reverse, 1, user, ZERO, 0],
            ],
            "modern add": [
                converter,
                "addLiquidity",
                [[wrbtc.address, xusd.address], [wrapped, peer], 1],
            ],
            "modern remove": [
                converter,
                "removeLiquidity",
                [minted.div(10), [wrbtc.address, xusd.address], [1, 1]],
            ],
            "legacy fund": [converter, "fund", [minted.div(20)]],
            "legacy liquidate": [converter, "liquidate", [minted.div(10)]],
            "catalogue read": [catalog, "getAnchors", []],
        };
        out.ammSetup = {
            swapAmount: swapAmount.toString(),
            received: received.toString(),
            minted: minted.toString(),
            note: "Native wrap and actual swaps/LP mint; no token funding override",
        };
        save();
    }
    async function single(label, name, expected) {
        const [c, method, args] = calls[name];
        const request = await c.populateTransaction[method](...args);
        const rec = { label, name, to: c.address, data: request.data, expected };
        let error;
        try {
            rec.callResult = await p.send("eth_call", [
                {
                    from: await actor.getAddress(),
                    to: c.address,
                    data: request.data,
                    gas: "0x90f560",
                },
                "latest",
            ]);
        } catch (e) {
            error = e;
            rec.callError = e.message;
        }
        assert.equal(!error, expected, label + " eth_call baseline/rejection");
        if (name !== "catalogue read") {
            const snap = await mutate("evm_snapshot");
            const before = await snapshot();
            let failure, receipt;
            try {
                receipt = await tx(label, c, method, args);
            } catch (e) {
                failure = e;
            }
            if (expected) {
                assert(receipt && !failure, label + " mined positive receipt");
                rec.receipt = {
                    hash: receipt.transactionHash,
                    status: receipt.status,
                    block: receipt.blockNumber,
                };
            } else {
                assert(failure?.receipt?.status === 0, label + " mined reject receipt");
                assert.equal(failure.receipt.logs.length, 0);
                rec.receipt = {
                    hash: failure.receipt.transactionHash,
                    status: 0,
                    block: failure.receipt.blockNumber,
                };
                rec.trace = await p.send("debug_traceTransaction", [
                    failure.receipt.transactionHash,
                    { tracer: "callTracer" },
                ]);
                assert(rec.trace.error);
                const calls = [];
                function visit(c) {
                    calls.push(c);
                    for (const child of c.calls || []) visit(child);
                }
                visit(rec.trace);
                if (name.startsWith("swap"))
                    assert(
                        calls.some(
                            (c) =>
                                low(c.to || "") === converterAddress &&
                                c.revertReason === "ERR_ACCESS_DENIED"
                        ),
                        "old Network rejected at changed Network admission binding"
                    );
                else
                    assert(
                        calls.some((c) => low(c.to || "") === low(sip.AMM.inert.address)),
                        "LP path must reach selected inert Formula dependency"
                    );
                assert.deepEqual(
                    await snapshot(),
                    before,
                    label + " rejected finance/custody unchanged"
                );
            }
            await mutate("evm_revert", [snap]);
            assert.deepEqual(await snapshot(), before, label + " local control snapshot restored");
        }
        out.ammControls.push(rec);
        save();
    }
    async function controls(phase, expected) {
        for (const name of Object.keys(calls)) await single(phase + " " + name, name, expected);
    }
    return { bind, setup, snapshot, executionPrecheck, assertBindings, controls, single };
}

describe("SIP0097 actual owned RSK mainnet fork governance", function () {
    this.timeout(7200000);
    it("proves positive controls, three governed halts, atomic failures, complete selector rejection and governed restoration", async function () {
        const url = process.env.SIP0097_FORK_URL;
        assert(url, "explicit owned loopback SIP0097_FORK_URL required");
        p = new E.providers.JsonRpcProvider({ url, timeout: 600000 });
        p.pollingInterval = 100;
        hre = {
            network: { name: "sip0097OwnedFork", config: { url } },
            ethers: { provider: p },
            deployments: {
                get: async (name) => {
                    assert.equal(name, "GovernorOwner");
                    return { address: sip.MANIFEST.bindings.GovernorOwner.address };
                },
            },
        };
        await sip.assertFreshFork(hre, sip.MANIFEST);
        assert.equal(
            sha(fs.readFileSync(process.env.SIP0097_DOCUMENT)),
            sip.DOCUMENT.sha256,
            "reviewed immutable SIP bytes"
        );
        out.document = sip.DOCUMENT;
        assert(process.env.SIP0097_PRODUCTION_INPUTS, "read-only production inputs required");
        const production = JSON.parse(fs.readFileSync(process.env.SIP0097_PRODUCTION_INPUTS));
        assert.equal(production.document.sha256Actual, sip.DOCUMENT.sha256);
        assert.deepEqual(
            production.payloads.map((x) => x.args.targets.length),
            [3, 10, 6]
        );
        out.productionInputSha256 = sha(fs.readFileSync(process.env.SIP0097_PRODUCTION_INPUTS));
        out.gasContext = {
            localClient: await p.send("web3_clientVersion", []),
            localHeader: await p.send("eth_getBlockByNumber", ["latest", false]),
            rootstockHeader: production.currentRootstockHeader,
            measurement:
                "Local Anvil gas with exact production calldata/descriptions; live Rootstock read-only estimates are recorded separately.",
            sends: "Only guarded owned loopback chain31337",
        };
        actor = p.getSigner(0);
        await sip.validateGovernance(p, sip.MANIFEST.block);
        await sip.validateAmm(p, sip.MANIFEST.block);
        for (const t of sip.MANIFEST.targets) {
            assert.equal(E.utils.keccak256(await p.getCode(t.address)), t.proxyCodeHash);
            assert.equal(
                E.utils.keccak256(await p.getCode(t.implementation)),
                t.implementationCodeHash
            );
            assert.equal(low(await proxy(t).getOwner()), low(t.owner));
            assert.equal(low(await proxy(t).getImplementation()), low(t.implementation));
        }
        amm = createAmm();
        await amm.bind();
        const blockerCode = await p.getCode(sip.RELEASE_ADDRESS);
        assert.equal(E.utils.hexDataLength(blockerCode), 119, "verified deployed blocker length");
        assert.equal(
            E.utils.keccak256(blockerCode),
            sip.HALT_RUNTIME_HASH,
            "verified deployed blocker runtime"
        );
        halt = { address: sip.RELEASE_ADDRESS };
        hre.sip0097Local = { address: halt.address, pin: sip.MANIFEST };
        out.localBlocker = halt.address;
        out.preMutationBindings = {
            block: sip.MANIFEST.block,
            hash: sip.MANIFEST.hash,
            governance: true,
            zero16: true,
            ammFsc: true,
            representativeConverter: true,
        };
        save();
        governor = new E.Contract(
            sip.MANIFEST.bindings.GovernorOwner.address,
            require("../deployment/deployments/rskSovrynMainnet/GovernorOwner.json").abi,
            p
        );
        timelock = new E.Contract(
            sip.MANIFEST.bindings.TimelockOwner.address,
            require("../deployment/deployments/rskSovrynMainnet/TimelockOwner.json").abi,
            p
        );
        staking = new E.Contract(
            await governor.staking(),
            ["function getPriorVotes(address,uint256,uint256) view returns(uint96)"],
            p
        );
        assert.equal(low(staking.address), low(sip.MANIFEST.bindings.Staking.address));
        assert.equal(low(await governor.timelock()), low(timelock.address));
        assert.equal(low(await timelock.admin()), low(governor.address));
        proposer = voters[0];
        out.eligibility = [];
        const b = await p.getBlock("latest");
        for (const voter of voters) {
            assert.equal(await p.getCode(voter), "0x");
            out.eligibility.push({
                voter,
                power: (await staking.getPriorVotes(voter, b.number - 1, b.timestamp)).toString(),
            });
            await mutate("anvil_impersonateAccount", [voter]);
            await mutate("anvil_setBalance", [voter, "0x56bc75e2d63100000"]);
        }
        save();
        const bo = contract("BorrowerOperations"),
            tm = contract("TroveManager"),
            zusd = contract("ZUSDToken"),
            zero = contract("ZEROToken"),
            sp = contract("StabilityPool");
        const user = await actor.getAddress();
        // Real protocol creates the local user's debt/token position; no mint/authority impersonation.
        await tx(
            "positive normal openTrove",
            bo,
            "openTrove",
            [E.utils.parseEther("1"), E.utils.parseEther("3000"), ZERO, ZERO],
            actor,
            { value: E.utils.parseEther("10") }
        );
        assert.equal((await tm.getTroveStatus(user)).toString(), "1");
        assert((await zusd.balanceOf(user)).gte(E.utils.parseEther("3000")));
        await tx("positive add collateral", bo, "addColl", [ZERO, ZERO], actor, {
            value: E.utils.parseEther("1"),
        });
        await tx("positive debt repayment", bo, "repayZUSD", [
            E.utils.parseEther("1"),
            ZERO,
            ZERO,
        ]);
        await tx("positive ZUSD transfer", zusd, "transfer", [voters[0], E.utils.parseEther("1")]);
        await tx("positive ZUSD approval", zusd, "approve", [voters[0], 123]);
        await tx("positive ZERO approval", zero, "approve", [voters[0], 456]);
        let spControl;
        try {
            await tx("positive StabilityPool deposit", sp, "provideToSP", [
                E.utils.parseEther("10"),
                ZERO,
            ]);
            const deposit = await sp.getCompoundedZUSDDeposit(user);
            assert(deposit.gt(0));
            spControl = { deposit: deposit.toString(), result: "positive actual deposit" };
        } catch (e) {
            assert(e.receipt && e.receipt.status === 0, "failed actual deposit receipt required");
            const trace = await p.send("debug_traceTransaction", [
                e.receipt.transactionHash,
                { tracer: "callTracer" },
            ]);
            assert.equal(trace.revertReason, "price error");
            spControl = {
                result: "baseline external SOV price route unavailable",
                reason: trace.revertReason,
                failedReceipt: e.receipt.transactionHash,
            };
        }
        out.positive = {
            troveDebt: (await tm.getTroveDebt(user)).toString(),
            troveCollateral: (await tm.getTroveColl(user)).toString(),
            zusd: (await zusd.balanceOf(user)).toString(),
            zeroAllowance: (await zero.allowance(user, voters[0])).toString(),
            stabilityPool: spControl,
        };
        await amm.setup();
        await amm.controls("baseline", true);
        out.aftermath = {
            setup: await aftermath.initialize({ provider: p, actor: p.getSigner(2), guard, tx }),
            stages: [],
        };
        out.aftermath.stages.push(await aftermath.controls("baseline", { zeroHalted: false }));
        save();
        const base = await snapshot();
        out.storageSnapshotSha256 = sha(JSON.stringify(base));
        out.rawStorageBaseline = base;
        assert(
            E.BigNumber.from(base.TroveManager.storage.slice(-4)[0]).eq(out.positive.troveDebt),
            "raw Troves[user].debt at mapping slot16 must match live getter"
        );
        assert(
            E.BigNumber.from(base.TroveManager.storage.slice(-4)[1]).eq(
                out.positive.troveCollateral
            ),
            "raw Troves[user].coll must match live getter"
        );
        out.linearSlotCounts = linearSlotCounts;
        const localParts = [];
        for (const part of [1, 2, 3]) {
            const local = (await sip.build(hre, part)).args;
            const exact = production.payloads[part - 1].args;
            assert.deepEqual(
                {
                    ...local,
                    description: local.description.replace(/^LOCAL FORK DRAFT ONLY — /, ""),
                },
                exact,
                "local and read-only production payloads differ only by local prefix"
            );
            localParts.push(local);
        }
        const [part1, part2, part3] = production.payloads.map((x) => x.args);
        out.exactProductionCalldata = true;
        out.localDescriptionPrefix = "LOCAL FORK DRAFT ONLY — ";
        out.localPrefixUtf8Bytes = Buffer.byteLength(out.localDescriptionPrefix);
        assert.deepEqual(
            [part1.targets.length, part2.targets.length, part3.targets.length],
            [3, 10, 6]
        );
        assert.deepEqual(part1.signatures, Array(3).fill("registerAddress(bytes32,address)"));
        assert.deepEqual(part2.signatures, Array(10).fill("setImplementation(address)"));
        assert.deepEqual(part3.signatures, Array(6).fill("setImplementation(address)"));
        const invalidAmmSnap = await mutate("evm_snapshot");
        const invalidAmm = { ...part1, data: [...part1.data] };
        invalidAmm.data[2] = "0x";
        await governed("AMM invalid final action", invalidAmm, true);
        await mutate("evm_revert", [invalidAmmSnap]);
        assert.deepEqual(await snapshot(), base);
        const omitSnap = await mutate("evm_snapshot");
        const omitted = { ...part1 };
        for (const field of ["targets", "values", "signatures", "data"])
            omitted[field] = part1[field].filter((_, i) => i !== 1);
        await governed("AMM omitted Formula causal mutation", omitted);
        await amm.assertBindings([
            sip.AMM.inert.address,
            sip.AMM.keys[1].address,
            sip.AMM.inert.address,
        ]);
        await amm.single("omitted Formula direct modern add remains live", "modern add", true);
        let detected = false;
        try {
            await amm.assertBindings(Array(3).fill(sip.AMM.inert.address));
        } catch (e) {
            detected = true;
            out.omissionMutationFailure = e.message;
        }
        assert(detected, "omitted Formula must fail complete pause assertion");
        await mutate("evm_revert", [omitSnap]);
        assert.deepEqual(await snapshot(), base);
        await governed("Part1 AMM halt", part1);
        await amm.assertBindings(Array(3).fill(sip.AMM.inert.address));
        await amm.controls("AMM paused", false);
        out.aftermath.stages.push(await aftermath.controls("AMM halted", { zeroHalted: false }));
        save();
        assert.deepEqual((await sip.getArgsSip0097Part2(hre)).args, localParts[1]);
        await governed("Part2 financial halt", part2);
        await pointers(1, "halt");
        await pointers(2, "baseline");
        out.aftermath.stages.push(
            await aftermath.controls("financial ten halted", { zeroHalted: true })
        );
        save();
        assert.deepEqual((await sip.getArgsSip0097Part3(hre)).args, localParts[2]);
        const afterPart2 = await snapshot();
        const invalidZeroSnap = await mutate("evm_snapshot");
        const invalidZero = { ...part3, data: [...part3.data] };
        invalidZero.data[5] = E.utils.defaultAbiCoder.encode(["address"], [ZERO]);
        await governed("Zero invalid final action", invalidZero, true);
        await mutate("evm_revert", [invalidZeroSnap]);
        assert.deepEqual(await snapshot(), afterPart2);
        await governed("Part3 auxiliary halt", part3);
        await pointers(null, "halt");
        await amm.assertBindings(Array(3).fill(sip.AMM.inert.address));
        await amm.controls("combined paused", false);
        out.aftermath.stages.push(
            await aftermath.controls("all nineteen halted", { zeroHalted: true })
        );
        save();
        await selectors(sip.MANIFEST.targets);
        assert.deepEqual(custody(await snapshot()), custody(base));
        for (const t of sip.MANIFEST.targets) {
            assert.equal(low(await proxy(t).getOwner()), low(t.owner));
            for (const fn of ["setImplementation", "setOwner"]) {
                let rejected = false;
                try {
                    await proxy(t).connect(actor).callStatic[fn](user);
                } catch (e) {
                    rejected = e.message.includes("Ownable:: access denied");
                }
                assert(rejected, "native administration remains owner-only");
            }
        }
        await governed("restore auxiliary six first", restoreArgs(2));
        await pointers(2, "baseline");
        await pointers(1, "halt");
        await governed("restore AMM three", restoreArgs(0));
        await amm.assertBindings(sip.AMM.keys.map((x) => x.address));
        await amm.controls("exact restored", true);
        await governed("restore financial ten last", restoreArgs(1));
        await pointers(null, "baseline");
        assert.deepEqual(await snapshot(), base);
        out.aftermath.stages.push(await aftermath.controls("all restored", { zeroHalted: false }));
        save();
        assert.equal((await tm.getTroveDebt(user)).toString(), out.positive.troveDebt);
        assert.equal((await tm.getTroveColl(user)).toString(), out.positive.troveCollateral);
        assert.equal((await zusd.balanceOf(user)).toString(), out.positive.zusd);
        assert.equal(
            (await zero.allowance(user, voters[0])).toString(),
            out.positive.zeroAllowance
        );
        await tx("restored ZUSD transfer", zusd, "transfer", [voters[0], 1]);
        // Governance voting and delays advance time while real oracle state stays
        // frozen. Preserve the original stale-price protection; reopening is not
        // economically qualified by this bounded restoration proof.
        const beforeStaleRepayment = await snapshot();
        let staleRepayment;
        try {
            await tx("restored repayment original stale-price protection", bo, "repayZUSD", [
                E.utils.parseEther("1"),
                ZERO,
                ZERO,
            ]);
        } catch (e) {
            staleRepayment = e;
        }
        assert(
            staleRepayment?.receipt && staleRepayment.receipt.status === 0,
            "actual stale-price repayment receipt required"
        );
        const staleTrace = await p.send("debug_traceTransaction", [
            staleRepayment.receipt.transactionHash,
            { tracer: "callTracer" },
        ]);
        const staleReason = "PriceFeed: Price feed price is stale";
        assert.equal(staleTrace.revertReason, staleReason);
        const visited = [];
        function visitRestored(call) {
            visited.push(call);
            for (const child of call.calls || []) visitRestored(child);
        }
        visitRestored(staleTrace);
        for (const name of ["BorrowerOperations", "PriceFeed"]) {
            const baseline = sip.MANIFEST.targets.find((t) => t.name === name);
            assert(
                visited.some(
                    (call) =>
                        call.type === "DELEGATECALL" &&
                        low(call.to) === low(baseline.implementation) &&
                        call.revertReason === staleReason
                ),
                "repayment must reach original " + name + " implementation"
            );
        }
        assert.deepEqual(
            await snapshot(),
            beforeStaleRepayment,
            "stale-price rejection preserves position, sampled state and custody"
        );
        assert.equal((await tm.getTroveDebt(user)).toString(), out.positive.troveDebt);
        assert.equal((await tm.getTroveColl(user)).toString(), out.positive.troveCollateral);
        await tx("restored ZERO approval", zero, "approve", [voters[0], 789]);
        assert.equal((await zero.allowance(user, voters[0])).toString(), "789");
        out.restoredFinancial = {
            successfulRepayment: false,
            actualFailedReceipt: staleRepayment.receipt.transactionHash,
            expectedRevertReason: staleReason,
            originalLogicReached: true,
            positionAndSampledStorageUnchanged: true,
            oracleStateUnmodified: true,
        };
        out.limits = [
            "Real-voter impersonation proves mechanics, not consent.",
            "Three pause and three restoration proposals are independently atomic only.",
            "Fresh AMM causal controls cover only the genuine XUSD/WRBTC V1 converter; earlier 15-pool evidence remains separate, with its rUSDT/DOC oracle gaps.",
            "LP transfers are not disabled or transacted; the existing transfer flag, supplies and ownership are read for preservation only.",
            "Time accrues; restoration is not economically neutral or production reopening approval.",
            "Storage proof covers documented per-contract linear slot ranges, native owners/balances, token account/nonce/allowance mappings and local trove; not every possible historical mapping key.",
            "Existing Perimeter claims and other products are outside the halt; their controllers are not upgraded.",
        ];
        out.result = "PASS";
        out.completedUTC = new Date().toISOString();
        save();
    });
    after(function () {
        if (out.result !== "PASS") {
            out.result = "FAIL";
            out.failedUTC = new Date().toISOString();
            save();
        }
    });
});
