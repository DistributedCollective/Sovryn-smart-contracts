// Keyless isolated build. Invoke with env -i HOME=... PATH=...; never load dotenv.
const { assertNoSigningInputs, assertIsolatedHardhat } = require("./keyless");
assertNoSigningInputs();
assertIsolatedHardhat();
const path = require("path");
process.env.__decryptionAlreadyDone__ = "TRUE";
require("dotenv").config = () => ({});
const config = require("../../hardhat.config");
config.defaultNetwork = "hardhat";
config.networks = { hardhat: { ...config.networks.hardhat, chainId: 31337 } };
delete config.networks.hardhat.forking;
// Hardhat adds a default localhost network while resolving configuration.
// Remove every network except the isolated in-process chain after resolution.
require("hardhat/config").extendConfig((resolved) => {
    for (const name of Object.keys(resolved.networks)) {
        if (name !== "hardhat") delete resolved.networks[name];
    }
    resolved.networks.hardhat.chainId = 31337;
});
const root = path.resolve(__dirname, "../..");
config.paths = {
    ...config.paths,
    root,
    cache: path.join(root, "tmp/sip0097/cache"),
    artifacts: path.join(root, "tmp/sip0097/artifacts"),
};
config.abiExporter.runOnCompile = false;
module.exports = config;
