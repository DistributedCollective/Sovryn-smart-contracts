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
cd "$(dirname "$0")/../.."

export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh" >/dev/null
nvm use 20.19.0 >/dev/null

KIND="${PERIMETER_FORK_KIND:-hardhat}"
RPC="${PERIMETER_FORK_RPC:-https://mainnet-dev.sovryn.app/rpc}"
NETWORK=rskForkedMainnet
LOG="${PERIMETER_REHEARSAL_LOG:-/tmp/perimeter-dress-rehearsal.log}"
RPC_URL="http://127.0.0.1:8545"
NODE_START_TIMEOUT=120
PORT_FREE_TIMEOUT=30

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
log() { echo "$@" | tee -a "$LOG"; }

log "== $(date -u +%FT%TZ) kind=$KIND network=$NETWORK rpc=$RPC =="

FILES=(
    "tests-onchain/perimeter/forkOps.test.js"
    "tests-onchain/perimeter/phase1Preflight.test.js"
    "tests-onchain/perimeter/phase2Stack.test.js"
    "tests-onchain/perimeter/perimeterDelayE2E.test.js"
)

NODE_PID=""
NODE_LOG=""

# The eth_chainId probe the dispatch specifies: any answer at all means the
# JSON-RPC server is up, regardless of node kind.
rpc_is_up() {
    curl -s -m 2 -X POST \
        -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
        -H 'content-type: application/json' \
        "$RPC_URL" 2>/dev/null | grep -q result
}

rpc_block_number() {
    local hex
    hex=$(
        curl -s -m 5 -X POST \
            -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' \
            -H 'content-type: application/json' \
            "$RPC_URL" 2>/dev/null | sed -n 's/.*"result":"0x\([0-9a-fA-F]*\)".*/\1/p'
    )
    [ -n "$hex" ] && echo $((16#$hex))
}

wait_for_rpc_up() {
    local waited=0
    while [ "$waited" -lt "$NODE_START_TIMEOUT" ]; do
        rpc_is_up && return 0
        if [ -n "$NODE_PID" ] && ! kill -0 "$NODE_PID" 2>/dev/null; then
            return 1 # the node process exited before it ever answered
        fi
        sleep 1
        waited=$((waited + 1))
    done
    return 1
}

wait_for_rpc_down() {
    local waited=0
    while [ "$waited" -lt "$PORT_FREE_TIMEOUT" ]; do
        rpc_is_up || return 0
        sleep 1
        waited=$((waited + 1))
    done
    return 1
}

# Starts the fork node once, retrying a single time if it dies with a
# transient connect-timeout while it is dialing the fork RPC.
start_node() {
    local block_args=()
    if [ -n "${PERIMETER_FORK_BLOCK:-}" ]; then
        block_args=(--fork-block-number "$PERIMETER_FORK_BLOCK")
    fi

    local attempt
    for attempt in 1 2; do
        NODE_LOG="$(mktemp -t perimeter-hh-node)"
        __decryptionAlreadyDone__=TRUE npx hardhat node --fork "$RPC" --no-deploy \
            "${block_args[@]+"${block_args[@]}"}" >"$NODE_LOG" 2>&1 &
        NODE_PID=$!

        if wait_for_rpc_up; then
            return 0
        fi

        kill "$NODE_PID" 2>/dev/null || true
        wait "$NODE_PID" 2>/dev/null || true
        NODE_PID=""
        wait_for_rpc_down || true

        if [ "$attempt" -eq 1 ] && grep -q "HH604" "$NODE_LOG" 2>/dev/null; then
            log "   node did not come up (HH604 connect timeout) — retrying once"
            continue
        fi
        return 1
    done
    return 1
}

stop_node() {
    if [ -n "$NODE_PID" ]; then
        kill "$NODE_PID" 2>/dev/null || true
        wait "$NODE_PID" 2>/dev/null || true
    fi
    NODE_PID=""
    wait_for_rpc_down || true
}

trap stop_node EXIT

TOTAL_PASS=0
TOTAL_FAIL=0
OVERALL_FAILED=0

for file in "${FILES[@]}"; do
    name="$(basename "$file" .test.js)"

    if ! start_node; then
        log "$name: NODE FAILED TO START"
        [ -n "$NODE_LOG" ] && cat "$NODE_LOG" >>"$LOG" 2>/dev/null
        OVERALL_FAILED=1
        stop_node
        continue
    fi
    log "   node ready for $name (block $(rpc_block_number))"

    TEST_OUT="$(mktemp -t perimeter-test-out)"
    START_TS=$(date +%s)
    set +e
    __decryptionAlreadyDone__=TRUE script -q /dev/null npx hardhat test "$file" \
        --network "$NETWORK" >"$TEST_OUT" 2>&1
    TEST_STATUS=$?
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
    stop_node
done

log "== summary: $TOTAL_PASS passing / $TOTAL_FAIL failing =="

[ "$OVERALL_FAILED" -eq 0 ]
