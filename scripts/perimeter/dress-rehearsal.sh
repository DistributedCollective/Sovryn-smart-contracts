#!/usr/bin/env bash
#
# One-command Phase 2 dress rehearsal. Runs the sequenced fork suite that:
#   1. finishes whatever is left of the live Phase 1 governance proposals,
#   2. upgrades the live controller to the delay build and activates Phase 2
#      through its own two governance proposals, arming the withdrawal delay
#      on a queue owned and administered by the real multisig, and
#   3. drives all six operator scenarios through that multisig at its real
#      confirmation threshold.
#
# Each test file gets its own fresh fork node. phase2Stack.test.js and
# perimeterDelayE2E.test.js both build the activated-perimeter fixture from
# scratch, and the delay's own governance proposals refuse to install over a
# target that already carries them — so the four files cannot share one node,
# and this script tears its node down and starts a new one between files.
#
# PERIMETER_FORK_KIND selects the node kind; only "hardhat" runs today. The
# shared governance helpers (createAndQueueGovernorOwnerSip and friends) pull
# in @nomicfoundation/hardhat-network-helpers for time travel and mining, and
# that package only speaks to a hardhat node's own RPC methods — so "anvil"
# and "tenderly" fail fast below rather than starting a node the suite cannot
# drive against. The case arms are kept so the intended shape stays visible:
# once the helpers are migrated off hardhat-network-helpers, the network
# rskMainnetTenderly signs with mainnetAccounts (real keys, no local
# deployer), so ethers.getSigners() would return production signers only —
# the fixture's deployer would then have to be an impersonated address,
# supplied as PERIMETER_DEPLOYER and wired into setupGovernanceContext's
# caller (phase2Stack.js) in place of ctx.deployerSigner.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

KIND="${PERIMETER_FORK_KIND:-hardhat}"
RPC="${PERIMETER_FORK_RPC:-https://mainnet-dev.sovryn.app/rpc}"
NETWORK=rskForkedMainnet
LOG="${PERIMETER_REHEARSAL_LOG:-/tmp/perimeter-dress-rehearsal.log}"
PORT=8545

export __decryptionAlreadyDone__=TRUE

# shellcheck source=/dev/null
. "$SCRIPT_DIR/fork-node.lib.sh"

# Overrides the lib's plain-echo default so every message also lands in the
# run's log file, not just the terminal.
log() { echo "$@" | tee -a "$LOG"; }

case "$KIND" in
    hardhat)
        ;;
    anvil)
        echo "PERIMETER_FORK_KIND=anvil is not runnable yet: the shared governance helpers" \
            "depend on @nomicfoundation/hardhat-network-helpers, which only talks to a" \
            "hardhat node's own RPC methods. Migrate the helpers off it before using this" \
            "node kind." >&2
        exit 2
        ;;
    tenderly)
        echo "PERIMETER_FORK_KIND=tenderly is not runnable yet: the shared governance" \
            "helpers depend on @nomicfoundation/hardhat-network-helpers, which only talks" \
            "to a hardhat node's own RPC methods. Migrate the helpers off it before using" \
            "this node kind." >&2
        exit 2
        ;;
    *)
        echo "unknown PERIMETER_FORK_KIND=$KIND" >&2
        exit 2
        ;;
esac

: >"$LOG"
log "== $(date -u +%FT%TZ) kind=$KIND network=$NETWORK rpc=$RPC =="

FILES=(
    "tests-onchain/perimeter/forkOps.test.js"
    "tests-onchain/perimeter/phase1Preflight.test.js"
    "tests-onchain/perimeter/phase2Stack.test.js"
    "tests-onchain/perimeter/perimeterDelayE2E.test.js"
)

# Starts this rehearsal's fork node via the shared start_node, with the
# --fork-block-number override applied when PERIMETER_FORK_BLOCK is set.
start_rehearsal_node() {
    local block_args=()
    if [ -n "${PERIMETER_FORK_BLOCK:-}" ]; then
        block_args=(--fork-block-number "$PERIMETER_FORK_BLOCK")
    fi
    start_node npx hardhat node --fork "$RPC" --no-deploy "${block_args[@]+"${block_args[@]}"}"
}

trap 'shutdown_node || true' EXIT

TOTAL_PASS=0
TOTAL_FAIL=0
OVERALL_FAILED=0

for file in "${FILES[@]}"; do
    name="$(basename "$file" .test.js)"

    if ! start_rehearsal_node; then
        log "$name: NODE FAILED TO START"
        [ -n "$NODE_LOG" ] && cat "$NODE_LOG" 2>/dev/null | tee -a "$LOG"
        OVERALL_FAILED=1
        continue
    fi
    log "   node ready for $name (block $(rpc_block_number))"

    TEST_OUT="$(mktemp -t perimeter-test-out)"
    START_TS=$(date +%s)
    set +e
    # Streamed to the terminal AND the temp file as it happens (this script is
    # meant to be watched live); the pass/fail signal is still the test
    # process's own exit code, read from PIPESTATUS[0] rather than tee's.
    __decryptionAlreadyDone__=TRUE script -q /dev/null npx hardhat test "$file" \
        --network "$NETWORK" 2>&1 | tee "$TEST_OUT"
    TEST_STATUS=${PIPESTATUS[0]}
    set -e
    ELAPSED=$(($(date +%s) - START_TS))

    cat "$TEST_OUT" >>"$LOG"

    PASS_N=$(grep -oE '[0-9]+ passing' "$TEST_OUT" | tail -1 | grep -oE '^[0-9]+' || true)
    FAIL_N=$(grep -oE '[0-9]+ failing' "$TEST_OUT" | tail -1 | grep -oE '^[0-9]+' || true)
    PASS_N="${PASS_N:-0}"
    FAIL_N="${FAIL_N:-0}"
    TOTAL_PASS=$((TOTAL_PASS + PASS_N))
    TOTAL_FAIL=$((TOTAL_FAIL + FAIL_N))

    log "$name: $PASS_N passing / $FAIL_N failing / ${ELAPSED}s"

    if [ "$TEST_STATUS" -ne 0 ] || [ "$FAIL_N" -gt 0 ]; then
        OVERALL_FAILED=1
    fi

    rm -f "$TEST_OUT"
    stop_node_or_die
done

log "== summary: $TOTAL_PASS passing / $TOTAL_FAIL failing =="

[ "$OVERALL_FAILED" -eq 0 ]
