# Withdraw protocol-withheld fees to Exchequer

Uses the existing `withdrawProtocolWithheldFees(token, receiver)` function.
The recipient is the collector's Exchequer owner multisig. No contract upgrade,
redemption or full-balance rescue is performed.

Preview the current withhold list and simulate each nonzero withdrawal as Exchequer:

```sh
npx hardhat feeSharingCollector:withdrawProtocolWithheldFees --network rskMainnet
```

Create one multisig transaction per nonzero asset with an existing configured owner:

```sh
npx hardhat feeSharingCollector:withdrawProtocolWithheldFees --network rskMainnet --signer 0xFEe171A152C02F336021fb9E79b4fAc2304a9E7E --submit
```

Unlock your existing signer at the local CryptoEnv password prompt. `--signer`
accepts a configured name, address or account index; selecting an address does
not load its key. No compiler download or new deployment is required.

Select a single asset with `--token RBTC`, `--token native`, or an ERC20 address.
RBTC is encoded with the collector's native checkpoint token address. A token
removed from the current withhold list can still have withheld fees; select its
address explicitly. Zero withheld balances are skipped. Printed amounts are base units.

Submissions run **one at a time**, waiting for a successful mined receipt and
verifying the stored multisig transaction before sending another. They include
the submitter's first confirmation; three owner confirmations are required for
execution. The task does not scan wallet history for matching transactions.

Keep the same `--journal` on retry (default `fsc-withheld-withdrawals.json`).
Recorded broadcasts are verified before further sends, and completed submissions
in this run are skipped. An ambiguous send stops with an `inFlight` marker;
inspect the transaction before retrying. Inspect a stale lock before removing it.
For a later, separate withdrawal of newly accumulated fees, use a new journal.
Use the signer exclusively while the task is running.

The function withdraws the full **protocol-withheld amount at execution**, which
can differ from the preview if fees accumulate. Submission alone does not move
assets. After quorum, check the multisig `Execution` event and stored `executed`
flag, the collector's `ProtocolWithheldFeesWithdrawn` event, and recipient balances.
The classic multisig can emit `ExecutionFailure` within a successful outer receipt.
Use an adequate execution gas limit, such as 1,000,000 for the tested standard-asset
calls. Ordinary collector holdings and staker checkpoints are outside this task.
