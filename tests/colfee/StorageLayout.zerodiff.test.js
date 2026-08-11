// ColFee security perimeter — storage-layout ZERO-DIFF regression.
//
// The ColFee lending-side hook adds NO storage to any deployed upgradeable
// contract: the exit-fee controller pointer and its siblings live in
// EIP-1967-style unstructured slots (contracts/utils/ColFeeLib.sol) and no new
// state variable is declared on any contract that executes against a live
// proxy. That is true BY CONSTRUCTION today — but nothing GUARDS a future edit
// from appending a `uint256` to a protocol module or an iToken logic contract
// and silently corrupting every live loan's storage on the next upgrade.
//
// This test is that guard. It compares the current, normalized solc
// `storageLayout` of every guarded contract against a committed baseline
// captured from the pre-ColFee base ref 83871cd0 — the layout the LIVE mainnet
// sovrynProtocol and iToken proxies hold — and FAILS on any
// label/slot/offset/type difference, in order.
//
// Two storage domains are guarded:
//
//   protocol      contracts/core/State.sol — the layout every module registered
//                 with `replaceContract` delegatecalls into inside the
//                 sovrynProtocol proxy.
//   iTokenBeacon  LoanTokenBase → AdvancedTokenStorage → LoanTokenLogicStorage —
//                 the layout every beacon logic contract delegatecalls into
//                 inside an iToken proxy.
//
// Requires `storageLayout` in the 0.5.17 compiler outputSelection
// (hardhat.config.js). The shared helper throws (never silently passes) if a
// layout or a baseline group is missing or empty, closing the "two empty
// layouts compare equal" false-PASS hole.
//
// RUN:
//   __decryptionAlreadyDone__=TRUE npx hardhat test tests/colfee/StorageLayout.zerodiff.test.js
//
// REGENERATE BASELINE (only on an INTENTIONAL, reviewed layout change):
//   1. git worktree add <tmp> 83871cd0        # or the new agreed base ref
//   2. ln -s <repo>/node_modules <tmp>/node_modules
//   3. (cd <tmp> && __decryptionAlreadyDone__=TRUE npx hardhat compile --force)
//   4. from <tmp>, dump normalizedLayout() for one contract of each domain
//      (contracts/core/State.sol:State and
//      contracts/connectors/loantoken/LoanTokenLogicShared.sol:LoanTokenLogicShared)
//   5. overwrite the `layouts` block of
//      tests/colfee/baselines/storage-layout.pre-colfee-base.json, updating
//      `_meta.baseRef` / `_meta.capturedOn`; keep the rest of `_meta`.
//   A baseline regenerated to make a red test go green is a storage-corrupting
//   upgrade waiting to happen — regenerate only when the layout change is the
//   reviewed intent.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { normalizedLayout, baselineFor } = require("./utils/storageLayout.js");

const BASELINE = path.join(__dirname, "baselines", "storage-layout.pre-colfee-base.json");

// Every contract whose code executes against a LIVE proxy's storage.
//
// protocol domain — registered via `replaceContract` (or reached by delegatecall
// from a registered module) and therefore running inside the sovrynProtocol
// proxy, sharing contracts/core/State.sol:
const TARGETS = [
    "contracts/core/State.sol:State", // the protocol storage itself — the anchor
    "contracts/modules/LoanClosingsShared.sol:LoanClosingsShared", // shared parent of the closings modules
    "contracts/modules/LoanClosingsWith.sol:LoanClosingsWith",
    "contracts/modules/LoanClosingsRollover.sol:LoanClosingsRollover",
    "contracts/modules/LoanClosingsLiquidation.sol:LoanClosingsLiquidation",
    "contracts/modules/LoanMaintenance.sol:LoanMaintenance",
    "contracts/modules/ExitFeeModule.sol:ExitFeeModule", // ColFee addition — must add no state
    "contracts/utils/ColFeeBorrowerExitOps.sol:ColFeeBorrowerExitOps", // ColFee addition, delegatecalled in protocol context
    // iTokenBeacon domain — beacon logic executing in an iToken proxy:
    "contracts/connectors/loantoken/LoanTokenLogicShared.sol:LoanTokenLogicShared", // shared parent
    "contracts/connectors/loantoken/modules/beaconLogicLM/LoanTokenLogicLM.sol:LoanTokenLogicLM",
    "contracts/connectors/loantoken/modules/beaconLogicWRBTC/LoanTokenLogicWrbtcLM.sol:LoanTokenLogicWrbtcLM",
];

describe("ColFee — storage-layout zero-diff (lending security perimeter)", () => {
    let baseline;

    before(() => {
        baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
    });

    it("baseline snapshot is present and non-empty for every target", () => {
        for (const fq of TARGETS) {
            const base = baselineFor(baseline, fq); // throws on missing/empty
            assert.ok(base.length > 0, `baseline for ${fq} is empty (would be a false pass)`);
        }
    });

    for (const fq of TARGETS) {
        it(`${fq}: current layout == pre-ColFee baseline (no appended state)`, async () => {
            const current = await normalizedLayout(fq);
            const base = baselineFor(baseline, fq);
            // Exact structural equality: label/slot/offset/type per entry, in order.
            assert.deepStrictEqual(
                current,
                base,
                `STORAGE LAYOUT DIFF for ${fq} vs pre-ColFee baseline:\n` +
                    `  baseline entries: ${base.length}\n  current entries : ${current.length}\n` +
                    `  current: ${JSON.stringify(current)}`
            );
        });
    }
});
