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
const { assertLocalQaFork } = require("./guard");
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
 * One write, with the state it claims to change read back afterwards.
 *
 * `verify` returns true when the change landed, or a string describing what is
 * wrong. Its verdict, not the receipt's status, decides OK vs NOT APPLIED.
 *
 * A call the chain refuses outright never reaches `verify`: it comes back as
 * REFUSED carrying the contract's own error name, decoded against
 * `opts.contract`. Without that a refusal reaches the operator as a wall of
 * provider JSON with the reason buried in it.
 */
const send = async (label, txPromise, opts = {}) => {
    const log = logOf(opts);
    let receipt;
    try {
        const tx = await txPromise;
        receipt = await tx.wait();
    } catch (error) {
        const why = opts.contract
            ? revertReason(opts.contract, error)
            : error.reason || error.message;
        log(`  REFUSED  ${label}: ${why}`);
        return {
            label,
            applied: false,
            refused: true,
            reason: String(why),
            note: `REFUSED: ${why}`,
            txHash: null,
            gasUsed: null,
            receipt: null,
        };
    }
    const verdict = opts.verify ? await opts.verify(receipt) : true;
    const applied = verdict === true;
    const note = applied ? "" : ` (${verdict})`;
    log(`  ${applied ? "OK" : "NOT APPLIED"}  ${label}${note}  [gas ${receipt.gasUsed}]`);
    return {
        label,
        applied,
        refused: false,
        reason: null,
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

/**
 * Reconstructable checks for what a multisig-submitted command was supposed
 * to establish, keyed by a `{kind, args}` descriptor plain enough to survive
 * a round trip through the state file's JSON. `viaMultisig` runs one of these
 * at submission time, and `confirm` — very often a SEPARATE process
 * invocation, run after the transaction has gone pending — re-runs the exact
 * same one, reading the state the wallet's own `executed` flag alone cannot
 * speak to: whether the target contract actually ended up where the command
 * meant to leave it.
 */
const POSTCONDITIONS = {
    blockState: async (s, { addresses, want }) => {
        const target = BLOCK[want];
        for (const address of addresses) {
            const state = await s.queue.blockStateOf(address);
            if (state !== target) return `${address} is ${BLOCK_NAMES[state]}, not ${want}`;
        }
        return true;
    },
    queuePaused: async (s, { want }) =>
        (await s.queue.securityPerimeterPaused()) === want
            ? true
            : `the queue reports paused=${!want}`,
    perimeterEnabled: async (s, { want }) =>
        (await s.controller.securityPerimeterEnabled()) === want
            ? true
            : `the controller reports enabled=${!want}`,
    topUpFeasible: async (s, { surfaceId }) =>
        (await s.queue.topUpFeasible(surfaceId)) ? true : "the surface is still marked infeasible",
    recoveryRouteActive: async (s, { routeId }) =>
        (await s.queue.getRecoveryRoute(routeId)).active ? true : `route ${routeId} is not active`,
    refundResolved: async (s, { ids, wantStatus, token, destination, before, total }) => {
        for (const id of ids) {
            const after = await s.queue.getRequest(id);
            if (after.status !== STATUS[wantStatus]) {
                return `request ${id} is ${STATUS_NAMES[after.status]}, not ${wantStatus}`;
            }
        }
        const got = await balanceReader(token)(destination);
        const want = ethers.BigNumber.from(before).add(total);
        return got.eq(want) ? true : `${destination} holds ${got}, not the expected ${want}`;
    },
};

/**
 * Re-run a persisted postcondition descriptor. A command with nothing to
 * check (none of the levers below leave one unset) reads as trivially true;
 * an UNRECOGNIZED kind throws rather than passing silently — that means this
 * file's own postcondition table and its command sites have drifted apart,
 * not that the command applied.
 */
const runPostcondition = async (s, postcondition) => {
    if (!postcondition) return true;
    const check = POSTCONDITIONS[postcondition.kind];
    if (!check) {
        throw new Error(
            `perimeter:qa: no postcondition checker registered for '${postcondition.kind}'`
        );
    }
    return check(s, postcondition.args || {});
};

/**
 * One operator lever, submitted to the Exchequer from the test key.
 *
 * At threshold 1 the submission executes on the spot. Above it the transaction
 * is left pending for `confirm`, which is a different outcome from a lever that
 * ran and did nothing — the two are never reported the same way.
 *
 * `opts.postcondition` is what the caller wants ESTABLISHED, not just the
 * wallet's own `executed` flag — the same descriptor is carried on the
 * returned record (and so into the state file `appendState` writes it to),
 * so a later `confirm` on the same transaction id can re-run it rather than
 * trusting `executed` alone.
 */
const viaMultisig = async (s, label, target, contract, signature, args, opts = {}) => {
    const log = logOf(opts);
    const encoded = calldataFor(s, target, contract, signature, args);
    const postcondition = opts.postcondition || null;
    if (opts.viaConsole) {
        log(`  CALLDATA  ${label}`);
        log(`    target             ${encoded.target}`);
        log(`    ${encoded.signature}`);
        log(`    selector           ${encoded.selector}`);
        encoded.args.forEach((a, i) => log(`    arg ${i}              ${a}`));
        log(`    calldata           ${encoded.calldata}`);
        log(`    multisig           ${encoded.multisig}`);
        log(`    submitTransaction  ${encoded.multisigCalldata}`);
        return { ...encoded, sent: false, applied: null, txId: null, postcondition };
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
            // The submission itself is a call on the wallet, so a refusal of it
            // decodes against the wallet. The inner call's own refusal is read
            // separately below, because the wallet swallows it.
            contract: s.multisig,
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
                return runPostcondition(s, postcondition);
            },
        }
    );
    if (result.refused) {
        log(`  REFUSED  ${label}: ${result.reason}`);
        return {
            ...encoded,
            sent: true,
            applied: false,
            pending: false,
            txId: null,
            note: result.note,
            postcondition,
        };
    }
    const entry = result.receipt.logs.find((l) => l.topics[0] === SUBMISSION_TOPIC);
    const txId = entry ? ethers.BigNumber.from(entry.topics[1]).toNumber() : null;
    const pending = txId !== null && !(await s.multisig.transactions(txId)).executed;
    const state = result.applied ? "OK" : pending && required > 1 ? "PENDING" : "NOT APPLIED";
    log(
        `  ${state}  ${label}${result.applied ? "" : ` (${result.note})`}  ` +
            `[multisig tx ${txId}, gas ${result.gasUsed}]`
    );
    return {
        ...encoded,
        sent: true,
        applied: result.applied,
        pending,
        txId,
        note: result.note,
        postcondition,
    };
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
    // Reads the receiver's NATIVE balance for every surface — correct only
    // because each current driver's direct-pay leg resolves to native RBTC
    // (the lender driver always calls burnToBTC, the borrower driver always
    // borrows against WRBTC collateral, and Zero/surplus are natively
    // denominated by construction). A driver whose direct-pay leg paid out a
    // plain ERC20 instead would silently have this watch the wrong balance;
    // none of the surfaces this engine drives does that today.
    let paidNow = (await ethers.provider.getBalance(receiver)).sub(result.before.receiver);
    // When the receiver IS the transaction's own signer (the default —
    // `opts.receiver` omitted), gas is debited from the very balance this
    // measures. Left unadjusted, a hook that leaks a payment no bigger than
    // its own gas cost reads as zero or negative and slips past both checks
    // below. Credited = after - before + gasUsed * effectiveGasPrice restores
    // what was actually paid, independent of who footed the call's gas.
    if (ethers.utils.getAddress(receiver) === originator) {
        paidNow = paidNow.add(result.receipt.gasUsed.mul(result.receipt.effectiveGasPrice));
    }

    if (!result.id) {
        // The perimeter is switched off, so the product is supposed to pay on
        // the spot — but a defective hook that neither queues nor pays would
        // also reach here with nothing to report. Require a real,
        // gas-normalized, positive payment before calling this branch clean —
        // UNLESS the Perimeter fee is independently active at a rate that
        // genuinely nets the receiver 0 (a 100%-rate policy is a legal, if
        // unusual, configuration: the delay and the fee are independent
        // switches, and a zero net here is then the correct outcome, not a
        // leak). Checked against the controller's OWN quote for this exact
        // surface/actor, not assumed from `paidNow` alone.
        let note = "the perimeter is switched off — the product paid without queuing";
        if (!paidNow.gt(0)) {
            if (result.subProduct === undefined) {
                throw new Error(
                    `perimeter:qa withdraw: ${surface}'s driver did not report which sub-product ` +
                        "this withdrawal resolves against, so a zero payment cannot be told apart " +
                        "from a defect"
                );
            }
            const quote = await s.controller.quoteExitFee(
                SURFACE_IDS[surface],
                result.subProduct,
                originator,
                ethers.constants.WeiPerEther
            );
            if (!quote.netAmount.isZero()) {
                throw new Error(
                    `perimeter:qa withdraw: ${surface} was not queued (the perimeter is switched ` +
                        `off) but ${receiver} was not paid either — credited ${paidNow.toString()} ` +
                        "(gas-normalized), and the controller's own quote for this actor does not " +
                        "charge a 100% fee. Neither held nor paid."
                );
            }
            note =
                "the perimeter is switched off — the controller's own quote charges " +
                `${originator} a 100% Perimeter fee, so paying 0 is correct`;
        }
        log(`  PAID DIRECT  ${surface} withdrawal paid on the spot, nothing queued`);
        return {
            command: "withdraw",
            surface,
            as: originator,
            receiver,
            queued: false,
            id: null,
            receiverDelta: paidNow.toString(),
            note,
        };
    }
    // A queued withdrawal must not ALSO have paid the receiver — that is the
    // one thing "held" is supposed to guarantee. `paidNow` is already
    // gas-normalized above, so a receiver that happens to be the signer can no
    // longer mask a leak no bigger than its own gas cost: reading positive
    // here is unconditionally a hook that both queued and paid, never a false
    // alarm from gas. Checked before describing the request: there is nothing
    // useful to report about a "clean hold" that was not actually clean.
    if (paidNow.gt(0)) {
        throw new Error(
            `perimeter:qa withdraw: ${surface} request ${result.id} was queued but ALSO paid ` +
                `${paidNow.toString()} to ${receiver} — a hook that both queues and pays, not a ` +
                "clean hold. Freezing the queued request would accomplish nothing here."
        );
    }
    const described = await describeRequest(s, result.id, now);
    log(
        `  QUEUED  ${surface} request ${described.id} for ${described.amount} ` +
            `(${described.remaining}s to go)`
    );
    return {
        command: "withdraw",
        surface,
        as: originator,
        queued: true,
        receiverDelta: paidNow.toString(),
        ...described,
    };
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
    if (after < before + jump) {
        throw new Error(
            `perimeter:qa advance: the chain clock went from ${before} to ${after}, short of the ` +
                `${jump}s asked for — nothing downstream that counts on the hold having run out ` +
                "can be trusted"
        );
    }
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
        contract: s.queue,
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
        refused: result.refused,
        reason: result.reason,
        note: result.note,
        txHash: result.txHash,
    };
};

const balanceReader = (token) =>
    token === ZERO_ADDRESS
        ? (who) => ethers.provider.getBalance(who)
        : (who) => new ethers.Contract(token, drivers.ERC20_ABI, ethers.provider).balanceOf(who);

/** The asset a request actually pays out in — native RBTC when the escrowed
 *  token itself is native OR the request unwraps WRBTC on delivery (the
 *  lender surface's escrow), the escrowed token otherwise. Mirrors the same
 *  test `execute()` uses for its own gas leg. */
const payoutAssetOf = (r) =>
    r.token === ZERO_ADDRESS || r.unwrapOnDelivery ? ZERO_ADDRESS : r.token;

/** Every Queued request an actor may release, in one call. */
const executeAll = async (s, opts = {}) => {
    const who = await addressForWho(s, opts.as);
    const last = (await s.queue.lastRequestId()).toNumber();
    const ids = [];
    const requests = [];
    for (let id = 1; id <= last; id++) {
        const r = await s.queue.getRequest(id);
        if (r.status !== STATUS.Queued) continue;
        if ([r.originator, r.owner].some((a) => ethers.utils.getAddress(a) === who)) {
            ids.push(id);
            requests.push(r);
        }
    }
    if (!ids.length) {
        return { command: "execute-all", as: who, ids: [], applied: true, note: "nothing to do" };
    }

    // Snapshot per (asset, receiver) balances BEFORE the batch, so a
    // successful batch's payouts can be verified exactly — not just that
    // every id's status moved to Executed, which says nothing about whether
    // anyone was actually paid, or paid the right amount.
    const expected = new Map();
    for (const r of requests) {
        const asset = payoutAssetOf(r);
        const key = `${asset}:${ethers.utils.getAddress(r.receiver)}`;
        const entry = expected.get(key) || {
            asset,
            receiver: r.receiver,
            amount: ethers.constants.Zero,
        };
        entry.amount = entry.amount.add(r.amount);
        expected.set(key, entry);
    }
    const before = new Map();
    for (const [key, entry] of expected) {
        before.set(key, await balanceReader(entry.asset)(entry.receiver));
    }

    const signer = await signerFor(s, who);
    const result = await send(
        `execute-all ${ids.join(",")}`,
        s.queue.connect(signer).executeExits(ids),
        {
            ...opts,
            contract: s.queue,
            verify: async (receipt) => {
                for (const id of ids) {
                    const after = await s.queue.getRequest(id);
                    if (after.status !== STATUS.Executed) {
                        return `request ${id} is ${STATUS_NAMES[after.status]}, not Executed`;
                    }
                }
                // Gas is native-only and paid by the executor regardless of
                // which asset it is being paid in, so it only ever offsets a
                // native payout to the executor itself.
                const gas = receipt.gasUsed.mul(receipt.effectiveGasPrice);
                for (const [key, entry] of expected) {
                    const got = await balanceReader(entry.asset)(entry.receiver);
                    const isExecutorNative =
                        entry.asset === ZERO_ADDRESS &&
                        ethers.utils.getAddress(entry.receiver) === who;
                    const want = before
                        .get(key)
                        .add(entry.amount)
                        .sub(isExecutorNative ? gas : ethers.constants.Zero);
                    if (!got.eq(want)) {
                        const assetName = entry.asset === ZERO_ADDRESS ? "native" : entry.asset;
                        return `${entry.receiver} holds ${got} of ${assetName}, not the expected ${want}`;
                    }
                }
                return true;
            },
        }
    );
    // executeExits takes the whole batch or none of it, so one refused request
    // leaves every other one in the batch untouched and still Queued.
    const note = result.refused
        ? `${result.note} — the whole batch rolled back, no request was released`
        : result.note;
    if (result.refused) logOf(opts)(`  the whole batch rolled back, no request was released`);
    return {
        command: "execute-all",
        as: who,
        ids,
        applied: result.applied,
        refused: result.refused,
        reason: result.reason,
        note,
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
            postcondition: {
                kind: "blockState",
                args: { addresses: parties, want: kind === "freeze" ? "Frozen" : "Blacklisted" },
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
            postcondition: { kind: "blockState", args: { addresses: [party], want: "None" } },
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
            postcondition: { kind: "queuePaused", args: { want: paused } },
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
            postcondition: { kind: "perimeterEnabled", args: { want: enabled } },
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

/** The compact record kept for one step of a compound (multi-transaction)
 *  command — everything `findPostconditionFor` and a later `confirm` need to
 *  re-verify that ONE step's transaction on its own, not just the wallet's
 *  `executed` flag. Kept as a named function, not an inline map callback, so
 *  it has one place to add a field to and one place a test can check
 *  directly. */
const summarizeStep = (step) => ({
    label: step.signature,
    applied: step.applied,
    txId: step.txId,
    postcondition: step.postcondition,
    note: step.note,
});

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
            `perimeter:qa route: '${surface || "<nothing>"}' is not a surface — say ` +
                `\`route <${Object.keys(SURFACE_IDS).join("|")}> topup|address <address>\``
        );
    }
    const topUp = mode === "topup";
    if (!topUp && mode !== "address") {
        throw new Error(
            `perimeter:qa route: '${mode || "<nothing>"}' is not a mode — say ` +
                `\`route ${surface} topup\` to send recovered escrow back to the pool the exit ` +
                `came from, or \`route ${surface} address <address>\` to name a destination`
        );
    }
    if (!topUp && !ethers.utils.isAddress(String(destinationAddress))) {
        throw new Error(
            `perimeter:qa route: '${destinationAddress || "<nothing>"}' is not an address — ` +
                `\`route ${surface} address\` needs the destination to send recovered escrow to`
        );
    }
    const { subProduct, token } = await provenanceOf(s, surfaceId);
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
                    postcondition: { kind: "topUpFeasible", args: { surfaceId } },
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
                postcondition: { kind: "recoveryRouteActive", args: { routeId } },
            }
        )
    );

    // With --via-console nothing was sent, so there is no verdict to report:
    // `applied` stays null rather than reading as a failure.
    const sent = steps.every((step) => step.sent);
    return {
        command: "route",
        surface,
        mode,
        subProduct,
        token: token === ZERO_ADDRESS ? "native" : token,
        destination,
        routeId,
        sent,
        applied: sent ? steps.every((step) => step.applied) : null,
        note: sent ? null : "nothing was sent — the calldata for each step was printed instead",
        // route is the one command that submits more than one multisig
        // transaction, so its own summary cannot carry a single top-level
        // txId/postcondition the way every other command's can. Each step
        // keeps its OWN txId and postcondition here instead — dropping
        // postcondition would make a later, separate `confirm <txId>` on
        // either step unable to find anything to re-verify and silently
        // fall back to trusting the wallet's `executed` flag alone.
        steps: steps.map(summarizeStep),
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

/**
 * Send escrow away from its receiver. The two legs do NOT have the same reach.
 *
 * `--to pool` walks the pre-approved route, and the queue admits a request only
 * when its originator or its owner is BLACKLISTED — a freeze is not enough, and
 * a blacklisted receiver never authorizes it. The route must also match the
 * request's own surface, sub-product and token.
 *
 * `--to <address>` is the owner's catch-all, and it is wider: the queue admits
 * any request whose originator, owner or receiver is blocked in either degree
 * (frozen or blacklisted), OR that is sitting in a paused queue, OR that is
 * still inside its delay window. Only a request past its unlock time with no
 * party blocked and the queue unpaused is out of its reach.
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

    const wantStatusName = toPool ? "ResolvedToProtocol" : "ResolvedByOwner";
    const read = balanceReader(token);
    const before = await read(destination);
    const result = await viaMultisig(
        s,
        `refund ${numeric.join(",")} to ${toPool ? "the pool" : destination}`,
        s.queue.address,
        s.queue,
        toPool ? "resolveToProtocol(uint256[],bytes32)" : "resolveByOwner(uint256[],address)",
        toPool ? [numeric, routeId] : [numeric, destination],
        {
            ...opts,
            postcondition: {
                kind: "refundResolved",
                args: {
                    ids: numeric,
                    wantStatus: wantStatusName,
                    token,
                    destination,
                    before: before.toString(),
                    total: total.toString(),
                },
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
 * Decide `confirm()`'s verdict from whether the wallet's inner call executed
 * and, if it did, whether a postcondition was on file to re-check it
 * against.
 *
 * `executed` is the wallet's own bookkeeping — it means the inner call ran
 * without reverting, not that it left the target contract in the state the
 * submitted command meant to establish (that is exactly the class of thing an
 * incident-response lever needs to be trusted for). Three distinct outcomes:
 *
 *   - not executed at all: definitively not applied — nothing ran, so there
 *     is nothing to verify. `applied: false`, `verified: true`.
 *   - executed, postcondition on file: genuinely re-checked. `applied`
 *     reports whether it held, `verified: true` either way.
 *   - executed, NO postcondition on file (a transaction this session did not
 *     submit itself — e.g. a live wallet backlog entry): there is nothing to
 *     check it against, so the engine must not claim a state it did not
 *     read. `applied: null` (unknown, not a silent `true`), `verified: false`.
 */
const confirmVerdict = async (s, postcondition, executed) => {
    if (!executed) {
        return { applied: false, verified: true, held: null };
    }
    if (!postcondition) {
        return { applied: null, verified: false, held: null };
    }
    const held = await runPostcondition(s, postcondition);
    return { applied: held === true, verified: true, held };
};

/** The note text for one `confirmVerdict()` outcome, shared by both of
 *  `confirm()`'s return points so the wording never drifts between them. */
const confirmNote = ({ applied, verified, held }, { executed, alreadyExecuted }) => {
    if (!executed) return null;
    if (!verified) {
        return "executed, not verified — no postcondition was recorded for this transaction";
    }
    if (applied) return alreadyExecuted ? "already executed" : null;
    return alreadyExecuted
        ? `already executed, but ${held}`
        : `the multisig executed the call, but ${held}`;
};

/**
 * Add confirmations to a pending multisig transaction from the wallet's real
 * owners. Only needed on a fork booted with the threshold left alone.
 */
const confirm = async (s, txId, opts = {}) => {
    const id = Number(txId);
    if (!Number.isInteger(id) || id < 0) {
        throw new Error(
            `perimeter:qa confirm: '${txId === undefined ? "<nothing>" : txId}' is not a ` +
                "multisig transaction id — `status` lists the pending ones, and every lever " +
                "reports the id it submitted"
        );
    }
    if (id >= (await s.multisig.transactionCount()).toNumber()) {
        throw new Error(`perimeter:qa confirm: the wallet has no transaction ${id}`);
    }
    const log = logOf(opts);
    const postcondition =
        opts.postcondition !== undefined ? opts.postcondition : findPostconditionFor(id);

    if ((await s.multisig.transactions(id)).executed) {
        const verdict = await confirmVerdict(s, postcondition, true);
        return {
            command: "confirm",
            txId: id,
            applied: verdict.applied,
            verified: verdict.verified,
            note: confirmNote(verdict, { executed: true, alreadyExecuted: true }),
        };
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
    const verdict = await confirmVerdict(s, postcondition, executed);
    const note = confirmNote(verdict, { executed, alreadyExecuted: false });
    const label = !executed
        ? "NOT APPLIED"
        : !verdict.verified
          ? "NOT VERIFIED"
          : verdict.applied
            ? "OK"
            : "NOT APPLIED";
    const detail = !executed
        ? " — the inner call was swallowed"
        : !verdict.verified || !verdict.applied
          ? ` — ${note}`
          : "";
    log(`  ${label}  confirm ${id} (+${added.length} confirmations)${detail}`);
    return {
        command: "confirm",
        txId: id,
        applied: verdict.applied,
        verified: verdict.verified,
        note,
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

/**
 * The postcondition a submission recorded for a multisig transaction id, read
 * back from the state file `appendState` wrote it to. `confirm` is very often
 * a separate process invocation from the submission it is confirming — the
 * state file is the only thing connecting the two. The LAST matching entry
 * wins, in case the same id was ever submitted more than once; a missing or
 * unreadable file yields none, same as a fresh session that submitted nothing
 * itself.
 */
const findPostconditionFor = (txId) => {
    if (!fs.existsSync(LOG_FILE)) return null;
    let entries;
    try {
        entries = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
    } catch (error) {
        return null;
    }
    if (!Array.isArray(entries)) return null;
    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry.txId === txId && entry.postcondition) return entry.postcondition;
        // A compound command (route) submits more than one multisig
        // transaction, so it cannot carry a single txId/postcondition at its
        // own top level — each of its steps carries its own instead. This is
        // the only other place a transaction id this function is asked
        // about can be recorded.
        if (Array.isArray(entry.steps)) {
            for (let j = entry.steps.length - 1; j >= 0; j--) {
                const step = entry.steps[j];
                if (step && step.txId === txId && step.postcondition) return step.postcondition;
            }
        }
    }
    return null;
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
    summarizeStep,
    revertReason,
    runPostcondition,
    findPostconditionFor,
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
