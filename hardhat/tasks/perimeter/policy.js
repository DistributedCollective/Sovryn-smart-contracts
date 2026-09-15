/**
 * The ExitFeeController's policy surface, as pure data and pure functions.
 *
 * No hardhat runtime and no I/O here — everything a chain read or a chain
 * write needs is passed in by the caller (the tasks in `policyTasks.js`), and
 * everything this module hands back is either a plain value or unsigned
 * calldata. That is what makes it possible to test the encoding, the surface
 * resolution and the exemption/revoke decisions without a node.
 *
 * SURFACES, TIERS, RESOLUTION
 *
 * Every policy (a Perimeter fee rate, or — on the delay build — a delay
 * bypass) is looked up in three tiers: actor, then sub-product, then surface.
 * The first ACTIVE entry decides; an inactive entry means "look at the next
 * tier". For the fee, the surface entry is also the gate: an inactive surface
 * charges no fee at all, whatever the sub-product and actor entries say. For
 * the delay, an active bypass entry means "not held"; an active non-bypass
 * entry means "held"; nothing active anywhere means "held" by default.
 *
 * An exemption for one address on one surface is the PAIR of actor-tier
 * entries: a fee policy of {active: true, rateBps: 0} and a delay bypass of
 * {active: true, bypass: true}. The fee half exists on both controller
 * builds; the delay half only exists once the controller carrying the
 * withdrawal delay is installed — `planExemption` and `planRevoke` refuse to
 * plan it before then rather than submitting a call that would revert.
 */
const { ethers } = require("ethers");

/** keccak256 of the UTF-8 surface name, the way the controller hashes it. */
const surfaceIdFor = (name) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(name));

/** Every surface this controller hooks, name -> id. */
const SURFACES = Object.freeze({
    PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW: surfaceIdFor(
        "PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW"
    ),
    PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW: surfaceIdFor(
        "PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW"
    ),
    PERIMETER_SURFACE_ZERO_WITHDRAW_COLL: surfaceIdFor("PERIMETER_SURFACE_ZERO_WITHDRAW_COLL"),
    PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS: surfaceIdFor("PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS"),
    PERIMETER_SURFACE_AMM_REMOVE_LIQUIDITY: surfaceIdFor("PERIMETER_SURFACE_AMM_REMOVE_LIQUIDITY"),
});

/** A short plain-words phrase for each surface, used inside `meaning` sentences. */
const SURFACE_PHRASES = Object.freeze({
    PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW: "lender withdrawals",
    PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW: "borrower withdrawals",
    PERIMETER_SURFACE_ZERO_WITHDRAW_COLL: "Zero collateral withdrawals",
    PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS: "Zero surplus claims",
    PERIMETER_SURFACE_AMM_REMOVE_LIQUIDITY: "AMM liquidity removals",
});

/** The two surfaces with no sub-product tier: Zero withdrawals are not keyed
 *  on a pool, so a sub-product entry there would be meaningless. */
const SURFACES_WITHOUT_SUBPRODUCT = Object.freeze(
    new Set(["PERIMETER_SURFACE_ZERO_WITHDRAW_COLL", "PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS"])
);

const NAME_BY_ID = Object.freeze(
    Object.fromEntries(Object.entries(SURFACES).map(([name, id]) => [id.toLowerCase(), name]))
);

/** Resolve a surface given as its name, a unique case-insensitive suffix of
 *  the name (e.g. "LENDER_WITHDRAW"), or a 0x-prefixed 32-byte id. Throws,
 *  listing the known names, when nothing or more than one thing matches. */
const resolveSurface = (input) => {
    if (typeof input !== "string" || input.trim() === "") {
        throw new Error(
            `resolveSurface: expected a surface name, suffix, or id, got '${input}'. Known ` +
                `surfaces:\n  ${Object.keys(SURFACES).join("\n  ")}`
        );
    }
    const trimmed = input.trim();

    if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
        const name = NAME_BY_ID[trimmed.toLowerCase()];
        if (!name) {
            throw new Error(
                `resolveSurface: '${input}' is not a known surface. Expected one of:\n  ` +
                    Object.keys(SURFACES).join("\n  ")
            );
        }
        return { name, id: SURFACES[name] };
    }

    const upper = trimmed.toUpperCase();
    if (SURFACES[upper] !== undefined) {
        return { name: upper, id: SURFACES[upper] };
    }

    const matches = Object.keys(SURFACES).filter((name) => name.endsWith(upper));
    if (matches.length === 1) {
        return { name: matches[0], id: SURFACES[matches[0]] };
    }
    if (matches.length > 1) {
        throw new Error(
            `resolveSurface: '${input}' matches more than one surface: ${matches.join(", ")}`
        );
    }
    throw new Error(
        `resolveSurface: '${input}' is not a known surface. Expected one of:\n  ` +
            Object.keys(SURFACES).join("\n  ")
    );
};

const surfaceIdOf = (surfaceInput) => {
    if (surfaceInput && typeof surfaceInput === "object" && surfaceInput.id) {
        return surfaceInput.id;
    }
    return resolveSurface(surfaceInput).id;
};

const surfaceLabel = (id) => {
    const name = NAME_BY_ID[String(id).toLowerCase()];
    return name ? SURFACE_PHRASES[name] : `surface ${id}`;
};

/**
 * The controller's ABI, as human-readable fragments — inline here rather than
 * depended on from build artifacts, because the controller is deployed from a
 * different repository. Both controller builds carry the fee functions; only
 * the delay build carries the ones below the blank line (the fee build
 * reverts on them, which is how the two are told apart).
 */
const CONTROLLER_ABI = [
    "function exitFeeEnabled() view returns (bool)",
    "function feeReceiver() view returns (address)",
    "function surfacePolicy(bytes32) view returns (tuple(bool active, uint16 rateBps))",
    "function subProductPolicy(bytes32, address) view returns (tuple(bool active, uint16 rateBps))",
    "function actorPolicy(bytes32, address) view returns (tuple(bool active, uint16 rateBps))",
    "function subProductKeys(bytes32) view returns (address[])",
    "function actorKeys(bytes32) view returns (address[])",
    "function quoteExitFee(bytes32, address, address, uint256) view returns (tuple(bool active, uint16 rateBps, uint256 feeAmount, uint256 netAmount, address feeReceiver, uint8 reason))",
    "function setExitFeeEnabled(bool)",
    "function setFeeReceiver(address)",
    "function setSurfacePolicy(bytes32, tuple(bool active, uint16 rateBps))",
    "function setSubProductPolicy(bytes32, address, tuple(bool active, uint16 rateBps))",
    "function setActorPolicy(bytes32, address, tuple(bool active, uint16 rateBps))",
    "function removeSubProductPolicy(bytes32, address)",
    "function removeActorPolicy(bytes32, address)",

    "function securityPerimeterEnabled() view returns (bool)",
    "function globalDelaySeconds() view returns (uint32)",
    "function actorBypass(bytes32, address) view returns (tuple(bool active, bool bypass))",
    "function subProductBypass(bytes32, address) view returns (tuple(bool active, bool bypass))",
    "function surfaceBypass(bytes32) view returns (tuple(bool active, bool bypass))",
    "function setActorBypass(bytes32, address, tuple(bool active, bool bypass))",
    "function removeActorBypass(bytes32, address)",
    "function revokeExemption(bytes32, address)",
];

const controllerInterface = () => new ethers.utils.Interface(CONTROLLER_ABI);

/** The 4-byte selector of `securityPerimeterEnabled()` — present in the
 *  deployed bytecode of the delay build, absent from the fee-only build. */
const SECURITY_PERIMETER_ENABLED_SELECTOR = ethers.utils
    .id("securityPerimeterEnabled()")
    .slice(2, 10)
    .toLowerCase();

/**
 * Decide "fee-only" or "delay" purely from deployed bytecode — no chain call,
 * so a network error or a reverting call can never be mistaken for "fee-only".
 * The caller reads the bytecode once (the same read it already needs to
 * refuse an empty-code address) and hands it here.
 */
const buildFromCode = (code) =>
    String(code || "")
        .toLowerCase()
        .includes(SECURITY_PERIMETER_ENABLED_SELECTOR)
        ? "delay"
        : "fee-only";

/**
 * Extract an ERC-1967 implementation address from the value read out of a
 * proxy's implementation storage slot. `undefined` for the all-zero word —
 * that slot is unset, which means the address being inspected is not an
 * ERC-1967 proxy at all, and its own code is the implementation. Otherwise
 * the low 20 bytes are the address, checksummed; a slot that isn't a clean
 * left-zero-padded address (upper 12 bytes non-zero) is not a plausible
 * ERC-1967 slot and throws rather than being misread as one. Pure — the
 * caller does the storage read.
 */
const implementationFromSlot = (slotValue) => {
    if (typeof slotValue !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(slotValue)) {
        throw new Error(`implementationFromSlot: expected a 32-byte hex word, got '${slotValue}'`);
    }
    const upperBytes = slotValue.slice(2, 26);
    if (!/^0+$/.test(upperBytes)) {
        throw new Error(
            `implementationFromSlot: '${slotValue}' is not a plausible ERC-1967 implementation ` +
                "slot — the upper 12 bytes must be zero"
        );
    }
    const lowBytes = slotValue.slice(-40);
    if (/^0+$/.test(lowBytes)) {
        return undefined;
    }
    return ethers.utils.getAddress(`0x${lowBytes}`);
};

/** The owner/admin setters `buildCall`/`decodeCall` know how to build and read back. */
const CALL_KINDS = Object.freeze([
    "setExitFeeEnabled",
    "setFeeReceiver",
    "setSurfacePolicy",
    "setSubProductPolicy",
    "setActorPolicy",
    "removeSubProductPolicy",
    "removeActorPolicy",
    "setActorBypass",
    "removeActorBypass",
    "revokeExemption",
]);

/** A BigNumber (from a decoded call) or a plain JS number (from a freshly
 *  built one) — either way, the integer it represents. */
const toNumber = (value) => (typeof value === "number" ? value : Number(value.toString()));

const requireAddress = (value, label) => {
    let checksummed;
    try {
        checksummed = ethers.utils.getAddress(value);
    } catch (e) {
        throw new Error(`${label}: '${value}' is not a valid address`);
    }
    if (checksummed === ethers.constants.AddressZero) {
        throw new Error(`${label}: must not be the zero address`);
    }
    return checksummed;
};

const requireRate = (rate, label) => {
    if (!rate || typeof rate.active !== "boolean") {
        throw new Error(`${label}: expected {active, rateBps}, got ${JSON.stringify(rate)}`);
    }
    const bps = toNumber(rate.rateBps);
    if (!Number.isInteger(bps) || bps < 0 || bps > 10000) {
        throw new Error(
            `${label}: rateBps must be an integer between 0 and 10000, got '${rate.rateBps}'`
        );
    }
    return [rate.active, bps];
};

const requireBypass = (bypass, label) => {
    if (!bypass || typeof bypass.active !== "boolean" || typeof bypass.bypass !== "boolean") {
        throw new Error(`${label}: expected {active, bypass}, got ${JSON.stringify(bypass)}`);
    }
    return [bypass.active, bypass.bypass];
};

/**
 * Rate input, as an operator would type it: an integer 0..10000 (basis
 * points) or the literal "inactive". Throws on anything else, including a
 * "%" suffix — the field is bps, not percent, and that mistake is 100x.
 */
const parseRate = (input) => {
    if (typeof input === "string" && input.trim().toLowerCase() === "inactive") {
        return { active: false, rateBps: 0 };
    }
    if (typeof input === "string" && /%\s*$/.test(input.trim())) {
        throw new Error(
            `parseRate: '${input}' looks like a percentage — this field is in basis points ` +
                "(bps), not percent. 100 bps = 1%."
        );
    }
    const n = typeof input === "number" ? input : Number(input);
    if (typeof input === "boolean" || Number.isNaN(n)) {
        throw new Error(
            `parseRate: '${input}' is not a valid rate — pass an integer 0..10000 or 'inactive'`
        );
    }
    if (!Number.isInteger(n)) {
        throw new Error(`parseRate: '${input}' is not an integer number of bps`);
    }
    if (n < 0 || n > 10000) {
        throw new Error(`parseRate: '${input}' must be between 0 and 10000 bps`);
    }
    return { active: true, rateBps: n };
};

/**
 * How to build the positional call args from operator-friendly input, and how
 * to describe the effect in plain words from those same positional args —
 * `meaning` is shared between `buildCall` (fed the args it just built) and
 * `decodeCall` (fed the args it just decoded off submitted calldata), so the
 * two can never drift apart.
 */
const CALL_DEFS = {
    setExitFeeEnabled: {
        build: ({ enabled }) => {
            if (typeof enabled !== "boolean") {
                throw new Error("setExitFeeEnabled: 'enabled' must be a boolean");
            }
            return [enabled];
        },
        meaning: ([enabled]) =>
            enabled
                ? "switches the Perimeter fee ON for every surface"
                : "switches the Perimeter fee OFF for every surface",
    },

    setFeeReceiver: {
        build: ({ address }) => [requireAddress(address, "setFeeReceiver: address")],
        meaning: ([address]) => `sends every collected Perimeter fee to ${address} from now on`,
    },

    setSurfacePolicy: {
        build: ({ surface, rate }) => [
            surfaceIdOf(surface),
            requireRate(rate, "setSurfacePolicy: rate"),
        ],
        meaning: ([id, rate]) => {
            const label = surfaceLabel(id);
            const active = rate[0];
            const rateBps = toNumber(rate[1]);
            if (!active) {
                return (
                    `turns the Perimeter fee off for the whole of ${label} — sub-product and ` +
                    "actor entries are ignored while the surface is inactive"
                );
            }
            return rateBps === 0
                ? `turns the Perimeter fee off for ${label} at the surface rate — sub-product ` +
                      "and actor entries can still charge their own rate"
                : `sets the default Perimeter fee on ${label} to ${rateBps} bps; sub-product ` +
                      "and actor entries can still override it";
        },
    },

    setSubProductPolicy: {
        build: ({ surface, subProduct, rate }) => [
            surfaceIdOf(surface),
            requireAddress(subProduct, "setSubProductPolicy: subProduct"),
            requireRate(rate, "setSubProductPolicy: rate"),
        ],
        meaning: ([id, subProduct, rate]) => {
            const label = surfaceLabel(id);
            const active = rate[0];
            const rateBps = toNumber(rate[1]);
            if (!active) {
                return `${subProduct} falls through to the surface rate on ${label} again`;
            }
            return rateBps === 0
                ? `${subProduct} pays no Perimeter fee on ${label}; every other pool on that ` +
                      "surface is unchanged"
                : `${subProduct} withdrawals pay ${rateBps} bps on ${label}; other pools keep ` +
                      "the surface rate";
        },
    },

    setActorPolicy: {
        build: ({ surface, actor, rate }) => [
            surfaceIdOf(surface),
            requireAddress(actor, "setActorPolicy: actor"),
            requireRate(rate, "setActorPolicy: rate"),
        ],
        meaning: ([id, actor, rate]) => {
            const label = surfaceLabel(id);
            const active = rate[0];
            const rateBps = toNumber(rate[1]);
            if (!active) {
                return `${actor} falls through to the sub-product or surface rate on ${label} again`;
            }
            return rateBps === 0
                ? `${actor} pays no Perimeter fee on ${label}; every other actor there is unchanged`
                : `${actor} pays ${rateBps} bps of Perimeter fee on ${label}, overriding the ` +
                      "surface and sub-product rate";
        },
    },

    removeSubProductPolicy: {
        build: ({ surface, subProduct }) => [
            surfaceIdOf(surface),
            requireAddress(subProduct, "removeSubProductPolicy: subProduct"),
        ],
        meaning: ([id, subProduct]) =>
            `removes ${subProduct}'s Perimeter fee entry on ${surfaceLabel(id)}; it falls back ` +
            "to the surface rate",
    },

    removeActorPolicy: {
        build: ({ surface, actor }) => [
            surfaceIdOf(surface),
            requireAddress(actor, "removeActorPolicy: actor"),
        ],
        meaning: ([id, actor]) =>
            `removes ${actor}'s Perimeter fee entry on ${surfaceLabel(id)}; it falls back to ` +
            "the sub-product or surface rate",
    },

    setActorBypass: {
        build: ({ surface, actor, bypass }) => [
            surfaceIdOf(surface),
            requireAddress(actor, "setActorBypass: actor"),
            requireBypass(bypass, "setActorBypass: bypass"),
        ],
        meaning: ([id, actor, bypass]) => {
            const label = surfaceLabel(id);
            const active = bypass[0];
            const doesBypass = bypass[1];
            if (!active) {
                return (
                    `clears ${actor}'s delay entry on ${label}; it falls back to the ` +
                    "sub-product or surface bypass"
                );
            }
            return doesBypass
                ? `${actor} is exempt from the withdrawal delay on ${label} — not held`
                : `${actor} is held under the withdrawal delay on ${label} even if a wider ` +
                      "bypass would otherwise apply";
        },
    },

    removeActorBypass: {
        build: ({ surface, actor }) => [
            surfaceIdOf(surface),
            requireAddress(actor, "removeActorBypass: actor"),
        ],
        meaning: ([id, actor]) =>
            `removes ${actor}'s delay entry on ${surfaceLabel(id)}; it falls back to the ` +
            "sub-product or surface bypass",
    },

    revokeExemption: {
        build: ({ surface, actor }) => [
            surfaceIdOf(surface),
            requireAddress(actor, "revokeExemption: actor"),
        ],
        meaning: ([id, actor]) =>
            `withdraws ${actor}'s exemption on ${surfaceLabel(id)}: charged at the surface rate ` +
            "again and held again even under a wider bypass",
    },
};

/** selector -> {kind, signature}, built once from the interface itself so the
 *  signature `buildCall` and `decodeCall` report is always the exact one the
 *  selector was computed from. */
const SETTER_SELECTORS = (() => {
    const iface = controllerInterface();
    const table = {};
    for (const kind of CALL_KINDS) {
        const fragment = iface.getFunction(kind);
        table[iface.getSighash(fragment)] = { kind, signature: fragment.format() };
    }
    return table;
})();

/** Build the calldata for one of the owner/admin setters above, plus a
 *  plain-words description of its effect. */
const buildCall = (kind, args) => {
    const def = CALL_DEFS[kind];
    if (!def) {
        throw new Error(
            `buildCall: unknown call kind '${kind}'. Expected one of: ${CALL_KINDS.join(", ")}`
        );
    }
    const positional = def.build(args || {});
    const data = controllerInterface().encodeFunctionData(kind, positional);
    const { signature } = SETTER_SELECTORS[data.slice(0, 10).toLowerCase()];
    return { signature, data, meaning: def.meaning(positional) };
};

/** Decode calldata into {signature, args, meaning}, or `undefined` when the
 *  selector is not one of the controller's policy setters — the paste guard
 *  `perimeter:policy:check-tx` uses before it will describe a transaction. */
const decodeCall = (data) => {
    if (typeof data !== "string" || !/^0x[0-9a-fA-F]{8,}$/.test(data)) {
        return undefined;
    }
    const selector = data.slice(0, 10).toLowerCase();
    const entry = SETTER_SELECTORS[selector];
    if (!entry) return undefined;
    const args = controllerInterface().decodeFunctionData(entry.kind, data);
    return { signature: entry.signature, args, meaning: CALL_DEFS[entry.kind].meaning(args) };
};

/** A short plain-words description of a fee entry at the given tier. */
const describeFeeEntry = (entry, tier) => {
    if (!entry || !entry.active) {
        return tier === "surface"
            ? "inactive — the Perimeter fee is off for this surface"
            : `inactive — falls through to the ${tier === "actor" ? "sub-product or surface" : "surface"}`;
    }
    return `active, ${toNumber(entry.rateBps)} bps`;
};

/** A short plain-words description of a delay-bypass entry at the given tier. */
const describeDelayEntry = (entry, tier) => {
    if (!entry || !entry.active) {
        return tier === "surface"
            ? "inactive — held by default on this surface"
            : `inactive — falls through to the ${tier === "actor" ? "sub-product or surface" : "surface"}`;
    }
    return entry.bypass ? "active, bypass — not held" : "active, no bypass — held";
};

/**
 * Decide which halves of an actor-tier exemption still need to be submitted.
 * `fee`/`bypass` are the entries currently on chain; `build` is "fee-only" or
 * "delay". The fee half is skipped once it already reads {true, 0}; the delay
 * half once it already reads {true, true}. Requesting the delay half (via
 * "delay" or "both") on the fee-only build throws — that half does not exist
 * there yet.
 */
const planExemption = ({ half = "both", fee, bypass, build } = {}) => {
    if (!["fee", "delay", "both"].includes(half)) {
        throw new Error(`planExemption: half must be 'fee', 'delay', or 'both', got '${half}'`);
    }
    if ((half === "delay" || half === "both") && build !== "delay") {
        throw new Error(
            "planExemption: the delay half does not exist on the fee-only build — submit it " +
                "after the controller upgrade"
        );
    }

    const calls = [];
    const alreadyDone = [];

    if (half === "fee" || half === "both") {
        if (fee && fee.active && toNumber(fee.rateBps) === 0) {
            alreadyDone.push("fee");
        } else {
            calls.push({
                half: "fee",
                kind: "setActorPolicy",
                rate: { active: true, rateBps: 0 },
            });
        }
    }

    if (half === "delay" || half === "both") {
        if (bypass && bypass.active && bypass.bypass === true) {
            alreadyDone.push("delay");
        } else {
            calls.push({
                half: "delay",
                kind: "setActorBypass",
                bypass: { active: true, bypass: true },
            });
        }
    }

    return { calls, alreadyDone };
};

/**
 * Decide the single call that withdraws an actor-tier exemption. On the delay
 * build that is `revokeExemption`, which resets both halves atomically; on
 * the fee-only build only the fee half exists, so it is `removeActorPolicy`
 * — its plan note says the delay half does not exist on this build. Skips
 * when the exemption is already withdrawn.
 */
const planRevoke = ({ build, fee, bypass } = {}) => {
    if (build === "delay") {
        const alreadyRevoked = Boolean(
            fee && !fee.active && bypass && bypass.active === true && bypass.bypass === false
        );
        if (alreadyRevoked) {
            return { calls: [], alreadyDone: ["fee", "delay"] };
        }
        return { calls: [{ kind: "revokeExemption" }], alreadyDone: [] };
    }
    if (build === "fee-only") {
        if (fee && !fee.active) {
            return { calls: [], alreadyDone: ["fee"] };
        }
        return {
            calls: [
                { kind: "removeActorPolicy", note: "the delay half does not exist on this build" },
            ],
            alreadyDone: [],
        };
    }
    throw new Error(`planRevoke: build must be 'fee-only' or 'delay', got '${build}'`);
};

module.exports = {
    SURFACES,
    SURFACES_WITHOUT_SUBPRODUCT,
    CALL_KINDS,
    resolveSurface,
    surfaceLabel,
    CONTROLLER_ABI,
    controllerInterface,
    buildFromCode,
    implementationFromSlot,
    parseRate,
    buildCall,
    decodeCall,
    describeFeeEntry,
    describeDelayEntry,
    planExemption,
    planRevoke,
};
