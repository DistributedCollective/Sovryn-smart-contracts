#!/usr/bin/env node
/**
 * Generate fixtures from complete, source-bound compiler artifacts.
 * Source checkouts: --perimeter/--zero. Independent build roots:
 * --perimeter-artifacts/--zero-artifacts (defaults: out/artifacts in the checkout).
 * --output defaults to this directory. --perimeter-commit/--zero-commit select
 * full pins (defaults: manifest pin, otherwise HEAD). --provenance supplies
 * sealed artifact and complete compiler-input digests. Validate before writing.
 */
const fs = require("fs");
const path = require("path");
const {
    FIXTURES,
    family,
    sha256,
    readJson,
    git,
    contained,
    validateBuild,
    matchArtifact,
    targetSource,
    HASH,
    PIN,
    fail,
} = require("./artifactProvenance");

const USAGE =
    "regenerate.js --perimeter <source> --zero <source> [--only perimeter|zero] [--output <dir>] [--perimeter-artifacts <out>] [--zero-artifacts <artifacts>] [--perimeter-commit <40-hex>] [--zero-commit <40-hex>] [--provenance <manifest.json>]";

function options(args) {
    const allowed = new Set([
        "perimeter",
        "zero",
        "only",
        "output",
        "perimeter-artifacts",
        "zero-artifacts",
        "perimeter-commit",
        "zero-commit",
        "provenance",
    ]);
    const result = {};
    for (let i = 0; i < args.length; i += 2) {
        const name = args[i].replace(/^--/, "");
        if (
            !args[i].startsWith("--") ||
            !allowed.has(name) ||
            Object.prototype.hasOwnProperty.call(result, name) ||
            !args[i + 1] ||
            args[i + 1].startsWith("--")
        )
            fail(`unknown, duplicate or incomplete option: ${args[i]}`);
        result[name] = args[i + 1];
    }
    if (result.only && !["perimeter", "zero"].includes(result.only))
        fail("--only must be perimeter or zero");
    return result;
}

function branchOf(root) {
    const current = git(root, "branch", "--show-current");
    if (current) return current;
    const branches = git(root, "branch", "--points-at", "HEAD", "--format=%(refname:short)")
        .split("\n")
        .filter((name) => name && !name.startsWith("("));
    return one(branches, "branch at detached source HEAD");
}

const one = (values, label) => {
    if (values.length !== 1) fail(`expected exactly one ${label}, found ${values.length}`);
    return values[0];
};

function outputDirectory(destination, filenames) {
    let existing = path.resolve(destination);
    const absent = [];
    while (!fs.existsSync(existing)) {
        try {
            if (fs.lstatSync(existing).isSymbolicLink())
                fail(`output symlink refused: ${existing}`);
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
        }
        absent.unshift(path.basename(existing));
        existing = path.dirname(existing);
    }
    if (fs.lstatSync(existing).isSymbolicLink() || !fs.statSync(existing).isDirectory())
        fail(`output must be a real directory: ${existing}`);
    const output = path.join(fs.realpathSync(existing), ...absent);
    for (const filename of filenames) {
        const file = path.join(output, filename);
        try {
            const stat = fs.lstatSync(file);
            if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)
                fail(`output destination refused: ${file}`);
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
        }
    }
    return output;
}

function nativeBuildInfo(artifactRoot, artifactFile, artifact, name) {
    const debug = artifactFile.replace(/\.json$/, ".dbg.json");
    if (fs.existsSync(debug))
        return contained(
            artifactRoot,
            path.resolve(path.dirname(debug), readJson(debug).buildInfo)
        );
    const dir = path.join(artifactRoot, "build-info");
    if (!fs.existsSync(dir)) fail(`full build info missing for ${name}; supply --provenance`);
    const metadata = artifact.rawMetadata ? JSON.parse(artifact.rawMetadata) : artifact.metadata;
    const target = metadata?.settings?.compilationTarget;
    const source = target && Object.keys(target)[0];
    const matches = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => contained(artifactRoot, path.join(dir, f)))
        .filter((file) => {
            const build = readJson(file);
            return (
                build.input?.sources &&
                build.output?.contracts?.[source]?.[name]?.metadata === artifact.rawMetadata
            );
        });
    return one(
        matches,
        `complete compiler proof for ${name} (metadata-only build info is insufficient)`
    );
}

function generate(args) {
    const opts = options(args);
    const selected = opts.only ? [opts.only] : ["perimeter", "zero"];
    const manifest = opts.provenance ? readJson(opts.provenance) : null;
    if (
        manifest &&
        (!Array.isArray(manifest.fixtures) ||
            !Array.isArray(manifest.sourceChecks) ||
            !Array.isArray(manifest.roots) ||
            !manifest.pins)
    )
        fail("invalid provenance manifest");
    const repos = {};
    for (const repo of ["perimeter", "zero"]) {
        if (!selected.includes(repo)) {
            for (const flag of [repo, `${repo}-artifacts`, `${repo}-commit`])
                if (opts[flag]) fail(`--${flag} conflicts with --only ${opts.only}`);
            continue;
        }
        if (!opts[repo]) fail(`--${repo} is required`);
        const root = fs.realpathSync(opts[repo]);
        if (fs.realpathSync(git(root, "rev-parse", "--show-toplevel")) !== root)
            fail(`source checkout must be its canonical repository root: ${repo}`);
        if (git(root, "status", "--porcelain", "--untracked-files=no"))
            fail(`source checkout has uncommitted tracked changes: ${repo}`);
        const manifestPin = manifest && manifest.pins[repo === "perimeter" ? "core" : "zero"];
        const pin = opts[`${repo}-commit`] || manifestPin || git(root, "rev-parse", "HEAD");
        if (!PIN.test(pin) || git(root, "rev-parse", "--verify", `${pin}^{commit}`) !== pin)
            fail(`--${repo}-commit must be an exact canonical 40-hex commit`);
        if (manifest) {
            if (pin !== manifestPin) fail(`source pin differs from provenance manifest: ${repo}`);
            const declared = one(
                manifest.roots.filter((r) => family(r.name) === repo),
                `${repo} canonical source root`
            );
            if (fs.realpathSync(declared.canonical) !== root)
                fail(`source root differs from provenance manifest: ${repo}`);
        }
        repos[repo] = {
            root,
            pin,
            branch: branchOf(root),
            artifacts: fs.realpathSync(
                opts[`${repo}-artifacts`] ||
                    path.join(root, repo === "perimeter" ? "out" : "artifacts")
            ),
        };
    }
    const builds = new Set();
    const sourceChecks = new Map();
    const artifactSeals = [];
    const updates = [];
    for (const [filename, relativeArtifact, repo, name] of FIXTURES.filter((f) =>
        selected.includes(f[2])
    )) {
        const ctx = repos[repo];
        const seal =
            manifest &&
            one(
                manifest.fixtures.filter(
                    (f) => f.filename === filename && family(f.repo) === repo
                ),
                `${filename} artifact seal`
            );
        if (
            seal &&
            (seal.name !== name ||
                seal.sourceCommit !== ctx.pin ||
                !HASH.test(seal.artifactSha256) ||
                !HASH.test(seal.sourceProof) ||
                !HASH.test(seal.sourceInputSha256))
        )
            fail(`invalid artifact/source pin seal: ${filename}`);
        const artifactFile = contained(
            ctx.artifacts,
            seal ? seal.artifactFile : path.join(ctx.artifacts, relativeArtifact)
        );
        if (artifactFile !== contained(ctx.artifacts, path.join(ctx.artifacts, relativeArtifact)))
            fail(`artifact path differs from fixed fixture target: ${filename}`);
        const artifactBytes = fs.readFileSync(artifactFile);
        if (seal && sha256(artifactBytes) !== seal.artifactSha256)
            fail(`artifact digest mismatch: ${filename}`);
        const artifact = JSON.parse(artifactBytes);
        const proof =
            seal &&
            one(
                manifest.sourceChecks.filter(
                    (c) => family(c.name) === repo && c.buildInfoSha256 === seal.sourceProof
                ),
                `${filename} compiler-input seal`
            );
        const buildFile = proof
            ? fs.realpathSync(proof.buildInfoFile)
            : nativeBuildInfo(ctx.artifacts, artifactFile, artifact, name);
        const buildBytes = fs.readFileSync(buildFile);
        const buildHash = sha256(buildBytes);
        if (proof && (!HASH.test(proof.buildInfoSha256) || buildHash !== proof.buildInfoSha256))
            fail(`compiler proof digest mismatch: ${filename}`);
        const build = JSON.parse(buildBytes);
        const inputHash = sha256(JSON.stringify(build.input));
        if (
            proof &&
            (!HASH.test(proof.inputSha256) ||
                inputHash !== proof.inputSha256 ||
                inputHash !== seal.sourceInputSha256 ||
                !Array.isArray(proof.sources))
        )
            fail(`compiler input digest mismatch: ${filename}`);
        const key = JSON.stringify([repo, ctx.pin, buildHash]);
        if (!builds.has(key)) {
            validateBuild(ctx.root, ctx.pin, build, proof?.sources);
            builds.add(key);
        }
        const source = targetSource([filename, relativeArtifact, repo, name]);
        const { data, compiler } = matchArtifact(artifact, build, name, source);
        const template = readJson(path.join(__dirname, filename));
        const fixture = {
            ...template,
            ...data,
            _provenance: {
                ...template._provenance,
                branch: ctx.branch,
                commit: ctx.pin,
                compiler,
                artifactSha256: sha256(artifactBytes),
                inputSha256: inputHash,
                buildInfoSha256: buildHash,
                generatedAt: new Date().toISOString(),
            },
        };
        if (fixture.contractName !== name) fail(`fixture template contract mismatch: ${filename}`);
        // generatedAt is the UTC generation time, not the template's old pin date.
        delete fixture._provenance.pinned;
        const manifestRepo = repo === "perimeter" ? "core" : "zero";
        sourceChecks.set(key, {
            name: manifestRepo,
            buildInfoFile: buildFile,
            buildInfoSha256: buildHash,
            inputSha256: inputHash,
            sources: Object.entries(build.input.sources).map(([source, input]) => ({
                source,
                sha256: sha256(input.content),
            })),
        });
        artifactSeals.push({
            filename,
            name,
            repo: manifestRepo,
            sourceCommit: ctx.pin,
            artifactFile,
            artifactSha256: sha256(artifactBytes),
            sourceProof: buildHash,
            sourceInputSha256: inputHash,
        });
        updates.push({ filename, fixture, artifactBytes });
    }
    // Validate the complete selected set before creating or writing output.
    const destinations = updates.flatMap(({ filename }) =>
        opts.output ? [filename, filename.replace(/\.json$/, ".artifact.json")] : [filename]
    );
    if (opts.output) destinations.push("MANIFEST.json");
    const output = outputDirectory(opts.output || __dirname, destinations);
    const generatedManifest = {
        pins: Object.fromEntries(
            selected.map((repo) => [repo === "perimeter" ? "core" : "zero", repos[repo].pin])
        ),
        roots: selected.map((repo) => ({
            name: repo === "perimeter" ? "core" : "zero",
            canonical: repos[repo].root,
        })),
        fixtures: artifactSeals,
        sourceChecks: Array.from(sourceChecks.values()),
    };
    // Updating one family preserves the other family's existing evidence and fixtures.
    const existingManifest = path.join(output, "MANIFEST.json");
    if (opts.output && opts.only && fs.existsSync(existingManifest)) {
        const previous = readJson(existingManifest);
        for (const key of ["roots", "fixtures", "sourceChecks"]) {
            if (!Array.isArray(previous[key])) fail("invalid existing output manifest");
            generatedManifest[key] = previous[key]
                .filter((row) => !selected.includes(family(row.repo || row.name)))
                .concat(generatedManifest[key]);
        }
        generatedManifest.pins = { ...previous.pins, ...generatedManifest.pins };
    }
    fs.mkdirSync(output, { recursive: true });
    const write = (file, bytes) => {
        const fd = fs.openSync(
            file,
            fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_NOFOLLOW,
            0o644
        );
        try {
            if (!fs.fstatSync(fd).isFile() || fs.fstatSync(fd).nlink !== 1)
                fail(`output destination changed after validation: ${file}`);
            fs.ftruncateSync(fd, 0);
            fs.writeFileSync(fd, bytes);
        } finally {
            fs.closeSync(fd);
        }
    };
    for (const { filename, fixture, artifactBytes } of updates) {
        write(path.join(output, filename), JSON.stringify(fixture, null, 4) + "\n");
        if (opts.output)
            write(path.join(output, filename.replace(/\.json$/, ".artifact.json")), artifactBytes);
        console.log(`${filename}: validated source ${fixture._provenance.commit}`);
    }
    if (opts.output) write(existingManifest, JSON.stringify(generatedManifest, null, 4) + "\n");
    console.log(`done: ${updates.length} validated fixtures written to ${output}`);
}

if (require.main === module) {
    try {
        generate(process.argv.slice(2));
    } catch (error) {
        console.error(`error: ${error.message}\n${USAGE}`);
        process.exitCode = 1;
    }
}
module.exports = { generate };
