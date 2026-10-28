# Historical external aliases before the post-activation refresh

These files preserve the exact bytes imported by lending commit
`0e84fd08418f05cc4569dd530b834e6dedc816ea` before refreshing active mainnet aliases.
`SHA256.json` binds every saved record and artifact. They are historical data,
not the current implementation registry. Some entries were already current;
others refer to older implementations. Do not infer one common deployment epoch.

Current addresses and implementation ABIs live under
`external/deployments/rskMainnet`. Candidate-specific Perimeter records retain
implementation creation receipts. Generic Zero records follow their upstream
convention: the stable proxy address plus the active implementation's ABI,
bytecode and creation receipt. They are not proxy creation receipts. `_Proxy`
records describe the proxy contract itself. Their current runtime is an exact
block-pinned `eth_getCode` observation, not a claim that a recompiled template or
creation receipt has been independently reconstructed. Unproven creation
bytecode is omitted from the active proxy records.

Existing compiler inputs are retained, including exact upstream filenames.
The old Zero input referenced by these records is now also available in the
active registry's `solcInputs` directory. Historical replay address fixtures
remain unchanged. A rollback must use the reviewed live pre-upgrade target,
not whichever implementation happens to be current in the generic alias.


Five token aliases previously borrowed DLLR creation data despite naming different
addresses. Their current records intentionally retain only the interface/address
and a historical-template reference. StabilityPool and TroveManagerRedeemOps
also carried mismatched creation receipts; their active records now identify
observed runtime/interface data without inventing creation provenance. These
archived mismatches are not approved rollback targets or deployment attestations.
