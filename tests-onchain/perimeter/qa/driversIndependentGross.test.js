/**
 * Isolated regression for the QA rehearsal drivers' independent-gross
 * cross-check.
 *
 * `assertExitFeeAccounted` derives `gross` as `netRecorded + feeReceived` —
 * the two quantities it itself measures — then only ever reconciles that
 * derived value against the controller's OWN quote for that same derived
 * gross. A hook that internally computes a smaller-than-real gross (and a
 * correspondingly smaller net + fee that are self-consistent with the
 * controller's quote for that wrong gross) passes it cleanly: real value
 * left the position and landed in neither the escrowed net nor the fee leg,
 * and nothing catches it.
 *
 * `assertGrossIndependentlyGrounded` closes that gap by cross-checking the
 * derived gross against a SEPARATE reading of what left the position,
 * sourced from state the fee hook never touches (a loan's or a trove's own
 * collateral ledger, a token-burn's own redemption price, a pool's own
 * pre-claim balance) — the way the surplus driver's own check already did
 * before this fix, now shared by every surface.
 *
 * Pure — no fork, no `--network`.
 *
 * Run:
 *   npx hardhat test tests-onchain/perimeter/qa/driversIndependentGross.test.js
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

const { assertGrossIndependentlyGrounded } = require("./drivers");

const bn = (n) => ethers.BigNumber.from(n);
const fee = (gross) => ({ gross: bn(gross) });

describe("QA rehearsal drivers — assertGrossIndependentlyGrounded", () => {
    describe("mode: exact — borrower/Zero/surplus, an independent reading with no timing gap", () => {
        it("passes when the derived gross exactly matches the independent reading", () => {
            expect(() =>
                assertGrossIndependentlyGrounded("test", fee(1000), bn(1000), "exact")
            ).to.not.throw();
        });

        it("fires when the derived gross UNDER-reports what an independent reading says left the position — the defect this check exists to catch", () => {
            // The exact scenario RV-3 names: a hook that internally computes
            // a smaller-than-real gross, with net + fee self-consistent with
            // the controller's quote for that wrong gross — assertExitFeeAccounted
            // alone would have passed this (netRecorded + feeReceived == 500,
            // reconciling with the controller's quote for 500), but the
            // loan/trove/pool's own ledger says 1000 actually left the position.
            let raised = null;
            try {
                assertGrossIndependentlyGrounded("test", fee(500), bn(1000), "exact");
            } catch (error) {
                raised = error;
            }
            expect(raised, "expected the independent-gross check to fire").to.not.equal(null);
            expect(raised.message).to.match(/500/);
            expect(raised.message).to.match(/1000/);
        });

        it("fires when the derived gross OVER-reports the independent reading too", () => {
            let raised = null;
            try {
                assertGrossIndependentlyGrounded("test", fee(1500), bn(1000), "exact");
            } catch (error) {
                raised = error;
            }
            expect(raised, "expected the independent-gross check to fire").to.not.equal(null);
        });
    });

    describe("mode: floor — lender, an independent reading taken slightly before the call", () => {
        it("passes when the derived gross exactly matches the floor", () => {
            expect(() =>
                assertGrossIndependentlyGrounded("test", fee(1000), bn(1000), "floor")
            ).to.not.throw();
        });

        it("passes when the derived gross is ABOVE the floor — legitimate interest accrued between the price read and the burn", () => {
            expect(() =>
                assertGrossIndependentlyGrounded("test", fee(1005), bn(1000), "floor")
            ).to.not.throw();
        });

        it("fires when the derived gross is BELOW the floor — the defect this check exists to catch", () => {
            let raised = null;
            try {
                assertGrossIndependentlyGrounded("test", fee(500), bn(1000), "floor");
            } catch (error) {
                raised = error;
            }
            expect(raised, "expected the independent-gross floor check to fire").to.not.equal(
                null
            );
            expect(raised.message).to.match(/500/);
            expect(raised.message).to.match(/1000/);
        });
    });
});
