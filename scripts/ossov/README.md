# osSOV Snapshot Tool

A unified TypeScript tool for capturing osSOV balances and unclaimed rewards across multiple networks (RSK Mainnet and BOB).

---

## Quick Start

### 1. Setup Configuration

```bash
# Create config.json from example
cp scripts/ossov/config.json.example scripts/ossov/config.json

# Edit config.json with your network settings
```

**config.json structure:**
```json
{
  "networks": {
    "bob": {
      "name": "BOB",
      "rpcUrl": "https://rpc.gobob.xyz",
      "rewardsAddress": "0xYourRewardsContractAddress",
      "startBlock": 26296185
    }
  },
  "addresses": []
}
```

### 2. Run Snapshot

**BOB Network with auto-discovery:**
```bash
npx ts-node scripts/ossov/snapshot-ossov.ts \
  --network bob \
  --auto-discover \
  --block 26296185
```

**With specific addresses:**
```bash
npx ts-node scripts/ossov/snapshot-ossov.ts \
  --network rsk \
  --addresses ./my-addresses.json
```

---

## Command-Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--network` | Network to use (rsk or bob) | `--network bob` |
| `--block` | Target block number (default: latest) | `--block 26296185` |
| `--start-block` | Starting block for discovery | `--start-block 900618` |
| `--auto-discover` | Enable auto-discovery mode | `--auto-discover` |
| `--addresses` | JSON file with addresses | `--addresses ./addresses.json` |

---

## Usage Examples

### Example: BOB Network Auto-Discovery

```bash
npx ts-node scripts/ossov/snapshot-ossov.ts \
  --network bob \
  --auto-discover \
  --block 26296185
```

### Example 3: BOB with Custom Block Range

```bash
npx ts-node scripts/ossov/snapshot-ossov.ts \
  --network bob \
  --auto-discover \
  --start-block 26296185 \
  --block 26300000
```

---

## Auto-Discovery Mode

When `--auto-discover` is enabled, the script automatically finds all relevant addresses by scanning:

### 1. TokensStaked Events
```
Staking Contract → TokensStaked events → Extract staker addresses
```

### 2. Transfer Events
```
osSOV Token → Transfer events → Extract from/to addresses
```

### 3. Deduplicate
```
Combine all addresses → Remove duplicates → Final address list
```

This ensures you capture all addresses that have ever:
- Staked tokens
- Received osSOV tokens
- Transferred osSOV tokens

---

## Output Files

### CSV: `results/{network}_snapshot_block_{BLOCK}.csv`

```csv
address,osSOV_balance,osSOV_unclaimed
0x1234...,5000000000000000000,250000000000000000
0x5678...,10000000000000000000,500000000000000000
```

**Columns:**
- `address` - Ethereum address
- `osSOV_balance` - Current osSOV token balance (wei)
- `osSOV_unclaimed` - Unclaimed rewards available (wei)

### Progress: `results/{network}_progress_block_{BLOCK}.json`

```json
{
  "network": "BOB",
  "targetBlock": 26296185,
  "startFromBlock": 26296185,
  "totalAddresses": 150,
  "processedCount": 75,
  "lastProcessedIndex": 74,
  "lastUpdateTime": "2026-02-09T12:34:56.789Z"
}
```

---

## Resume Capability

If the script stops (network issue, rate limit, etc.), just run it again:

```bash
npx ts-node scripts/ossov/snapshot-ossov.ts \
  --network bob \
  --auto-discover \
  --block 26296185
```

The script will:
1. ✅ Load existing CSV data
2. ✅ Load progress log
3. ✅ Skip already processed addresses
4. ✅ Continue from where it stopped

---

## Network Configuration

### BOB
- **RPC:** `https://rpc.gobob.xyz`
- **Rewards Contract:** *Set in config.json*
- **Start Block:** `26296185`
- **Chunk Size:** `5000` (5K blocks per query, optimized for BOB)
