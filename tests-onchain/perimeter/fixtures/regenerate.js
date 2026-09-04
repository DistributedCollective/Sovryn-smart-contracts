#!/usr/bin/env node
/**
 * Regenerate the eight externally-built Perimeter rehearsal fixtures from the
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
 * abi + bytecode + _provenance {branch, commit} are refreshed from each
 * repo's checkout; contractName, note and the rest of _provenance are
 * preserved from the committed fixture. The script refuses a dirty source
 * checkout: provenance must name a commit that fully describes the bytes.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const args = process.argv.slice(2);
const argValue = (flag) => {
    const i = args.indexOf(flag);
    if (i === -1 || i + 1 >= args.length) {
        console.error(`usage: regenerate.js --perimeter <path> --zero <path>`);
        process.exit(1);
    }
    return args[i + 1];
};
const perimeterRoot = argValue("--perimeter");
const zeroRoot = argValue("--zero");

const git = (repo, ...a) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8" }).trim();

for (const [name, repo] of [
    ["perimeter", perimeterRoot],
    ["zero", zeroRoot],
]) {
    // Untracked files are fine (build output); modified tracked sources are not.
    const dirty = git(repo, "status", "--porcelain")
        .split("\n")
        .filter((l) => l && !l.startsWith("??"));
    if (dirty.length > 0) {
        console.error(`error: ${name} checkout at ${repo} has uncommitted changes:`);
        console.error(dirty.join("\n"));
        console.error("commit or stash first -- fixture provenance must name a real commit");
        process.exit(1);
    }
}

const FIXTURES = [
    // [fixture file, artifact path relative to its repo root, repo root]
    ["ExitFeeController.json", "out/ExitFeeController.sol/ExitFeeController.json", perimeterRoot],
    ["ExitFeeVault.json", "out/ExitFeeVault.sol/ExitFeeVault.json", perimeterRoot],
    ["ExitDelayQueue.json", "out/ExitDelayQueue.sol/ExitDelayQueue.json", perimeterRoot],
    ["ERC1967Proxy.json", "out/ERC1967Proxy.sol/ERC1967Proxy.json", perimeterRoot],
    [
        "BorrowerOperationsPerimeter.json",
        "artifacts/contracts/BorrowerOperations.sol/BorrowerOperations.json",
        zeroRoot,
    ],
    [
        "CollSurplusPoolPerimeter.json",
        "artifacts/contracts/CollSurplusPool.sol/CollSurplusPool.json",
        zeroRoot,
    ],
    [
        "BorrowerOperationsPerimeterOps.json",
        "artifacts/contracts/Dependencies/BorrowerOperationsPerimeterOps.sol/BorrowerOperationsPerimeterOps.json",
        zeroRoot,
    ],
    [
        "PriceFeedTestnet.json",
        "artifacts/contracts/TestContracts/PriceFeedTestnet.sol/PriceFeedTestnet.json",
        zeroRoot,
    ],
];

let changed = 0;
for (const [fixtureFile, artifactRel, repoRoot] of FIXTURES) {
    const fixturePath = path.join(__dirname, fixtureFile);
    const artifactPath = path.join(repoRoot, artifactRel);
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
    fixture._provenance.branch = git(repoRoot, "branch", "--show-current");
    fixture._provenance.commit = git(repoRoot, "rev-parse", "--short", "HEAD");

    fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 4) + "\n");
    const after = JSON.stringify({ a: fixture.abi, b: fixture.bytecode });
    const delta = before === after ? "provenance only" : "abi/bytecode CHANGED";
    if (before !== after) changed++;
    console.log(`${fixtureFile}: ${delta} (commit ${fixture._provenance.commit})`);
}
console.log(`done: 8 fixtures written, ${changed} with new bytes`);
