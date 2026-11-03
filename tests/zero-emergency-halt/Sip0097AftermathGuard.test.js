const { assertNoSigningInputs } = require("../../scripts/zero-emergency-halt/keyless");
assertNoSigningInputs();
const { expect } = require("chai");
const sip = require("../../hardhat/tasks/sips/args/sip0097");

describe("SIP0097 downstream manual controls refuse unsafe mutation contexts", function () {
    for (const [field, value, reason] of [
        ["url", "https://mainnet-dev.sovryn.app/rpc", "loopback"],
        ["chainId", 30, "local chain must be 31337"],
        ["client", "Geth/v1", "local client required"],
        ["hash", "0x" + "00".repeat(32), "fork block binding mismatch"],
    ])
        it(`rejects ${field} before any state-changing RPC`, async function () {
            const file = "../../tests-onchain/helpers/Sip0097Aftermath";
            let helper;
            try {
                delete require.cache[require.resolve(file)];
                helper = require(file);
            } catch (error) {
                if (error.code !== "MODULE_NOT_FOUND") throw error;
                helper = {};
            }
            expect(helper.initialize, "downstream guard entry point missing").to.be.a("function");
            const config = {
                url: "http://127.0.0.1:28697",
                chainId: 31337,
                client: "anvil/v1",
                hash: sip.MANIFEST.hash,
                [field]: value,
            };
            let mutations = 0;
            const provider = {
                connection: { url: config.url },
                getNetwork: async () => ({ chainId: config.chainId }),
                getBlock: async () => ({ hash: config.hash }),
                send: async (method) => {
                    if (method === "web3_clientVersion") return config.client;
                    mutations++;
                    throw new Error("unsafe RPC reached: " + method);
                },
            };
            await expect(
                helper.initialize({
                    provider,
                    guard: async () => {},
                    actor: {},
                    tx: async () => {
                        mutations++;
                    },
                })
            ).to.be.rejectedWith(reason);
            expect(mutations).to.equal(0);
        });
});
