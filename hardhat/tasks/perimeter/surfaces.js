/**
 * Surface identifiers, their plain-words phrases, and the small argument-
 * display helpers shared by `policy.js` and `recovery.js`.
 *
 * Split out on its own so `recovery.js` can read these without requiring
 * `policy.js` back: `policy.js` requires `recovery.js` (so `decodeCall` can
 * decode the recovery family too), and `recovery.js` requiring `policy.js`
 * in turn would complete a require cycle — whichever of the two loads
 * second would see the other's `module.exports` still empty. Neither file
 * requires this one back, so there is nothing left to cycle through.
 *
 * No hardhat runtime and no I/O here, same as `policy.js` and `recovery.js`.
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

const NAME_BY_ID = Object.freeze(
    Object.fromEntries(Object.entries(SURFACES).map(([name, id]) => [id.toLowerCase(), name]))
);

/** "lender withdrawals" for a known surface id, or "surface <id>" for one
 *  this module does not name. */
const surfaceLabel = (id) => {
    const name = NAME_BY_ID[String(id).toLowerCase()];
    return name ? SURFACE_PHRASES[name] : `surface ${id}`;
};

/** Render a decoded arg for display: tuples as "(a, b)", everything else via
 *  its own string form (works for addresses, hex ids, bools and BigNumbers
 *  alike, and a bytes32 already decodes as its own hex string — this never
 *  interprets one, it only prints it). */
const stringifyArg = (value) => {
    if (Array.isArray(value)) {
        return `(${value.map(stringifyArg).join(", ")})`;
    }
    if (value && typeof value === "object" && typeof value.toString === "function") {
        return value.toString();
    }
    return String(value);
};

/** Every argument a decoded call's own function fragment declares, name and
 *  type paired with its value already rendered for display — what an
 *  operator needs to see exactly what a call targets (which addresses, which
 *  request ids, which flag, which hash) before submitting or confirming it,
 *  not just which selector it carries. */
const describeArgs = (fragment, args) =>
    fragment.inputs.map((input, i) => ({
        name: input.name || `arg${i}`,
        type: input.type,
        value: stringifyArg(args[i]),
    }));

module.exports = {
    SURFACES,
    SURFACE_PHRASES,
    surfaceLabel,
    stringifyArg,
    describeArgs,
};
