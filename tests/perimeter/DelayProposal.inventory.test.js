const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Module = require("module");
const realEthers = require("ethers");
const { getProtocolModules } = require("../../deployment/helpers/helpers");
const describeCase = typeof describe === "function" ? describe : require("node:test").describe;
const testCase = typeof it === "function" ? it : require("node:test").it;

const address = (number) =>
    realEthers.utils.getAddress("0x" + number.toString(16).padStart(40, "0"));
const runtime = "0x6001600260036004";
const {
    loadOriginalProtocolModule,
    MAINTENANCE_VIEW_SIGNATURES,
    SELECTED_PROTOCOL_SIGNATURES,
    assertCurrentMaintenanceImplementations,
} = require("../../deployment/helpers/protocolRetention");
const originalRollover = loadOriginalProtocolModule("LoanClosingsRollover");
const originalViews = loadOriginalProtocolModule("LoanMaintenance");
const originalLibrary = loadOriginalProtocolModule("SwapsImplSovrynSwapLib");
const retainedTarget = (signature) =>
    signature === "rollover(bytes32,bytes)"
        ? originalRollover.address
        : MAINTENANCE_VIEW_SIGNATURES.includes(signature)
          ? originalViews.address
          : null;
const originalLiquidation = JSON.parse(
    fs.readFileSync(
        path.resolve(
            __dirname,
            "../../deployment/deployments/rskSovrynMainnet/LoanClosingsLiquidation.json"
        ),
        "utf8"
    )
);
// Bind proposal coverage to the independent executable release-set guard.
const releaseSet = fs.readFileSync(path.join(__dirname, "ReleaseSet.pinned.test.js"), "utf8");
const shippingArray = releaseSet.match(/const MUST_SHIP = (\[[\s\S]*?\]);/);
assert.ok(shippingArray, "release-set guard must declare MUST_SHIP");
const requiredModules = Array.from(vm.runInNewContext(shippingArray[1]));

function fixture({
    poolChanges = true,
    liquidationCode = runtime,
    registeredCode = originalLiquidation.deployedBytecode,
    registeredAddress = originalLiquidation.address,
    registeredCandidate = false,
    forked = true,
} = {}) {
    const records = {};
    let next = 100;
    for (const name of [
        "ExitFeeController",
        "ExitDelayQueue",
        "BorrowerExitPerimeterOps",
        "CollSurplusPoolPerimeter",
        "BorrowerOperationsPerimeter",
        "BorrowerOperationsPerimeterOps",
        "TroveManagerLiquidationFix",
        "LoanTokenLogicLM",
        "LoanTokenLogicWrbtcLM",
        "LoanClosingsLiquidation",
        "LoanClosingsRollover",
        "LoanMaintenanceViews",
        ...requiredModules,
    ])
        if (!records[name]) records[name] = { address: address(next++) };
    const protocol = address(1),
        bo = address(2),
        pool = address(3),
        trove = address(4),
        governorOwner = address(5),
        oldModule = address(6),
        oldTrove = address(7),
        oldPool = address(8),
        oldBo = address(9);
    const codes = new Map(Object.values(records).map((r) => [r.address.toLowerCase(), "0x6000"]));
    const selector = (signature) => realEthers.utils.id(signature).slice(2, 10);
    codes.set(
        records.BorrowerExitPerimeterOps.address.toLowerCase(),
        "0x63" +
            selector("escrowBorrowerExit(address,address,address,uint256,uint32,address,address)")
    );
    codes.set(
        records.ExitFeeModule.address.toLowerCase(),
        "0x63" + selector("setExitDelayQueue(address)")
    );
    codes.set(
        records.CollSurplusPoolPerimeter.address.toLowerCase(),
        "0x63" + selector("claimCollWithFeeTo(address,address,uint256,address)")
    );
    codes.set(
        records.BorrowerOperationsPerimeter.address.toLowerCase(),
        "0x63" + selector("setExitDelayQueue(address)")
    );
    codes.set(records.TroveManagerLiquidationFix.address.toLowerCase(), "0x6009");
    codes.set(records.LoanClosingsLiquidation.address.toLowerCase(), liquidationCode);
    for (const original of [originalRollover, originalViews, originalLibrary])
        codes.set(original.address.toLowerCase(), original.runtime);
    codes.set(oldModule.toLowerCase(), "0x6000");
    codes.set(registeredAddress.toLowerCase(), registeredCode);
    codes.set(oldTrove.toLowerCase(), "0x6000");
    codes.set(
        oldPool.toLowerCase(),
        poolChanges ? "0x6000" : codes.get(records.CollSurplusPoolPerimeter.address.toLowerCase())
    );
    const librarySource = "contracts/swaps/connectors/SwapsImplSovrynSwapLib.sol";
    const placeholder =
        "__$" +
        realEthers.utils.id(librarySource + ":SwapsImplSovrynSwapLib").slice(2, 36) +
        "$__";
    const maintenanceArtifact = {
        contractName: "LoanMaintenance",
        deployedBytecode: "0x6001" + placeholder + "6002",
        deployedLinkReferences: {
            [librarySource]: { SwapsImplSovrynSwapLib: [{ start: 2, length: 20 }] },
        },
        abi: [],
    };
    const viewsArtifact = {
        contractName: "LoanMaintenanceViews",
        deployedBytecode: "0x60036004",
        deployedLinkReferences: {},
        abi: [],
    };
    records.LoanMaintenance.libraries = { SwapsImplSovrynSwapLib: originalLibrary.address };
    codes.set(
        records.LoanMaintenance.address.toLowerCase(),
        maintenanceArtifact.deployedBytecode.replace(placeholder, originalLibrary.address.slice(2))
    );
    codes.set(records.LoanMaintenanceViews.address.toLowerCase(), viewsArtifact.deployedBytecode);
    const contracts = new Map();
    contracts.set(protocol.toLowerCase(), {
        address: protocol,
        owner: async () => governorOwner,
        exitFeeController: async () => records.ExitFeeController.address,
        getTarget: async (signature) =>
            signature === "liquidate(bytes32,address,uint256)"
                ? registeredCandidate
                    ? records.LoanClosingsLiquidation.address
                    : registeredAddress
                : retainedTarget(signature) || oldModule,
    });
    contracts.set(bo.toLowerCase(), {
        address: bo,
        getOwner: async () => governorOwner,
        getImplementation: async () => oldBo,
        exitFeeController: async () => records.ExitFeeController.address,
    });
    contracts.set(pool.toLowerCase(), {
        address: pool,
        getOwner: async () => governorOwner,
        getImplementation: async () => oldPool,
    });
    const troveViews = {
        BOOTSTRAP_PERIOD: async () => realEthers.BigNumber.from(1209600),
        permit2: async () => address(10),
    };
    contracts.set(trove.toLowerCase(), {
        address: trove,
        getOwner: async () => governorOwner,
        getImplementation: async () => oldTrove,
        ...troveViews,
    });
    contracts.set(records.TroveManagerLiquidationFix.address.toLowerCase(), troveViews);
    contracts.set(records.ExitFeeController.address.toLowerCase(), {
        securityPerimeterEnabled: async () => false,
        globalDelaySeconds: async () => 0,
    });
    for (const name of ["LoanTokenLogicBeaconLM", "LoanTokenLogicBeaconWrbtc"]) {
        const a = address(next++);
        contracts.set(a.toLowerCase(), {
            address: a,
            owner: async () => governorOwner,
            activeModuleIndex: async () => 0,
            moduleUpgradeLog: async () => ({ implementation: oldModule }),
        });
        records[name] = { address: a };
    }
    const named = {
        ISovryn: protocol,
        BorrowerOperations_Proxy: bo,
        CollSurplusPool_Proxy: pool,
        TroveManager_Proxy: trove,
        LoanTokenLogicBeaconLM: records.LoanTokenLogicBeaconLM.address,
        LoanTokenLogicBeaconWrbtc: records.LoanTokenLogicBeaconWrbtc.address,
    };
    const ethers = {
        ...realEthers,
        provider: { getCode: async (a) => codes.get(a.toLowerCase()) || "0x" },
        getContract: async (name) => contracts.get(named[name].toLowerCase()),
        Contract: class {
            constructor(a) {
                const c = contracts.get(a.toLowerCase());
                if (!c) throw Error("unexpected contract read " + a);
                return c;
            }
        },
    };
    const hre = {
        ethers,
        deployments: {
            get: async (name) => {
                assert.ok(records[name], name);
                return records[name];
            },
            getOrNull: async (name) => records[name] || null,
        },
        artifacts: {
            readArtifact: async (name) => {
                if (name === "LoanMaintenance") return maintenanceArtifact;
                if (name === "LoanMaintenanceViews") return viewsArtifact;
                assert.equal(name, "LoanClosingsLiquidation");
                return {
                    contractName: name,
                    deployedBytecode: runtime,
                    abi: [],
                    deployedLinkReferences: {},
                };
            },
        },
    };
    const file = path.resolve(__dirname, "../../hardhat/tasks/sips/args/sipArgs.js");
    const module = { exports: {} };
    const standardRequire = Module.createRequire(file);
    const requireStub = (name) => {
        if (name === "hardhat/types") return {};
        if (name === "../../../../deployment/helpers/helpers")
            return { getProtocolModules, getStakingModulesNames: () => ({}) };
        if (name === "../../../helpers") return {};
        if (name === "node-logs")
            return class {
                showInConsole() {
                    return this;
                }
            };
        return standardRequire(name);
    };
    const context = {
        require: requireStub,
        module,
        exports: module.exports,
        network: { tags: { mainnet: true, forked } },
        process: { env: {} },
        console,
    };
    vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
    return {
        hre,
        builders: module.exports,
        records,
        protocol,
        bo,
        pool,
        trove,
        governorOwner,
        contracts,
        codes,
    };
}

function stackFunctions(f) {
    const file = path.resolve(__dirname, "../../tests-onchain/perimeter/phase2Stack.js");
    const module = { exports: {} };
    const standardRequire = Module.createRequire(file);
    const requireStub = (name) => {
        if (name === "hardhat") return f.hre;
        if (name === "./perimeterSipTestHelpers") return { queueFixture: {}, forkOps: {} };
        if (name === "./phase1Proposals") return {};
        if (name === "../../hardhat/tasks/sips/args/sipArgs") return {};
        return standardRequire(name);
    };
    vm.runInNewContext(
        fs.readFileSync(file, "utf8"),
        {
            require: requireStub,
            module,
            exports: module.exports,
            __dirname: path.dirname(file),
            process: { env: {} },
            console,
        },
        { filename: file }
    );
    return module.exports;
}

describeCase("Perimeter delay proposal installation inventory", () => {
    for (const poolChanges of [true, false])
        testCase(
            `installs every audited shipping module once within 9 and ${poolChanges ? 5 : 4} actions`,
            async () => {
                const f = fixture({ poolChanges });
                const p1 = (await f.builders.getArgsSipPerimeterDelayPart1(f.hre)).args;
                const p2 = (await f.builders.getArgsSipPerimeterDelayPart2(f.hre)).args;
                assert.equal(p1.targets.length, 9);
                assert.equal(p2.targets.length, poolChanges ? 5 : 4);
                const replacements = [
                    ...p1.signatures.map((signature, i) => ({
                        signature,
                        target: p1.targets[i],
                        data: p1.data[i],
                    })),
                    ...p2.signatures.map((signature, i) => ({
                        signature,
                        target: p2.targets[i],
                        data: p2.data[i],
                    })),
                ].filter((a) => a.signature === "replaceContract(address)");
                assert.equal(replacements.length, requiredModules.length);
                for (const name of requiredModules) {
                    const matches = replacements.filter(
                        (a) =>
                            realEthers.utils.defaultAbiCoder
                                .decode(["address"], a.data)[0]
                                .toLowerCase() === f.records[name].address.toLowerCase()
                    );
                    assert.equal(matches.length, 1, name);
                    assert.equal(matches[0].target, f.protocol);
                }
                const hosts = replacements.map((a) =>
                    realEthers.utils.defaultAbiCoder.decode(["address"], a.data)[0].toLowerCase()
                );
                assert.equal(
                    hosts.indexOf(f.records.LoanMaintenanceViews.address.toLowerCase()),
                    hosts.indexOf(f.records.LoanMaintenance.address.toLowerCase()) + 1,
                    "Views immediately follows Maintenance"
                );
                assert.equal(p2.signatures.includes("replaceContract(address)"), false);
                assert.equal(
                    p2.targetOwnerValidationAddresses[p2.targets.length - 1],
                    f.governorOwner
                );
                const swap = p2.signatures.findIndex(
                    (signature, i) =>
                        signature === "setImplementation(address)" && p2.targets[i] === f.bo
                );
                assert.deepStrictEqual(Array.from(p2.signatures.slice(swap + 1, swap + 3)), [
                    "setPerimeterOps(address)",
                    "setExitDelayQueue(address)",
                ]);
                assert.equal(p2.targets[swap + 1], f.bo);
                assert.equal(p2.targets[swap + 2], f.bo);
                assert.ok(p2.description.includes("\n---\n"));
                assert.ok(p2.description.includes("retain"));
            }
        );
    testCase("refuses missing, changed or relocated original liquidation runtime", async () => {
        for (const options of [
            { registeredCode: "0x" },
            { registeredCode: originalLiquidation.deployedBytecode + "00" },
            { registeredCandidate: true },
            { registeredAddress: address(77) },
        ]) {
            const f = fixture(options);
            await assert.rejects(
                f.builders.getArgsSipPerimeterDelayPart2(f.hre),
                /retained liquidation|original liquidation/i
            );
        }
        const f = fixture();
        assert.equal(
            (await f.builders.getArgsSipPerimeterDelayPart2(f.hre)).args.targets.length,
            5
        );
    });
    testCase(
        "builders refuse substituted retained rollover routes and original rollback bytes",
        async () => {
            const f = fixture();
            const protocol = f.contracts.get(f.protocol.toLowerCase());
            const healthy = protocol.getTarget;
            for (const signature of ["rollover(bytes32,bytes)"]) {
                for (const target of [
                    address(77),
                    f.records.LoanMaintenanceViews.address,
                    f.records.LoanClosingsRollover.address,
                ]) {
                    protocol.getTarget = async (s) => (s === signature ? target : healthy(s));
                    await assert.rejects(
                        f.builders.getArgsSipPerimeterDelayPart1(f.hre),
                        /retained .*target/
                    );
                    await assert.rejects(
                        f.builders.getArgsSipPerimeterDelayPart2(f.hre),
                        /retained .*target/
                    );
                }
            }
            protocol.getTarget = healthy;
            for (const original of [originalRollover, originalViews, originalLibrary]) {
                for (const code of [
                    "0x",
                    original.runtime.slice(0, -2) +
                        (original.runtime.endsWith("00") ? "01" : "00"),
                ]) {
                    f.codes.set(original.address.toLowerCase(), code);
                    await assert.rejects(
                        f.builders.getArgsSipPerimeterDelayPart1(f.hre),
                        /retained .*complete runtime/
                    );
                }
                f.codes.set(original.address.toLowerCase(), original.runtime);
            }
            assert.equal(
                (await f.builders.getArgsSipPerimeterDelayPart1(f.hre)).args.targets.length,
                9
            );
        }
    );
    testCase(
        "current split refuses omitted views, wrong hosts and complete-runtime substitutions",
        async () => {
            const f = fixture();
            const protocol = f.contracts.get(f.protocol.toLowerCase());
            const preinstall = protocol.getTarget;
            const installed = async (signature) =>
                signature === "liquidate(bytes32,address,uint256)"
                    ? originalLiquidation.address
                    : signature === "rollover(bytes32,bytes)"
                      ? originalRollover.address
                      : f.records[
                            requiredModules.find((name) =>
                                SELECTED_PROTOCOL_SIGNATURES[name].includes(signature)
                            )
                        ].address;
            protocol.getTarget = installed;
            const stack = stackFunctions(f);
            await stack.assertLendingReleaseInstalled(f.protocol);
            for (const signature of [
                ...SELECTED_PROTOCOL_SIGNATURES.LoanMaintenance,
                ...MAINTENANCE_VIEW_SIGNATURES,
            ]) {
                for (const wrong of [
                    originalViews.address,
                    f.records.LoanMaintenance.address,
                    f.records.LoanMaintenanceViews.address,
                    address(0),
                ]) {
                    if (wrong === (await installed(signature))) continue;
                    protocol.getTarget = async (s) => (s === signature ? wrong : installed(s));
                    await assert.rejects(
                        stack.assertLendingReleaseInstalled(f.protocol),
                        /does not route/
                    );
                }
            }
            protocol.getTarget = installed;
            for (const name of ["LoanMaintenance", "LoanMaintenanceViews"]) {
                const target = f.records[name].address.toLowerCase(),
                    healthy = f.codes.get(target);
                for (const code of [
                    healthy.slice(0, -2) + (healthy.endsWith("00") ? "01" : "00"),
                    "0x",
                ]) {
                    f.codes.set(target, code);
                    protocol.getTarget = preinstall;
                    await assert.rejects(
                        f.builders.getArgsSipPerimeterDelayPart1(f.hre),
                        /complete current runtime/
                    );
                    protocol.getTarget = installed;
                    await assert.rejects(
                        stack.assertLendingReleaseInstalled(f.protocol),
                        /complete current runtime/
                    );
                }
                f.codes.set(target, healthy);
            }
            for (const name of ["LoanMaintenance", "LoanMaintenanceViews"]) {
                const healthyAddress = f.records[name].address;
                f.records[name].address = originalViews.address;
                await assert.rejects(
                    stack.assertLendingReleaseInstalled(f.protocol),
                    /rollback anchor/
                );
                f.records[name].address = healthyAddress;
            }
            delete f.records.LoanMaintenance.libraries;
            await assert.rejects(
                stack.assertLendingReleaseInstalled(f.protocol),
                /missing declared/
            );
            f.records.LoanMaintenance.libraries = {
                SwapsImplSovrynSwapLib: originalLibrary.address,
            };
            await stack.assertLendingReleaseInstalled(f.protocol);
        }
    );
    testCase(
        "coherent substituted library binding and original-library runtime changes refuse",
        async () => {
            const f = fixture(),
                record = f.records.LoanMaintenance;
            const healthy = f.codes.get(record.address.toLowerCase());
            const replacement = address(77);
            record.libraries = { SwapsImplSovrynSwapLib: replacement };
            f.codes.set(
                record.address.toLowerCase(),
                healthy
                    .toLowerCase()
                    .replace(
                        originalLibrary.address.slice(2).toLowerCase(),
                        replacement.slice(2).toLowerCase()
                    )
            );
            f.codes.set(
                replacement.toLowerCase(),
                "0x73" + replacement.slice(2) + originalLibrary.runtime.slice(44)
            );
            await assert.rejects(
                assertCurrentMaintenanceImplementations(f.hre),
                /pinned original|retained swap library/
            );
            record.libraries = { SwapsImplSovrynSwapLib: originalLibrary.address };
            f.codes.set(record.address.toLowerCase(), healthy);
            for (const code of [
                "0x",
                originalLibrary.runtime.slice(0, -2) +
                    (originalLibrary.runtime.endsWith("00") ? "01" : "00"),
            ]) {
                f.codes.set(originalLibrary.address.toLowerCase(), code);
                await assert.rejects(
                    assertCurrentMaintenanceImplementations(f.hre),
                    /retained swap library|pinned original/
                );
            }
            f.codes.set(originalLibrary.address.toLowerCase(), originalLibrary.runtime);
            await assertCurrentMaintenanceImplementations(f.hre);
            assert.equal(
                (await f.builders.getArgsSipPerimeterDelayPart1(f.hre)).args.targets.length,
                9
            );
        }
    );
    testCase("keeps unfinished SIP metadata refused on real mainnet", async () => {
        const f = fixture({ forked: false });
        await assert.rejects(
            f.builders.getArgsSipPerimeterDelayPart2(f.hre),
            /placeholder metadata/
        );
    });
    testCase(
        "requires original liquidation retention alongside installed changed modules",
        async () => {
            const f = fixture();
            const modules = getProtocolModules();
            f.contracts.get(f.protocol.toLowerCase()).getTarget = async (signature) => {
                if (signature === "liquidate(bytes32,address,uint256)")
                    return originalLiquidation.address;
                if (signature === "rollover(bytes32,bytes)") return originalRollover.address;
                const name = requiredModules.find((name) =>
                    SELECTED_PROTOCOL_SIGNATURES[name].includes(signature)
                );
                assert.ok(name, signature);
                return f.records[name].address;
            };
            const stack = stackFunctions(f);
            await stack.assertLendingReleaseInstalled(f.protocol);
            const healthyInstalled = f.contracts.get(f.protocol.toLowerCase()).getTarget;
            for (const signature of [
                ...Object.values(SELECTED_PROTOCOL_SIGNATURES).flat(),
                "rollover(bytes32,bytes)",
                ...MAINTENANCE_VIEW_SIGNATURES,
            ]) {
                f.contracts.get(f.protocol.toLowerCase()).getTarget = async (s) =>
                    s === signature ? address(77) : healthyInstalled(s);
                await assert.rejects(
                    stack.assertLendingReleaseInstalled(f.protocol),
                    /does not route|retained .*target/
                );
            }
            f.contracts.get(f.protocol.toLowerCase()).getTarget = healthyInstalled;
            const healthy = f.contracts.get(f.protocol.toLowerCase()).getTarget;
            f.contracts.get(f.protocol.toLowerCase()).getTarget = async (signature) =>
                signature === "liquidate(bytes32,address,uint256)"
                    ? address(6)
                    : healthy(signature);
            await assert.rejects(
                stack.assertLendingReleaseInstalled(f.protocol),
                /retained liquidation|original liquidation/i
            );
            f.contracts.get(f.protocol.toLowerCase()).getTarget = healthy;
            f.codes.set(
                originalLiquidation.address.toLowerCase(),
                originalLiquidation.deployedBytecode + "00"
            );
            await assert.rejects(
                stack.assertLendingReleaseInstalled(f.protocol),
                /retained liquidation|original liquidation/i
            );
            f.codes.set(
                originalLiquidation.address.toLowerCase(),
                originalLiquidation.deployedBytecode
            );
            await stack.assertLendingReleaseInstalled(f.protocol);
        }
    );
    testCase(
        "grants both Collector exemption entries atomically with fail-closed paired readback",
        async () => {
            const f = fixture();
            const { grantControllerExemptions } = stackFunctions(f);
            const exemption = { surface: "lender", address: address(42) };
            let grants = 0,
                reads = 0,
                fee = false,
                bypass = false;
            const controller = {
                grantExemption: async (surface, actor) => {
                    assert.equal(surface, exemption.surface);
                    assert.equal(actor, exemption.address);
                    grants++;
                    return {
                        wait: async () => {
                            fee = true;
                            bypass = true;
                        },
                    };
                },
                setActorPolicy: () => assert.fail("separate fee setter"),
                setActorBypass: () => assert.fail("separate delay setter"),
            };
            const paired = async () => {
                reads++;
                assert.ok(fee && bypass);
            };
            await grantControllerExemptions(controller, [exemption], paired);
            assert.equal(grants, 1);
            assert.equal(reads, 1);
            await assert.rejects(
                grantControllerExemptions(
                    {
                        grantExemption: async () => {
                            throw Error("grant refused");
                        },
                    },
                    [exemption],
                    paired
                ),
                /grant refused/
            );
            assert.equal(reads, 1);
            await assert.rejects(
                grantControllerExemptions(controller, [exemption], async () => {
                    throw Error("paired readback missing");
                }),
                /paired readback missing/
            );
        }
    );
});
