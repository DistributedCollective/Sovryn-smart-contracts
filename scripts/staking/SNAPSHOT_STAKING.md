# Staking Snapshot Tool

This tool generates snapshots of staking data from the Sovryn staking contract at a specific point in time (or current state). It retrieves staking amounts and voting power for a list of addresses and exports the data in both JSON and CSV formats.

## Overview

The snapshot tool queries on-chain staking data including:
- **Amount Staked**: The total amount of tokens staked by each address
- **Voting Power**: Either voluntary VP (fee sharing) or total VP (SIP voting) based on the mode
- **VP Mode**: Indicates which voting power calculation was used
- **Is Vesting Contract**: Whether the address is a vesting smart contract

## Configuration

### 1. Network Configuration

`config/tbos_snapshot_staking.config.ts`:

```typescript
export const TBOS_SNAPSHOT_STAKING_CONFIG = {
  averageBlockTime: 15,                                    // Average block time in seconds
  stakingAddress: "0xc17C6462cEAFE9A8819258c6bA168BEF5544Fc21", // Staking contract address
  rpcUrl: "https://rpc.gobob.xyz/",                        // RPC endpoint
} as const;
```

### 2. Staker Addresses

Edit `config/stakerAddresses.json` to include the addresses you want to snapshot:

```json
{
  "addresses": [
    "0x060d080fb3e524fc61f4b16144fc39fc37a2ae39",
    "0x09f77d14dd558a4d8fc08b2a7330defcf117107d",
    ...
  ]
}
```

### 3. Environment Variables

Set the `RPC_URL` environment variable:

```bash
export RPC_URL="https://rpc.gobob.xyz/"
```

Or create a `.env` file in the project root.

## Usage

**Important**: You must explicitly specify either a Unix timestamp OR use the `--current-timestamp` flag. The script will not run without one of these options.

### Getting Help

To see all available options and examples:

```bash
yarn ts-node scripts/staking/snapshot_staking.ts --help
```

### Command Options

| Option | Type | Description |
|--------|------|-------------|
| `--network` | string | **Required**. Network to use: `BOB` or `RSK` |
| `--timestamp` | number | Unix timestamp for the snapshot (conflicts with --current-timestamp) |
| `--current-timestamp` | boolean | Use a recent timestamp (~2 blocks ago) for the snapshot (conflicts with --timestamp) |
| `--voluntary-only` | boolean | Use voluntary VP. **Default: true**. Use `--no-voluntary-only` for total VP |

### Current Snapshot

To take a snapshot at a recent timestamp (uses voluntary VP by default):

```bash
yarn ts-node scripts/staking/snapshot_staking.ts --network BOB --current-timestamp
```

**Note**: The script uses a block that's ~2 blocks behind the latest to avoid calculation errors.

### Historical Snapshot

To take a snapshot at a specific Unix timestamp:

```bash
yarn ts-node scripts/staking/snapshot_staking.ts --network BOB --timestamp 1728432000
```

Example for October 9, 2025 at midnight UTC:

```bash
yarn ts-node scripts/staking/snapshot_staking.ts --network BOB --timestamp 1728432000
```

### Voting Power Modes

**Default behavior (voluntary VP):**
```bash
# Uses voluntary VP by default
yarn ts-node scripts/staking/snapshot_staking.ts --network BOB --current-timestamp
yarn ts-node scripts/staking/snapshot_staking.ts --network BOB --timestamp 1728432000
```

**Total VP mode:**
```bash
# Use --no-voluntary-only for total VP
yarn ts-node scripts/staking/snapshot_staking.ts --network BOB --current-timestamp --no-voluntary-only
yarn ts-node scripts/staking/snapshot_staking.ts --network BOB --timestamp 1728432000 --no-voluntary-only
```

**For RSK network:**
```bash
yarn ts-node scripts/staking/snapshot_staking.ts --network RSK --current-timestamp
yarn ts-node scripts/staking/snapshot_staking.ts --network RSK --timestamp 1728432000
```

The flag controls which voting power value is shown in the main "Voting Power" field:
- **Default (or `--voluntary-only`)**: Shows voluntary voting power (own stake only) - used for fee sharing
- **`--no-voluntary-only`**: Shows total voting power (own stake + delegated) - used for SIP voting

Note: The `votingPowerMode` field clearly indicates which calculation method was used.

### Complete Examples

```bash
# Take snapshot at current time on BOB (shows voluntary VP by default)
yarn ts-node scripts/staking/snapshot_staking.ts --network BOB --current-timestamp

# Take snapshot at specific timestamp on BOB
yarn ts-node scripts/staking/snapshot_staking.ts --network BOB --timestamp 1728432000

# Current snapshot with total VP on BOB
yarn ts-node scripts/staking/snapshot_staking.ts --network BOB --current-timestamp --no-voluntary-only

# Historical snapshot on RSK
yarn ts-node scripts/staking/snapshot_staking.ts --network RSK --timestamp 1728432000
```

## Output

The tool generates two files in the `output/` directory with timestamps in their filenames:

### JSON Format

`staking_snapshot_YYYY-MM-DDTHH-MM-SS-MMMZ.json`

```json
[
  {
    "address": "0x3ff003142742d54e7c6a0c8da2861deae392dcce",
    "amountStaked": "20.0",
    "votingPower": "24.0",
    "votingPowerMode": "total",
    "isVesting": false
  },
  ...
]
```

### CSV Format

`staking_snapshot_YYYY-MM-DDTHH-MM-SS-MMMZ.csv`

```csv
Address,Amount Staked,Voting Power,VP Mode,Is Vesting
0x3ff003142742d54e7c6a0c8da2861deae392dcce,20.0,24.0,total,false
0x5894a716231109e420600de169734bd2666df89c,555.22,555.22,voluntary,false
...
```

## Output Fields

| Field | Description |
|-------|-------------|
| `Address` | The staker's Ethereum address |
| `Amount Staked` | Total amount of tokens staked (in token units, e.g., SOV) |
| `Voting Power` | The voting power value based on the mode |
| `VP Mode` | Indicates which VP is shown: "voluntary" or "total" |
| `Is Vesting` | Boolean indicating if the address is a vesting smart contract |

## How It Works

### 1. Block Calculation
The script calculates the target block number based on the provided timestamp (or uses the current block if `--current-timestamp` is specified).

Formula:
```
blockDifference = (currentTimestamp - targetTimestamp) / averageBlockTime
targetBlockNumber = currentBlockNumber - blockDifference
```

### 2. Data Retrieval
For each address in the configuration file:
- Checks if it's a vesting contract using `isVestingContract()`
- Retrieves total voting power using `getPriorVotes()` - includes own stake + delegated
- Retrieves own weighted stake using `getPriorWeightedStake()` - only own stake
- Calculates delegated voting power
- Retrieves staked amount using `balanceOf()`

### 3. Voting Power Calculations

The tool calculates three types of voting power:

- **Total Voting Power** (`getPriorVotes`): The address's own stake weight + any voting power delegated to them
- **Voluntary Voting Power** (`getPriorWeightedStake`): Only the voting power from the address's own stake
- **Delegated Voting Power**: `Total VP - Voluntary VP`

Formula: `Total VP = Voluntary VP + Delegated VP`

**Important**: Delegated voting power includes:
- Voting power delegated from vesting smart contracts
- Voting power delegated from other regular stakers

### 4. Output Selection
The `--voluntary-only` flag determines which value appears in the main "Voting Power" field:
- `--voluntary-only`: Uses voluntary VP (own stake only)
- Without flag: Uses total VP (own + delegated)

All values (total, voluntary, and delegated VP) are always captured in the output.

### 5. Export
Results are saved in both JSON and CSV formats with timestamped filenames.

### 6. Rate Limiting
The script includes a 100ms delay between requests to avoid overwhelming the RPC endpoint.

## Contract Methods Used

- `isVestingContract(address)`: Checks if an address is a vesting contract
- `getPriorVotes(address, blockNumber, timestamp)`: Gets total historical voting power (used for SIP voting)
- `getPriorWeightedStake(address, blockNumber, timestamp)`: Gets voluntary (own) voting power (used for fee sharing)
- `balanceOf(address)`: Gets the staked balance at a specific block

## Verification

To verify the results are correct, you can compare the snapshot output with data from Origins BE BD:

1. Run the snapshot (uses voluntary VP by default):
   ```bash
   yarn ts-node scripts/staking/snapshot_staking.ts --network BOB --timestamp <TIMESTAMP>
   ```

2. Compare the "Voting Power" values in the output with the fee sharing VP from Origins BE BD

3. The values should match because:
   - Default mode uses `getPriorWeightedStake` 
   - This calculates VP for fee sharing (no delegated VP from vesting contracts or other stakers)
   - The `votingPowerMode` field will show "voluntary"

### Example Test Addresses from Origins BE

Pick a few known addresses and verify:
- The voluntary VP matches fee sharing calculations
- The total VP (without `--voluntary-only`) matches SIP voting power
- Delegated VP = Total VP - Voluntary VP

