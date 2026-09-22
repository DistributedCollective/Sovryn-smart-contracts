const { ethers } = require("ethers");
const { SURFACE_PHRASES, SURFACES, describeArgs, stringifyArg } = require("./surfaces");

/**
 * The ExitDelayQueue's recovery levers as pure logic: what each one encodes
 * to, what each one means in plain words, and which of them a given request
 * is eligible for. Takes no hardhat runtime and does no I/O, so every part of
 * it can be pinned by a unit test without a chain.
 *
 * These are a SEPARATE family from `policy.BLOCK_LEVERS`. A block lever is
 * built by `07_BlockExits.s.sol` and pasted into `perimeter:submit-block` as
 * raw calldata; a recovery lever is built here, by the task that submits it,
 * so its arguments are validated at build time and never pasted.
 */

const NAME_BY_ID = Object.freeze(
    Object.fromEntries(Object.entries(SURFACES).map(([name, id]) => [id, name]))
);

/** "lender withdrawals", or the raw id for a surface this file does not name. */
const phraseOf = (id) => {
    const name = NAME_BY_ID[String(id).toLowerCase()] || NAME_BY_ID[id];
    return name ? SURFACE_PHRASES[name] : `the surface ${id}`;
};

/** "withdrawal 7"; "withdrawals 7, 8". */
const withdrawalsNamed = (ids) => {
    const list = ids.map((id) => String(id));
    return `${list.length === 1 ? "withdrawal" : "withdrawals"} ${list.join(", ")}`;
};

const requireAddress = (value, label) => {
    let checksummed;
    try {
        checksummed = ethers.utils.getAddress(value);
    } catch (e) {
        throw new Error(`${label}: '${value}' is not a valid address`);
    }
    return checksummed;
};

const requireIds = (ids, label) => {
    if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error(`${label}: names no withdrawal — the queue refuses an empty batch`);
    }
    return ids.map((id) => {
        const n = ethers.BigNumber.from(String(id));
        if (n.lte(0)) throw new Error(`${label}: '${id}' is not a request id — ids start at 1`);
        return n.toString();
    });
};

/**
 * The withdrawal ids a batch names, read from one comma-separated argument and
 * refused before any state is read rather than part way through it.
 *
 * A repeated id is refused rather than quietly deduplicated: the queue settles
 * it on the first pass and then reverts the whole batch as already terminal on
 * the second, and a preview built from such a list counts the repeated amount
 * twice.
 */
const parseRequestIds = (value, label) => {
    const parts = String(value)
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part !== "");
    if (parts.length === 0) {
        throw new Error(`${label}: --ids names no withdrawal — the queue refuses an empty batch`);
    }
    const seen = new Set();
    return parts.map((part) => {
        if (!/^[0-9]+$/.test(part)) {
            throw new Error(
                `${label}: '${part}' is not a withdrawal id — ids are whole numbers and start at 1`
            );
        }
        const id = ethers.BigNumber.from(part).toString();
        if (id === "0") {
            throw new Error(`${label}: '0' is not a withdrawal id — ids start at 1`);
        }
        if (seen.has(id)) {
            throw new Error(
                `${label}: withdrawal ${id} is named twice — the queue settles it on the first ` +
                    "pass and then reverts the whole batch as already terminal on the second"
            );
        }
        seen.add(id);
        return id;
    });
};

/**
 * An asset argument typed by an operator. Three of the five surfaces escrow
 * native RBTC, which the queue records as the zero address, and on those an
 * address-mode route is the only recovery route that can exist at all — so the
 * shorthand the help text offers has to work, and anything else has to refuse
 * in a sentence that names the argument rather than in a library's own words.
 */
const parseAssetAddress = (value, label) => {
    const raw = String(value).trim();
    if (/^(0x0+|0|native|rbtc)$/i.test(raw)) return ethers.constants.AddressZero;
    try {
        return ethers.utils.getAddress(raw);
    } catch (e) {
        throw new Error(
            `${label} '${value}' is not an asset address — pass the asset's own address, or ` +
                "0x0 for a surface that escrows native RBTC"
        );
    }
};

/** A pool argument typed by an operator, refused in the task's own words
 *  rather than the address library's. Native RBTC has no pool, so there is no
 *  shorthand here. */
const parsePoolAddress = (value, label) => {
    try {
        return ethers.utils.getAddress(String(value).trim());
    } catch (e) {
        throw new Error(`${label} '${value}' is not a pool address`);
    }
};

/** Named-argument ABI for the six calls. The names are display-only: they do
 *  not change the selector a signature hashes to, so a selector computed from
 *  a RECOVERY_LEVERS key and one computed from this ABI always agree. */
const QUEUE_RECOVERY_ABI = [
    "function resolveToProtocol(uint256[] ids, bytes32 routeId)",
    "function resolveByOwner(uint256[] ids, address destination)",
    "function setRecoveryRoute((bool active, bytes32 surfaceId, address subProduct, address token, address destination, bool topUpPool) route)",
    "function removeRecoveryRoute(bytes32 routeId)",
    "function setTopUpFeasible(bytes32 surfaceId, bool feasible)",
    "function recoverStuckExit(uint256 id, address altReceiver)",
];

const recoveryInterface = () => new ethers.utils.Interface(QUEUE_RECOVERY_ABI);

/**
 * How each call's positional arguments are built from operator-friendly
 * input, and how its effect reads in plain words from those same positional
 * arguments — `meaning` is shared between `buildRecoveryCall` (fed what it
 * just built) and `decodeRecoveryCall` (fed what it just decoded off
 * submitted calldata), so the two can never drift apart.
 */
const CALL_DEFS = {
    resolveToProtocol: {
        signature: "resolveToProtocol(uint256[],bytes32)",
        build: ({ ids, routeId }) => [
            requireIds(ids, "resolveToProtocol: ids"),
            ethers.utils.hexZeroPad(ethers.BigNumber.from(routeId).toHexString(), 32),
        ],
        meaning: ([ids, routeId]) =>
            `sends ${withdrawalsNamed(Array.from(ids))} to the destination route ${routeId} ` +
            "names, away from their receivers",
    },
    resolveByOwner: {
        signature: "resolveByOwner(uint256[],address)",
        build: ({ ids, destination }) => [
            requireIds(ids, "resolveByOwner: ids"),
            requireAddress(destination, "resolveByOwner: destination"),
        ],
        meaning: ([ids, destination]) =>
            `sends ${withdrawalsNamed(Array.from(ids))} to ${destination}, away from ` +
            `${Array.from(ids).length === 1 ? "its receiver" : "their receivers"}`,
    },
    setRecoveryRoute: {
        signature: "setRecoveryRoute((bool,bytes32,address,address,address,bool))",
        build: ({ active, surfaceId, subProduct, token, destination, topUpPool }) => [
            [
                Boolean(active),
                surfaceId,
                requireAddress(subProduct, "setRecoveryRoute: subProduct"),
                requireAddress(token, "setRecoveryRoute: token"),
                requireAddress(destination, "setRecoveryRoute: destination"),
                Boolean(topUpPool),
            ],
        ],
        // `active` is the first field of the tuple and decides whether this
        // call switches a route on or off. A route stored with it false is a
        // deactivation: `resolveToProtocol` along that route then reverts
        // RouteInactive. Describing one as a registration would tell a
        // co-signer the opposite of what the stored call does.
        meaning: ([route]) => {
            const [active, surfaceId, subProduct, token, destination, topUpPool] = route;
            if (!active) {
                return (
                    `deactivates the recovery route on ${phraseOf(surfaceId)} to ${destination} ` +
                    "— a refund along it is refused until it is registered again"
                );
            }
            return topUpPool
                ? `registers a recovery route on ${phraseOf(surfaceId)} that tops up the pool ` +
                      `${subProduct} with the escrowed ${token}`
                : `registers a recovery route on ${phraseOf(surfaceId)} that sends the escrowed ` +
                      `${token} to ${destination}`;
        },
    },
    removeRecoveryRoute: {
        signature: "removeRecoveryRoute(bytes32)",
        build: ({ routeId }) => [
            ethers.utils.hexZeroPad(ethers.BigNumber.from(routeId).toHexString(), 32),
        ],
        meaning: ([routeId]) => `removes the recovery route ${routeId}`,
    },
    setTopUpFeasible: {
        signature: "setTopUpFeasible(bytes32,bool)",
        build: ({ surfaceId, feasible }) => [surfaceId, Boolean(feasible)],
        meaning: ([surfaceId, feasible]) =>
            feasible
                ? `allows a refund-to-pool route to be registered on ${phraseOf(surfaceId)}`
                : `stops any new refund-to-pool route being registered on ${phraseOf(surfaceId)}`,
    },
    recoverStuckExit: {
        signature: "recoverStuckExit(uint256,address)",
        build: ({ id, altReceiver }) => [
            requireIds([id], "recoverStuckExit: id")[0],
            requireAddress(altReceiver, "recoverStuckExit: altReceiver"),
        ],
        meaning: ([id, altReceiver]) =>
            `retries withdrawal ${id} to its own receiver and, only if that payment bounces, ` +
            `pays ${altReceiver} instead`,
    },
};

/** Bare signature -> a one-line summary, for a co-signer reading a submitted
 *  transaction. The per-call `meaning` above is argument-specific and always
 *  preferred where the arguments decoded; this is the family description. */
const RECOVERY_LEVERS = Object.freeze({
    "resolveToProtocol(uint256[],bytes32)":
        "refund blocked withdrawals along a registered recovery route",
    "resolveByOwner(uint256[],address)":
        "refund blocked withdrawals to an address the Owner names",
    "setRecoveryRoute((bool,bytes32,address,address,address,bool))":
        "register or replace a recovery route",
    "removeRecoveryRoute(bytes32)": "remove a recovery route",
    "setTopUpFeasible(bytes32,bool)": "allow or stop refund-to-pool routes on one surface",
    "recoverStuckExit(uint256,address)":
        "retry one withdrawal's payment and, only on a bounce, pay an alternate address",
});

/** signature -> kind, built from CALL_DEFS so this can never recognize a
 *  signature CALL_DEFS itself does not define. */
const KIND_BY_SIGNATURE = Object.freeze(
    Object.fromEntries(Object.entries(CALL_DEFS).map(([kind, def]) => [def.signature, kind]))
);

// The two tables are keyed by the same six signatures. A signature in one and
// not the other means a lever can be built and not described, or described and
// not built; neither is allowed to reach an operator.
for (const signature of Object.keys(RECOVERY_LEVERS)) {
    if (!KIND_BY_SIGNATURE[signature]) {
        throw new Error(`recovery.js: RECOVERY_LEVERS names ${signature}, CALL_DEFS does not`);
    }
}
for (const signature of Object.keys(KIND_BY_SIGNATURE)) {
    if (!RECOVERY_LEVERS[signature]) {
        throw new Error(`recovery.js: CALL_DEFS names ${signature}, RECOVERY_LEVERS does not`);
    }
}

const SELECTORS = (() => {
    const table = {};
    for (const [signature, kind] of Object.entries(KIND_BY_SIGNATURE)) {
        table[ethers.utils.id(signature).slice(0, 10)] = { signature, kind };
    }
    return table;
})();

/** `keccak256(abi.encode(surfaceId, subProduct, token, destination))` — the
 *  queue's own storage key. `topUpPool` is deliberately NOT part of it, so two
 *  routes that disagree only on that field share an id and a read-back must
 *  check it separately. */
const routeIdOf = (surfaceId, subProduct, token, destination) =>
    ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "address"],
            [
                surfaceId,
                ethers.utils.getAddress(subProduct),
                ethers.utils.getAddress(token),
                ethers.utils.getAddress(destination),
            ]
        )
    );

/**
 * The destination guard `setRecoveryRoute` enforces on chain, applied here so
 * an operator reads the reason instead of a reverted multisig transaction:
 * never the zero address, the queue itself (which would trap the escrow), the
 * escrowed token, or WRBTC (which would swallow an unwrap payout). A top-up
 * route is pinned tighter still — the surface must already allow refund-to-pool,
 * the escrow must not be native RBTC, and the destination must be the pool
 * itself.
 *
 * The arms run in the queue's own order, including the three top-up ones, so an
 * operator whose route trips more than one of them reads the same first reason
 * here as the chain would have raised.
 */
const requireRouteDestination = ({
    destination,
    token,
    subProduct,
    topUpPool,
    queue,
    wrbtc,
    surfaceId,
    topUpFeasible,
}) => {
    const target = requireAddress(destination, "route destination");
    if (target === ethers.constants.AddressZero) {
        throw new Error("route destination: must not be the zero address");
    }
    if (queue && target === ethers.utils.getAddress(queue)) {
        throw new Error(
            "route destination: must not be the queue itself — it would trap the escrow"
        );
    }
    if (
        token &&
        token !== ethers.constants.AddressZero &&
        target === ethers.utils.getAddress(token)
    ) {
        throw new Error("route destination: must not be the escrowed token");
    }
    if (wrbtc && target === ethers.utils.getAddress(wrbtc)) {
        throw new Error(
            "route destination: must not be WRBTC — a wrapped-token destination swallows an unwrap payout"
        );
    }
    if (topUpPool) {
        if (topUpFeasible === false) {
            throw new Error(
                `route destination: refund-to-pool is not allowed on ${phraseOf(surfaceId)} yet, ` +
                    "so setRecoveryRoute would revert TopUpInfeasibleSurface — re-run with " +
                    "--set-feasible to submit setTopUpFeasible(surface, true) first"
            );
        }
        if (!token || token === ethers.constants.AddressZero) {
            throw new Error(
                "route destination: this surface escrows native RBTC, which has no pool to top up"
            );
        }
        if (target !== ethers.utils.getAddress(subProduct)) {
            throw new Error(
                `route destination: a top-up route pays its own pool — ${subProduct}, not ${target}`
            );
        }
    }
    return target;
};

/**
 * The destination guard `resolveByOwner` runs before it touches a single
 * request: never the zero address, the queue itself (which would trap the
 * escrow), or WRBTC (which would swallow an unwrap payout). Applied here in
 * the queue's own order, so a destination the chain will refuse never reaches
 * a co-signer as a transaction to confirm.
 *
 * The queue's fourth arm — the destination must not be the asset a request
 * escrowed — is per request and lives in `requireOwnerDestinationAsset`,
 * exactly where the queue checks it.
 */
const requireOwnerDestination = ({ destination, queue, wrbtc }) => {
    const target = requireAddress(destination, "refund destination");
    if (target === ethers.constants.AddressZero) {
        throw new Error("refund destination: must not be the zero address");
    }
    if (queue && target === ethers.utils.getAddress(queue)) {
        throw new Error(
            "refund destination: must not be the queue itself — it would trap the escrow"
        );
    }
    if (
        wrbtc &&
        ethers.utils.getAddress(wrbtc) !== ethers.constants.AddressZero &&
        target === ethers.utils.getAddress(wrbtc)
    ) {
        throw new Error(
            "refund destination: must not be WRBTC — a wrapped-token destination swallows an " +
                "unwrap payout"
        );
    }
    return target;
};

/** `resolveByOwner`'s per-request arm: the destination is never the asset that
 *  request escrowed. Named per withdrawal, because a batch's ids can escrow
 *  different assets and only one of them need collide. */
const requireOwnerDestinationAsset = (destination, token, id) => {
    if (!token || ethers.utils.getAddress(token) === ethers.constants.AddressZero) return;
    if (ethers.utils.getAddress(destination) === ethers.utils.getAddress(token)) {
        throw new Error(
            `refund destination: must not be ${ethers.utils.getAddress(token)}, the asset ` +
                `withdrawal ${id} escrowed`
        );
    }
};

/**
 * A registered route in plain words, from the fields the queue stores for it.
 * A route id is a hash of four fields and says nothing legible on its own, so
 * anyone judging a pool refund by its id alone is judging where a blocked
 * user's escrow goes from a 32-byte value. Whether the route is active decides
 * whether that refund runs at all.
 */
const describeRoute = (routeId, route) => {
    const registered =
        Boolean(route.active) ||
        ethers.utils.getAddress(route.destination) !== ethers.constants.AddressZero;
    if (!registered) {
        return (
            `the route ${routeId} is not registered on this queue — a refund along it reverts ` +
            "RouteInactive"
        );
    }
    const leg = route.topUpPool
        ? `tops up the pool ${route.subProduct} with the escrowed ${route.token}`
        : `sends the escrowed ${route.token} to ${route.destination}`;
    return route.active
        ? `the route ${routeId} is active on ${phraseOf(route.surfaceId)} and ${leg}`
        : `the route ${routeId} is registered on ${phraseOf(route.surfaceId)} and ${leg}, but ` +
              "it is NOT active — a refund along it reverts RouteInactive";
};

/**
 * Which refund leg a request is eligible for, from its three parties' block
 * states (0 none, 1 frozen, 2 blacklisted).
 *
 * `resolveToProtocol` admits a request whose ORIGINATOR or OWNER is
 * blacklisted; a blacklisted receiver alone never authorizes it.
 * `resolveByOwner` additionally admits a receiver-only blacklist. A frozen
 * party authorizes neither: frozen holds the money in place.
 *
 * `'pool'` means both legs are open (the pool leg needs a route as well);
 * `'address'` means only the owner's leg is; `null` means neither.
 */
const refundLegFor = ({ originatorState, ownerState, receiverState }) => {
    const BLACKLISTED = 2;
    if (Number(originatorState) === BLACKLISTED || Number(ownerState) === BLACKLISTED) {
        return "pool";
    }
    return Number(receiverState) === BLACKLISTED ? "address" : null;
};

const buildRecoveryCall = (kind, args) => {
    const def = CALL_DEFS[kind];
    if (!def) {
        throw new Error(
            `buildRecoveryCall: unknown recovery call '${kind}'. Expected one of: ` +
                Object.keys(CALL_DEFS).join(", ")
        );
    }
    const positional = def.build(args || {});
    const data = recoveryInterface().encodeFunctionData(kind, positional);
    return { signature: def.signature, data, meaning: def.meaning(positional) };
};

const decodeRecoveryCall = (data) => {
    if (typeof data !== "string" || !/^0x[0-9a-fA-F]{8,}$/.test(data)) return undefined;
    const entry = SELECTORS[data.slice(0, 10).toLowerCase()];
    if (!entry) return undefined;
    const iface = recoveryInterface();
    const fragment = iface.getFunction(entry.kind);
    let args;
    try {
        args = iface.decodeFunctionData(fragment, data);
    } catch (e) {
        return undefined;
    }
    return {
        target: "queue",
        signature: entry.signature,
        kind: entry.signature,
        args,
        meaning: CALL_DEFS[entry.kind].meaning(args),
        fields: describeArgs(fragment, args),
    };
};

/** The queue's own ExitStatus enum, by name. */
const STATUS_BY_NAME = Object.freeze({
    None: 0,
    Queued: 1,
    Executed: 2,
    ResolvedToProtocol: 3,
    ResolvedByOwner: 4,
});

/**
 * What a submitted recovery call was meant to leave behind, derived from the
 * calldata itself.
 *
 * A wallet's `executed` flag says the inner call ran without reverting. It does
 * NOT say the queue ended up where the command meant to leave it, and that is
 * exactly what an incident lever has to be trusted for. Deriving the check from
 * the stored calldata rather than from anything remembered at submission time
 * means the operator who confirms — very often not the one who submitted — can
 * re-run it against a transaction id alone.
 *
 * `undefined` for calldata this module does not recognize, and `null` for a
 * recognized call that leaves nothing this tool can read back.
 */
const postconditionFor = (data) => {
    const call = decodeRecoveryCall(data);
    if (!call) return undefined;
    const { args } = call;
    switch (call.signature) {
        case "resolveToProtocol(uint256[],bytes32)":
            return {
                kind: "refundResolved",
                ids: Array.from(args[0]).map(String),
                status: "ResolvedToProtocol",
            };
        case "resolveByOwner(uint256[],address)":
            return {
                kind: "refundResolved",
                ids: Array.from(args[0]).map(String),
                status: "ResolvedByOwner",
            };
        case "setRecoveryRoute((bool,bytes32,address,address,address,bool))": {
            const [active, surfaceId, subProduct, token, destination, topUpPool] = args[0];
            return {
                kind: "routeStored",
                routeId: routeIdOf(surfaceId, subProduct, token, destination),
                active: Boolean(active),
                topUpPool: Boolean(topUpPool),
            };
        }
        case "removeRecoveryRoute(bytes32)":
            return { kind: "routeRemoved", routeId: args[0] };
        case "setTopUpFeasible(bytes32,bool)":
            return {
                kind: "topUpFeasible",
                surfaceId: args[0],
                feasible: Boolean(args[1]),
            };
        default:
            return null;
    }
};

/** What a postcondition checks, in the words the operator reads once it has
 *  held. Kept beside the derivation so the two cannot describe different
 *  things. */
const describePostcondition = (postcondition) => {
    switch (postcondition.kind) {
        case "refundResolved":
            return `${withdrawalsNamed(postcondition.ids)} ${
                postcondition.ids.length === 1 ? "reads" : "read"
            } ${postcondition.status}, and no longer ${
                postcondition.ids.length === 1 ? "sits" : "sit"
            } in the active list of any party to ${
                postcondition.ids.length === 1 ? "it" : "them"
            }`;
        case "routeStored":
            return (
                `the route ${postcondition.routeId} reads active=${postcondition.active} and ` +
                `topUpPool=${postcondition.topUpPool}`
            );
        case "routeRemoved":
            return `the route ${postcondition.routeId} is no longer active`;
        case "topUpFeasible":
            return postcondition.feasible
                ? `a refund-to-pool route may be registered on ${phraseOf(postcondition.surfaceId)}`
                : `no new refund-to-pool route may be registered on ${phraseOf(
                      postcondition.surfaceId
                  )}`;
        default:
            throw new Error(
                `describePostcondition: no words for a '${postcondition.kind}' postcondition`
            );
    }
};

module.exports = {
    QUEUE_RECOVERY_ABI,
    STATUS_BY_NAME,
    postconditionFor,
    describePostcondition,
    RECOVERY_LEVERS,
    parseRequestIds,
    parseAssetAddress,
    parsePoolAddress,
    routeIdOf,
    requireRouteDestination,
    requireOwnerDestination,
    requireOwnerDestinationAsset,
    describeRoute,
    refundLegFor,
    buildRecoveryCall,
    decodeRecoveryCall,
    stringifyArg,
};
