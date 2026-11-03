# SIP-0097 read-only builder interface

**AMM target deployed and fully verified:** `AMMEmergencyHalt` at
`0x8c293ed020f4d7321b6b16c71584fddb560e0ebd` is bound in the current manifest.
The medianizer rehearsal target is superseded. See [dedicated halt](../amm-emergency-halt/README.md).

Both halt deployments and the immutable published SIP are verified and bound.
`DOCUMENT.finalized = true` permits read-only preparation for the production
network after all current-state preflight checks pass. It does not send, sign,
create, vote, queue or execute a proposal.

`hardhat/tasks/sips/args/sipArgs.js` exports `getArgsSip0097Part1(hre)`,
`getArgsSip0097Part2(hre)` and `getArgsSip0097Part3(hre)`. Each returns
`{ args, governor: "GovernorOwner" }`; helpers only read state.

Part 1 changes the three AMM registry keys Network, Formula and
ConverterRegistryData. Part 2 halts ten Zero financial proxies and Part 3
halts six auxiliary proxies. Each proposal is independently atomic; the proposed combined scope requires all
three. LP-token transfers remain enabled, and
SwapSettings and the fee controller remain unchanged.

The verified deployed Zero halt address and published document identity are
source constants. Runtime inputs cannot override them. The lower-level
`actionsForPart` only constructs arrays.

A local fork caller must explicitly supply
`hre.sip0097Local = { address, pin: { block, hash } }`, with the exact approved
baseline block/hash in `sip0097.manifest.json`, an explicit HTTP loopback URL,
chain 31337 and an Anvil/Hardhat client. Local descriptions are marked
`LOCAL FORK DRAFT ONLY`. The GovernorOwner deployment alias must match the
manifest. No other network/profile is accepted.

`preflight(provider, blocker, part)` is reusable read-only preparation validation.
All governance, AMM/FSC and sixteen native Zero proxy checks use one latest
block number, whose hash is rechecked before returning `{ block, hash }`.
Each other group may be entirely at its original state or entirely halted;
a mixed group is rejected. The selected group must still be entirely original.
Native Zero getters remain available after delegated calls halt.

The FeeSharingCollector converter whitelist must be empty at preparation and
must remain empty throughout the pause. Preparation is not an execution-time
invariant: independently check the exact whitelist, code, owner and registry
bindings immediately before each execution, then read back the executed changes
and the unchanged whitelist/settings/controller. The whitelist is maintained
separately by its existing owner. No new on-chain guard is added by these
nineteen actions. Re-read actual state after each proposal; do not infer the
other proposal executed from a successful preparation result.

The public runtime test fixture is bound to its recorded Rootstock block/hash,
deduplicates exact bytecode by hash and reuses existing tracked runtime records.
It tests builder/preflight behavior offline; it is not a fork governance
rehearsal or an independent review of every pinned implementation.

Run the keyless owning tests with a clean environment and supported Node/Forge
on `PATH`:

```sh
env -i HOME="$HOME" PATH="$PATH" node node_modules/hardhat/internal/cli/cli.js \
  --config scripts/zero-emergency-halt/hardhat.config.js test \
  tests/zero-emergency-halt/*.test.js
```

This isolated configuration exposes only the in-process Hardhat chain 31337,
loads no dotenv file and rejects inherited signing inputs. Its artifacts/cache
stay under `tmp/sip0097`; no production deployment records are written.
