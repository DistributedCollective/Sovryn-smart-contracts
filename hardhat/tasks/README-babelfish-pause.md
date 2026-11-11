# Pause Babelfish basset deposits

This Hardhat task uses the existing configured signer to create zero-value
Babelfish multisig transactions calling `PauseManager.pause(basset)`. It discovers
the basket through the live Masset proxy and skips bassets already paused. No
contract compilation or new key configuration is required.

Preview all current unpaused bassets without loading a signer or submitting:

```sh
npx hardhat babelfish:pause-bassets --network rskMainnet
```

Submit using your existing configured multisig owner:

```sh
npx hardhat babelfish:pause-bassets --network rskMainnet --signer deployer --submit
```

`--signer` also accepts a configured account index or address. To pause only one
basset, append `--token <basset-address>`. An explicitly empty token or an address
outside the current basket is refused.

Defaults are Rootstock mainnet (chain ID 30), Masset proxy
`0x1440d19436bEeaF8517896bffB957a88EC95a00F`, PauseManager
`0x3e96B99993B39a01e620Be71eFB5bF8AC6F7fb0E` and its owner multisig
`0xbD687d470A7E8B36C666968bb79376904725E4DD`. The task checks live manager pointers,
ownership, three-signature quorum and signer membership before submission, then
rechecks authority and token eligibility before every subsequent submission.
The pause ABI and token addresses were cross-checked against
`DistributedCollective/babelfish-sc`, branch `development`.

## Sequential submission and recovery

**Every submission must mine successfully and its stored multisig transaction
must match before the next submission is sent.** A receipt timeout, failed
transaction or mismatched stored call stops the task. This waits for the owner's
submission to mine; it does not wait for the other owners to confirm or for the
multisig transaction to execute. Each submission includes the submitting owner's
first confirmation. Two other owners must confirm each transaction to reach
three signatures; that third confirmation normally executes it automatically.
The task sends no separate confirmation or execution calls.

The default journal is `babelfish-pause-bassets.json` in the working directory.
Keep the SAME journal on retry, or choose a persistent path with `--journal`.
Recorded broadcasts are reverified before new submissions. An uncertain send
leaves `inFlight` set and refuses automatic retry: inspect the chain and journal
before proceeding. A definitive nonce-too-high rejection clears that marker and
stops; let earlier transactions mine before rerunning with the same journal.
A crash may leave the journal `.lock` file; verify no process is still running
and inspect the journal and chain before removing a stale lock.

Use the signing account exclusively during the run. Do not switch journals to
retry an interrupted run: the task does not scan multisig history, so a fresh
journal can create duplicate multisig transactions. A later, deliberately new
pause run after unpausing requires a fresh journal.

After the other owners confirm, verify `transactions(id).executed == true` on
the multisig and `isPaused(basset) == true` on PauseManager. A successful outer
receipt alone does not establish successful multisig execution.

**This pause stops new deposits/minting. It leaves redemptions enabled.**

## Reverse only this pause run

Preview reversing transactions using the ORIGINAL pause journal:

```sh
npx hardhat babelfish:unpause-bassets --network rskMainnet --pausejournal babelfish-pause-bassets.json
```

Create those reversing multisig transactions:

```sh
npx hardhat babelfish:unpause-bassets --network rskMainnet --pausejournal babelfish-pause-bassets.json --signer deployer --submit
```

The task calls `unpause(basset)` only for executed pause transactions recorded in
that source journal. It verifies their original receipts, exact submission
calldata and executed stored multisig calls. Every original pause transaction
must have executed before reversal begins; unresolved pending pause transactions
could otherwise execute later and pause an asset again.

**Assets paused before the original run remain protected.** New pause journals
capture that baseline at a fixed block before the first submission. The reversal
checks it against historical chain state. For journals created by the earlier
version, it reconstructs the baseline from the block immediately before the
first recorded submission. Historical RPC calls must be available; failure to
verify the baseline stops the task. It never substitutes the current paused-token
list for the original scope. Assets already unpaused are skipped. `--token` may
select only one of the assets paused by that run.

The source pause journal is retained unchanged. The reversal uses a SEPARATE
`babelfish-unpause-bassets.json` journal by default; `--journal` can select another
persistent output path. Keep the same pair of source and reversal journals when
retrying. The original pause journal is locked throughout reversal submissions,
preventing the pause task from resuming concurrently. Both lock files can remain
following a hard crash; inspect processes, journals and chain state before
removing stale locks. A changed source journal requires operator review.

Unpause submissions use the same strict receipt/readback waiting as pause
submissions. They include the first owner's confirmation; two other owners must
confirm to execute. Afterwards verify `executed == true`, restored assets have
`isPaused == false`, and the original baseline assets remain paused. Unpausing is
owner-only; emergency pausers cannot unpause independently.

These tasks manage per-basset deposit pauses. They do not change XUSD ownership
or replace contract implementations.

## Stop aggregate mint and redemption through XUSD ownership

The separate `babelfish:emergency-pause` task creates **one zero-value multisig
transaction** calling `Masset.setTokenOwner(ownerMultisig)`. After three owners
confirm and the wallet executes, Masset loses XUSD supply authority. Both mint
and redemption stop, including the local bridge callback. Ordinary XUSD transfers
and allowances remain available. The multisig temporarily gains direct XUSD
supply authority; existing administrative powers remain. This is a broad supply
control, not a redemption-only switch or a universal token transfer pause.

The literal alias `babelfish:emergency-pause-mint-redemptions` runs the same
control. Both names share the existing `babelfish-pause-redemptions.json` journal
default so changing command names never starts a new run. Per-asset pauses are
not required for this aggregate stop; they remain an optional separate control.

No contracts are deployed or upgraded. No per-basset pause flag is changed.
Both assets paused before the stop and assets paused subsequently remain paused
when aggregate service is restored.

Preview the stop with no signer loading, journal writes or submissions:

```sh
npx hardhat babelfish:emergency-pause --network rskMainnet
```

An owner may explicitly submit using the existing configured signer:

```sh
npx hardhat babelfish:emergency-pause --network rskMainnet --signer deployer --journal babelfish-pause-redemptions.json --submit
```

This mines the submitting owner's first confirmation. **Submission success is
not stop execution.** Two other owners must confirm; the third confirmation
normally executes. Verify the printed multisig transaction has `executed=true`
and `XUSD.owner()` equals the wallet before reporting the stop as active. These
tasks never send separate confirmation or execution calls.

Defaults are chain ID 30, the Masset and wallet listed above, and XUSD
`0xb5999795BE0EbB5bAb23144AA5FD6A02D080299F`. The task verifies Masset's token
pointer and ownership, XUSD ownership, and the wallet's actual three-of-five
configuration. `--masset`, `--xusd` and `--multisig` select an explicitly reviewed
contract context, primarily for controlled local testing; there is no arbitrary
recipient or renunciation parameter. `--signer` accepts a configured name,
account index or address and must be a current wallet owner.

### Restore directly through XUSD

Keep the original stop journal. Preview restoration only after its exact stop
transaction has executed:

```sh
npx hardhat babelfish:unpause-redemptions --network rskMainnet --pausejournal babelfish-pause-redemptions.json
```

Explicitly submit the reverse transaction using a separate output journal:

```sh
npx hardhat babelfish:unpause-redemptions --network rskMainnet --pausejournal babelfish-pause-redemptions.json --journal babelfish-unpause-redemptions.json --signer deployer --submit
```

Restoration calls **XUSD.transferOwnership(Masset) directly**. Calling
`Masset.setTokenOwner` after the stop cannot restore ownership because Masset no
longer owns XUSD. As with the stop, two other owners must confirm the submitted
transaction. Verify `executed=true` and `XUSD.owner()` equals Masset afterwards,
then check the intended mint/redemption flows and preserved basset pauses.

### One-operation journals and recovery

Each task's output journal contains at most one own submission. Keep the same
journal when retrying. The task waits for a successful receipt and verifies the
outer transaction's sender, destination, nonce, zero value and exact calldata,
its single wallet `Submission` event, and the stored destination/value/calldata.
Retries print the verified multisig transaction ID and do not submit another
transaction, even if it is still waiting for other owners. Existing journal
records are verified even when current ownership already matches the target.

Journals bind the action, exact operation, chain, signer, contract addresses,
runtime hashes, EIP-1967 implementation addresses and code hashes, and actual
wallet owners. A changed identity or source journal stops the task. Restoration
requires the original stop receipt and exact stored call with `executed=true`;
a mined submission or one confirmation is insufficient. It retains the source
journal unchanged and holds an exclusive source lock throughout submission.

The task atomically writes `inFlight` before sending, then saves the transaction
hash before waiting for its receipt. Any thrown send remains uncertain and
requires chain/journal inspection before retry; the task never guesses that a
broadcast failed. A saved hash with no successful receipt also stops the run.
Exclusive `.lock` files prevent concurrent task runs; a hard crash may leave a
stale lock. Verify the process has stopped and inspect both chain and journal
before removing a stale lock or resolving an uncertain marker. Never discard a
journal to bypass an error. Use the submitting account exclusively during a run.

There are no wallet-history or duplicate scans. A fresh journal can create a
duplicate pending transaction, so only use it for a deliberately new reviewed
run. A completed stop journal cannot be reused for a new stop after restoration.
A fresh run started in an already-target ownership state previews a no-op.
Owner/admin changes and custom proxy mechanisms outside EIP-1967 require separate
review; these tasks bind the deployed Babelfish control context described here.

Final confirmations or explicit execution need enough gas for the inner call.
Automatic estimation can cover an outer confirmation that records an inner
`ExecutionFailure`. Check both the stored `executed` flag and the actual XUSD
owner; a successful confirmation receipt alone does not establish the stop or
restoration.
