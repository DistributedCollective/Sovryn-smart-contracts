const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { utils } = require("ethers");
const { assertRetainedLiquidation } = require("./liquidationRetention");

const MAINTENANCE_VIEW_SIGNATURES = Object.freeze([
    "getLenderInterestData(address,address)",
    "getLoanInterestData(bytes32)",
    "getUserLoans(address,uint256,uint256,uint256,bool,bool)",
    "getUserLoansV2(address,uint256,uint256,uint256,bool,bool)",
    "getLoan(bytes32)",
    "getLoanV2(bytes32)",
    "getActiveLoans(uint256,uint256,bool)",
    "getActiveLoansV2(uint256,uint256,bool)",
]);
const ORIGINALS = Object.freeze({
    LoanClosingsRollover: Object.freeze({
        address: "0xdB4fF0a861bF0c714B31E678c919c2B7EfD05329",
        recordSha256: "01637d0fb9227f7b4629cf691c980ec73ffe4192c4ac51622d15f83063d3fc1a",
        runtimeLinkOffset: 13357,
        creationLinkOffset: 13649,
        creationKeccak: "0xfc8a66545826f48db8ffbb98fc2a2cf342bf94b23ba85f154130ffc044c60470",
        runtimeKeccak: "0xdb0abc5e825a401bd3239dfddc02612088ec1373ee29dd04a2bb3692e089c347",
    }),
    LoanMaintenance: Object.freeze({
        address: "0xa87Bd1eF82FA2BE049473c73eAaa97d6AB9C4399",
        recordSha256: "160efa12d319969c7f94d6176f6189c94419c567461415bdb842e8c89a737ec5",
        runtimeLinkOffset: 17564,
        creationLinkOffset: 17856,
        creationKeccak: "0x3259cce6f0b904adc50464dddc4ddb794664cc4583d4c3b057028cc774115c59",
        runtimeKeccak: "0xdb251795feb63cf2e1b952e0be33e20662e7c40f63a87d11e6a23935ce529587",
    }),
    SwapsImplSovrynSwapLib: Object.freeze({
        address: "0xFE2bb2d345452673C4E90622147c4F515F2F4CE0",
        recordSha256: "c97c73180385263cdc3f193f698e4015bca27e5d03e6595814faafb6e8cef625",
        runtimeKeccak: "0x1bc8ada4329696e75bff948373b21f3a9a18011089134d87c20a4673d1ac7793",
    }),
});
const MODULE_INPUT = Object.freeze({
    file: "257273cf36885821b014e5bce28b30c5.json",
    sha256: "86d15219d0c3d9146101e1edc8986b51dcbcf3e2f6f93f89c2a252fe14634abc",
});
const LIBRARY_INPUT = Object.freeze({
    file: "88d24b4dae13f2feff76a894a46c72f8.json",
    sha256: "e92fa6d7e2f2139db0263f94401e739adf0536f3a634c25489dda2039dacff56",
});
const LIBRARY_SOURCE = "contracts/swaps/connectors/SwapsImplSovrynSwapLib.sol";
const LIBRARY_PLACEHOLDER = "__$6b3065420287e4be5d93089ad806c078e3$__";
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

/** Load original compiler evidence and bind only its declared library address. */
function loadOriginalProtocolModule(name, read = fs.readFileSync) {
    const pin = ORIGINALS[name];
    if (!pin) throw new Error(`unsupported original protocol module ${name}`);
    const directory = path.resolve(
        __dirname,
        name === "LoanMaintenance"
            ? "../baselines/original-maintenance"
            : "../deployments/rskSovrynMainnet"
    );
    const recordBytes = read(path.join(directory, `${name}.json`));
    const inputPin = name === "SwapsImplSovrynSwapLib" ? LIBRARY_INPUT : MODULE_INPUT;
    const inputBytes = read(path.join(directory, "solcInputs", inputPin.file));
    if (sha256(recordBytes) !== pin.recordSha256 || sha256(inputBytes) !== inputPin.sha256)
        throw new Error(`original ${name} artifact/compiler-input provenance mismatch`);
    const record = JSON.parse(recordBytes);
    const input = JSON.parse(inputBytes);
    const metadata = JSON.parse(record.metadata);
    const source =
        name === "SwapsImplSovrynSwapLib" ? LIBRARY_SOURCE : `contracts/modules/${name}.sol`;
    if (
        record.address !== pin.address ||
        metadata.compiler.version !== "0.5.17+commit.d19bba13" ||
        metadata.settings.compilationTarget[source] !== name ||
        !input.sources[source]
    )
        throw new Error(`original ${name} compiler/source identity mismatch`);
    let runtime = record.deployedBytecode;
    let creationBytecode = record.bytecode;
    if (name === "SwapsImplSovrynSwapLib") {
        // Solidity libraries embed their deployed self-address at byte offset one.
        if (!runtime.startsWith("0x73" + "00".repeat(20)))
            throw new Error("original swap library self-address binding mismatch");
        runtime = "0x73" + pin.address.slice(2) + runtime.slice(44);
    } else {
        if (
            Object.keys(record.libraries || {}).length !== 1 ||
            record.libraries.SwapsImplSovrynSwapLib !== ORIGINALS.SwapsImplSovrynSwapLib.address ||
            !input.sources[LIBRARY_SOURCE] ||
            LIBRARY_PLACEHOLDER !==
                "__$" + utils.id(LIBRARY_SOURCE + ":SwapsImplSovrynSwapLib").slice(2, 36) + "$__"
        )
            throw new Error(`original ${name} library binding mismatch`);
        const address = ORIGINALS.SwapsImplSovrynSwapLib.address.slice(2);
        const bind = (hex, offset) => {
            const start = 2 + offset * 2;
            const value = hex.slice(start, start + 40);
            if (value !== LIBRARY_PLACEHOLDER && value.toLowerCase() !== address.toLowerCase())
                throw new Error(`original ${name} declared library slot mismatch`);
            return hex.slice(0, start) + address + hex.slice(start + 40);
        };
        runtime = bind(runtime, pin.runtimeLinkOffset);
        creationBytecode = bind(creationBytecode, pin.creationLinkOffset);
        if (utils.keccak256(creationBytecode) !== pin.creationKeccak)
            throw new Error(`original ${name} complete creation identity mismatch`);
    }
    if (utils.keccak256(runtime) !== pin.runtimeKeccak)
        throw new Error(`original ${name} complete runtime identity mismatch`);
    return {
        ...pin,
        record,
        input,
        inputFile: inputPin.file,
        inputSha256: inputPin.sha256,
        runtime,
        creationBytecode,
    };
}

/** Check retained liquidation/rollover and the complete original rollback/dependency bytes. */
async function assertRetainedProtocolRoutes(hre, protocol) {
    const liquidation = await assertRetainedLiquidation(hre, protocol);
    const rollover = loadOriginalProtocolModule("LoanClosingsRollover");
    const maintenanceRollback = loadOriginalProtocolModule("LoanMaintenance");
    const swapsLibrary = loadOriginalProtocolModule("SwapsImplSovrynSwapLib");
    for (const [original, signatures] of [[rollover, ["rollover(bytes32,bytes)"]]]) {
        for (const signature of signatures) {
            const target = await protocol.getTarget(signature);
            if (target.toLowerCase() !== original.address.toLowerCase())
                throw new Error(
                    `retained ${signature} target differs from its pinned original ${original.address}`
                );
        }
    }
    for (const original of [rollover, maintenanceRollback, swapsLibrary]) {
        const code = await hre.ethers.provider.getCode(original.address);
        if (code.toLowerCase() !== original.runtime.toLowerCase())
            throw new Error(
                `retained ${original.record.address} complete runtime differs from its pinned original artifact`
            );
    }
    return { liquidation, rollover, maintenanceRollback, swapsLibrary };
}

/** Qualify both current split Maintenance implementations, including all runtime metadata. */
async function assertCurrentMaintenanceImplementations(hre) {
    const qualified = {};
    for (const name of ["LoanMaintenance", "LoanMaintenanceViews"]) {
        const deployment = await hre.deployments.get(name);
        if (deployment.address.toLowerCase() === ORIGINALS.LoanMaintenance.address.toLowerCase())
            throw new Error(`${name} candidate is the original Maintenance rollback anchor`);
        const artifact = await hre.artifacts.readArtifact(name);
        if (
            artifact.contractName !== name ||
            Object.keys(artifact.immutableReferences || {}).length
        )
            throw new Error(`${name} artifact has an unsupported identity or immutable binding`);
        let runtime = artifact.deployedBytecode;
        for (const [source, libraries] of Object.entries(artifact.deployedLinkReferences || {})) {
            for (const [library, references] of Object.entries(libraries)) {
                const address =
                    (deployment.libraries || {})[library] ||
                    (deployment.libraries || {})[`${source}:${library}`];
                if (!address || !utils.isAddress(address))
                    throw new Error(`${name} missing declared ${library} binding`);
                for (const { start, length } of references) {
                    if (length !== 20 || start < 0 || 2 + (start + length) * 2 > runtime.length)
                        throw new Error(`${name} invalid declared runtime link`);
                    const placeholder =
                        "__$" + utils.id(`${source}:${library}`).slice(2, 36) + "$__";
                    const offset = 2 + start * 2;
                    const value = runtime.slice(offset, offset + 40);
                    if (
                        value !== placeholder &&
                        value.toLowerCase() !== address.slice(2).toLowerCase()
                    )
                        throw new Error(`${name} unexpected declared runtime link contents`);
                    runtime =
                        runtime.slice(0, offset) + address.slice(2) + runtime.slice(offset + 40);
                }
            }
        }
        if (
            !utils.isHexString(runtime) ||
            runtime === "0x" ||
            (await hre.ethers.provider.getCode(deployment.address)).toLowerCase() !==
                runtime.toLowerCase()
        )
            throw new Error(`${name} complete current runtime differs from its artifact`);
        qualified[name] = { ...deployment, artifact, runtime };
    }
    return qualified;
}

/** Capture unique old implementations once; original Maintenance restores both selector groups. */
async function captureProtocolRollbackTargets(hre, protocol) {
    const { maintenanceRollback } = await assertRetainedProtocolRoutes(hre, protocol);
    const unique = new Map();
    for (const [name, signatures] of Object.entries(SELECTED_PROTOCOL_SIGNATURES)) {
        const address = await protocol.getTarget(signatures[0]);
        if (name === "LoanMaintenance" || name === "LoanMaintenanceViews") {
            for (const signature of signatures)
                if (
                    (await protocol.getTarget(signature)).toLowerCase() !==
                    maintenanceRollback.address.toLowerCase()
                )
                    throw new Error(
                        `rollback capture requires original Maintenance for ${signature}`
                    );
        }
        if (
            address === utils.getAddress("0x" + "00".repeat(20)) ||
            (await hre.ethers.provider.getCode(address)) === "0x"
        )
            throw new Error(`missing original rollback implementation for ${name}`);
        const key = address.toLowerCase();
        if (!unique.has(key)) unique.set(key, { address, modules: [] });
        unique.get(key).modules.push(name);
    }
    return Array.from(unique.values());
}

const SELECTED_PROTOCOL_SIGNATURES = Object.freeze({
    LoanClosingsWith: [
        "closeWithDeposit(bytes32,address,uint256)",
        "checkCloseWithDepositIsTinyPosition(bytes32,uint256)",
    ],
    LoanClosingsWithSwap: ["closeWithSwap(bytes32,address,uint256,bool,bytes)"],
    LoanMaintenance: [
        "depositCollateral(bytes32,uint256)",
        "withdrawCollateral(bytes32,address,uint256)",
        "withdrawAccruedInterest(address)",
        "extendLoanDuration(bytes32,uint256,bool,bytes)",
        "reduceLoanDuration(bytes32,address,uint256)",
    ],
    LoanMaintenanceViews: MAINTENANCE_VIEW_SIGNATURES,
    ExitFeeModule: [
        "exitFeeController()",
        "setExitFeeController(address)",
        "borrowerExitPerimeterOps()",
        "setBorrowerExitPerimeterOps(address)",
        "exitDelayQueue()",
        "setExitDelayQueue(address)",
    ],
});
module.exports = {
    ORIGINALS,
    MAINTENANCE_VIEW_SIGNATURES,
    SELECTED_PROTOCOL_SIGNATURES,
    loadOriginalProtocolModule,
    assertRetainedProtocolRoutes,
    assertCurrentMaintenanceImplementations,
    captureProtocolRollbackTargets,
};
