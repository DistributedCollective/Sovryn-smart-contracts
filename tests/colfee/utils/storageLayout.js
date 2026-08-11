// Shared helper for the storage-layout zero-diff regression guard.
//
// Extracts a NORMALIZED storage layout for a fully-qualified contract from the
// hardhat build-info (solc `storageLayout` output, enabled in hardhat.config.js
// for 0.5.17). Normalization strips the solc AST node-id suffixes that follow a
// `)` in type strings (e.g. `t_struct(LoanParams)1234_storage` →
// `t_struct(LoanParams)_storage`) — those numeric ids shift with the
// compilation set and are NOT a storage-layout change.

const hre = require("hardhat");

// Strip `)<digits>` id suffixes wherever they appear in a solc type string.
const normType = (t) => (typeof t === "string" ? t.replace(/\)[0-9]+/g, ")") : t);

// Return a stable, comparable array of {label, slot, offset, type} for the
// contract's declared state variables. Throws (never silently empties) if the
// layout is missing/empty — an empty layout compared to an empty layout is a
// silent false PASS, which would make this guard useless.
async function normalizedLayout(fqName) {
    const bi = await hre.artifacts.getBuildInfo(fqName);
    if (!bi) throw new Error(`no build-info for ${fqName} (compile with storageLayout enabled)`);
    const [source, name] = fqName.split(":");
    const artifact = bi.output.contracts[source] && bi.output.contracts[source][name];
    if (!artifact) throw new Error(`contract ${fqName} not found in its build-info output`);
    const layout = artifact.storageLayout;
    if (!layout || !Array.isArray(layout.storage)) {
        throw new Error(`no storageLayout for ${fqName} — is "storageLayout" in outputSelection?`);
    }
    if (layout.storage.length === 0) {
        throw new Error(
            `${fqName} storageLayout has ZERO entries — refusing to treat as zero-diff (silent false pass)`
        );
    }
    return layout.storage
        .map((s) => ({
            label: s.label,
            slot: String(s.slot),
            offset: s.offset,
            type: normType(s.type),
        }))
        .sort(
            (a, b) =>
                Number(a.slot) - Number(b.slot) ||
                a.offset - b.offset ||
                a.label.localeCompare(b.label)
        );
}

// Resolve a target's baseline array out of the grouped baseline file. Throws on
// an unknown target or a group that is missing/empty — same anti-false-pass rule
// as normalizedLayout: a baseline that silently resolves to `undefined` or `[]`
// would turn every assertion below it into a no-op.
function baselineFor(baseline, fqName) {
    const group = baseline.targets && baseline.targets[fqName];
    if (!group) throw new Error(`baseline has no target entry for ${fqName}`);
    const layout = baseline.layouts && baseline.layouts[group];
    if (!Array.isArray(layout)) {
        throw new Error(`baseline group "${group}" (for ${fqName}) is missing or not an array`);
    }
    if (layout.length === 0) {
        throw new Error(
            `baseline group "${group}" (for ${fqName}) is EMPTY — refusing to compare (silent false pass)`
        );
    }
    return layout;
}

module.exports = { normalizedLayout, normType, baselineFor };
