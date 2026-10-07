const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const { execFileSync, spawnSync } = require("child_process");
const ethers = require("ethers");
const Module = require("module");

const DIR = __dirname;
const sha = (data) => crypto.createHash("sha256").update(data).digest("hex");
const FILES = [
    ["ExitFeeController", "ExitFeeController", "perimeter", "src/ExitFeeController.sol"],
    ["ExitFeeVault", "ExitFeeVault", "perimeter", "src/ExitFeeVault.sol"],
    ["ExitDelayQueue", "ExitDelayQueue", "perimeter", "src/ExitDelayQueue.sol"],
    [
        "ERC1967Proxy",
        "ERC1967Proxy",
        "perimeter",
        "lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol",
    ],
    [
        "BorrowerOperationsPerimeter",
        "BorrowerOperations",
        "zero",
        "contracts/BorrowerOperations.sol",
    ],
    ["CollSurplusPoolPerimeter", "CollSurplusPool", "zero", "contracts/CollSurplusPool.sol"],
    [
        "BorrowerOperationsPerimeterOps",
        "BorrowerOperationsPerimeterOps",
        "zero",
        "contracts/Dependencies/BorrowerOperationsPerimeterOps.sol",
    ],
    [
        "PriceFeedTestnet",
        "PriceFeedTestnet",
        "zero",
        "contracts/TestContracts/PriceFeedTestnet.sol",
    ],
    ["TroveManagerLiquidationFix", "TroveManager", "zero", "contracts/TroveManager.sol"],
];
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), "perimeter-fixture-unit-"));
const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    TZ: "UTC",
};
const git = (root, ...args) =>
    execFileSync("git", ["-C", root, ...args], { env, encoding: "utf8" }).trim();
const write = (file, value) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
};

function setup(label) {
    const base = path.join(TEMP, label);
    const generator = path.join(base, "generator");
    fs.mkdirSync(generator, { recursive: true });
    fs.symlinkSync(
        path.resolve(DIR, "../../../node_modules"),
        path.join(generator, "node_modules"),
        "dir"
    );
    for (const name of ["regenerate.js", "artifactProvenance.js", "loader.js"]) {
        if (fs.existsSync(path.join(DIR, name)))
            fs.copyFileSync(path.join(DIR, name), path.join(generator, name));
    }
    const roots = {},
        artifacts = {},
        builds = {},
        records = [],
        checks = [];
    for (const repo of ["perimeter", "zero"]) {
        const root = (roots[repo] = path.join(base, repo));
        artifacts[repo] = path.join(root, repo === "perimeter" ? "out" : "artifacts");
        fs.mkdirSync(root, { recursive: true });
        git(root, "init", "-q", "-b", "fixture");
        const input = {
            language: "Solidity",
            sources: {},
            settings: { optimizer: { enabled: true, runs: 200 } },
        };
        const contracts = {};
        for (const [filename, name, family, source] of FILES.filter((f) => f[2] === repo)) {
            const content = `pragma solidity 0.8.20; contract ${name} {}`;
            write(path.join(root, source), content);
            input.sources[source] = { content };
            const metadata = {
                compiler: { version: "0.8.20+commit.test" },
                sources: { [source]: { keccak256: ethers.utils.keccak256(Buffer.from(content)) } },
                settings: {
                    optimizer: input.settings.optimizer,
                    evmVersion: "shanghai",
                    metadata: { bytecodeHash: "ipfs" },
                    compilationTarget: { [source]: name },
                },
            };
            const abi = [{ type: "event", name: "FixtureSelected", inputs: [], anonymous: false }];
            const output = {
                abi,
                metadata: JSON.stringify(metadata),
                evm: {
                    bytecode: { object: "6000", linkReferences: {} },
                    deployedBytecode: {
                        object: "6001",
                        linkReferences: {},
                        immutableReferences: ["BorrowerOperations", "TroveManager"].includes(name)
                            ? { 1: [{ start: 0, length: 1 }] }
                            : {},
                    },
                },
            };
            contracts[source] = { [name]: output };
            const artifact =
                repo === "perimeter"
                    ? {
                          abi,
                          bytecode: { object: "0x6000", linkReferences: {} },
                          deployedBytecode: {
                              object: "0x6001",
                              linkReferences: {},
                              immutableReferences: {},
                          },
                          rawMetadata: output.metadata,
                          metadata,
                      }
                    : {
                          contractName: name,
                          sourceName: source,
                          abi,
                          bytecode: "0x6000",
                          deployedBytecode: "0x6001",
                          linkReferences: {},
                          deployedLinkReferences: {},
                      };
            const relative =
                repo === "perimeter" ? `${name}.sol/${name}.json` : `${source}/${name}.json`;
            const artifactFile = path.join(artifacts[repo], relative);
            write(artifactFile, artifact);
            records.push({
                filename: `${filename}.json`,
                name,
                repo: repo === "perimeter" ? "core" : "zero",
                artifactFile,
                artifactSha256: sha(fs.readFileSync(artifactFile)),
            });
            write(path.join(generator, `${filename}.json`), {
                contractName: name,
                abi: [],
                bytecode: "0x6002",
                _provenance: { repo, branch: "fixture", commit: "1234567" },
            });
        }
        git(root, "add", ...Object.keys(input.sources));
        git(
            root,
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "-c",
            "commit.gpgsign=false",
            "commit",
            "-qm",
            "Fixture source"
        );
        const pin = git(root, "rev-parse", "HEAD");
        const build = {
            solcVersion: "0.8.20",
            solcLongVersion: "0.8.20+commit.test",
            input,
            output: { contracts },
        };
        const buildInfoFile = path.join(artifacts[repo], "build-info/full.json");
        write(buildInfoFile, build);
        builds[repo] = buildInfoFile;
        const check = {
            name: repo === "perimeter" ? "core" : "zero",
            buildInfoFile,
            buildInfoSha256: sha(fs.readFileSync(buildInfoFile)),
            inputSha256: sha(JSON.stringify(input)),
            sources: Object.entries(input.sources).map(([source, value]) => ({
                source,
                sha256: sha(value.content),
            })),
        };
        checks.push(check);
        for (const entry of records.filter((e) => e.repo === check.name)) {
            entry.sourceCommit = pin;
            entry.sourceProof = check.buildInfoSha256;
            entry.sourceInputSha256 = check.inputSha256;
            if (repo === "zero")
                write(entry.artifactFile.replace(/\.json$/, ".dbg.json"), {
                    buildInfo: path.relative(path.dirname(entry.artifactFile), buildInfoFile),
                });
        }
    }
    const manifest = path.join(base, "MANIFEST.json");
    write(manifest, {
        pins: {
            core: git(roots.perimeter, "rev-parse", "HEAD"),
            zero: git(roots.zero, "rev-parse", "HEAD"),
        },
        roots: Object.entries(roots).map(([name, canonical]) => ({
            name: name === "perimeter" ? "core" : name,
            canonical,
        })),
        fixtures: records,
        sourceChecks: checks,
    });
    return { base, generator, roots, artifacts, builds, records, manifest };
}

function run(s, extra = []) {
    return spawnSync(
        process.execPath,
        [
            path.join(s.generator, "regenerate.js"),
            "--perimeter",
            s.roots.perimeter,
            "--zero",
            s.roots.zero,
            ...extra,
        ],
        { env, encoding: "utf8" }
    );
}

function reseal(s, repo) {
    const manifest = JSON.parse(fs.readFileSync(s.manifest));
    const check = manifest.sourceChecks.find(
        (c) => c.name === (repo === "perimeter" ? "core" : "zero")
    );
    const build = JSON.parse(fs.readFileSync(s.builds[repo]));
    check.buildInfoSha256 = sha(fs.readFileSync(s.builds[repo]));
    check.inputSha256 = sha(JSON.stringify(build.input));
    check.sources = Object.entries(build.input.sources).map(([source, value]) => ({
        source,
        sha256: sha(value.content),
    }));
    for (const record of manifest.fixtures.filter((r) => r.repo === check.name)) {
        record.sourceProof = check.buildInfoSha256;
        record.sourceInputSha256 = check.inputSha256;
        record.artifactSha256 = sha(fs.readFileSync(record.artifactFile));
    }
    write(s.manifest, manifest);
}

test("independent artifact roots and exact source pins generate loadable external output", () => {
    const s = setup("independent");
    const output = path.join(s.base, "selected");
    const manifest = JSON.parse(fs.readFileSync(s.manifest));
    for (const repo of ["perimeter", "zero"]) {
        const old = s.artifacts[repo];
        const next = path.join(s.base, `${repo}-build`);
        fs.renameSync(old, next);
        s.artifacts[repo] = next;
        for (const record of manifest.fixtures)
            if (record.artifactFile.startsWith(old + path.sep))
                record.artifactFile = record.artifactFile.replace(old, next);
        for (const check of manifest.sourceChecks)
            if (check.buildInfoFile.startsWith(old + path.sep))
                check.buildInfoFile = check.buildInfoFile.replace(old, next);
    }
    write(s.manifest, manifest);
    const result = run(s, [
        "--output",
        output,
        "--perimeter-artifacts",
        s.artifacts.perimeter,
        "--zero-artifacts",
        s.artifacts.zero,
        "--perimeter-commit",
        manifest.pins.core,
        "--zero-commit",
        manifest.pins.zero,
        "--provenance",
        s.manifest,
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(bindings(output).stack.bytecode, "0x6000");
    assert.equal(
        JSON.parse(fs.readFileSync(path.join(output, "ExitFeeController.json")))._provenance
            .commit,
        manifest.pins.core
    );
});

test("default artifact and output paths remain in the copied fixture directory", () => {
    const s = setup("defaults");
    const result = run(s);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
        JSON.parse(fs.readFileSync(path.join(s.generator, "ExitDelayQueue.json"))).bytecode,
        "0x6000"
    );
    assert.equal(
        fs.existsSync(path.join(s.generator, "ExitDelayQueue.artifact.json")),
        false,
        "default mode must not add raw artifacts to committed fixtures"
    );
});

test("resealed stale compiler source still refuses against the canonical Git pin", () => {
    const s = setup("resealed-source");
    const output = path.join(s.base, "selected");
    const b = JSON.parse(fs.readFileSync(s.builds.zero));
    b.input.sources["contracts/TroveManager.sol"].content += "\n// different source";
    write(s.builds.zero, b);
    reseal(s, "zero");
    const result = run(s, ["--output", output, "--provenance", s.manifest]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /differs from source pin/);
    assert.equal(fs.existsSync(output), false);
});

test("resealed artifact substitution still refuses against compiler output", () => {
    const s = setup("resealed-artifact");
    const output = path.join(s.base, "selected");
    const file = s.records[8].artifactFile;
    const artifact = JSON.parse(fs.readFileSync(file));
    artifact.bytecode = "0x6003";
    write(file, artifact);
    reseal(s, "zero");
    const result = run(s, ["--output", output, "--provenance", s.manifest]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not match compiler output/);
    assert.equal(fs.existsSync(output), false);
});

test("missing compiler inputs, altered settings and incomplete source seals refuse before writing", () => {
    for (const issue of ["inputs", "settings", "seal"]) {
        const s = setup(`invalid-${issue}`);
        const output = path.join(s.base, "selected");
        const b = JSON.parse(fs.readFileSync(s.builds.zero));
        if (issue === "inputs") delete b.input.sources;
        if (issue === "settings") b.input.settings.optimizer.runs = 99;
        if (issue !== "seal") {
            write(s.builds.zero, b);
            if (issue === "settings") reseal(s, "zero");
        } else {
            const m = JSON.parse(fs.readFileSync(s.manifest));
            m.sourceChecks[1].sources.pop();
            write(s.manifest, m);
        }
        const result = run(s, ["--output", output, "--provenance", s.manifest]);
        assert.notEqual(result.status, 0, issue);
        assert.equal(fs.existsSync(output), false, issue);
    }
});

test("resealed settings omissions, metadata policies and compiler identities refuse before writing", () => {
    for (const issue of [
        "optimizer",
        "settings",
        "evmVersion",
        "remappings",
        "libraries",
        "metadata",
        "literal",
        "cbor",
        "short-version",
        "empty-version",
        "long-version",
    ]) {
        const s = setup(`omitted-${issue}`);
        const output = path.join(s.base, "selected");
        const b = JSON.parse(fs.readFileSync(s.builds.zero));
        if (issue === "optimizer") delete b.input.settings.optimizer;
        if (issue === "settings") delete b.input.settings;
        if (issue === "metadata") b.input.settings.metadata = { bytecodeHash: "none" };
        if (issue === "literal") b.input.settings.metadata = { useLiteralContent: true };
        if (issue === "cbor") b.input.settings.metadata = { appendCBOR: false };
        if (issue === "short-version") b.solcVersion = "0.8.2";
        if (issue === "empty-version") b.solcVersion = "";
        if (issue === "long-version") b.solcLongVersion = "0.8.20+commit.other";
        if (["evmVersion", "remappings", "libraries"].includes(issue)) {
            for (const contracts of Object.values(b.output.contracts)) {
                for (const compiled of Object.values(contracts)) {
                    const metadata = JSON.parse(compiled.metadata);
                    metadata.settings[issue] = {
                        evmVersion: "paris",
                        remappings: [":lib/=vendor/"],
                        libraries: { "contracts/Library.sol": { L: "0x" + "12".repeat(20) } },
                    }[issue];
                    compiled.metadata = JSON.stringify(metadata);
                }
            }
        }
        write(s.builds.zero, b);
        reseal(s, "zero");
        const result = run(s, ["--output", output, "--provenance", s.manifest]);
        assert.notEqual(result.status, 0, issue);
        assert.match(
            result.stderr,
            /compiler settings mismatch|metadata policy|compiler version|compilation language\/version/,
            issue
        );
        assert.equal(fs.existsSync(output), false, issue);
    }
});

test("late hardlink outputs refuse without modifying any existing destination", () => {
    const s = setup("hardlinks");
    const output = path.join(s.base, "selected");
    fs.mkdirSync(output);
    const victim = path.join(s.base, "victim");
    write(victim, "preserve victim");
    const earlier = path.join(output, "ExitFeeController.json");
    write(earlier, "preserve earlier");
    const late = path.join(output, "TroveManagerLiquidationFix.json");
    fs.linkSync(victim, late);
    const result = run(s, ["--output", output, "--provenance", s.manifest]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /output destination refused/);
    assert.equal(fs.readFileSync(victim, "utf8"), "preserve victim");
    assert.equal(fs.readFileSync(earlier, "utf8"), "preserve earlier");
    fs.unlinkSync(late);
    assert.equal(run(s, ["--output", output, "--provenance", s.manifest]).status, 0);
});

test("sealed dependency paths cannot escape the source checkout", () => {
    const s = setup("escaped-source");
    const output = path.join(s.base, "selected");
    const b = JSON.parse(fs.readFileSync(s.builds.zero));
    const source = "@scope/dependency/Escaped.sol";
    const content = "pragma solidity 0.8.20; contract Escaped {}";
    const outside = path.join(s.base, "unrelated");
    write(path.join(outside, "Escaped.sol"), content);
    fs.mkdirSync(path.join(s.roots.zero, "node_modules/@scope"), { recursive: true });
    const link = path.join(s.roots.zero, "node_modules/@scope/dependency");
    fs.symlinkSync(outside, link);
    b.input.sources[source] = { content };
    write(s.builds.zero, b);
    reseal(s, "zero");
    const result = run(s, ["--output", output, "--provenance", s.manifest]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /outside selected directory/);
    assert.equal(fs.existsSync(output), false);
    fs.unlinkSync(link);
    write(path.join(link, "Escaped.sol"), content);
    assert.equal(run(s, ["--output", output, "--provenance", s.manifest]).status, 0);
});

test("wrong full source pins and duplicate or conflicting CLI flags refuse", () => {
    const s = setup("flags");
    const output = path.join(s.base, "selected");
    for (const extra of [
        ["--zero-commit", "1234567"],
        ["--zero-commit", "a".repeat(40)],
        ["--output", output, "--output", output],
        ["--only", "perimeter"],
        ["--unknown", "value"],
    ]) {
        const result = run(s, ["--provenance", s.manifest, ...extra]);
        assert.notEqual(result.status, 0);
        assert.equal(fs.existsSync(output), false);
    }
});

test("late output symlinks refuse before earlier destinations are changed", () => {
    const s = setup("output-links");
    const output = path.join(s.base, "selected");
    fs.mkdirSync(output);
    const victim = path.join(s.base, "victim");
    write(victim, "preserve victim");
    write(path.join(output, "ExitFeeController.json"), "preserve earlier output");
    fs.symlinkSync(victim, path.join(output, "TroveManagerLiquidationFix.json"));
    const result = run(s, ["--output", output, "--provenance", s.manifest]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /output destination refused/);
    assert.equal(fs.readFileSync(victim, "utf8"), "preserve victim");
    assert.equal(
        fs.readFileSync(path.join(output, "ExitFeeController.json"), "utf8"),
        "preserve earlier output"
    );
    fs.unlinkSync(path.join(output, "TroveManagerLiquidationFix.json"));
    assert.equal(run(s, ["--output", output, "--provenance", s.manifest]).status, 0);
    const alias = path.join(s.base, "output-alias");
    fs.symlinkSync(output, alias);
    assert.notEqual(run(s, ["--output", alias, "--provenance", s.manifest]).status, 0);
});

test("a missing committed source cannot be downgraded to a sealed dependency", () => {
    const s = setup("missing-owned");
    const output = path.join(s.base, "selected");
    const b = JSON.parse(fs.readFileSync(s.builds.zero));
    const content = "pragma solidity 0.8.20; contract Untracked {}";
    b.input.sources["contracts/Untracked.sol"] = { content };
    write(path.join(s.roots.zero, "node_modules/contracts/Untracked.sol"), content);
    write(s.builds.zero, b);
    reseal(s, "zero");
    const result = run(s, ["--output", output, "--provenance", s.manifest]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /owned or Gitlink compiler source missing/);
    assert.equal(fs.existsSync(output), false);
});

test("mixed full source pins within one external family refuse", () => {
    const s = setup("mixed");
    const dir = packet(s);
    const file = path.join(dir, "ExitFeeVault.json");
    const old = fs.readFileSync(file);
    const fixture = JSON.parse(old);
    fixture._provenance.commit = "a".repeat(40);
    write(file, fixture);
    assert.throws(() => bindings(dir), /mixes perimeter source pins/);
    fs.writeFileSync(file, old);
    assert.equal(bindings(dir).stack.bytecode, "0x6000");
});

test("only mode preserves the other fixture family and refuses ambiguous native proofs", () => {
    const s = setup("only");
    const output = path.join(s.base, "selected");
    const result = spawnSync(
        process.execPath,
        [
            path.join(s.generator, "regenerate.js"),
            "--perimeter",
            s.roots.perimeter,
            "--only",
            "perimeter",
            "--output",
            output,
        ],
        { env, encoding: "utf8" }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(output, "ExitDelayQueue.json")), true);
    assert.equal(fs.existsSync(path.join(output, "TroveManagerLiquidationFix.json")), false);
    fs.copyFileSync(
        s.builds.perimeter,
        path.join(s.artifacts.perimeter, "build-info/duplicate.json")
    );
    const refused = spawnSync(
        process.execPath,
        [
            path.join(s.generator, "regenerate.js"),
            "--perimeter",
            s.roots.perimeter,
            "--only",
            "perimeter",
            "--output",
            path.join(s.base, "absent"),
        ],
        { env, encoding: "utf8" }
    );
    assert.notEqual(refused.status, 0);
    assert.equal(fs.existsSync(path.join(s.base, "absent")), false);
});

test(
    "supplied sealed packet is consumed by both helper and stack",
    { skip: !process.env.PERIMETER_TEST_PACKET },
    () => {
        const directory = fs.realpathSync(process.env.PERIMETER_TEST_PACKET);
        const result = bindings(directory);
        const fixtures = Object.values(result.helper);
        assert.equal(fixtures.length, 9);
        for (const fixture of fixtures) {
            const file = FILES.find((f) => f[1] === fixture.contractName)[0] + ".json";
            assert.deepEqual(fixture, JSON.parse(fs.readFileSync(path.join(directory, file))));
        }
        assert.strictEqual(result.stack, result.helper.queueFixture);
    }
);

function packet(s) {
    const dir = path.join(s.base, "packet");
    const manifest = JSON.parse(fs.readFileSync(s.manifest));
    for (const entry of manifest.fixtures) {
        const raw = fs.readFileSync(entry.artifactFile);
        const artifact = JSON.parse(raw);
        const code =
            typeof artifact.bytecode === "string" ? artifact.bytecode : artifact.bytecode.object;
        const runtime =
            typeof artifact.deployedBytecode === "string"
                ? artifact.deployedBytecode
                : artifact.deployedBytecode.object;
        const build = JSON.parse(
            fs.readFileSync(s.builds[entry.repo === "core" ? "perimeter" : "zero"])
        );
        const source = FILES.find((f) => f[0] + ".json" === entry.filename)[3];
        write(path.join(dir, entry.filename), {
            contractName: entry.name,
            abi: artifact.abi,
            bytecode: code,
            deployedBytecode: runtime,
            linkReferences: {},
            deployedLinkReferences: {},
            immutableReferences:
                build.output.contracts[source][entry.name].evm.deployedBytecode
                    .immutableReferences,
            _provenance: {
                repo: entry.repo,
                commit: entry.sourceCommit,
                artifactSha256: sha(raw),
                inputSha256: entry.sourceInputSha256,
            },
        });
        write(path.join(dir, entry.filename.replace(/\.json$/, ".artifact.json")), raw.toString());
    }
    write(path.join(dir, "MANIFEST.json"), manifest);
    return dir;
}

test("missing raw Hardhat immutable slots require exact compiler proof and reject tampered fixture slots", () => {
    const s = setup("immutable-binding");
    const directory = packet(s);
    const manifest = path.join(directory, "MANIFEST.json");
    const originalManifest = fs.readFileSync(manifest);
    for (const filename of [
        "BorrowerOperationsPerimeter.json",
        "TroveManagerLiquidationFix.json",
    ]) {
        const file = path.join(directory, filename);
        const original = fs.readFileSync(file);
        const rawFile = file.replace(/\.json$/, ".artifact.json");
        const originalRaw = fs.readFileSync(rawFile);
        const fixture = JSON.parse(original);
        const raw = JSON.parse(fs.readFileSync(file.replace(/\.json$/, ".artifact.json")));
        assert.equal(raw.immutableReferences, undefined);
        assert.equal(Object.keys(fixture.immutableReferences).length, 1);
        fixture.immutableReferences["1"][0].start = 1;
        write(file, fixture);
        assert.throws(() => bindings(directory), /immutableReferences/);
        fixture.immutableReferences = {};
        write(file, fixture);
        assert.throws(() => bindings(directory), /immutableReferences/);
        fs.writeFileSync(file, original);
        raw.immutableReferences = {};
        write(rawFile, raw);
        const forgedFixture = JSON.parse(original);
        forgedFixture.immutableReferences = {};
        forgedFixture._provenance.artifactSha256 = sha(fs.readFileSync(rawFile));
        write(file, forgedFixture);
        assert.throws(() => bindings(directory), /compiler proof fixture binding mismatch/);
        fs.writeFileSync(rawFile, originalRaw);
        fs.writeFileSync(file, original);
        assert.deepEqual(
            bindings(directory).helper[
                filename.startsWith("Borrower")
                    ? "borrowerOperationsFixture"
                    : "troveManagerFixture"
            ],
            JSON.parse(original)
        );
    }
    fs.unlinkSync(manifest);
    fs.unlinkSync(s.manifest);
    assert.throws(() => bindings(directory), /compiler proof manifest/);
    fs.writeFileSync(manifest, originalManifest);
    assert.equal(bindings(directory).stack.bytecode, "0x6000");
    const b = JSON.parse(fs.readFileSync(s.builds.zero));
    b.input.sources["contracts/TroveManager.sol"].content += "\n// stale";
    write(s.builds.zero, b);
    const altered = JSON.parse(originalManifest);
    const check = altered.sourceChecks.find((c) => c.name === "zero");
    check.buildInfoSha256 = sha(fs.readFileSync(s.builds.zero));
    check.inputSha256 = sha(JSON.stringify(b.input));
    check.sources = Object.entries(b.input.sources).map(([source, value]) => ({
        source,
        sha256: sha(value.content),
    }));
    for (const record of altered.fixtures.filter((f) => f.repo === "zero")) {
        record.sourceProof = check.buildInfoSha256;
        record.sourceInputSha256 = check.inputSha256;
        const file = path.join(directory, record.filename);
        const fixture = JSON.parse(fs.readFileSync(file));
        fixture._provenance.inputSha256 = check.inputSha256;
        write(file, fixture);
    }
    write(manifest, altered);
    assert.throws(() => bindings(directory), /differs from source pin/);
});

test("Solc omitted false metadata and missing Hardhat immutable maps preserve exact output", () => {
    const s = setup("schema-defaults");
    const output = path.join(s.base, "selected");
    const build = JSON.parse(fs.readFileSync(s.builds.perimeter));
    build.input.settings.viaIR = false;
    write(s.builds.perimeter, build);
    reseal(s, "perimeter");
    const command = ["--output", output, "--provenance", s.manifest];
    assert.equal(run(s, command).status, 0);
    for (const filename of [
        "BorrowerOperationsPerimeter.json",
        "TroveManagerLiquidationFix.json",
    ]) {
        const fixture = JSON.parse(fs.readFileSync(path.join(output, filename)));
        assert.deepEqual(fixture.immutableReferences, { 1: [{ start: 0, length: 1 }] });
        const original = s.records.find((r) => r.filename === filename);
        assert.equal(
            sha(fs.readFileSync(path.join(output, filename.replace(/\.json$/, ".artifact.json")))),
            original.artifactSha256
        );
    }
    const utility = path.join(s.generator, "artifactProvenance.js");
    const originalUtility = fs.readFileSync(utility, "utf8");
    for (const mutant of [
        originalUtility.replace(
            'if (key === "viaIR") return value ?? false;',
            'if (key === "viaIR") return value;'
        ),
        originalUtility.replace(
            "if (immutables !== undefined) data.immutableReferences = immutables;",
            "data.immutableReferences = immutables || {};"
        ),
    ]) {
        assert.notEqual(mutant, originalUtility);
        write(utility, mutant);
        const failed = run(s, command);
        assert.notEqual(failed.status, 0);
        assert.match(
            failed.stderr,
            /compiler settings mismatch: viaIR|artifact does not match compiler output/
        );
    }
    write(utility, originalUtility);
    assert.equal(run(s, command).status, 0);
    build.input.settings.viaIR = true;
    write(s.builds.perimeter, build);
    reseal(s, "perimeter");
    const refused = run(s, ["--output", path.join(s.base, "refused"), "--provenance", s.manifest]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /compiler settings mismatch: viaIR/);
    assert.equal(fs.existsSync(path.join(s.base, "refused")), false);
});

test("sequential only-family outputs preserve the other family and remain proof-loadable", () => {
    const s = setup("only-proof-merge");
    const output = path.join(s.base, "selected");
    const runFamily = (repo) =>
        spawnSync(
            process.execPath,
            [
                path.join(s.generator, "regenerate.js"),
                `--${repo}`,
                s.roots[repo],
                "--only",
                repo,
                "--provenance",
                s.manifest,
                "--output",
                output,
            ],
            { env, encoding: "utf8" }
        );
    assert.equal(runFamily("perimeter").status, 0);
    const core = fs.readFileSync(path.join(output, "ExitDelayQueue.json"));
    const zeroResult = runFamily("zero");
    assert.equal(zeroResult.status, 0, zeroResult.stderr);
    assert.deepEqual(fs.readFileSync(path.join(output, "ExitDelayQueue.json")), core);
    const manifest = JSON.parse(fs.readFileSync(path.join(output, "MANIFEST.json")));
    assert.equal(manifest.fixtures.length, 9);
    assert.equal(Object.keys(bindings(output).helper).length, 9);
    const prior = fs.readFileSync(path.join(output, "MANIFEST.json"));
    write(path.join(output, "MANIFEST.json"), "{malformed");
    assert.notEqual(runFamily("zero").status, 0);
    assert.deepEqual(fs.readFileSync(path.join(output, "ExitDelayQueue.json")), core);
    fs.writeFileSync(path.join(output, "MANIFEST.json"), prior);
    assert.equal(Object.keys(bindings(output).helper).length, 9);
});

test("falsy or broken explicit proof manifests refuse without parent fallback", () => {
    const s = setup("invalid-proof-manifest");
    const directory = packet(s);
    const file = path.join(directory, "MANIFEST.json");
    const original = fs.readFileSync(file);
    for (const value of [null, false, 0, "", []]) {
        write(file, JSON.stringify(value));
        assert.throws(() => bindings(directory), /invalid compiler proof manifest/);
    }
    fs.unlinkSync(file);
    fs.symlinkSync(path.join(s.base, "missing-manifest"), file);
    assert.throws(() => bindings(directory), /ENOENT/);
    fs.unlinkSync(file);
    fs.writeFileSync(file, original);
    assert.equal(Object.keys(bindings(directory).helper).length, 9);
});

/** Evaluate import-time fixture bindings without constructing any network provider. */
function bindings(directory) {
    const chosen = process.env.PERIMETER_FIXTURE_DIR;
    if (directory === undefined) delete process.env.PERIMETER_FIXTURE_DIR;
    else process.env.PERIMETER_FIXTURE_DIR = directory;
    delete require.cache[path.join(DIR, "loader.js")];
    const originalLoad = Module._load;
    const hre = {
        ethers,
        deployments: {
            get() {
                throw new Error("network access forbidden");
            },
        },
    };
    Module._load = function (name, ...args) {
        if (name === "hardhat") return hre;
        if (name === "@nomicfoundation/hardhat-network-helpers") return {};
        return originalLoad.call(this, name, ...args);
    };
    const evaluate = (filename, suffix, shared) => {
        const code = fs.readFileSync(filename, "utf8");
        const module = { exports: {} };
        const baseRequire = Module.createRequire(filename);
        const localRequire = (name) =>
            name === "./perimeterSipTestHelpers" && shared ? shared : baseRequire(name);
        const run = vm.runInThisContext(
            `(function(require,module,exports,__dirname,__filename){${code}\n${suffix}\n})`,
            { filename }
        );
        run(localRequire, module, module.exports, path.dirname(filename), filename);
        return module.exports;
    };
    try {
        const helper = evaluate(
            path.join(DIR, "../perimeterSipTestHelpers.js"),
            "module.exports.bindings = { controllerFixture, vaultFixture, erc1967ProxyFixture, borrowerOperationsFixture, collSurplusPoolFixture, queueFixture, borrowerOperationsOpsFixture, priceFeedTestnetFixture, troveManagerFixture };",
            null
        );
        const stack = evaluate(
            path.join(DIR, "../phase2Stack.js"),
            "module.exports.binding = queueFixture;",
            helper
        );
        return { helper: helper.bindings, stack: stack.binding };
    } finally {
        Module._load = originalLoad;
        if (chosen === undefined) delete process.env.PERIMETER_FIXTURE_DIR;
        else process.env.PERIMETER_FIXTURE_DIR = chosen;
        delete require.cache[path.join(DIR, "loader.js")];
    }
}

test("helper consumes all nine external fixtures and stack consumes the same queue", () => {
    const s = setup("loader");
    const dir = packet(s);
    const result = bindings(dir);
    assert.equal(Object.keys(result.helper).length, 9);
    for (const fixture of Object.values(result.helper)) {
        assert.equal(fixture.bytecode, "0x6000", "override creation bytes must be consumed");
        assert.equal(fixture.abi[0].name, "FixtureSelected");
    }
    assert.strictEqual(
        result.stack,
        result.helper.queueFixture,
        "stack must reuse the selected helper queue object"
    );
});

test("missing or malformed external fixtures refuse without fallback", () => {
    const s = setup("missing");
    const dir = packet(s);
    const file = path.join(dir, "TroveManagerLiquidationFix.json");
    const original = fs.readFileSync(file);
    fs.unlinkSync(file);
    assert.throws(() => bindings(dir), /TroveManagerLiquidationFix/);
    fs.writeFileSync(file, "{malformed");
    assert.throws(() => bindings(dir), /TroveManagerLiquidationFix/);
    fs.writeFileSync(file, original);
    assert.equal(bindings(dir).stack.bytecode, "0x6000", "restored control must load");
});

test("external artifact mismatches and invalid directory options refuse", () => {
    const s = setup("loader-digest");
    const dir = packet(s);
    const file = path.join(dir, "ExitDelayQueue.artifact.json");
    const raw = fs.readFileSync(file);
    fs.writeFileSync(file, raw.toString() + " ");
    assert.throws(() => bindings(dir), /digest mismatch/);
    fs.writeFileSync(file, raw);
    assert.equal(bindings(dir).stack.bytecode, "0x6000");
    assert.throws(() => bindings(""), /absolute directory/);
    assert.throws(() => bindings("relative"), /absolute directory/);
    assert.throws(() => bindings(path.join(s.base, "absent")), /ENOENT/);
});

test("unset external option preserves committed fixture data", () => {
    const result = bindings(undefined);
    const queue = JSON.parse(fs.readFileSync(path.join(DIR, "ExitDelayQueue.json")));
    assert.deepEqual(result.stack, queue);
    assert.deepEqual(
        result.helper.borrowerOperationsFixture,
        JSON.parse(fs.readFileSync(path.join(DIR, "BorrowerOperationsPerimeter.json")))
    );
});

test("external output is selected rather than silently writing the default directory", () => {
    const s = setup("output");
    const output = path.join(s.base, "selected");
    const before = sha(fs.readFileSync(path.join(s.generator, "ExitFeeController.json")));
    const result = run(s, ["--output", output, "--provenance", s.manifest]);
    assert.equal(result.status, 0, result.stderr);
    assert(
        fs.existsSync(path.join(output, "ExitFeeController.json")),
        "explicit output must be consumed"
    );
    assert.equal(
        sha(fs.readFileSync(path.join(s.generator, "ExitFeeController.json"))),
        before,
        "default fixtures must remain untouched"
    );
});

test("stale complete compiler inputs refuse before creating the output", () => {
    const s = setup("stale");
    const output = path.join(s.base, "selected");
    const b = JSON.parse(fs.readFileSync(s.builds.zero));
    b.input.sources["contracts/TroveManager.sol"].content += "\n// stale input";
    write(s.builds.zero, b);
    const result = run(s, ["--output", output, "--provenance", s.manifest]);
    assert.notEqual(result.status, 0, "stale compiler proof must refuse");
    assert.equal(fs.existsSync(output), false, "no output before complete validation");
});

test("artifact provenance refuses ABI/bytecode substitution before any output", () => {
    const s = setup("artifact");
    const output = path.join(s.base, "selected");
    const file = s.records[8].artifactFile;
    const a = JSON.parse(fs.readFileSync(file));
    a.bytecode = "0x6003";
    write(file, a);
    const result = run(s, ["--output", output, "--provenance", s.manifest]);
    assert.notEqual(result.status, 0, "changed artifact digest must refuse");
    assert.equal(fs.existsSync(output), false);
});

test.after(() => fs.rmSync(TEMP, { recursive: true, force: true }));
