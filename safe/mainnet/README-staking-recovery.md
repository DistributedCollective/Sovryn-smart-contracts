# Staking recovery — runbook

End-to-end checklist for recovering the seized SOV and reopening staking.

Every step below has been rehearsed end to end against a fork of RSK mainnet,
driven through the real machinery rather than by impersonating the final actor:
the Exchequer multisig's submit/confirm flow, the Guardians Safe executing the
actual Transaction Builder JSON in this folder through MultiSendCallOnly, and
the proposal created, voted, queued and executed through GovernorAlpha and the
owner Timelock. The rehearsal lives in `tests/staking/StakingRecoveryRehearsal.test.js`.

Measured in that rehearsal, with the real friendly voters from the last vote:
137,971,014 for against 50,005,105, quorum 69,686,694 — passing at 73.4% of
votes cast. The whole four-action proposal executed in a single transaction
using 504,193 gas, returning 15,000,510.50 SOV to the Exchequer.

## Where things stand

Verified against mainnet at block 9258848.

| | State |
| --- | --- |
| Staking | **frozen and paused** — no stake, unstake, delegate or withdraw by anyone |
| Malicious proposal (GovernorOwner #56) | **Defeated** — voting closed at block 9256801 |
| Attacker main wallet `0xac3ecE58` | 4,960,441.06 SOV staked, 49.60M votes |
| Attacker secondary wallet `0x92972392` | 40,069.44 SOV staked, 0.40M votes |
| Voting power delegated in to either wallet | none — both self-delegate |

Proposal #56 failed on the 70% supermajority rule: 49.60M for against 37.97M
from friendly voters is 56.6% of votes cast. **No guardian cancel is needed.**

Two consequences follow, and they pull in opposite directions:

- Nothing is queued against the protocol right now. There is no countdown.
- A defeated proposal frees the proposer, so **the attacker can propose again at
  any time**, and still meets quorum on their own. Their stake has to go.

Defeating another attacker proposal needs about 21.3M friendly voting power
(over 30% of votes cast). That existed this time. It is not guaranteed to turn
out next time, and each attempt burns a day of voting.

## Wallets and roles

| Wallet | Address | Type | How it executes |
| --- | --- | --- | --- |
| Exchequer Multisig | `0x924f5ad34698Fd20c90Fe5D5A8A0abd3b42dc711` | legacy MultiSigWallet, 3 of 7 | `submitTransaction` + confirmations |
| Contracts Guardians Safe | `0xDd8e07A57560AdA0A2D84a96c457a5e6DDD488b7` | Gnosis Safe 1.3.0, 3 of 7 | Safe Transaction Builder |
| Owner Timelock | `0x967c84b731679E36A344002b8E3CE50620A7F69f` | Timelock, 2-day delay | only via GovernorOwner |
| GovernorOwner | `0x6496DF39D000478a7A7352C01E0E713835051CcD` | GovernorAlpha | proposals and voting |

The Exchequer Multisig is also the **governor guardian** — the address that can
cancel a proposal while it is pending or active. The Guardians Safe holds the
staking pauser and freezer powers. They are different wallets; do not mix them up.

The Exchequer does **not** support Transaction Builder JSON files. Only the
Guardians Safe files in this folder can be imported into the Safe app.

## The vote arithmetic

To pass SIP-0095 against the attacker voting no:

| | Votes |
| --- | --- |
| Attacker against (both wallets) | 50.00M |
| Needed for, to clear 70% of votes cast | > 116.68M |
| Friendly, from the last vote | 37.97M |
| Guardians' 10M SOV at maximum lock | 100.00M |
| **Total for** | **137.97M** — passes, with 21.3M to spare |

The treasury stake alone does not carry it, and the friendly 37.97M alone does
not either. Both are needed. If friendly turnout drops below about 16.7M the
proposal fails, so turnout still has to be organised.

### The freeze is what protects this vote

The blocking threshold is measured on votes CAST, not on total staked SOV, and
the margin is thinner than the totals suggest: against these numbers the
attacker would need only about **913,000 more SOV** — roughly 9.1M more voting
power at the maximum lock — to push the vote below the 70% bar and defeat the
recovery. That is a small sum relative to SOV liquidity across all chains.

They cannot do it, for one reason only: `stake()` and `extendStakingDuration()`
are both gated `whenNotPaused whenNotFrozen`, and staking is frozen and paused.
**No attacker can add a single unit of voting power until staking reopens.**

Treat this as a hard invariant, not a detail. It is the reason the freeze must
hold until execution, and the reason nobody should be talked into reopening
early to relieve honest stakers.

---

## Checklist

### 0. Before starting

- [ ] Staking still reads `frozen() == true` and `paused() == true`.
- [ ] The attacker has not created a new proposal — check GovernorOwner
      `proposalCount()` and `state()` of the newest proposal.
- [ ] Exchequer holds at least 10M SOV.
- [ ] The vote delegatee `0x428A80f48aB417E17A12Ec81A2671c4846BdB2be` holds RBTC
      for gas. It is an ordinary account and has to send the vote itself.

> If the attacker proposes again at any point, the Exchequer Multisig can cancel
> it as governor guardian while it is pending or active. That is a stopgap, not
> a fix — it needs 3 of 7 signatures each time.

### 1. Exchequer sends 10M SOV to the Guardians Safe

Via the repo task (signer must be an Exchequer owner):

```bash
npx hardhat multisig:send-tokens \
  '[{"token":"SOV","to":"0xDd8e07A57560AdA0A2D84a96c457a5e6DDD488b7","amount":"10000000000000000000000000"}]' \
  --network rskSovrynMainnet --signer <owner>
```

Or submit by hand on `0x924f5ad3…` — `submitTransaction(to, value, data)` with
`to` = SOV `0xEFc78fc7d48b64958315949279Ba181c2114ABBd`, `value` = 0, and

```
data: 0xa9059cbb000000000000000000000000dd8e07a57560ada0a2d84a96c457a5e6ddd488b7000000000000000000000000000000000000000000084595161401484a000000
```

Two further owners then call `confirmTransaction(<id>)`; the wallet executes on
the third confirmation.

- [ ] Guardians Safe SOV balance reads 10,000,000.

### 2. Guardians Safe stakes the 10M in one transaction

Import **`Stake 10M SOV Atomic (unfreeze-stake-refreeze).json`** into the
Transaction Builder for the Guardians Safe and collect 3 signatures.

The five steps run as a single transaction — unfreeze, unpause, approve, stake,
re-freeze — so staking is never open at a block boundary the attacker could
withdraw in. The stake is owned by the Guardians Safe, locked for the maximum
duration, delegated to `0x428A80f48aB417E17A12Ec81A2671c4846BdB2be`.

- [ ] Staking reads `frozen() == true` and `paused() == true` again.
- [ ] The delegatee holds 100,000,000 votes.
- [ ] `getStakes(0xDd8e07A5…)` returns **exactly one** position.

> Do not stake for the Guardians more than once. The proposal builder reads
> their single position from chain and refuses to build if it finds anything else.

### 3. Deploy the module

**One module only.** `StakingRecoveryModule` is the entire deployment; nothing
already on chain is replaced. The proposal reads its address from the
deployment record.

```bash
DEPLOY_STAKING_RECOVERY_MODULE=true \
  npx hardhat deploy --tags StakingRecoveryModule --network rskSovrynMainnet
npx hardhat etherscan-verify --api-key anything --network rskSovrynMainnet
```

The script deploys and verifies only — it never registers. Registration is
action 1 of the proposal. The module is deliberately absent from
`getStakingModulesNames()`, because that list also feeds the scripts that
register modules through the multisig, which would install the recovery
capability outside Bitocracy. Do not add it there.

- [ ] Deployed, recorded, and source verified.
- [ ] The script's constant check passed (it aborts on any mismatch).
- [ ] Both attacker wallets still hold their positions at `1884076095`.

### 4. Finalise the proposal text

`getArgsSipStakingRecovery` carries the number SIP-0095. The forum link and the
sha256 of the SIP document are still blank, and the repo refuses to create the
proposal on mainnet until they are filled in.

- [ ] Forum/SIPS link filled in.
- [ ] sha256 filled in.

### 5. Create the proposal

The proposer needs 1% of total voting power. It performs four actions in one
transaction:

1. `addModule(StakingRecoveryModule)`
2. `recoverAttackerStake()` — empties **both** attacker wallets
3. `recoverGuardiansStake(until)` — the date is read from chain at build time
4. `removeModule(StakingRecoveryModule)`

No existing module is replaced and no staking behaviour is changed. The proposal
does nothing beyond moving the three positions to the treasury.

Neither recovery applies the early-unstaking penalty: this is a salvage
operation, not a slashing. Each takes only the account's own staked balance —
voting power delegated to an account by other stakers belongs to them and is
left alone. Gas on current mainnet state is 0.26M for both attacker wallets and
0.18M for the Guardians, against a 10M block limit.

- [ ] Proposal created; note its id.

### 6. Vote

Voting opens one block after creation and runs 2880 blocks — about one day.

- [ ] Delegatee votes **for** with the Guardians' 100M.
- [ ] Friendly stakers mobilised; running total stays above 116.7M for.
- [ ] At close: `state(id)` reads `Succeeded`.

### 7. Queue and execute

- [ ] `queue(id)` called. Note the resulting `eta`.
- [ ] Wait the timelock delay — **2 days**.
- [ ] `execute(id)` called **within 14 days of the eta**.

> The execution window is the 14-day grace period after the eta. Miss it and the
> proposal expires permanently — recovering the SOV then needs a fresh proposal,
> another day of voting and another two days of timelock, with staking frozen
> throughout. Put the eta and its deadline in a calendar the moment you queue.

Waiting does not reduce what is recovered. The recovery moves the full staked
balance with no penalty and no time factor, the attacker's positions are pinned
to a fixed date and frozen so they cannot move, and the Guardians' date is read
from chain when the proposal is built and cannot be extended while staking is
frozen. Only the grace period is a real deadline.

### 8. Verify the recovery

- [ ] Exchequer SOV balance rose by 5,000,510.50 SOV from the two attacker
      wallets, plus the 10M returned from the Guardians.
- [ ] `getCurrentVotes()` reads 0 for both attacker wallets and for the
      delegatee. It reads the previous block, so check one block later.
- [ ] `getStakes()` is empty for both attacker wallets and the Guardians Safe.
- [ ] The recovery module is gone: `getFuncImplementation(recoverAttackerStake)`
      returns the zero address.
- [ ] Unrelated stakers' positions and delegations are unchanged.

### 9. Reopen staking

Unfreezing deliberately leaves the contract paused, so this is two steps from
the Guardians Safe:

- [ ] `freezeUnfreeze(false)`
- [ ] `pauseUnpause(false)`
- [ ] An ordinary staker can stake and withdraw again.

### 10. Return the SOV to users

Out of scope for this runbook — the recovered SOV sits with the Exchequer
Multisig pending a distribution decision.

---

## If something goes wrong

| Situation | Response |
| --- | --- |
| Attacker creates a new proposal | Exchequer Multisig cancels it as governor guardian while pending or active |
| Proposal defeated | The Guardians' 10M stays staked and locked; it can only be released by a later proposal carrying the same recovery module |
| Recovery reverts with "nothing staked to recover" | The position was already emptied — investigate before retrying |
| Pressure to reopen staking before execution | Refuse — see below. If it is ever lifted anyway, the fixed attacker lock date no longer holds: re-check both wallets across the whole grid with `getStakes()` before executing |

## Staking stays frozen until the proposal executes

This is not negotiable, and it is the single assumption the whole recovery rests
on. Unfreezing lets the attacker unstake before the proposal can take their SOV.

They would pay the 30% early-unstaking penalty and keep the rest:

| | SOV |
| --- | --- |
| Attacker keeps | about 3,500,357 |
| To fee sharing as penalty | about 1,500,153 |
| Recovered to the Exchequer instead, if the freeze holds | 5,000,510 |

The penalty goes to fee sharing, not to the treasury, so reopening early does
not partially recover the funds — it loses about 3.5M SOV permanently.

The cost of holding the freeze is that honest stakers cannot unstake either,
for roughly five days from proposal creation: one day of voting, two days of
timelock, plus the time to organise. There is no way to spare them today —
blocking only unstaking would need a contract change that this proposal
deliberately does not make.

So the sequence is: hold the freeze, execute, then reopen.

## Known gap: there is still no narrow brake

Today the only tools are `pauseUnpause`, which does **not** stop withdrawals,
and `freezeUnfreeze`, which stops everything. There is no way to close the exits
while leaving staking and delegation open, which is why honest stakers are
locked out alongside the attacker.

A unified pause model — one call with per-capability options for staking,
unstaking and delegation, with freeze as an aggregator — is in the backlog as a
follow-up proposal. It was deliberately kept out of this one: the recovery is
time-critical and every extra line of changed code is audit surface on the path
that actually stops the attacker.
