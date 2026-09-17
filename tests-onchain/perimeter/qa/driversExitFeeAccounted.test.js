/**
 * Isolated regression for the QA rehearsal drivers' Perimeter fee accounting.
 *
 * Before this fix, every driver established that a withdrawal was HELD (the
 * queue recorded a positive escrowed amount) but never that the Perimeter fee
 * was actually charged on it — the amount that went in never entered an
 * assertion. A hook that queued the full gross with no fee deducted at all
 * would have passed every existing check.
 *
 * `assertExitFeeAccounted` is pure apart from one view call
 * (`controller.quoteExitFee`), so this runs against a fake controller object
 * on Hardhat's own in-process network — no fork, no `--network`.
 *
 * Run:
 *   npx hardhat test tests-onchain/perimeter/qa/driversExitFeeAccounted.test.js
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

const drivers = require("./drivers");

const bn = (n) => ethers.BigNumber.from(n);

/** A fake controller whose quoteExitFee is a plain rate function: feeAmount =
 *  gross * rateBps / 10000, netAmount = gross - feeAmount — same shape the
 *  real controller's view returns, without deploying anything. */
const fakeController = (rateBps) => ({
    quoteExitFee: async (surfaceId, subProduct, actor, gross) => {
        const feeAmount = gross.mul(rateBps).div(10000);
        return { feeAmount, netAmount: gross.sub(feeAmount) };
    },
});

const call = (s, overrides = {}) =>
    drivers.assertExitFeeAccounted(s, {
        label: "test",
        surfaceId: ethers.constants.HashZero,
        subProduct: ethers.constants.AddressZero,
        actor: ethers.constants.AddressZero,
        feeReceiverBefore: bn(0),
        feeReceiverAfter: bn(0),
        netRecorded: bn(0),
        ...overrides,
    });

describe("QA rehearsal drivers — Perimeter fee accounting", () => {
    it("passes, and reports the derived gross, when the fee was genuinely charged", async () => {
        // 1% of a 1000 gross withdrawal: 10 fee, 990 net.
        const s = { controller: fakeController(100) };
        const result = await call(s, {
            feeReceiverBefore: bn(0),
            feeReceiverAfter: bn(10),
            netRecorded: bn(990),
        });
        expect(result.gross.toString()).to.equal("1000");
        expect(result.feeReceived.toString()).to.equal("10");
    });

    it("passes for an exempt actor (rate 0) where no fee is expected", async () => {
        const s = { controller: fakeController(0) };
        const result = await call(s, {
            feeReceiverBefore: bn(5000),
            feeReceiverAfter: bn(5000),
            netRecorded: bn(1000),
        });
        expect(result.gross.toString()).to.equal("1000");
        expect(result.feeReceived.toString()).to.equal("0");
    });

    it("fires on the defect this check exists to catch: gross escrowed in full, nothing charged", async () => {
        // A defective hook that queues the full 1000 gross and skips the fee
        // leg entirely, on a surface/actor the controller charges 1% for.
        // Every check that existed before this fix (queued > 0, parties match)
        // would have passed a request exactly like this one.
        const s = { controller: fakeController(100) };
        let raised = null;
        try {
            await call(s, {
                feeReceiverBefore: bn(0),
                feeReceiverAfter: bn(0),
                netRecorded: bn(1000),
            });
        } catch (error) {
            raised = error;
        }
        expect(raised, "expected the fee-accounting check to fire").to.not.equal(null);
        expect(raised.message).to.match(/controller quotes a 10 fee/);
    });

    it("fires when the fee destination's balance fell instead of rose", async () => {
        const s = { controller: fakeController(100) };
        let raised = null;
        try {
            await call(s, { feeReceiverBefore: bn(100), feeReceiverAfter: bn(40) });
        } catch (error) {
            raised = error;
        }
        expect(raised, "expected a refusal on a negative fee delta").to.not.equal(null);
        expect(raised.message).to.match(/FELL/);
    });

    it("fires when the controller's own quote is internally inconsistent", async () => {
        // The measured fee (10) matches what the controller quotes for it —
        // check one passes — but the controller's netAmount does not equal
        // gross - feeAmount, the invariant a well-formed quote always keeps.
        // Real controllers hold this invariant by construction; this proves
        // the second check still catches it if one ever did not.
        const s = {
            controller: { quoteExitFee: async () => ({ feeAmount: bn(10), netAmount: bn(5) }) },
        };
        let raised = null;
        try {
            await call(s, {
                feeReceiverBefore: bn(0),
                feeReceiverAfter: bn(10),
                netRecorded: bn(990),
            });
        } catch (error) {
            raised = error;
        }
        expect(raised, "expected a refusal on a net/quote mismatch").to.not.equal(null);
        expect(raised.message).to.match(/does not reconcile/);
    });
});
