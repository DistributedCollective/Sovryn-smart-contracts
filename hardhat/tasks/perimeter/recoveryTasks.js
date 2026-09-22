/* eslint-disable no-console */
const { task, types } = require("hardhat/config");
const Logs = require("node-logs");
const { sendWithMultisigReturningId } = require("../../../deployment/helpers/helpers");
const policy = require("./policy");
const recovery = require("./recovery");
const { resolveOptionalAddress } = require("./addressParam");

const logger = new Logs().showInConsole(true);

/** The reads every recovery task makes on the queue. */
const QUEUE_ABI = [
    "function admin() view returns (address)",
    "function owner() view returns (address)",
    "function wrbtc() view returns (address)",
    "function topUpFeasible(bytes32) view returns (bool)",
    "function recoveryRouteIds() view returns (bytes32[])",
    "function getRecoveryRoute(bytes32) view returns (tuple(bool active, bytes32 surfaceId, address subProduct, address token, address destination, bool topUpPool))",
    "function getRequest(uint256) view returns (tuple(uint128 amount, uint64 createdAt, uint64 unlockAt, address originator, address owner, address receiver, address token, bytes32 surfaceId, address subProduct, uint8 status, bool unwrapOnDelivery))",
    "function getActive(address party, uint256 cursor, uint256 n) view returns (uint256[] ids, uint256 nextCursor)",
    "function blockStateOf(address) view returns (uint8)",
    "function securityPerimeterPaused() view returns (bool)",
];

/** The queue clamps a page of its own active index to this many ids. */
const ACTIVE_PAGE = 500;

/**
 * The ExitDelayQueue's own address, independently derived from a saved
 * deployment record or the live protocol's own pointer — never from whatever
 * `--queue` says. Null, not a throw, when neither source resolves: a network
 * this cannot independently resolve a queue on must not lose the ability to
 * operate one.
 */
const knownQueueAddress = async (hre) => {
    const {
        deployments: { getOrNull },
        ethers: hreEthers,
    } = hre;
    const record = await getOrNull("ExitDelayQueue");
    if (record) return hreEthers.utils.getAddress(record.address);
    const protocolRecord = await getOrNull("ISovryn");
    if (!protocolRecord) return null;
    try {
        const protocol = await hreEthers.getContractAt(
            ["function exitDelayQueue() view returns (address)"],
            protocolRecord.address
        );
        const pointer = await protocol.exitDelayQueue();
        return pointer === hreEthers.constants.AddressZero
            ? null
            : hreEthers.utils.getAddress(pointer);
    } catch (error) {
        return null;
    }
};

/**
 * Resolve `--queue`, refuse an address with no code, and confirm it against
 * the independently-derived queue — the same three outcomes
 * `perimeter:submit-block` reports, said out loud every time: not verified
 * (warn and proceed), verified (a distinct line), or mismatched (refuse).
 */
const resolveQueue = async (hre, taskLabel, queueParam) => {
    const {
        ethers: hreEthers,
        deployments: { getOrNull },
    } = hre;
    const address = await resolveOptionalAddress(hreEthers, queueParam, async () => {
        const record = await getOrNull("ExitDelayQueue");
        if (record) return record.address;
        const derived = await knownQueueAddress(hre);
        if (!derived) {
            throw new Error(
                `${taskLabel}: no ExitDelayQueue deployment record and no protocol pointer on ` +
                    "this network — pass --queue"
            );
        }
        return derived;
    });
    if ((await hreEthers.provider.getCode(address)) === "0x") {
        throw new Error(`${taskLabel}: no contract code at the queue ${address}`);
    }
    const known = await knownQueueAddress(hre);
    if (!known) {
        logger.warn(
            `${taskLabel}: the queue address ${address} could NOT be verified independently ` +
                "(no deployment record and no protocol pointer on this network) — confirm it by " +
                "hand before confirming this transaction"
        );
    } else if (hreEthers.utils.getAddress(address) !== known) {
        throw new Error(
            `${taskLabel}: ${address} does not match the known ExitDelayQueue (${known}) — ` +
                "refusing to treat an address that is not the deployed queue as safe"
        );
    } else if (queueParam === undefined) {
        // Nothing was compared: the address came from the deployment record,
        // and the check re-derived it from that same record. Saying "matches"
        // here would report a value agreeing with itself as a verification.
        logger.info(`${taskLabel}: using the deployed ExitDelayQueue ${address}`);
    } else {
        logger.info(`${taskLabel}: ${address} matches the deployed ExitDelayQueue`);
    }
    const queue = await hreEthers.getContractAt(QUEUE_ABI, address);
    return { address: hreEthers.utils.getAddress(address), queue };
};

/** The queue's own reads at an address a caller has already verified — for a
 *  task that resolved the queue by some other route than `--queue` and still
 *  has to read state off it. */
const queueAt = async (hre, address) => hre.ethers.getContractAt(QUEUE_ABI, address);

/** The queue's WRBTC address, or undefined when the read did not answer — the
 *  destination guard then skips its WRBTC arm rather than passing it on a
 *  value it does not have. The queue enforces it on chain regardless. */
const readWrbtc = async (queue) => {
    try {
        return await queue.wrbtc();
    } catch (error) {
        logger.warn(
            "the queue's own WRBTC address could not be read, so this task cannot check the " +
                "destination against it — the queue still refuses a WRBTC destination on chain"
        );
        return undefined;
    }
};

/** Whether a surface's refund-to-pool feasibility flag is currently set, or
 *  `false` when the read did not answer. Every caller only consults this
 *  under `topUpPool`, where an unreadable flag must never be treated as
 *  "already feasible" — that would suppress the `--set-feasible` step and
 *  risk a genuine on-chain `TopUpInfeasibleSurface` revert the task could
 *  have avoided. */
const readTopUpFeasible = async (queue, surfaceId) => {
    try {
        return await queue.topUpFeasible(surfaceId);
    } catch (error) {
        logger.warn(
            "the queue's own top-up feasibility flag could not be read for this surface — " +
                "treating it as not yet feasible rather than silently risking a " +
                "TopUpInfeasibleSurface revert"
        );
        return false;
    }
};

/** Who the queue says holds one of its two roles, or undefined when the read
 *  did not answer. */
const readRoleHolder = async (queue, role) => {
    try {
        return await queue[role]();
    } catch (error) {
        return undefined;
    }
};

/**
 * Refuse a lever the configured multisig may not pull, and say which role it
 * needs either way.
 *
 * `resolveToProtocol` is Admin or Owner; every other recovery lever is
 * Owner-only. Left unchecked, a wallet holding the wrong role spends a full
 * round of confirmations on a transaction that was always going to revert, and
 * nothing anyone read beforehand mentioned a role at all. A read that does not
 * answer warns rather than refuses — incomplete information is not grounds to
 * block an incident action the queue itself would accept.
 */
const requireQueueRole = async (hre, live, taskLabel, multisigAddress, adminAccepted) => {
    const { getAddress } = hre.ethers.utils;
    const wallet = getAddress(multisigAddress);
    const owner = await readRoleHolder(live, "owner");
    const admin = adminAccepted ? await readRoleHolder(live, "admin") : undefined;
    const needs = adminAccepted ? "Admin or Owner" : "Owner";

    const holds = [];
    if (owner !== undefined && getAddress(owner) === wallet) holds.push("Owner");
    if (admin !== undefined && getAddress(admin) === wallet) holds.push("Admin");
    if (holds.length > 0) {
        logger.info(`Role:       needs ${needs}; ${wallet} holds ${holds.join(" and ")}`);
        return;
    }

    const unread = [];
    if (owner === undefined) unread.push("owner()");
    if (adminAccepted && admin === undefined) unread.push("admin()");
    if (unread.length > 0) {
        logger.warn(
            `${taskLabel}: this call needs ${needs} on the queue, and the queue's ` +
                `${unread.join(" and ")} could not be read — confirm by hand that ${wallet} ` +
                "holds it; the queue enforces the role on chain regardless"
        );
        return;
    }

    const held = adminAccepted
        ? `Owner is ${getAddress(owner)} and Admin is ${getAddress(admin)}`
        : `Owner is ${getAddress(owner)}`;
    throw new Error(
        `${taskLabel}: this call needs ${needs} on the queue and ${wallet} is neither — ` +
            `${held}. It would revert ` +
            `${adminAccepted ? "NotAdminOrOwner" : "OwnableUnauthorizedAccount"} after a full ` +
            "round of confirmations."
    );
};

const resolveMultisigAddress = async (hre, multisigParam) => {
    const {
        ethers: hreEthers,
        deployments: { get },
    } = hre;
    return resolveOptionalAddress(
        hreEthers,
        multisigParam,
        async () => (await get("MultiSigWallet")).address
    );
};

const resolveSigner = async (hre, signerParam) => {
    const { ethers: hreEthers } = hre;
    return hreEthers.utils.isAddress(signerParam)
        ? signerParam
        : (await hre.getNamedAccounts())[signerParam];
};

/** Every argument of the call, decoded, plus what it does in plain words —
 *  the same shape the policy tasks print, so one operator reads one format. */
const presentQueueCall = (queueAddress, built, note) => {
    const decoded = recovery.decodeRecoveryCall(built.data);
    logger.info(`  target:    ${queueAddress}`);
    logger.info(`  signature: ${built.signature}`);
    if (decoded) {
        for (const field of decoded.fields) {
            logger.info(`  ${field.name} (${field.type}): ${field.value}`);
        }
    }
    logger.info(`  meaning:   ${built.meaning}${note ? ` — ${note}` : ""}`);
    logger.info(`  calldata:  ${built.data}`);
};

/** Whether one party's active index still lists a request. Paginated the way
 *  the queue pages it, so a party holding more than one page of held
 *  withdrawals is read to the end rather than to its first 500. */
const activeListHolds = async (queue, party, id) => {
    let cursor = 0;
    for (;;) {
        const page = await queue.getActive(party, cursor, ACTIVE_PAGE);
        if (page.ids.some((held) => held.toString() === String(id))) return true;
        const next = Number(page.nextCursor);
        if (next === 0 || next <= cursor) return false;
        cursor = next;
    }
};

/**
 * Re-read the state a submitted recovery call was meant to establish. `true`
 * when it holds; otherwise a sentence saying what differs — including a read
 * that did not answer, which is not proof of anything and must never be
 * reported as if it were.
 */
const checkPostcondition = async (queue, postcondition) => {
    try {
        switch (postcondition.kind) {
            case "refundResolved": {
                for (const id of postcondition.ids) {
                    const request = await queue.getRequest(id);
                    const want = recovery.STATUS_BY_NAME[postcondition.status];
                    if (Number(request.status) !== want) {
                        return (
                            `withdrawal ${id} reads ` +
                            `${STATUS_NAMES[Number(request.status)]}, not ${postcondition.status}`
                        );
                    }
                    // The status alone does not say the queue finished with
                    // the request: a party still listing it as active would
                    // mean the index and the status disagree.
                    for (const party of [request.originator, request.owner, request.receiver]) {
                        if (await activeListHolds(queue, party, id)) {
                            return `withdrawal ${id} is still in ${party}'s active list`;
                        }
                    }
                }
                return true;
            }
            case "routeStored": {
                const route = await queue.getRecoveryRoute(postcondition.routeId);
                if (Boolean(route.active) !== postcondition.active) {
                    return `the route ${postcondition.routeId} reads active=${route.active}`;
                }
                // topUpPool is not part of the route id, so a route stored
                // under the right id can still carry the wrong leg.
                if (Boolean(route.topUpPool) !== postcondition.topUpPool) {
                    return (
                        `the route ${postcondition.routeId} reads ` +
                        `topUpPool=${route.topUpPool}, not ${postcondition.topUpPool}`
                    );
                }
                return true;
            }
            case "routeRemoved": {
                const route = await queue.getRecoveryRoute(postcondition.routeId);
                return route.active ? `the route ${postcondition.routeId} is still active` : true;
            }
            case "topUpFeasible": {
                const feasible = await queue.topUpFeasible(postcondition.surfaceId);
                return Boolean(feasible) === postcondition.feasible
                    ? true
                    : `${policy.surfaceLabel(postcondition.surfaceId)} reads feasible=${feasible}`;
            }
            default:
                return `no read is registered for a '${postcondition.kind}' postcondition`;
        }
    } catch (error) {
        return `a read this check depends on did not answer (${error.message})`;
    }
};

/**
 * Say whether an executed call left the queue where it meant to.
 *
 * "executed" is the wallet's own bookkeeping: the inner call ran without
 * reverting. "applied" is the queue's own state, read back. The two are printed
 * as different words on purpose — this is the difference between a refund that
 * worked and a multisig transaction that merely went through.
 */
const reportPostcondition = async (queue, data) => {
    const postcondition = recovery.postconditionFor(data);
    if (!postcondition) {
        logger.warn("  executed, not verified: this call leaves nothing this task can read back");
        return;
    }
    const held = await checkPostcondition(queue, postcondition);
    if (held === true) {
        logger.info(`  applied: ${recovery.describePostcondition(postcondition)}`);
    } else {
        logger.warn(`  executed, not verified: ${held}`);
    }
};

/** What the wallet did with a transaction the instant it was submitted, and,
 *  when it executed at once because the threshold was already met, what the
 *  queue now reads. A transaction still waiting on confirmations has nothing
 *  to verify yet, and is said to be pending rather than silently unreported. */
const reportSubmission = async (hre, { multisigAddress, txId, queue, data }) => {
    let executed;
    try {
        const wallet = await hre.ethers.getContractAt("MultiSigWallet", multisigAddress);
        executed = (await wallet.transactions(txId)).executed;
    } catch (error) {
        logger.warn(
            `  the wallet's own record of transaction ${txId} could not be read, so whether it ` +
                "executed is unknown here — check it with `perimeter:check-block --id " +
                `${txId}\``
        );
        return;
    }
    if (!executed) {
        logger.info(
            `  pending: transaction ${txId} needs its remaining confirmations. Read the result ` +
                `back with \`perimeter:check-block --id ${txId}\` once it has executed.`
        );
        return;
    }
    await reportPostcondition(queue, data);
};

const submitQueueCall = async (
    hre,
    { multisigAddress, queueAddress, signerAcc, built, queue }
) => {
    const txId = await sendWithMultisigReturningId(
        multisigAddress,
        queueAddress,
        built.data,
        signerAcc
    );
    logger.info(`  submitted as multisig transaction ${txId}`);
    if (queue) {
        await reportSubmission(hre, { multisigAddress, txId, queue, data: built.data });
    }
    return txId;
};

/** A request's provenance — the three fields a route must match exactly. */
const readProvenance = async (queue, requestId) => {
    const request = await queue.getRequest(requestId);
    if (Number(request.status) === 0) {
        throw new Error(`the queue holds no withdrawal ${requestId}`);
    }
    return {
        surfaceId: request.surfaceId,
        subProduct: request.subProduct,
        token: request.token,
    };
};

const ROUTE_ID = /^0x[0-9a-fA-F]{64}$/;

task("perimeter:route:show", "List the queue's registered recovery routes")
    .addOptionalParam("queue", "ExitDelayQueue address (defaults to the deployment record)")
    .setAction(async ({ queue }, hre) => {
        const { address, queue: live } = await resolveQueue(hre, "perimeter:route:show", queue);
        logger.info(`Queue:      ${address}`);

        // One surface whose flag does not answer must not cost the operator
        // the route table underneath, which is the part an incident needs.
        for (const [name, id] of Object.entries(policy.SURFACES)) {
            let feasible;
            try {
                feasible = await live.topUpFeasible(id);
            } catch (error) {
                logger.warn(`Top-up on ${name}: feasibility not read`);
                continue;
            }
            logger.info(`Top-up on ${name}: ${feasible ? "allowed" : "not allowed"}`);
        }

        const ids = await live.recoveryRouteIds();
        if (ids.length === 0) {
            logger.warn(
                "No recovery route is registered. `perimeter:refund --to pool` has nothing to " +
                    "walk until one is; `--to <address>` does not need one."
            );
            return;
        }
        for (const routeId of ids) {
            const route = await live.getRecoveryRoute(routeId);
            logger.info(`Route ${routeId}`);
            logger.info(`  active:      ${route.active}`);
            logger.info(`  surface:     ${policy.surfaceLabel(route.surfaceId)}`);
            logger.info(`  pool:        ${route.subProduct}`);
            logger.info(`  asset:       ${route.token}`);
            logger.info(`  destination: ${route.destination}`);
            logger.info(`  tops up the pool: ${route.topUpPool}`);
            // The id covers surface, pool, asset and destination only, so a
            // registered route whose id matches but whose topUpPool differs
            // from what an operator expects is a genuinely different route.
            const derived = recovery.routeIdOf(
                route.surfaceId,
                route.subProduct,
                route.token,
                route.destination
            );
            if (derived !== routeId) {
                logger.warn(
                    `  this route is stored under ${routeId} but its own fields hash to ` +
                        `${derived} — the queue's storage and this tool disagree, do not use it`
                );
            }
        }
    });

task(
    "perimeter:route:set",
    "Register a recovery route on the queue, through the Exchequer multisig"
)
    .addParam("surface", "Surface name, suffix, or id", undefined, types.string)
    .addParam("mode", "topup | address", undefined, types.string)
    .addParam("destination", "Where recovered escrow goes", undefined, types.string)
    .addOptionalParam("subproduct", "The pool the withdrawals came from")
    .addOptionalParam("token", "The asset the withdrawals escrowed; 0x0 for native RBTC")
    .addOptionalParam("fromRequest", "Read surface, pool and asset off this request id instead")
    .addFlag(
        "setFeasible",
        "Also submit setTopUpFeasible(surface, true) first, for a top-up route"
    )
    .addFlag("dryRun", "Print the plan without submitting anything")
    .addOptionalParam("queue", "ExitDelayQueue address (defaults to the deployment record)")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig address (defaults to the MultiSigWallet deployment)")
    .setAction(
        async (
            {
                surface,
                mode,
                destination,
                subproduct,
                token,
                fromRequest,
                setFeasible,
                dryRun,
                queue,
                signer,
                multisig,
            },
            hre
        ) => {
            const { ethers: hreEthers } = hre;
            if (mode !== "topup" && mode !== "address") {
                throw new Error(
                    `perimeter:route:set: --mode must be 'topup' or 'address', got '${mode}'`
                );
            }
            const topUpPool = mode === "topup";
            const { address: queueAddress, queue: live } = await resolveQueue(
                hre,
                "perimeter:route:set",
                queue
            );

            // Provenance comes from a real request when one is named, because
            // a route that does not match the requests it is meant to recover
            // is registered successfully and then reverts every refund.
            let provenance;
            if (fromRequest !== undefined) {
                provenance = await readProvenance(live, fromRequest);
                logger.info(
                    `Provenance read from withdrawal ${fromRequest}: surface ` +
                        `${policy.surfaceLabel(provenance.surfaceId)}, pool ${provenance.subProduct}, ` +
                        `asset ${provenance.token}`
                );
                const named = policy.resolveSurface(surface);
                if (named.id !== provenance.surfaceId) {
                    throw new Error(
                        `perimeter:route:set: --surface says ${named.name} but withdrawal ` +
                            `${fromRequest} is on ${policy.surfaceLabel(provenance.surfaceId)}`
                    );
                }
            } else {
                if (subproduct === undefined || token === undefined) {
                    throw new Error(
                        "perimeter:route:set: pass --subproduct and --token, or --from-request " +
                            "<id> to read both off a real withdrawal"
                    );
                }
                provenance = {
                    surfaceId: policy.resolveSurface(surface).id,
                    subProduct: recovery.parsePoolAddress(
                        subproduct,
                        "perimeter:route:set: --subproduct"
                    ),
                    token: recovery.parseAssetAddress(token, "perimeter:route:set: --token"),
                };
            }

            // Feasibility is only meaningful for a top-up route — an
            // address-mode route never reads or needs it, so this stays
            // unread rather than making a call this task has no use for. It
            // is read BEFORE the destination guard because the queue checks
            // it first among the top-up arms, and an operator tripping two of
            // them at once must read the same first reason here as on chain.
            const feasibleNow = topUpPool
                ? await readTopUpFeasible(live, provenance.surfaceId)
                : false;
            const wrbtc = await readWrbtc(live);
            const target = recovery.requireRouteDestination({
                destination,
                token: provenance.token,
                subProduct: provenance.subProduct,
                topUpPool,
                queue: queueAddress,
                wrbtc,
                surfaceId: provenance.surfaceId,
                // --set-feasible puts the flag in its own transaction ahead of
                // this one, so the route call will be met with a feasible
                // surface by the time it executes.
                topUpFeasible: feasibleNow || Boolean(setFeasible),
            });

            const routeId = recovery.routeIdOf(
                provenance.surfaceId,
                provenance.subProduct,
                provenance.token,
                target
            );

            const multisigAddress = await resolveMultisigAddress(hre, multisig);
            const signerAcc = await resolveSigner(hre, signer);
            logger.info(`Queue:      ${queueAddress}`);
            logger.info(`Multisig:   ${multisigAddress}`);
            logger.info(`Submitter:  ${signerAcc}`);
            logger.info(`Route id:   ${routeId}`);
            await requireQueueRole(hre, live, "perimeter:route:set", multisigAddress, false);

            const steps = [];
            if (topUpPool && setFeasible && !feasibleNow) {
                steps.push(
                    recovery.buildRecoveryCall("setTopUpFeasible", {
                        surfaceId: provenance.surfaceId,
                        feasible: true,
                    })
                );
            }
            steps.push(
                recovery.buildRecoveryCall("setRecoveryRoute", {
                    active: true,
                    surfaceId: provenance.surfaceId,
                    subProduct: provenance.subProduct,
                    token: provenance.token,
                    destination: target,
                    topUpPool,
                })
            );

            steps.forEach((built, index) => {
                logger.info(`Step ${index + 1} of ${steps.length}:`);
                presentQueueCall(queueAddress, built);
            });
            if (steps.length > 1) {
                logger.warn(
                    "The route call reverts until the feasibility call has EXECUTED — confirm " +
                        "them in order, and check the first one executed before confirming the second."
                );
            }

            if (dryRun) {
                logger.info("dry run: nothing was submitted");
                return;
            }
            for (const built of steps) {
                await submitQueueCall(hre, {
                    multisigAddress,
                    queueAddress,
                    signerAcc,
                    built,
                    queue: live,
                });
            }
            logger.info(
                "A transaction still waiting on confirmations reads back with " +
                    "`perimeter:check-block --id <id>`, and the whole route list with " +
                    "`perimeter:route:show` — a multisig receipt does not say the inner call ran."
            );
        }
    );

task("perimeter:route:remove", "Remove a recovery route, through the Exchequer multisig")
    .addParam("route", "The 32-byte route id", undefined, types.string)
    .addFlag("dryRun", "Print the plan without submitting anything")
    .addOptionalParam("queue", "ExitDelayQueue address (defaults to the deployment record)")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig address (defaults to the MultiSigWallet deployment)")
    .setAction(async ({ route, dryRun, queue, signer, multisig }, hre) => {
        if (!ROUTE_ID.test(String(route))) {
            throw new Error(
                `perimeter:route:remove: --route must be a 32-byte route id, got '${route}'`
            );
        }
        const { address: queueAddress, queue: live } = await resolveQueue(
            hre,
            "perimeter:route:remove",
            queue
        );
        const existing = await live.getRecoveryRoute(route);
        if (!existing.active) {
            // removeRecoveryRoute is a silent no-op for an unregistered id, so
            // the operator is told rather than left to read a successful
            // transaction that changed nothing.
            logger.warn(
                `${route} is not an active route on this queue — removing it changes nothing`
            );
        } else {
            logger.info(
                `Removing the route to ${existing.destination} on ` +
                    `${policy.surfaceLabel(existing.surfaceId)}`
            );
        }
        const built = recovery.buildRecoveryCall("removeRecoveryRoute", { routeId: route });
        const multisigAddress = await resolveMultisigAddress(hre, multisig);
        const signerAcc = await resolveSigner(hre, signer);
        logger.info(`Queue:      ${queueAddress}`);
        logger.info(`Multisig:   ${multisigAddress}`);
        logger.info(`Submitter:  ${signerAcc}`);
        await requireQueueRole(hre, live, "perimeter:route:remove", multisigAddress, false);
        presentQueueCall(queueAddress, built);
        if (dryRun) {
            logger.info("dry run: nothing was submitted");
            return;
        }
        await submitQueueCall(hre, {
            multisigAddress,
            queueAddress,
            signerAcc,
            built,
            queue: live,
        });
        logger.info(
            "A transaction still waiting on confirmations reads back with " +
                `\`perimeter:check-block --id <id>\` — a multisig receipt does not say the inner ` +
                "call ran."
        );
    });

const STATUS_NAMES = ["None", "Queued", "Executed", "ResolvedToProtocol", "ResolvedByOwner"];
const BLOCK_NAMES = ["not blocked", "frozen", "blacklisted"];

/**
 * EVERY registered active route a set of requests could be recovered along,
 * looked up by the provenance the requests themselves carry and never rebuilt
 * from an assumed destination.
 *
 * All of them, not the first: a route id covers surface, pool, asset and
 * destination, so two routes that differ only in destination coexist happily,
 * and which one an iteration reaches first is decided by the queue's own set
 * order — which moves when an unrelated route is removed. Choosing between
 * them is the caller's business, out loud.
 */
const activeRoutesFor = async (queue, surfaceId, subProduct, token) => {
    const { getAddress } = require("ethers").utils;
    const found = [];
    for (const routeId of await queue.recoveryRouteIds()) {
        const route = await queue.getRecoveryRoute(routeId);
        if (!route.active) continue;
        if (route.surfaceId !== surfaceId) continue;
        if (getAddress(route.subProduct) !== getAddress(subProduct)) continue;
        if (getAddress(route.token) !== getAddress(token)) continue;
        found.push({
            routeId,
            active: route.active,
            surfaceId: route.surfaceId,
            subProduct: route.subProduct,
            token: route.token,
            destination: route.destination,
            topUpPool: route.topUpPool,
        });
    }
    return found;
};

task(
    "perimeter:refund",
    "Refund blocked withdrawals to their pool or to an address, through the Exchequer multisig"
)
    .addParam("ids", "Comma-separated withdrawal ids", undefined, types.string)
    .addParam("to", "pool | <address>", undefined, types.string)
    .addFlag("dryRun", "Print the plan without submitting anything")
    .addOptionalParam("queue", "ExitDelayQueue address (defaults to the deployment record)")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig address (defaults to the MultiSigWallet deployment)")
    .setAction(async ({ ids, to, dryRun, queue, signer, multisig }, hre) => {
        const { ethers: hreEthers } = hre;
        const numeric = recovery.parseRequestIds(ids, "perimeter:refund");

        const { address: queueAddress, queue: live } = await resolveQueue(
            hre,
            "perimeter:refund",
            queue
        );
        const toPool = String(to).toLowerCase() === "pool";

        // The queue refuses these destinations before it touches a single
        // request, so they are refused here in the same order. A destination
        // the chain will not take must never reach co-signers as a
        // transaction to confirm: the multisig reports it as executed, the
        // escrow has not moved, and a whole confirmation round is spent.
        let ownerDestination;
        if (!toPool) {
            ownerDestination = recovery.requireOwnerDestination({
                destination: to,
                queue: queueAddress,
                wrbtc: await readWrbtc(live),
            });
        }

        // Every request is read before anything is built: the two legs have
        // different predicates, and a batch that fails one of them reverts
        // wholesale on chain, taking the rest with it.
        const requests = [];
        for (const id of numeric) {
            const request = await live.getRequest(id);
            if (Number(request.status) === 0) {
                throw new Error(`perimeter:refund: the queue holds no withdrawal ${id}`);
            }
            if (Number(request.status) !== 1) {
                throw new Error(
                    `perimeter:refund: withdrawal ${id} is ` +
                        `${STATUS_NAMES[Number(request.status)]}, not Queued — it has already settled`
                );
            }
            const states = {
                originatorState: Number(await live.blockStateOf(request.originator)),
                ownerState: Number(await live.blockStateOf(request.owner)),
                receiverState: Number(await live.blockStateOf(request.receiver)),
            };
            const leg = recovery.refundLegFor(states);
            if (leg === null) {
                throw new Error(
                    `perimeter:refund: withdrawal ${id} has no blacklisted party ` +
                        `(originator ${BLOCK_NAMES[states.originatorState]}, owner ` +
                        `${BLOCK_NAMES[states.ownerState]}, receiver ` +
                        `${BLOCK_NAMES[states.receiverState]}) — neither leg admits it. A frozen ` +
                        "party holds the money in place; blacklist a party first, or use Leg 1 " +
                        "and release it."
                );
            }
            if (toPool && leg !== "pool") {
                throw new Error(
                    `perimeter:refund: withdrawal ${id} — a receiver-only blacklist never ` +
                        "authorises a refund to the pool. Refund it to an address instead, with " +
                        "--to <address>."
                );
            }
            if (!toPool) {
                recovery.requireOwnerDestinationAsset(ownerDestination, request.token, id);
            }
            requests.push({ id, request, leg });
        }

        let built;
        let expectedStatus;
        let destination;
        const first = requests[0].request;

        // Both legs, not the pool leg alone: a mixed-asset batch is legal on
        // chain for the owner's leg, but every total and every "check
        // afterwards" line below is stated in ONE asset, so a batch holding
        // two of them reads as a failure on success and invites a
        // re-submission the queue then refuses as already terminal.
        const otherAsset = requests.find(
            ({ request }) =>
                hreEthers.utils.getAddress(request.token) !==
                hreEthers.utils.getAddress(first.token)
        );
        if (otherAsset) {
            throw new Error(
                "perimeter:refund: one call cannot mix requests holding two assets — withdrawal " +
                    `${requests[0].id} holds ${first.token} and withdrawal ${otherAsset.id} ` +
                    `holds ${otherAsset.request.token}. Refund each asset's withdrawals in its ` +
                    "own call."
            );
        }

        if (toPool) {
            const otherSurface = requests.find(
                ({ request }) => request.surfaceId !== first.surfaceId
            );
            if (otherSurface) {
                throw new Error(
                    "perimeter:refund: a route covers one surface, not several — withdrawal " +
                        `${requests[0].id} is on ${policy.surfaceLabel(first.surfaceId)} and ` +
                        `withdrawal ${otherSurface.id} is on ` +
                        `${policy.surfaceLabel(otherSurface.request.surfaceId)}. Refund each ` +
                        "surface's withdrawals in its own call."
                );
            }
            // The queue matches a route against each id's surface, pool AND
            // asset, and reverts the whole batch on the first that disagrees.
            // Two pools on one surface is the reachable case: several
            // sub-products can share a reserve asset.
            const otherPool = requests.find(
                ({ request }) =>
                    hreEthers.utils.getAddress(request.subProduct) !==
                    hreEthers.utils.getAddress(first.subProduct)
            );
            if (otherPool) {
                throw new Error(
                    "perimeter:refund: a route covers one pool, not several — withdrawal " +
                        `${requests[0].id} came from ${first.subProduct} and withdrawal ` +
                        `${otherPool.id} came from ${otherPool.request.subProduct}. Refund each ` +
                        "pool's withdrawals in its own call."
                );
            }
            const provenance =
                `surface (${policy.surfaceLabel(first.surfaceId)}), pool (${first.subProduct}) ` +
                `and asset (${first.token})`;
            const matching = await activeRoutesFor(
                live,
                first.surfaceId,
                first.subProduct,
                first.token
            );
            if (matching.length === 0) {
                throw new Error(
                    "perimeter:refund: no active recovery route matches these withdrawals' own " +
                        `${provenance} — register one with \`perimeter:route:set\` first, or ` +
                        "refund to an address with --to <address>"
                );
            }
            // Never pick between two eligible routes: which one a read reaches
            // first is the queue's set order, and that order changes when an
            // unrelated route is removed. The same command would then send a
            // blocked user's escrow somewhere else.
            if (matching.length > 1) {
                throw new Error(
                    "perimeter:refund: more than one active recovery route matches these " +
                        `withdrawals' own ${provenance}, and which one a refund would take is ` +
                        "decided by the queue's own storage order, not by this command:\n  " +
                        matching
                            .map((route) => recovery.describeRoute(route.routeId, route))
                            .join("\n  ") +
                        "\nRemove the one that must not be used with `perimeter:route:remove`, " +
                        "or name the destination yourself with --to <address>."
                );
            }
            const found = matching[0];
            // A refund to the pool means exactly that. A route may be active
            // and still pay a plain address — the id does not cover that flag
            // — so the flag itself decides, never the route's mere presence.
            if (!found.topUpPool) {
                throw new Error(
                    `perimeter:refund: ${recovery.describeRoute(found.routeId, found)}, so it ` +
                        "does not top up the pool and --to pool would send a blocked " +
                        "withdrawal's escrow to that address. Register a top-up route with " +
                        "`perimeter:route:set --mode topup`, or name the address yourself with " +
                        "--to <address>."
                );
            }
            destination = found.destination;
            expectedStatus = "ResolvedToProtocol (status 3)";
            built = recovery.buildRecoveryCall("resolveToProtocol", {
                ids: numeric,
                routeId: found.routeId,
            });
            logger.info(`Route:      ${found.routeId}`);
            logger.info(`  destination:      ${found.destination}`);
            logger.info(`  tops up the pool: ${found.topUpPool}`);
        } else {
            destination = ownerDestination;
            expectedStatus = "ResolvedByOwner (status 4)";
            built = recovery.buildRecoveryCall("resolveByOwner", { ids: numeric, destination });
        }

        const total = requests.reduce(
            (sum, { request }) => sum.add(request.amount),
            hreEthers.constants.Zero
        );

        const multisigAddress = await resolveMultisigAddress(hre, multisig);
        const signerAcc = await resolveSigner(hre, signer);
        logger.info(`Queue:      ${queueAddress}`);
        logger.info(`Multisig:   ${multisigAddress}`);
        logger.info(`Submitter:  ${signerAcc}`);
        // The pool leg is Admin or Owner; the owner's leg is Owner-only.
        await requireQueueRole(hre, live, "perimeter:refund", multisigAddress, toPool);
        presentQueueCall(queueAddress, built);
        logger.warn(
            `This moves ${total.toString()} of ${requests[0].request.token} away from the ` +
                "addresses these withdrawals were going to pay, permanently."
        );
        // The multisig reports its own transaction as a success even when the
        // inner call fails, so what to read back is printed with the call, not
        // left to the operator to work out afterwards.
        for (const { id } of requests) {
            logger.info(
                `Check afterwards: withdrawal ${id} reads ${expectedStatus}, and ` +
                    `${destination} holds ${total.toString()} more of ` +
                    `${requests[0].request.token} than it did before`
            );
        }

        if (dryRun) {
            logger.info("dry run: nothing was submitted");
            return;
        }
        await submitQueueCall(hre, {
            multisigAddress,
            queueAddress,
            signerAcc,
            built,
            queue: live,
        });
    });

module.exports = {
    resolveQueue,
    queueAt,
    checkPostcondition,
    reportPostcondition,
    readWrbtc,
    resolveMultisigAddress,
    resolveSigner,
    presentQueueCall,
    submitQueueCall,
    readProvenance,
    activeRoutesFor,
    QUEUE_ABI,
    ROUTE_ID,
};
