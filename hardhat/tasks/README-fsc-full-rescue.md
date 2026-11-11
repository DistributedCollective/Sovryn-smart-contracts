# Full-custody collector rescue

Only the proxy-owner multisig can withdraw. The recipient is always that same
multisig; no arbitrary recipient, token whitelist, fee collection or claim reset
exists in the rescue logic. Direct calls to the implementation cannot rescue.

The task includes source-pinned, precompiled Solidity0.5.17/optimizer200 bytecode,
so operator deployment requires no compiler download. It verifies the source,
creation/runtime hashes, exact proxy runtime, owner, guard slot and quorum.

## 1. Deploy checked logic and create the upgrade transaction

```sh
npx hardhat fsc:prepare-rescue-only --network rskMainnet --signer deployer --submit
```

Use an existing configured Exchequer-owner signer. This deploys the checked
implementation and creates **one multisig transaction**, including the first
confirmation. Other owners must reach the total quorum of3 and execute it.
Verify `getImplementation()` equals the printed rescue implementation address.
Normal collector operations then revert. This also works from the self-stopped
collector; it does not restore vulnerable logic first.

A local deployment record is written to `fsc-rescue-only-deployment.json` and is
reused if valid. `--logic ADDRESS` reuses an already-deployed matching module.
If interrupted after a transaction hash prints, inspect it before rerunning.
No blind retries or wallet-history scan is performed. Do not send funds to the
implementation address.

## 2. Create a native RBTC withdrawal transaction

```sh
npx hardhat fsc:rescue-token --network rskMainnet --signer deployer --token native --submit
```

## 3. Create an ERC20 withdrawal transaction

```sh
npx hardhat fsc:rescue-token --network rskMainnet --signer deployer --token TOKEN_ADDRESS --submit
```

Any standard ERC20 address can be selected. Each call rescues its **entire actual
balance at execution**, including holdings outside the protocol-withheld ledger.
Separate asset transactions prevent one paused token from blocking native RBTC
or other tokens. The task simulates the actual call before creating a transaction.
A token whose own contract blocks transfer remains at the collector; the rescue
logic cannot override that token's pause. No token is redeemed or sold.

All commands default to read-only preparation when `--submit` is omitted. They
use the existing Hardhat signer configuration; no Python, Foundry, keystore flags
or raw keys are needed.

## Confirm and verify

Each transaction needs3confirmations. Use an explicit generous execution gas
budget, such as1,000,000gas for these tested standard-asset operations. This
classic multisig can catch an inner failure and still produce a successful
outer receipt: check `Execution`, the stored `executed` flag, `NativeRescued` or
`TokenRescued`, and source/recipient balances. `ExecutionFailure` is not a rescue.
The local full workflow used an explicit1,000,000gas confirmation budget.

Keep the rescue-only implementation active. Existing withheld amounts,
checkpoints and user claims remain recorded, while custody moves to Exchequer.
Those ledgers must not be treated as free treasury revenue. **Do not restore
claim processing until assets are re-backed or claims are coherently resolved,**
and do not restore vulnerable AMM fee collection. Existing allowances and direct
ERC20 transfers are separate from this module; no global AMM/Zero pause is claimed.

Supported tokens must report honest balances and deliver the full amount. Paused,
fee-on-transfer, rebasing or otherwise incompatible tokens fail safely. The
known iWRBTC transfer was paused at the last inspection and must be handled later.
