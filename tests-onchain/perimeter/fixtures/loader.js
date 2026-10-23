const fs = require("fs");
const path = require("path");
const assert = require("assert");
const {
    FIXTURES,
    family,
    sha256,
    readJson,
    contained,
    artifactData,
    fixtureCompilerData,
    HASH,
    PIN,
    HEX,
} = require("./artifactProvenance");

const chosen = process.env.PERIMETER_FIXTURE_DIR;
if (chosen !== undefined && (!chosen.trim() || !path.isAbsolute(chosen))) {
    throw new Error("PERIMETER_FIXTURE_DIR must be a nonempty absolute directory");
}
const fixtureDirectory = fs.realpathSync(chosen === undefined ? __dirname : chosen);
if (!fs.statSync(fixtureDirectory).isDirectory())
    throw new Error("fixture input must be a directory");

const sourcePins = new Map();
const validatedBuilds = new Set();
let compilerManifest;

function proofManifest(required) {
    if (compilerManifest) return compilerManifest;
    // Generated sets carry their own proof; existing candidate packets carry it one level up.
    const candidates = [
        path.join(fixtureDirectory, "MANIFEST.json"),
        path.join(path.dirname(fixtureDirectory), "MANIFEST.json"),
    ];
    const file = candidates.find((f) => {
        try {
            fs.lstatSync(f);
            return true;
        } catch (error) {
            if (error.code === "ENOENT") return false;
            throw error;
        }
    });
    if (!file && required)
        throw new Error(
            "external artifact omits immutableReferences; compiler proof manifest required"
        );
    if (!file) return null;
    compilerManifest = readJson(contained(path.dirname(file), file));
    if (
        !compilerManifest ||
        typeof compilerManifest !== "object" ||
        Array.isArray(compilerManifest)
    )
        throw new Error("invalid compiler proof manifest");
    return compilerManifest;
}
/** Load only the selected fixture set; an explicit external input never falls back. */
function loadFixture(filename) {
    const record = FIXTURES.find(([file]) => file === filename);
    if (!record) throw new Error(`unknown Perimeter fixture: ${filename}`);
    try {
        const fixture = readJson(
            contained(fixtureDirectory, path.join(fixtureDirectory, filename))
        );
        const provenance = fixture._provenance;
        if (
            fixture.contractName !== record[3] ||
            !Array.isArray(fixture.abi) ||
            !fixture.abi.every((fragment) => fragment && typeof fragment.type === "string") ||
            typeof fixture.bytecode !== "string" ||
            !HEX.test(fixture.bytecode) ||
            !provenance ||
            typeof provenance.commit !== "string" ||
            family(provenance.repo) !== record[2] ||
            !/^[0-9a-f]{7,40}$/i.test(provenance.commit)
        ) {
            throw new Error("invalid contract, ABI, bytecode or source provenance");
        }
        if (chosen !== undefined) {
            if (
                !PIN.test(provenance.commit) ||
                !HASH.test(provenance.artifactSha256) ||
                !HASH.test(provenance.inputSha256)
            )
                throw new Error(
                    "external fixture requires full source pin and artifact/input SHA256"
                );
            const repo = family(provenance.repo);
            if (sourcePins.has(repo) && sourcePins.get(repo) !== provenance.commit)
                throw new Error(`external fixture set mixes ${repo} source pins`);
            const rawPath = contained(
                fixtureDirectory,
                path.join(fixtureDirectory, filename.replace(/\.json$/, ".artifact.json"))
            );
            const raw = fs.readFileSync(rawPath);
            if (sha256(raw) !== provenance.artifactSha256)
                throw new Error("external artifact digest mismatch");
            const artifact = JSON.parse(raw);
            let data = artifactData(artifact);
            const manifest = proofManifest(
                data.immutableReferences === undefined || typeof artifact.bytecode === "string"
            );
            if (manifest)
                data = fixtureCompilerData(
                    manifest,
                    record,
                    provenance,
                    artifact,
                    validatedBuilds
                );
            for (const [key, value] of Object.entries(data))
                assert.deepStrictEqual(
                    fixture[key],
                    value,
                    `external fixture differs from artifact: ${key}`
                );
            sourcePins.set(repo, provenance.commit);
        }
        return fixture;
    } catch (error) {
        throw new Error(`Perimeter fixture ${filename} in ${fixtureDirectory}: ${error.message}`);
    }
}

module.exports = { loadFixture, fixtureDirectory };
