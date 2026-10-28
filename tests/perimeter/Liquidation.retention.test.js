const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Module = require("module");
const ethers = require("ethers");
const { getProtocolModules } = require("../../deployment/helpers/helpers");
const {
    loadOriginalProtocolModule,
    MAINTENANCE_VIEW_SIGNATURES,
    SELECTED_PROTOCOL_SIGNATURES,
} = require("../../deployment/helpers/protocolRetention");
const {
    ORIGINAL,
    loadOriginalLiquidation,
    assertRetainedLiquidation,
} = require("../../deployment/helpers/liquidationRetention");
const describeCase = typeof describe === "function" ? describe : require("node:test").describe;
const testCase = typeof it === "function" ? it : require("node:test").it;

function loadReleaseScript(
    name = "2080-deploy-ReplaceProtocolModules.js",
    modules = ["LoanClosingsLiquidation", "LoanClosingsRollover", "LoanMaintenanceViews"],
    submit = () => {
        throw Error("unexpected multisig submission");
    }
) {
    const file = path.resolve(__dirname, "../../deployment/deploy/" + name);
    const requireFile = Module.createRequire(file);
    const module = { exports: {} };
    vm.runInNewContext(
        fs.readFileSync(file, "utf8"),
        {
            module,
            console,
            require: (name) =>
                name === "hardhat"
                    ? {}
                    : name === "../helpers/helpers"
                      ? {
                            getProtocolModules: () =>
                                Object.fromEntries(
                                    [...Object.keys(SELECTED_PROTOCOL_SIGNATURES), ...modules].map(
                                        (moduleName) => [
                                            moduleName,
                                            getProtocolModules()[moduleName],
                                        ]
                                    )
                                ),
                            sendWithMultisig: submit,
                        }
                      : requireFile(name),
        },
        { filename: file }
    );
    return module.exports;
}

describeCase("Explicit original liquidation retention", () => {
    testCase("pins original artifact and full compiler input without fresh relabeling", () => {
        const original = loadOriginalLiquidation();
        assert.equal(original.address, ORIGINAL.address);
        assert.equal(JSON.parse(original.record.metadata).compiler.version, ORIGINAL.compiler);
        assert.ok(Object.keys(original.input.sources).length > 40);
        for (const changedFile of ["LoanClosingsLiquidation.json", ORIGINAL.inputFile]) {
            const changedReader = (file) => {
                const raw = fs.readFileSync(file);
                return file.endsWith(changedFile) ? Buffer.concat([raw, Buffer.from(" ")]) : raw;
            };
            assert.throws(() => loadOriginalLiquidation(changedReader), /provenance mismatch/);
        }
        assert.equal(loadOriginalLiquidation().runtimeKeccak, ORIGINAL.runtimeKeccak);
    });
    testCase("requires original address and every runtime byte including metadata", async () => {
        const original = loadOriginalLiquidation();
        let address = original.address,
            code = original.record.deployedBytecode;
        const protocol = {
            getTarget: async (signature) => {
                assert.equal(signature, ORIGINAL.signature);
                return address;
            },
        };
        const hre = {
            ethers: {
                provider: {
                    getCode: async (target) => {
                        assert.equal(target, ORIGINAL.address);
                        return code;
                    },
                },
            },
        };
        await assertRetainedLiquidation(hre, protocol);
        for (const wrong of ["0x", code.slice(0, -2) + (code.endsWith("00") ? "01" : "00")]) {
            code = wrong;
            await assert.rejects(assertRetainedLiquidation(hre, protocol), /complete runtime/);
        }
        code = original.record.deployedBytecode;
        address = "0x0000000000000000000000000000000000000001";
        await assert.rejects(assertRetainedLiquidation(hre, protocol), /pinned original/);
        address = original.address;
        await assertRetainedLiquidation(hre, protocol);
    });
    testCase(
        "replacement script ignores stale candidate records and refuses before any write",
        async () => {
            const original = loadOriginalLiquidation();
            const stale = "0x0000000000000000000000000000000000000001";
            let code = original.record.deployedBytecode;
            let replacements = 0;
            let candidateReads = 0;
            const protocol = {
                getTarget: async (s) =>
                    s === "rollover(bytes32,bytes)"
                        ? loadOriginalProtocolModule("LoanClosingsRollover").address
                        : Object.values(SELECTED_PROTOCOL_SIGNATURES).flat().includes(s)
                          ? stale
                          : original.address,
                replaceContract: async () => {
                    replacements++;
                },
            };
            const hre = {
                network: { tags: {} },
                getNamedAccounts: async () => ({ deployer: stale }),
                deployments: {
                    log: () => {},
                    get: async (name) => {
                        if (["LoanClosingsLiquidation", "LoanClosingsRollover"].includes(name))
                            candidateReads++;
                        return { address: stale, abi: [] };
                    },
                },
                artifacts: {
                    readArtifact: async (name) => ({
                        contractName: name,
                        deployedBytecode: "0x6000",
                        deployedLinkReferences: {},
                    }),
                },
                ethers: {
                    ...ethers,
                    provider: {
                        getCode: async (a) =>
                            a.toLowerCase() === stale.toLowerCase()
                                ? "0x6000"
                                : a.toLowerCase() === original.address.toLowerCase()
                                  ? code
                                  : [
                                        "LoanClosingsRollover",
                                        "LoanMaintenance",
                                        "SwapsImplSovrynSwapLib",
                                    ]
                                        .map((loadName) => loadOriginalProtocolModule(loadName))
                                        .find((d) => d.address.toLowerCase() === a.toLowerCase())
                                        .runtime,
                    },
                    getContract: async () => protocol,
                    getSigners: async () => [{}],
                    Contract: class {
                        async borrowerExitPerimeterOps() {
                            return stale;
                        }
                    },
                },
            };
            const replace = loadReleaseScript();
            await replace(hre);
            assert.equal(replacements, 0, "stale candidate must never be installed");
            assert.equal(
                candidateReads,
                0,
                "retention must not consume a mutable candidate record"
            );
            code = "0x";
            await assert.rejects(replace(hre), /complete runtime/);
            assert.equal(replacements, 0);
            code = original.record.deployedBytecode;
            await replace(hre);
            assert.equal(replacements, 0);
        }
    );
    testCase(
        "replacement stays within five authorized modules for local and multisig paths",
        async () => {
            const excluded = [
                "Affiliates",
                "LoanOpenings",
                "LoanSettings",
                "ProtocolSettings",
                "SwapsExternal",
                "SwapsImplSovrynSwapModule",
            ];
            const originals = [
                loadOriginalLiquidation(),
                ...["LoanClosingsRollover", "LoanMaintenance", "SwapsImplSovrynSwapLib"].map(
                    (name) => loadOriginalProtocolModule(name)
                ),
            ];
            const code = new Map(
                originals.map((d) => [
                    d.address.toLowerCase(),
                    d.runtime || d.record.deployedBytecode,
                ])
            );
            const selected = Object.keys(SELECTED_PROTOCOL_SIGNATURES);
            const address = (n) =>
                ethers.utils.getAddress("0x" + n.toString(16).padStart(40, "0"));
            const abi = ["function replaceContract(address)"];
            const iface = new ethers.utils.Interface(abi);
            for (const testnet of [false, true])
                for (const installed of [false, true]) {
                    const records = Object.fromEntries(
                        [...selected, ...excluded].map((name, i) => [
                            name,
                            { address: address(100 + i), abi: [] },
                        ])
                    );
                    const writes = [],
                        reads = [];
                    const protocol = {
                        getTarget: async (signature) => {
                            if (signature === ORIGINAL.signature) return originals[0].address;
                            if (signature === "rollover(bytes32,bytes)")
                                return originals[1].address;

                            const name = selected.find((name) =>
                                SELECTED_PROTOCOL_SIGNATURES[name].includes(signature)
                            );
                            return name && installed ? records[name].address : address(50);
                        },
                        replaceContract: async (target) => writes.push(target.toLowerCase()),
                    };
                    const hre = {
                        network: { tags: testnet ? { testnet: true } : {} },
                        getNamedAccounts: async () => ({ deployer: address(1) }),
                        deployments: {
                            log: () => {},
                            get: async (name) => {
                                reads.push(name);
                                if (name === "SovrynProtocol") return { address: address(2), abi };
                                if (name === "MultiSigWallet")
                                    return { address: address(3), abi: [] };
                                if (name === "BorrowerExitPerimeterOps")
                                    return { address: address(4), abi: [] };
                                assert.ok(records[name], name);
                                return records[name];
                            },
                        },
                        artifacts: {
                            readArtifact: async (name) => ({
                                contractName: name,
                                deployedBytecode: "0x6000",
                                deployedLinkReferences: {},
                            }),
                        },
                        ethers: {
                            ...ethers,
                            provider: {
                                getCode: async (a) =>
                                    code.get(a.toLowerCase()) ||
                                    (Object.values(records).some(
                                        (r) => r.address.toLowerCase() === a.toLowerCase()
                                    )
                                        ? "0x6000"
                                        : "0x"),
                            },
                            getContract: async () => protocol,
                            getSigners: async () => [{}],
                            Contract: class {
                                async borrowerExitPerimeterOps() {
                                    return address(4);
                                }
                            },
                        },
                    };
                    const submit = async (wallet, target, data, actor) => {
                        assert.equal(wallet, address(3));
                        assert.equal(target, address(2));
                        assert.equal(actor, address(1));
                        writes.push(
                            iface.decodeFunctionData("replaceContract", data)[0].toLowerCase()
                        );
                    };
                    await loadReleaseScript(
                        "2080-deploy-ReplaceProtocolModules.js",
                        excluded,
                        submit
                    )(hre);
                    assert.deepEqual(
                        writes,
                        installed
                            ? []
                            : selected.map((name) => records[name].address.toLowerCase()),
                        "only the five authorized replacements may execute or be proposed"
                    );
                    assert.deepEqual(
                        reads.filter((name) => excluded.includes(name)),
                        [],
                        "unrelated mutable records are outside the release"
                    );
                }
        }
    );
    testCase(
        "stages only the five authorized modules without retained-module deployments",
        async () => {
            const expected = [
                "LoanMaintenanceViews",
                "LoanClosingsWith",
                "LoanClosingsWithSwap",
                "ExitFeeModule",
                "LoanMaintenance",
            ];
            const staged = [];
            const stage = loadReleaseScript("2070-deploy-ProtocolModules.js", [
                ...expected,
                "LoanClosingsRollover",
                "LoanMaintenanceViews",
                "LoanClosingsLiquidation",
            ]);
            await stage({
                ethers,
                getNamedAccounts: async () => ({ deployer: ORIGINAL.address }),
                deployments: {
                    get: async () => ({ address: ORIGINAL.address }),
                    log: () => {},
                    deploy: async (name) => {
                        staged.push(name);
                        return { newlyDeployed: false };
                    },
                },
            });
            assert.deepEqual(staged.sort(), expected.sort());
        }
    );
});
