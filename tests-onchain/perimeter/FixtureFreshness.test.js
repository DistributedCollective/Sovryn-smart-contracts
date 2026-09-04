/**
 * The rehearsal fixtures carry the identifiers the release actually uses.
 *
 * The fork rehearsal deploys externally-built contracts from committed
 * fixtures. A stale fixture is the worst kind of test failure, because it does
 * not fail: the rehearsal configures the controller with the current surface
 * ids, the stale contract quotes the old ones, no policy resolves, and the
 * fail-open perimeter reports that as "no fee". The gate whose whole purpose is
 * to prove the fee is charged would be exercising the wrong contract.
 *
 * The identifiers are read straight out of the fixture bytecode, which works
 * because solc 0.5.17 and 0.6.11 do not fold `keccak256` of a string literal —
 * the preimage is stored in the contract and hashed at run time.
 *
 * Run:
 *   npx hardhat test tests-onchain/perimeter/FixtureFreshness.test.js
 */

const { expect } = require("chai");
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "fixtures");

/// solc splits a stored string across 32-byte words, so only the first 32
/// characters are guaranteed contiguous in the bytecode. That is more than
/// enough to tell the phases apart.
const probe = (s) => Buffer.from(s.slice(0, 32), "utf8").toString("hex");

const bytecodeOf = (file) => {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
    return { hex: (d.bytecode || "").toLowerCase(), provenance: d._provenance || {} };
};

/// Any surviving Phase-1 preimage means the fixture predates the re-cut.
const STALE_MARKERS = [
    "COLFEE:SURFACE_LENDING_LENDER_WITHDRAW",
    "COLFEE:SURFACE_LENDING_BORROWER_WITHDRAW",
    "COLFEE:SURFACE_ZERO_WITHDRAW_COLL",
    "COLFEE:SURFACE_ZERO_CLAIM_SURPLUS",
    "sovryn.exitFeeController",
    "sovryn.colFeeBorrowerExitOps",
];

/// The surplus claim is settled by the delegatecall companion rather than by
/// BorrowerOperations itself, so the surface it quotes is embedded in the
/// companion's bytecode; BorrowerOperations keeps the collateral-withdrawal
/// surface and the controller slot.
const REQUIRED = {
    "BorrowerOperationsPerimeter.json": [
        "PERIMETER_SURFACE_ZERO_WITHDRAW_COLL",
        "sovryn.perimeterExitFeeController",
    ],
    "BorrowerOperationsPerimeterOps.json": ["PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS"],
};

contract("Perimeter — rehearsal fixtures are current", () => {
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));

    it("there are fixtures to check", () => {
        expect(files.length, "no fixtures found").to.be.greaterThan(0);
    });

    files.forEach((file) => {
        it(`${file} carries no Phase-1 identifier`, () => {
            const { hex } = bytecodeOf(file);
            const found = STALE_MARKERS.filter((m) => hex.includes(probe(m)));
            expect(
                found,
                `${file} still embeds a pre-re-cut preimage, so it was built before ` +
                    `the rename. Rebuild its source repo and re-run ` +
                    `tests-onchain/perimeter/fixtures/regenerate.js.`
            ).to.deep.equal([]);
        });
    });

    Object.entries(REQUIRED).forEach(([file, names]) => {
        names.forEach((name) => {
            it(`${file} embeds ${name}`, () => {
                const { hex } = bytecodeOf(file);
                expect(
                    hex.includes(probe(name)),
                    `${file} does not embed ${name}. Either it is stale, or the ` +
                        `contract stopped quoting that surface — both matter.`
                ).to.be.true;
            });
        });
    });

    it("every fixture records where its bytes came from", () => {
        files.forEach((file) => {
            const { provenance } = bytecodeOf(file);
            expect(provenance.repo, `${file} has no provenance repo`).to.be.a("string");
            expect(provenance.commit, `${file} has no provenance commit`).to.be.a("string");
        });
    });

    /**
     * The marker checks above only catch a fixture built before the rename.
     * They do NOT catch one built after the rename but before a later change --
     * which is exactly what happened when the controller fixture was pinned to
     * a commit that was itself reverted an hour later. Nothing in its bytes
     * looked wrong; it was simply built from source that no longer exists.
     *
     * The only honest freshness test is whether the fixture names the commit
     * its source repo is actually on. That needs the source repo on disk, so
     * this skips loudly rather than passing quietly when it is absent.
     */
    it("every fixture names its source repo's current commit", () => {
        const roots = {
            "zero-contracts": path.join(__dirname, "../../../zero-contracts"),
            perimeter: path.join(__dirname, "../../../Sovryn-perimeter"),
        };

        const stale = [];
        const unchecked = [];

        files.forEach((file) => {
            const { provenance } = bytecodeOf(file);
            const root = roots[provenance.repo];
            if (!root || !fs.existsSync(path.join(root, ".git"))) {
                unchecked.push(`${file} (${provenance.repo} not on disk)`);
                return;
            }
            const head = require("child_process")
                .execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" })
                .trim();
            if (!head.startsWith(provenance.commit)) {
                stale.push(
                    `${file}: pinned ${provenance.commit}, ${provenance.repo} is at ${head.slice(0, 7)}`
                );
            }
        });

        if (unchecked.length === files.length) {
            expect.fail(
                `no source repo was available, so fixture freshness was not ` +
                    `verified at all: ${unchecked.join(", ")}`
            );
        }
        expect(
            stale,
            `fixtures were built from a commit their source repo has moved past. ` +
                `Rebuild the source and re-run fixtures/regenerate.js.`
        ).to.deep.equal([]);
    });
});
