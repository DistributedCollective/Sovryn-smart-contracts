# Multisig Token Transfer Helper

This document describes how to use the multisig token transfer helper to send ERC20 tokens and native gas tokens via a MultiSigWallet.

## Overview

The `multisig:send-tokens` task allows you to:
- Send ERC20 tokens from a MultiSigWallet to one or more recipients
- Send native gas tokens (e.g., RBTC, ETH) from a MultiSigWallet
- Automatically submit transactions if you're a multisig owner
- Generate transaction data for manual submission if you're not an owner
- Process multiple token transfers in a single command

## Usage

### Basic Syntax

```bash
npx hardhat multisig:send-tokens \
  --transfers '<JSON_ARRAY>' \
  --signer <SIGNER_NAME> \
  --multisig <MULTISIG_ADDRESS> \
  --network <NETWORK_NAME>
```

### Parameters

- `--transfers` (required): JSON array of transfer objects with the following structure:
  - `token`: Token identifier (address, deployment name like "SOV", "DLLR", or "GasToken" for native token)
  - `to`: Recipient address
  - `amount`: Transfer amount in wei (for tokens with 18 decimals, 1 token = 1000000000000000000 wei)

- `--signer` (optional): Signer account name (default: "deployer")
  - Can be "deployer", "signer", or any named account
  - Can also be an address

- `--multisig` (optional): MultiSigWallet address or deployment name (default: "MultiSigWallet")
  - Can be a deployment name like "MultiSigWallet"
  - Can be an address like "0x1234..."

- `--network` (required): Network to execute on (e.g., rskTestnet, rskMainnet)

## Examples

### Example 1: Send SOV tokens

Send 1000 SOV tokens to a recipient:

```bash
npx hardhat multisig:send-tokens \
  --transfers '[{"token":"SOV","to":"0x1234567890123456789012345678901234567890","amount":"1000000000000000000000"}]' \
  --network rskTestnet
```

### Example 2: Send native gas token (RBTC)

Send 0.1 RBTC to a recipient:

```bash
npx hardhat multisig:send-tokens \
  --transfers '[{"token":"GasToken","to":"0x1234567890123456789012345678901234567890","amount":"100000000000000000"}]' \
  --network rskTestnet
```

### Example 3: Multiple token transfers

Send multiple tokens in a single command:

```bash
npx hardhat multisig:send-tokens \
  --transfers '[
    {"token":"SOV","to":"0x1234567890123456789012345678901234567890","amount":"1000000000000000000000"},
    {"token":"DLLR","to":"0x0987654321098765432109876543210987654321","amount":"5000000000000000000000"},
    {"token":"GasToken","to":"0x1111222233334444555566667777888899990000","amount":"100000000000000000"}
  ]' \
  --network rskTestnet
```

### Example 4: Using token address instead of name

Send tokens using the contract address:

```bash
npx hardhat multisig:send-tokens \
  --transfers '[{"token":"0xEFc78FC7d48b64958315949279Ba181c2114ABBd","to":"0x1234567890123456789012345678901234567890","amount":"1000000000000000000"}]' \
  --network rskTestnet
```

### Example 5: Using custom multisig

Send tokens from a specific multisig wallet:

```bash
npx hardhat multisig:send-tokens \
  --transfers '[{"token":"SOV","to":"0x1234567890123456789012345678901234567890","amount":"1000000000000000000"}]' \
  --multisig "0xCustomMultisigAddress" \
  --network rskTestnet
```

### Example 6: Using custom signer

Send tokens using a specific signer:

```bash
npx hardhat multisig:send-tokens \
  --transfers '[{"token":"SOV","to":"0x1234567890123456789012345678901234567890","amount":"1000000000000000000"}]' \
  --signer "signer" \
  --network rskTestnet
```

## Behavior

### When sender is a multisig owner:

1. The transaction is automatically submitted to the multisig
2. A transaction ID is returned
3. Transaction details are displayed
4. Other owners can confirm the transaction using:
   ```bash
   npx hardhat multisig:sign-tx <TX_ID> --network <NETWORK>
   ```

### When sender is NOT a multisig owner:

1. Transaction data is printed to console:
   - To address (token contract or recipient)
   - Value (0 for ERC20, amount for native token)
   - Encoded data (function call for ERC20, "0x" for native token)
2. An owner must manually submit this data using:
   ```bash
   multisig.submitTransaction("<TO_ADDRESS>", <VALUE>, "<ENCODED_DATA>")
   ```

## Token Amount Calculation

For tokens with 18 decimals (most ERC20 tokens):
- 1 token = 1000000000000000000 wei
- 0.1 token = 100000000000000000 wei
- 1000 tokens = 1000000000000000000000 wei

You can use JavaScript/Node.js to calculate amounts:
```javascript
const ethers = require('ethers');
const amount = ethers.utils.parseEther('1000'); // For 1000 tokens
console.log(amount.toString());
```

## Supported Token Names

The following token names can be used as deployment names (must be deployed on the network):
- SOV (Sovryn token)
- DLLR (Sovryn Dollar)
- BOS (Basket of Stablecoins)
- Any other deployed contract name from the hardhat-deploy deployments

## Error Handling

Common errors and solutions:

1. **"Token not found in deployments"**
   - Solution: Use the token's contract address instead, or ensure the token is deployed

2. **"User is not an owner"**
   - Solution: Either use an owner account as signer, or copy the printed transaction data and have an owner submit it

3. **"Error parsing transfers JSON"**
   - Solution: Ensure JSON is properly formatted with double quotes and escaped if necessary

4. **"Each transfer must have 'token', 'to', and 'amount' properties"**
   - Solution: Verify all required fields are present in each transfer object

## Notes

- Always double-check recipient addresses and amounts before submitting
- For production use on mainnet, test on testnet first
- The multisig requires the configured number of confirmations before executing
- Gas estimation is automatically performed with a 30% buffer
- All token amounts should be provided in wei (smallest unit)

## Related Commands

- Check multisig transaction: `npx hardhat multisig:check-tx <TX_ID>`
- Sign multisig transaction: `npx hardhat multisig:sign-tx <TX_ID>`
- Execute multisig transaction: `npx hardhat multisig:execute-tx <TX_ID>`
- Get multisig owners: `npx hardhat multisig:get-owners`
