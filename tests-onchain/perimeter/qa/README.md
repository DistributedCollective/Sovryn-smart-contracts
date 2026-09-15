# Perimeter QA fork

A local fork of RSK mainnet, reporting chain id 30, brought to the state the
withdrawal-delay release leaves behind — so the dapp and the admin panel can be
driven against it by hand with MetaMask.

## Boot the node

```
PERIMETER_QA_PORT=8547 scripts/perimeter/qa-node.sh --detach
```

Logs go to `qa/node.<port>.log`, the pid to `qa/node.<port>.pid` — one pair per
port, so two nodes never overwrite each other's record. `--status` reports the
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
hold and the charge, adds the test key to the operator multisig, drops the
signature threshold to 1, and funds the test accounts. It never moves the chain
clock — the dapps count a hold down against wall-clock time.

Options:

| flag | meaning |
| --- | --- |
| `--delay <seconds>` | hold length to arm; omitted, a controller that already carries a hold keeps it, and one that carries none gets 120 |
| `--fee on\|off` | `on` (default) also closes the charge switch; `off` arms the hold alone |
| `--keep-threshold` | leave the multisig threshold alone instead of dropping it to 1 |
| `--governance impersonate\|real` | `real` walks the proposals through actual governance instead, which jumps the chain clock days ahead and makes every countdown in the dapps meaningless |

Run it again at any time. A node that already carries the release is attached
to, not rebuilt: the addresses are re-read, the perimeter is re-armed if it was
found disarmed, the state file is rewritten, and the command reports `attached`.

Arming only ever moves a switch one way, which is what makes re-running safe.
So `--fee off` means "do not turn the charge on" — it will **not** turn off a
charge that is already enabled. To take an armed fork back to holds without a
charge, call `setExitFeeEnabled(false)` on the controller yourself, or start a
fresh node.

## The state file

`qa/perimeter-qa.json` (git-ignored) is the address book everything else reads:
the RPC and fork block; the queue, controller, multisig, protocol and Zero
addresses and the iRBTC/iXUSD pools; `feeReceiver`, where the perimeter's charge
lands, beside `feesController`, the protocol's own fee stream that this release
leaves alone; the armed `delaySeconds` and `feeEnabled`; and, per proposal,
`how` it was settled beside the `stateAtFork` the governor reported when this
bootstrap found it — `Pending`, `Active`, `Queued`, `Executed` and so on, so a
fork carrying a release the voters had not finished says so after the fact.

> **The state file contains a private key in clear.** It is hardhat's published
> mnemonic account 0 — `0xf39Fd…2266` — together with accounts 1-3 as the
> suspect accounts. These are public test keys with no secrecy whatsoever. Import
> account 0 into MetaMask to drive the QA fork; never send anything of value to
> any of them on a real network.

Each of the four accounts is funded with 100 RBTC and 50,000 XUSD.

Accounts this impersonates — the timelocks, the multisig, the Exchequer — are
topped up to a modest gas floor and only when they are short of it, never down
to it. A live account that already holds more keeps what it holds, so the
console shows a plausible Exchequer balance rather than a figure this bootstrap
invented.

## Drive the queue

Every command below is `npx hardhat perimeter:qa <command> --network rskForkedMainnetQa`
with `__decryptionAlreadyDone__=TRUE` in front, and each one refuses to run on
anything but a QA fork. Each prints what it did as a table and appends the same
record to `qa/state.json`.

Only `advance` moves the chain clock. Everything else leaves it alone, because a
wallet counts a hold down against its own clock and a jump makes every countdown
the dapps draw wrong for the rest of the session.

| command | what it does | example |
| --- | --- | --- |
| `status` | the whole queue: paused, kill switch, hold, charge, every request with its parties, unlock and block states, and the multisig transactions still pending | `perimeter:qa status` |
| `withdraw` | takes a withdrawal on one surface — `lender`, `borrower`, `zero` or `surplus` | `perimeter:qa withdraw --surface lender --as suspect1 --receiver 0x…` |
| | `--amount` is in RBTC and means something different per surface: on `lender` how much to lend and then withdraw, on `borrower` and `zero` how much collateral to take back out. `surplus` ignores it — the surplus is whatever the redemption left | `perimeter:qa withdraw --surface zero --amount 0.002` |
| `advance` | jumps the chain clock by n seconds and warns that every wallet countdown is now wrong | `perimeter:qa advance 121` |
| `execute` | releases one request as its originator and proves the receiver was paid to the wei | `perimeter:qa execute 3` |
| `execute-all` | releases every request one actor may release | `perimeter:qa execute-all --as test` |
| `freeze` | freezes the parties of one or more requests, through the multisig | `perimeter:qa freeze 3 4` |
| `blacklist` | the same, escalated to a blacklist | `perimeter:qa blacklist 3 --also-receiver` |
| `release` | puts a frozen or blacklisted address back to None | `perimeter:qa release 0x709… --blacklisted` |
| `pause` / `unpause` | stops and restarts every payout; ingress and blocking keep working while paused | `perimeter:qa pause` |
| `kill` | the controller's switch: `off` makes new withdrawals pass straight through, `on` re-arms the hold. Requests already queued keep their own unlock either way | `perimeter:qa kill off` |
| `route` | registers a recovery route for a surface — `topup` back into the pool the exit came from, or `address` to a named destination | `perimeter:qa route lender topup` |
| `refund` | sends escrow away from its receiver, with a different reach per leg. `--to pool` walks the registered route and needs the originator or the owner **blacklisted** — a freeze does not do it, and a blacklisted receiver does not either. `--to <address>` is the owner's catch-all and takes any request whose originator, owner or receiver is frozen or blacklisted, or that sits in a paused queue, or that is still inside its hold; only an unlocked request with nobody blocked and the queue unpaused is out of its reach | `perimeter:qa refund 6 --to pool` |
| `confirm` | adds confirmations from the wallet's real owners to a pending multisig transaction (only needed after `up --keep-threshold`) | `perimeter:qa confirm 2231` |
| `snapshot` / `revert` | takes a chain snapshot and rewinds to it | `perimeter:qa snapshot` then `perimeter:qa revert 0x1f` |

`--via-console` prints the call's selector, arguments, calldata and the multisig
`submitTransaction` calldata instead of sending anything — so the operator
console's own path can be driven by hand with the same bytes. It works on every
lever that goes through the multisig: `freeze`, `blacklist`, `release`, `pause`,
`unpause`, `kill`, `route` and `refund`. `route` is two levers, so it prints both
and reports that nothing was sent rather than a verdict.

`status` lists the multisig transactions still pending. At threshold 1 — what
`up` leaves behind unless you pass `--keep-threshold` — every lever executes on
submission, so anything in that row is the live wallet's own backlog carried in
from mainnet, not work this session left half done. The row says so.

Three things the surfaces themselves impose, rather than this tooling:

- **The surplus claim needs an account with no open trove.** An account may hold
  only one, and `withdraw --surface zero` opens one, so take the surplus claim
  first or run it as a different account.
- **Only the lending lender surface has a pool to top up.** The other three
  escrow native RBTC and carry no sub-product, so `route <surface> topup` is
  refused on them; recover those along `route <surface> address <address>`.
- **The borrower surface needs a collateral price.** The RBTC/USD oracle the
  protocol reads expires within about a minute of the block the fork was taken
  at, so the first borrower withdrawal pins the last price the fork saw onto the
  live RBTC feed, through that feed's own owner. Nothing else about the feed
  registry is touched.

## Check it

```
__decryptionAlreadyDone__=TRUE npx hardhat test \
  tests-onchain/perimeter/qa/bootstrap.test.js --network rskForkedMainnetQa
__decryptionAlreadyDone__=TRUE npx hardhat test \
  tests-onchain/perimeter/qa/engine.test.js --network rskForkedMainnetQa
```

The engine test writes to the fork and puts nothing back — the states it leaves
behind are what the dapps are then driven against. Run it once per `up`; to run
it again, restart the node and bootstrap it afresh.

## Stop the node

```
PERIMETER_QA_PORT=8547 scripts/perimeter/qa-node.sh --stop
```
