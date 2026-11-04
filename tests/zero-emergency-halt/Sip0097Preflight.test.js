const { expect } = require("chai");
const { ethers } = require("ethers");
const sip = require("../../hardhat/tasks/sips/args/sip0097");
const runtimeFixture = require("./fixtures/Sip0097Runtimes.json");
const runtimes = Object.fromEntries(
    Object.entries(runtimeFixture.addresses).map(([a, hash]) => [
        a,
        runtimeFixture.byHash[hash] ||
            require("../../" + runtimeFixture.records[hash]).deployedBytecode,
    ])
);
const BLOCKER = "0x1111111111111111111111111111111111111111";
const ZERO = ethers.constants.AddressZero;
const HASH = "0x" + "ab".repeat(32);
const LOWER = (a) => a.toLowerCase();
const registryInterface = new ethers.utils.Interface([
    "function owner() view returns(address)",
    "function newOwner() view returns(address)",
    "function addressOf(bytes32) view returns(address)",
]);
const nativeInterface = new ethers.utils.Interface(sip.PROXY_ABI);
const fscInterface = new ethers.utils.Interface([
    "function owner() view returns(address)",
    "function getProxyOwner() view returns(address)",
    "function getImplementation() view returns(address)",
    "function getWhitelistedConverterList() view returns(address[])",
]);
const governorInterface = new ethers.utils.Interface([
    "function timelock() view returns(address)",
    "function proposalMaxOperations() view returns(uint)",
]);
const timelockInterface = new ethers.utils.Interface([
    "function admin() view returns(address)",
    "function delay() view returns(uint)",
]);
const settingsInterface = new ethers.utils.Interface([
    "function feesController() view returns(address)",
]);

// A read-only RPC fixture: real captured runtime bytes, ABI-encoded native getters,
// and no transaction methods. Unknown addresses/selectors fail closed.
function fixture(halt) {
    const code = { ...runtimes, [BLOCKER]: halt, [sip.RELEASE_ADDRESS]: halt };
    const state = {
        registryOwner: "0x967c84b731679E36A344002b8E3CE50620A7F69f",
        newOwner: ZERO,
        registrySelf: sip.AMM.registry.address,
        keys: Object.fromEntries(sip.AMM.keys.map((k) => [k.key, k.address])),
        settings: sip.AMM.settings.address,
        feesController: sip.AMM.fsc.address,
        fscOwner: sip.AMM.fsc.owner,
        fscProxyOwner: sip.AMM.fsc.owner,
        fscImplementation: sip.AMM.fsc.implementation,
        whitelist: [],
        implementations: Object.fromEntries(
            sip.MANIFEST.targets.map((t) => [LOWER(t.address), t.implementation])
        ),
        owners: Object.fromEntries(sip.MANIFEST.targets.map((t) => [LOWER(t.address), t.owner])),
        governorTimelock: sip.MANIFEST.bindings.TimelockOwner.address,
        timelockAdmin: sip.MANIFEST.bindings.GovernorOwner.address,
        maxOperations: 10,
        delay: 172800,
        reorg: false,
    };
    const reads = [];
    const answer = (abi, tx, values) => {
        const parsed = abi.parseTransaction(tx);
        if (!(parsed.name in values)) throw new Error("unexpected getter " + parsed.name);
        return abi.encodeFunctionResult(parsed.name, [values[parsed.name]]);
    };
    const provider = {
        _isProvider: true,
        getNetwork: async () => ({ chainId: 31337 }),
        send: async (method) => {
            if (method !== "web3_clientVersion") throw new Error("unexpected RPC method");
            return "anvil/v1";
        },
        resolveName: async (address) => address,
        getBlock: async (tag) => {
            if (tag === sip.MANIFEST.block) return { number: tag, hash: sip.MANIFEST.hash };
            return {
                number: 10000000,
                hash: tag === "latest" || !state.reorg ? HASH : "0x" + "cd".repeat(32),
            };
        },
        getCode: async (address, blockTag) => {
            reads.push(blockTag);
            if (!code[LOWER(address)]) throw new Error("unexpected code address " + address);
            return code[LOWER(address)];
        },
        call: async (tx, blockTag) => {
            reads.push(blockTag);
            const to = LOWER(tx.to);
            if (to === LOWER(sip.AMM.registry.address)) {
                const parsed = registryInterface.parseTransaction(tx);
                if (parsed.name === "addressOf") {
                    const key = parsed.args[0];
                    const value =
                        key === ethers.utils.formatBytes32String("ContractRegistry")
                            ? state.registrySelf
                            : key === ethers.utils.formatBytes32String("SwapSettings")
                              ? state.settings
                              : state.keys[key];
                    if (!value) throw new Error("unexpected registry key " + key);
                    return registryInterface.encodeFunctionResult("addressOf", [value]);
                }
                return answer(registryInterface, tx, {
                    owner: state.registryOwner,
                    newOwner: state.newOwner,
                });
            }
            if (to === LOWER(sip.AMM.settings.address))
                return answer(settingsInterface, tx, { feesController: state.feesController });
            if (to === LOWER(sip.AMM.fsc.address))
                return answer(fscInterface, tx, {
                    owner: state.fscOwner,
                    getProxyOwner: state.fscProxyOwner,
                    getImplementation: state.fscImplementation,
                    getWhitelistedConverterList: state.whitelist,
                });
            if (to === LOWER(sip.MANIFEST.bindings.GovernorOwner.address))
                return answer(governorInterface, tx, {
                    timelock: state.governorTimelock,
                    proposalMaxOperations: state.maxOperations,
                });
            if (to === LOWER(sip.MANIFEST.bindings.TimelockOwner.address))
                return answer(timelockInterface, tx, {
                    admin: state.timelockAdmin,
                    delay: state.delay,
                });
            if (!(to in state.implementations)) throw new Error("unexpected call address " + to);
            return answer(nativeInterface, tx, {
                getOwner: state.owners[to],
                getImplementation: state.implementations[to],
            });
        },
    };
    const hre = {
        ethers: { provider },
        network: { name: "localFork", config: { url: "http://127.0.0.1:18597" } },
        sip0097Local: { address: BLOCKER, pin: sip.MANIFEST },
        deployments: {
            get: async () => ({ address: sip.MANIFEST.bindings.GovernorOwner.address }),
        },
    };
    return { state, code, provider, hre, reads };
}

describe("SIP0097 combined read-only preflight", function () {
    let halt, f;
    before(async function () {
        halt =
            require("../../external/artifacts/ZeroEmergencyHalt.sol/ZeroEmergencyHalt.json").deployedBytecode;
    });
    beforeEach(function () {
        f = fixture(halt);
    });

    for (const selected of [1, 2, 3]) {
        it(`accepts completed other groups when preparing part ${selected}`, async function () {
            if (selected !== 1)
                for (const k of sip.AMM.keys) f.state.keys[k.key] = sip.AMM.inert.address;
            for (const t of sip.MANIFEST.targets)
                if (t.part + 1 !== selected) f.state.implementations[LOWER(t.address)] = BLOCKER;
            await sip.preflight(f.provider, BLOCKER, selected);
        });
        it(`rejects already completed selected part ${selected}`, async function () {
            if (selected === 1)
                for (const k of sip.AMM.keys) f.state.keys[k.key] = sip.AMM.inert.address;
            else
                for (const t of sip.MANIFEST.targets.filter((t) => t.part + 1 === selected))
                    f.state.implementations[LOWER(t.address)] = BLOCKER;
            await expect(sip.preflight(f.provider, BLOCKER, selected)).rejectedWith("selected");
        });
    }
    for (const group of [1, 2])
        it(`rejects partially completed Zero group ${group}`, async function () {
            const target = sip.MANIFEST.targets.find((t) => t.part === group);
            f.state.implementations[LOWER(target.address)] = BLOCKER;
            await expect(sip.preflight(f.provider, BLOCKER, 1)).rejectedWith("partial Zero group");
        });
    it("allows AMM preparation after both complete Zero groups", async function () {
        for (const t of sip.MANIFEST.targets) f.state.implementations[LOWER(t.address)] = BLOCKER;
        await sip.preflight(f.provider, BLOCKER, 1);
    });
    it("allows Zero preparation after the complete AMM group", async function () {
        for (const k of sip.AMM.keys) f.state.keys[k.key] = sip.AMM.inert.address;
        await sip.preflight(f.provider, BLOCKER, 2);
    });
    it("rejects an omitted Formula in an otherwise halted AMM group", async function () {
        for (const k of [sip.AMM.keys[0], sip.AMM.keys[2]])
            f.state.keys[k.key] = sip.AMM.inert.address;
        await expect(sip.preflight(f.provider, BLOCKER, 2)).rejectedWith("partial AMM state");
    });
    it("prepares both parts at a single rechecked state snapshot without signing", async function () {
        for (const part of [1, 2, 3]) {
            expect(sip.preflight, "read-only snapshot preflight missing").to.be.a("function");
            const snapshot = await sip.preflight(f.provider, BLOCKER, part);
            expect(snapshot).deep.equal({ block: 10000000, hash: HASH });
        }
        expect(f.reads.length).to.be.greaterThan(60);
        expect(f.reads.every((tag) => tag === 10000000)).to.equal(true);
    });
    it("allows Part3 after all ten Part2 blockers using only native Zero getters", async function () {
        for (const t of sip.MANIFEST.targets.filter((t) => t.part === 1))
            f.state.implementations[LOWER(t.address)] = BLOCKER;
        const result = await sip.build(f.hre, 3);
        expect(result.args.targets).to.have.length(6);
        expect(result.governor).to.equal("GovernorOwner");
        expect(result.args.description).to.include("Temporary Pause of the AMM and Zero");
        expect(result.args.description).to.include("LOCAL FORK DRAFT ONLY");
        expect(result.args.description).to.include("e6b41d1f1e79d0527bcd7b1f1622cbe7fc208721");
        expect(result.args.description).to.include(
            "050339bbcd1895bfa4008b7000142ed38558964697b452943bf33973b32c52ac"
        );
        expect(result.args.description).to.include("execution");
    });
    it("does not treat a prior preparation as an execution-time whitelist check", async function () {
        await sip.build(f.hre, 2);
        f.state.whitelist = ["0x98ace08d2b759a265ae326f010496bcd63c15afc"];
        await expect(sip.build(f.hre, 2)).rejectedWith("whitelist must remain empty");
    });
    for (const part of [1, 2, 3])
        it("checks the whitelist when preparing Part" + part, async function () {
            f.state.whitelist = [BLOCKER];
            await expect(sip.build(f.hre, part)).rejectedWith("whitelist must remain empty");
        });
    const changes = [
        [
            "registry owner",
            (f) => {
                f.state.registryOwner = ZERO;
            },
            "registry owner drift",
        ],
        [
            "pending registry owner",
            (f) => {
                f.state.newOwner = BLOCKER;
            },
            "registry pending owner drift",
        ],
        [
            "registry self",
            (f) => {
                f.state.registrySelf = BLOCKER;
            },
            "registry self binding drift",
        ],
        [
            "registry runtime",
            (f) => {
                f.code[LOWER(sip.AMM.registry.address)] = "0x00";
            },
            "registry runtime drift",
        ],
        [
            "inert runtime",
            (f) => {
                f.code[LOWER(sip.AMM.inert.address)] = "0x00";
            },
            "inert runtime drift",
        ],
        ...[0, 1, 2].flatMap((i) => [
            [
                "key " + i,
                (f) => {
                    f.state.keys[sip.AMM.keys[i].key] = BLOCKER;
                },
                "key binding drift",
            ],
            [
                "key code " + i,
                (f) => {
                    f.code[LOWER(sip.AMM.keys[i].address)] = "0x00";
                },
                "dependency runtime drift",
            ],
        ]),
        [
            "settings key",
            (f) => {
                f.state.settings = BLOCKER;
            },
            "settings binding drift",
        ],
        [
            "settings runtime",
            (f) => {
                f.code[LOWER(sip.AMM.settings.address)] = "0x00";
            },
            "settings runtime drift",
        ],
        [
            "fee controller",
            (f) => {
                f.state.feesController = BLOCKER;
            },
            "fee controller drift",
        ],
        [
            "collector owner",
            (f) => {
                f.state.fscOwner = ZERO;
            },
            "collector owner drift",
        ],
        [
            "collector proxy owner",
            (f) => {
                f.state.fscProxyOwner = ZERO;
            },
            "collector proxy owner drift",
        ],
        [
            "collector runtime",
            (f) => {
                f.code[LOWER(sip.AMM.fsc.address)] = "0x00";
            },
            "collector runtime drift",
        ],
        [
            "collector implementation",
            (f) => {
                f.state.fscImplementation = BLOCKER;
            },
            "collector implementation drift",
        ],
        [
            "collector implementation runtime",
            (f) => {
                f.code[LOWER(sip.AMM.fsc.implementation)] = "0x00";
            },
            "collector implementation runtime drift",
        ],
        [
            "governor code",
            (f) => {
                f.code[LOWER(sip.MANIFEST.bindings.GovernorOwner.address)] = "0x00";
            },
            "governance runtime binding mismatch",
        ],
        [
            "governor timelock",
            (f) => {
                f.state.governorTimelock = ZERO;
            },
            "governor timelock drift",
        ],
        [
            "timelock admin",
            (f) => {
                f.state.timelockAdmin = ZERO;
            },
            "timelock admin drift",
        ],
        [
            "action limit",
            (f) => {
                f.state.maxOperations = 9;
            },
            "governor action limit drift",
        ],
        [
            "timelock delay",
            (f) => {
                f.state.delay = 0;
            },
            "timelock delay drift",
        ],
        [
            "last Zero proxy runtime",
            (f) => {
                f.code[LOWER(sip.MANIFEST.targets[15].address)] = "0x00";
            },
            "proxy runtime drift",
        ],
        [
            "Zero owner",
            (f) => {
                f.state.owners[LOWER(sip.MANIFEST.targets[15].address)] = ZERO;
            },
            "owner drift",
        ],
        [
            "Zero implementation",
            (f) => {
                f.state.implementations[LOWER(sip.MANIFEST.targets[15].address)] = ZERO;
            },
            "implementation drift",
        ],
        [
            "Zero implementation code",
            (f) => {
                f.code[LOWER(sip.MANIFEST.targets[15].implementation)] = "0x00";
            },
            "implementation runtime drift",
        ],
    ];
    for (const [name, mutate, reason] of changes)
        it("rejects " + name + " drift", async function () {
            mutate(f);
            await expect(sip.build(f.hre, 2)).rejectedWith(reason);
        });
    it("rejects a reorganization during preparation", async function () {
        f.state.reorg = true;
        await expect(sip.build(f.hre, 2)).rejectedWith("snapshot changed");
    });
    it("rejects a mismatched GovernorOwner deployment alias", async function () {
        f.hre.deployments.get = async () => ({ address: BLOCKER });
        await expect(sip.build(f.hre, 2)).rejectedWith(
            "GovernorOwner deployment binding mismatch"
        );
    });
    it("rejects a Part1 blocker on an unexecuted Part2 target", async function () {
        f.state.implementations[LOWER(sip.MANIFEST.targets[10].address)] = BLOCKER;
        await expect(sip.build(f.hre, 2)).rejectedWith("partial Zero group state");
    });
    it("rejects an already installed blocker when preparing Part1", async function () {
        f.state.implementations[LOWER(sip.MANIFEST.targets[0].address)] = BLOCKER;
        await expect(sip.build(f.hre, 1)).rejectedWith("partial Zero group state");
    });
    it("rejects a mixed Part1 state when preparing atomic Part2", async function () {
        f.state.implementations[LOWER(sip.MANIFEST.targets[0].address)] = BLOCKER;
        await expect(sip.build(f.hre, 2)).rejectedWith("partial Zero group state");
    });
    it("rejects a local override against chain30", async function () {
        f.provider.getNetwork = async () => ({ chainId: 30 });
        await expect(sip.build(f.hre, 2)).rejectedWith("local chain must be 31337");
    });
    it("rejects a local pin that is not the reviewed baseline", async function () {
        f.hre.sip0097Local.pin = { block: 1, hash: HASH };
        await expect(sip.build(f.hre, 2)).rejectedWith("fork pin must match");
    });
    for (const part of [1, 2, 3])
        it(`prepares exact production part ${part} read-only and ignores runtime overrides`, async function () {
            delete f.hre.sip0097Local;
            f.hre.network.name = "rskSovrynMainnet";
            f.provider.getNetwork = async () => ({ chainId: 30 });
            f.hre.sip0097Release = {
                address: BLOCKER,
                document: { commit: "a".repeat(40), sha256: "a".repeat(64), finalized: false },
            };
            const built = await sip.build(f.hre, part);
            expect(built.governor).to.equal("GovernorOwner");
            const { description, ...actions } = built.args;
            expect(actions).deep.equal(sip.actionsForPart(part, sip.RELEASE_ADDRESS));
            expect(description).not.to.include("LOCAL FORK");
            expect(description).to.include(sip.DOCUMENT.commit);
            expect(description).to.include(sip.DOCUMENT.sha256);
            expect(description).not.to.include("a".repeat(40));
            expect(f.reads.length).to.be.greaterThan(0);
            expect(f.reads.every((tag) => tag === 10000000)).to.equal(true);
        });
    it("rejects invalid preflight parts before provider reads", async function () {
        expect(sip.preflight, "read-only snapshot preflight missing").to.be.a("function");
        await expect(sip.preflight({}, BLOCKER, 4)).rejectedWith("invalid part");
    });
});
