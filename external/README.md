# External contract records

`deployments/<network>` is the active address/interface registry consumed by
Hardhat. It contains several kinds of records; an address alone does not prove
that every artifact or receipt belongs to that address.

- Implementation records with creation receipts bind that implementation's ABI,
  compiler input and bytecode. Constructor immutables must be hydrated before
  comparing their runtime template with installed code.
- Canonical Zero composite records use the stable proxy address with the active
  implementation's ABI and creation data. Their receipt is not proxy creation.
- Records marked `linkedData.recordKind: observed-*` bind an interface or complete
  runtime to a stated chain block. Unverified creation data is omitted. A proxy
  record describes proxy runtime, not its delegated implementation.
- Records marked `interface-alias` provide an address and a caller interface.
  They deliberately make no creation or compiler-provenance claim and do not
  assert that every listed selector is implemented. In particular,
  the BPro, DoC, MoC, POWA and USDT aliases do not claim to be DLLR deployments.

`solcInputs` retains exact imported compiler-input bytes and their original
filenames. Metadata source hashes bind the input contents; an inherited filename
is not by itself a content-hash guarantee.

Historical imports replaced during the Perimeter refresh are preserved under
`baselines/perimeter-delay-rskMainnet`, with SHA256 bindings. They are pre-refresh
snapshots, not automatically valid rollback targets. SIP-0074 and SIP-0094 reject
active Phase 2 aliases so historical replays must supply their own pinned records.
The SIP-0096 builders and existing historical fork address fixtures are unchanged.

Offline record and proposal checks:

```sh
node --test tests/perimeter/ExternalDeploymentRegistry.test.js
```

These checks validate record consistency. Before a new operation, separately
read the intended network's current implementation pointers, complete runtimes
and policy state; recorded observations do not update themselves.
