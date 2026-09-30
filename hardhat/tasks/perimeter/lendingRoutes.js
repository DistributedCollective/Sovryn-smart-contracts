/* eslint-disable no-console */
const { task } = require("hardhat/config");
const { ethers } = require("ethers");
const Logs = require("node-logs");
const { getSignerFromAccount } = require("../../../deployment/helpers/helpers");
const policy = require("./policy");
const recovery = require("./recovery");
const recoveryTasks = require("./recoveryTasks");
const { resolveOptionalAddress } = require("./addressParam");

const logger = new Logs().showInConsole(true);

const TASK = "perimeter:route:lending-pools";
const LENDER = policy.SURFACES.PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW;

/** The protocol's pool list is read in pages of this size until a page comes
 *  back short. */
const POOL_PAGE = 50;

/** How many of the multisig's transactions are read at once. */
const WALLET_READ_BATCH = 25;

/** How many times one read of the multisig is tried before the read fails, and
 *  the pause after the first failed try, which doubles after each further one. */
const WALLET_READ_ATTEMPTS = 4;
const WALLET_READ_RETRY_MS = 400;

const PROTOCOL_ABI = [
    "function getLoanPoolsList(uint256 start, uint256 count) view returns (bytes32[])",
    "function loanPoolToUnderlying(address) view returns (address)",
];
const POOL_ABI = [
    "function loanTokenAddress() view returns (address)",
    "function symbol() view returns (string)",
];
const TOKEN_ABI = ["function symbol() view returns (string)"];

const WALLET_ABI = [
    "function isOwner(address) view returns (bool)",
    "function transactionCount() view returns (uint256)",
    "function transactions(uint256) view returns (address destination, uint256 value, bytes data, bool executed)",
];

const walletInterface = new ethers.utils.Interface([
    "function submitTransaction(address destination, uint256 value, bytes data) returns (uint256 transactionId)",
]);

/** A display symbol, or undefined when the contract does not answer for one.
 *  Only ever used to label a line; nothing is built from it. */
const readSymbol = async (hre, address, abi, at) => {
    try {
        const symbol = await (await hre.ethers.getContractAt(abi, address)).symbol(at);
        return typeof symbol === "string" && symbol !== "" ? symbol : undefined;
    } catch (error) {
        return undefined;
    }
};

/**
 * Every pool the protocol lists, each with the asset its withdrawals escrow.
 *
 * The queue records a request's asset from the pool itself (`loanTokenAddress`)
 * and a route matches on exactly that, so the pool's own answer is what the
 * route is built from. The protocol keeps its own record of the same asset; a
 * pool the two disagree on is refused, because a route built from either would
 * register cleanly and then refuse every refund it was meant for.
 *
 * Every read is made with the call overrides `at` (`{ blockTag }`), so the list
 * and each pool's answers describe the same state; omitted, they are read at the
 * head. A pool listed twice is refused. Sorted by
 * address so two operators reading the same block produce the same plan: the
 * protocol's own list order moves when a pool is removed.
 */
const readLendingPools = async (hre, protocolAddress, at = {}) => {
    const { ethers: hreEthers } = hre;
    const protocol = await hreEthers.getContractAt(PROTOCOL_ABI, protocolAddress);

    const listed = [];
    for (let start = 0; ; start += POOL_PAGE) {
        const page = await protocol.getLoanPoolsList(start, POOL_PAGE, at);
        for (const word of page) {
            const pool = hreEthers.utils.getAddress(hreEthers.utils.hexDataSlice(word, 12));
            if (listed.includes(pool)) {
                throw new Error(`${TASK}: the protocol lists the pool ${pool} twice`);
            }
            listed.push(pool);
        }
        if (page.length < POOL_PAGE) break;
    }
    if (listed.length === 0) {
        throw new Error(`${TASK}: the protocol at ${protocolAddress} lists no lending pool`);
    }

    const pools = [];
    for (const pool of listed) {
        let asset;
        try {
            asset = hreEthers.utils.getAddress(
                await (await hreEthers.getContractAt(POOL_ABI, pool)).loanTokenAddress(at)
            );
        } catch (error) {
            throw new Error(
                `${TASK}: the pool ${pool} does not answer loanTokenAddress(), so the asset its ` +
                    "withdrawals escrow cannot be read and no route can be built for it"
            );
        }
        const recorded = hreEthers.utils.getAddress(await protocol.loanPoolToUnderlying(pool, at));
        if (recorded !== asset) {
            throw new Error(
                `${TASK}: the pool ${pool} escrows ${asset} but the protocol records ${recorded} ` +
                    "as its asset — a route built from either would never match a withdrawal"
            );
        }
        pools.push({
            pool,
            asset,
            symbol: await readSymbol(hre, pool, POOL_ABI, at),
            assetSymbol: await readSymbol(hre, asset, TOKEN_ABI, at),
        });
    }
    return pools.sort((a, b) => (a.pool.toLowerCase() < b.pool.toLowerCase() ? -1 : 1));
};

const routeLine = (route) =>
    `route ${route.routeId} (${route.topUpPool ? "top-up" : "address mode"}, ` +
    `destination ${route.destination})`;

const poolPhrase = (entry) => `${entry.symbol ? `${entry.symbol} ` : ""}pool ${entry.pool}`;
const assetPhrase = (entry) => `asset ${entry.assetSymbol || entry.asset}`;

/** One multisig transaction: the queue call, the wallet call that carries it,
 *  and the sentence read back from the calldata itself — never from the
 *  arguments the call was built from — so the line can only say what the bytes
 *  say. */
const transactionFor = (built, queueAddress, extra) => {
    const decoded = recovery.decodeRecoveryCall(built.data);
    if (!decoded || decoded.signature !== built.signature) {
        throw new Error(
            `${TASK}: the ${built.signature} calldata built here does not decode back to itself`
        );
    }
    return {
        kind: built.signature.split("(")[0],
        ...extra,
        signature: built.signature,
        destination: queueAddress,
        value: "0",
        calldata: built.data,
        submitTransaction: walletInterface.encodeFunctionData("submitTransaction", [
            queueAddress,
            0,
            built.data,
        ]),
        decoded: decoded.meaning,
    };
};

/**
 * Read the queue and the protocol and build the calls to submit: one call that
 * allows refund-to-pool routes on lender withdrawals (left out when they already
 * are allowed), then one route registration per pool, in pool address order.
 *
 * A pool whose only active route is a top-up route is left out and listed. So
 * is a pool with any OTHER active route on the same surface, pool and asset,
 * whether or not it also has a top-up route: a second matching route makes
 * `perimeter:refund --to pool` refuse to choose between them, so it is reported
 * as a conflict and left for the operator to remove first.
 *
 * Every read is made at one block, `blockNumber` or, when it is not given, the
 * head at the start; the plan records that block.
 */
const prepareLendingRoutes = async (
    hre,
    { queueAddress, live, protocolAddress, multisigAddress, blockNumber }
) => {
    const blockTag =
        blockNumber !== undefined ? blockNumber : await hre.ethers.provider.getBlockNumber();
    const at = { blockTag };
    const pools = await readLendingPools(hre, protocolAddress, at);
    const feasibleNow = await recoveryTasks.readTopUpFeasible(live, LENDER, at);
    const wrbtc = await recoveryTasks.readWrbtc(live, at);

    const transactions = [];
    const skipped = [];

    if (!feasibleNow) {
        transactions.push(
            transactionFor(
                recovery.buildRecoveryCall("setTopUpFeasible", {
                    surfaceId: LENDER,
                    feasible: true,
                }),
                queueAddress,
                { label: "refund-to-pool on lender withdrawals" }
            )
        );
    }

    for (const entry of pools) {
        const matching = await recoveryTasks.activeRoutesFor(
            live,
            LENDER,
            entry.pool,
            entry.asset,
            at
        );
        const topUp = matching.find((route) => route.topUpPool);
        const others = matching.filter((route) => !topUp || route.routeId !== topUp.routeId);
        if (topUp && others.length === 0) {
            skipped.push({
                ...entry,
                reason: "topUpRouteActive",
                routeIds: [topUp.routeId],
                detail: `${poolPhrase(entry)} already has an active top-up route ${topUp.routeId}`,
            });
            continue;
        }
        if (others.length > 0) {
            skipped.push({
                ...entry,
                reason: "otherRouteActive",
                routeIds: matching.map((route) => route.routeId),
                topUpRouteId: topUp ? topUp.routeId : undefined,
                detail:
                    `${poolPhrase(entry)} ` +
                    (topUp
                        ? `has its active top-up route ${topUp.routeId} and another active route`
                        : "has another active route") +
                    " on the same surface, pool and asset — " +
                    (topUp ? "" : "once a top-up route is added, ") +
                    "`perimeter:refund --to pool` will refuse to choose between them. " +
                    `Remove ${topUp ? "the other route" : "it"} with \`perimeter:route:remove\` ` +
                    "and run this task again:\n    " +
                    others.map(routeLine).join("\n    "),
            });
            continue;
        }

        let destination;
        try {
            destination = recovery.requireRouteDestination({
                destination: entry.pool,
                token: entry.asset,
                subProduct: entry.pool,
                topUpPool: true,
                queue: queueAddress,
                wrbtc,
                surfaceId: LENDER,
                // The feasibility call is part of these calls, or the surface
                // already allows it, so the route is met with it allowed.
                topUpFeasible: true,
            });
        } catch (error) {
            throw new Error(`${TASK}: ${poolPhrase(entry)}: ${error.message}`);
        }
        transactions.push(
            transactionFor(
                recovery.buildRecoveryCall("setRecoveryRoute", {
                    active: true,
                    surfaceId: LENDER,
                    subProduct: entry.pool,
                    token: entry.asset,
                    destination,
                    topUpPool: true,
                }),
                queueAddress,
                {
                    label: `${poolPhrase(entry)}, ${assetPhrase(entry)}`,
                    pool: entry.pool,
                    asset: entry.asset,
                    routeId: recovery.routeIdOf(LENDER, entry.pool, entry.asset, destination),
                }
            )
        );
    }

    transactions.forEach((tx, i) => {
        tx.index = i + 1;
    });

    return {
        network: hre.network.name,
        chainId: (await hre.ethers.provider.getNetwork()).chainId,
        readAtBlock: blockTag,
        queue: queueAddress,
        multisig: multisigAddress,
        protocol: protocolAddress,
        surface: {
            name: "PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW",
            id: LENDER,
            phrase: policy.surfaceLabel(LENDER),
        },
        refundToPoolAllowed: feasibleNow,
        poolsListed: pools.length,
        plannedCount: transactions.length,
        transactions,
        skipped,
    };
};

/** The result of `read()`, tried again after a pause when it throws, and the
 *  last error once every try has failed. */
const withRetries = async (read) => {
    for (let attempt = 1; ; attempt++) {
        try {
            return await read();
        } catch (error) {
            if (attempt >= WALLET_READ_ATTEMPTS) throw error;
            await new Promise((resolve) =>
                setTimeout(resolve, WALLET_READ_RETRY_MS * 2 ** (attempt - 1))
            );
        }
    }
};

/**
 * Every transaction the multisig holds that has not executed, with its
 * destination, value and data, read at the block `at`, in ascending id order.
 *
 * Every transaction the wallet has ever stored is read by its id, a batch of
 * ids at a time, and the ones not executed are kept. Each read costs the same
 * however long the wallet's history is, so the answer covers all of it and the
 * count of past transactions bounds only how many reads are made; a read that
 * fails is tried again before the whole read is given up. The wallet's
 * own filtered views (`getTransactionCount`, `getTransactionIds`) are not used:
 * each of them loops over the whole history inside one call, so the gas one call
 * needs grows with every transaction the wallet stores.
 */
const readPendingCalls = async (hre, multisigAddress, at = {}) => {
    const wallet = await hre.ethers.getContractAt(WALLET_ABI, multisigAddress);
    const total = (await withRetries(() => wallet.transactionCount(at))).toNumber();
    logger.info(`Reading the ${total} transactions of the multisig to find those still waiting`);
    const held = [];
    for (let end = total; end > 0; end -= WALLET_READ_BATCH) {
        const ids = [];
        for (let id = Math.max(0, end - WALLET_READ_BATCH); id < end; id++) ids.push(id);
        const read = await Promise.all(
            ids.map((id) => withRetries(() => wallet.transactions(id, at)))
        );
        read.forEach((tx, i) => {
            if (tx.destination === hre.ethers.constants.AddressZero) {
                throw new Error(
                    `the wallet counts ${total} transactions and holds none at ${ids[i]}`
                );
            }
            if (tx.executed) return;
            held.push({
                id: String(ids[i]),
                destination: hre.ethers.utils.getAddress(tx.destination),
                value: tx.value,
                data: tx.data.toLowerCase(),
            });
        });
    }
    return held.sort((a, b) => Number(a.id) - Number(b.id));
};

/** Whether a waiting multisig transaction is the very call `tx` would submit:
 *  same destination, no value, same data. */
const isSameCall = (waiting, tx) =>
    waiting.destination === ethers.utils.getAddress(tx.destination) &&
    waiting.value.isZero() &&
    waiting.data === tx.calldata.toLowerCase();

/** Move every planned call that is already waiting in the multisig from
 *  `plan.transactions` to `plan.skipped`, each one naming the multisig
 *  transaction that holds it. When the waiting list cannot be read, a run that
 *  sends refuses; any other run says the plan does not account for it. */
const leaveOutWaiting = async (hre, plan, { multisigAddress, sends, at }) => {
    let pending;
    try {
        pending = await readPendingCalls(hre, multisigAddress, at);
    } catch (error) {
        const said = `${TASK}: the multisig's pending transactions could not be read (${error.message})`;
        if (!sends) {
            logger.warn(`${said} — the plan below does not say which calls are already waiting`);
            return;
        }
        const refusal = new Error(
            `${said}. Nothing was sent: without knowing which calls are already waiting, a call ` +
                "could be submitted twice. Run with --dry-run to see the plan without this check."
        );
        refusal.cause = error;
        throw refusal;
    }

    const toSend = [];
    for (const tx of plan.transactions) {
        const ids = pending
            .filter((waiting) => isSameCall(waiting, tx))
            .map((waiting) => waiting.id);
        if (ids.length === 0) {
            toSend.push(tx);
            continue;
        }
        plan.skipped.push({
            reason: "alreadyWaiting",
            index: tx.index,
            kind: tx.kind,
            label: tx.label,
            pool: tx.pool,
            asset: tx.asset,
            routeId: tx.routeId,
            decoded: tx.decoded,
            multisigTransactionIds: ids,
            detail:
                `${tx.label} — already waiting for confirmations as multisig ` +
                `transaction${ids.length === 1 ? "" : "s"} ${ids.join(", ")}`,
        });
    }
    plan.transactions = toSend;
};

const row = (label, value) => `  ${`${label}:`.padEnd(20)}${value}`;

const presentHeader = async (
    hre,
    { queueAddress, protocolAddress, multisigAddress, signerAddress }
) => {
    const { chainId } = await hre.ethers.provider.getNetwork();
    logger.info(`Network:    ${hre.network.name} (chain id ${chainId})`);
    logger.info(`Queue:      ${queueAddress}`);
    logger.info(`Protocol:   ${protocolAddress}`);
    logger.info(`Multisig:   ${multisigAddress}`);
    logger.info(`Signer:     ${signerAddress}`);
};

const presentPlan = (plan) => {
    const waiting = plan.skipped.filter((skip) => skip.reason === "alreadyWaiting");
    logger.info(
        `Pools:      ${plan.poolsListed} listed by the protocol, ` +
            `${plan.transactions.filter((tx) => tx.pool).length} routes to register, ` +
            `${plan.skipped.length} left out`
    );
    if (plan.refundToPoolAllowed) {
        logger.info(
            `Refund-to-pool is already allowed on ${plan.surface.phrase} — no feasibility ` +
                "call is needed."
        );
    }
    for (const skip of plan.skipped) {
        logger.warn(`Left out: ${skip.detail}`);
    }
    const conflicts = plan.skipped.filter((skip) => skip.reason === "otherRouteActive");
    const conflictSummary =
        `${conflicts.length} ${conflicts.length === 1 ? "pool has" : "pools have"} conflicting ` +
        "active routes (listed above), and `perimeter:refund --to pool` refuses for " +
        `${conflicts.length === 1 ? "it" : "them"} until the other ` +
        `${conflicts.length === 1 ? "route is" : "routes are"} removed`;
    if (plan.transactions.length === 0) {
        if (waiting.length > 0) {
            logger.info(
                "nothing to submit: every call this task would send is already waiting in the multisig"
            );
        } else if (conflicts.length === 0) {
            logger.info("nothing to submit: every pool has its route and the surface allows it");
        }
        if (conflicts.length > 0) {
            logger.warn(
                waiting.length > 0
                    ? conflictSummary
                    : `nothing to register, but ${conflictSummary}`
            );
        }
        return;
    }
    for (const tx of plan.transactions) {
        logger.info(`Transaction ${tx.index} of ${plan.plannedCount} — ${tx.label}`);
        logger.info(row("destination", tx.destination));
        logger.info(row("calldata", tx.calldata));
        logger.info(row("submitTransaction", tx.submitTransaction));
        logger.info(row("decoded", tx.decoded));
    }
    if (conflicts.length > 0) logger.warn(conflictSummary);
};

/** Say which calls were submitted before a submission failed and which were
 *  not. The call that failed may have reached the multisig before the failure
 *  was seen, and a later run finds it there if it did. */
const presentStopped = (plan, submitted, failed) => {
    const notSubmitted = plan.transactions.filter((tx) => tx.index >= failed.index);
    logger.warn(
        `Stopped: submitting transaction ${failed.index} of ${plan.plannedCount} failed, and ` +
            "nothing after it was sent."
    );
    if (submitted.length === 0) {
        logger.warn("Submitted before the failure: none");
    } else {
        logger.warn("Submitted before the failure:");
        for (const sent of submitted) {
            logger.warn(
                `  transaction ${sent.index} of ${plan.plannedCount}: multisig transaction ` +
                    `${sent.multisigTransactionId} — ${sent.decoded}`
            );
        }
    }
    logger.warn("Not submitted:");
    for (const tx of notSubmitted) {
        logger.warn(
            `  transaction ${tx.index} of ${plan.plannedCount} — ${tx.decoded}` +
                (tx.index === failed.index
                    ? " (this submission failed; if it reached the multisig, a later run finds it there)"
                    : "")
        );
    }
    logger.warn(
        "Running this task again skips the submitted calls: it finds them waiting in the multisig."
    );
};

/** Submit the calls through the multisig, one after another in the plan's own
 *  order, each read back against the queue. The first submission that throws
 *  stops the run, says what was and was not submitted, and rethrows. */
const submitLendingRoutes = async (
    hre,
    plan,
    { multisigAddress, queueAddress, signerAcc, queue }
) => {
    const submitted = [];
    for (const tx of plan.transactions) {
        logger.info(`Submitting transaction ${tx.index} of ${plan.plannedCount}`);
        try {
            const txId = await recoveryTasks.submitQueueCall(hre, {
                multisigAddress,
                queueAddress,
                signerAcc,
                built: { data: tx.calldata, signature: tx.signature, meaning: tx.decoded },
                queue,
            });
            submitted.push({
                index: tx.index,
                kind: tx.kind,
                decoded: tx.decoded,
                multisigTransactionId: txId.toString(),
            });
        } catch (error) {
            presentStopped(plan, submitted, tx);
            throw error;
        }
    }
    return submitted;
};

/** What the co-signers do with the allow transaction and the route
 *  transactions that follow it, and how a transaction is read back. `allow` says
 *  which transaction the allow call is, or is left out when the plan has none. */
const presentConfirmerNotes = (allow) => {
    if (allow) {
        logger.warn(
            `The route transactions revert until the allow transaction (${allow}) has EXECUTED — ` +
                "co-signers confirm it first and check it executed before confirming the rest."
        );
        logger.warn(
            "A route transaction confirmed too early records an execution failure in the multisig " +
                "instead of running: it stays not executed with its confirmations kept, and an " +
                "owner who confirmed it can run it again with `executeTransaction` once the allow " +
                "transaction has executed."
        );
    }
    logger.info(
        "A transaction still waiting on confirmations reads back with " +
            "`perimeter:check-block --id <id>`, and the whole route list with " +
            "`perimeter:route:show` — a multisig receipt does not say the inner call ran."
    );
};

/** Every call of the plan that is now in the multisig — submitted by this run or
 *  already waiting — in the order to confirm it, each beside its multisig
 *  transaction id and its plain-English line, and what the co-signers do with
 *  them. */
const presentConfirmOrder = (plan, submitted) => {
    const rows = [
        ...submitted.map((sent) => ({
            index: sent.index,
            kind: sent.kind,
            decoded: sent.decoded,
            ids: [sent.multisigTransactionId],
            waiting: false,
        })),
        ...plan.skipped
            .filter((skip) => skip.reason === "alreadyWaiting")
            .map((skip) => ({
                index: skip.index,
                kind: skip.kind,
                decoded: skip.decoded,
                ids: skip.multisigTransactionIds,
                waiting: true,
            })),
    ].sort((a, b) => a.index - b.index);
    if (rows.length === 0) return;

    logger.info("Multisig transactions, in the order to confirm them:");
    for (const entry of rows) {
        logger.info(
            `  multisig transaction ${entry.ids.join(", ")}${entry.waiting ? " (already waiting)" : ""}` +
                ` — ${entry.decoded}`
        );
    }
    const allow = rows.find((entry) => entry.kind === "setTopUpFeasible");
    presentConfirmerNotes(allow ? `multisig transaction ${allow.ids[0]}` : undefined);
};

/** The transaction an owner account sends to the multisig to submit one call:
 *  `submitTransaction(queue, 0, calldata)`, with the chain it is for and the
 *  sentence the calldata says. */
const rawTransactionFor = (plan, tx) => ({
    description: tx.decoded,
    chainId: plan.chainId,
    to: plan.multisig,
    value: "0",
    data: tx.submitTransaction,
});

/** Why nothing was sent and who sends the printed transactions. */
const rawStatement = (ownership, { signerAddress, multisigAddress }) => {
    if (ownership.owns === false) {
        return (
            `the signer ${signerAddress} is not an owner of the multisig ${multisigAddress} — ` +
            "nothing was sent; send each transaction below from an owner account, in order"
        );
    }
    if (ownership.owns === undefined) {
        return (
            `whether the signer ${signerAddress} is an owner of the multisig ${multisigAddress} ` +
            `could not be read (${ownership.unreadable}) — nothing was sent; send each ` +
            "transaction below from an owner account, in order"
        );
    }
    return (
        "--raw-tx: nothing was sent; send each transaction below from an owner account of the " +
        `multisig ${multisigAddress}, in order`
    );
};

/** Print, for every call still to be sent, the raw transaction an owner account
 *  sends to the multisig, one JSON object per line in the order to send them. */
const presentRawTransactions = (plan, statement) => {
    logger.warn(statement);
    plan.rawTransactions = [];
    if (plan.transactions.length === 0) {
        logger.info("no transaction to send");
        return;
    }
    plan.rawTransactions = plan.transactions.map((tx) => rawTransactionFor(plan, tx));
    plan.transactions.forEach((tx, i) => {
        logger.info(`Raw transaction ${tx.index} of ${plan.plannedCount} — ${tx.label}`);
        console.log(JSON.stringify(plan.rawTransactions[i]));
    });
    const waitingAllow = plan.skipped.find(
        (skip) => skip.reason === "alreadyWaiting" && skip.kind === "setTopUpFeasible"
    );
    const allowPlanned = plan.transactions.some((tx) => tx.kind === "setTopUpFeasible");
    let allow;
    if (allowPlanned) allow = "the first transaction above";
    else if (waitingAllow)
        allow = `multisig transaction ${waitingAllow.multisigTransactionIds[0]}`;
    presentConfirmerNotes(allow);
};

const resolveProtocolAddress = async (hre, protocolParam) => {
    const {
        ethers: hreEthers,
        deployments: { getOrNull },
    } = hre;
    const address = await resolveOptionalAddress(hreEthers, protocolParam, async () => {
        const record = await getOrNull("ISovryn");
        if (!record) {
            throw new Error(
                `${TASK}: no ISovryn deployment record on this network — pass --protocol`
            );
        }
        return record.address;
    });
    if ((await hreEthers.provider.getCode(address)) === "0x") {
        throw new Error(`${TASK}: no contract code at the protocol ${address}`);
    }
    return address;
};

const resolveSignerAddress = async (hre, signerParam) => {
    const address = await recoveryTasks.resolveSigner(hre, signerParam);
    if (!address || !hre.ethers.utils.isAddress(address)) {
        throw new Error(
            `${TASK}: --signer '${signerParam}' is neither an address nor a named account on ` +
                `network '${hre.network.name}'`
        );
    }
    return hre.ethers.utils.getAddress(address);
};

/** Whether the signer is an owner of the multisig: `owns` is true or false, or
 *  undefined with the reason when the wallet does not answer. */
const readSignerOwnership = async (hre, { multisigAddress, signerAddress, at }) => {
    try {
        const wallet = await hre.ethers.getContractAt(WALLET_ABI, multisigAddress);
        return { owns: Boolean(await wallet.isOwner(signerAddress, at)) };
    } catch (error) {
        return { owns: undefined, unreadable: error.message };
    }
};

const presentOwnership = (ownership, { signerAddress, multisigAddress, dryRun }) => {
    if (ownership.owns === true) {
        logger.info(`Signer is an owner of the multisig ${multisigAddress}`);
        return;
    }
    const instead = dryRun
        ? " — a run without --dry-run sends nothing and prints the transactions to send from an " +
          "owner account instead"
        : "";
    if (ownership.owns === false) {
        logger.warn(
            `the signer ${signerAddress} is not an owner of the multisig ${multisigAddress}${instead}`
        );
        return;
    }
    logger.warn(
        `whether the signer ${signerAddress} is an owner of the multisig ${multisigAddress} could ` +
            `not be read (${ownership.unreadable})${instead}`
    );
};

const runLendingRoutes = async ({ queue, protocol, multisig, signer, dryRun, rawTx }, hre) => {
    const { address: queueAddress, queue: live } = await recoveryTasks.resolveQueue(
        hre,
        TASK,
        queue
    );
    const protocolAddress = await resolveProtocolAddress(hre, protocol);
    const multisigAddress = await recoveryTasks.resolveMultisigAddress(hre, multisig);
    const signerAddress = await resolveSignerAddress(hre, signer);

    await presentHeader(hre, { queueAddress, protocolAddress, multisigAddress, signerAddress });
    // setTopUpFeasible and setRecoveryRoute are Owner-only on the queue.
    await recoveryTasks.requireQueueRole(hre, live, TASK, multisigAddress, false);

    const blockNumber = await hre.ethers.provider.getBlockNumber();
    const at = { blockTag: blockNumber };
    const ownership = await readSignerOwnership(hre, { multisigAddress, signerAddress, at });
    presentOwnership(ownership, { signerAddress, multisigAddress, dryRun });
    // Only an owner submits, and only when it was not asked to print instead.
    const sends = !dryRun && !rawTx && ownership.owns === true;

    const plan = await prepareLendingRoutes(hre, {
        queueAddress,
        live,
        protocolAddress,
        multisigAddress,
        blockNumber,
    });
    plan.signer = signerAddress;
    await leaveOutWaiting(hre, plan, { multisigAddress, sends, at });
    presentPlan(plan);

    if (!sends) {
        if (rawTx || !dryRun) {
            presentRawTransactions(
                plan,
                rawStatement(ownership, { signerAddress, multisigAddress })
            );
        }
        if (dryRun) logger.info("dry run: nothing was submitted");
        return plan;
    }

    plan.submitted = [];
    if (plan.transactions.length > 0) {
        // On a forked network this impersonates an address that is not a local account.
        const signerAccount = await getSignerFromAccount(hre, signer);
        if (hre.ethers.utils.getAddress(await signerAccount.getAddress()) !== signerAddress) {
            throw new Error(
                `${TASK}: the signer resolved to ${await signerAccount.getAddress()}, not ` +
                    `${signerAddress}. Nothing was sent.`
            );
        }
        plan.submitted = await submitLendingRoutes(hre, plan, {
            multisigAddress,
            queueAddress,
            signerAcc: signerAddress,
            queue: live,
        });
    }
    presentConfirmOrder(plan, plan.submitted);
    return plan;
};

task(
    TASK,
    "Submit the Exchequer multisig transactions that allow refund-to-pool routes on lender " +
        "withdrawals and register one refund-to-pool route for every lending pool"
)
    .addOptionalParam("queue", "ExitDelayQueue address (defaults to the deployment record)")
    .addOptionalParam("protocol", "Protocol address that lists the pools (defaults to ISovryn)")
    .addOptionalParam("multisig", "Multisig address (defaults to the MultiSigWallet deployment)")
    .addOptionalParam(
        "signer",
        "Signer name ('signer' or 'deployer') or an address; a signer that owns the multisig submits " +
            "the transactions itself",
        "deployer"
    )
    .addFlag("dryRun", "Print the plan without submitting anything")
    .addFlag(
        "rawTx",
        "Send nothing: print, for every call, the raw transaction an owner account sends to " +
            "the multisig to submit it. Also what a signer that does not own the multisig gets"
    )
    .setAction(runLendingRoutes);

module.exports = {
    runLendingRoutes,
    prepareLendingRoutes,
    readLendingPools,
    readPendingCalls,
};
