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
const { execFileSync } = require("child_process");

const DIR = path.join(__dirname, "fixtures");

/// solc splits a stored string across 32-byte words, so only the first 32
/// characters are guaranteed contiguous in the bytecode. That is more than
/// enough to tell the phases apart.
const probe = (s) => Buffer.from(s.slice(0, 32), "utf8").toString("hex");

const bytecodeOf = (file) => {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
    return { hex: (d.bytecode || "").toLowerCase(), provenance: d._provenance || {} };
};

/// Whether a fixture's provenance block is well-formed enough to trust: a
/// non-empty repo name, and a commit that is a plausible hex abbreviation
/// (7-40 hex characters — this repo's own established convention is 7, and
/// git's practical floor for an unambiguous one). `expect(x).to.be.a("string")`
/// alone accepts an empty string, which then satisfies `"anything".startsWith("")`
/// against ANY head — that gap is exactly what this closes.
const isValidProvenance = (provenance) =>
    Boolean(
        provenance &&
            typeof provenance.repo === "string" &&
            provenance.repo.length > 0 &&
            typeof provenance.commit === "string" &&
            /^[0-9a-f]{7,40}$/i.test(provenance.commit)
    );

/// A fixture whose source repo is not on disk is UNVERIFIED, not presumed
/// fresh: freshness fails closed the moment even one fixture cannot be
/// checked, not only once every fixture is unchecked (the previous gate).
const hasUnverifiedFixtures = (unchecked) => unchecked.length > 0;

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
            expect(
                isValidProvenance(provenance),
                `${file}'s provenance is missing repo, or commit is not a plausible hex commit ` +
                    "abbreviation (7-40 hex characters)"
            ).to.be.true;
        });
    });

    /**
     * The marker checks above only catch a fixture built before the rename.
     * They do NOT catch one built after the rename but before a later change --
     * which is exactly what happened when the controller fixture was pinned to
     * a commit that was itself reverted an hour later. Nothing in its bytes
     * looked wrong; it was simply built from source that no longer exists.
     *
     * The only honest freshness test is whether the fixture names the tip of
     * the branch it was built from, in the source repo on disk. The branch is
     * read from the fixture's own provenance rather than from whatever that
     * repo happens to have checked out, so an unrelated branch in the sibling
     * checkout does not turn this red. It skips loudly rather than passing
     * quietly when the repo is absent.
     */
    it("every fixture names the tip of its source branch", () => {
        // The source repos are checked out beside this repository's main
        // checkout. A linked worktree of this repository can sit anywhere, so
        // their location comes from the git directory all of its checkouts
        // share, not from the path of this file.
        const commonGitDir = execFileSync(
            "git",
            ["-C", __dirname, "rev-parse", "--path-format=absolute", "--git-common-dir"],
            { encoding: "utf8" }
        ).trim();
        const reposDir = path.dirname(path.dirname(commonGitDir));
        const roots = {
            "zero-contracts": path.join(reposDir, "zero-contracts"),
            perimeter: path.join(reposDir, "Sovryn-perimeter"),
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
            const git = (...args) =>
                execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
            // The branch the fixture was built from, when the repo still has
            // it; a branch deleted after merging leaves only the checkout.
            const branchRef = provenance.branch && `refs/heads/${provenance.branch}`;
            let hasRef = false;
            try {
                if (branchRef) git("show-ref", "--verify", "--quiet", branchRef);
                hasRef = Boolean(branchRef);
            } catch (error) {
                hasRef = false;
            }
            const ref = hasRef ? branchRef : "HEAD";
            const head = git("rev-parse", ref);
            // Prefix match against the resolved full head: provenance.commit
            // is this repo's established 7-character abbreviation, not a
            // full hash, so exact string equality would refuse every
            // genuinely fresh fixture. What made startsWith unsound was
            // never the prefix comparison itself - it was that an empty
            // provenance.commit satisfies it trivially; the length/format
            // check above closes exactly that gap, so the same comparison
            // is sound again once its input cannot be empty.
            if (!head.startsWith(provenance.commit.toLowerCase())) {
                stale.push(
                    `${file}: pinned ${provenance.commit}, ${provenance.repo} ${ref} is at ` +
                        head.slice(0, 7)
                );
            }
        });

        // A fixture whose source repo is unavailable on disk is UNVERIFIED,
        // not presumed fresh — this used to fail only when every fixture was
        // unchecked, so one repository being present let every fixture
        // pointing at an absent repository go completely unverified while
        // the suite still reported green.
        if (hasUnverifiedFixtures(unchecked)) {
            expect.fail(
                `fixture freshness could not be verified for: ${unchecked.join(", ")} — the ` +
                    "source repo is not on disk. Check it out beside this repository, or the " +
                    "fixtures it built cannot be trusted as current."
            );
        }
        expect(
            stale,
            `fixtures were built from a commit their source repo has moved past. Rebuild ` +
                `each stale repo (perimeter: \`forge build\`; zero-contracts: ` +
                `\`__decryptionAlreadyDone__=TRUE npx hardhat compile --force\`), then run ` +
                `\`node tests-onchain/perimeter/fixtures/regenerate.js --perimeter <path> ` +
                `--zero <path>\` (or add \`--only perimeter\` / \`--only zero\` to refresh one ` +
                `repo's fixtures alone) from this repo's root. Never edit a fixture's ` +
                `_provenance fields by hand.`
        ).to.deep.equal([]);
    });
});

/**
 * Regression for CON-R2-5, isolated from the real fixtures and the sibling
 * repos on disk so it cannot depend on their live state: three confirmed
 * gaps let a fixture pass "freshness" entirely unverified. (1) the
 * provenance check only required `repo`/`commit` to be strings, so an empty
 * string passed; (2) the freshness comparison used
 * `head.startsWith(provenance.commit)`, which an empty `provenance.commit`
 * trivially satisfies against any head; (3) a fixture whose source repo was
 * not checked out was pushed onto an `unchecked` list, and the only
 * assertion consulting that list failed solely when EVERY fixture was
 * unchecked — one present repository let every fixture pointing at an
 * absent one go completely unverified while the suite still reported green.
 */
describe("Perimeter — fixture provenance validation", () => {
    it("accepts this repo's own established provenance shape", () => {
        expect(isValidProvenance({ repo: "perimeter", commit: "442b9fc" })).to.be.true;
    });

    it("accepts a full 40-character hash too", () => {
        expect(isValidProvenance({ repo: "perimeter", commit: "a".repeat(40) })).to.be.true;
    });

    it("rejects an empty commit - the exact gap that made startsWith('') trivially pass", () => {
        expect(isValidProvenance({ repo: "perimeter", commit: "" })).to.be.false;
    });

    it("rejects an empty repo", () => {
        expect(isValidProvenance({ repo: "", commit: "442b9fc" })).to.be.false;
    });

    it("rejects a missing commit field entirely", () => {
        expect(isValidProvenance({ repo: "perimeter" })).to.be.false;
    });

    it("rejects a commit that is not hex", () => {
        expect(isValidProvenance({ repo: "perimeter", commit: "not-a-hash" })).to.be.false;
    });

    it("rejects a commit shorter than a plausible abbreviation", () => {
        expect(isValidProvenance({ repo: "perimeter", commit: "abc" })).to.be.false;
    });

    it("rejects a missing provenance block", () => {
        expect(isValidProvenance(undefined)).to.be.false;
        expect(isValidProvenance({})).to.be.false;
    });
});

describe("Perimeter — fixture freshness fails closed on an unverifiable fixture", () => {
    it("flags a single unchecked fixture among otherwise-verified ones", () => {
        // The exact control-flow gap this replaces:
        // `if (unchecked.length === files.length)` only fired when NOTHING
        // could be verified — one checked-and-fresh fixture let any number
        // of unchecked ones through silently.
        expect(hasUnverifiedFixtures(["StaleRepoFixture.json (perimeter not on disk)"])).to.be
            .true;
    });

    it("flags every fixture unchecked too", () => {
        expect(
            hasUnverifiedFixtures([
                "A.json (perimeter not on disk)",
                "B.json (zero-contracts not on disk)",
            ])
        ).to.be.true;
    });

    it("says nothing is unverified when the unchecked list is empty", () => {
        expect(hasUnverifiedFixtures([])).to.be.false;
    });
});
