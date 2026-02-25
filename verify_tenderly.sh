#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file '$ENV_FILE' not found. Provide one or run: cp .env.example .env" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

required_vars=(
  TENDERLY_ACCESS_TOKEN
  TENDERLY_VIRTUAL_TESTNET_RPC_URL
  TENDERLY_VERIFIER_URL
  TENDERLY_CHAIN_ID
  CONTRACT_ADDRESS
  CONTRACT_FULLY_QUALIFIED_NAME
  SOLC_VERSION
)

missing=()
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required env vars: ${missing[*]}. Please set them in '$ENV_FILE'." >&2
  exit 1
fi

echo "Verifying $CONTRACT_FULLY_QUALIFIED_NAME at $CONTRACT_ADDRESS on chain $TENDERLY_CHAIN_ID via $TENDERLY_VERIFIER_URL"

verify_cmd=(
  forge verify-contract
  "$CONTRACT_ADDRESS"
  "$CONTRACT_FULLY_QUALIFIED_NAME"
  --etherscan-api-key "$TENDERLY_ACCESS_TOKEN"
  --verifier-url "$TENDERLY_VERIFIER_URL"
  --compiler-version "$SOLC_VERSION"
  --chain-id "$TENDERLY_CHAIN_ID"
  --watch
)

set +e
verify_output="$("${verify_cmd[@]}" 2>&1)"
verify_status=$?
set -e

echo "$verify_output"

if grep -qi "already verified" <<<"$verify_output"; then
  echo "Contract is already verified on Tenderly."
  exit 0
fi

if [[ $verify_status -eq 0 ]]; then
  echo "Verification submitted successfully."
  exit 0
fi

echo "Verification failed (exit code $verify_status)." >&2
exit "$verify_status"
