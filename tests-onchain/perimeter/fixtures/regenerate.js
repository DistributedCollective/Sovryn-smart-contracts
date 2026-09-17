#!/usr/bin/env node
/**
 * Regenerate the externally-built Perimeter rehearsal fixtures from the
 * build artifacts of their source repos (runbook P11: fixtures must be
 * rebuilt at the frozen commits and their _provenance updated).
 *
 * Build first, then run:
 *   perimeter repo:  forge build                       (out/<C>.sol/<C>.json)
 *   Zero repo:    __decryptionAlreadyDone__=TRUE npx hardhat compile --force
 *                                        (artifacts/contracts/.../<C>.json)
 *
 *   node tests-onchain/perimeter/fixtures/regenerate.js \
 *       --perimeter /path/to/perimeter --zero /path/to/zero-contracts
 *
 * Both paths are REQUIRED (no defaults — a default is a path nobody chose).
 *
 * To regenerate one repo's fixtures and leave every fixture of the other repo
 * byte-for-byte as committed, name that repo with --only. The named repo's path
 * is then the only one required, and the other repo's path is refused, so a run
 * can never look as if it covered a repo it skipped:
 *
 *   node tests-onchain/perimeter/fixtures/regenerate.js \
 *       --perimeter /path/to/perimeter --only perimeter
 *
 * --only selects a whole repo, never single fixtures: every fixture built from
 * one repo is rewritten together, so they always name the same commit.
 *
 * abi + bytecode + _provenance {branch, commit} are refreshed from each
 * repo's checkout; contractName, note and the rest of _provenance are
 * preserved from the committed fixture. The script refuses a dirty source
 * checkout: provenance must name a commit that fully describes the bytes.
 * Every check runs before the first fixture is written, so a refusal leaves
 * the committed fixtures untouched.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const USAGE = [
    "usage: regenerate.js --perimeter <path> --zero <path>",
    "       regenerate.js --perimeter <path> --only perimeter",
    "       regenerate.js --zero <path> --only zero",
].join("\n");

const refuse = (message) => {
    console.error(`error: ${message}`);
    console.error(USAGE);
    process.exit(1);
};

const args = process.argv.slice(2);
/** The value that follows `flag`, or null when the flag is absent. */
const argValue = (flag) => {
    const i = args.indexOf(flag);
    if (i === -1) return null;
    if (i + 1 >= args.length || args[i + 1].startsWith("--")) refuse(`${flag} needs a value`);
    return args[i + 1];
};

const REPOS = ["perimeter", "zero"];
const only = argValue("--only");
if (only !== null && !REPOS.includes(only)) {
    refuse(`--only takes one of ${REPOS.join(", ")}, not ${JSON.stringify(only)}`);
}
const selected = only === null ? REPOS : [only];

const roots = {};
for (const repo of REPOS) {
    const root = argValue(`--${repo}`);
    if (selected.includes(repo)) {
        if (root === null) refuse(`--${repo} is required`);
        roots[repo] = root;
    } else if (root !== null) {
        refuse(`--${repo} was given, but --only ${only} leaves that repo's fixtures untouched`);
    }
}

const git = (repo, ...a) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8" }).trim();

/** The branch a checkout is on; for a detached checkout, the branch whose tip
 *  is that commit (there has to be exactly one for the provenance to be
 *  unambiguous). */
const branchOf = (repo) => {
    const current = git(repo, "branch", "--show-current");
    if (current) return current;
    const atHead = git(repo, "branch", "--points-at", "HEAD", "--format=%(refname:short)")
        .split("\n")
        // A detached worktree lists itself as "(no branch)" or "(HEAD detached …)".
        .filter((name) => name && !name.startsWith("("));
    if (atHead.length !== 1) {
        console.error(
            `error: ${repo} is detached and ${atHead.length} branches point at its HEAD ` +
                `(${atHead.join(", ") || "none"}); check out the branch the fixtures come from`
        );
        process.exit(1);
    }
    return atHead[0];
};

for (const repo of selected) {
    const root = roots[repo];
    // Untracked files are fine (build output); modified tracked sources are not.
    const dirty = git(root, "status", "--porcelain")
        .split("\n")
        .filter((l) => l && !l.startsWith("??"));
    if (dirty.length > 0) {
        console.error(`error: ${repo} checkout at ${root} has uncommitted changes:`);
        console.error(dirty.join("\n"));
        console.error("commit or stash first -- fixture provenance must name a real commit");
        process.exit(1);
    }
}

const FIXTURES = [
    // [fixture file, artifact path relative to its repo root, repo]
    ["ExitFeeController.json", "out/ExitFeeController.sol/ExitFeeController.json", "perimeter"],
    ["ExitFeeVault.json", "out/ExitFeeVault.sol/ExitFeeVault.json", "perimeter"],
    ["ExitDelayQueue.json", "out/ExitDelayQueue.sol/ExitDelayQueue.json", "perimeter"],
    ["ERC1967Proxy.json", "out/ERC1967Proxy.sol/ERC1967Proxy.json", "perimeter"],
    [
        "BorrowerOperationsPerimeter.json",
        "artifacts/contracts/BorrowerOperations.sol/BorrowerOperations.json",
        "zero",
    ],
    [
        "CollSurplusPoolPerimeter.json",
        "artifacts/contracts/CollSurplusPool.sol/CollSurplusPool.json",
        "zero",
    ],
    [
        "BorrowerOperationsPerimeterOps.json",
        "artifacts/contracts/Dependencies/BorrowerOperationsPerimeterOps.sol/BorrowerOperationsPerimeterOps.json",
        "zero",
    ],
    [
        "PriceFeedTestnet.json",
        "artifacts/contracts/TestContracts/PriceFeedTestnet.sol/PriceFeedTestnet.json",
        "zero",
    ],
    [
        "TroveManagerLiquidationFix.json",
        "artifacts/contracts/TroveManager.sol/TroveManager.json",
        "zero",
    ],
];

// One provenance per repo, resolved before anything is written: a detached
// checkout without exactly one branch at its HEAD is refused here.
const provenance = {};
for (const repo of selected) {
    provenance[repo] = {
        branch: branchOf(roots[repo]),
        commit: git(roots[repo], "rev-parse", "--short", "HEAD"),
    };
}

const updates = FIXTURES.filter(([, , repo]) => selected.includes(repo)).map(
    ([fixtureFile, artifactRel, repo]) => {
        const fixturePath = path.join(__dirname, fixtureFile);
        const artifactPath = path.join(roots[repo], artifactRel);
        const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

        // Foundry artifacts nest creation bytecode at .bytecode.object; hardhat
        // artifacts carry it directly at .bytecode.
        const bytecode =
            typeof artifact.bytecode === "string" ? artifact.bytecode : artifact.bytecode.object;
        if (!/^0x[0-9a-f]+$/i.test(bytecode)) {
            console.error(`error: no usable creation bytecode in ${artifactPath}`);
            process.exit(1);
        }

        const before = JSON.stringify({ a: fixture.abi, b: fixture.bytecode });
        fixture.abi = artifact.abi;
        fixture.bytecode = bytecode;
        fixture._provenance.branch = provenance[repo].branch;
        fixture._provenance.commit = provenance[repo].commit;
        const after = JSON.stringify({ a: fixture.abi, b: fixture.bytecode });
        return { fixtureFile, fixturePath, fixture, newBytes: before !== after };
    }
);

// Every selected fixture has been read and checked; only now is any written.
let changed = 0;
for (const { fixtureFile, fixturePath, fixture, newBytes } of updates) {
    fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 4) + "\n");
    if (newBytes) changed++;
    const delta = newBytes ? "abi/bytecode CHANGED" : "provenance only";
    console.log(`${fixtureFile}: ${delta} (commit ${fixture._provenance.commit})`);
}
const untouched = FIXTURES.length - updates.length;
console.log(
    `done: ${updates.length} fixtures written, ${changed} with new bytes` +
        (untouched > 0 ? `, ${untouched} of the other repo left untouched` : "")
);
