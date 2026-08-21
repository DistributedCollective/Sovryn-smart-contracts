/**
 * Perimeter — the Phase-1 release set is pinned, and the omissions are justified.
 *
 * DECISION (Tyrone, 2026-08-21): the modules whose bytecode moved only in the
 * metadata tail STAY OUT of the release.
 *
 * That decision does not enforce itself. `getProtocolModules()` returns every
 * protocol module, hardhat-deploy redeploys any whose bytecode differs from its
 * recorded deployment, and 2080 proposes a `replaceContract` for each new
 * address. Renaming the perimeter identifiers changed the metadata hash of seven
 * modules that carry no perimeter code at all, so left alone the machinery would
 * quietly grow the release by seven contracts — past the ten-action cap that
 * forced Phase 1 into three proposals in the first place.
 *
 * This test is the guard. It compares each module's runtime body — metadata
 * stripped, library links normalised — against what is deployed on RSK mainnet,
 * and asserts:
 *
 *   - every module in the release set genuinely differs, so it has to ship;
 *   - every module left out is byte-identical in its executable code, so leaving
 *     it out changes nothing on chain.
 *
 * If a future change puts real code into one of the omitted modules, the second
 * assertion fails and the omission has to be revisited. That is the point.
 *
 * Run:
 *   npx hardhat test tests/perimeter/ReleaseSet.pinned.test.js
 */

const { expect } = require("chai");
const fs = require("fs");
const path = require("path");

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
const body = (hex, libraries) => {
    let s = hex.startsWith("0x") ? hex.slice(2) : hex;
    for (const address of Object.values(libraries || {})) {
        const bare = address.slice(2);
        s = s.split(bare.toLowerCase()).join(LINK_PLACEHOLDER);
        s = s.split(bare.toUpperCase()).join(LINK_PLACEHOLDER);
    }
    s = s.replace(/__\$[0-9a-fA-F]{34}\$__/g, LINK_PLACEHOLDER);
    const declared = parseInt(s.slice(-4), 16);
    if (Number.isFinite(declared)) {
        const cut = (declared + 2) * 2;
        if (cut > 0 && cut <= s.length) {
            s = s.slice(0, -cut);
        }
    }
    return s;
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
