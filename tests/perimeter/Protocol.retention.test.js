const assert = require("assert");
const fs = require("fs");
const { utils } = require("ethers");
const { loadOriginalLiquidation } = require("../../deployment/helpers/liquidationRetention");
const {
    ORIGINALS,
    MAINTENANCE_VIEW_SIGNATURES,
    loadOriginalProtocolModule,
    assertRetainedProtocolRoutes,
} = require("../../deployment/helpers/protocolRetention");
const describeCase = typeof describe === "function" ? describe : require("node:test").describe;
const testCase = typeof it === "function" ? it : require("node:test").it;

describeCase("Original rollover retention and Maintenance rollback provenance", () => {
    testCase(
        "pins complete original artifact/input, declared links and full runtime metadata",
        () => {
            for (const name of Object.keys(ORIGINALS)) {
                const original = loadOriginalProtocolModule(name);
                assert.equal(utils.keccak256(original.runtime), ORIGINALS[name].runtimeKeccak);
                assert.ok(!original.runtime.includes("__$"));
                if (original.creationKeccak)
                    assert.equal(
                        utils.keccak256(original.creationBytecode),
                        original.creationKeccak
                    );
                for (const changedFile of [name + ".json", original.inputFile]) {
                    const read = (file) => {
                        const bytes = fs.readFileSync(file);
                        return file.endsWith(changedFile)
                            ? Buffer.concat([bytes, Buffer.from(" ")])
                            : bytes;
                    };
                    assert.throws(
                        () => loadOriginalProtocolModule(name, read),
                        /provenance mismatch/
                    );
                }
                assert.equal(loadOriginalProtocolModule(name).runtime, original.runtime);
            }
        }
    );
    testCase(
        "checks retained rollover/liquidation and complete rollback/library bytes without retaining query routes",
        async () => {
            const liquidation = loadOriginalLiquidation();
            const originals = Object.fromEntries(
                Object.keys(ORIGINALS).map((name) => [name, loadOriginalProtocolModule(name)])
            );
            const routes = new Map([
                ["liquidate(bytes32,address,uint256)", liquidation.address],
                ["rollover(bytes32,bytes)", originals.LoanClosingsRollover.address],
                ...MAINTENANCE_VIEW_SIGNATURES.map((s) => [s, originals.LoanMaintenance.address]),
            ]);
            const codes = new Map([
                [liquidation.address.toLowerCase(), liquidation.record.deployedBytecode],
                ...Object.values(originals).map((d) => [d.address.toLowerCase(), d.runtime]),
            ]);
            const hre = {
                ethers: {
                    provider: {
                        getCode: async (address) => codes.get(address.toLowerCase()) || "0x",
                    },
                },
            };
            const protocol = { getTarget: async (signature) => routes.get(signature) };
            await assertRetainedProtocolRoutes(hre, protocol);
            for (const signature of ["rollover(bytes32,bytes)"]) {
                const healthy = routes.get(signature);
                for (const wrong of [
                    "0x0000000000000000000000000000000000000000",
                    liquidation.address,
                ]) {
                    routes.set(signature, wrong);
                    await assert.rejects(
                        assertRetainedProtocolRoutes(hre, protocol),
                        /retained .*target/
                    );
                }
                routes.set(signature, healthy);
            }
            for (const original of Object.values(originals)) {
                for (const bad of [
                    "0x",
                    original.runtime.slice(0, -2) +
                        (original.runtime.endsWith("00") ? "01" : "00"),
                ]) {
                    codes.set(original.address.toLowerCase(), bad);
                    await assert.rejects(
                        assertRetainedProtocolRoutes(hre, protocol),
                        /complete runtime/
                    );
                }
                codes.set(original.address.toLowerCase(), original.runtime);
            }
            await assertRetainedProtocolRoutes(hre, protocol);
        }
    );
});
