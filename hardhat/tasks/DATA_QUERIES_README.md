# Data Query Tasks

This document describes all available data query tasks for analyzing on-chain Sovryn protocol data. These tasks were converted from Python scripts in the `tyrone/` directory to Hardhat tasks for better integration with the development workflow.

## Table of Contents

1. [Borrowing & Lending](#borrowing--lending)
2. [Liquidity & Staking](#liquidity--staking)
3. [Fees & Revenue](#fees--revenue)
4. [Vesting](#vesting)
5. [Bridge & Arbitrage](#bridge--arbitrage)
6. [General Utilities](#general-utilities)

---

## Borrowing & Lending

### 1. `data:getBorrowData`

Get detailed information about borrowing positions on the Sovryn protocol.

**Source:** `tyrone/get_borrow_data.py`

**Usage:**
```bash
npx hardhat data:getBorrowData [--user <address>] [--loanId <id>] [--tx <hash>] [--blocks <number>] [--output <file>]
```

**Parameters:**
- `--user`: RSK address of the user to query
- `--loanId`: Specific loan ID to query
- `--tx`: Opening transaction hash to find loan
- `--blocks`: Number of blocks to scan back (default: 86400 ~= 1 month)
- `--output`: CSV file path to export results

**What it does:**
- Scans for `Borrow` events within the specified block range
- Retrieves current loan details (principal, collateral, interest rates, margin)
- Tracks liquidations, collateral deposits, and rollovers for each loan
- Displays token names for loan and collateral tokens
- Exports detailed loan information to CSV if requested

**Example:**
```bash
npx hardhat data:getBorrowData --user 0x1234... --blocks 100000 --output borrows.csv
```

---

### 2. `data:getMarginData`

Get margin trading position data.

**Source:** `tyrone/get_margin_data_new.py`

**Usage:**
```bash
npx hardhat data:getMarginData [--user <address>] [--loanId <id>] [--blocks <number>] [--output <file>]
```

**Parameters:**
- `--user`: RSK address of the user
- `--loanId`: Specific loan ID
- `--blocks`: Number of blocks to scan back (default: 86400)
- `--output`: CSV file path

**What it does:**
- Scans for `Trade` events (margin trades)
- Retrieves position details including principal, collateral, and current margin
- Shows margin trading activity for specified users or loans

---

### 3. `data:getSOVBorrows`

Get all borrows using SOV as collateral.

**Source:** `tyrone/SOV_borrow.py`

**Usage:**
```bash
npx hardhat data:getSOVBorrows [--fromBlock <number>] [--toBlock <number>] [--output <file>]
```

**Parameters:**
- `--fromBlock`: Start block (default: 3690000)
- `--toBlock`: End block (default: latest)
- `--output`: CSV file path

**What it does:**
- Filters `Borrow` events where SOV is used as collateral
- Calculates liquidation prices for each position
- Tracks total SOV used as collateral
- Shows active/inactive status of loans

---

### 4. `data:getSOVMargins`

Get all margin trades using SOV as collateral.

**Source:** `tyrone/SOV_margin.py`

**Usage:**
```bash
npx hardhat data:getSOVMargins [--fromBlock <number>] [--toBlock <number>] [--output <file>]
```

**Parameters:**
- `--fromBlock`: Start block (default: 3690000)
- `--toBlock`: End block (default: latest)
- `--output`: CSV file path

**What it does:**
- Filters `Trade` events where SOV is used as collateral
- Shows position size, borrowed amount, leverage, and entry price
- Calculates liquidation prices
- Tracks total position sizes

---

### 5. `data:getLoanTokenStats`

Get statistics for all loan tokens (iTokens).

**Usage:**
```bash
npx hardhat data:getLoanTokenStats [--block <number>] [--output <file>]
```

**Parameters:**
- `--block`: Reference block number (default: latest)
- `--output`: CSV file path

**What it does:**
- Queries all iTokens (iDOC, iUSDT, iWRBTC, iXUSD, iBPRO, iDLLR)
- Shows total supply, total borrowed, total supplied
- Displays supply and borrow interest rates
- Calculates utilization rates
- Shows token price

---

### 6. `data:getActiveLoans`

Get summary of all currently active loans.

**Usage:**
```bash
npx hardhat data:getActiveLoans [--output <file>]
```

**Parameters:**
- `--output`: CSV file path

**What it does:**
- Scans all historical `Borrow` events
- Checks active status for each loan
- Aggregates total active principal and collateral
- Lists all active loans with their details

---

## Liquidity & Staking

### 7. `data:getLPTokenBalances`

Get LP token balances and liquidity mining information.

**Source:** `tyrone/lp_tokens.py`

**Usage:**
```bash
npx hardhat data:getLPTokenBalances [--pool <address>] [--block <number>] [--output <file>]
```

**Parameters:**
- `--pool`: Pool address (default: WRBTC/SOV)
- `--block`: Reference block number (default: latest)
- `--output`: CSV file path

**What it does:**
- Scans all LP token `Transfer` events to find holders
- Retrieves tokens staked in liquidity mining
- Retrieves tokens in wallets
- Calculates each holder's share of pool reserves (SOV and WRBTC)
- Shows reward debt and accumulated rewards

---

### 8. `data:getStakerStats`

Get staker statistics for voluntary (non-vesting) stakers.

**Source:** `tyrone/stakers_sip24_stats.py`

**Usage:**
```bash
npx hardhat data:getStakerStats [--fromBlock <number>] [--toBlock <number>] [--output <file>]
```

**Parameters:**
- `--fromBlock`: Start block (default: 3100263 - staking genesis)
- `--toBlock`: End block (default: latest)
- `--output`: CSV file path

**What it does:**
- Scans `TokensStaked` events
- Filters out vesting contracts and smart contracts
- Counts only EOA (externally owned account) stakers
- Shows total staked amounts and current balances
- Tracks active vs inactive stakers

---

### 9. `data:getStakingRewards`

Get staking rewards (osSOV) for voluntary stakers.

**Source:** `tyrone/stakingRewardsOS.py`

**Usage:**
```bash
npx hardhat data:getStakingRewards [--block <number>] [--output <file>]
```

**Parameters:**
- `--block`: Reference block number (default: latest)
- `--output`: CSV file path

**What it does:**
- Identifies voluntary (non-vesting) stakers
- Calculates claimed osSOV (minted and withdrawn)
- Calculates unclaimed osSOV (accrued but not yet withdrawn)
- Shows total rewards per staker
- Aggregates total claimed and unclaimed osSOV

---

### 10. `data:getCheckpoints`

Get staking checkpoints and voting power distribution.

**Source:** `tyrone/checkpoints.py`

**Usage:**
```bash
npx hardhat data:getCheckpoints [--output <file>]
```

**Parameters:**
- `--output`: CSV file path

**What it does:**
- Calculates all staking unlock dates (every 2 weeks)
- Shows amount of SOV unlocking at each checkpoint
- Projects unlock schedule for maximum staking period (78 periods)
- Displays dates and amounts for all future unlocks

---

### 11. `data:getAMMPoolStats`

Get statistics for all AMM liquidity pools.

**Usage:**
```bash
npx hardhat data:getAMMPoolStats [--block <number>] [--output <file>]
```

**Parameters:**
- `--block`: Reference block number (default: latest)
- `--output`: CSV file path

**What it does:**
- Queries all AMM V1 converter pools (DOC, USDT, BPRO, SOV, ETH, MOC, BNB, XUSD, FISH, RIF, MYNT, DLLR)
- Shows reserve amounts for each token pair
- Displays token symbols and addresses
- Useful for analyzing pool liquidity depth

---

## Fees & Revenue

### 12. `data:getPendingFees`

Get pending fees across the protocol, AMM, and fee sharing collector.

**Source:** `tyrone/get_pending_fees.py`

**Usage:**
```bash
npx hardhat data:getPendingFees [--block <number>] [--output <file>]
```

**Parameters:**
- `--block`: Reference block number (default: latest)
- `--output`: CSV file path

**What it does:**
- **AMM Fees:** Queries protocol fees held in V1 converters
- **Protocol Fees:** Queries trading, borrowing, and lending fees
- **Unprocessed Amounts:** Checks unprocessed fees in FeeSharingCollector
- Converts all fees to WRBTC equivalent for comparison
- Shows breakdown by source (AMM, Protocol, Unprocessed)
- Calculates grand totals for WRBTC, SOV, and ZUSD

---

### 13. `data:getFeeCollectorRevenue`

Get fee collector revenue distribution for stakers.

**Source:** `tyrone/feeCollector_stakers_all.py`

**Usage:**
```bash
npx hardhat data:getFeeCollectorRevenue [--block <number>] [--weeks <number>] [--staker <address>] [--output <file>]
```

**Parameters:**
- `--block`: Reference block number (default: latest)
- `--weeks`: Number of past weeks to scan (default: 1)
- `--staker`: Specific staker address to query
- `--output`: CSV file path

**What it does:**
- Scans fee collector checkpoints for the specified time period
- Shows fees distributed in each checkpoint (iWRBTC, SOV, ZUSD, WRBTC, RBTC_DUMMY, MYNT)
- Displays total weighted stake at each checkpoint
- Useful for calculating staker revenue

---

## Vesting

### 14. `data:getAllVestings`

Get all vesting contracts and their details.

**Source:** `tyrone/all_vestings_all.py`

**Usage:**
```bash
npx hardhat data:getAllVestings [--block <number>] [--output <file>]
```

**Parameters:**
- `--block`: Reference block number (default: latest)
- `--output`: CSV file path

**What it does:**
- Finds all 4-year vesting contracts from factory
- Finds all token owners from staking events
- Retrieves vesting details for each owner:
  - Vesting type and creation type
  - Cliff and duration (in seconds and months)
  - Team vesting status
- Lists all vesting contracts with their parameters

---

### 15. `data:getVestingBlockLimits`

Analyze vesting contracts for potential block limit issues.

**Source:** `tyrone/SOV-2932_general_full.py`

**Usage:**
```bash
npx hardhat data:getVestingBlockLimits [--block <number>] [--output <file>]
```

**Parameters:**
- `--block`: Reference block number (default: latest)
- `--output`: CSV file path

**What it does:**
- Identifies vesting contracts with >32 lock dates
- Calculates unlocked periods and amounts
- Checks LockedSOV balances (locked and unlocked)
- Flags potential issues with vesting contract operations
- Useful for identifying contracts that may hit block gas limits

---

## Bridge & Arbitrage

### 16. `data:getBridgeEvents`

Get bridge Cross events (token bridging activity).

**Source:** `tyrone/bridge_events.py`

**Usage:**
```bash
npx hardhat data:getBridgeEvents [--fromBlock <number>] [--toBlock <number>] [--output <file>]
```

**Parameters:**
- `--fromBlock`: Start block (default: 3257444 - bridge deployment)
- `--toBlock`: End block (default: latest)
- `--output`: CSV file path

**What it does:**
- Scans `Cross` events from the RSK bridge
- Shows bridging transactions with:
  - Sender and recipient addresses
  - Token symbol and amount
  - Transaction hash and block number
- Aggregates total bridged amounts per token
- Useful for tracking cross-chain token movement

---

### 17. `data:getDLLRArbitrage`

Get DLLR arbitrage events from the watcher contract.

**Source:** `tyrone/watcher_arb_DLLR.py`

**Usage:**
```bash
npx hardhat data:getDLLRArbitrage [--fromBlock <number>] [--toBlock <number>] [--output <file>]
```

**Parameters:**
- `--fromBlock`: Start block (default: 5168617 - watcher deployment)
- `--toBlock`: End block (default: latest)
- `--output`: CSV file path

**What it does:**
- Scans `Arbitrage` events for DLLR ↔ WRBTC swaps
- Tracks arbitrage in both directions:
  - DLLR → WRBTC
  - WRBTC → DLLR
- Shows profit from each arbitrage
- Aggregates total amounts traded
- Useful for analyzing DLLR price stability

---

### 18. `data:getXUSDActivity`

Get XUSD aggregator mints and redemptions.

**Source:** `tyrone/SOV-AD-147.py`

**Usage:**
```bash
npx hardhat data:getXUSDActivity [--fromBlock <number>] [--toBlock <number>] [--output <file>]
```

**Parameters:**
- `--fromBlock`: Start block (default: 3416026 - aggregator deployment)
- `--toBlock`: End block (default: latest)
- `--output`: CSV file path

**What it does:**
- Scans `Minted` events (XUSD creation from bAssets)
- Scans `Redeemed` events (XUSD redemption to bAssets)
- Shows minter/redeemer, amounts, and underlying bAssets
- Calculates total minted and redeemed XUSD
- Compares difference with actual XUSD supply

---

## General Utilities

### 19. `data:getTokenHolders`

Get holders of any ERC20 token.

**Usage:**
```bash
npx hardhat data:getTokenHolders --token <address|name> [--block <number>] [--output <file>]
```

**Parameters:**
- `--token`: Token address or name (e.g., "SOV", "DLLR", or 0x...)
- `--block`: Reference block number (default: latest)
- `--output`: CSV file path

**What it does:**
- Scans all `Transfer` events for the token
- Identifies all addresses that received tokens
- Checks current balance for each address
- Distinguishes between EOAs and smart contracts
- Shows total holders and total balance
- Works with any ERC20 token

**Example:**
```bash
npx hardhat data:getTokenHolders --token SOV --output sov-holders.csv
npx hardhat data:getTokenHolders --token 0xEFc78fc7d48b64958315949279Ba181c2114ABBd
```

---

### 20. `data:getDLLRHolders`

Get DLLR token holder balances.

**Source:** `tyrone/DLLR_holders.py`

**Usage:**
```bash
npx hardhat data:getDLLRHolders [--block <number>] [--output <file>]
```

**Parameters:**
- `--block`: Reference block number (default: latest)
- `--output`: CSV file path

**What it does:**
- Specialized version of `getTokenHolders` for DLLR
- Scans from DLLR creation block (5072468)
- Excludes DLLR converter from total balance calculation
- Shows EOA vs smart contract holder counts
- Useful for DLLR supply analysis

---

## Common Features

### CSV Export

All tasks support optional CSV export via the `--output` parameter:

```bash
npx hardhat data:getBorrowData --user 0x123... --output my-data.csv
```

### Network Configuration

Tasks use the configured Hardhat network. Make sure your `hardhat.config.js` has the correct network settings:

```bash
# For RSK mainnet
npx hardhat data:getPendingFees --network rskMainnet

# For RSK testnet
npx hardhat data:getPendingFees --network rskTestnet
```

### Block Range Queries

Many tasks support block range parameters to limit scanning:

- `--fromBlock`: Start scanning from this block
- `--toBlock`: Stop scanning at this block
- `--block`: Reference a specific block for state queries
- `--blocks`: Number of blocks to scan back from latest

---

## Examples

### Comprehensive Loan Analysis
```bash
# Get all borrows for a user
npx hardhat data:getBorrowData --user 0x123... --output user-borrows.csv

# Get their margin positions
npx hardhat data:getMarginData --user 0x123... --output user-margins.csv

# Check if they used SOV collateral
npx hardhat data:getSOVBorrows --fromBlock 4000000 --output sov-borrows.csv
```

### Fee Analysis
```bash
# Get current pending fees
npx hardhat data:getPendingFees --output pending-fees.csv

# Get fee distribution history
npx hardhat data:getFeeCollectorRevenue --weeks 4 --output fee-history.csv
```

### Liquidity Analysis
```bash
# Get LP token holders
npx hardhat data:getLPTokenBalances --output lp-holders.csv

# Get AMM pool reserves
npx hardhat data:getAMMPoolStats --output pool-stats.csv
```

### Staking Analysis
```bash
# Get current stakers
npx hardhat data:getStakerStats --output stakers.csv

# Get their osSOV rewards
npx hardhat data:getStakingRewards --output rewards.csv

# Check unlock schedule
npx hardhat data:getCheckpoints --output checkpoints.csv
```

