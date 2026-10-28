const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { utils } = require("ethers");

// Original registered liquidation: full artifact and complete compiler input,
// independently reproduced and bound to the installed runtime without masking metadata.
const ORIGINAL = Object.freeze({
    address: "0xd01B701b7b01541C2683617cA2d5B58bB6896524",
    signature: "liquidate(bytes32,address,uint256)",
    runtimeKeccak: "0x8e3dba1e6cb2fe4c76bfafcda207e0ebe2bd58820b1e6ebb42c7c58cfc3aa44f",
    recordSha256: "65c14b25987192c2f5e2e4b860787af9cacf7f7096055c17338badb82fc707c8",
    inputFile: "65a70bb326aad4d159b9976594e238a5.json",
    inputSha256: "f4162f24f9061b694b00d6bfd150f539c7457249846bb2675de7ec57f8ef8b88",
    compiler: "0.5.17+commit.d19bba13",
});
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

/** Load the retained implementation's original evidence, never a fresh candidate record. */
function loadOriginalLiquidation(read = fs.readFileSync) {
    const directory = path.resolve(__dirname, "../deployments/rskSovrynMainnet");
    const recordBytes = read(path.join(directory, "LoanClosingsLiquidation.json"));
    const inputBytes = read(path.join(directory, "solcInputs", ORIGINAL.inputFile));
    if (
        sha256(recordBytes) !== ORIGINAL.recordSha256 ||
        sha256(inputBytes) !== ORIGINAL.inputSha256
    )
        throw new Error("original liquidation artifact/compiler-input provenance mismatch");
    const record = JSON.parse(recordBytes);
    const input = JSON.parse(inputBytes);
    const metadata = JSON.parse(record.metadata);
    if (
        record.address !== ORIGINAL.address ||
        utils.keccak256(record.deployedBytecode) !== ORIGINAL.runtimeKeccak ||
        metadata.compiler.version !== ORIGINAL.compiler ||
        metadata.settings.compilationTarget["contracts/modules/LoanClosingsLiquidation.sol"] !==
            "LoanClosingsLiquidation"
    )
        throw new Error("original liquidation full runtime/compiler identity mismatch");
    return { ...ORIGINAL, record, input };
}

/** Require explicit original-live retention at the protocol's actual liquidate selector. */
async function assertRetainedLiquidation(hre, protocol) {
    const original = loadOriginalLiquidation();
    const registered = await protocol.getTarget(ORIGINAL.signature);
    if (registered.toLowerCase() !== ORIGINAL.address.toLowerCase())
        throw new Error(
            `retained liquidation target ${registered} is not the pinned original liquidation ${ORIGINAL.address}`
        );
    const code = await hre.ethers.provider.getCode(registered);
    if (code.toLowerCase() !== original.record.deployedBytecode.toLowerCase())
        throw new Error(
            "retained liquidation complete runtime differs from its pinned original artifact"
        );
    return { ...original, actualRuntime: code };
}

module.exports = { ORIGINAL, loadOriginalLiquidation, assertRetainedLiquidation };
