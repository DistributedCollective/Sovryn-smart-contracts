const { assertNoSigningInputs } = require("../../scripts/zero-emergency-halt/keyless");
assertNoSigningInputs();
const { expect } = require("chai");
const deploy = require("../../deployment/deploy/2161-deploy-AMMEmergencyHalt");
const record = require("../../deployment/deployments/rskSovrynMainnet/AMMEmergencyHalt.json");
const ADDRESS = "0x8c293ed020f4d7321b6b16c71584fddb560e0ebd";

function mainnet({ saved = record, code = record.deployedBytecode } = {}) {
    return {
        getChainId: async () => "30",
        getNamedAccounts: async () => {
            throw new Error("unexpected signing-account access");
        },
        ethers: {
            provider: {
                getCode: async (address) => {
                    if (address.toLowerCase() !== ADDRESS)
                        throw new Error("unexpected code address");
                    return code;
                },
            },
        },
        deployments: {
            getOrNull: async (name) => {
                if (name !== "AMMEmergencyHalt") throw new Error("unexpected deployment name");
                return saved;
            },
            deploy: async () => {
                throw new Error("unexpected deployment attempt");
            },
            log: () => {},
        },
    };
}

describe("AMMEmergencyHalt deployment reuse", function () {
    it("reuses the verified mainnet contract without accessing a signer or deploying", async function () {
        await deploy(mainnet());
    });
    it("rejects a missing canonical deployment record", async function () {
        await expect(deploy(mainnet({ saved: null }))).to.be.rejectedWith(
            "missing mainnet deployment record"
        );
    });
    it("rejects a record pointing to a different mainnet address", async function () {
        await expect(
            deploy(
                mainnet({
                    saved: { ...record, address: "0x1111111111111111111111111111111111111111" },
                })
            )
        ).to.be.rejectedWith("mainnet deployment address mismatch");
    });
    it("rejects missing or changed on-chain runtime instead of deploying a replacement", async function () {
        for (const code of ["0x", "0x60006000"]) {
            await expect(deploy(mainnet({ code }))).to.be.rejectedWith("mainnet runtime mismatch");
        }
    });
});
