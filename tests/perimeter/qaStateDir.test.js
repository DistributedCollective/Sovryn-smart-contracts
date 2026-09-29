/**
 * Where the QA fork's state files live.
 *
 * The address book the bootstrap writes and the log the engine appends to sit in
 * `qa/` unless PERIMETER_QA_STATE_DIR names another directory, so a second fork
 * on its own port keeps its own files instead of overwriting the first fork's.
 * Both modules read the variable when they load, so each check loads them again
 * with the variable set the way it needs.
 *
 * Run:
 *   __decryptionAlreadyDone__=TRUE npx hardhat test tests/perimeter/qaStateDir.test.js
 */
const os = require("os");
const path = require("path");
const { expect } = require("chai");

const BOOTSTRAP = require.resolve("../../tests-onchain/perimeter/qa/bootstrap");
const ENGINE = require.resolve("../../tests-onchain/perimeter/qa/engine");
const DEFAULT_DIR = path.join(__dirname, "..", "..", "qa");

/** The two file paths, from the modules loaded fresh under `stateDir` (unset
 *  when undefined). The module cache and the variable are put back afterwards. */
const filesUnder = (stateDir) => {
    const previousEnv = process.env.PERIMETER_QA_STATE_DIR;
    const cached = [BOOTSTRAP, ENGINE].map((id) => [id, require.cache[id]]);
    try {
        if (stateDir === undefined) delete process.env.PERIMETER_QA_STATE_DIR;
        else process.env.PERIMETER_QA_STATE_DIR = stateDir;
        [BOOTSTRAP, ENGINE].forEach((id) => delete require.cache[id]);
        return {
            stateFile: require(BOOTSTRAP).STATE_FILE,
            logFile: require(ENGINE).LOG_FILE,
        };
    } finally {
        if (previousEnv === undefined) delete process.env.PERIMETER_QA_STATE_DIR;
        else process.env.PERIMETER_QA_STATE_DIR = previousEnv;
        for (const [id, module] of cached) {
            if (module) require.cache[id] = module;
            else delete require.cache[id];
        }
    }
};

describe("perimeter QA state directory", () => {
    it("keeps both files in qa/ when PERIMETER_QA_STATE_DIR is not set", () => {
        const { stateFile, logFile } = filesUnder(undefined);
        expect(stateFile).to.equal(path.join(DEFAULT_DIR, "perimeter-qa.json"));
        expect(logFile).to.equal(path.join(DEFAULT_DIR, "state.json"));
    });

    it("puts both files in the directory PERIMETER_QA_STATE_DIR names", () => {
        const dir = path.join(os.tmpdir(), "second-fork-state");
        const { stateFile, logFile } = filesUnder(dir);
        expect(stateFile).to.equal(path.join(dir, "perimeter-qa.json"));
        expect(logFile).to.equal(path.join(dir, "state.json"));
    });

    it("resolves a relative PERIMETER_QA_STATE_DIR against the working directory", () => {
        const { stateFile } = filesUnder("relative-state");
        expect(stateFile).to.equal(path.resolve("relative-state", "perimeter-qa.json"));
    });
});
