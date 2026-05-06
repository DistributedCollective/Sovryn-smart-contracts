# How to Deposit into Sovryn Lending Pools and Verify the Transaction

This document is intended for external integrators who need to deposit
underlying assets into a Sovryn lending pool (an "iToken" pool such as **iDOC**
or **iBPRO**) and then **confirm on-chain that the deposit succeeded** by
inspecting a transaction hash.

The reference UI for this flow is the Sovryn dApp at
<https://sovryn.app/earn/lend>. The patterns shown below are taken from the
production frontend in the `sovryn-dapp` repository.

> There is **no dedicated Sovryn SDK package for lending pools** at this time.
> The dApp interacts with the lending pools directly through `ethers.js`
> using the published ABIs. The same approach is recommended for integrators.

---

## 1. Network

| Item | Value |
|------|-------|
| Network | Rootstock (RSK) Mainnet |
| Chain ID | `30` |
| Public RPC | `https://public-node.rsk.co` (any RSK-compatible RPC works) |
| Block explorer | <https://explorer.rsk.co> |

---

## 2. Lending Pool Addresses

The authoritative source of all deployed contract addresses lives in this
repository under:

```
deployment/deployments/rskSovrynMainnet/
```

Each iToken pool is exported in its own `LoanToken_<symbol>.json` file. Read
the `address` field — that is the proxy address you interact with. The
`abi` field in the same file is the ABI you should use.

```bash
# Example — read the iDOC pool address
jq -r '.address' deployment/deployments/rskSovrynMainnet/LoanToken_iDOC.json
```

For convenience, the current Mainnet addresses are listed below. **Always
re-check against the JSON files in `deployment/deployments/rskSovrynMainnet/`
before using them in production.**

| Pool symbol | iToken (pool) address | Underlying asset | Underlying asset address |
|-------------|-----------------------|------------------|--------------------------|
| **iDOC**    | `0xd8D25f03EBbA94E15Df2eD4d6D38276B595593c1` | DOC  | `0xe700691DA7b9851F2F35f8b8182c69c53CCad9DB` |
| **iBPRO**   | `0x6E2fb26a60dA535732F8149b25018C9c0823a715` | BPRO | `0x440cd83C160De5C96Ddb20246815eA44C7aBBCa8` |
| iRBTC       | `0xa9DcDC63eaBb8a2b6f39D7fF9429d88340044a7A` | (W)RBTC native | n/a (uses `mintWithBTC`) |
| iUSDT       | `0x849C47f9C259E9D62F289BF1b2729039698D8387` | RUSDT | `0xEf213441a85DF4d7acBdAe0Cf78004E1e486BB96` |
| iXUSD       | `0x8F77ecf69711a4b346f23109c40416BE3dC7f129` | XUSD  | `0xb5999795BE0EbB5bAb23144AA5FD6A02D080299F` |
| iDLLR       | `0x077FCB01cAb070a30bC14b44559C96F529eE017F` | DLLR  | `0xc1411567d2670e24d9C4DaAa7CdA95686e1250AA` |

> The dApp's mapping between symbol and pool address is in
> [`packages/contracts/src/contracts/loan-tokens/rsk.ts`](https://github.com/DistributedCollective/sovryn-dapp)
> in the `sovryn-dapp` repo. The underlying token list is in
> `packages/contracts/src/contracts/assets/rsk.ts`.

The on-chain underlying for any pool can also be read directly from the
contract:

```javascript
await iTokenContract.loanTokenAddress();
```

---

## 3. Required ABIs

You only need two ABIs to perform a deposit:

1. **Lending pool (iToken) ABI** — from
   [`deployment/deployments/rskSovrynMainnet/LoanToken_iDOC.json`](../../deployment/deployments/rskSovrynMainnet/LoanToken_iDOC.json)
   (any `LoanToken_*` works; they all share the same logic via the beacon).
   The dApp's copy is at
   `sovryn-dapp/packages/contracts/src/abis/loanTokenLogicStandard.json`.
2. **ERC-20 ABI** for the underlying token — only the `approve` and
   `allowance` functions are needed.

---

## 4. Deposit Flow (ERC-20 underlying — iDOC, iBPRO, etc.)

A deposit is a **two-step** operation:

1. `approve` the iToken pool to pull `depositAmount` of the underlying.
2. Call `mint(receiver, depositAmount, useLM)` on the iToken pool.

This is the same flow used by the Sovryn dApp. See
[`apps/frontend/src/app/5_pages/LendPage/hooks/useHandleLending.ts`](https://github.com/DistributedCollective/sovryn-dapp)
in the `sovryn-dapp` repo, lines around `handleDeposit`:

```ts
// sovryn-dapp — useHandleLending.ts (excerpt)
if (!tokenDetails.isNative) {
  const approve = await prepareApproveTransaction({
    token: tokenDetails.symbol,
    amount: amount.toBigNumber().toString(),
    signer,
    spender: poolTokenContract.address,
  });
  if (approve) transactions.push(approve);
}

transactions.push({
  // ...
  request: {
    type: TransactionType.signTransaction,
    contract: poolTokenContract.connect(signer),
    fnName: native
      ? 'mintWithBTC(address,bool)'
      : 'mint(address,uint256,bool)',
    args: native
      ? [account, poolUsesLM]
      : [account, amount.toBigNumber().toString(), poolUsesLM],
    value: native ? amount.toBigNumber().toString() : undefined,
    gasLimit: GAS_LIMIT.LENDING_MINT,
  },
});
```

### Function signatures

The lending pool exposes two overloads of `mint` (and a BTC variant for the
iRBTC pool):

```solidity
// Standard ERC-20 deposit
function mint(address receiver, uint256 depositAmount)
    external returns (uint256 mintAmount);

// Deposit + optional auto-stake into Liquidity Mining
function mint(address receiver, uint256 depositAmount, bool useLM)
    external returns (uint256 minted);

// iRBTC pool only — deposit native RBTC
function mintWithBTC(address receiver, bool useLM)
    external payable returns (uint256 minted);
```

Parameters:

- `receiver` — the address that will receive the iTokens (typically the
  depositor itself).
- `depositAmount` — the amount of the **underlying** asset, in its native
  decimals (DOC and BPRO are both 18-decimal tokens).
- `useLM` — when `true`, the iTokens minted to `receiver` are immediately
  transferred to the Sovryn **Liquidity Mining** contract on the receiver's
  behalf, which makes the depositor eligible for **SOV rewards** distributed
  to lending-pool LPs. Pass `false` if you simply want the iTokens in the
  depositor's wallet (no SOV emissions). See [HOW-TO-LM.md](HOW-TO-LM.md)
  for the full Liquidity Mining flow (rewards, claiming, exiting). The
  `Mint` event used for deposit verification (section 5) is **unaffected**
  by this flag — `minter == receiver` regardless.

### Self-contained ethers.js example

```javascript
const { ethers } = require("ethers");

const RSK_RPC = "https://public-node.rsk.co";
const provider = new ethers.providers.JsonRpcProvider(RSK_RPC);
const signer  = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Pool + underlying — read from deployment/deployments/rskSovrynMainnet/
const I_DOC      = "0xd8D25f03EBbA94E15Df2eD4d6D38276B595593c1";
const DOC_TOKEN  = "0xe700691DA7b9851F2F35f8b8182c69c53CCad9DB";

const iTokenAbi = [
  "function mint(address receiver, uint256 depositAmount, bool useLM) returns (uint256)",
  "function loanTokenAddress() view returns (address)",
  "function tokenPrice() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "event Mint(address indexed minter, uint256 tokenAmount, uint256 assetAmount, uint256 price)"
];
const erc20Abi = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const pool      = new ethers.Contract(I_DOC,     iTokenAbi, signer);
const underlying = new ethers.Contract(DOC_TOKEN, erc20Abi,  signer);

const depositAmount = ethers.utils.parseUnits("100", 18); // 100 DOC

// 1. Approve the pool
const approveTx = await underlying.approve(I_DOC, depositAmount);
await approveTx.wait();

// 2. Deposit
const mintTx = await pool.mint(
  await signer.getAddress(), // receiver
  depositAmount,             // amount of DOC
  false                      // useLM
);
const receipt = await mintTx.wait();
console.log("Deposit tx:", receipt.transactionHash);
```

---

## 5. Confirming a Deposit by Transaction Hash

Given only a transaction hash, an integrator can deterministically prove
on-chain that a deposit succeeded by:

1. Fetching the transaction receipt and checking it was mined and
   succeeded (`status === 1`).
2. Confirming the `to` field is one of the known iToken pool addresses
   (e.g. iDOC or iBPRO).
3. Parsing the `Mint` event from the receipt logs and reading the
   depositor address and the deposited amounts.

### The `Mint` event

The lending pool emits the following event on every successful deposit
([`AdvancedTokenStorage.sol`](../../contracts/connectors/loantoken/AdvancedTokenStorage.sol)):

```solidity
event Mint(
    address indexed minter,
    uint256 tokenAmount,   // iTokens credited to `minter`
    uint256 assetAmount,   // underlying asset taken from the depositor
    uint256 price          // iToken price at the time of mint, 1e18-scaled
);
```

- `topic0` (event signature hash):
  `0xb4c03061fb5b7fed76389d5af8f2e0ddb09f8c70d1333abbb62582835e10accb`
- `minter` is the **`receiver` address passed to `mint(...)`** — i.e. the
  account that ends up holding the iTokens. When a user deposits for
  themselves (the typical dApp flow), `minter == msg.sender`.
- The relationship between the two amounts is:
  `assetAmount ≈ tokenAmount * price / 1e18`.
- When `useLM = true`, the iTokens are minted to `minter` first and then
  transferred to the Liquidity Mining contract in the same transaction;
  the `Mint` event still records the original receiver, so verification
  works the same way.

### Verification snippet (ethers.js)

```javascript
const { ethers } = require("ethers");

const provider = new ethers.providers.JsonRpcProvider("https://public-node.rsk.co");

// Whitelist of pools you accept deposits into
const KNOWN_POOLS = {
  "0xd8d25f03ebba94e15df2ed4d6d38276b595593c1": "iDOC",
  "0x6e2fb26a60da535732f8149b25018c9c0823a715": "iBPRO",
  // add others as needed — see deployment/deployments/rskSovrynMainnet/
};

const iface = new ethers.utils.Interface([
  "event Mint(address indexed minter, uint256 tokenAmount, uint256 assetAmount, uint256 price)"
]);

async function verifyLendingDeposit({
  txHash,
  expectedDepositor, // address that should have made the deposit
  expectedPool,      // optional: e.g. iDOC address
  expectedAmount,    // optional: BigNumber, exact underlying amount
  minConfirmations = 12,
}) {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt)               return { ok: false, reason: "tx not found" };
  if (receipt.status !== 1)   return { ok: false, reason: "tx reverted" };

  const head = await provider.getBlockNumber();
  if (head - receipt.blockNumber < minConfirmations) {
    return { ok: false, reason: "not enough confirmations" };
  }

  const poolAddr = receipt.to.toLowerCase();
  if (!KNOWN_POOLS[poolAddr]) {
    return { ok: false, reason: `tx target ${poolAddr} is not a known lending pool` };
  }
  if (expectedPool && poolAddr !== expectedPool.toLowerCase()) {
    return { ok: false, reason: "tx targets a different pool than expected" };
  }

  // Pull the Mint event emitted by the pool itself (ignore unrelated logs)
  const mintLog = receipt.logs
    .filter(l => l.address.toLowerCase() === poolAddr)
    .map(l => { try { return iface.parseLog(l); } catch { return null; } })
    .find(parsed => parsed && parsed.name === "Mint");

  if (!mintLog) return { ok: false, reason: "no Mint event in tx" };

  const { minter, tokenAmount, assetAmount, price } = mintLog.args;

  if (minter.toLowerCase() !== expectedDepositor.toLowerCase()) {
    return { ok: false, reason: `Mint receiver ${minter} != expected ${expectedDepositor}` };
  }
  if (expectedAmount && !assetAmount.eq(expectedAmount)) {
    return { ok: false, reason: `assetAmount ${assetAmount} != expected ${expectedAmount}` };
  }

  return {
    ok: true,
    pool:        KNOWN_POOLS[poolAddr],
    poolAddress: poolAddr,
    depositor:   minter,
    iTokensMinted: tokenAmount.toString(),
    underlyingDeposited: assetAmount.toString(),
    pricePerIToken: price.toString(),
    blockNumber: receipt.blockNumber,
  };
}
```

### What "successful deposit" requires

Treat a deposit as confirmed only when **all** of the following are true:

- [x] `eth_getTransactionReceipt(txHash)` returns a receipt.
- [x] `receipt.status == 1`.
- [x] The transaction is buried under a sufficient number of confirmations
      for your risk model (RSK averages ~30 s blocks; 12 confirmations is a
      common conservative choice).
- [x] `receipt.to` matches the iToken pool address you expect (e.g. iDOC or
      iBPRO from the table above).
- [x] The receipt's logs contain at least one `Mint` event emitted **by the
      pool itself** (`log.address == pool address`).
- [x] The decoded `minter` field of that event equals the address that was
      supposed to make the deposit.
- [x] If you committed to a specific amount up front, the decoded
      `assetAmount` matches it exactly.

A reverted transaction will have `status == 0` and **no** `Mint` event —
never accept a deposit just because a tx hash exists.

### Verifying via `eth_getLogs` (no tx hash)

If you want to discover deposits for a given user without knowing the
transaction hash up front, query the `Mint` event directly:

```javascript
const filter = {
  address: I_DOC,
  topics: [
    ethers.utils.id("Mint(address,uint256,uint256,uint256)"),
    ethers.utils.hexZeroPad(userAddress, 32), // indexed minter
  ],
  fromBlock: someStartBlock,
  toBlock:   "latest",
};
const logs = await provider.getLogs(filter);
```

---

## 6. Useful Read-Only Calls

These views are handy when integrating, but they are **not** required for
verifying a deposit — the `Mint` event already tells you everything.

| Call | Returns |
|------|---------|
| `iToken.loanTokenAddress()` | The underlying asset address. |
| `iToken.tokenPrice()` | Current iToken price, 1e18-scaled. |
| `iToken.balanceOf(user)` | iToken balance directly held by `user`. |
| `iToken.assetBalanceOf(user)` | Underlying-asset value of `user`'s iToken balance (reflects accrued interest). |
| `LiquidityMiningProxy.getUserPoolTokenBalance(iToken, user)` | iTokens of `user` that are staked in Liquidity Mining (relevant if `useLM = true` was used at deposit time). |

The Liquidity Mining proxy address and its ABI are in
`deployment/deployments/rskSovrynMainnet/LiquidityMiningProxy.json` (the
dApp resolves it via `getProtocolContract('liquidityMiningProxy')`).

---

## 7. Summary

- Deposits into Sovryn lending pools are made by calling `mint` (or
  `mintWithBTC`) on the iToken pool contract, after `approve` of the
  underlying for ERC-20 pools.
- The pool addresses for **iDOC** and **iBPRO** (and all other Sovryn
  lending pools) are published in
  `deployment/deployments/rskSovrynMainnet/LoanToken_<symbol>.json`. Use
  those files as the source of truth.
- A deposit is **on-chain-confirmed** when the transaction receipt has
  `status == 1`, `to` is the expected pool, and the receipt contains a
  `Mint(address indexed minter, uint256 tokenAmount, uint256 assetAmount,
  uint256 price)` event whose `minter` matches the depositor.
