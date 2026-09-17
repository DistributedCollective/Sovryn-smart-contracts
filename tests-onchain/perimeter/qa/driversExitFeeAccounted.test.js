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

const SURFACE = ethers.constants.HashZero;
const ACTOR = ethers.utils.getAddress(ethers.utils.hexZeroPad("0xa1", 20));
/** Default fee receiver / tx signer for the fake receipt — deliberately
 *  DIFFERENT addresses, so the default call never exercises the
 *  gas-normalization branch by accident. */
const FEE_RECEIVER = ethers.utils.getAddress(ethers.utils.hexZeroPad("0xfee", 20));
const SIGNER = ethers.utils.getAddress(ethers.utils.hexZeroPad("0x519e2", 20));
/** Same event ABI `findVaultRevertSkip` decodes with, built independently
 *  here so an encoded log is a faithful stand-in for one a real receipt
 *  would carry, not something shaped to fit the implementation. */
const EVENTS_INTERFACE = new ethers.utils.Interface([
    "event ExitFeeSkipped(bytes32 indexed surfaceId, address indexed actor, address indexed asset, uint256 grossAmount, uint16 rateBps, uint8 reason)",
]);
const SKIP_REASON_VAULT_REVERT = 5;
const SKIP_REASON_NONE = 0;

/** A receipt log for `ExitFeeSkipped`, exactly as a real fee hook would emit
 *  it (this repo's `IPerimeterEvents.sol` and zero-contracts'
 *  `BorrowerOperationsPerimeterOps.sol` declare the identical shape). */
const skipLog = ({ surfaceId, actor, reason }) => {
    const fragment = EVENTS_INTERFACE.getEvent("ExitFeeSkipped");
    const { data, topics } = EVENTS_INTERFACE.encodeEventLog(fragment, [
        surfaceId,
        actor,
        ethers.constants.AddressZero,
        bn(1000),
        100,
        reason,
    ]);
    return { data, topics };
};

/** `receipt` is merged field-by-field with the default (rather than replaced
 *  wholesale) so a test overriding just `logs` still carries a valid `from`/
 *  `gasUsed`/`effectiveGasPrice` — required now that the gas-normalization
 *  check reads `receipt.from` unconditionally. */
const call = (s, { receipt, ...overrides } = {}) =>
    drivers.assertExitFeeAccounted(s, {
        label: "test",
        surfaceId: SURFACE,
        subProduct: ethers.constants.AddressZero,
        actor: ACTOR,
        feeReceiver: FEE_RECEIVER,
        feeReceiverBefore: bn(0),
        feeReceiverAfter: bn(0),
        netRecorded: bn(0),
        receipt: { logs: [], from: SIGNER, gasUsed: bn(0), effectiveGasPrice: bn(0), ...receipt },
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

    describe("gas-normalizing the fee receiver's own balance when it is also the signer", () => {
        it("credits the signer's own gas cost back so a genuine fee charge is not read as a shortfall", async () => {
            // 1% of 1000 gross: 10 fee, 990 net — same shape as "genuinely
            // charged" above, but this time the fee receiver IS the
            // withdrawal's own signer. The raw balance delta is deeply
            // negative (a 50-wei gas cost dwarfs the 10-wei fee): the
            // receiver started at 1000, received a 10-wei fee, and paid
            // 50 wei of this same transaction's gas out of that same
            // balance, landing at 960. Unadjusted this reads as a 40-wei
            // FALL and would throw; gas-normalized it reads back to exactly
            // the real fee, 10.
            const s = { controller: fakeController(100) };
            const result = await call(s, {
                feeReceiver: SIGNER,
                feeReceiverBefore: bn(1000),
                feeReceiverAfter: bn(960),
                netRecorded: bn(990),
                receipt: { from: SIGNER, gasUsed: bn(50), effectiveGasPrice: bn(1) },
            });
            expect(result.feeReceived.toString()).to.equal("10");
            expect(result.gross.toString()).to.equal("1000");
        });

        it("still fires when the signer-as-fee-receiver's gas-normalized balance shows no charge", async () => {
            // Same defect as "gross escrowed in full, nothing charged" above,
            // but the fee receiver is also the signer: the raw delta here is
            // purely the 50-wei gas debit (no fee was paid at all), which
            // gas-normalizes back to exactly 0 — the check must still fire,
            // not read the gas debit itself as evidence a fee moved.
            const s = { controller: fakeController(100) };
            let raised = null;
            try {
                await call(s, {
                    feeReceiver: SIGNER,
                    feeReceiverBefore: bn(1000),
                    feeReceiverAfter: bn(950),
                    netRecorded: bn(1000),
                    receipt: { from: SIGNER, gasUsed: bn(50), effectiveGasPrice: bn(1) },
                });
            } catch (error) {
                raised = error;
            }
            expect(raised, "expected the fee-accounting check to still fire").to.not.equal(null);
            expect(raised.message).to.match(/controller quotes a 10 fee/);
        });

        it("does not credit gas back when the fee receiver is a different address from the signer", async () => {
            // Sanity check that the credit is gated on the address match, not
            // applied unconditionally: same gas figures as above, but the fee
            // receiver here is genuinely not the signer, so the raw delta is
            // trusted as measured.
            const s = { controller: fakeController(100) };
            const result = await call(s, {
                feeReceiver: FEE_RECEIVER,
                feeReceiverBefore: bn(0),
                feeReceiverAfter: bn(10),
                netRecorded: bn(990),
                receipt: { from: SIGNER, gasUsed: bn(50), effectiveGasPrice: bn(1) },
            });
            expect(result.feeReceived.toString()).to.equal("10");
        });
    });

    describe("telling a fee-vault failure apart from a fee that was simply never charged", () => {
        it("names the fee-transfer failure when an ExitFeeSkipped(VAULT_REVERT) event backs it up", async () => {
            // Same shape as "gross escrowed in full, nothing charged" above —
            // the balances alone cannot tell the two cases apart — but this
            // time the withdrawal's own receipt carries the event the real
            // hooks emit specifically for a fee-leg transfer that reverted.
            // This is the hook's documented, correct fail-open behavior, not a
            // defect — but the check must still fail (its job is to prove a
            // charge happened) and must say which of the two things occurred.
            const s = { controller: fakeController(100) };
            let raised = null;
            try {
                await call(s, {
                    feeReceiverBefore: bn(0),
                    feeReceiverAfter: bn(0),
                    netRecorded: bn(1000),
                    receipt: {
                        logs: [
                            skipLog({
                                surfaceId: SURFACE,
                                actor: ACTOR,
                                reason: SKIP_REASON_VAULT_REVERT,
                            }),
                        ],
                    },
                });
            } catch (error) {
                raised = error;
            }
            expect(raised, "expected the fee-accounting check to still fire").to.not.equal(null);
            expect(raised.message).to.match(/fee transfer itself failed/);
            expect(raised.message).to.match(/VAULT_REVERT/);
            expect(raised.message).to.not.match(/controller quotes/);
        });

        it("keeps the generic 'fee not charged' message when no skip event backs up a mismatch", async () => {
            // Explicit sibling of "gross escrowed in full, nothing charged"
            // above: proves the generic message is what fires when there is
            // genuinely no ExitFeeSkipped event to explain the gap — not just
            // that SOME message fires.
            const s = { controller: fakeController(100) };
            let raised = null;
            try {
                await call(s, {
                    feeReceiverBefore: bn(0),
                    feeReceiverAfter: bn(0),
                    netRecorded: bn(1000),
                    receipt: { logs: [] },
                });
            } catch (error) {
                raised = error;
            }
            expect(raised).to.not.equal(null);
            expect(raised.message).to.match(/controller quotes a 10 fee/);
            expect(raised.message).to.not.match(/fee transfer itself failed/);
        });

        it("does not mistake a different skip reason for a vault failure", async () => {
            // A skip event IS present, but for a reason other than
            // VAULT_REVERT (e.g. the surface reads as inactive) — must not be
            // read as "the transfer failed"; falls through to the generic
            // message.
            const s = { controller: fakeController(100) };
            let raised = null;
            try {
                await call(s, {
                    feeReceiverBefore: bn(0),
                    feeReceiverAfter: bn(0),
                    netRecorded: bn(1000),
                    receipt: {
                        logs: [
                            skipLog({
                                surfaceId: SURFACE,
                                actor: ACTOR,
                                reason: SKIP_REASON_NONE,
                            }),
                        ],
                    },
                });
            } catch (error) {
                raised = error;
            }
            expect(raised).to.not.equal(null);
            expect(raised.message).to.match(/controller quotes a 10 fee/);
            expect(raised.message).to.not.match(/fee transfer itself failed/);
        });

        it("does not mistake a VAULT_REVERT skip on a DIFFERENT surface or actor for this one's", async () => {
            const otherSurface = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes("SOME_OTHER_SURFACE")
            );
            const s = { controller: fakeController(100) };
            let raised = null;
            try {
                await call(s, {
                    feeReceiverBefore: bn(0),
                    feeReceiverAfter: bn(0),
                    netRecorded: bn(1000),
                    receipt: {
                        logs: [
                            skipLog({
                                surfaceId: otherSurface,
                                actor: ACTOR,
                                reason: SKIP_REASON_VAULT_REVERT,
                            }),
                        ],
                    },
                });
            } catch (error) {
                raised = error;
            }
            expect(raised).to.not.equal(null);
            expect(raised.message).to.match(/controller quotes a 10 fee/);
            expect(raised.message).to.not.match(/fee transfer itself failed/);
        });

        it("still passes an exempt actor (quoted fee 0) with no fee movement, regardless of any skip event", async () => {
            const s = { controller: fakeController(0) };
            const result = await call(s, {
                feeReceiverBefore: bn(5000),
                feeReceiverAfter: bn(5000),
                netRecorded: bn(1000),
                receipt: {
                    logs: [
                        skipLog({ surfaceId: SURFACE, actor: ACTOR, reason: SKIP_REASON_NONE }),
                    ],
                },
            });
            expect(result.feeReceived.toString()).to.equal("0");
        });
    });
});
