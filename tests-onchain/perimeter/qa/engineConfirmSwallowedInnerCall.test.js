/**
 * Regression for `confirm()` on a lever the contract refuses, once the
 * Exchequer multisig's threshold is 2 or more.
 *
 * The wallet tries the stored inner call as soon as the confirmation that
 * reaches the threshold lands; if the target contract refuses it, the
 * wallet's own transaction still mines, `transactions(id).executed` stays
 * false, and the outcome is already known — no further owner's confirmation
 * changes it. `confirm()` must stop there instead of working through every
 * remaining owner, and must carry the contract's own refusal reason on the
 * returned record, not just the bare fact that nothing applied.
 *
 * Run against a bootstrapped QA fork:
 *   PERIMETER_QA_RPC=http://127.0.0.1:8547 __decryptionAlreadyDone__=TRUE \
 *     npx hardhat test tests-onchain/perimeter/qa/engineConfirmSwallowedInnerCall.test.js \
 *     --network rskForkedMainnetQa
 */
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

const { attachQa } = require("./bootstrap");
const engine = require("./engine");

const HALF_HOUR = 30 * 60 * 1000;
const silent = { log: () => {} };

describe("QA scenario engine — confirm() on a refused lever at threshold 2", () => {
    let s;

    before(async function () {
        this.timeout(HALF_HOUR);
        if (!hre.network.tags.qa) {
            // Throw, never return: a bare return marks a security rehearsal
            // PASSED with zero assertions.
            throw new Error("run with --network rskForkedMainnetQa");
        }
        await engine.assertQa();
        s = await attachQa(hre);
    });

    it("stops confirming once the threshold is reached, and reports why the inner call was refused", async function () {
        this.timeout(HALF_HOUR);

        // Threshold 1 (what `up` leaves behind by default) executes a lever
        // on submission — raise it through the wallet itself, the same way
        // `engine.test.js`'s own threshold-2 drill does, so a lever is left
        // pending for `confirm`.
        const startingRequired = (await s.multisig.required()).toNumber();
        if (startingRequired < 2) {
            const raised = await engine.viaMultisig(
                s,
                "threshold 2",
                s.multisig.address,
                s.multisig,
                "changeRequirement(uint256)",
                [2],
                silent
            );
            expect(raised.applied, raised.note || "").to.equal(true);
        }
        expect((await s.multisig.required()).toNumber()).to.be.at.least(2);

        try {
            const owners = await s.multisig.getOwners();
            expect(
                owners.length,
                "the wallet needs more than 2 owners for a stray extra confirmation to be detectable"
            ).to.be.greaterThan(2);

            // An address the queue has never touched carries BlockState.None
            // — `unfreeze` requires Frozen, so the queue refuses this inner
            // call every time it is tried.
            const target = ethers.Wallet.createRandom().address;
            expect(await s.queue.blockStateOf(target)).to.equal(0);

            const released = await engine.release(s, target, { ...silent, blacklisted: false });
            expect(released.applied).to.equal(false);
            expect(released.pending).to.equal(true);
            expect(released.note).to.match(/threshold is/);

            const confirmed = await engine.confirm(s, released.txId, {
                ...silent,
                postcondition: released.postcondition,
            });

            // Only the one confirmation needed to reach the threshold should
            // have been added — the submitter's own automatic confirmation
            // plus this one already tells the wallet everything it will ever
            // know about this transaction.
            expect(confirmed.required).to.equal(2);
            expect(confirmed.confirmations).to.equal(2);
            expect(
                confirmed.confirmedBy.length,
                "no owner beyond the one that reached the threshold should have been asked to confirm"
            ).to.equal(1);

            expect(confirmed.applied).to.equal(false);
            expect(
                confirmed.note,
                "the contract's own refusal reason must be carried on the returned record"
            ).to.match(/^the inner call was swallowed: NotFrozen\(/);

            // Nothing changed on the target — the refused lever did exactly
            // nothing, which is the point of proving why it was refused.
            expect(await s.queue.blockStateOf(target)).to.equal(0);
        } finally {
            // Leave the wallet the way a fresh `up` does — threshold 1 — so
            // this file can run before or after engine.test.js's own
            // threshold-2 drill without either leaving the other a
            // threshold it did not expect to find.
            if ((await s.multisig.required()).toNumber() !== 1) {
                const lowered = await engine.viaMultisig(
                    s,
                    "threshold 1",
                    s.multisig.address,
                    s.multisig,
                    "changeRequirement(uint256)",
                    [1],
                    silent
                );
                if (!lowered.applied && lowered.pending) {
                    await engine.confirm(s, lowered.txId, silent);
                }
            }
            expect((await s.multisig.required()).toNumber()).to.equal(1);
        }
    });
});
