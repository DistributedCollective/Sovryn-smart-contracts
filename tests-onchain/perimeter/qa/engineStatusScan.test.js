/**
 * Isolated regression for `status`'s `--scan` option and its
 * per-transaction confirmation counts: the wallet is a real Exchequer with
 * thousands of transactions, so `status` only ever walks a tail of them —
 * `--scan <n>` is the escape hatch for a submission that fell out of the
 * default 25-deep tail while still unconfirmed.
 *
 * `status` is driven entirely off a fake `s` (queue/controller/multisig), the
 * same style `engineWithdrawPaidCheck.test.js` uses — no fork, no
 * `--network`.
 *
 * Run:
 *   npx hardhat test tests-onchain/perimeter/qa/engineStatusScan.test.js
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

const engine = require("./engine");

const bn = (n) => ethers.BigNumber.from(n);

/** `total` transactions, ids 0..total-1; `confirmed` maps an id to how many
 *  confirmations it carries; any id not in `confirmed` reads as executed
 *  (settled, so `status` never counts it as pending). */
const fakeMultisig = ({ total, confirmed, required }) => ({
    required: async () => bn(required),
    transactionCount: async () => bn(total),
    transactions: async (id) => ({ executed: !(id in confirmed) }),
    getConfirmationCount: async (id) => bn(confirmed[id] ?? 0),
});

const fakeS = ({ total, confirmed, required }) => ({
    queue: {
        lastRequestId: async () => bn(0),
        securityPerimeterPaused: async () => false,
    },
    controller: {
        securityPerimeterEnabled: async () => true,
        globalDelaySeconds: async () => bn(120),
        exitFeeEnabled: async () => true,
    },
    multisig: fakeMultisig({ total, confirmed, required }),
});

describe("QA scenario engine — status --scan", () => {
    it("defaults to scanning the last 25 transactions", async () => {
        // 30 transactions deep, ids 0..29 — the default 25-deep tail is
        // ids 5..29. Transaction 2 is the only unconfirmed one, outside it.
        const s = fakeS({ total: 30, confirmed: { 2: 1 }, required: 2 });
        const record = await engine.status(s);
        expect(record.multisigPendingScanned).to.equal(25);
        expect(record.multisigPending).to.deep.equal([]);
    });

    it("--scan finds a pending transaction the default tail would miss", async () => {
        const s = fakeS({ total: 30, confirmed: { 2: 1 }, required: 2 });
        const record = await engine.status(s, { scan: 30 });
        expect(record.multisigPendingScanned).to.equal(30);
        expect(record.multisigPending).to.deep.equal([2]);
        expect(record.multisigPendingConfirmations).to.deep.equal({ 2: 1 });
    });

    it("reports a confirmation count per pending id, not just that it is pending", async () => {
        const s = fakeS({ total: 10, confirmed: { 3: 0, 7: 1 }, required: 2 });
        const record = await engine.status(s, { scan: 10 });
        expect(record.multisigPending).to.deep.equal([3, 7]);
        expect(record.multisigPendingConfirmations).to.deep.equal({ 3: 0, 7: 1 });
        expect(record.multisigRequired).to.equal(2);
    });

    it("refuses a non-positive --scan", async () => {
        const s = fakeS({ total: 1, confirmed: {}, required: 1 });
        let raised = null;
        try {
            await engine.status(s, { scan: 0 });
        } catch (error) {
            raised = error;
        }
        expect(raised, "expected an upfront refusal").to.not.equal(null);
        expect(raised.message).to.match(/--scan must be a positive whole number/);
    });

    it("refuses a non-integer --scan", async () => {
        const s = fakeS({ total: 1, confirmed: {}, required: 1 });
        let raised = null;
        try {
            await engine.status(s, { scan: 2.5 });
        } catch (error) {
            raised = error;
        }
        expect(raised, "expected an upfront refusal").to.not.equal(null);
        expect(raised.message).to.match(/--scan must be a positive whole number/);
    });
});
