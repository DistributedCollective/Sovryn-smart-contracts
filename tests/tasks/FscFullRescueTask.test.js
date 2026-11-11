const assert = require("assert");
const { ethers } = require("hardhat");
const { configuredSigner } = require("../../hardhat/tasks/fsc-full-rescue");
describe("full rescue signer selection", function () {
    it("unknown named signer cannot default silently to account zero", async function () {
        let called = false;
        const fake = {
            ethers: {
                utils: ethers.utils,
                getSigner: async () => {
                    called = true;
                },
            },
            getNamedAccounts: async () => ({}),
        };
        await assert.rejects(configuredSigner(fake, "typo"), /not found/);
        assert.equal(called, false);
    });
    it("an explicit valid named account is selected exactly", async function () {
        const a = "0x" + "11".repeat(20);
        let received;
        const fake = {
            ethers: {
                utils: ethers.utils,
                getSigner: async (x) => {
                    received = x;
                    return { address: x };
                },
            },
            getNamedAccounts: async () => ({ owner: a }),
        };
        const s = await configuredSigner(fake, "owner");
        assert.equal(received, a);
        assert.equal(s.address, a);
    });
});
