# Perimeter QA fork

A local fork of RSK mainnet, reporting chain id 30, brought to the state the
withdrawal-delay release leaves behind — so the dapp and the admin panel can be
driven against it by hand with MetaMask.

## Boot the node

```
PERIMETER_QA_PORT=8547 scripts/perimeter/qa-node.sh --detach
```

Logs go to `qa/node.log`, the pid to `qa/node.pid`. `--status` reports the
current block, `--stop` kills only the pid it recorded. Default port is 8545;
pick another when that one is in use, and export the matching RPC so the
`rskForkedMainnetQa` network points at it:

```
export PERIMETER_QA_RPC=http://127.0.0.1:8547
```

## Bring it up

```
__decryptionAlreadyDone__=TRUE npx hardhat perimeter:qa up --network rskForkedMainnetQa
```

This installs the release the delay follows and the delay release itself by
replaying each proposal from the timelock that would have executed it, arms the
delay, adds the test key to the operator multisig, drops the signature threshold
to 1, and funds the test accounts. It never moves the chain clock — the dapps
count a hold down against wall-clock time.

Options:

| flag | meaning |
| --- | --- |
| `--delay <seconds>` | hold length to arm (default 120) |
| `--keep-threshold` | leave the multisig threshold alone instead of dropping it to 1 |
| `--governance impersonate\|real` | `real` walks the proposals through actual governance instead, which jumps the chain clock days ahead and makes every countdown in the dapps meaningless |

Run it again at any time. A node that already carries the release is attached
to, not rebuilt: the addresses are re-read and the state file rewritten, and the
command reports `attached`.

## The state file

`qa/perimeter-qa.json` (git-ignored) is the address book everything else reads:
the RPC and fork block, the queue, controller, collector, multisig, protocol and
Zero addresses, the iRBTC/iXUSD pools, the armed delay, and how each proposal
was settled.

> **The state file contains a private key in clear.** It is hardhat's published
> mnemonic account 0 — `0xf39Fd…2266` — together with accounts 1-3 as the
> suspect accounts. These are public test keys with no secrecy whatsoever. Import
> account 0 into MetaMask to drive the QA fork; never send anything of value to
> any of them on a real network.

Each of the four accounts is funded with 100 RBTC and 50,000 XUSD.

## Check it

```
__decryptionAlreadyDone__=TRUE npx hardhat test \
  tests-onchain/perimeter/qa/bootstrap.test.js --network rskForkedMainnetQa
```

## Stop the node

```
PERIMETER_QA_PORT=8547 scripts/perimeter/qa-node.sh --stop
```
