/**
 * Isolated regression for `role`'s guard logic: every refusal below
 * fires before role ever impersonates a signer or sends a transaction, so a
 * fake `s` (controller.owner() plus state.multisig) is enough — no fork, no
 * `--network`.
 *
 * Run:
 *   npx hardhat test tests-onchain/perimeter/qa/engineRoleGuards.test.js
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

const engine = require("./engine");

const MULTISIG = ethers.utils.getAddress(ethers.utils.hexZeroPad("0x111", 20));
const OTHER = ethers.utils.getAddress(ethers.utils.hexZeroPad("0x222", 20));
const TARGET = ethers.utils.getAddress(ethers.utils.hexZeroPad("0x333", 20));

const fakeS = (currentOwner) => ({
    controller: { owner: async () => currentOwner },
    state: { multisig: MULTISIG },
});

const expectRefusal = async (promise, pattern) => {
    let raised = null;
    try {
        await promise;
    } catch (error) {
        raised = error;
    }
    expect(raised, "expected an upfront refusal").to.not.equal(null);
    expect(raised.message).to.match(pattern);
};

describe("QA scenario engine — role guards", () => {
    it("refuses --owner and --restore together", async () => {
        await expectRefusal(
            engine.role(fakeS(MULTISIG), { owner: TARGET, restore: true }),
            /pass --owner <address> or --restore, not both/
        );
    });

    it("refuses neither --owner nor --restore", async () => {
        await expectRefusal(
            engine.role(fakeS(MULTISIG), {}),
            /pass --owner <address> or --restore/
        );
    });

    it("refuses a --owner that is not an address", async () => {
        await expectRefusal(
            engine.role(fakeS(MULTISIG), { owner: "not-an-address" }),
            /pass --owner <address> or --restore/
        );
    });

    it("--owner refuses when the controller is not currently owned by the Exchequer multisig", async () => {
        await expectRefusal(
            engine.role(fakeS(OTHER), { owner: TARGET }),
            /Owner is already .* not the Exchequer multisig — restore it first/i
        );
    });

    it("--restore refuses when the controller already reads the Exchequer multisig as its owner", async () => {
        await expectRefusal(
            engine.role(fakeS(MULTISIG), { restore: true }),
            /already the Exchequer multisig — nothing to restore/
        );
    });
});
