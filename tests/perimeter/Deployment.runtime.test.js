const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
    assertCurrentMaintenanceImplementations,
    loadOriginalProtocolModule,
} = require("../../deployment/helpers/protocolRetention");
const describeCase = typeof describe === "function" ? describe : require("node:test").describe;
const testCase = typeof it === "function" ? it : require("node:test").it;

function fixture() {
    const library = loadOriginalProtocolModule("SwapsImplSovrynSwapLib");
    const records = Object.fromEntries(
        ["LoanMaintenance", "LoanMaintenanceViews"].map((name) => [
            name,
            JSON.parse(
                fs.readFileSync(
                    path.join(
                        __dirname,
                        "../../deployment/deployments/rskSovrynMainnet",
                        name + ".json"
                    )
                )
            ),
        ])
    );
    const placeholder = "__$6b3065420287e4be5d93089ad806c078e3$__";
    assert(records.LoanMaintenance.deployedBytecode.includes(placeholder));
    const codes = new Map([[library.address.toLowerCase(), library.runtime]]);
    for (const record of Object.values(records)) {
        codes.set(
            record.address.toLowerCase(),
            record.deployedBytecode.split(placeholder).join(library.address.slice(2))
        );
    }
    const hre = {
        network: { name: "rskSovrynMainnet", tags: { mainnet: true } },
        ethers: {
            provider: { getCode: async (address) => codes.get(address.toLowerCase()) || "0x" },
        },
        deployments: { get: async (name) => records[name] },
        artifacts: {
            readArtifact: async () => {
                throw new Error("new local build must not replace deployed artifact");
            },
        },
    };
    return { hre, records, codes, library };
}

describeCase("Deployed Maintenance artifact qualification", () => {
    testCase(
        "uses complete recorded deployment runtime independently of a later local build",
        async () => {
            const f = fixture();
            const result = await assertCurrentMaintenanceImplementations(f.hre);
            for (const name of Object.keys(f.records))
                assert.equal(
                    result[name].runtime.toLowerCase(),
                    f.codes.get(f.records[name].address.toLowerCase()).toLowerCase()
                );
        }
    );
    testCase("accepts a fully linked saved runtime with the same retained library", async () => {
        const f = fixture();
        f.records.LoanMaintenance.deployedBytecode = f.codes.get(
            f.records.LoanMaintenance.address.toLowerCase()
        );
        await assertCurrentMaintenanceImplementations(f.hre);
    });
    testCase("binds metadata sources and settings to the referenced compiler input", async () => {
        for (const change of [
            (r) => {
                r.solcInputHash = "0".repeat(32);
            },
            (r) => {
                const m = JSON.parse(r.metadata);
                m.sources["contracts/modules/LoanMaintenance.sol"].keccak256 =
                    "0x" + "0".repeat(64);
                r.metadata = JSON.stringify(m);
            },
            (r) => {
                const m = JSON.parse(r.metadata);
                m.settings.optimizer.runs = 1;
                r.metadata = JSON.stringify(m);
            },
        ]) {
            const f = fixture();
            change(f.records.LoanMaintenance);
            await assert.rejects(
                assertCurrentMaintenanceImplementations(f.hre),
                /compiler input|compiler-input/
            );
        }
    });
    testCase(
        "refuses incomplete or misidentified saved artifacts instead of falling back to a local build",
        async () => {
            for (const change of [
                (r) => {
                    delete r.deployedBytecode;
                },
                (r) => {
                    delete r.metadata;
                },
                (r) => {
                    const m = JSON.parse(r.metadata);
                    m.settings.compilationTarget = { "contracts/modules/Other.sol": "Other" };
                    r.metadata = JSON.stringify(m);
                },
            ]) {
                const f = fixture();
                change(f.records.LoanMaintenance);
                await assert.rejects(
                    assertCurrentMaintenanceImplementations(f.hre),
                    /deployment artifact|deployment metadata/
                );
            }
        }
    );
    testCase("refuses any installed runtime change including metadata bytes", async () => {
        const f = fixture(),
            address = f.records.LoanMaintenanceViews.address.toLowerCase(),
            original = f.codes.get(address);
        f.codes.set(address, original.slice(0, -2) + (original.endsWith("00") ? "01" : "00"));
        await assert.rejects(
            assertCurrentMaintenanceImplementations(f.hre),
            /complete current runtime/
        );
        f.codes.set(address, original);
        await assertCurrentMaintenanceImplementations(f.hre);
    });
    testCase(
        "refuses missing or substituted retained-library bindings even when record and chain agree",
        async () => {
            for (const libraries of [
                {},
                { SwapsImplSovrynSwapLib: "0x0000000000000000000000000000000000000099" },
                {
                    SwapsImplSovrynSwapLib: fixture().library.address,
                    "other.sol:SwapsImplSovrynSwapLib": fixture().library.address,
                },
            ]) {
                const f = fixture();
                f.records.LoanMaintenance.libraries = libraries;
                const substitute = libraries.SwapsImplSovrynSwapLib;
                if (substitute)
                    f.codes.set(
                        f.records.LoanMaintenance.address.toLowerCase(),
                        f.records.LoanMaintenance.deployedBytecode
                            .split("__$6b3065420287e4be5d93089ad806c078e3$__")
                            .join(substitute.slice(2))
                    );
                await assert.rejects(
                    assertCurrentMaintenanceImplementations(f.hre),
                    /binding|bind the pinned|declared/
                );
            }
        }
    );
});
