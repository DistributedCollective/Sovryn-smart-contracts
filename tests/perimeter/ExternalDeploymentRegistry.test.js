const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { ethers } = require("ethers");
const describeCase = typeof describe === "function" ? describe : require("node:test").describe;
const testCase = typeof it === "function" ? it : require("node:test").it;
const root =
    process.env.PERIMETER_EXTERNAL_RECORD_ROOT ||
    path.resolve(__dirname, "../../external/deployments/rskMainnet");
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, `${name}.json`), "utf8"));
const equalAddress = (actual, expected) =>
    assert.strictEqual(actual.toLowerCase(), expected.toLowerCase());
const current = [
    ["BorrowerOperations", "BorrowerOperationsPerimeter"],
    ["CollSurplusPool", "CollSurplusPoolPerimeter"],
    ["TroveManager", "TroveManagerLiquidationFix"],
];

describeCase("Current external Perimeter deployment registry", () => {
    for (const [name, candidateName] of current) {
        testCase(
            `${name} points to the selected deployed implementation with its complete artifact`,
            () => {
                const composite = read(name);
                const implementation = read(`${name}_Implementation`);
                const candidate = read(candidateName);
                equalAddress(composite.implementation, candidate.address);
                equalAddress(implementation.address, candidate.address);
                equalAddress(composite.address, read(`${name}_Proxy`).address);
                for (const field of [
                    "abi",
                    "bytecode",
                    "deployedBytecode",
                    "metadata",
                    "solcInputHash",
                    "args",
                    "receipt",
                    "transactionHash",
                    "storageLayout",
                ]) {
                    assert.deepStrictEqual(
                        implementation[field],
                        candidate[field],
                        `${name}: ${field}`
                    );
                }
                // Zero's canonical composite convention binds the current implementation
                // artifact and creation receipt to the stable proxy address.
                for (const field of [
                    "abi",
                    "bytecode",
                    "deployedBytecode",
                    "receipt",
                    "transactionHash",
                ]) {
                    assert.deepStrictEqual(
                        composite[field],
                        candidate[field],
                        `${name} composite: ${field}`
                    );
                }
                equalAddress(implementation.receipt.contractAddress, implementation.address);
            }
        );
    }
    testCase(
        "controller aliases contain the finalized delay implementation and real creation receipt",
        () => {
            const c = read("ExitFeeController");
            const implementation = read("ExitFeeController_Implementation");
            equalAddress(c.address, c.proxyAddress);
            equalAddress(c.implementation, "0xE85E7e5c81a4DCAfa6976Cd57988B81dbFCB18e1");
            equalAddress(c.implementation, c.implAddress);
            equalAddress(implementation.address, c.implAddress);
            assert.deepStrictEqual(c.abi, implementation.abi);
            assert.strictEqual(implementation.transactionHash, c.implementationDeploymentTx);
            equalAddress(implementation.receipt.contractAddress, implementation.address);
            assert.strictEqual(
                implementation.receipt.transactionHash,
                implementation.transactionHash
            );
            const iface = new ethers.utils.Interface(c.abi);
            for (const signature of [
                "setSecurityPerimeterEnabled(bool)",
                "grantExemption(bytes32,address)",
                "quoteExitDelay(bytes32,address,address)",
            ]) {
                assert.ok(iface.getFunction(signature));
            }
            assert.ok(implementation.bytecode.length > 1000);
            assert.ok(implementation.deployedBytecode.length > 1000);
            assert.ok(implementation.immutableReferences);
        }
    );
    testCase(
        "queue and vault expose their canonical stable proxy and active implementation",
        () => {
            for (const name of ["ExitDelayQueue", "ExitFeeVault"]) {
                const r = read(name);
                equalAddress(r.address, r.proxyAddress);
                equalAddress(r.implementation, r.implAddress);
                assert.ok(r.implBytecodeHash);
                assert.strictEqual(r.chainId, 30);
            }
        }
    );
    testCase(
        "generic external artifacts expose the active implementation ABI and templates",
        () => {
            for (const name of ["ExitFeeController", "BorrowerOperations"]) {
                const artifact = JSON.parse(
                    fs.readFileSync(
                        path.resolve(root, "../../artifacts", `${name}.sol`, `${name}.json`),
                        "utf8"
                    )
                );
                const implementation = read(`${name}_Implementation`);
                for (const field of ["abi", "bytecode", "deployedBytecode"]) {
                    assert.deepStrictEqual(
                        artifact[field],
                        implementation[field],
                        `${name} artifact: ${field}`
                    );
                }
            }
        }
    );
    testCase(
        "proxy records bind observed runtime without relabelling an unproven creation artifact",
        () => {
            for (const name of [
                "BorrowerOperations",
                "CollSurplusPool",
                "TroveManager",
                "ExitFeeController",
            ]) {
                const proxy = read(`${name}_Proxy`);
                assert.strictEqual(proxy.linkedData.recordKind, "observed-proxy-runtime");
                assert.strictEqual(proxy.linkedData.chainId, 30);
                assert.strictEqual(
                    ethers.utils.keccak256(proxy.deployedBytecode),
                    proxy.linkedData.runtimeCodeHash
                );
                assert.ok(proxy.linkedData.blockNumber > 0);
                assert.ok(/^0x[0-9a-f]{64}$/i.test(proxy.linkedData.blockHash));
                assert.strictEqual(proxy.bytecode, undefined);
                assert.strictEqual(proxy.receipt, undefined);
            }
        }
    );
    testCase("interface aliases do not claim another token's creation receipt or bytecode", () => {
        for (const name of ["BPro", "DoC", "MoC", "POWA", "USDT"]) {
            const alias = read(name);
            const original = JSON.parse(
                fs.readFileSync(
                    path.resolve(
                        __dirname,
                        "../../external/baselines/perimeter-delay-rskMainnet",
                        `${name}.json`
                    ),
                    "utf8"
                )
            );
            equalAddress(alias.address, original.address);
            assert.deepStrictEqual(alias.abi, original.abi);
            assert.strictEqual(alias.linkedData.recordKind, "interface-alias");
            for (const field of [
                "receipt",
                "transactionHash",
                "bytecode",
                "deployedBytecode",
                "metadata",
                "solcInputHash",
            ])
                assert.strictEqual(alias[field], undefined, `${name}: borrowed ${field}`);
        }
    });
    testCase("retained Zero observations do not invent creation provenance", () => {
        const pool = read("StabilityPool");
        const implementation = read("StabilityPool_Implementation");
        equalAddress(pool.implementation, implementation.address);
        assert.deepStrictEqual(pool.abi, implementation.abi);
        for (const name of [
            "StabilityPool",
            "StabilityPool_Implementation",
            "StabilityPool_Proxy",
            "TroveManagerRedeemOps",
        ]) {
            const r = read(name);
            assert.ok(r.linkedData.recordKind.startsWith("observed-"));
            assert.strictEqual(r.linkedData.chainId, 30);
            assert.strictEqual(r.transactionHash, undefined);
            assert.strictEqual(r.receipt, undefined);
            assert.strictEqual(r.bytecode, undefined);
            if (r.deployedBytecode)
                assert.strictEqual(
                    ethers.utils.keccak256(r.deployedBytecode),
                    r.linkedData.runtimeCodeHash
                );
        }
    });
    testCase(
        "creation receipts belong to their address or explicitly selected implementation",
        () => {
            for (const filename of fs.readdirSync(root).filter((name) => name.endsWith(".json"))) {
                const r = JSON.parse(fs.readFileSync(path.join(root, filename), "utf8"));
                const created = r.receipt && r.receipt.contractAddress;
                if (!created) continue;
                assert.ok(
                    [r.address, r.implementation, r.implAddress]
                        .filter(Boolean)
                        .some((address) => address.toLowerCase() === created.toLowerCase()),
                    `${filename}: unrelated creation receipt`
                );
            }
        }
    );
    testCase(
        "every imported compiler-input reference resolves and agrees with metadata source hashes",
        () => {
            for (const filename of fs.readdirSync(root).filter((name) => name.endsWith(".json"))) {
                const r = JSON.parse(fs.readFileSync(path.join(root, filename), "utf8"));
                if (!r.solcInputHash) continue;
                const inputPath = path.join(root, "solcInputs", `${r.solcInputHash}.json`);
                assert.ok(
                    fs.existsSync(inputPath),
                    `${filename}: missing compiler input ${r.solcInputHash}`
                );
                const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
                if (!r.metadata) continue;
                const metadata =
                    typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata;
                for (const [source, info] of Object.entries(metadata.sources)) {
                    assert.ok(input.sources[source], `${filename}: missing source ${source}`);
                    assert.strictEqual(
                        ethers.utils.keccak256(
                            ethers.utils.toUtf8Bytes(input.sources[source].content)
                        ),
                        info.keccak256,
                        `${filename}: source mismatch ${source}`
                    );
                }
                assert.deepStrictEqual(
                    input.settings.optimizer,
                    metadata.settings.optimizer,
                    `${filename}: optimizer`
                );
                if (metadata.settings.evmVersion) {
                    const defaults = {
                        "0.6.11": "istanbul",
                        "0.8.10": "london",
                        "0.8.17": "london",
                    };
                    const version = metadata.compiler.version.split("+")[0];
                    assert.strictEqual(
                        input.settings.evmVersion || defaults[version],
                        metadata.settings.evmVersion,
                        `${filename}: EVM`
                    );
                }
            }
        }
    );
});

describeCase("Historical fee proposal selection", () => {
    const loadBuilder = (records, env = {}, builder = "getArgsSip0094Part1") => {
        const source = fs.readFileSync(
            process.env.PERIMETER_SIP_ARGS_SOURCE ||
                path.resolve(__dirname, "../../hardhat/tasks/sips/args/sipArgs.js"),
            "utf8"
        );
        const module = { exports: {} };
        vm.runInNewContext(source, {
            module,
            exports: module.exports,
            process: { env },
            network: { tags: { mainnet: true } },
            require: (name) =>
                name === "node-logs"
                    ? class {
                          showInConsole() {
                              return {};
                          }
                      }
                    : {},
        });
        const hre = {
            ethers: {
                ...ethers,
                getContract: async () => {
                    throw new Error("historical selection accepted");
                },
            },
            deployments: {
                get: async (name) => records[name],
                getOrNull: async (name) => records[name] || null,
            },
        };
        return () => module.exports[builder](hre);
    };
    for (const [name, candidateName] of current.slice(0, 2)) {
        testCase(
            `refuses the active ${name} alias before constructing a historical proposal`,
            async () => {
                const records = {
                    [`${name}_Implementation`]: read(`${name}_Implementation`),
                    [candidateName]: read(candidateName),
                };
                await assert.rejects(
                    loadBuilder(records),
                    /SIP-0094: .*resolves to the Phase 2 implementation/
                );
            }
        );
        testCase(`accepts explicitly pinned historical ${name} fixture selection`, async () => {
            const original = JSON.parse(
                fs.readFileSync(
                    path.resolve(
                        __dirname,
                        "../../external/baselines/perimeter-delay-rskMainnet",
                        `${name}_Implementation.json`
                    ),
                    "utf8"
                )
            );
            await assert.rejects(
                loadBuilder({
                    [`${name}_Implementation`]: original,
                    [candidateName]: read(candidateName),
                }),
                /historical selection accepted/
            );
        });
    }
    testCase(
        "checks an environment-selected Phase 2 target when the generic record is absent",
        async () => {
            const phase2 = read("BorrowerOperationsPerimeter");
            await assert.rejects(
                loadBuilder(
                    { BorrowerOperationsPerimeter: phase2 },
                    { PERIMETER_ZERO_BORROWER_OPERATIONS: phase2.address }
                ),
                /SIP-0094: .*resolves to the Phase 2 implementation/
            );
        }
    );
    for (const [name, candidateName] of [current[0], current[2]]) {
        testCase(
            `older SIP-0074 also refuses current ${name} and accepts a historical fixture`,
            async () => {
                const records = {
                    [`${name}_Implementation`]: read(`${name}_Implementation`),
                    [candidateName]: read(candidateName),
                };
                await assert.rejects(
                    loadBuilder(records, {}, "getArgsSip0074"),
                    /SIP-0074: .*resolves to the Phase 2 implementation/
                );
                records[`${name}_Implementation`] = JSON.parse(
                    fs.readFileSync(
                        path.resolve(
                            __dirname,
                            "../../external/baselines/perimeter-delay-rskMainnet",
                            `${name}_Implementation.json`
                        ),
                        "utf8"
                    )
                );
                await assert.rejects(
                    loadBuilder(records, {}, "getArgsSip0074"),
                    /historical selection accepted/
                );
            }
        );
    }
});
