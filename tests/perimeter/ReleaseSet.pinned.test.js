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
const fs = require("fs");
const path = require("path");
const { runtimeBodyWithoutMetadata } = require("../../deployment/helpers/helpers");

const DEPLOYMENTS = path.join(__dirname, "../../deployment/deployments/rskSovrynMainnet");
const ARTIFACTS = path.join(__dirname, "../../artifacts/contracts");

/// Perimeter-bearing protocol modules. These carry the renamed slots, surface
/// ids or selectors, so their executable code really changed.
const MUST_SHIP = ["LoanClosingsRollover", "LoanClosingsWith", "LoanMaintenance", "ExitFeeModule"];

/// Protocol modules the rename touched only through an imported file. Their
/// runtime code is unchanged; only the metadata fingerprint moved.
const MUST_NOT_SHIP = [
    "Affiliates",
    "LoanClosingsLiquidation",
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

contract("Perimeter — pinned release set", () => {
    MUST_SHIP.forEach((name) => {
        it(`${name} differs from mainnet and must be in the release`, () => {
            const record = deployedRecord(name);
            const current = compiled(name);
            expect(
                body(current.deployedBytecode, null),
                `${name} matches mainnet — is it still a perimeter consumer?`
            ).to.not.equal(body(record.deployedBytecode, record.libraries));
        });
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
     * fresh copy would behave the same. It would also be unverifiable on
     * Blockscout, whose verifier does not mask the call-protection
     * self-address.
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
         * The two entries below are existing deployments that link an older
         * copy. They are listed so a NEW module linking a wrong copy still
         * fails here. Empty this list once those two are redeployed.
         */
        const KNOWN_UNRELINKED = {
            LoanClosingsRollover: "0xfe2bb2d345452673c4e90622147c4f515f2f4ce0",
            LoanMaintenance: "0xfe2bb2d345452673c4e90622147c4f515f2f4ce0",
        };

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
