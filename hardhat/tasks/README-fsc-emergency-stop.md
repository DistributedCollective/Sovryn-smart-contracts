# Reversible FeeSharingCollector emergency stop

Uses the existing configured Hardhat signer. Read-only preparation:

```sh
npx hardhat fsc:emergency-stop --network rskMainnet
```

Create **one** Exchequer multisig proposal:

```sh
npx hardhat fsc:emergency-stop --network rskMainnet --signer deployer --submit
```

Select an actual configured multisig owner. Submission includes the first
confirmation; the checked quorum is 3. The task only creates a proposal. Verify
execution and `getImplementation() == collector proxy` after quorum.

The operation calls `setImplementation(proxyAddress)` on the proxy itself.
Fallback delegation then recursively reverts, stopping delegated collector
functions. This is a temporary gas-consuming shutdown, not a normal pause flag.
Direct proxy administration remains usable, including restoration. The exact
live runtime/control slots were tested locally for stop, balance preservation
and restoration through the actual multisig source.

Zero is rejected as implementation. A non-existent implementation can silently
succeed as a no-op; do not use it as an equivalent clean revert stop.

The shutdown disables delegated fee collection, claims and native fee intake.
Dependent fee-paying operations may revert. Direct ERC20 transfers can still
arrive. It does not establish a global AMM/Zero pause or recover stolen assets.

Existing whitelist-removal calls also revert while logic is stopped. Do not
restore vulnerable logic with an exploitable route and live whitelist: resume
only through a separately reviewed fix/restricted maintenance procedure. The
original implementation is printed for recovery records, not as advice to
restore it immediately.

If submission is interrupted, inspect the printed transaction hash and multisig
before rerunning to avoid duplicate proposals. No separate confirmation or
execution is sent by this task.
