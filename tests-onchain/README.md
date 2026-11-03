# Running onchain tests
The onchain tests are supposed to run on a forked chains - mainnet or testnet.  
1. `npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy --fork-block-number 4929553`
    --fork-block-number is optional - use to time travel back
2. run the test `npx hardhat test path/to/test.js --network X`
    network options: `rskForkedMainnet` or `rskForkedMainnetFlashback`
    use the former if all the hardhat deployments were deployed at the forked block number
    use the latter and put all the needed deployments to the `external/deployments/rskForkedMainnetFlashback` folder otherwise - you normally want to use this to exclude contracts that were not deployed by the time of the forked block
## SIP-0097 manual release campaign

`SIP0097.test.js` is an explicitly invoked release proof, outside the unit-only
CI suite. Start a new owned Anvil fork at the exact block/hash recorded in
`hardhat/tasks/sips/args/sip0097.manifest.json`, using loopback HTTP, chain 31337
and the actual deployed halt contracts. The suite refuses a stale or advanced
initial height and rechecks URL, client, chain and baseline hash before every
mutation. Do not reuse a shared node or load production credentials/dotenv.

The campaign takes the hash-verified public SIP bytes and a read-only production
preparation artifact through `SIP0097_DOCUMENT` and `SIP0097_PRODUCTION_INPUTS`.
The artifact contains `document.sha256Actual`, the raw `currentRootstockHeader`,
and `payloads` containing the three `{args, governor}` production builder results.
Obtain those results with the current chain-30 provider and the exported builders;
all current-state preflight checks must pass. The suite compares these inputs to
its guarded local builder output, then submits the exact production descriptions
and action arrays to the local GovernorOwner. The local description prefix is
excluded from all three actual production-payload rehearsals.

```sh
env -i HOME="$HOME" PATH="$PATH" \
  SIP0097_FORK_URL=http://127.0.0.1:18597 \
  SIP0097_DOCUMENT=/tmp/SIP-0097.md \
  SIP0097_PRODUCTION_INPUTS=/tmp/sip0097-production-inputs.json \
  SIP0097_RESULT=/tmp/sip0097-governance-result.json \
  node node_modules/mocha/bin/mocha --no-config --no-package --exit \
  tests-onchain/SIP0097.test.js
```

The proof uses existing governor voting power and native gas funding only. It
records complete receipt/calldata gas evidence for creation, voting, queueing
and execution. Local Anvil gas is not a Rootstock gas-meter guarantee; compare
separate read-only Rootstock estimates and the current mainnet block gas limit
before choosing operator limits. Mutating transactions are confined to the
owned local fork.

The bounded downstream matrix uses genuine EOA-held DOC, DLLR and ZUSD, plus an
ordinary DOC-to-XUSD mint. It tests XUSD transfer/approval/transferFrom,
Babelfish DOC/DLLR mint/redemption, DLLR transfer, Mynt DOC/ZUSD mint/redemption,
and ZUSD transfer before the halt, after each halt group and after restoration.
Every stage's controls restore their own snapshot. Expected rejected paths
require mined status-zero receipts, a trace reaching the actual deployed Zero
halt, and unchanged sampled supply, custody, balances and allowances. Existing
asset pauses and source accounting remain intact. This finite matrix does not
certify every asset, bridge, reward route or reopening condition.
