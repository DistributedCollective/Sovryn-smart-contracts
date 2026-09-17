/**
 * `perimeter:submit-block` and `perimeter:check-block` resolve `--multisig`
 * the same way `perimeter:verify-arming` resolves `--controller`: an
 * explicitly supplied value that fails `isAddress` must refuse outright, and
 * only an OMITTED value may fall back to the saved `MultiSigWallet`
 * deployment record. Before this fix, both tasks used
 * `isAddress(multisig) ? multisig : (await get("MultiSigWallet")).address`,
 * which treats a missing --multisig and a mistyped one identically — an
 * operator meaning to certify a specific wallet who fat-fingers the address
 * would silently submit against (or inspect) whatever the saved deployment
 * happens to name instead.
 *
 * Run:
 *   npx hardhat test tests/perimeter/BlockTasksMultisigResolution.test.js
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const MockExitFeeController = artifacts.require("MockExitFeeController");

const thrownBy = async (task, params) => {
    try {
        await hre.run(task, params);
    } catch (thrown) {
        return thrown;
    }
    return null;
};

describe("perimeter:check-block's --multisig resolution", () => {
    it("throws on an explicitly supplied --multisig that is not a valid address", async () => {
        const error = await thrownBy("perimeter:check-block", {
            id: "0",
            multisig: "not-an-address",
        });
        expect(error, "a malformed --multisig must refuse, not fall back").to.not.be.null;
        expect(error.message).to.match(/not a valid address/);
    });

    it("throws on an explicitly supplied EMPTY --multisig instead of falling back", async () => {
        const error = await thrownBy("perimeter:check-block", { id: "0", multisig: "" });
        expect(error, "an empty --multisig must refuse, not fall back").to.not.be.null;
        expect(error.message).to.match(/not a valid address/);
    });

    it("still falls back to the saved deployment record when --multisig is omitted", async () => {
        const error = await thrownBy("perimeter:check-block", { id: "0" });
        // Whatever the fallback path itself does or does not find on this test
        // network, it must never be the malformed-address refusal above — that
        // refusal is reserved for an explicit, invalid value.
        if (error) {
            expect(error.message).to.not.match(/not a valid address/);
        }
    });
});

describe("perimeter:submit-block's --multisig resolution", () => {
    let queueAddress;
    let data;

    before(async () => {
        // submit-block only requires that --queue carries contract code before
        // it ever reaches --multisig resolution; it never has to be a real
        // ExitDelayQueue for this test, since the malformed --multisig case
        // refuses before sending anything.
        const deployed = await MockExitFeeController.new();
        queueAddress = deployed.address;
        // A calldata blob whose SELECTOR matches a known block lever
        // (freeze(address)) — enough to pass the allowlist check without
        // needing arguments that actually decode to anything meaningful.
        data = ethers.utils.id("freeze(address)").slice(0, 10) + "0".repeat(64);
    });

    it("throws on an explicitly supplied --multisig that is not a valid address", async () => {
        const error = await thrownBy("perimeter:submit-block", {
            queue: queueAddress,
            data,
            multisig: "not-an-address",
        });
        expect(error, "a malformed --multisig must refuse, not fall back").to.not.be.null;
        expect(error.message).to.match(/not a valid address/);
    });

    it("throws on an explicitly supplied EMPTY --multisig instead of falling back", async () => {
        const error = await thrownBy("perimeter:submit-block", {
            queue: queueAddress,
            data,
            multisig: "",
        });
        expect(error, "an empty --multisig must refuse, not fall back").to.not.be.null;
        expect(error.message).to.match(/not a valid address/);
    });

    it("still falls back to the saved deployment record when --multisig is omitted", async () => {
        const error = await thrownBy("perimeter:submit-block", { queue: queueAddress, data });
        if (error) {
            expect(error.message).to.not.match(/not a valid address/);
        }
    });
});
