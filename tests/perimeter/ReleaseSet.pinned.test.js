/**
 * Perimeter — the Phase-1 release set is pinned, and the omissions are justified.
 *
 * Modules whose bytecode moved only in the metadata trailer stay OUT of the
 * release: their runtime code is byte-identical to what is already deployed, so
 * redeploying them costs gas and explorer verification for no behavioural
 * change, and adds proposal actions against a ten-per-proposal cap.
 *
 * This file is what makes that safe. If one of the omitted modules ever gains
 * real code, the comparison below fails rather than letting it be left out
 * silently.
 */

const { expect } = require("chai");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { runtimeBodyWithoutMetadata } = require("../../deployment/helpers/helpers");

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

/// Perimeter-bearing protocol modules. These carry the renamed slots, surface
/// ids or selectors, so their executable code really changed.
// The delay line adds three shipping modules over the fee line: the two split
// modules carved out of deployed ones (no pre-perimeter counterpart) and the
// liquidation module, which keeps its direct uncharged payout but compiles
// against the reshaped shared close base, so its body now differs from what
// mainnet runs.
const MUST_SHIP = [
    "LoanClosingsRollover",
    "LoanClosingsWith",
    "LoanMaintenance",
    "ExitFeeModule",
    "LoanClosingsLiquidation",
    "LoanClosingsWithSwap",
    "LoanMaintenanceViews",
];

/// Shipping modules with nothing on mainnet to differ from. Derived, never
/// hand-listed: a module that silently loses its baseline entry would otherwise
/// move itself out of the comparison and into this exemption.
const NEW_MODULES = MUST_SHIP.filter((name) => !PRE_PERIMETER[name]);

/// Protocol modules the rename touched only through an imported file. Their
/// runtime code is unchanged; only the metadata fingerprint moved.
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
        it(`${name} differs from what mainnet runs and must be in the release`, () => {
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
    it("the shipping modules with no mainnet counterpart are the new module and the two splits", () => {
        // ExitFeeModule is the Phase-1 admin module; the two split modules are
        // carved out of deployed modules and have no registered predecessor.
        expect(
            NEW_MODULES,
            `a shipping module has no entry in the pre-perimeter baseline, so nothing ` +
                `checks that it differs from what mainnet runs. Either it is genuinely ` +
                `new — add it here — or its baseline entry went missing and must be ` +
                `restored from the registered target on chain.`
        ).to.deep.equal(["ExitFeeModule", "LoanClosingsWithSwap", "LoanMaintenanceViews"]);
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

    MUST_NOT_SHIP.concat(MUST_SHIP).forEach((name) => {
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
        MUST_SHIP.forEach((name) => {
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

    it("the two lists do not overlap", () => {
        const overlap = MUST_SHIP.filter((m) => MUST_NOT_SHIP.includes(m));
        expect(overlap, "a module cannot both ship and stay out").to.deep.equal([]);
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
        const classified = MUST_SHIP.concat(MUST_NOT_SHIP);

        const unclassified = deployed.filter((m) => !classified.includes(m));
        expect(
            unclassified,
            `these modules are deployed by 2070 and proposed by 2080 but this test ` +
                `says nothing about whether they belong in the release. Add each to ` +
                `MUST_SHIP or MUST_NOT_SHIP after checking its body against mainnet.`
        ).to.deep.equal([]);

        const phantom = classified.filter((m) => !deployed.includes(m));
        expect(
            phantom,
            `these are classified here but are not protocol modules any more, so the ` +
                `classification is stale`
        ).to.deep.equal([]);
    });
});
