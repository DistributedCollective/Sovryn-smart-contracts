# iUSDT0 Activation Workflow

## ⚠️ Important: Governance-Only Approach

**Critical Note:** All protocol-level operations are executed via **Governance (TimelockAdmin)**. This includes `setLoanPool()`, `setSupportedTokens()`, `setPriceFeed()`, and all other protocol configuration.

---

## 📋 Complete Activation Steps (Simplified)

### Step 0: Deploy USDT0 Price Feed Wrapper (CRITICAL)

**⚠️ IMPORTANT:** Redstone's USDT price feed returns 8 decimals, but Sovryn's PriceFeeds contract expects 18 decimals. You **MUST** deploy a wrapper contract first.

**Deploy the wrapper:**
```bash
npx hardhat deploy --tags USDT0PriceFeed --network rskMainnet
```

**What this does:**
- Deploys `USDT0PriceFeed` wrapper contract
- Wraps Redstone USDT oracle: `0x09639692ce6Ff12a06cA3AE9a24B3aAE4cD80dc8`
- Scales from 8 decimals → 18 decimals
- Example: `99937000` (8 dec) → `999370000000000000` (18 dec)

**Verify it works:**
```javascript
const wrapper = await ethers.getContractAt("USDT0PriceFeed", "<wrapper_address>");
const price = await wrapper.latestAnswer();
console.log(ethers.utils.formatEther(price)); // Should be ~0.999 USD
```

---

### Step 1: Deploy iUSDT0 Loan Token

**Prerequisites:**
- ✅ USDT0PriceFeed wrapper is deployed
- ✅ USDT0 token is deployed at `0x779Ded0c9e1022225f8E0630b35a9b54bE713736`
- Add USDT0 to `mainnet_contracts.json`:
  ```json
  "USDT0": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736"
  ```

**Run Deployment:**
```bash
brownie run scripts/addLoanToken/add_usdt0.py --network rsk-mainnet
```

**What This Does:**
- ✅ Deploys iUSDT0 loan token contract
- ✅ Sets up interest rate curves
- ✅ Configures initial loan parameters with collateral tokens

**What This DOES NOT Do:**
- ❌ Does NOT call `setLoanPool()` (handled by SIP-0089)
- ❌ Does NOT set USDT0 price feed (handled by SIP-0089)
- ❌ Does NOT mark USDT0 as supported token (handled by SIP-0089)

**After Deployment:**
- Save the iUSDT0 contract address
- Add iUSDT0 deployment to `deployment/deployments/rskSovrynMainnet/LoanToken_iUSDT0.json`
- Update `mainnet_contracts.json`:
  ```json
  "iUSDT0": "<deployed_address>"
  ```

---

### Step 2: Execute SIP-0089 (Complete Activation via Governance)

**Prerequisites:**
- ✅ USDT0PriceFeed wrapper is deployed (Step 0)
- ✅ iUSDT0 loan token is deployed (Step 1)
- ✅ iUSDT0 address is added to deployment configs

**Create and Execute SIP:**
```bash
npx hardhat sip-create --argsFunc getArgsSip0089 --network rskMainnet
```

**What SIP-0089 Does:**
1. ✅ `setPriceFeed([USDT0], [USDT_PriceFeed])` - Register USDT0 price feed
2. ✅ `setSupportedTokens([USDT0], [true])` - Mark USDT0 as supported
3. ✅ `setupLoanParams` for 5 loan tokens to accept USDT0 as collateral:
   - iXUSD
   - iRBTC
   - iBPRO
   - iDOC
   - iDLLR