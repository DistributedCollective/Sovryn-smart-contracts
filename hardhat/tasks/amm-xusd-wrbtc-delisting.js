const fs = require("fs");
const os = require("os");
const path = require("path");
const { task } = require("hardhat/config");
const PINS = {
    catalogue: {
        address: "0x31a0f8400c75d52fdb413372233f28e3bdfb1c06",
        hash: "0x7dbd756379bb406768d998807af8165ab53dd3e0857be7cc50d6ba2841f01e67",
    },
    fake: {
        address: "0x2454ad964b04e343fa08e36f62a47113288917d0",
        hash: "0xc0ba7b3680298e0e2c4763e8e4d489282769c8ba560e90126acafb06d4289f36",
    },
    fakeAnchor: {
        address: "0xb2df96e24e20561b5ddda4c3599dacb6d773bae4",
        hash: "0x4f3414fcf777c123e8a708ff4fe1967f8a695115d7b6dd3d77718b4c4c1f3192",
    },
    genuine: {
        address: "0xa9c3d9681215ef7623dc28ea6b75bf87fdf285d9",
        hash: "0xe110f7f40508fa672a4dccbb09e45a3566382f75b40dc9bbce09ce28c0496417",
    },
    genuineAnchor: {
        address: "0x6f96096687952349dd5944e0eb1be327dcdeb705",
        hash: "0x18a3b01f79f4b60d42e35cafac512c08763eb55d193e8f9eb8993e140104e9db",
    },
    collector: {
        address: "0x115caf168c51ed15ec535727f64684d33b7b08d1",
        hash: "0x26d04054c097cd966f9bac6f0a5decc1b0dd5029a5bb15138cdb62acc48c1e48",
    },
    network: {
        address: "0x98ace08d2b759a265ae326f010496bcd63c15afc",
        hash: "0x2998b4f8b90024c04e28e40ed20e5495141e1a96defd05c3705f5961b45f245f",
    },
    mainRegistry: {
        address: "0x46ebc03ef2277308bdb106a73d11c65109c4b89b",
        hash: "0x3e8920263dbb24e6e8676c54c30bb44205861ea03d41108660dac3ce7f0e545c",
    },
    data: {
        address: "0x73eef416cb8b63dbfcc66719f0b74bb7baea48fe",
        hash: "0x33b10e29d4940ba792406afaacf9f248cd63d809aea80e6be57cfa690fbb0a3b",
    },
    wallet: {
        address: "0x924f5ad34698fd20c90fe5d5a8a0abd3b42dc711",
        hash: "0x36eaa6b9e456aa0781c73957117d880576a67b2f54cec89dd3ed85bd568fa56b",
    },
    collectorImplementation: {
        address: "0xccb75e444f4808012a57eb2db06648249f370d2f",
        hash: "0x5b8dc86aed1fd701b192c338bb19c1cac49c8c467cc96a40074f9e4aac6234fd",
    },
};
const OWNERS = [
    "0x324066770c0b11e0095f44cb0cc9d8f178320eb9",
    "0xa56941f8283902f84d35d512270dbe082ed6a695",
    "0xeabb83a1cefc5f50c83bc4252c618d3294152a86",
    "0xde1690480ef789beaa112157c7d123a5c85f6af2",
    "0xdfd4da0e0e656af349e192b954baaef0fc1eba62",
    "0xfee171a152c02f336021fb9e79b4fac2304a9e7e",
    "0x0c9655a24d148efab8b6585c3df607512116f186",
];
const XUSD = "0xb5999795be0ebb5bab23144aa5fd6a02d080299f",
    WRBTC = "0x542fda317318ebf1d3deaf76e0b632741a7e677d";
const ZERO = "0x0000000000000000000000000000000000000000",
    OWNER_TIMELOCK = "0x967c84b731679e36a344002b8e3ce50620a7f69f";
const RPC = "https://public-node.rsk.co";
const CORE = [
    "catalogue",
    "wallet",
    "network",
    "mainRegistry",
    "data",
    "collector",
    "collectorImplementation",
];
// Exact reviewed getter families; these do not authorize arbitrary custom callbacks.
const FAMILIES = {
    "0xe110f7f40508fa672a4dccbb09e45a3566382f75b40dc9bbce09ce28c0496417": {
        name: "standard-v32-V1",
        anchorHash: "0x18a3b01f79f4b60d42e35cafac512c08763eb55d193e8f9eb8993e140104e9db",
    },
    "0xf6989dee67d9b53af760aa82006ac9c8b7eb332b4320940ee61c82667725635f": {
        name: "standard-v32-V2",
        anchorHash: "0x3f370f9c72a8395708d1af1878d35525cfa5bf30aadce0694275bca38338dc6e",
    },
    "0xc0ba7b3680298e0e2c4763e8e4d489282769c8ba560e90126acafb06d4289f36": {
        name: "reviewed-current-fake-only",
        anchorHash: "0x4f3414fcf777c123e8a708ff4fe1967f8a695115d7b6dd3d77718b4c4c1f3192",
        converter: PINS.fake.address,
        anchor: PINS.fakeAnchor.address,
    },
};
const ABI = [
    "function owner() view returns(address)",
    "function newOwner() view returns(address)",
    "function registry() view returns(address)",
    "function addressOf(bytes32) view returns(address)",
    "function token() view returns(address)",
    "function connectorTokenCount() view returns(uint16)",
    "function connectorTokens(uint256) view returns(address)",
    "function getAnchors() view returns(address[])",
    "function getConvertibleTokenAnchors(address) view returns(address[])",
    "function isAnchor(address) view returns(bool)",
    "function isLiquidityPool(address) view returns(bool)",
    "function isConvertibleTokenAnchor(address,address) view returns(bool)",
    "function conversionPath(address,address) view returns(address[])",
    "function getImplementation() view returns(address)",
    "function getWhitelistedConverterList() view returns(address[])",
];
const MS_ABI = [
    "function required() view returns(uint256)",
    "function getOwners() view returns(address[])",
    "function isOwner(address) view returns(bool)",
    "function getConfirmations(uint256) view returns(address[])",
    "function transactions(uint256) view returns(address destination,uint256 value,bytes data,bool executed)",
    "function submitTransaction(address,uint256,bytes) returns(uint256)",
    "event Submission(uint256 indexed transactionId)",
    "event Execution(uint256 indexed transactionId)",
    "event ExecutionFailure(uint256 indexed transactionId)",
];
const check = (ok, message) => {
    if (!ok) throw new Error(message);
};
const same = (a, b) =>
    typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
const sameList = (a, b) => a.length === b.length && a.every((x, i) => same(x, b[i]));
const now = () => new Date().toISOString();
function operation(converter) {
    check(
        /^0x[0-9a-fA-F]{40}$/.test(converter) && !same(converter, ZERO),
        "Invalid converter address"
    );
    return {
        chainId: 30,
        to: PINS.catalogue.address,
        value: "0",
        data: "0x9e76a007" + converter.toLowerCase().slice(2).padStart(64, "0"),
    };
}
function matchOperation(stored, op) {
    return (
        same(stored.destination, op.to) &&
        stored.value.toString() === "0" &&
        same(stored.data, op.data)
    );
}
function contracts(ethers, provider) {
    const reader = new ethers.VoidSigner(PINS.wallet.address, provider);
    const c = Object.fromEntries(
        CORE.map((n) => [n, new ethers.Contract(PINS[n].address, ABI, reader)])
    );
    c.wallet = new ethers.Contract(PINS.wallet.address, MS_ABI, reader);
    c.at = (a) => new ethers.Contract(a, ABI, reader);
    return c;
}
async function qualify(ethers, provider, c, anchor, blockNumber, listed = true) {
    const result = {
        anchor: anchor.toLowerCase(),
        converter: null,
        qualified: false,
        wellFormed: false,
    };
    const tag = { blockTag: blockNumber, gasLimit: 1000000 };
    try {
        result.anchorHash = ethers.utils.keccak256(await provider.getCode(anchor, blockNumber));
        result.converter = (await c.at(anchor).owner(tag)).toLowerCase();
        result.codeHash = ethers.utils.keccak256(
            await provider.getCode(result.converter, blockNumber)
        );
        const family = FAMILIES[result.codeHash];
        result.family = family ? family.name : "unknown-custom-runtime";
        result.qualified = !!(
            family &&
            result.anchorHash === family.anchorHash &&
            (!family.converter ||
                (same(family.converter, result.converter) && same(family.anchor, anchor)))
        );
        result.reviewRequired = !result.qualified;
        result.executionRisk = result.qualified
            ? "Reviewed exact metadata getter family; recheck before execution."
            : "UNQUALIFIED custom converter/anchor. Old registry invokes metadata with CALL, not STATICCALL; getters may callback or differ by caller/state. A successful eth_call does not prove safe effects. Owner execution review is required before other confirmations.";
        check(
            (await provider.getCode(anchor, blockNumber)) !== "0x" &&
                (await provider.getCode(result.converter, blockNumber)) !== "0x",
            "Missing candidate contract code"
        );
        const cv = c.at(result.converter);
        const [token, count] = await Promise.all([cv.token(tag), cv.connectorTokenCount(tag)]);
        check(same(token, anchor), "Metadata token/anchor mismatch; wrong-target removal refused");
        const n = Number(count.toString());
        check(Number.isSafeInteger(n) && n >= 2 && n <= 32, "Invalid/unbounded reserve inventory");
        const reserves = await Promise.all(
            Array.from({ length: n }, (_, i) => cv.connectorTokens(i, tag))
        );
        result.reserves = reserves.map((x) => x.toLowerCase());
        check(
            new Set(result.reserves).size === n && result.reserves.every((a) => !same(a, ZERO)),
            "Duplicate/zero reserve metadata"
        );
        check(
            result.reserves.includes(XUSD) && result.reserves.includes(WRBTC),
            "Metadata does not contain both XUSD and WRBTC"
        );
        check(
            (await c.catalogue.isAnchor(anchor, tag)) === listed &&
                (await c.catalogue.isLiquidityPool(anchor, tag)) === listed,
            "Catalogue anchor/pool binding mismatch"
        );
        for (const tokenAddress of result.reserves)
            check(
                (await c.catalogue.isConvertibleTokenAnchor(tokenAddress, anchor, tag)) === listed,
                "Catalogue reserve association mismatch"
            );
        result.operation = operation(result.converter);
        if (listed) {
            result.preview = await provider.call(
                {
                    from: PINS.wallet.address,
                    to: PINS.catalogue.address,
                    data: result.operation.data,
                    gasLimit: 3000000,
                },
                blockNumber
            );
            check(
                result.preview === "0x",
                "Actual from-wallet removal preview returned unexpected data"
            );
        } else result.preview = "already-delisted; no removal simulated";
        check(
            ethers.utils.keccak256(await provider.getCode(anchor, blockNumber)) ===
                result.anchorHash &&
                ethers.utils.keccak256(await provider.getCode(result.converter, blockNumber)) ===
                    result.codeHash,
            "Candidate code changed during metadata/removal preview"
        );
        result.wellFormed = true;
    } catch (error) {
        result.qualified = false;
        result.reviewRequired = true;
        result.reason = error.message;
    }
    return result;
}
async function preflight(ethers, provider) {
    check((await provider.getNetwork()).chainId === 30, "Rootstock chain ID30 required");
    const height = await provider.getBlockNumber();
    const block = await provider.getBlock(height);
    check(block && Number.isSafeInteger(block.number) && block.hash, "Missing canonical block");
    const tag = { blockTag: block.number };
    const c = contracts(ethers, provider);
    await Promise.all(
        CORE.map(async (n) =>
            check(
                ethers.utils.keccak256(await provider.getCode(PINS[n].address, block.number)) ===
                    PINS[n].hash,
                `Unknown ${n} runtime: stop and review`
            )
        )
    );
    const [owner, pending, q, owners, impl, white, mainOwner, mainPending] = await Promise.all([
        c.catalogue.owner(tag),
        c.catalogue.newOwner(tag),
        c.wallet.required(tag),
        c.wallet.getOwners(tag),
        c.collector.getImplementation(tag),
        c.collector.getWhitelistedConverterList(tag),
        c.mainRegistry.owner(tag),
        c.mainRegistry.newOwner(tag),
    ]);
    check(same(owner, PINS.wallet.address) && same(pending, ZERO), "Catalogue authority drift");
    check(
        q.toString() === "3" &&
            sameList([...owners].map((x) => x.toLowerCase()).sort(), [...OWNERS].sort()),
        "Exchequer owners/quorum drift: expected exact3of7"
    );
    check(
        same(impl, PINS.collectorImplementation.address) && white.length === 0,
        "Collector containment drift: whitelist must remain empty"
    );
    check(
        same(mainOwner, OWNER_TIMELOCK) && same(mainPending, ZERO),
        "mainRegistry authority drift"
    );
    for (const n of ["catalogue", "data", "network"])
        check(same(await c[n].registry(tag), PINS.mainRegistry.address), `${n} registry drift`);
    for (const [key, expected] of [
        ["SovrynSwapConverterRegistry", PINS.catalogue.address],
        ["SovrynSwapConverterRegistryData", PINS.data.address],
        ["SovrynSwapNetwork", PINS.network.address],
    ])
        check(
            same(
                await c.mainRegistry.addressOf(ethers.utils.formatBytes32String(key), tag),
                expected
            ),
            `Registry binding drift: ${key}`
        );
    const [all, xusd, wrbtc] = await Promise.all([
        c.catalogue.getAnchors(tag),
        c.catalogue.getConvertibleTokenAnchors(XUSD, tag),
        c.catalogue.getConvertibleTokenAnchors(WRBTC, tag),
    ]);
    const norm = (arr) => {
        const a = arr.map((x) => x.toLowerCase());
        check(
            a.length <= 4096 && new Set(a).size === a.length,
            "Invalid/duplicate catalogue inventory"
        );
        return a;
    };
    const anchors = norm(all),
        xs = norm(xusd),
        ws = norm(wrbtc);
    const intersection = xs.filter((a) => ws.includes(a)).sort();
    check(
        intersection.every((a) => anchors.includes(a)),
        "Pair association missing from full anchor inventory"
    );
    const candidates = [];
    for (const a of intersection)
        candidates.push(await qualify(ethers, provider, c, a, block.number));
    const routes = [],
        routeErrors = [];
    for (const [a, b] of [
        [XUSD, WRBTC],
        [WRBTC, XUSD],
    ]) {
        try {
            routes.push({
                from: a,
                to: b,
                path: (await c.network.conversionPath(a, b, { ...tag, gasLimit: 2000000 })).map(
                    (x) => x.toLowerCase()
                ),
            });
        } catch (e) {
            routeErrors.push({ from: a, to: b, error: e.message });
        }
    }
    check(
        same((await provider.getBlock(block.number)).hash, block.hash),
        "Canonical block changed during readback"
    );
    return {
        blockNumber: block.number,
        blockHash: block.hash,
        observedUTC: now(),
        c,
        candidates,
        routes,
        routeErrors,
        totalAnchors: anchors.length,
    };
}
function readJournal(file) {
    if (!fs.existsSync(file)) return null;
    const st = fs.lstatSync(file);
    check(
        st.isFile() && !st.isSymbolicLink() && (st.mode & 0o077) === 0,
        "Journal must be a private regular0600 file"
    );
    const s = JSON.parse(fs.readFileSync(file, "utf8"));
    check(
        s.version === 2 &&
            same(s.wallet, PINS.wallet.address) &&
            sameList(s.pair || [], [XUSD, WRBTC]) &&
            Array.isArray(s.operations),
        "Journal context mismatch"
    );
    for (const r of s.operations) {
        check(
            r.candidate &&
                JSON.stringify(r.operation) === JSON.stringify(operation(r.candidate.converter)),
            "Journal operation mismatch"
        );
        if (r.intent)
            check(
                OWNERS.some((a) => same(a, r.intent.sender)) &&
                    Number.isSafeInteger(r.intent.nonce),
                "Journal intent sender/nonce invalid"
            );
    }
    return s;
}
function saveJournal(file, state) {
    const dir = path.dirname(file);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    let p = dir;
    while (true) {
        check(!fs.lstatSync(p).isSymbolicLink(), "Symlinked journal directory refused");
        const next = path.dirname(p);
        if (next === p) break;
        p = next;
    }
    if (fs.existsSync(file))
        check(!fs.lstatSync(file).isSymbolicLink(), "Symlinked journal refused");
    const temp = `${file}.${process.pid}.tmp`;
    const fd = fs.openSync(temp, "wx", 0o600);
    try {
        fs.writeFileSync(fd, JSON.stringify(state, null, 2) + "\n");
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
    fs.renameSync(temp, file);
    const directory = fs.openSync(dir, "r");
    try {
        fs.fsyncSync(directory);
    } finally {
        fs.closeSync(directory);
    }
}
function walletEvents(ethers, receipt, name, id) {
    const iface = new ethers.utils.Interface(MS_ABI);
    return receipt.logs
        .filter((l) => same(l.address, PINS.wallet.address))
        .map((l) => {
            try {
                return iface.parseLog(l);
            } catch (_) {
                return null;
            }
        })
        .filter(
            (l) =>
                l &&
                l.name === name &&
                (id === undefined || l.args.transactionId.toString() === String(id))
        );
}
async function canonicalReceipt(provider, hash) {
    check(/^0x[0-9a-fA-F]{64}$/.test(hash), "Expected transaction hash");
    const receipt = await provider.getTransactionReceipt(hash);
    check(
        receipt && receipt.status === 1 && same(receipt.transactionHash, hash),
        "Transaction is pending, missing or reverted; do not resend"
    );
    check(
        same((await provider.getBlock(receipt.blockNumber)).hash, receipt.blockHash),
        "Receipt is not canonical"
    );
    for (const l of receipt.logs)
        check(
            same(l.transactionHash, hash) && same(l.blockHash, receipt.blockHash),
            "Receipt log binding mismatch"
        );
    return receipt;
}
async function configuredSigner(args, hre) {
    const { ethers } = hre;
    const name = args.signer || "deployer";
    let address;
    if (ethers.utils.isAddress(name)) address = name;
    else if (/^\d+$/.test(name)) {
        const list = await ethers.getSigners();
        check(list[Number(name)], "Configured signer index unavailable");
        return list[Number(name)];
    } else address = (await hre.getNamedAccounts())[name];
    check(address, "Existing configured signer not found");
    return ethers.getSigner(address);
}
async function verifySubmission(ethers, provider, wallet, record, hash) {
    const receipt = await canonicalReceipt(provider, hash),
        tx = await provider.getTransaction(hash);
    check(
        tx && tx.blockNumber === receipt.blockNumber && same(tx.blockHash, receipt.blockHash),
        "Submission transaction/receipt block binding mismatch"
    );
    const data = wallet.interface.encodeFunctionData("submitTransaction", [
        record.operation.to,
        0,
        record.operation.data,
    ]);
    check(
        tx &&
            same(tx.hash, hash) &&
            same(tx.to, PINS.wallet.address) &&
            same(tx.from, record.intent.sender) &&
            tx.nonce === record.intent.nonce &&
            tx.value.toString() === "0" &&
            same(tx.data, data),
        "Submission envelope mismatch"
    );
    const ev = walletEvents(ethers, receipt, "Submission");
    check(ev.length === 1, "Expected exactly one wallet Submission event");
    const id = ev[0].args.transactionId.toString();
    check(
        walletEvents(ethers, receipt, "Execution", id).length === 0 &&
            walletEvents(ethers, receipt, "ExecutionFailure", id).length === 0,
        "Unexpected execution in submission receipt: preserve journal and inspect wallet policy"
    );
    const stored = await wallet.transactions(id);
    check(
        matchOperation(stored, record.operation),
        "Stored proposal destination/value/data mismatch"
    );
    check(
        (await wallet.getConfirmations(id)).some((a) => same(a, record.intent.sender)),
        "Submitting owner confirmation missing"
    );
    return {
        id,
        hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        executedFlag: Boolean(stored.executed),
    };
}
function sameCandidate(a, b) {
    return (
        same(a.anchor, b.anchor) &&
        same(a.converter, b.converter) &&
        a.codeHash === b.codeHash &&
        a.anchorHash === b.anchorHash &&
        sameList(a.reserves, b.reserves)
    );
}
async function checkExisting(args, hre, provider, snapshot, log) {
    const { ethers } = hre;
    let id = String(args.checkTx),
        hash = args.executionHash;
    if (/^0x[0-9a-fA-F]{64}$/.test(id)) {
        hash = id;
        const receipt = await canonicalReceipt(provider, hash),
            events = walletEvents(ethers, receipt, "Execution");
        check(
            events.length === 1,
            "Execution hash must contain exactly one wallet Execution event"
        );
        id = events[0].args.transactionId.toString();
    }
    check(/^\d+$/.test(id), "Proposal ID must be an unsigned integer");
    const stored = await snapshot.c.wallet.transactions(id);
    check(
        same(stored.destination, PINS.catalogue.address) &&
            stored.value.toString() === "0" &&
            /^0x9e76a0070{24}[0-9a-fA-F]{40}$/.test(stored.data),
        "Stored operation is not an exact pair converter removal"
    );
    const converter = "0x" + stored.data.slice(-40),
        cv = snapshot.c.at(converter),
        anchor = await cv.token({ blockTag: snapshot.blockNumber });
    const listed = await snapshot.c.catalogue.isAnchor(anchor, { blockTag: snapshot.blockNumber });
    const candidate = await qualify(
        ethers,
        provider,
        snapshot.c,
        anchor,
        snapshot.blockNumber,
        listed
    );
    check(
        candidate.wellFormed && same(candidate.converter, converter),
        "Stored removal candidate no longer has reviewed pair metadata"
    );
    if (!stored.executed) {
        check(!hash, "Stored executed=false; execution not proven");
        log(`PENDING proposal ${id}; no inner execution verified.`);
        return { status: "pending", id, candidate };
    }
    check(hash, "executed=true needs --execution-hash for canonical inner Execution proof");
    const receipt = await canonicalReceipt(provider, hash);
    check(
        walletEvents(ethers, receipt, "ExecutionFailure", id).length === 0 &&
            walletEvents(ethers, receipt, "Execution", id).length === 1,
        "Missing exact wallet Execution or inner ExecutionFailure present"
    );
    check(
        snapshot.blockNumber >= receipt.blockNumber && !listed,
        "Executed removal has not produced delisted poststate"
    );
    log(
        `VERIFIED EXECUTED proposal ${id}; anchor ${anchor} absent. Current pair matches=${snapshot.candidates.length}; no permanent trading ban inferred.`
    );
    return {
        status: "executed",
        id,
        candidate,
        pairEntriesRemaining: snapshot.candidates.length,
        routes: snapshot.routes,
    };
}
function journalFile(args) {
    return path.resolve(
        args.journal ||
            path.join(
                os.homedir(),
                "Library",
                "Application Support",
                "Sovryn",
                "amm-xusd-wrbtc-delisting",
                "journal.json"
            )
    );
}
async function runWithOwnedLock(args, hre) {
    check(!(args.submit && args.checkTx), "Use --submit OR --check-tx, never both");
    check(!args.executionHash || args.checkTx, "--execution-hash requires --check-tx");
    const { ethers } = hre,
        log = args.log || console.log,
        provider =
            args.provider ||
            new ethers.providers.JsonRpcProvider({ url: args.rpc || RPC, timeout: 45000 });
    const file = journalFile(args);
    let state = readJournal(file);
    const createdThisRun = new Set(),
        ownExecutionFlags = new Map();
    let snapshot = await preflight(ethers, provider);
    log(
        "XUSD/WRBTC PAIR DELIST ONLY: includes genuine if relisted and every listed anchor associated with BOTH tokens. Discovery risk reduction, NOT a trading pause or permanent admission ban. Explicit paths/public readmission remain. No relisting, funding, Oracle or LP accounting change."
    );
    log(
        JSON.stringify(
            {
                pin: { block: snapshot.blockNumber, hash: snapshot.blockHash },
                candidates: snapshot.candidates,
                routes: snapshot.routes,
                routeErrors: snapshot.routeErrors,
                journal: file,
            },
            null,
            2
        )
    );
    if (state) {
        if (args.submissionHash) {
            const unresolved = state.operations.filter((r) => r.intent && !r.submissionHash);
            check(
                unresolved.length === 1 ||
                    (!unresolved.length &&
                        state.operations.some((r) => same(r.submissionHash, args.submissionHash))),
                "Submission hash must identify the single unresolved intent or an existing recorded hash"
            );
        }
        for (const r of state.operations) {
            const live = await qualify(
                ethers,
                provider,
                snapshot.c,
                r.candidate.anchor,
                snapshot.blockNumber,
                await snapshot.c.catalogue.isAnchor(r.candidate.anchor, {
                    blockTag: snapshot.blockNumber,
                })
            );
            check(
                live.wellFormed && sameCandidate(live, r.candidate),
                "Journal candidate runtime/metadata drift: stop and inspect"
            );
            if (!r.intent) continue;
            const hash = r.submissionHash || args.submissionHash;
            check(
                hash,
                `UNCERTAIN prior broadcast: sender=${r.intent.sender} nonce=${r.intent.nonce}. Preserve journal; inspect exact owner nonce/history, then supply --submission-hash. NEVER automatically resend.`
            );
            const result = await verifySubmission(ethers, provider, snapshot.c.wallet, r, hash);
            check(
                r.proposalId === undefined || r.proposalId === result.id,
                "Journal proposal ID changed"
            );
            r.submissionHash = hash;
            r.proposalId = result.id;
            r.status = "submitted";
            if (!r.verifiedUTC) r.verifiedUTC = now();
            ownExecutionFlags.set(result.id, result.executedFlag);
            if (args.submit) saveJournal(file, state);
            log(
                `EXCHEQUER PROPOSAL ${result.id} (resumed; ${result.executedFlag ? "executed flag set; canonical execution receipt still needs checking" : "pending"}): converter ${r.candidate.converter}; submission ${hash}`
            );
        }
    } else check(!args.submissionHash, "--submission-hash requires original intent journal");
    if (args.checkTx) return checkExisting(args, hre, provider, snapshot, log);
    if (!args.submit) {
        log(
            "DRY RUN: no signer requested. Unknown code remains UNQUALIFIED for execution. Explicit --submit creates only first-confirmation proposals; owner review of metadata CALL behavior is required before other owners confirm. Use a fresh private journal for each later sweep after prior proposals have executed."
        );
        return {
            status: "dry-run",
            candidates: snapshot.candidates,
            routes: snapshot.routes,
            routeErrors: snapshot.routeErrors,
        };
    }
    check(
        snapshot.candidates.every((c) => c.wellFormed),
        "Unreadable/mismatched pair candidate metadata or failed removal preview; stop before submit"
    );
    check(!snapshot.routeErrors.length, "Route read incomplete: stop and review");
    if (!snapshot.candidates.length && !state) {
        log(
            "ALREADY DELISTED: no current direct-pair catalogue entries. This does not prevent future admission or explicit paths."
        );
        log("EXCHEQUER PROPOSAL SUMMARY []");
        return { status: "already-delisted", candidates: [], summary: [] };
    }
    {
        const disk = readJournal(file);
        check(
            JSON.stringify(disk) === JSON.stringify(state),
            "Journal changed during preparation; stop and reconcile"
        );
        if (!state)
            state = {
                version: 2,
                wallet: PINS.wallet.address,
                pair: [XUSD, WRBTC],
                createdUTC: now(),
                baseline: {
                    blockNumber: snapshot.blockNumber,
                    blockHash: snapshot.blockHash,
                    observedUTC: snapshot.observedUTC,
                },
                operations: snapshot.candidates.map((candidate) => ({
                    candidate,
                    operation: candidate.operation,
                    status: "planned",
                })),
            };
        check(
            snapshot.candidates.every((c) =>
                state.operations.some((r) => sameCandidate(c, r.candidate))
            ),
            "New pair inventory appeared: preserve old journal and use a fresh journal for a new reviewed sweep"
        );
        for (const r of state.operations) {
            if (r.submissionHash) {
                const stored = await snapshot.c.wallet.transactions(r.proposalId);
                ownExecutionFlags.set(r.proposalId, Boolean(stored.executed));
                check(
                    !(
                        stored.executed &&
                        snapshot.candidates.some((c) => same(c.anchor, r.candidate.anchor))
                    ),
                    "Previously executed pair removal has been readmitted: use a fresh journal for a new sweep"
                );
                continue;
            }
            const current = snapshot.candidates.find((c) => same(c.anchor, r.candidate.anchor));
            if (!current) {
                r.status = "already-delisted";
                saveJournal(file, state);
                continue;
            }
            check(sameCandidate(current, r.candidate), "Planned candidate changed");
            const signer = await configuredSigner(args, hre),
                sender = await signer.getAddress();
            check(
                OWNERS.some((a) => same(a, sender)) && (await snapshot.c.wallet.isOwner(sender)),
                "Configured signer is not an expected Exchequer owner"
            );
            const sp = signer.provider;
            check(sp && (await sp.getNetwork()).chainId === 30, "Signer provider must be chain30");
            check(
                same((await sp.getBlock(snapshot.blockNumber)).hash, snapshot.blockHash),
                "Signer/read RPC canonical context differs"
            );
            const wallet = snapshot.c.wallet.connect(signer),
                estimate = await wallet.estimateGas.submitTransaction(
                    r.operation.to,
                    0,
                    r.operation.data
                ),
                nonce = await sp.getTransactionCount(sender, "pending");
            check(
                nonce === (await sp.getTransactionCount(sender, "latest")),
                "Signer has pending transactions; inspect nonce"
            );
            const gasPrice = await sp.getGasPrice();
            snapshot = await preflight(ethers, provider);
            check(
                snapshot.candidates.every((c) => c.wellFormed) && !snapshot.routeErrors.length,
                "Fresh pair inventory metadata/preview incomplete"
            );
            check(
                snapshot.candidates.every((c) =>
                    state.operations.some((r) => sameCandidate(c, r.candidate))
                ),
                "Pair inventory changed during sweep; stop before further sends"
            );
            const fresh = snapshot.candidates.find((c) => same(c.anchor, r.candidate.anchor));
            if (!fresh) {
                r.status = "already-delisted";
                saveJournal(file, state);
                continue;
            }
            check(sameCandidate(fresh, r.candidate), "Candidate changed before submission");
            r.preSendPin = {
                blockNumber: snapshot.blockNumber,
                blockHash: snapshot.blockHash,
                observedUTC: snapshot.observedUTC,
            };
            r.intent = { sender, nonce };
            r.status = "intent";
            saveJournal(file, state);
            let tx;
            try {
                tx = await wallet.submitTransaction(r.operation.to, 0, r.operation.data, {
                    nonce,
                    type: 0,
                    gasPrice,
                    gasLimit: estimate.mul(130).add(99).div(100),
                });
            } catch (error) {
                throw Error(
                    `Broadcast outcome UNCERTAIN; preserve journal, inspect sender=${sender} nonce=${nonce}; no automatic retry. ${error.message}`
                );
            }
            r.submissionHash = tx.hash;
            createdThisRun.add(tx.hash.toLowerCase());
            r.status = "broadcast";
            saveJournal(file, state);
            log(
                `Broadcast ${tx.hash}; waiting for mined exact Submission/stored-operation proof before another send.`
            );
            await sp.waitForTransaction(tx.hash, 1, 120000);
            const result = await verifySubmission(ethers, provider, snapshot.c.wallet, r, tx.hash);
            r.proposalId = result.id;
            r.status = "submitted";
            ownExecutionFlags.set(result.id, result.executedFlag);
            if (!r.verifiedUTC) r.verifiedUTC = now();
            saveJournal(file, state);
            log(
                `EXCHEQUER PROPOSAL ${result.id} (new; ${result.executedFlag ? "executed flag set; canonical execution receipt still needs checking" : "pending"}): remove converter ${r.candidate.converter}; first confirmation only. ${r.candidate.reviewRequired ? "UNQUALIFIED EXECUTION: owners must review custom getter CALL behavior before further confirmations." : "Recheck reviewed metadata/runtime before execution."}`
            );
        }
        const summary = state.operations.map((r) => ({
            proposalId: r.proposalId === undefined ? null : r.proposalId,
            converter: r.candidate.converter,
            submissionHash: r.submissionHash || null,
            origin:
                r.status === "already-delisted" && !r.submissionHash
                    ? "already-delisted"
                    : createdThisRun.has((r.submissionHash || "").toLowerCase())
                      ? "new"
                      : "resumed",
            status:
                r.proposalId === undefined
                    ? r.status
                    : ownExecutionFlags.get(r.proposalId)
                      ? "executed-flag-set; receipt not checked"
                      : "pending",
            executedFlag: Boolean(ownExecutionFlags.get(r.proposalId)),
        }));
        log("EXCHEQUER PROPOSAL SUMMARY " + JSON.stringify(summary, null, 2));
        log(
            "Proposal creation/reconciliation complete. This task never confirms or executes proposals. Other owners reach quorum3; each executing confirmation must use gas limit3,000,000 and verify canonical wallet Execution plus poststate. Pair discovery can reappear later."
        );
        return { status: "submitted", operations: state.operations, summary };
    }
}
async function runDelisting(args, hre) {
    if (!args.submit) return runWithOwnedLock(args, hre);
    check(!args.checkTx, "Use --submit OR --check-tx, never both");
    const file = journalFile(args);
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const lockFile = file + ".lock";
    // Acquire before reading/reconciling any prior intent. An existing lock is never removed here.
    const lock = fs.openSync(lockFile, "wx", 0o600);
    try {
        fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, createdUTC: now() }) + "\n");
        fs.fsyncSync(lock);
        return await runWithOwnedLock(args, hre);
    } finally {
        fs.closeSync(lock);
        fs.unlinkSync(lockFile);
    }
}
task(
    "amm:delist-xusd-wrbtc",
    "Discover and propose removal of ALL currently listed XUSD/WRBTC pair converters"
)
    .addFlag("submit", "Owner-run only: sequential Exchequer proposals/first confirmations")
    .addOptionalParam("checkTx", "Existing proposal ID or canonical execution transaction hash")
    .addOptionalParam("executionHash", "Canonical wallet Execution hash for --check-tx ID")
    .addOptionalParam("submissionHash", "Reconcile an uncertain original intent; NEVER resends")
    .addOptionalParam(
        "journal",
        "Private run journal: retain SAME file for restart; fresh file for later sweeps"
    )
    .addOptionalParam(
        "signer",
        "Existing configured signer name/address/index; submission only",
        "deployer"
    )
    .addOptionalParam("rpc", "Read-only public RPC; signer retains its Hardhat provider", RPC)
    .setAction(runDelisting);
module.exports = {
    runDelisting,
    preflight,
    qualify,
    operation,
    matchOperation,
    readJournal,
    saveJournal,
    PINS,
    OWNERS,
    FAMILIES,
    MS_ABI,
};
