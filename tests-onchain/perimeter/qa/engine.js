/**
 * The scenario engine behind `perimeter:qa <command>`.
 *
 * One function per command, each taking the attached stack from
 * `bootstrap.attachQa` and returning a plain object: the caller decides how to
 * print it and what to record. Nothing here reads argv, and nothing prints
 * unless it is handed a `log`.
 *
 * Every write goes through `send`, which waits for the receipt and then re-reads
 * the state the call claimed to change. An operator lever additionally goes
 * through the Exchequer multisig, where a failed inner call still mines: the
 * wallet catches it, the transaction stays `executed == false`, and a caller
 * that only looked at the receipt would call that a success.
 *
 * NOTHING HERE MOVES THE CHAIN CLOCK except `advance`. The dapps count a hold
 * down against the wallet's clock, so a stray jump makes every countdown in
 * them wrong for the rest of the session.
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

const {
    PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
    PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW,
    PERIMETER_SURFACE_ZERO_WITHDRAW_COLL,
    PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS,
    forkOps,
} = require("../perimeterSipTestHelpers");
const { assertLocalQaFork } = require("./bootstrap");
const drivers = require("./drivers");

const { STATUS, BLOCK } = drivers;
const ZERO_ADDRESS = ethers.constants.AddressZero;

/** Where the engine records what it did, next to the bootstrap's state file. */
const LOG_FILE = path.join(__dirname, "..", "..", "..", "qa", "state.json");

/** The gas every multisig send states. The wallet's own frame keeps 1/64 of
 *  whatever is left, so an ESTIMATED limit hands the inner call too little: it
 *  runs out of gas, the wallet catches that, and the lever reports success
 *  while changing nothing. A stated limit is what the signers actually send. */
const OPERATOR_CALL_GAS = 3000000;
const SUBMISSION_TOPIC = ethers.utils.id("Submission(uint256)");
/** The reason hash every block this engine submits is stamped with. */
const REASON_QA = ethers.utils.id("qa");
/** How far back through the wallet's transactions `status` looks for pending
 *  ones. */
const MULTISIG_TAIL = 25;

const SURFACE_IDS = {
    lender: PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
    borrower: PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW,
    zero: PERIMETER_SURFACE_ZERO_WITHDRAW_COLL,
    surplus: PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS,
};
const SURFACE_NAMES = Object.fromEntries(
    Object.entries(SURFACE_IDS).map(([name, id]) => [id, name])
);
const STATUS_NAMES = Object.fromEntries(
    Object.entries(STATUS).map(([name, value]) => [value, name])
);
const BLOCK_NAMES = Object.fromEntries(
    Object.entries(BLOCK).map(([name, value]) => [value, name])
);

const noLog = () => {};
const logOf = (opts) => (opts && opts.log) || noLog;

/** Refuse to send anywhere but a local QA fork. Repeated in front of every
 *  command, not once at start-up: a command is a separate process invocation
 *  and the check costs one RPC call. */
const assertQa = async () => {
    await assertLocalQaFork(hre);
    const { chainId } = await ethers.provider.getNetwork();
    if (chainId !== 30 || !hre.network.tags.qa) {
        throw new Error(
            `perimeter:qa: refusing to write to chain ${chainId} on network ` +
                `'${hre.network.name}' — this only ever drives a local QA fork`
        );
    }
};

const rpc = () => new ethers.providers.JsonRpcProvider(hre.network.config.url);

const chainNow = async () => (await ethers.provider.getBlock("latest")).timestamp;

/**
 * One write, with the state it claims to change read back afterwards.
 *
 * `verify` returns true when the change landed, or a string describing what is
 * wrong. Its verdict, not the receipt's status, decides OK vs NOT APPLIED.
 */
const send = async (label, txPromise, opts = {}) => {
    const log = logOf(opts);
    const tx = await txPromise;
    const receipt = await tx.wait();
    const verdict = opts.verify ? await opts.verify(receipt) : true;
    const applied = verdict === true;
    const note = applied ? "" : ` (${verdict})`;
    log(`  ${applied ? "OK" : "NOT APPLIED"}  ${label}${note}  [gas ${receipt.gasUsed}]`);
    return {
        label,
        applied,
        note: applied ? null : String(verdict),
        txHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        receipt,
    };
};

/** The calldata a lever is, without sending it: the call itself and the
 *  `submitTransaction` that carries it to the wallet. */
const calldataFor = (s, target, contract, signature, args) => {
    const data = contract.interface.encodeFunctionData(signature, args);
    return {
        target,
        signature,
        selector: ethers.utils.id(signature).slice(0, 10),
        args: args.map((a) => (Array.isArray(a) ? a.map(String) : String(a))),
        calldata: data,
        multisig: s.multisig.address,
        multisigCalldata: s.multisig.interface.encodeFunctionData("submitTransaction", [
            target,
            0,
            data,
        ]),
    };
};

/** The revert payload a node attached to a failed call, decoded against the
 *  called contract's own ABI. Looked for only where a node puts it — never in
 *  the transaction's `data`, which decodes as the call, not the refusal. */
const revertReason = (contract, error) => {
    const candidates = [];
    let node = error;
    for (let depth = 0; node && typeof node === "object" && depth < 8; depth++) {
        if (typeof node.data === "string") candidates.push(node.data);
        else if (node.data && typeof node.data.data === "string") candidates.push(node.data.data);
        node = node.error;
    }
    const data = candidates.find((c) => /^0x[0-9a-fA-F]{8,}$/.test(c));
    if (!data) return error.reason || error.message;
    try {
        const decoded = contract.interface.parseError(data);
        return `${decoded.name}(${decoded.args.map(String).join(", ")})`;
    } catch (e) {
        try {
            return contract.interface.parseError
                ? ethers.utils.defaultAbiCoder
                      .decode(["string"], ethers.utils.hexDataSlice(data, 4))[0]
                      .toString()
                : data;
        } catch (inner) {
            return data;
        }
    }
};

/** What the wallet's inner call would do, asked of the node without sending
 *  anything. The multisig swallows a failed inner call, so without this the
 *  operator is told a lever did not apply but never why. */
const innerCallReason = async (s, contract, signature, args) => {
    try {
        const asWallet = await drivers.solventSigner(s, s.multisig.address);
        await contract.connect(asWallet).callStatic[signature](...args);
        return null;
    } catch (error) {
        return revertReason(contract, error);
    }
};

/**
 * One operator lever, submitted to the Exchequer from the test key.
 *
 * At threshold 1 the submission executes on the spot. Above it the transaction
 * is left pending for `confirm`, which is a different outcome from a lever that
 * ran and did nothing — the two are never reported the same way.
 */
const viaMultisig = async (s, label, target, contract, signature, args, opts = {}) => {
    const log = logOf(opts);
    const encoded = calldataFor(s, target, contract, signature, args);
    if (opts.viaConsole) {
        log(`  CALLDATA  ${label}`);
        log(`    target             ${encoded.target}`);
        log(`    ${encoded.signature}`);
        log(`    selector           ${encoded.selector}`);
        encoded.args.forEach((a, i) => log(`    arg ${i}              ${a}`));
        log(`    calldata           ${encoded.calldata}`);
        log(`    multisig           ${encoded.multisig}`);
        log(`    submitTransaction  ${encoded.multisigCalldata}`);
        return { ...encoded, sent: false, applied: null, txId: null };
    }

    const key = testKeySigner(s);
    const required = (await s.multisig.required()).toNumber();
    const result = await send(
        label,
        s.multisig
            .connect(key)
            .submitTransaction(target, 0, encoded.calldata, { gasLimit: OPERATOR_CALL_GAS }),
        {
            ...opts,
            log: noLog,
            verify: async (receipt) => {
                const entry = receipt.logs.find((l) => l.topics[0] === SUBMISSION_TOPIC);
                if (!entry) return "the multisig recorded no submission";
                const txId = ethers.BigNumber.from(entry.topics[1]).toNumber();
                if (!(await s.multisig.transactions(txId)).executed) {
                    if (required > 1) {
                        return `pending as multisig tx ${txId}: threshold is ${required}, confirm it`;
                    }
                    const why = await innerCallReason(s, contract, signature, args);
                    return `multisig swallowed the inner call${why ? `: ${why}` : ""}`;
                }
                return opts.verify ? opts.verify(receipt) : true;
            },
        }
    );
    const entry = result.receipt.logs.find((l) => l.topics[0] === SUBMISSION_TOPIC);
    const txId = entry ? ethers.BigNumber.from(entry.topics[1]).toNumber() : null;
    const pending = txId !== null && !(await s.multisig.transactions(txId)).executed;
    const state = result.applied ? "OK" : pending && required > 1 ? "PENDING" : "NOT APPLIED";
    log(
        `  ${state}  ${label}${result.applied ? "" : ` (${result.note})`}  ` +
            `[multisig tx ${txId}, gas ${result.gasUsed}]`
    );
    return { ...encoded, sent: true, applied: result.applied, pending, txId, note: result.note };
};

const testKeySigner = (s) => new ethers.Wallet(s.state.testKey.privateKey, ethers.provider);

/** `test`, `suspect1..3` or a bare address. The test key signs with its own
 *  key; everything else is impersonated. */
const signerFor = async (s, who) => {
    const name = (who || "test").toLowerCase();
    if (name === "test") return testKeySigner(s);
    const suspect = /^suspect([123])$/.exec(name);
    if (suspect) return drivers.solventSigner(s, s.state.suspects[Number(suspect[1]) - 1]);
    if (!ethers.utils.isAddress(name)) {
        throw new Error(
            `perimeter:qa: '${who}' is neither 'test', 'suspect1'..'suspect3', nor an address`
        );
    }
    return drivers.solventSigner(s, ethers.utils.getAddress(name));
};

const addressForWho = async (s, who) => drivers.addressOf(await signerFor(s, who));

const describeRequest = async (s, id, now) => {
    const r = await s.queue.getRequest(id);
    const remaining = Math.max(0, Number(r.unlockAt) - now);
    return {
        id: Number(id),
        surface: SURFACE_NAMES[r.surfaceId] || r.surfaceId,
        status: STATUS_NAMES[r.status] || r.status,
        originator: r.originator,
        owner: r.owner,
        receiver: r.receiver,
        token: r.token === ZERO_ADDRESS ? "native" : r.token,
        subProduct: r.subProduct,
        amount: r.amount.toString(),
        unlockAt: Number(r.unlockAt),
        remaining,
        unwrapOnDelivery: r.unwrapOnDelivery,
        blockState: {
            originator: BLOCK_NAMES[await s.queue.blockStateOf(r.originator)],
            owner: BLOCK_NAMES[await s.queue.blockStateOf(r.owner)],
            receiver: BLOCK_NAMES[await s.queue.blockStateOf(r.receiver)],
        },
    };
};

/** Everything the console and the dapp draw their pages from. */
const status = async (s) => {
    const now = await chainNow();
    const last = (await s.queue.lastRequestId()).toNumber();
    const requests = [];
    for (let id = 1; id <= last; id++) requests.push(await describeRequest(s, id, now));

    // Only the tail of the wallet's history. This is a real Exchequer with
    // thousands of transactions, hundreds of them left pending years ago, and
    // its own filtered getters walk all of them on every call — slow against a
    // fork and no use to an operator, who is looking for the one they just
    // submitted.
    const total = (await s.multisig.transactionCount()).toNumber();
    const pending = [];
    for (let id = total - 1; id >= 0 && id >= total - MULTISIG_TAIL; id--) {
        if (!(await s.multisig.transactions(id)).executed) pending.unshift(id);
    }

    return {
        command: "status",
        chainTime: now,
        queue: s.queue.address,
        controller: s.controller.address,
        paused: await s.queue.securityPerimeterPaused(),
        perimeterEnabled: await s.controller.securityPerimeterEnabled(),
        delaySeconds: Number(await s.controller.globalDelaySeconds()),
        feeEnabled: await s.controller.exitFeeEnabled(),
        lastRequestId: last,
        requests,
        multisigRequired: (await s.multisig.required()).toNumber(),
        multisigTransactionCount: total,
        multisigPending: pending,
        multisigPendingScanned: MULTISIG_TAIL,
    };
};

/** Take a withdrawal on one surface. With the perimeter switched off the
 *  product pays on the spot and queues nothing, which is a result rather than a
 *  failure — the caller is told which of the two happened. */
const withdraw = async (s, opts = {}) => {
    const surface = opts.surface;
    const driver = drivers.SURFACE_DRIVERS[surface];
    if (!driver) {
        throw new Error(
            `perimeter:qa: unknown surface '${surface}' — one of: ` +
                Object.keys(drivers.SURFACE_DRIVERS).join(", ")
        );
    }
    const log = logOf(opts);
    const signer = await signerFor(s, opts.as);
    const originator = await drivers.addressOf(signer);
    const receiver = opts.receiver ? ethers.utils.getAddress(opts.receiver) : originator;
    const expectQueued = await s.controller.securityPerimeterEnabled();

    const result = await driver(s, signer, {
        receiver,
        amount: opts.amount,
        expectQueued,
        log,
    });
    const now = await chainNow();
    const paidNow = (await ethers.provider.getBalance(receiver)).sub(result.before.receiver);

    if (!result.id) {
        log(`  PASS-THROUGH  ${surface} withdrawal paid on the spot, nothing queued`);
        return {
            command: "withdraw",
            surface,
            as: originator,
            receiver,
            queued: false,
            id: null,
            receiverDelta: paidNow.toString(),
            note: "the perimeter is switched off — the product paid without queuing",
        };
    }
    const described = await describeRequest(s, result.id, now);
    log(
        `  QUEUED  ${surface} request ${described.id} for ${described.amount} ` +
            `(${described.remaining}s to go)`
    );
    return { command: "withdraw", surface, as: originator, queued: true, ...described };
};

/** The ONLY command that moves the chain clock. */
const advance = async (s, seconds, opts = {}) => {
    const log = logOf(opts);
    const jump = Number(seconds);
    if (!Number.isInteger(jump) || jump <= 0) {
        throw new Error("perimeter:qa advance: give a positive whole number of seconds");
    }
    const before = await chainNow();
    const provider = rpc();
    await forkOps.increaseTime(provider, jump);
    await forkOps.mine(provider, 1);
    const after = await chainNow();
    log(
        "  WARNING: the chain clock jumped. A wallet counts a hold down against ITS OWN clock, " +
            "so every countdown the dapp draws is now wrong by this much — reload nothing and " +
            "trust the queue's unlockAt, or restart the fork for a session that must look real."
    );
    return { command: "advance", seconds: jump, chainTimeBefore: before, chainTimeAfter: after };
};

/** Release one held request as its own originator, and prove the receiver was
 *  paid the escrowed amount to the wei. */
const execute = async (s, id, opts = {}) => {
    const request = await s.queue.getRequest(id);
    if (request.status !== STATUS.Queued) {
        throw new Error(
            `perimeter:qa execute: request ${id} is ${STATUS_NAMES[request.status]}, not Queued`
        );
    }
    const executor = opts.as ? await addressForWho(s, opts.as) : request.originator;
    const signer = await signerFor(s, executor);
    const native = request.token === ZERO_ADDRESS || request.unwrapOnDelivery;
    const token = native
        ? null
        : new ethers.Contract(request.token, drivers.ERC20_ABI, ethers.provider);
    const balanceOf = async () =>
        native ? ethers.provider.getBalance(request.receiver) : token.balanceOf(request.receiver);

    const before = await balanceOf();
    const result = await send(`execute ${id}`, s.queue.connect(signer).executeExit(id), {
        ...opts,
        verify: async (receipt) => {
            const after = await s.queue.getRequest(id);
            if (after.status !== STATUS.Executed) {
                return `request ${id} is ${STATUS_NAMES[after.status]}, not Executed`;
            }
            const gas =
                native &&
                ethers.utils.getAddress(executor) === ethers.utils.getAddress(request.receiver)
                    ? receipt.gasUsed.mul(receipt.effectiveGasPrice)
                    : ethers.constants.Zero;
            const want = before.add(request.amount).sub(gas);
            const got = await balanceOf();
            return got.eq(want) ? true : `the receiver holds ${got}, not the expected ${want}`;
        },
    });
    return {
        command: "execute",
        id: Number(id),
        executor,
        receiver: request.receiver,
        amount: request.amount.toString(),
        applied: result.applied,
        note: result.note,
        txHash: result.txHash,
    };
};

/** Every Queued request an actor may release, in one call. */
const executeAll = async (s, opts = {}) => {
    const who = await addressForWho(s, opts.as);
    const last = (await s.queue.lastRequestId()).toNumber();
    const ids = [];
    for (let id = 1; id <= last; id++) {
        const r = await s.queue.getRequest(id);
        if (r.status !== STATUS.Queued) continue;
        if ([r.originator, r.owner].some((a) => ethers.utils.getAddress(a) === who)) ids.push(id);
    }
    if (!ids.length) {
        return { command: "execute-all", as: who, ids: [], applied: true, note: "nothing to do" };
    }
    const signer = await signerFor(s, who);
    const result = await send(
        `execute-all ${ids.join(",")}`,
        s.queue.connect(signer).executeExits(ids),
        {
            ...opts,
            verify: async () => {
                for (const id of ids) {
                    const after = await s.queue.getRequest(id);
                    if (after.status !== STATUS.Executed) {
                        return `request ${id} is ${STATUS_NAMES[after.status]}, not Executed`;
                    }
                }
                return true;
            },
        }
    );
    return {
        command: "execute-all",
        as: who,
        ids,
        applied: result.applied,
        note: result.note,
        txHash: result.txHash,
    };
};

/** freeze and blacklist differ only in the lever and the state they land in. */
const blockFromRequests = async (s, kind, ids, opts = {}) => {
    const signature =
        kind === "freeze"
            ? "freezeFromRequest(uint256[],bool,bytes32)"
            : "blacklistFromRequest(uint256[],bool,bytes32)";
    const want = kind === "freeze" ? BLOCK.Frozen : BLOCK.Blacklisted;
    const alsoReceiver = Boolean(opts.alsoReceiver);
    const numeric = ids.map((id) => Number(id));
    const parties = [];
    for (const id of numeric) {
        const r = await s.queue.getRequest(id);
        if (r.status === STATUS.None) {
            throw new Error(`perimeter:qa ${kind}: request ${id} does not exist`);
        }
        parties.push(r.originator, r.owner);
        if (alsoReceiver) parties.push(r.receiver);
    }
    const result = await viaMultisig(
        s,
        `${kind} from request ${numeric.join(",")}`,
        s.queue.address,
        s.queue,
        signature,
        [numeric, alsoReceiver, REASON_QA],
        {
            ...opts,
            verify: async () => {
                for (const party of parties) {
                    const state = await s.queue.blockStateOf(party);
                    if (state !== want) {
                        return `${party} is ${BLOCK_NAMES[state]}, not ${BLOCK_NAMES[want]}`;
                    }
                }
                return true;
            },
        }
    );
    return {
        command: kind,
        ids: numeric,
        alsoReceiver,
        parties: [...new Set(parties.map((p) => ethers.utils.getAddress(p)))],
        reason: REASON_QA,
        ...result,
        receipt: undefined,
    };
};

const freeze = (s, ids, opts) => blockFromRequests(s, "freeze", ids, opts);
const blacklist = (s, ids, opts) => blockFromRequests(s, "blacklist", ids, opts);

/** Back to None. The queue exposes one lever per state and refuses the wrong
 *  one, so the caller has to say which state it is undoing. */
const release = async (s, address, opts = {}) => {
    const party = ethers.utils.getAddress(address);
    const blacklisted =
        opts.blacklisted === undefined
            ? (await s.queue.blockStateOf(party)) === BLOCK.Blacklisted
            : Boolean(opts.blacklisted);
    const signature = blacklisted ? "unblacklist(address[])" : "unfreeze(address[])";
    const result = await viaMultisig(
        s,
        `${blacklisted ? "unblacklist" : "unfreeze"} ${party}`,
        s.queue.address,
        s.queue,
        signature,
        [[party]],
        {
            ...opts,
            verify: async () => {
                const state = await s.queue.blockStateOf(party);
                return state === BLOCK.None ? true : `${party} is still ${BLOCK_NAMES[state]}`;
            },
        }
    );
    return { command: "release", address: party, blacklisted, ...result, receipt: undefined };
};

const setPaused = async (s, paused, opts = {}) => {
    const result = await viaMultisig(
        s,
        paused ? "pause" : "unpause",
        s.queue.address,
        s.queue,
        "setSecurityPerimeterPaused(bool)",
        [paused],
        {
            ...opts,
            verify: async () =>
                (await s.queue.securityPerimeterPaused()) === paused
                    ? true
                    : `the queue reports paused=${!paused}`,
        }
    );
    return { command: paused ? "pause" : "unpause", paused, ...result, receipt: undefined };
};

const pause = (s, opts) => setPaused(s, true, opts);
const unpause = (s, opts) => setPaused(s, false, opts);

/** The kill switch stops the delay being quoted on NEW withdrawals. It does not
 *  reach the requests already in the queue: those keep their own unlock. */
const kill = async (s, on, opts = {}) => {
    const enabled = Boolean(on);
    const result = await viaMultisig(
        s,
        `kill switch ${enabled ? "on" : "off"}`,
        s.controller.address,
        s.controller,
        "setSecurityPerimeterEnabled(bool)",
        [enabled],
        {
            ...opts,
            verify: async () =>
                (await s.controller.securityPerimeterEnabled()) === enabled
                    ? true
                    : `the controller reports enabled=${!enabled}`,
        }
    );
    return { command: "kill", enabled, ...result, receipt: undefined };
};

const routeIdOf = (surfaceId, subProduct, token, destination) =>
    ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "address"],
            [surfaceId, subProduct, token, destination]
        )
    );

/** The provenance a route has to match is the one the requests carry, so it is
 *  read off a real request on that surface rather than assumed. */
const provenanceOf = async (s, surfaceId) => {
    const last = (await s.queue.lastRequestId()).toNumber();
    for (let id = last; id >= 1; id--) {
        const r = await s.queue.getRequest(id);
        if (r.surfaceId === surfaceId) return { subProduct: r.subProduct, token: r.token };
    }
    throw new Error(
        "perimeter:qa route: no request on this surface yet — a route is keyed by the " +
            "provenance of the exits it may recover, so take one withdrawal first"
    );
};

/**
 * Register a recovery route for one surface.
 *
 * `topup` sends recovered escrow back to the pool the exit came from, which the
 * queue will only allow on a surface marked feasible and only to the sub-product
 * itself. `address <a>` registers the plain destination instead.
 */
const route = async (s, surface, mode, destinationAddress, opts = {}) => {
    const surfaceId = SURFACE_IDS[surface];
    if (!surfaceId) {
        throw new Error(
            `perimeter:qa route: unknown surface '${surface}' — one of: ` +
                Object.keys(SURFACE_IDS).join(", ")
        );
    }
    const { subProduct, token } = await provenanceOf(s, surfaceId);
    const topUp = mode === "topup";
    if (!topUp && mode !== "address") {
        throw new Error("perimeter:qa route: the mode is 'topup' or 'address <address>'");
    }
    const destination = topUp ? subProduct : ethers.utils.getAddress(destinationAddress);
    const steps = [];

    if (topUp) {
        steps.push(
            await viaMultisig(
                s,
                `top-up feasible for ${surface}`,
                s.queue.address,
                s.queue,
                "setTopUpFeasible(bytes32,bool)",
                [surfaceId, true],
                {
                    ...opts,
                    verify: async () =>
                        (await s.queue.topUpFeasible(surfaceId))
                            ? true
                            : "the surface is still marked infeasible",
                }
            )
        );
    }

    const routeId = routeIdOf(surfaceId, subProduct, token, destination);
    steps.push(
        await viaMultisig(
            s,
            `recovery route for ${surface} to ${destination}`,
            s.queue.address,
            s.queue,
            "setRecoveryRoute((bool,bytes32,address,address,address,bool))",
            [[true, surfaceId, subProduct, token, destination, topUp]],
            {
                ...opts,
                verify: async () =>
                    (await s.queue.getRecoveryRoute(routeId)).active
                        ? true
                        : `route ${routeId} is not active`,
            }
        )
    );

    return {
        command: "route",
        surface,
        mode,
        subProduct,
        token: token === ZERO_ADDRESS ? "native" : token,
        destination,
        routeId,
        applied: steps.every((step) => step.applied),
        steps: steps.map((step) => ({
            label: step.signature,
            applied: step.applied,
            txId: step.txId,
            note: step.note,
        })),
    };
};

/** The registered route a set of requests may be recovered along, or null. */
const activeRouteFor = async (s, surfaceId, subProduct, token) => {
    for (const routeId of await s.queue.recoveryRouteIds()) {
        const r = await s.queue.getRecoveryRoute(routeId);
        if (!r.active) continue;
        if (r.surfaceId !== surfaceId) continue;
        if (ethers.utils.getAddress(r.subProduct) !== ethers.utils.getAddress(subProduct))
            continue;
        if (ethers.utils.getAddress(r.token) !== ethers.utils.getAddress(token)) continue;
        return { routeId, destination: r.destination, topUpPool: r.topUpPool };
    }
    return null;
};

const balanceReader = (token) =>
    token === ZERO_ADDRESS
        ? (who) => ethers.provider.getBalance(who)
        : (who) => new ethers.Contract(token, drivers.ERC20_ABI, ethers.provider).balanceOf(who);

/**
 * Send blacklisted escrow away from its receiver — back into the pool it came
 * from along a pre-approved route, or to a named address by the owner's own
 * lever. Both are refused on anything that is not blacklisted.
 */
const refund = async (s, ids, to, opts = {}) => {
    const numeric = ids.map((id) => Number(id));
    const requests = [];
    for (const id of numeric) requests.push(await s.queue.getRequest(id));
    const token = requests[0].token;
    if (requests.some((r) => r.token !== token)) {
        throw new Error("perimeter:qa refund: one call cannot mix requests holding two tokens");
    }
    const total = requests.reduce((sum, r) => sum.add(r.amount), ethers.constants.Zero);

    const toPool = String(to).toLowerCase() === "pool";
    let destination;
    let routeId = null;
    if (toPool) {
        const surfaceId = requests[0].surfaceId;
        if (requests.some((r) => r.surfaceId !== surfaceId)) {
            throw new Error("perimeter:qa refund: a route covers one surface, not several");
        }
        // The route is looked up by the provenance the requests carry, not
        // rebuilt from an assumed destination: a surface whose escrow is native
        // has no pool to top up and is recovered along a plain route instead.
        const found = await activeRouteFor(s, surfaceId, requests[0].subProduct, token);
        if (!found) {
            throw new Error(
                "perimeter:qa refund: no active recovery route matches these requests — run " +
                    `\`route ${SURFACE_NAMES[surfaceId] || surfaceId} topup\` or ` +
                    `\`route ${SURFACE_NAMES[surfaceId] || surfaceId} address <address>\` first`
            );
        }
        routeId = found.routeId;
        destination = found.destination;
    } else {
        destination = ethers.utils.getAddress(to);
    }

    const wantStatus = toPool ? STATUS.ResolvedToProtocol : STATUS.ResolvedBySIP;
    const read = balanceReader(token);
    const before = await read(destination);
    const result = await viaMultisig(
        s,
        `refund ${numeric.join(",")} to ${toPool ? "the pool" : destination}`,
        s.queue.address,
        s.queue,
        toPool ? "resolveToProtocol(uint256[],bytes32)" : "resolveBySIP(uint256[],address)",
        toPool ? [numeric, routeId] : [numeric, destination],
        {
            ...opts,
            verify: async () => {
                for (const id of numeric) {
                    const after = await s.queue.getRequest(id);
                    if (after.status !== wantStatus) {
                        return `request ${id} is ${STATUS_NAMES[after.status]}, not ${
                            STATUS_NAMES[wantStatus]
                        }`;
                    }
                }
                const got = await read(destination);
                return got.eq(before.add(total))
                    ? true
                    : `${destination} holds ${got}, not the expected ${before.add(total)}`;
            },
        }
    );
    return {
        command: "refund",
        ids: numeric,
        to: toPool ? "pool" : destination,
        destination,
        routeId,
        amount: total.toString(),
        ...result,
        receipt: undefined,
    };
};

/**
 * Add confirmations to a pending multisig transaction from the wallet's real
 * owners. Only needed on a fork booted with the threshold left alone.
 */
const confirm = async (s, txId, opts = {}) => {
    const id = Number(txId);
    const log = logOf(opts);
    if ((await s.multisig.transactions(id)).executed) {
        return { command: "confirm", txId: id, applied: true, note: "already executed" };
    }
    const owners = await s.multisig.getOwners();
    const added = [];
    for (const owner of owners) {
        if ((await s.multisig.transactions(id)).executed) break;
        if (await s.multisig.confirmations(id, owner)) continue;
        const signer = await drivers.solventSigner(s, owner);
        await (
            await s.multisig
                .connect(signer)
                .confirmTransaction(id, { gasLimit: OPERATOR_CALL_GAS })
        ).wait();
        added.push(owner);
    }
    const executed = (await s.multisig.transactions(id)).executed;
    log(
        `  ${executed ? "OK" : "NOT APPLIED"}  confirm ${id} ` +
            `(+${added.length} confirmations)${executed ? "" : " — the inner call was swallowed"}`
    );
    return {
        command: "confirm",
        txId: id,
        applied: executed,
        confirmedBy: added,
        confirmations: (await s.multisig.getConfirmationCount(id)).toNumber(),
        required: (await s.multisig.required()).toNumber(),
    };
};

const snapshot = async (s, opts = {}) => {
    const id = await rpc().send("evm_snapshot", []);
    logOf(opts)(`  snapshot ${id}`);
    return { command: "snapshot", snapshot: id };
};

/** A revert throws away every block after the snapshot, including the ones a
 *  wallet has already seen; reconnect MetaMask afterwards or it keeps a nonce
 *  the chain no longer knows about. */
const revert = async (s, id, opts = {}) => {
    const ok = await rpc().send("evm_revert", [id]);
    logOf(opts)(
        `  ${ok ? "OK" : "NOT APPLIED"}  revert to ${id} — reconnect any wallet pointed at ` +
            "this fork, its account nonce is now ahead of the chain"
    );
    return {
        command: "revert",
        snapshot: id,
        applied: Boolean(ok),
        lastRequestId: ok ? (await s.queue.lastRequestId()).toNumber() : null,
    };
};

/** Append one command's result to the engine's own record of the session. */
const appendState = (record) => {
    let entries = [];
    if (fs.existsSync(LOG_FILE)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
            if (Array.isArray(parsed)) entries = parsed;
        } catch (error) {
            // A file that is not a JSON array is history from something else and
            // is replaced rather than appended to.
        }
    }
    entries.push({ at: new Date().toISOString(), ...record });
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.writeFileSync(LOG_FILE, `${JSON.stringify(entries, null, 4)}\n`);
    return LOG_FILE;
};

module.exports = {
    LOG_FILE,
    OPERATOR_CALL_GAS,
    REASON_QA,
    SURFACE_IDS,
    SURFACE_NAMES,
    STATUS_NAMES,
    BLOCK_NAMES,
    assertQa,
    signerFor,
    addressForWho,
    send,
    viaMultisig,
    calldataFor,
    routeIdOf,
    activeRouteFor,
    revertReason,
    appendState,
    status,
    withdraw,
    advance,
    execute,
    executeAll,
    freeze,
    blacklist,
    release,
    pause,
    unpause,
    kill,
    route,
    refund,
    confirm,
    snapshot,
    revert,
};
