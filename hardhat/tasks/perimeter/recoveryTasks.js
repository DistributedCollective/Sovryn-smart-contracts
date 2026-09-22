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
    "function blockStateOf(address) view returns (uint8)",
    "function securityPerimeterPaused() view returns (bool)",
];

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
    } else {
        logger.info(`${taskLabel}: ${address} matches the deployed ExitDelayQueue`);
    }
    const queue = await hreEthers.getContractAt(QUEUE_ABI, address);
    return { address: hreEthers.utils.getAddress(address), queue };
};

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

const submitQueueCall = async (hre, { multisigAddress, queueAddress, signerAcc, built }) => {
    const txId = await sendWithMultisigReturningId(
        multisigAddress,
        queueAddress,
        built.data,
        signerAcc
    );
    logger.info(`  submitted as multisig transaction ${txId}`);
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

        for (const [name, id] of Object.entries(policy.SURFACES)) {
            const feasible = await live.topUpFeasible(id);
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
                    subProduct: hreEthers.utils.getAddress(subproduct),
                    token: hreEthers.utils.getAddress(token),
                };
            }

            const wrbtc = await readWrbtc(live);
            const target = recovery.requireRouteDestination({
                destination,
                token: provenance.token,
                subProduct: provenance.subProduct,
                topUpPool,
                queue: queueAddress,
                wrbtc,
            });

            const routeId = recovery.routeIdOf(
                provenance.surfaceId,
                provenance.subProduct,
                provenance.token,
                target
            );

            // Feasibility is only meaningful for a top-up route — an
            // address-mode route never reads or needs it, so this stays
            // unread rather than making a call this task has no use for.
            const feasibleNow = topUpPool
                ? await readTopUpFeasible(live, provenance.surfaceId)
                : false;
            if (topUpPool && !feasibleNow && !setFeasible) {
                throw new Error(
                    `perimeter:route:set: refund-to-pool is not allowed on ` +
                        `${policy.surfaceLabel(provenance.surfaceId)} yet, so setRecoveryRoute ` +
                        "would revert TopUpInfeasibleSurface. Re-run with --set-feasible to " +
                        "submit setTopUpFeasible(surface, true) first."
                );
            }

            const multisigAddress = await resolveMultisigAddress(hre, multisig);
            const signerAcc = await resolveSigner(hre, signer);
            logger.info(`Queue:      ${queueAddress}`);
            logger.info(`Multisig:   ${multisigAddress}`);
            logger.info(`Submitter:  ${signerAcc}`);
            logger.info(`Route id:   ${routeId}`);

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
                });
            }
            logger.info(
                "Read the result back with `perimeter:route:show` once the transactions have " +
                    "executed — a multisig receipt does not say the inner call ran."
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
        presentQueueCall(queueAddress, built);
        if (dryRun) {
            logger.info("dry run: nothing was submitted");
            return;
        }
        await submitQueueCall(hre, { multisigAddress, queueAddress, signerAcc, built });
    });

const STATUS_NAMES = ["None", "Queued", "Executed", "ResolvedToProtocol", "ResolvedByOwner"];
const BLOCK_NAMES = ["not blocked", "frozen", "blacklisted"];

/** The registered route a set of requests may be recovered along, or null.
 *  Looked up by the provenance the requests themselves carry, never rebuilt
 *  from an assumed destination. */
const activeRouteFor = async (queue, surfaceId, subProduct, token) => {
    const { getAddress } = require("ethers").utils;
    for (const routeId of await queue.recoveryRouteIds()) {
        const route = await queue.getRecoveryRoute(routeId);
        if (!route.active) continue;
        if (route.surfaceId !== surfaceId) continue;
        if (getAddress(route.subProduct) !== getAddress(subProduct)) continue;
        if (getAddress(route.token) !== getAddress(token)) continue;
        return { routeId, destination: route.destination, topUpPool: route.topUpPool };
    }
    return null;
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
        const numeric = String(ids)
            .split(",")
            .map((part) => part.trim())
            .filter((part) => part !== "");
        if (numeric.length === 0) {
            throw new Error("perimeter:refund: --ids names no withdrawal");
        }

        const { address: queueAddress, queue: live } = await resolveQueue(
            hre,
            "perimeter:refund",
            queue
        );
        const toPool = String(to).toLowerCase() === "pool";

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
            requests.push({ id, request, leg });
        }

        let built;
        let expectedStatus;
        let destination;
        if (toPool) {
            const first = requests[0].request;
            if (requests.some(({ request }) => request.surfaceId !== first.surfaceId)) {
                throw new Error(
                    "perimeter:refund: a route covers one surface, not several — refund each " +
                        "surface's withdrawals in its own call"
                );
            }
            if (
                requests.some(
                    ({ request }) =>
                        hreEthers.utils.getAddress(request.token) !==
                        hreEthers.utils.getAddress(first.token)
                )
            ) {
                throw new Error(
                    "perimeter:refund: one call cannot mix requests holding two assets"
                );
            }
            const found = await activeRouteFor(
                live,
                first.surfaceId,
                first.subProduct,
                first.token
            );
            if (!found) {
                throw new Error(
                    "perimeter:refund: no active recovery route matches these withdrawals' own " +
                        `surface (${policy.surfaceLabel(first.surfaceId)}), pool ` +
                        `(${first.subProduct}) and asset (${first.token}) — register one with ` +
                        "`perimeter:route:set` first, or refund to an address with --to <address>"
                );
            }
            destination = found.destination;
            expectedStatus = "ResolvedToProtocol (status 3)";
            built = recovery.buildRecoveryCall("resolveToProtocol", {
                ids: numeric,
                routeId: found.routeId,
            });
            logger.info(`Route:      ${found.routeId}`);
            logger.info(`  tops up the pool: ${found.topUpPool}`);
        } else {
            destination = hreEthers.utils.getAddress(to);
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
        });
    });

module.exports = {
    resolveQueue,
    readWrbtc,
    resolveMultisigAddress,
    resolveSigner,
    presentQueueCall,
    submitQueueCall,
    readProvenance,
    activeRouteFor,
    QUEUE_ABI,
    ROUTE_ID,
};
