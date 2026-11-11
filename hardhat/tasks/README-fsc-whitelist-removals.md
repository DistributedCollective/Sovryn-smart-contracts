# Create AMM fee-converter removal proposals

Uses the existing Hardhat signer configuration and ethers v5. No Python, Foundry,
keystore arguments or contract compilation is needed. Registration is included
in `hardhat/tasks/index.js`.

Read-only preparation:

```sh
npx hardhat amm:remove-all-fee-converters --network rskMainnet
```

Create proposals using an existing configured Exchequer owner:

```sh
npx hardhat amm:remove-all-fee-converters --network rskMainnet --signer deployer --submit
```

`--signer` accepts the existing named account, address or configured account
index. The task verifies that it is a multisig owner and that the collector
owner/proxy owner, implementation and quorum match expectations. The default
collector and wallet are Rootstock mainnet addresses. A non-signing VoidSigner
supplies the sender for read-only contract calls, so dry-run mode does not
require the public RPC to expose `eth_accounts`.

All current whitelist entries get separate zero-value removal proposals. The
specified `--first` converter is prioritized if still listed. Proposals are
broadcast one at a time. Each submission must be mined successfully and its
stored proposal verified before the next is sent. The task reads the signer's
pending nonce before each submission; use the signing account exclusively
during the run. Each new proposal includes the sender's
first confirmation; the total requirement is 3. No separate confirmation or
execution call is made by the task.

Keep the SAME `--journal` file on rerun. Recorded broadcasts are confirmed before
new submissions, and the run resumes after its recorded operations. The task
does not scan the multisig for duplicate proposals. A fresh journal starts a new
run, even if matching proposals already exist in the wallet.
An ambiguous send leaves `inFlight` and stops a
retry for operator inspection. A hard crash can leave the `.lock` file: inspect
pending transactions and the running process before removing a stale lock.
A definitive `transaction nonce too high` rejection stops the run without leaving
an uncertain-send marker; let prior transactions mine before retrying.

The task verifies receipts and stored proposals and prints their IDs. Creating
proposals does not complete containment: other owners must reach quorum,
execute the removals and verify the whitelist is empty. Removal blocks public
AMM fee collection, not ordinary swaps, LP operations or registry mutations.
