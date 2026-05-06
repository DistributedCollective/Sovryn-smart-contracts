# How to Participate in Sovryn Liquidity Mining (SOV Rewards for Lending LPs)

This document is for external integrators that want to let their users
**earn SOV rewards** as liquidity providers of Sovryn lending pools (iDOC,
iBPRO, iRBTC, etc.).

It is the companion to [HOW-TO-LP.md](HOW-TO-LP.md), which covers the
basic deposit flow (`approve` + `mint`) and on-chain verification of a
deposit. Read that first if you only need to confirm that a user has
deposited; come back here when you want to also incentivize them with
SOV.

---

## 1. What is Liquidity Mining?

Sovryn runs a **Liquidity Mining (LM)** program that distributes the
governance token **SOV** to liquidity providers of selected lending
pools. Conceptually it's a MasterChef-style reward distributor: users
stake their iTokens (the LP receipt of a lending pool) into the
`LiquidityMining` contract and earn SOV per block, pro-rated by their
share of that pool.

There are two ways to enter the program:

1. **Atomic deposit** — call the lending pool's
   `mint(receiver, depositAmount, true)` (or `mintWithBTC(receiver, true)`
   for native RBTC). The pool mints iTokens to `receiver`, then transfers
   them into the LM contract and registers the position, all in one
   transaction. This is the path used by the Sovryn dApp at
   <https://sovryn.app/earn/lend>.
2. **Stake existing iTokens** — if the user already holds iTokens in
   their wallet, they can `approve` the LM contract and call
   `LiquidityMining.deposit(poolToken, amount, user)` directly.

In both cases the **same underlying state** is reached: the LM contract
holds the iTokens on behalf of `user`, and SOV starts accruing.

---

## 2. Mainnet Contracts

Always treat the JSON files under
`deployment/deployments/rskSovrynMainnet/` as the source of truth. The
addresses below are a convenience snapshot.

| Component | Address | Source file |
|-----------|---------|-------------|
| `LiquidityMining` (proxy) | `0xf730af26e87D9F55E46A6C447ED2235C385E55e0` | [`LiquidityMining_Proxy.json`](../../deployment/deployments/rskSovrynMainnet/LiquidityMining_Proxy.json) |
| `LiquidityMining` ABI     | — | [`LiquidityMining.json`](../../deployment/deployments/rskSovrynMainnet/LiquidityMining.json) |
| `SOV` token               | `0xEFc78fc7d48b64958315949279Ba181c2114ABBd` | [`SOV.json`](../../deployment/deployments/rskSovrynMainnet/SOV.json) |
| `LockedSOV` vault         | `0xB4e4517cA4Edf591Dcafb702999F04f02E57D978` | [`LockedSOV.json`](../../deployment/deployments/rskSovrynMainnet/LockedSOV.json) |

Solidity sources:
[`contracts/farm/LiquidityMining.sol`](../../contracts/farm/LiquidityMining.sol),
[`contracts/farm/LiquidityMiningStorage.sol`](../../contracts/farm/LiquidityMiningStorage.sol),
[`contracts/farm/ILiquidityMining.sol`](../../contracts/farm/ILiquidityMining.sol).

---

## 3. How SOV Rewards Are Calculated

The contract uses the standard MasterChef accumulator pattern (see
[`LiquidityMiningStorage.sol`](../../contracts/farm/LiquidityMiningStorage.sol)):

- A global `rewardTokensPerBlock` (SOV) is split across all registered
  pools according to each pool's `allocationPoint`.
- For every pool the contract tracks `accumulatedRewardPerShare`,
  updated each time the pool is touched.
- A user's pending reward at any point is approximately:
  ```
  pending ≈ user.amount * pool.accumulatedRewardPerShare - user.rewardDebt
  ```
- A pool with `allocationPoint == 0` is **not currently incentivized** —
  staking into it via `useLM = true` is legal but earns no SOV. **Always
  check the live config before promising rewards** (snippet below).
- The reward window is bounded: SOV emissions are scheduled and stop
  once the configured end-block is reached.

### Inspecting a pool's incentives

```javascript
const { ethers } = require("ethers");

const provider = new ethers.providers.JsonRpcProvider("https://public-node.rsk.co");

const LM_PROXY = "0xf730af26e87D9F55E46A6C447ED2235C385E55e0";
const I_DOC    = "0xd8D25f03EBbA94E15Df2eD4d6D38276B595593c1";

const lmAbi = [
  "function rewardTokensPerBlock() view returns (uint256)",
  "function getPoolInfo(address poolToken) view returns (tuple(address poolToken, uint96 allocationPoint, uint256 lastRewardBlock, uint256 accumulatedRewardPerShare))",
  "function getPoolId(address poolToken) view returns (uint256)",
  "function getEstimatedReward(address poolToken, uint256 amount, uint256 blocks) view returns (uint256)",
];
const lm = new ethers.Contract(LM_PROXY, lmAbi, provider);

const info = await lm.getPoolInfo(I_DOC);
console.log("iDOC allocationPoint:", info.allocationPoint.toString());
// 0 → not currently incentivized

// Project SOV earned by `amount` iTokens over `blocks` blocks at current weights:
const projected = await lm.getEstimatedReward(I_DOC, amount, blocks);
```

---

## 4. Entering the Program

### 4a. Atomic deposit (`useLM = true`)

This is the most common path and the one used by the dApp's `LendPage`.
It performs the lending deposit and the LM stake in a single transaction.

```javascript
// `pool` is an iToken pool contract, e.g. iDOC
const tx = await pool.mint(
  receiver,        // address that will own the LM position
  depositAmount,   // amount of underlying (e.g. DOC) in 1e18 units
  true             // useLM
);
await tx.wait();
```

Internally this triggers, in order
([`LoanTokenLogicSplit.sol#_mintWithLM`](../../contracts/connectors/loantoken/LoanTokenLogicSplit.sol)):

1. iTokens are minted to `receiver`. The pool's
   `Mint(address indexed minter, uint256 tokenAmount, uint256 assetAmount, uint256 price)`
   event still fires with `minter == receiver`, so the deposit
   verification flow in
   [HOW-TO-LP.md §5](HOW-TO-LP.md#5-confirming-a-deposit-by-transaction-hash)
   is **unchanged**.
2. The minted iTokens are transferred from `receiver` to the LM contract.
3. The pool calls `LiquidityMining.onTokensDeposited(receiver, mintAmount)`,
   which credits the LM position and starts SOV accrual from that block.

After the tx, `iToken.balanceOf(receiver)` will **not** show the new
amount; it is held by the LM contract on the user's behalf.

### 4b. Staking iTokens you already hold

If the user already has iTokens in their wallet (e.g. from a previous
deposit with `useLM = false`), they can stake them directly:

```javascript
const lmAbi = [
  "function deposit(address poolToken, uint256 amount, address user) external",
];
const lm = new ethers.Contract(LM_PROXY, lmAbi, signer);

// 1. Approve LM to pull the iTokens
await (await iToken.approve(LM_PROXY, amount)).wait();

// 2. Stake — third arg lets a different account stake on `user`'s behalf;
//    pass user == msg.sender for the typical self-staking flow.
await (await lm.deposit(I_DOC, amount, await signer.getAddress())).wait();
```

> Note: when `user != msg.sender`, the iTokens are pulled from
> `msg.sender` but the LM position is credited to `user`. This is how
> the lending pool itself stakes on the user's behalf during
> `mint(..., true)`.

---

## 5. Reading a User's LM State

```javascript
const lmAbi = [
  "function getUserPoolTokenBalance(address poolToken, address user) view returns (uint256)",
  "function getUserInfo(address poolToken, address user) view returns (tuple(uint256 amount, uint256 rewardDebt, uint256 accumulatedReward))",
];
const lm = new ethers.Contract(LM_PROXY, lmAbi, provider);

const stakedITokens   = await lm.getUserPoolTokenBalance(I_DOC, user);
const userInfo        = await lm.getUserInfo(I_DOC, user);
// userInfo.amount             — staked iTokens (== stakedITokens above)
// userInfo.accumulatedReward  — claimable SOV (immediately-unlocked portion)
// userInfo.rewardDebt         — internal accumulator bookkeeping
```

The dApp's helper in
[`apps/frontend/src/app/5_pages/LendPage/utils/contract-calls.ts`](https://github.com/DistributedCollective/sovryn-dapp)
sums `iToken.balanceOf(user)` and `getUserPoolTokenBalance(iToken, user)`
to display the user's **total** lending position regardless of whether
they used LM.

---

## 6. Claiming SOV Rewards

Rewards accrue continuously and are **not** auto-paid. Either the user
or anyone calling on their behalf must invoke one of:

```solidity
function claimReward(address _poolToken, address _user) external;
function claimRewardFromAllPools(address _user) external;
```

Both:

1. Compute the accrued SOV up to the current block.
2. Transfer the **immediately-unlocked portion** of SOV directly to
   `_user` in liquid form.
3. Forward the remainder to the [`LockedSOV`](../../contracts/locked/)
   vault, attributed to `_user`, where it vests over time.

The split is governed by `unlockedImmediatelyPercent` on the LM
contract, with a per-pool override in
`poolTokensUnlockedImmediatelyPercent[poolToken]`. Read the live values
to know exactly how much is liquid vs. locked:

```javascript
const lmAbi = [
  "function unlockedImmediatelyPercent() view returns (uint256)",
  "function poolTokensUnlockedImmediatelyPercent(address) view returns (uint256)",
];
```

Locked SOV must subsequently be redeemed from the `LockedSOV` vault
according to its own vesting schedule (out of scope for this document).

---

## 7. Exiting the Program

`LiquidityMining.withdraw(poolToken, amount, user)` returns staked
iTokens to `user`. Note: this does **not** redeem the underlying asset
(DOC, BPRO, etc.) — it just gives the iTokens back. To exit fully and
get the underlying back, choose one of:

### 7a. Two-step exit

```javascript
// 1. Unstake iTokens from LM
await (await lm.withdraw(I_DOC, amount, user)).wait();

// 2. Burn iTokens for underlying
await (await pool.burn(user, amount, false)).wait();
```

### 7b. Atomic exit (preferred)

`burn(receiver, amount, true)` on the iToken pool atomically pulls
`amount` of iTokens out of the LM contract and redeems them to the
underlying. This is the path used by the dApp:

```ts
// sovryn-dapp — useHandleLending.ts (excerpt)
fnName: native
  ? 'burnToBTC(address,uint256,bool)'
  : 'burn(address,uint256,bool)',
args:  [account, withdrawAmount.toBigNumber().toString(), poolUsesLM],
```

Either path also pays out any pending SOV (the LM contract claims
internally as part of `withdraw`), but you can additionally call
`claimReward` / `claimRewardFromAllPools` at any time without
unstaking.

---

## 8. Checklist for Integrators

- [ ] Confirm the target pool is currently incentivized:
      `getPoolInfo(iToken).allocationPoint > 0` and `rewardTokensPerBlock > 0`.
- [ ] Decide between **atomic deposit** (`mint(..., true)`) and
      **separate staking** (`deposit(...)`) — atomic is simpler and is what
      the dApp uses.
- [ ] If staking separately, remember to `approve` the LM contract for
      the iToken before calling `deposit`.
- [ ] Make clear to end users that part of their SOV reward will be
      vested in the `LockedSOV` vault, not paid in liquid SOV at claim
      time.
- [ ] To display a user's full lending balance, sum
      `iToken.balanceOf(user)` and
      `LiquidityMining.getUserPoolTokenBalance(iToken, user)`.
- [ ] When exiting, prefer `pool.burn(receiver, amount, true)` over
      manual `withdraw` + `burn`.
- [ ] On-chain confirmation that "the user deposited X" is independent
      of the LM flag — see
      [HOW-TO-LP.md §5](HOW-TO-LP.md#5-confirming-a-deposit-by-transaction-hash).

---

## 9. Summary

- `useLM = true` at deposit time stakes the freshly minted iTokens in
  the `LiquidityMining` contract atomically, making the depositor
  eligible for **SOV rewards**.
- Rewards are MasterChef-style: per-block SOV emissions split across
  pools by `allocationPoint`. Pools with zero allocation earn nothing.
- Claimed SOV is split between immediate liquid payout and `LockedSOV`
  vault deposits according to the contract's configured percentage.
- To exit cleanly, call `burn(receiver, amount, true)` on the iToken
  pool — the LM unstake and the redemption happen in one transaction.
- The lending-deposit verification flow described in
  [HOW-TO-LP.md](HOW-TO-LP.md) is unaffected by `useLM`: the pool emits
  the same `Mint(minter, …)` event with `minter == receiver` either
  way.
