/**
 * `perimeter:submit-block` decodes the calldata it is about to submit — not
 * just matches its selector against the allowlist — and `perimeter:check-
 * block` shows the identical decoded view for an already-submitted
 * transaction. Before this fix, both tasks only ever printed a fixed,
 * per-selector English sentence ("This will freeze one account"); two
 * different `--data` blobs sharing a selector but targeting different
 * accounts (or request ids) produced byte-for-byte identical output, so an
 * operator had no way to tell a stale or mismatched paste apart from a
 * correct one from this tool's own display.
 *
 * Run:
 *   npx hardhat test tests/perimeter/BlockCalldataDecoding.test.js
 */
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

const MockExitFeeController = artifacts.require("MockExitFeeController");

/** Redirects `console.log` (what `node-logs` writes through) for the
 *  duration of `fn` and returns everything written, newline-joined. */
const captureConsole = async (fn) => {
    const original = console.log;
    const lines = [];
    console.log = (...args) => {
        lines.push(args.map(String).join(" "));
    };
    try {
        await fn();
    } finally {
        console.log = original;
    }
    return lines.join("\n");
};

describe("perimeter:submit-block / perimeter:check-block decode the calldata they show", () => {
    let queueAddress;
    let multisig;
    let owner;

    before(async () => {
        [owner] = await ethers.getSigners();
        // Stands in for the queue as a transaction destination only —
        // submitting to the multisig never requires it to actually implement
        // anything: a failed inner call still mines, the wallet just leaves
        // it `executed == false` (the same swallowing `engine.js`'s own
        // `viaMultisig` documents).
        const deployed = await MockExitFeeController.new();
        queueAddress = deployed.address;
        const MultiSigWalletFactory = await ethers.getContractFactory("MultiSigWallet");
        multisig = await MultiSigWalletFactory.deploy([owner.address], 1);
        await multisig.deployed();
    });

    it("prints the account a freeze(address) paste actually targets, before submitting it", async () => {
        const target = ethers.Wallet.createRandom().address;
        const data = new ethers.utils.Interface(["function freeze(address)"]).encodeFunctionData(
            "freeze",
            [target]
        );

        const output = await captureConsole(() =>
            hre.run("perimeter:submit-block", {
                queue: queueAddress,
                data,
                signer: owner.address,
                multisig: multisig.address,
            })
        );

        expect(output).to.include(target);
        expect(output).to.include("freeze(address)");
    });

    it("prints both accounts a freeze(address[]) batch actually targets, not just the selector", async () => {
        const a = ethers.Wallet.createRandom().address;
        const b = ethers.Wallet.createRandom().address;
        const data = new ethers.utils.Interface(["function freeze(address[])"]).encodeFunctionData(
            "freeze",
            [[a, b]]
        );

        const output = await captureConsole(() =>
            hre.run("perimeter:submit-block", {
                queue: queueAddress,
                data,
                signer: owner.address,
                multisig: multisig.address,
            })
        );

        expect(output).to.include(a);
        expect(output).to.include(b);
    });

    it("prints the request id, the receiver flag and the reason hash of a freezeFromRequest paste — the hash only, never an explanation of it", async () => {
        // Stands in for a reason an operator would never want narrated back
        // in plain text by this tool — only the hash itself is ever printed.
        const reasonHash = ethers.utils.id("a reason an operator typed for an incident");
        const data = new ethers.utils.Interface([
            "function freezeFromRequest(uint256,bool,bytes32)",
        ]).encodeFunctionData("freezeFromRequest", [42, true, reasonHash]);

        const output = await captureConsole(() =>
            hre.run("perimeter:submit-block", {
                queue: queueAddress,
                data,
                signer: owner.address,
                multisig: multisig.address,
            })
        );

        expect(output).to.include("42");
        expect(output).to.include("freezeReceiver (bool): true");
        expect(output).to.include(reasonHash);
    });

    it("refuses to submit a paste that does not decode as any known queue or controller call", async () => {
        const data = `0xdeadbeef${"00".repeat(64)}`;

        let raised = null;
        try {
            await hre.run("perimeter:submit-block", {
                queue: queueAddress,
                data,
                signer: owner.address,
                multisig: multisig.address,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised, "an undecodable paste must refuse, not submit").to.not.equal(null);
        expect(raised.message).to.match(/does not decode/);
    });

    it("refuses a paste whose selector is a real block lever but whose argument bytes are truncated", async () => {
        // A genuine `freeze(address)` selector followed by too few argument
        // bytes to decode one address — the shape a copy-paste cut short
        // takes, distinct from an unrecognized selector entirely. The old
        // selector-only allowlist would have let this straight through.
        const selector = ethers.utils.id("freeze(address)").slice(0, 10);
        const data = `${selector}${"00".repeat(16)}`;

        let raised = null;
        try {
            await hre.run("perimeter:submit-block", {
                queue: queueAddress,
                data,
                signer: owner.address,
                multisig: multisig.address,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised, "truncated argument bytes must refuse, not submit").to.not.equal(null);
    });

    it("check-block shows the identical decoded view for a transaction submit-block already submitted", async () => {
        const target = ethers.Wallet.createRandom().address;
        const data = new ethers.utils.Interface([
            "function blacklist(address)",
        ]).encodeFunctionData("blacklist", [target]);

        await hre.run("perimeter:submit-block", {
            queue: queueAddress,
            data,
            signer: owner.address,
            multisig: multisig.address,
        });
        const txId = (await multisig.transactionCount()).sub(1).toString();

        const output = await captureConsole(() =>
            hre.run("perimeter:check-block", { id: txId, multisig: multisig.address })
        );

        expect(output).to.include(target);
        expect(output).to.include("blacklist(address)");
    });

    it("check-block still falls back to its generic message for a transaction that is not a block lever", async () => {
        const data = new ethers.utils.Interface([
            "function setExitFeeEnabled(bool)",
        ]).encodeFunctionData("setExitFeeEnabled", [true]);
        await (await multisig.connect(owner).submitTransaction(queueAddress, 0, data)).wait();
        const txId = (await multisig.transactionCount()).sub(1).toString();

        const output = await captureConsole(() =>
            hre.run("perimeter:check-block", { id: txId, multisig: multisig.address })
        );

        expect(output).to.include("NOT an ExitDelayQueue block lever");
    });
});
