/**
 * Perimeter — functional withdrawal-delay selection and original retention.
 *
 * Modules whose bytecode moved only in the metadata trailer stay OUT of the
 * release: their runtime code is byte-identical to what is already deployed, so
 * redeploying them costs gas and explorer verification for no behavioural
 * change, and adds proposal actions against a ten-per-proposal cap.
 *
 * Unchanged-code exclusions and explicit original-runtime retention are
 * different cases. Liquidation, rollover and maintenance views retain exact
 * original provenance and compatibility checks, not relabeled candidate code.
 */

const { expect } = require("chai");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { runtimeBodyWithoutMetadata } = require("../../deployment/helpers/helpers");
const { loadOriginalLiquidation } = require("../../deployment/helpers/liquidationRetention");
const {
    loadOriginalProtocolModule,
    MAINTENANCE_VIEW_SIGNATURES,
} = require("../../deployment/helpers/protocolRetention");
const { normalizedLayout, normType } = require("./utils/storageLayout");

const DEPLOYMENTS = path.join(__dirname, "../../deployment/deployments/rskSovrynMainnet");
const ARTIFACTS = path.join(__dirname, "../../artifacts/contracts");

/**
 * What mainnet runs, pinned.
 *
 * The comparison below needs the modules the protocol has REGISTERED, which a
 * deployment record does not give: a record says what was last deployed, so
 * deploying this release overwrites it and every shipping module then compares
 * equal to itself. The baseline is frozen instead, and each entry was verified
 * against the live code at its address. See the file's own note.
 */
const PRE_PERIMETER = require("./baselines/release-set.pre-perimeter-modules.json").modules;

/// Selected modules implement intended reachable fee/delay settlement or queue
/// wiring changes. Executable differences support artifact identity; they do
/// not establish upgrade necessity by themselves.
// The delay line adds the changed swap split module over the fee line (no
// pre-perimeter counterparts). Forced liquidation is a separately pinned original
// retention: an embedded helper/getter bytecode difference alone does not
// establish an intended functional upgrade.
const MUST_SHIP = ["LoanClosingsWith", "LoanMaintenance", "ExitFeeModule", "LoanClosingsWithSwap"];

/// Shipping modules with nothing on mainnet to differ from. Derived, never
/// hand-listed: a module that silently loses its baseline entry would otherwise
/// move itself out of the comparison and into this exemption.
const NEW_MODULES = MUST_SHIP.filter((name) => !PRE_PERIMETER[name]);

// Explicit functional-scope retention; the fresh source is NOT claimed byte-identical.
const MUST_RETAIN_ORIGINAL = [
    "LoanClosingsLiquidation",
    "LoanClosingsRollover",
    "LoanMaintenanceViews",
];

/// Protocol modules whose executable code is unchanged; only metadata moved.
const MUST_NOT_SHIP = [
    "Affiliates",
    "LoanOpenings",
    "LoanSettings",
    "ProtocolSettings",
    "SwapsExternal",
    "SwapsImplSovrynSwapModule",
];

const LINK_PLACEHOLDER = "L".repeat(40);

/**
 * The only library any of these modules is meant to link. Normalising link
 * addresses to a placeholder is what lets a fresh build be compared against a
 * deployed record, but done blindly it would also hide a swap to a different,
 * ABI-compatible library: same call sites, same normalised body. Asserting the
 * library's identity separately keeps the normalisation honest.
 */
const EXPECTED_LIBRARIES = ["SwapsImplSovrynSwapLib"];

/**
 * Runtime code with the two things that legitimately differ removed:
 * the CBOR metadata tail (covers comments and file paths) and linked library
 * addresses (the deployed record holds a real address where a fresh build holds
 * a `__$...$__` placeholder).
 */
/**
 * Runtime body, link addresses normalised, metadata stripped.
 *
 * The stripping itself comes from deployment/helpers — the same function the
 * deploy scripts use to decide whether a redeploy is needed. One definition, so
 * "this does not need redeploying" and "omitting it is safe" cannot answer
 * differently.
 */
const body = (hex, libraries) => {
    let s = hex.toLowerCase();
    if (libraries) {
        Object.values(libraries).forEach((addr) => {
            s = s.split(addr.toLowerCase().replace(/^0x/, "")).join(LINK_PLACEHOLDER);
        });
    }
    s = s.replace(/__\$[0-9a-f]{34}\$__/g, LINK_PLACEHOLDER);
    return runtimeBodyWithoutMetadata(s);
};

const hasRecord = (name) => fs.existsSync(path.join(DEPLOYMENTS, `${name}.json`));

const deployedRecord = (name) => {
    const p = path.join(DEPLOYMENTS, `${name}.json`);
    expect(fs.existsSync(p), `no mainnet record for ${name}`).to.be.true;
    return JSON.parse(fs.readFileSync(p, "utf8"));
};

const compiled = (name) => {
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const found = walk(p);
                if (found) return found;
            } else if (entry.name === `${name}.json`) {
                const d = JSON.parse(fs.readFileSync(p, "utf8"));
                if (d.contractName === name) return d;
            }
        }
        return null;
    };
    const artifact = walk(ARTIFACTS);
    expect(artifact, `no compiled artifact for ${name}`).to.not.be.null;
    return artifact;
};

const bodyHash = (hex, libraries) =>
    crypto.createHash("sha256").update(body(hex, libraries)).digest("hex");

contract("Perimeter — pinned release set", () => {
    MUST_SHIP.filter((name) => PRE_PERIMETER[name]).forEach((name) => {
        it(`${name} has a distinct artifact for its selected functional upgrade`, () => {
            const current = compiled(name);
            expect(
                bodyHash(current.deployedBytecode, null),
                `${name} matches the module mainnet has registered ` +
                    `(${PRE_PERIMETER[name].address}) — is it still a perimeter consumer?`
            ).to.not.equal(PRE_PERIMETER[name].bodySha256);
        });
    });

    /**
     * A new module has no rollback anchor, so there is nothing to differ from
     * and the comparison above cannot speak for it. Naming the exemption is
     * what keeps it from growing: a module that quietly lost its baseline entry
     * would fail here rather than exempt itself from the release set.
     */
    it("the shipping modules with no mainnet counterpart are the admin module and changed swap split", () => {
        // ExitFeeModule is the Phase-1 admin module; the changed swap split is
        // carved out of deployed modules and have no registered predecessor.
        expect(
            NEW_MODULES,
            `a shipping module has no entry in the pre-perimeter baseline, so nothing ` +
                `checks that it differs from what mainnet runs. Either it is genuinely ` +
                `new — add it here — or its baseline entry went missing and must be ` +
                `restored from the registered target on chain.`
        ).to.deep.equal(["ExitFeeModule", "LoanClosingsWithSwap"]);
        expect(deployedRecord("ExitFeeModule").address, "ExitFeeModule is not deployed").to.match(
            /^0x[0-9a-fA-F]{40}$/
        );
    });

    MUST_NOT_SHIP.forEach((name) => {
        it(`${name} is code-identical to mainnet and stays out`, () => {
            const record = deployedRecord(name);
            const current = compiled(name);
            expect(
                body(current.deployedBytecode, null),
                `${name} now differs in executable code, so omitting it is no longer ` +
                    `safe. Either the change belongs in this module — in which case it ` +
                    `joins the release and the action count needs rechecking against the ` +
                    `ten-per-proposal cap — or it was accidental and should be reverted.`
            ).to.equal(body(record.deployedBytecode, record.libraries));
        });
    });

    it("retained original liquidation keeps exact provenance, public ABI and protocol layout", async () => {
        const original = loadOriginalLiquidation();
        const current = compiled("LoanClosingsLiquidation");
        const publicLiquidate = (abi) =>
            abi.filter((x) => x.type === "function" && x.name === "liquidate");
        expect(publicLiquidate(current.abi)).to.deep.equal(publicLiquidate(original.record.abi));
        const oldLayout = original.record.storageLayout.storage
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
        expect(oldLayout.length).to.equal(63);
        expect(
            await normalizedLayout(
                "contracts/modules/LoanClosingsLiquidation.sol:LoanClosingsLiquidation"
            )
        ).to.deep.equal(oldLayout);
        // Different candidate bytes are explicit; old retention is not candidate installation.
        expect(current.deployedBytecode.toLowerCase()).to.not.equal(
            original.record.deployedBytecode.toLowerCase()
        );
    });

    for (const [name, originalName, functions] of [
        ["LoanClosingsRollover", "LoanClosingsRollover", ["rollover"]],
        [
            "LoanMaintenanceViews",
            "LoanMaintenance",
            MAINTENANCE_VIEW_SIGNATURES.map((s) => s.split("(")[0]),
        ],
    ])
        it(`${name} retains original interface, source behavior and State layout`, async () => {
            const original = loadOriginalProtocolModule(originalName);
            const current = compiled(name);
            // internalType includes the hosting contract's struct namespace;
            // type/components retain the complete encoded interface shape.
            const publicEntries = (abi) =>
                JSON.parse(
                    JSON.stringify(
                        abi.filter((e) => e.type === "function" && functions.includes(e.name)),
                        (key, value) => (key === "internalType" ? undefined : value)
                    )
                );
            expect(publicEntries(current.abi)).to.deep.equal(publicEntries(original.record.abi));
            const oldLayout = original.record.storageLayout.storage
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
            expect(oldLayout.length).to.equal(63);
            expect(await normalizedLayout(`contracts/modules/${name}.sol:${name}`)).to.deep.equal(
                oldLayout
            );
            for (const source of ["contracts/core/State.sol", "contracts/core/Objects.sol"]) {
                expect(fs.readFileSync(path.resolve(__dirname, "../..", source), "utf8")).to.equal(
                    original.input.sources[source].content
                );
            }
            const oldSource =
                original.input.sources[`contracts/modules/${originalName}.sol`].content;
            const newSource = fs.readFileSync(
                path.resolve(__dirname, `../../contracts/modules/${name}.sol`),
                "utf8"
            );
            if (name === "LoanClosingsRollover") expect(newSource).to.equal(oldSource);
            else {
                const extract = (text, name) => {
                    const start = text.search(new RegExp("function\\s+" + name + "\\s*\\("));
                    expect(start, name).to.be.gte(0);
                    const opening = text.indexOf("{", start);
                    let depth = 1,
                        end = opening + 1;
                    for (; depth > 0 && end < text.length; end++) {
                        if (text[end] === "{") depth++;
                        else if (text[end] === "}") depth--;
                    }
                    return text
                        .slice(start, end)
                        .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")
                        .replace(/\s+/g, "");
                };
                for (const fn of [...functions, "_getLoan", "_getLoanV2"])
                    expect(extract(newSource, fn), fn).to.equal(extract(oldSource, fn));
            }
        });

    // A module with no mainnet record yet (the split modules) has no declared
    // link to check; its linking is proven at deploy time instead.
    MUST_NOT_SHIP.concat(MUST_SHIP, MUST_RETAIN_ORIGINAL)
        .filter((name) => hasRecord(name))
        .forEach((name) => {
            it(`${name} links only the expected library`, () => {
                const record = deployedRecord(name);
                const linked = Object.keys(record.libraries || {});
                const unexpected = linked.filter((l) => !EXPECTED_LIBRARIES.includes(l));
                expect(
                    unexpected,
                    `${name} links a library this comparison does not know about, so ` +
                        `normalising its address away could hide a real change`
                ).to.deep.equal([]);
            });
        });

    /**
     * The swaps library is linked, not redeployed.
     *
     * Its runtime body is byte-identical to the deployed one — only the
     * metadata trailer moved, because an imported interface changed — so a
     * fresh copy would behave the same and buy nothing.
     *
     * The linked copy is the one deployed 2026-08-13 and verified on
     * Blockscout 2026-08-16 as a FULL match. An earlier copy, live since
     * March, is verified only as a partial match; the release links the fully
     * verified one deliberately, because a voter rebuilding a module's
     * bytecode should land on source the explorer vouches for exactly.
     *
     * If the library's executable code ever does change, this fails and the
     * link-don't-deploy decision has to be revisited.
     */
    it("the swaps library is unchanged on chain and must be linked, not redeployed", () => {
        const record = deployedRecord("SwapsImplSovrynSwapLib");
        const built = require(
            `../../artifacts/contracts/swaps/connectors/SwapsImplSovrynSwapLib.sol/SwapsImplSovrynSwapLib.json`
        );
        const onChain = record.deployedBytecode || record.bytecode;

        expect(
            body(onChain.toLowerCase()),
            "the swaps library's executable code changed, so the relink decision no " +
                "longer holds and it has to be redeployed and re-verified after all"
        ).to.equal(body(built.deployedBytecode.toLowerCase()));

        /**
         * Consumers must link the verified library, not another copy of it.
         *
         * A consumer verifies against its declared link address whether or not
         * the library at that address is itself verified, so linking an
         * unverified copy is silently accepted by the explorer and leaves an
         * unverifiable contract in the release's dependency graph.
         *
         * The list is empty, and that is the release's position: every shipping
         * module links the verified copy. It stays here because an exemption
         * that has to be written down is one a reviewer can argue with, whereas
         * a missing mechanism is one nobody sees.
         */
        const KNOWN_UNRELINKED = {};

        const wrong = [];
        MUST_SHIP.filter((name) => hasRecord(name)).forEach((name) => {
            const linked = (deployedRecord(name).libraries || {}).SwapsImplSovrynSwapLib;
            if (!linked) return;
            const addr = linked.toLowerCase();
            if (addr === record.address.toLowerCase()) return;
            if (KNOWN_UNRELINKED[name] === addr) return;
            wrong.push(`${name} links ${addr}`);
        });
        expect(
            wrong,
            `these link a library copy that is neither the verified one nor a ` +
                `listed exception. Link ${record.address} — it is the verified ` +
                `copy, and the only one that should be in the release.`
        ).to.deep.equal([]);
    });

    it("replacement, unchanged-code and original-retention classifications do not overlap", () => {
        const classified = MUST_SHIP.concat(MUST_NOT_SHIP, MUST_RETAIN_ORIGINAL);
        expect(
            new Set(classified).size,
            "each protocol module has exactly one disposition"
        ).to.equal(classified.length);
    });

    /**
     * Bound to the deployment's own module list, not to a copy of it.
     *
     * Without this the two lists above are just prose: a module could be added
     * to or removed from `getProtocolModules()` -- which is what the deploy
     * scripts iterate and what 2080 proposes replacements from -- and this file
     * would stay green while saying nothing about it.
     */
    it("every protocol module the deployment knows about is classified here", () => {
        const { getProtocolModules } = require("../../deployment/helpers/helpers");
        const deployed = Object.values(getProtocolModules()).map((m) => m.moduleName);
        const classified = MUST_SHIP.concat(MUST_NOT_SHIP, MUST_RETAIN_ORIGINAL);

        const unclassified = deployed.filter((m) => !classified.includes(m));
        expect(
            unclassified,
            `these modules are deployed by 2070 and proposed by 2080 but this test ` +
                `says nothing about whether they belong in the release. Add each to ` +
                `MUST_SHIP, MUST_NOT_SHIP or MUST_RETAIN_ORIGINAL after verifying its intended behavior and identity.`
        ).to.deep.equal([]);

        const phantom = classified.filter((m) => !deployed.includes(m));
        expect(
            phantom,
            `these are classified here but are not protocol modules any more, so the ` +
                `classification is stale`
        ).to.deep.equal([]);
    });
});
