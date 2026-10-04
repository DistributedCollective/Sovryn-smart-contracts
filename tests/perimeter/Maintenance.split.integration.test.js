const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ethers = require("ethers");
const { loadOriginalProtocolModule } = require("../../deployment/helpers/protocolRetention");
const describeCase = typeof describe === "function" ? describe : require("node:test").describe;
const testCase = typeof it === "function" ? it : require("node:test").it;

function helperFunctions(hre) {
    const file = path.resolve(
        __dirname,
        "../../tests-onchain/perimeter/perimeterSipTestHelpers.js"
    );
    const source = fs.readFileSync(file, "utf8");
    const start = source.indexOf("const attachDeployed = async");
    const end = source.indexOf("\n};", start) + 3;
    assert.ok(start >= 0 && end > start);
    const module = { exports: {} };
    vm.runInNewContext(
        source.slice(start, end) + "\nmodule.exports={attachDeployed};",
        {
            module,
            ethers: hre.ethers,
            deployments: hre.deployments,
        },
        { filename: file }
    );
    return module.exports;
}

describeCase("Current Maintenance split staging provenance", () => {
    testCase(
        "rollback evidence survives an overwritten mutable Maintenance deployment record",
        () => {
            let mutableReads = 0;
            const read = (file) => {
                if (file.endsWith("deployments/rskSovrynMainnet/LoanMaintenance.json")) {
                    mutableReads++;
                    return Buffer.from('{"address":"new staged implementation"}');
                }
                return fs.readFileSync(file);
            };
            const original = loadOriginalProtocolModule("LoanMaintenance", read);
            assert.equal(original.address, "0xa87Bd1eF82FA2BE049473c73eAaa97d6AB9C4399");
            assert.equal(mutableReads, 0, "mutable staging records are not rollback evidence");
            assert.ok(Object.keys(original.input.sources).length > 200);
        }
    );
    testCase(
        "attaching a matching deployment preserves authoritative library bindings only",
        async () => {
            const target = "0x0000000000000000000000000000000000000011";
            let existing = {
                address: target,
                libraries: {
                    SwapsImplSovrynSwapLib: "0x0000000000000000000000000000000000000022",
                },
                metadata: "qualified existing metadata",
            };
            let saved;
            const hre = {
                ethers: {
                    ...ethers,
                    provider: { getCode: async () => "0x6000" },
                    Contract: class {
                        constructor(address) {
                            this.address = address;
                        }
                    },
                },
                deployments: {
                    getOrNull: async () => existing,
                    save: async (name, record) => {
                        saved = record;
                    },
                },
            };
            const { attachDeployed } = helperFunctions(hre);
            await attachDeployed("LoanMaintenance", target, [], null);
            assert.deepEqual(saved.libraries, existing.libraries);
            assert.equal(saved.metadata, existing.metadata);
            existing = { ...existing, address: "0x0000000000000000000000000000000000000033" };
            await attachDeployed("LoanMaintenance", target, [], null);
            assert.equal(
                saved.libraries,
                undefined,
                "a different old address cannot qualify the override's links"
            );
            existing = {
                address: target,
                libraries: {
                    SwapsImplSovrynSwapLib: "0x0000000000000000000000000000000000000022",
                },
            };
            await attachDeployed("LoanMaintenance", target, [], null);
            assert.deepEqual(saved.libraries, existing.libraries);
        }
    );
});
