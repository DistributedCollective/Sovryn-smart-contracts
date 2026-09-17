/**
 * Isolated regression for `confirm()`'s postcondition re-check.
 *
 * Before this fix, `confirm()` reported `applied` straight off the
 * MultiSigWallet's own `executed` flag — a boolean that means only "the inner
 * call ran without reverting", never "the target contract ended up where the
 * submitted command meant to leave it". A pause, freeze, blacklist or route
 * call whose inner execution succeeds without establishing the intended state
 * (a defect in the target contract itself) would still have reported
 * `applied: true`.
 *
 * `runPostcondition` is pure apart from the view calls its descriptor names,
 * so this runs against a fake controller/queue/multisig on Hardhat's own
 * in-process network — no fork, no `--network`.
 *
 * Run:
 *   npx hardhat test tests-onchain/perimeter/qa/engineConfirmPostcondition.test.js
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

const engine = require("./engine");

const TX_ID = 4242;
const silent = { log: () => {} };

/** A fake multisig whose transaction TX_ID is already `executed` — the exact
 *  branch `confirm()` takes when a threshold-1 submission (or an earlier
 *  confirmation call) already carried the transaction to execution, and the
 *  one MED-8 is about: the old code returned `applied: true` from this branch
 *  on the flag alone. */
const executedMultisig = {
    transactionCount: async () => ethers.BigNumber.from(TX_ID + 1),
    transactions: async () => ({ executed: true }),
};

describe("QA scenario engine — confirm() re-checks the postcondition, not just executed", () => {
    it("runPostcondition fires when the real state does not match what the descriptor wants", async () => {
        const s = { controller: { securityPerimeterEnabled: async () => false } };
        const held = await engine.runPostcondition(s, {
            kind: "perimeterEnabled",
            args: { want: true },
        });
        expect(held).to.not.equal(true);
        expect(held).to.match(/enabled=false/);
    });

    it("runPostcondition passes when the real state matches", async () => {
        const s = { controller: { securityPerimeterEnabled: async () => true } };
        const held = await engine.runPostcondition(s, {
            kind: "perimeterEnabled",
            args: { want: true },
        });
        expect(held).to.equal(true);
    });

    it("throws on an unrecognized postcondition kind rather than trusting it", async () => {
        let raised = null;
        try {
            await engine.runPostcondition({}, { kind: "__not_a_real_kind__", args: {} });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/no postcondition checker registered/);
    });

    it("reports applied: false when the wallet says executed but the postcondition does not hold — the defect this closes", async () => {
        // Exactly the class of defect MED-8 names: a pause/kill lever whose
        // inner call ran (the wallet reports executed) but the target
        // contract never actually reached the intended state — here, `kill
        // off` was submitted (wants securityPerimeterEnabled == false) but
        // the controller is still reporting enabled == true.
        const s = {
            multisig: executedMultisig,
            controller: { securityPerimeterEnabled: async () => true }, // defect: still enabled
        };
        const record = await engine.confirm(s, TX_ID, {
            ...silent,
            postcondition: { kind: "perimeterEnabled", args: { want: false } },
        });
        expect(
            record.applied,
            "a state that never actually changed must not report applied"
        ).to.equal(false);
        expect(record.note).to.match(/enabled=true/);
    });

    it("reports applied: true when the wallet says executed and the postcondition genuinely holds", async () => {
        const s = {
            multisig: executedMultisig,
            controller: { securityPerimeterEnabled: async () => false },
        };
        const record = await engine.confirm(s, TX_ID, {
            ...silent,
            postcondition: { kind: "perimeterEnabled", args: { want: false } },
        });
        expect(record.applied).to.equal(true);
    });

    it("falls back to trusting executed alone when no postcondition was ever recorded for this transaction", async () => {
        // A transaction this session never submitted itself — e.g. the live
        // wallet's own backlog — has nothing to re-check against.
        const s = { multisig: executedMultisig };
        const record = await engine.confirm(s, TX_ID, { ...silent, postcondition: null });
        expect(record.applied).to.equal(true);
        expect(record.note).to.match(/no postcondition was recorded/);
    });

    it("summarizeStep keeps a step's postcondition — the route regression this fix closes", () => {
        // Before this fix, route()'s own per-step summary dropped
        // `postcondition` even though `viaMultisig`'s result carried it —
        // the only place a route step's postcondition could have survived
        // to the state file at all.
        const step = {
            signature: "setRecoveryRoute((bool,bytes32,address,address,address,bool))",
            applied: true,
            txId: 77,
            postcondition: { kind: "recoveryRouteActive", args: { routeId: "0xroute" } },
            note: null,
        };
        expect(engine.summarizeStep(step)).to.deep.equal({
            label: step.signature,
            applied: true,
            txId: 77,
            postcondition: step.postcondition,
            note: null,
        });
    });

    it("finds a route step's postcondition nested under steps[], not just a top-level one", () => {
        // route()'s own returned record cannot carry a single top-level
        // txId/postcondition (it may submit two multisig transactions), so
        // each step's own is nested under `steps[]` instead —
        // findPostconditionFor has to look there too.
        const fs = require("fs");
        const { LOG_FILE } = engine;
        const existed = fs.existsSync(LOG_FILE);
        const backup = existed ? fs.readFileSync(LOG_FILE, "utf8") : null;
        try {
            const stepTxId = 909;
            engine.appendState({
                command: "route",
                surface: "lender",
                // No top-level txId/postcondition — route is a compound
                // command and cannot have a single one.
                steps: [
                    {
                        label: "setTopUpFeasible(bytes32,bool)",
                        applied: true,
                        txId: stepTxId,
                        postcondition: {
                            kind: "topUpFeasible",
                            args: { surfaceId: ethers.constants.HashZero },
                        },
                        note: null,
                    },
                ],
            });
            expect(engine.findPostconditionFor(stepTxId)).to.deep.equal({
                kind: "topUpFeasible",
                args: { surfaceId: ethers.constants.HashZero },
            });
            expect(
                engine.findPostconditionFor(stepTxId + 1),
                "an unrelated txId must not match"
            ).to.equal(null);
        } finally {
            if (existed) fs.writeFileSync(LOG_FILE, backup);
            else if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
        }
    });

    it("confirm() re-checks a route step's postcondition, not just executed — the RV-5 gap", async () => {
        // Exactly the MED-8 defect, reopened for route: the wallet reports
        // the step's transaction as executed, but the queue never actually
        // reached topUpFeasible == true. Before this fix, findPostconditionFor
        // never looked inside steps[], so confirm() found nothing and fell
        // back to trusting `executed` alone — reporting applied: true for a
        // command that never actually took effect.
        const fs = require("fs");
        const { LOG_FILE } = engine;
        const existed = fs.existsSync(LOG_FILE);
        const backup = existed ? fs.readFileSync(LOG_FILE, "utf8") : null;
        const stepTxId = 910;
        try {
            engine.appendState({
                command: "route",
                surface: "lender",
                steps: [
                    {
                        label: "setTopUpFeasible(bytes32,bool)",
                        applied: true,
                        txId: stepTxId,
                        postcondition: {
                            kind: "topUpFeasible",
                            args: { surfaceId: ethers.constants.HashZero },
                        },
                        note: null,
                    },
                ],
            });

            const s = {
                multisig: {
                    transactionCount: async () => ethers.BigNumber.from(stepTxId + 1),
                    transactions: async () => ({ executed: true }),
                },
                queue: { topUpFeasible: async () => false }, // defect: never actually set
            };
            const record = await engine.confirm(s, stepTxId, silent);
            expect(
                record.applied,
                "a route step reported executed but never actually applied must not report applied"
            ).to.equal(false);
            expect(record.note).to.match(/still marked infeasible/);
        } finally {
            if (existed) fs.writeFileSync(LOG_FILE, backup);
            else if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
        }
    });

    it("confirm() reports applied: true for a route step whose postcondition genuinely holds", async () => {
        const fs = require("fs");
        const { LOG_FILE } = engine;
        const existed = fs.existsSync(LOG_FILE);
        const backup = existed ? fs.readFileSync(LOG_FILE, "utf8") : null;
        const stepTxId = 911;
        try {
            engine.appendState({
                command: "route",
                surface: "lender",
                steps: [
                    {
                        label: "setTopUpFeasible(bytes32,bool)",
                        applied: true,
                        txId: stepTxId,
                        postcondition: {
                            kind: "topUpFeasible",
                            args: { surfaceId: ethers.constants.HashZero },
                        },
                        note: null,
                    },
                ],
            });

            const s = {
                multisig: {
                    transactionCount: async () => ethers.BigNumber.from(stepTxId + 1),
                    transactions: async () => ({ executed: true }),
                },
                queue: { topUpFeasible: async () => true },
            };
            const record = await engine.confirm(s, stepTxId, silent);
            expect(record.applied).to.equal(true);
        } finally {
            if (existed) fs.writeFileSync(LOG_FILE, backup);
            else if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
        }
    });

    it("finds a postcondition persisted to the state file by an earlier submission, in a fresh call that does not pass one explicitly", async () => {
        // This is the real scenario MED-8 is about: submission and
        // confirmation are two SEPARATE `perimeter:qa` invocations, connected
        // only by the state file appendState() writes to. Exercise that exact
        // path rather than the opts.postcondition override the other tests
        // use for isolation, backing up and restoring whatever the file
        // already held so this never disturbs a real session's record.
        const fs = require("fs");
        const { LOG_FILE } = engine;
        const existed = fs.existsSync(LOG_FILE);
        const backup = existed ? fs.readFileSync(LOG_FILE, "utf8") : null;
        try {
            const otherTxId = TX_ID + 1;
            engine.appendState({
                command: "kill",
                txId: otherTxId,
                postcondition: { kind: "perimeterEnabled", args: { want: false } },
            });
            const s = {
                multisig: {
                    transactionCount: async () => ethers.BigNumber.from(otherTxId + 1),
                    transactions: async () => ({ executed: true }),
                },
                controller: { securityPerimeterEnabled: async () => true }, // defect: still enabled
            };
            // No opts.postcondition passed — confirm() must find it itself.
            const record = await engine.confirm(s, otherTxId, silent);
            expect(record.applied).to.equal(false);
            expect(record.note).to.match(/enabled=true/);
        } finally {
            if (existed) fs.writeFileSync(LOG_FILE, backup);
            else if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
        }
    });
});
