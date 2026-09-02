#!/usr/bin/env bash
#
# Boots a standalone local fork of RSK mainnet for manual QA against MetaMask
# and a dapp: it answers eth_chainId as 0x1e (30), matching the real network,
# so wallets and dapps that gate on chain id accept it. Unlike the dress
# rehearsal's per-test-file throwaway node, this one is meant to stay up for
# a whole hand-testing session and to be started, checked, and stopped as
# separate commands.
#
#   scripts/perimeter/qa-node.sh              start, stay attached (Ctrl-C stops it)
#   scripts/perimeter/qa-node.sh --detach      start, print readiness, return
#   scripts/perimeter/qa-node.sh --status      report whether it's up
#   scripts/perimeter/qa-node.sh --stop        stop the node this tool started
#
# PERIMETER_QA_PORT picks the local port (default 8545); PERIMETER_QA_RPC on
# the hardhat-config side must be kept in sync with it if it's overridden.
# PERIMETER_FORK_RPC picks the upstream RPC to fork from; PERIMETER_FORK_BLOCK
# pins the fork to a specific block.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

PORT="${PERIMETER_QA_PORT:-8545}"
FORK_RPC="${PERIMETER_FORK_RPC:-https://mainnet-dev.sovryn.app/rpc}"
QA_DIR=qa
# Scoped by port so a second node on a different PERIMETER_QA_PORT gets its
# own pidfile and log instead of colliding with (or overwriting the record
# of) one already running.
PID_FILE="$QA_DIR/node.$PORT.pid"
LOG_FILE="$QA_DIR/node.$PORT.log"

export __decryptionAlreadyDone__=TRUE

# shellcheck source=/dev/null
. "$SCRIPT_DIR/fork-node.lib.sh"

usage() {
    echo "usage: $(basename "$0") [--detach] | --stop | --status" >&2
    exit 2
}

MODE=start
DETACH=0
case "$#:${1:-}" in
    "0:") ;;
    "1:--detach") DETACH=1 ;;
    "1:--stop") MODE=stop ;;
    "1:--status") MODE=status ;;
    *) usage ;;
esac

qa_status() {
    if [ ! -f "$PID_FILE" ]; then
        echo "QA node: not running (no $PID_FILE)"
        return 0
    fi
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        local block
        block="$(rpc_block_number || true)"
        echo "QA node: running (pid $pid) at $RPC_URL block ${block:-unknown}"
    else
        echo "QA node: not running (stale pid ${pid:-?} in $PID_FILE)"
    fi
}

# Refuses to start a second node for this port over a live one: never
# overwrite the pidfile of a session that is still running. A pidfile whose
# process is already gone is a stale leftover and is removed so a new node
# can start.
qa_refuse_if_running() {
    [ -f "$PID_FILE" ] || return 0
    local pid cmd
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        cmd="$(ps -o command= -p "$pid" 2>/dev/null)"
        echo "QA node: already running for port $PORT (pid $pid: ${cmd:-?})." \
            "Refusing to overwrite $PID_FILE — stop it first with --stop, or boot" \
            "with a different PERIMETER_QA_PORT." >&2
        exit 1
    fi
    rm -f "$PID_FILE"
}

# Kills every process the recorded pid's launch actually spawned (walked via
# pid_tree, not just the one direct child a single pgrep -P would catch) —
# TERM first, KILL for whatever is still alive after the wait. This does not
# depend on npx/script forwarding the signal to the hardhat process under
# them, and it never touches a process outside that tree, so an unrelated
# process that happens to share the port is never at risk.
qa_stop() {
    if [ ! -f "$PID_FILE" ]; then
        echo "QA node: not running (no $PID_FILE)"
        return 0
    fi
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
        echo "QA node: not running (stale pid ${pid:-?} in $PID_FILE)"
        rm -f "$PID_FILE"
        return 0
    fi

    local tree
    tree="$(pid_tree "$pid")"
    # shellcheck disable=SC2086
    kill $tree 2>/dev/null || true

    local waited=0
    # shellcheck disable=SC2086
    while any_alive $tree && [ "$waited" -lt "$PORT_FREE_TIMEOUT" ]; do
        sleep 1
        waited=$((waited + 1))
    done
    # shellcheck disable=SC2086
    if any_alive $tree; then
        # shellcheck disable=SC2086
        kill -9 $tree 2>/dev/null || true
        sleep 1
    fi

    if wait_for_rpc_down; then
        rm -f "$PID_FILE"
        echo "QA node: stopped (was pid $pid)"
        return 0
    fi

    echo "QA node: pid $pid's whole process tree is gone but $RPC_URL is still" \
        "answering. Something else may now be listening on port $PORT —" \
        "investigate by hand (lsof -tiTCP:$PORT -sTCP:LISTEN); this tool will" \
        "not kill a process it did not start." >&2
    return 1
}

if [ "$MODE" = "status" ]; then
    qa_status
    exit 0
fi

if [ "$MODE" = "stop" ]; then
    qa_stop
    exit $?
fi

mkdir -p "$QA_DIR"
qa_refuse_if_running

block_args=()
if [ -n "${PERIMETER_FORK_BLOCK:-}" ]; then
    block_args=(--fork-block-number "$PERIMETER_FORK_BLOCK")
fi

export PERIMETER_QA_CHAIN_ID=30
NODE_LOG_PATH="$LOG_FILE"

if [ "$DETACH" -eq 1 ]; then
    if ! start_node nohup script -q /dev/null npx hardhat node --fork "$FORK_RPC" --port "$PORT" \
        --no-deploy "${block_args[@]+"${block_args[@]}"}"; then
        echo "QA node failed to start; see $LOG_FILE" >&2
        exit 1
    fi
    disown "$NODE_PID" 2>/dev/null || true
else
    if ! start_node script -q /dev/null npx hardhat node --fork "$FORK_RPC" --port "$PORT" \
        --no-deploy "${block_args[@]+"${block_args[@]}"}"; then
        echo "QA node failed to start; see $LOG_FILE" >&2
        exit 1
    fi
fi

echo "$NODE_PID" >"$PID_FILE"
BLOCK="$(rpc_block_number || true)"
echo "QA node ready: $RPC_URL chainId 30 fork $FORK_RPC block ${BLOCK:-unknown}"

if [ "$DETACH" -eq 1 ]; then
    exit 0
fi

trap 'qa_stop >/dev/null 2>&1 || true' EXIT INT TERM
wait "$NODE_PID" 2>/dev/null || true
