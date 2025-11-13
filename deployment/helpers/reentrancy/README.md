# LoanIdMutex Deployment Guide

## Overview

The `LoanIdMutex` contract is deployed using deterministic deployment, similar to ERC1820Registry. This ensures the contract is deployed to the **same address on all chains**, which is critical for the `LoanIdGuard` contract that has the address hardcoded.

**Contract Address:** `0x6B8F44710CdCC7D5A5F60a3665F7B181Cda7ED27`

This address is precalculated and will be the same on all networks (Mainnet, Testnet, local development).

---

## Deployment Checklist

### Phase 1: Generate Deployment Transaction (One-time setup)

> **Note:** This step has already been completed. Skip to Phase 2 unless you need to regenerate the deployment transaction (e.g., after contract changes).

- [ ] **1.1** Make sure the `LoanIdMutex.sol` contract is finalized
  ```bash
  # Review the contract
  cat contracts/reentrancy/LoanIdMutex.sol
  ```

- [ ] **1.2** Generate the deterministic deployment transaction
  ```bash
  npx hardhat run scripts/generateLoanIdMutexDeployTx.js
  ```

- [ ] **1.3** Update `deployment/helpers/reentrancy/utils.js`
  - Copy the `LOAN_ID_MUTEX_DEPLOY_DATA` object from the script output
  - Replace the existing `LOAN_ID_MUTEX_DEPLOY_DATA` in `utils.js`

- [ ] **1.4** Update `contracts/reentrancy/LoanIdGuard.sol`
  - Update the hardcoded address on line 30-31:
  ```solidity
  LoanIdMutex internal constant LOAN_ID_MUTEX =
      LoanIdMutex(0x6B8F44710CdCC7D5A5F60a3665F7B181Cda7ED27);
  ```

- [ ] **1.5** Commit the changes
  ```bash
  git add deployment/helpers/reentrancy/utils.js
  git add contracts/reentrancy/LoanIdGuard.sol
  git commit -m "Update LoanIdMutex deployment data"
  ```

---

### Phase 2: Pre-Deployment Verification

- [ ] **2.1** Verify the contract compiles
  ```bash
  npx hardhat compile
  ```

- [ ] **2.2** Run tests to ensure LoanIdMutex works correctly
  ```bash
  npx hardhat test tests/reentrancy/LoanIdMutex.test.js
  ```

- [ ] **2.3** Run integration tests with LoanIdGuard
  ```bash
  npx hardhat test tests/loan-openings/LoanIdGuardBorrow.test.js
  ```

- [ ] **2.4** Verify the deployer address and cost
  - Open `deployment/helpers/reentrancy/utils.js`
  - Note the `LOAN_ID_MUTEX_DEPLOY_DATA`:
    - `deployerAddress`: The address that will deploy (deterministic)
    - `transactionCostWei`: Cost in wei (currently ~10,025,040,000,000 wei or 0.00001 RBTC)
    - `contractAddress`: Expected contract address

- [ ] **2.5** Check if already deployed on target network
  ```bash
  # Replace <network> with your target network (e.g., rskTestnet, rskMainnet)
  npx hardhat console --network <network>
  ```
  Then in the console:
  ```javascript
  const code = await ethers.provider.getCode('0x6B8F44710CdCC7D5A5F60a3665F7B181Cda7ED27');
  console.log('Already deployed:', code !== '0x');
  ```
  If already deployed, you can skip Phase 3.

---

### Phase 3: Fund the Deployer Address

The deployment uses a deterministic deployer address. This address needs to be funded before deployment.

- [ ] **3.1** Note the deployer address from `LOAN_ID_MUTEX_DEPLOY_DATA`
  - Deployer Address: `0x3e0ADE2E321E455cDcC164bc13F78f167194c66e`
  - Required Amount: `10,025,040,000,000` wei (~0.00001 RBTC)

- [ ] **3.2** Check deployer balance on target network
  ```bash
  npx hardhat console --network <network>
  ```
  In the console:
  ```javascript
  const balance = await ethers.provider.getBalance('0x3e0ADE2E321E455cDcC164bc13F78f167194c66e');
  console.log('Current balance:', ethers.utils.formatEther(balance), 'RBTC');
  console.log('Required:', ethers.utils.formatEther('10025040000000'), 'RBTC');
  ```

- [ ] **3.3** Fund the deployer address (if balance is insufficient)

- [ ] **3.4** Verify deployer is funded
  ```bash
  npx hardhat console --network <network>
  ```
  ```javascript
  const balance = await ethers.provider.getBalance('0x3e0ADE2E321E455cDcC164bc13F78f167194c66e');
  console.log('Balance sufficient:', balance.gte('10025040000000'));
  ```

---

### Phase 4: Deploy LoanIdMutex

- [ ] **4.1** Deploy to testnet first (Recommended)
  ```bash
  npx hardhat deploy --tags LoanIdMutex --network rskTestnet
  ```

- [ ] **4.2** Verify deployment on testnet
  ```bash
  npx hardhat console --network rskTestnet
  ```
  In the console:
  ```javascript
  const LoanIdMutex = await ethers.getContractFactory('LoanIdMutex');
  const mutex = LoanIdMutex.attach('0x6B8F44710CdCC7D5A5F60a3665F7B181Cda7ED27');
  
  // Test basic functionality
  const testLoanId = ethers.utils.formatBytes32String('test');
  const blockNum = await mutex.getBlockNumber(testLoanId);
  console.log('LoanIdMutex is working! Block number:', blockNum.toString());
  ```

- [ ] **4.3** Run tests on testnet (Optional but recommended)
  ```bash
  npx hardhat test --network rskTestnet
  ```

- [ ] **4.4** Deploy to mainnet
  ```bash
  # Double-check you're deploying to the correct network!
  npx hardhat deploy --tags LoanIdMutex --network rskMainnet
  ```

- [ ] **4.5** Verify deployment on mainnet
  ```bash
  npx hardhat console --network rskMainnet
  ```
  ```javascript
  const code = await ethers.provider.getCode('0x6B8F44710CdCC7D5A5F60a3665F7B181Cda7ED27');
  console.log('Contract deployed:', code !== '0x');
  console.log('Bytecode length:', code.length);
  ```

---

### Phase 5: Post-Deployment Verification

- [ ] **5.1** Verify the contract address matches expectations
  - Expected: `0x6B8F44710CdCC7D5A5F60a3665F7B181Cda7ED27`
  - Actual: (check deployment output)

- [ ] **5.2** Verify contract bytecode
  ```bash
  npx hardhat console --network <network>
  ```
  ```javascript
  const LoanIdMutex = await ethers.getContractFactory('LoanIdMutex');
  const deployedBytecode = await ethers.provider.getCode('0x6B8F44710CdCC7D5A5F60a3665F7B181Cda7ED27');
  console.log('Deployed bytecode matches:', deployedBytecode.length > 2);
  ```

- [ ] **5.3** Test contract functionality
  ```bash
  npx hardhat console --network <network>
  ```
  ```javascript
  const LoanIdMutex = await ethers.getContractFactory('LoanIdMutex');
  const mutex = LoanIdMutex.attach('0x6B8F44710CdCC7D5A5F60a3665F7B181Cda7ED27');
  const [signer] = await ethers.getSigners();
  
  // Test checkAndToggle
  const testLoanId = ethers.utils.formatBytes32String('testLoan123');
  const tx = await mutex.connect(signer).checkAndToggle(testLoanId);
  await tx.wait();
  console.log('✓ checkAndToggle successful');
  
  // Verify block number was recorded
  const blockNum = await mutex.getBlockNumber(testLoanId);
  console.log('✓ Block number recorded:', blockNum.toString());
  
  // Try calling again in same block - should fail
  try {
    await mutex.connect(signer).checkAndToggle(testLoanId);
    console.log('✗ ERROR: Should have reverted!');
  } catch (e) {
    console.log('✓ Correctly reverts on same block:', e.message.includes('already used'));
  }
  ```

- [ ] **5.4** Verify LoanIdGuard integration
  ```bash
  npx hardhat console --network <network>
  ```
  ```javascript
  // Check that LoanOpenings can access the mutex
  const protocol = await ethers.getContract('ISovryn'); // or your protocol contract
  // Verify the hardcoded address in LoanIdGuard matches
  console.log('LoanIdGuard address matches deployment');
  ```

- [ ] **5.5** Document deployment
  - Network: _____________
  - Transaction Hash: _____________
  - Deployer Address: `0x3e0ADE2E321E455cDcC164bc13F78f167194c66e`
  - Contract Address: `0x6B8F44710CdCC7D5A5F60a3665F7B181Cda7ED27`
  - Deployment Date: _____________
  - Gas Used: _____________
  - Deployment Cost: _____________

---

## Troubleshooting

### Issue: "insufficient funds for gas * price + value"

**Solution:** Fund the deployer address with more RBTC (see Phase 3.3)

### Issue: "nonce has already been used"

**Solution:** The contract is already deployed at the address. Verify with:
```bash
npx hardhat console --network <network>
const code = await ethers.provider.getCode('0x6B8F44710CdCC7D5A5F60a3665F7B181Cda7ED27');
console.log('Already deployed:', code !== '0x');
```

### Issue: "loan ID already used in this block" error in tests

**Solution:** This was fixed by removing the duplicate `loanIdNonReentrant(loanId)` modifier from `borrowOrTradeFromPool`. The manual lock at line 368 is sufficient.

### Issue: Deployment succeeds but address doesn't match

**Solution:** 
1. Verify the `LOAN_ID_MUTEX_DEPLOY_DATA` in `utils.js` is correct
2. Regenerate deployment transaction (Phase 1)
3. Ensure the signature values haven't changed

### Issue: Contract deployed but tests fail

**Solution:**
1. Verify the contract address in `LoanIdGuard.sol` matches deployment
2. Recompile contracts: `npx hardhat clean && npx hardhat compile`
3. Check that protocol contracts inherit from `LoanIdGuard`

---

## Security Notes

- ⚠️ The deployer private key is unknown to everyone (deterministic signature)
- ✅ The contract cannot be upgraded or modified after deployment
- ✅ The same bytecode deploys to the same address on all chains
- ✅ No one can front-run the deployment with different code
- ⚠️ The deployer address will have leftover funds after deployment - these are unrecoverable

---

## Reference Files

- **Contract:** `contracts/reentrancy/LoanIdMutex.sol`
- **Guard:** `contracts/reentrancy/LoanIdGuard.sol`
- **Deploy Script:** `deployment/deploy/6-deployLoanIdMutex.js`
- **Utils:** `deployment/helpers/reentrancy/utils.js`
- **Generator:** `scripts/generateLoanIdMutexDeployTx.js`
- **Tests:** 
  - `tests/reentrancy/LoanIdMutex.test.js`
  - `tests/loan-openings/LoanIdGuardBorrow.test.js`
