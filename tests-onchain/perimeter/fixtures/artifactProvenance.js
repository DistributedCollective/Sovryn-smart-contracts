const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const assert = require("assert");
const { execFileSync } = require("child_process");
const { utils } = require("ethers");

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const git = (root, ...args) =>
    execFileSync("git", ["-C", root, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    }).trim();
const HEX = /^0x(?:[0-9a-f]{2})+$/i;
const HASH = /^[0-9a-f]{64}$/i;
const PIN = /^[0-9a-f]{40}$/i;
const fail = (message) => {
    throw new Error(message);
};

const FIXTURES = [
    [
        "ExitFeeController.json",
        "ExitFeeController.sol/ExitFeeController.json",
        "perimeter",
        "ExitFeeController",
    ],
    ["ExitFeeVault.json", "ExitFeeVault.sol/ExitFeeVault.json", "perimeter", "ExitFeeVault"],
    [
        "ExitDelayQueue.json",
        "ExitDelayQueue.sol/ExitDelayQueue.json",
        "perimeter",
        "ExitDelayQueue",
    ],
    ["ERC1967Proxy.json", "ERC1967Proxy.sol/ERC1967Proxy.json", "perimeter", "ERC1967Proxy"],
    [
        "BorrowerOperationsPerimeter.json",
        "contracts/BorrowerOperations.sol/BorrowerOperations.json",
        "zero",
        "BorrowerOperations",
    ],
    [
        "CollSurplusPoolPerimeter.json",
        "contracts/CollSurplusPool.sol/CollSurplusPool.json",
        "zero",
        "CollSurplusPool",
    ],
    [
        "BorrowerOperationsPerimeterOps.json",
        "contracts/Dependencies/BorrowerOperationsPerimeterOps.sol/BorrowerOperationsPerimeterOps.json",
        "zero",
        "BorrowerOperationsPerimeterOps",
    ],
    [
        "PriceFeedTestnet.json",
        "contracts/TestContracts/PriceFeedTestnet.sol/PriceFeedTestnet.json",
        "zero",
        "PriceFeedTestnet",
    ],
    [
        "TroveManagerLiquidationFix.json",
        "contracts/TroveManager.sol/TroveManager.json",
        "zero",
        "TroveManager",
    ],
];
const family = (repo) =>
    ({ core: "perimeter", perimeter: "perimeter", zero: "zero", "zero-contracts": "zero" })[repo];

function contained(root, file) {
    const actual = fs.realpathSync(file);
    const rel = path.relative(root, actual);
    if (rel.startsWith(".." + path.sep) || rel === ".." || path.isAbsolute(rel))
        fail(`file outside selected directory: ${file}`);
    return actual;
}

function artifactData(artifact) {
    const bytecode =
        typeof artifact.bytecode === "string" ? artifact.bytecode : artifact.bytecode?.object;
    const deployedBytecode =
        typeof artifact.deployedBytecode === "string"
            ? artifact.deployedBytecode
            : artifact.deployedBytecode?.object;
    if (!HEX.test(bytecode) || !HEX.test(deployedBytecode) || !Array.isArray(artifact.abi))
        fail("artifact lacks ABI or complete creation/runtime bytecode");
    const data = {
        abi: artifact.abi,
        bytecode,
        deployedBytecode,
        linkReferences: artifact.linkReferences || artifact.bytecode?.linkReferences || {},
        deployedLinkReferences:
            artifact.deployedLinkReferences || artifact.deployedBytecode?.linkReferences || {},
    };
    const immutables =
        artifact.immutableReferences || artifact.deployedBytecode?.immutableReferences;
    if (immutables !== undefined) data.immutableReferences = immutables;
    return data;
}

/** Read a tracked source at the exact pin, including pinned Gitlink dependencies. */
function pinnedSource(root, pin, source) {
    const parts = source.split("/");
    for (let i = 1; i <= parts.length; i++) {
        const prefix = parts.slice(0, i).join("/");
        const entry = git(root, "ls-tree", pin, "--", prefix);
        if (entry.startsWith("160000 commit ")) {
            const subPin = entry.split(/\s+/)[2];
            const dependency = contained(root, path.join(root, prefix));
            if (fs.realpathSync(git(dependency, "rev-parse", "--show-toplevel")) !== dependency)
                fail(`Gitlink is not a canonical repository root: ${prefix}`);
            return pinnedSource(dependency, subPin, parts.slice(i).join("/"));
        }
    }
    try {
        return execFileSync("git", ["-C", root, "show", `${pin}:${source}`], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
    } catch (_) {
        return null;
    }
}

function validateBuild(root, pin, build, sourceSeal, { checkCheckout = true } = {}) {
    if (
        build.input?.language !== "Solidity" ||
        typeof build.solcVersion !== "string" ||
        !/^\d+\.\d+\.\d+$/.test(build.solcVersion)
    )
        fail("invalid Solidity compilation language/version");
    if (
        !build.input?.sources ||
        !build.output?.contracts ||
        !Object.keys(build.input.sources).length
    )
        fail(
            "full compiler input/output required; supply --provenance for metadata-only build info"
        );
    const seals = new Map();
    if (sourceSeal)
        for (const entry of sourceSeal) {
            if (seals.has(entry.source) || !HASH.test(entry.sha256))
                fail("duplicate or invalid compilation-source seal");
            seals.set(entry.source, entry.sha256);
        }
    for (const [source, input] of Object.entries(build.input.sources)) {
        if (
            path.isAbsolute(source) ||
            source.includes("\\") ||
            path.posix.normalize(source) !== source ||
            source.startsWith("../") ||
            !source.endsWith(".sol") ||
            typeof input.content !== "string"
        )
            fail(`invalid embedded compiler source: ${source}`);
        if (sourceSeal && seals.get(source) !== sha256(input.content))
            fail(`compilation-input digest mismatch: ${source}`);
        const tracked = pinnedSource(root, pin, source);
        if (tracked === null && !/^(?:@[^/]+\/[^/]+\/|hardhat\/)/.test(source))
            fail(`owned or Gitlink compiler source missing at pin: ${source}`);
        if (tracked === null && (!sourceSeal || !seals.has(source)))
            fail(`dependency ${source} needs pinned digest evidence through --provenance`);
        if (tracked !== null && tracked !== input.content)
            fail(`compiler input differs from source pin: ${source}`);
        if (checkCheckout || tracked === null) {
            const file = contained(
                root,
                tracked === null
                    ? path.join(root, "node_modules", source)
                    : path.join(root, source)
            );
            if (fs.readFileSync(file, "utf8") !== input.content)
                fail(`compiler input differs from checkout: ${source}`);
        }
    }
    if (sourceSeal && seals.size !== Object.keys(build.input.sources).length)
        fail("compilation-source seal does not cover exactly the complete input");
}

const targetSource = ([, relativeArtifact, repo, name]) =>
    repo === "zero"
        ? relativeArtifact.slice(0, relativeArtifact.lastIndexOf("/"))
        : name === "ERC1967Proxy"
          ? "lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol"
          : `src/${name}.sol`;

/** Resolve omitted artifact fields from a sealed compiler proof bound to the source pin. */
function fixtureCompilerData(manifest, record, provenance, artifact, cache) {
    const [filename, , repo, name] = record;
    const one = (rows, label) => {
        if (!Array.isArray(rows) || rows.length !== 1) fail(`expected exactly one ${label}`);
        return rows[0];
    };
    if (
        !Array.isArray(manifest.fixtures) ||
        !Array.isArray(manifest.sourceChecks) ||
        !Array.isArray(manifest.roots)
    )
        fail("invalid compiler proof manifest");
    const pin = manifest.pins?.[repo === "perimeter" ? "core" : "zero"];
    const seal = one(
        manifest.fixtures.filter((f) => f.filename === filename && family(f.repo) === repo),
        `${filename} artifact seal`
    );
    if (
        !PIN.test(pin) ||
        pin !== provenance.commit ||
        seal.sourceCommit !== pin ||
        seal.name !== name ||
        seal.artifactSha256 !== provenance.artifactSha256 ||
        seal.sourceInputSha256 !== provenance.inputSha256 ||
        !HASH.test(seal.sourceProof)
    )
        fail(`compiler proof fixture binding mismatch: ${filename}`);
    const proof = one(
        manifest.sourceChecks.filter(
            (c) => family(c.name) === repo && c.buildInfoSha256 === seal.sourceProof
        ),
        `${filename} compiler proof`
    );
    const bytes = fs.readFileSync(proof.buildInfoFile);
    const buildHash = sha256(bytes);
    if (buildHash !== seal.sourceProof) fail(`compiler proof digest mismatch: ${filename}`);
    const build = JSON.parse(bytes);
    const inputHash = sha256(JSON.stringify(build.input));
    if (
        !HASH.test(proof.inputSha256) ||
        inputHash !== proof.inputSha256 ||
        inputHash !== provenance.inputSha256 ||
        !Array.isArray(proof.sources)
    )
        fail(`compiler input digest mismatch: ${filename}`);
    const declaredRoot = one(
        manifest.roots.filter((r) => family(r.name) === repo),
        `${repo} source root`
    );
    const root = fs.realpathSync(declaredRoot.canonical);
    if (
        fs.realpathSync(git(root, "rev-parse", "--show-toplevel")) !== root ||
        git(root, "rev-parse", "--verify", `${pin}^{commit}`) !== pin
    )
        fail(`invalid canonical compiler proof source root/pin: ${repo}`);
    const key = JSON.stringify([root, pin, buildHash]);
    if (!cache.has(key)) {
        // Loading a frozen packet checks exact Git blobs, not a newer checkout's tracked files.
        // Untracked package sources still require both sealed hashes and contained local bytes.
        validateBuild(root, pin, build, proof.sources, { checkCheckout: false });
        cache.add(key);
    }
    return matchArtifact(artifact, build, name, targetSource(record)).data;
}

function matchArtifact(artifact, build, name, expectedSource) {
    const data = artifactData(artifact);
    const raw = artifact.rawMetadata;
    const metadata = raw
        ? JSON.parse(raw)
        : typeof artifact.metadata === "string"
          ? JSON.parse(artifact.metadata)
          : artifact.metadata;
    const targets =
        metadata?.settings?.compilationTarget ||
        (artifact.sourceName ? { [artifact.sourceName]: artifact.contractName } : null);
    if (!targets || Object.keys(targets).length !== 1)
        fail(`artifact compilation target missing: ${name}`);
    const source = Object.keys(targets)[0];
    if (source !== expectedSource) fail(`unexpected compilation target source: ${source}`);
    if (targets[source] !== name || (artifact.contractName && artifact.contractName !== name))
        fail(`artifact contract identity mismatch: ${name}`);
    const compiled = build.output.contracts[source]?.[name];
    if (!compiled?.evm?.bytecode || !compiled.evm.deployedBytecode || !compiled.metadata)
        fail(`compiled output missing: ${source}:${name}`);
    const expected = {
        abi: compiled.abi,
        bytecode: "0x" + compiled.evm.bytecode.object.replace(/^0x/, ""),
        deployedBytecode: "0x" + compiled.evm.deployedBytecode.object.replace(/^0x/, ""),
        linkReferences: compiled.evm.bytecode.linkReferences || {},
        deployedLinkReferences: compiled.evm.deployedBytecode.linkReferences || {},
        immutableReferences: compiled.evm.deployedBytecode.immutableReferences || {},
    };
    assert.deepStrictEqual(
        {
            ...data,
            immutableReferences:
                data.immutableReferences === undefined
                    ? expected.immutableReferences
                    : data.immutableReferences,
        },
        expected,
        `artifact does not match compiler output: ${name}`
    );
    if (raw && raw !== compiled.metadata)
        fail(`artifact metadata differs from compiler output: ${name}`);
    const compiledMetadata = JSON.parse(compiled.metadata);
    if (!compiledMetadata.sources?.[source])
        fail(`compiler output metadata lacks its target source: ${source}`);
    for (const [source, information] of Object.entries(compiledMetadata.sources || {})) {
        const content = build.input.sources[source]?.content;
        if (
            typeof content !== "string" ||
            information.keccak256 !== utils.keccak256(Buffer.from(content))
        )
            fail(`compiler output metadata source mismatch: ${source}`);
    }
    const inputSettings = build.input.settings || {};
    const defaultEvm = { "0.8.20": "shanghai", "0.6.11": "istanbul" }[build.solcVersion];
    if (!inputSettings.evmVersion && !defaultEvm)
        fail("explicit evmVersion required for this compiler version");
    const normalized = (key, value) => {
        if (key === "optimizer") return { enabled: false, runs: 200, ...value };
        if (key === "viaIR") return value ?? false;
        if (key === "evmVersion") return value ?? defaultEvm;
        if (key === "libraries") return value ?? {};
        return (value ?? [])
            .map((entry) => (entry.split("=")[0].includes(":") ? entry : ":" + entry))
            .sort();
    };
    for (const key of ["optimizer", "evmVersion", "viaIR", "remappings", "libraries"])
        assert.deepStrictEqual(
            normalized(key, compiledMetadata.settings[key]),
            normalized(key, inputSettings[key]),
            `compiler settings mismatch: ${key}`
        );
    const policy = inputSettings.metadata || {};
    assert.strictEqual(
        compiledMetadata.settings.metadata?.bytecodeHash ?? "ipfs",
        policy.bytecodeHash ?? "ipfs",
        "compiler settings mismatch: metadata bytecodeHash"
    );
    // Only the compiler's standard CBOR-appending policy is supported by these fixtures.
    if (policy.appendCBOR !== undefined && policy.appendCBOR !== true)
        fail("unsupported metadata policy: appendCBOR must be true");
    for (const [source, information] of Object.entries(compiledMetadata.sources)) {
        if (policy.useLiteralContent === true) {
            if (information.content !== build.input.sources[source].content)
                fail(`metadata policy literal-content mismatch: ${source}`);
        } else if (
            (policy.useLiteralContent !== undefined && policy.useLiteralContent !== false) ||
            information.content !== undefined
        )
            fail(`metadata policy literal-content mismatch: ${source}`);
    }
    if (compiledMetadata.compiler?.version?.split("+")[0] !== build.solcVersion)
        fail(`compiler version mismatch: ${name}`);
    if (
        build.solcLongVersion &&
        build.solcLongVersion !== build.solcVersion &&
        build.solcLongVersion !== compiledMetadata.compiler.version
    )
        fail(`compiler version build mismatch: ${name}`);
    return { data: expected, compiler: compiledMetadata.compiler.version };
}

module.exports = {
    FIXTURES,
    family,
    sha256,
    readJson,
    git,
    contained,
    artifactData,
    validateBuild,
    targetSource,
    fixtureCompilerData,
    matchArtifact,
    HASH,
    PIN,
    HEX,
    fail,
};
