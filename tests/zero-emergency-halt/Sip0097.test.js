const { expect } = require("chai");
const { ethers } = require("ethers");
const literalNames = [
    "BorrowerOperations",
    "TroveManager",
    "StabilityPool",
    "ZUSDToken",
    "ZEROToken",
    "ZEROStaking",
    "ActivePool",
    "CollSurplusPool",
    "DefaultPool",
    "FeeDistributor",
    "CommunityIssuance",
    "SortedTroves",
    "PriceFeed",
    "LiquityBaseParams",
    "HintHelpers",
    "MultiTroveGetter",
];
let sip;
describe("SIP0097 fail-closed builders", function () {
    before(function () {
        const file = require.resolve("../../hardhat/tasks/sips/args/sipArgs");
        const exports = require(file);
        expect(exports.getArgsSip0097Part1, "Part1 builder missing").to.be.a("function");
        sip = require("../../hardhat/tasks/sips/args/sip0097");
    });
    it("binds independent ordered sixteen Zero target names with no duplicates", function () {
        expect(sip.MANIFEST.targets.map((x) => x.name)).deep.equal(literalNames);
        expect(sip.MANIFEST.targets.map((x) => x.part)).deep.equal([
            ...Array(10).fill(1),
            ...Array(6).fill(2),
        ]);
        sip.assertManifest(sip.MANIFEST.targets);
    });

    for (const part of [1, 2, 3])
        it("constructs exact independent part " + part + " actions", function () {
            const addresses = [
                "0x5B9dB4B8bdeF3e57323187a9AC2639C5DEe5FD39",
                "0x82B09695ee4F214f3A0803683C4AaEc332E4E0a3",
                "0xd46C0225D1331B46700d64fF8c906709D15C9202",
                "0xdB107FA69E33f05180a4C2cE9c2E7CB481645C2d",
                "0x5815D304D67Ad9240fe273452078Bd648e75e543",
                "0x5369941b2a08db3feC31C4a6cD3b902f7b1468A3",
                "0xf294ea272d6f8FedC08aCf8E93ff50fe99E1f7E8",
                "0x310ec7Fe6e4943DA773De8948255E37CC45e34bb",
                "0xcdbA14ca707B99afb8CA93E178aD614Db422a030",
                "0x1261d5872d56e2Ab61B3C68451D015b752105027",
                "0x9b38044A276fED8bC1703bd4a2DA1b17F2c61d16",
                "0xdeEB95480B94f9395514Fe35CAF692A1C788DfE9",
                "0x6D1d9574d67e04cf35Fa1d916F763eDDae03b75d",
                "0xf8B04A36c36d5DbD1a9Fe7B74897c609d6A17aa2",
                "0x1D7DaC5a63A35540bE9e031212ecf39584AE5595",
                "0xF265a169191348c02829B62650B025BdeAf00AE4",
            ];
            const blocker = "0x1111111111111111111111111111111111111111",
                a = sip.actionsForPart(part, blocker),
                expected =
                    part === 1 ? [] : part === 2 ? addresses.slice(0, 10) : addresses.slice(10);
            const ammCount = part === 1 ? 3 : 0;
            expect(a.targets.length).to.equal([3, 10, 6][part - 1]);
            expect(a.targets.length).to.be.at.most(10);
            expect(a.targets.slice(ammCount)).deep.equal(expected);
            expect(a.values).deep.equal(Array(expected.length + ammCount).fill(0));
            expect(a.signatures.slice(ammCount)).deep.equal(
                Array(expected.length).fill("setImplementation(address)")
            );
            expect(a.targetOwnerValidationAddresses.slice(ammCount)).deep.equal(
                Array(expected.length).fill("0x967c84b731679E36A344002b8E3CE50620A7F69f")
            );
            expect(a.data.slice(ammCount)).deep.equal(
                Array(expected.length).fill(
                    ethers.utils.defaultAbiCoder.encode(["address"], [blocker])
                )
            );
        });
    it("pins the verified deployed blocker and finalized immutable publication", function () {
        expect(sip.RELEASE_ADDRESS).to.equal("0xe0e757e8fcf336658036202834aee10ce03debda");
        expect(sip.DOCUMENT.finalized).to.equal(true);
        expect(sip.DOCUMENT.commit).to.equal("e6b41d1f1e79d0527bcd7b1f1622cbe7fc208721");
        expect(sip.DOCUMENT.sha256).to.equal(
            "050339bbcd1895bfa4008b7000142ed38558964697b452943bf33973b32c52ac"
        );
    });
    it("rejects an omitted target and duplicate target", function () {
        expect(() => sip.assertManifest(sip.MANIFEST.targets.slice(1))).to.throw("manifest");
        const a = sip.MANIFEST.targets.map((x) => ({ ...x }));
        a[1].address = a[0].address;
        expect(() => sip.assertManifest(a)).to.throw("manifest");
    });
    it("rejects unsupported networks", async function () {
        await expect(
            sip.build(
                {
                    network: { name: "testnet" },
                    ethers: { provider: { getNetwork: async () => ({ chainId: 31 }) } },
                },
                1
            )
        ).rejectedWith("network");
    });
    for (const url of [
        "https://mainnet-dev.sovryn.app/rpc",
        "http://192.168.1.1:8545",
        "http://127.0.0.1.evil:8545",
        "http://user:pass@127.0.0.1:8545",
    ])
        it("rejects unsafe local endpoint " + url, async function () {
            await expect(sip.assertLocalFork({ network: { config: { url } } }, {})).rejectedWith(
                "loopback"
            );
        });
    for (const [chainId, client, hash, reason] of [
        [30, "anvil", null, "local chain must be 31337"],
        [31337, "Geth", null, "local client required"],
        [31337, "anvil", "0x01", "fork block binding mismatch"],
    ]) {
        it(`rejects fork identity mismatch: ${reason}`, async function () {
            const pin = sip.MANIFEST;
            const h = {
                network: { config: { url: "http://127.0.0.1:18597" } },
                ethers: {
                    provider: {
                        getNetwork: async () => ({ chainId }),
                        send: async () => client,
                        getBlock: async () => ({ hash: hash || pin.hash }),
                        getCode: async () => {
                            throw new Error(
                                "governance binding reached after invalid block identity"
                            );
                        },
                    },
                },
            };
            await expect(sip.assertLocalFork(h, pin)).rejectedWith(reason);
        });
    }
    for (const block of [
        require("../../hardhat/tasks/sips/args/sip0097").MANIFEST.block,
        9378980,
        require("../../hardhat/tasks/sips/args/sip0097").MANIFEST.block + 1,
    ])
        it(`requires a fresh owned fork at the manifest block: ${block}`, async function () {
            const h = {
                network: { config: { url: "http://127.0.0.1:28697" } },
                ethers: {
                    provider: {
                        getNetwork: async () => ({ chainId: 31337 }),
                        send: async (method) =>
                            method === "web3_clientVersion"
                                ? "anvil/v1"
                                : ethers.utils.hexValue(block),
                        getBlock: async () => ({ hash: sip.MANIFEST.hash }),
                    },
                },
            };
            expect(sip.assertFreshFork).to.be.a("function");
            if (block === sip.MANIFEST.block) await sip.assertFreshFork(h, sip.MANIFEST);
            else await expect(sip.assertFreshFork(h, sip.MANIFEST)).rejectedWith("fresh fork");
        });
});

describe("SIP0097 identity rejection cases", function () {
    let module, provider, halt;
    before(async function () {
        module = require("../../hardhat/tasks/sips/args/sip0097");
        halt =
            require("../../external/artifacts/ZeroEmergencyHalt.sol/ZeroEmergencyHalt.json").deployedBytecode;
    });
    beforeEach(function () {
        provider = { getCode: async () => halt };
    });
    for (const address of [ethers.constants.AddressZero, "invalid"])
        it("rejects invalid blocker " + address, async function () {
            await expect(module.validateTargets(provider, address, 1)).rejectedWith(
                "invalid blocker"
            );
        });
    it("rejects proxy self pointers", async function () {
        await expect(
            module.validateTargets(provider, module.MANIFEST.targets[0].address, 1)
        ).rejectedWith("self blocker");
    });
    for (const code of ["0x", "0x00", "0x6000"])
        it("rejects EOA/wrong runtime " + code, async function () {
            provider.getCode = async () => code;
            await expect(
                module.validateTargets(provider, "0x1111111111111111111111111111111111111111", 1)
            ).rejectedWith("blocker runtime");
        });
    it("rejects proxy runtime drift", async function () {
        await expect(
            module.validateTargets(provider, "0x1111111111111111111111111111111111111111", 1)
        ).rejectedWith("proxy runtime drift");
    });
    for (const field of ["owner", "implementation"])
        it("rejects " + field + " drift", async function () {
            const t = module.MANIFEST.targets[0],
                proxy = require("../../external/deployments/rskMainnet/BorrowerOperations_Proxy.json");
            provider._isProvider = true;
            provider.getCode = async (a) => (a === t.address ? proxy.deployedBytecode : halt);
            provider.resolveName = async (a) => a;
            provider.call = async (tx) =>
                ethers.utils.defaultAbiCoder.encode(
                    ["address"],
                    [
                        tx.data === "0x893d20e8" && field === "implementation"
                            ? t.owner
                            : ethers.constants.AddressZero,
                    ]
                );
            await expect(
                module.validateTargets(provider, "0x1111111111111111111111111111111111111111", 1)
            ).rejectedWith(field + " drift");
        });
});

describe("SIP0097 combined AMM actions", function () {
    it("puts only the reviewed Network, Formula and Data keys in the AMM part", function () {
        const sip = require("../../hardhat/tasks/sips/args/sip0097");
        const a = sip.actionsForPart(1, "0x1111111111111111111111111111111111111111");
        expect(a.targets.slice(0, 3)).deep.equal(
            Array(3).fill("0x46ebc03ef2277308bdb106a73d11c65109c4b89b")
        );
        expect(a.signatures).deep.equal([...Array(3).fill("registerAddress(bytes32,address)")]);
        expect(a.targetOwnerValidationAddresses.slice(0, 3)).deep.equal(
            Array(3).fill("0x967c84b731679E36A344002b8E3CE50620A7F69f")
        );
        const keys = [
            "0x536f7672796e537761704e6574776f726b000000000000000000000000000000",
            "0x536f7672796e53776170466f726d756c61000000000000000000000000000000",
            "0x536f7672796e53776170436f6e76657274657252656769737472794461746100",
        ];
        for (let i = 0; i < 3; i++) {
            expect(a.data[i]).to.equal(
                ethers.utils.defaultAbiCoder.encode(
                    ["bytes32", "address"],
                    [keys[i], "0x8c293ed020f4d7321b6b16c71584fddb560e0ebd"]
                )
            );
            expect(ethers.utils.hexDataLength(a.data[i])).to.equal(64);
        }
        expect(
            a.signatures.some((s) => /transfer|approve|feesController|SwapSettings/.test(s))
        ).to.equal(false);
        expect(a.targets).to.have.length(3);
    });
});

describe("SIP0097 independent composition", function () {
    it("exports three builders with 3, 10 and 6 actions", function () {
        const args = require("../../hardhat/tasks/sips/args/sipArgs");
        const sip = require("../../hardhat/tasks/sips/args/sip0097");
        expect(args.getArgsSip0098Part1).to.equal(undefined);
        expect(args.getArgsSip0098Part2).to.equal(undefined);
        for (const part of [1, 2, 3]) {
            expect(args[`getArgsSip0097Part${part}`]).to.be.a("function");
            expect(
                sip.actionsForPart(part, "0xe0e757e8fcf336658036202834aee10ce03debda").targets
                    .length
            ).to.equal([3, 10, 6][part - 1]);
        }
    });
});
