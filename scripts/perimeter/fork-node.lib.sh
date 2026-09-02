#!/usr/bin/env bash
#
# Shared boot/readiness/teardown helpers for a local hardhat fork node,
# used by both the dress rehearsal (a fresh throwaway node per fixture file)
# and the QA node launcher (one long-lived node for manual testing).
#
# The caller sets PORT before sourcing this file. NODE_START_TIMEOUT and
# PORT_FREE_TIMEOUT may be set by the caller before sourcing to override the
# defaults below; a caller may also redefine log() after sourcing to route
# messages somewhere other than stdout.
#
# Whatever is LISTENING on the port is the authority on whether a node is up:
# the recorded PID may be a wrapper (npx, script) whose own death does not
# always take the hardhat process it spawned with it.

export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh" >/dev/null
nvm use 20.19.0 >/dev/null

: "${NODE_START_TIMEOUT:=120}"
: "${PORT_FREE_TIMEOUT:=30}"
RPC_URL="http://127.0.0.1:$PORT"

NODE_PID=""
NODE_LOG=""

log() { echo "$@"; }

# Any answer at all means the JSON-RPC server is up, regardless of node kind.
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

node_listeners() {
    lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
}

# Best-effort "pid (command line)" for whatever is listening on the port, one
# per line, for error messages. Never used to decide what to kill.
node_listener_info() {
    local pids pid
    pids="$(node_listeners)"
    [ -z "$pids" ] && return 0
    for pid in $pids; do
        ps -o pid=,command= -p "$pid" 2>/dev/null
    done
}

# Best effort teardown: the recorded process, then anything still holding the
# port, escalating to SIGKILL. Non-zero when the port is still answering.
shutdown_node() {
    local pids
    pids="$(node_listeners)"
    if [ -n "$NODE_PID" ]; then
        kill "$NODE_PID" 2>/dev/null || true
    fi
    if [ -n "$pids" ]; then
        # shellcheck disable=SC2086
        kill $pids 2>/dev/null || true
    fi
    if [ -n "$NODE_PID" ]; then
        wait "$NODE_PID" 2>/dev/null || true
    fi
    NODE_PID=""

    if wait_for_rpc_down; then
        return 0
    fi
    pids="$(node_listeners)"
    if [ -n "$pids" ]; then
        # shellcheck disable=SC2086
        kill -9 $pids 2>/dev/null || true
    fi
    wait_for_rpc_down
}

# A node that outlives its own teardown is fatal, and deliberately so: the
# next start would either fail to bind or, worse, bind somewhere the
# readiness probe happily accepts while state from the old fork lingers.
stop_node_or_die() {
    if ! shutdown_node; then
        log "FATAL: $RPC_URL is still answering after the fork node was told to stop." \
            "Stop it by hand (lsof -tiTCP:$PORT -sTCP:LISTEN) and re-run."
        exit 3
    fi
}

# Nothing may be serving the port at the moment a node is spawned: a spawn
# that cannot bind is silent, and the readiness probe would pass against
# whatever is already there. Reports who already holds it so the next person
# can tell whether it is safe to touch.
require_port_free() {
    if rpc_is_up || [ -n "$(node_listeners)" ]; then
        log "FATAL: something is already serving $RPC_URL before this run's node was started."
        local info
        info="$(node_listener_info)"
        if [ -n "$info" ]; then
            log "$info" | while IFS= read -r line; do log "  owned by: $line"; done
        fi
        log "Stop it by hand if it is yours (lsof -tiTCP:$PORT -sTCP:LISTEN), or use a" \
            "different port if it belongs to someone else, and re-run."
        exit 3
    fi
}

# Starts the given hardhat node command (passed as "$@") as a background
# process, retrying once if it dies with a transient HH604 connect-timeout
# while dialing the fork RPC. Output goes to NODE_LOG_PATH if the caller set
# one (truncated fresh on each attempt), otherwise to a new temp file per
# attempt. Sets NODE_PID and NODE_LOG on success.
start_node() {
    local attempt
    for attempt in 1 2; do
        require_port_free

        if [ -n "${NODE_LOG_PATH:-}" ]; then
            NODE_LOG="$NODE_LOG_PATH"
            : >"$NODE_LOG"
        else
            NODE_LOG="$(mktemp -t perimeter-hh-node)"
        fi
        "$@" >"$NODE_LOG" 2>&1 &
        NODE_PID=$!

        if wait_for_rpc_up; then
            return 0
        fi

        stop_node_or_die

        if [ "$attempt" -eq 1 ] && grep -q "HH604" "$NODE_LOG" 2>/dev/null; then
            log "   node did not come up (HH604 connect timeout) — retrying once"
            continue
        fi
        return 1
    done
    return 1
}
