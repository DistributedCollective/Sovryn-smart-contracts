/**
 * `perimeter:submit-block` and `perimeter:check-block`, run as the real
 * hardhat tasks (not through the QA engine, which never called the broken
 * path) against a forked network.
 *
 * `deployment/helpers/helpers.js`'s `getSignerFromAccount` only takes the
 * `getImpersonatedSignerFromJsonRpcProvider` branch when
 * `hre.network.tags["forked"]` is true — that is the one thing an in-process
 * "hardhat" network run cannot reproduce, since only the explicitly
 * forked-tagged networks (rskForkedMainnet, rskForkedMainnetQa, …) carry that
 * tag. So this file, like the rest of this directory, needs a real QA fork
 * booted first:
 *
 *     PERIMETER_QA_PORT=8547 scripts/perimeter/qa-node.sh --detach
 *     PERIMETER_QA_RPC=http://127.0.0.1:8547 __decryptionAlreadyDone__=TRUE \
 *       npx hardhat test tests-onchain/perimeter/qa/submitBlock.test.js \
 *       --network rskForkedMainnetQa
 *
 * The bootstrap is idempotent, so this runs equally against a fresh node and
 * one `perimeter:qa up` has already installed.
 */
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

const { bootstrapQa, attachQa } = require("./bootstrap");
const policy = require("../../../hardhat/tasks/perimeter/policy");

const BLOCK_NONE = 0;
const BLOCK_FROZEN = 1;
const silent = { log: () => {} };

describe("perimeter:submit-block / perimeter:check-block", () => {
    let qa;

    before(async function () {
        this.timeout(30 * 60 * 1000);
        if (!hre.network.tags.qa) {
            // Throw, never return: a bare return marks this regression check
            // PASSED with zero assertions.
            throw new Error("run with --network rskForkedMainnetQa");
        }
        await bootstrapQa(hre, silent);
        qa = await attachQa(hre);
    });

    it("submits a freeze lever through the multisig instead of throwing a ReferenceError, and check-block reads it back", async () => {
        // A fresh, never-referenced address: freezing it cannot affect any
        // other test that shares this fork session.
        const target = ethers.Wallet.createRandom().address;
        const data = policy.queueInterface().encodeFunctionData("freeze(address[])", [[target]]);

        expect(await qa.queue.blockStateOf(target)).to.equal(BLOCK_NONE);

        // getSignerFromAccount (deployment/helpers/helpers.js) resolves this
        // call via the impersonation helper on a network tagged "forked",
        // rather than throwing `ReferenceError:
        // getImpersonatedSignerFromJsonRpcProvider is not defined` before
        // anything is submitted.
        await hre.run("perimeter:submit-block", {
            queue: qa.state.queue,
            data,
            signer: "deployer",
        });

        expect(await qa.queue.blockStateOf(target)).to.equal(BLOCK_FROZEN);

        // The multisig transaction submit-block just created and executed
        // (threshold 1 on the QA fork) is the one check-block should decode
        // cleanly as the same freeze lever — check-block reads it via
        // multisigCheckTx, never sendWithMultisig, so it never touches the
        // impersonation helper at all.
        const txId = (await qa.multisig.transactionCount()).sub(1).toString();
        await hre.run("perimeter:check-block", { id: txId, multisig: qa.state.multisig });
    });
});
