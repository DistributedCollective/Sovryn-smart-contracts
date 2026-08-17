#!/usr/bin/env bash
#
# Storage-layout zero-diff regression for the security-perimeter delay hooks.
#
# The lending + borrower/margin delay reroute adds NO storage to any deployed
# upgradeable contract: the queue/controller pointers live in EIP-1967-style
# unstructured slots and the ColFeeBorrowerExit mixin declares no state vars.
# This script PROVES that by comparing `forge inspect <C> storageLayout` for
# every hooked/upgradeable contract against a baseline git ref (the pre-hooks
# commit) checked out into a throwaway worktree. Any label/slot/offset/type
# difference (AST node-id suffixes normalized out) fails the check.
#
# Hardening:
#   * Build BOTH trees with `forge build --force --extra-output storageLayout`
#     BEFORE inspecting. A stale incremental cache omits `storageLayout` for
#     some contracts and yields a spurious ~380-line diff (false FAIL).
#   * FAIL HARD when a `forge inspect` errors OR returns an EMPTY / zero-entry
#     layout — a typo'd or non-compiling contract name would otherwise produce
#     two empty files that `diff -q` calls equal ("ZERO-DIFF OK" with zero
#     entries = silent FALSE PASS). forge's stderr is surfaced, never
#     redirected to /dev/null.
#   * LoanTokenLogicStandard is in the CONTRACTS list: it compiles against the
#     modified LoanTokenLogicShared base and is a deployed beacon module.
#
# Usage:  tests/colfee/storage-layout-zero-diff.sh [BASE_REF]
#   BASE_REF defaults to the pre-hooks commit.
set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
BASE_REF="${1:-51052975}"
WORKTREE="$(mktemp -d)/base-colfee"
OUT="$(mktemp -d)"

# LoanTokenLogicStandard added: deployed beacon module compiling against
# the modified LoanTokenLogicShared base.
CONTRACTS="LoanTokenLogicStandard LoanTokenLogicLM LoanTokenLogicWrbtcLM LoanMaintenance LoanClosingsWith LoanClosingsLiquidation LoanClosingsRollover ExitFeeModule"

cleanup() { git -C "$REPO" worktree remove --force "$WORKTREE" >/dev/null 2>&1; }
trap cleanup EXIT

git -C "$REPO" worktree add -f "$WORKTREE" "$BASE_REF" >/dev/null 2>&1 || { echo "worktree add failed"; exit 2; }
ln -sfn "$REPO/node_modules" "$WORKTREE/node_modules"
mkdir -p "$WORKTREE/foundry"
ln -sfn "$REPO/foundry/lib" "$WORKTREE/foundry/lib" 2>/dev/null

# Normalize solc AST node-id suffixes in type names (e.g.
# `struct(Bytes32Set)1140_storage`, `contract(IWrbtcERC20)3014`) — the numeric
# id follows a `)` and shifts with the compilation set; it is NOT a
# storage-layout change. Strip the digits after every `)`.
JQ='[.storage[] | {label: .label, slot: .slot, offset: .offset, type: (.type | gsub("\\)[0-9]+"; ")"))}]'

# Force a clean rebuild WITH storageLayout in both trees, so `forge inspect`
# can never read a stale incremental artifact that omits the layout.
echo "Building (force, +storageLayout) — new tree ..."
( cd "$REPO" && forge build --force --extra-output storageLayout ) || { echo "forge build failed (new tree)"; exit 2; }
echo "Building (force, +storageLayout) — base tree $BASE_REF ..."
( cd "$WORKTREE" && forge build --force --extra-output storageLayout ) || { echo "forge build failed (base tree $BASE_REF)"; exit 2; }

# Inspect one contract in one tree; FAIL HARD on forge error / empty / zero
# entries. stderr is NOT discarded so a bad contract name surfaces forge's
# own diagnostic. Writes the normalized JSON array to $3.
inspect() {
  local dir="$1" C="$2" outfile="$3" tree="$4"
  local raw
  # Capture stdout; let stderr flow to the terminal. A non-zero exit aborts.
  raw="$( cd "$dir" && forge inspect "$C" storageLayout --json )" \
    || { echo "FATAL: 'forge inspect $C storageLayout' FAILED in $tree tree"; exit 2; }
  if [ -z "$raw" ]; then
    echo "FATAL: 'forge inspect $C storageLayout' returned EMPTY output in $tree tree (bad name / non-compiling contract?)"
    exit 2
  fi
  printf '%s' "$raw" | jq -S "$JQ" > "$outfile" \
    || { echo "FATAL: jq failed to parse '$C' storageLayout in $tree tree"; exit 2; }
  local n
  n="$(jq 'length' "$outfile")"
  if [ "$n" = "null" ] || [ "$n" -eq 0 ]; then
    echo "FATAL: '$C' storageLayout has ZERO entries in $tree tree — refusing to treat as ZERO-DIFF (would be a silent false pass)"
    exit 2
  fi
}

FAIL=0
for C in $CONTRACTS; do
  inspect "$REPO"     "$C" "$OUT/$C.new.json"  "new"
  inspect "$WORKTREE" "$C" "$OUT/$C.base.json" "base"
  if diff -q "$OUT/$C.base.json" "$OUT/$C.new.json" >/dev/null; then
    echo "ZERO-DIFF OK   $C  ($(jq 'length' "$OUT/$C.new.json") storage entries identical)"
  else
    echo "STORAGE DIFF   $C:"
    diff "$OUT/$C.base.json" "$OUT/$C.new.json"
    FAIL=1
  fi
done

echo "---"
if [ "$FAIL" -eq 0 ]; then
  echo "STORAGE-LAYOUT ZERO-DIFF: PASS (all hooked/upgradeable contracts unchanged vs $BASE_REF)"
else
  echo "STORAGE-LAYOUT ZERO-DIFF: FAIL"
fi
exit $FAIL
