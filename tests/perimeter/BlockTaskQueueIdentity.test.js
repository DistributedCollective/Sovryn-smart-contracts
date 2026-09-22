/**
 * `perimeter:submit-block` and `perimeter:check-block` decode calldata as a
 * genuine ExitDelayQueue block lever (`BlockCalldataDecoding.test.js`), but
 * neither previously checked that the address the calldata actually targets
 * — `--queue`, or a pending transaction's own on-chain destination — is
 * genuinely the deployed queue, only that some contract code exists there.
 * `perimeter:policy:check-tx` already refuses to describe a transaction as
 * safe when its destination does not match the resolved controller; this
 * applies the identical identity check here, against a saved `ExitDelayQueue`
 * deployment record.
 *
 * Run:
 *   npx hardhat test tests/perimeter/BlockTaskQueueIdentity.test.js
 */
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, deployments } = hre;

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

/** Registers a fake `ExitDelayQueue` deployment record for the duration of
 *  `fn`, restoring whatever this test network held before (or removing the
 *  record entirely if it held none) — this test network's own record is
 *  shared process-wide with every other test file in the same `hardhat
 *  test` run, so a record left behind here would make an unrelated queue
 *  address in another file's fixture start failing this same identity
 *  check. */
const withKnownQueue = async (address, fn) => {
    const prior = await deployments.getOrNull("ExitDelayQueue");
    await deployments.save("ExitDelayQueue", { address, abi: [] });
    try {
        await fn();
    } finally {
        if (prior) await deployments.save("ExitDelayQueue", prior);
        else await deployments.delete("ExitDelayQueue");
    }
};

describe("perimeter:submit-block / perimeter:check-block verify --queue against the known ExitDelayQueue", () => {
    let realQueue;
    let wrongQueue;
    let multisig;
    let owner;
    let freezeData;

    before(async () => {
        [owner] = await ethers.getSigners();
        realQueue = (await MockExitFeeController.new()).address;
        wrongQueue = (await MockExitFeeController.new()).address;
        const MultiSigWalletFactory = await ethers.getContractFactory("MultiSigWallet");
        multisig = await MultiSigWalletFactory.deploy([owner.address], 1);
        await multisig.deployed();
        freezeData = new ethers.utils.Interface(["function freeze(address)"]).encodeFunctionData(
            "freeze",
            [ethers.Wallet.createRandom().address]
        );
    });

    it("refuses to submit when --queue has code but does not match the known ExitDelayQueue", async () => {
        await withKnownQueue(realQueue, async () => {
            let raised = null;
            try {
                await hre.run("perimeter:submit-block", {
                    queue: wrongQueue,
                    data: freezeData,
                    signer: owner.address,
                    multisig: multisig.address,
                });
            } catch (error) {
                raised = error;
            }
            expect(
                raised,
                "a --queue that does not match the known deployment must refuse, not submit"
            ).to.not.equal(null);
            expect(raised.message).to.match(/does not match the known ExitDelayQueue/);
        });
    });

    it("still submits when --queue matches the known ExitDelayQueue, and says so with a distinct verified line", async () => {
        await withKnownQueue(realQueue, async () => {
            let raised = null;
            const output = await captureConsole(async () => {
                try {
                    await hre.run("perimeter:submit-block", {
                        queue: realQueue,
                        data: freezeData,
                        signer: owner.address,
                        multisig: multisig.address,
                    });
                } catch (error) {
                    raised = error;
                }
            });
            expect(raised, raised && raised.message).to.equal(null);
            expect(output).to.include("matches the deployed ExitDelayQueue");
        });
    });

    it("does not weaken the omitted-argument fallback: submits fine when no known queue can be derived at all, but says out loud that it could not verify it", async () => {
        // No `withKnownQueue` wrapper here — this test network carries no
        // `ExitDelayQueue`/`ISovryn` record by default (the same premise
        // every other test in this file and in BlockCalldataDecoding.test.js
        // already relies on), so the identity check must proceed rather than
        // block a submission it has nothing to verify against — but it must
        // not proceed SILENTLY: a co-signer reading the output has to be
        // able to tell "not verified" apart from "verified".
        const existing = await deployments.getOrNull("ExitDelayQueue");
        expect(existing, "this test assumes no queue record is already registered").to.not.exist;
        let raised = null;
        const output = await captureConsole(async () => {
            try {
                await hre.run("perimeter:submit-block", {
                    queue: wrongQueue,
                    data: freezeData,
                    signer: owner.address,
                    multisig: multisig.address,
                });
            } catch (error) {
                raised = error;
            }
        });
        expect(raised, raised && raised.message).to.equal(null);
        expect(output).to.include("could NOT be verified independently");
        expect(output).to.include(wrongQueue);
    });

    it("check-block refuses to describe a transaction whose destination is not the known queue, even though its calldata decodes as a real block lever", async () => {
        await withKnownQueue(realQueue, async () => {
            // Submitted straight against the multisig, bypassing submit-block's
            // own --queue check entirely — standing in for calldata that was
            // never checked at submission time (a live wallet backlog entry,
            // or a transaction submitted by some other tool).
            await (
                await multisig.connect(owner).submitTransaction(wrongQueue, 0, freezeData)
            ).wait();
            const txId = (await multisig.transactionCount()).sub(1).toString();

            let raised = null;
            try {
                await hre.run("perimeter:check-block", { id: txId, multisig: multisig.address });
            } catch (error) {
                raised = error;
            }
            expect(
                raised,
                "a mismatched destination must refuse, not print a plausible-looking decoded view"
            ).to.not.equal(null);
            expect(raised.message).to.match(/does not match the known ExitDelayQueue/);
        });
    });

    it("check-block still shows the decoded view when the destination matches the known queue, and says so with a distinct verified line", async () => {
        await withKnownQueue(realQueue, async () => {
            await (
                await multisig.connect(owner).submitTransaction(realQueue, 0, freezeData)
            ).wait();
            const txId = (await multisig.transactionCount()).sub(1).toString();

            let raised = null;
            const output = await captureConsole(async () => {
                try {
                    await hre.run("perimeter:check-block", {
                        id: txId,
                        multisig: multisig.address,
                    });
                } catch (error) {
                    raised = error;
                }
            });
            expect(raised, raised && raised.message).to.equal(null);
            expect(output).to.include("matches the deployed ExitDelayQueue");
        });
    });

    it("check-block proceeds and warns, rather than staying silent, when no known queue can be derived at all", async () => {
        // Same premise as submit-block's own version of this case: this test
        // network carries no `ExitDelayQueue`/`ISovryn` record by default, so
        // check-block has nothing to verify the destination against — it
        // must still show the decoded view (this IS genuinely queue-shaped
        // calldata, as far as this tool can tell), but must say out loud
        // that it could not confirm the destination independently.
        const existing = await deployments.getOrNull("ExitDelayQueue");
        expect(existing, "this test assumes no queue record is already registered").to.not.exist;
        await (await multisig.connect(owner).submitTransaction(wrongQueue, 0, freezeData)).wait();
        const txId = (await multisig.transactionCount()).sub(1).toString();

        let raised = null;
        const output = await captureConsole(async () => {
            try {
                await hre.run("perimeter:check-block", { id: txId, multisig: multisig.address });
            } catch (error) {
                raised = error;
            }
        });
        expect(raised, raised && raised.message).to.equal(null);
        expect(output).to.include("could NOT be verified independently");
        expect(output).to.include(wrongQueue);
        expect(output).to.include("freeze(address)");
    });

    it("check-block still falls back to its generic message for an unrelated transaction, even with a mismatched destination", async () => {
        // The identity check is scoped to genuinely queue-shaped calldata
        // only — an ordinary transaction that neither targets the queue nor
        // carries block-lever calldata must stay exactly as informative as
        // before, not start refusing to be inspected at all.
        await withKnownQueue(realQueue, async () => {
            const unrelatedData = new ethers.utils.Interface([
                "function setExitFeeEnabled(bool)",
            ]).encodeFunctionData("setExitFeeEnabled", [true]);
            await (
                await multisig.connect(owner).submitTransaction(wrongQueue, 0, unrelatedData)
            ).wait();
            const txId = (await multisig.transactionCount()).sub(1).toString();

            let raised = null;
            try {
                await hre.run("perimeter:check-block", { id: txId, multisig: multisig.address });
            } catch (error) {
                raised = error;
            }
            expect(raised, raised && raised.message).to.equal(null);
        });
    });

    it("submit-block refuses recovery calldata and names the task that builds it", async () => {
        await withKnownQueue(realQueue, async () => {
            const recovery = require("../../hardhat/tasks/perimeter/recovery");
            const routeData = recovery.buildRecoveryCall("setTopUpFeasible", {
                surfaceId: require("../../hardhat/tasks/perimeter/policy").SURFACES
                    .PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
                feasible: true,
            }).data;
            let raised = null;
            try {
                await hre.run("perimeter:submit-block", {
                    queue: realQueue,
                    data: routeData,
                    signer: owner.address,
                    multisig: multisig.address,
                });
            } catch (error) {
                raised = error;
            }
            expect(
                raised,
                "recovery calldata must not be submitted as a block lever"
            ).to.not.equal(null);
            expect(raised.message).to.match(/is a recovery lever, not a block lever/);
            expect(raised.message).to.match(/perimeter:route:set/);
        });
    });

    it("check-block decodes a recovery transaction and still verifies the destination", async () => {
        await withKnownQueue(realQueue, async () => {
            const recovery = require("../../hardhat/tasks/perimeter/recovery");
            const routeData = recovery.buildRecoveryCall("removeRecoveryRoute", {
                routeId: `0x${"11".repeat(32)}`,
            }).data;
            await (
                await multisig.connect(owner).submitTransaction(realQueue, 0, routeData)
            ).wait();
            const txId = (await multisig.transactionCount()).sub(1).toString();
            const output = await captureConsole(() =>
                hre.run("perimeter:check-block", { id: txId, multisig: multisig.address })
            );
            expect(output).to.include("matches the deployed ExitDelayQueue");
            expect(output).to.include("removeRecoveryRoute(bytes32)");
            expect(output).to.include(`removes the recovery route 0x${"11".repeat(32)}`);
        });
    });
});
