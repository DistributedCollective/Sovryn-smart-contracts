# Adding a New Collateral Asset on Loan Pools  

This manual is intended to explain how to onboard a new asset as collateral across Sovryn loan tokens (Torque and margin), who the roles that can execute each step must be, and the Hardhat tasks can be used to verify on-chain states.

## Prerequisites  

- The asset must be swappable against the protocol underlyings (WRBTC/XUSD/USDT/etc.) so margin/borrow swaps can execute.  
- The price feed contract to register must be a `PriceFeedV1PoolOracle` instance targeting the asset’s WRBTC pool. Deploy or reuse one with constructor args `(v1PoolOracle, wRBTC, DOC, baseCurrency)` where `baseCurrency` is the asset you’re onboarding, and `v1PoolOracle` points to the WRBTC-<asset> V1 pool oracle (must include WRBTC as one reserve).  
- Add the token address to your `scripts/contractInteraction/*_contracts.json` so Brownie/Hardhat scripts can reference it.  

## Steps to Add Collateral  

1) **Ensure AMM liquidity / swap path** (anyone)  

   - Create or enable AMM/Sovryn-Swap-Network pools so the new token can swap to the underlyings.  
   - This process is permissionless and required for trades/borrows to work.  

2) **Deploy PriceFeedV1PoolOracle** (anyone)  

   - Deploy `PriceFeedV1PoolOracle` with constructor `(v1PoolOracle, wRBTC, DOC, baseCurrency)` where `baseCurrency` is the new asset and the V1 pool includes WRBTC. Keep the deployed address for step 5.  

3) **Add collateral params on each loan token** (anyone)  

   - The function signature is `setupLoanParams(LoanParamsStruct.LoanParams[] loanParamsList, bool areTorqueLoans)`. Anyone can execute it.  
     Each `LoanParamsStruct.LoanParams` element is `[id, active, owner, loanToken, collateralToken, minInitialMargin, maintenanceMargin, maxLoanTerm]`.  
     You only need to set `collateralToken`, `minInitialMargin`, and `maintenanceMargin`; the wrapper overwrites `loanToken` and `maxLoanTerm`, and assigns `owner`/`id`/`active`. The unused inputs (`id`, `active`, `owner`, `loanToken`, `maxLoanTerm`) can be zero/false/empty.  
   - SOV example (1e18 precision):  
     - Torque (borrowing): `areTorqueLoans=true`, `minInitialMargin=50 ether` (50%), `maintenanceMargin=15 ether` (15%).  
     - Margin trading: `areTorqueLoans=false`, `minInitialMargin=20 ether` (20%), `maintenanceMargin=15 ether` (15%).  
     - Hardhat/ethers `LoanParamsStruct.LoanParams[]` example:  

       ```js
       [
         [
           "0x0",          // id (ignored, can be 0)
           false,          // active (ignored, can be false)
           ethers.constants.AddressZero, // owner (ignored, can be zero)
           ethers.constants.AddressZero, // loanToken (overwritten, can be zero)
           "<collateral>", // collateralToken must be supplied
           ethers.utils.parseEther("0.20"), // minInitialMargin ("0.20" for margin) or "0.50" for torque
           ethers.utils.parseEther("0.15"), // maintenanceMargin
           0 // maxLoanTerm (overwritten: 0 torque, 28d margin; can be zero)
         ]
       ]
       ```  

   - For Torque (borrowing): `LoanTokenSettingsLowerAdmin.setupLoanParams(..., true)` (**public**).  
     Helper: `scripts/contractInteraction/loan_tokens.py:setupTorqueLoanParams`.  
   - For margin trading: `setupLoanParams(..., false)` (**public**).  
     Helpers: `setupMarginLoanParams` or `setupMarginLoanParamsMinInitialMargin`.  
   - Batch helper for both modes: `setupLoanParamsForCollaterals`.  
   - Run for every loan token (iXUSD, iRBTC, iBPro, iDOC, iUSDT, iDLLR, etc.).  

4) **Register price feed** (PriceFeeds owner / governance)  

   - Only the `PriceFeeds` owner can call `PriceFeeds.setPriceFeed(address[] tokens, address[] feeds)`. Pass the new asset address and its `PriceFeedV1PoolOracle` address (from step 2) in matching arrays.  
   - Optionally cache decimals via `PriceFeeds.setDecimals(address[] tokens)` (owner).  
   - Hardhat/ethers example:  

     ```js
     await priceFeeds.setPriceFeed(
       ["<ASSET_ADDRESS>"],
       ["<PRICEFEEDV1POOLORACLE_ADDRESS>"]
     );
     await priceFeeds.setDecimals(["<ASSET_ADDRESS>"]); // optional
     ```
   
   - Brownie helper: `scripts/contractInteraction/prices.py:setPriceFeed`.  

5) **Mark token as supported in protocol** (Sovryn admin/owner / governance)  

   - Sovryn `admin` or `owner` must call `ProtocolSettings.setSupportedTokens(address[] tokens, bool[] toggles)`. Arrays must match length.  
   - Hardhat/ethers example:  

     ```js
     await protocolSettings.setSupportedTokens(
       ["<ASSET_ADDRESS>"],
       [true] // enable
     );
     ```

   - Brownie helper: `scripts/contractInteraction/protocol.py:setSupportedToken`.  

6) --**_Optional_**--  **transaction limits**  

   - Only the loan token `owner` can call `LoanTokenSettingsLowerAdmin.setTransactionLimits(address[] addresses, uint256[] limits)`.  
   - `addresses`: array of token addresses to cap (e.g., collaterals or underlyings). `limits`: array of per-address limits, same length, denominated in each token’s own decimals. Empty arrays mean no limits. Example (Hardhat/ethers):  

     ```js
     // set a 1,000 token cap on SOV and a 10,000 cap on DLLR for this loan token
     await loanToken.setTransactionLimits(
       ["<SOV_ADDRESS>", "<DLLR_ADDRESS>"],        // addresses
       [ethers.utils.parseUnits("1000", 18),       // SOV limit
        ethers.utils.parseUnits("10000", 18)]      // DLLR limit
     );
     ```
   - To check current limits for an asset (e.g., SOV) across loan tokens:

     ```js
     // npx hardhat console --network <network>
     const sov = "<SOV_ADDRESS>";
     const loanTokens = ["<iXUSD>", "<iRBTC>", "<iBPRO>", "<iDOC>", "<iUSDT>", "<iDLLR>"]; // addresses
     for (const lt of loanTokens) {
       const ltContract = await ethers.getContractAt("LoanTokenLogicStandard", lt);
        const limit = await ltContract.transactionLimit(sov);
        console.log(lt, "transactionLimit(SOV) =", limit.toString());
      }
      // limit == 0 means no cap
     ```

   - Mainnet baseline: querying the hardhat task "`misc:loan:limits-on-collateral-all`" for the SOV asset on iXUSD/iRBTC/iBPRO/iDOC/iDLLR/iUSDT loan pools it returns `transactionLimit = 0` for all, meaning no caps or limits are set. If we are meant to follow this pattern, the calling to `setTransactionLimits` can be skipped for new collaterals unless limits are explicitly required.  

7) **Verify**  
   - Collateral enablement: `hh misc:loan:check-collateral --loanToken <iToken> --collateral <token> --network <...>`.  
   - For all mainnet loan tokens: `hh misc:loan:check-collateral-all --collateral <token> --network <...>`.  
   - Price feed + underlying oracle: `hh misc:pricefeed:get-oracle --token <token> --network <...>`.  
   - Roles/ownership snapshot: `hh misc:roles:check-authorities --network <...>`.  

# Adding a New Collateral: Case for BOS Token  

The following roles are required to perform each action:

| Action | Contract/Function | Required role |
| --- | --- | --- |
| Register/replace price feed | `PriceFeeds.setPriceFeed` | `owner` of PriceFeeds (governance timelock) |
| Set token decimals cache (optional) | `PriceFeeds.setDecimals` | `owner` of PriceFeeds |
| Mark token supported | `ProtocolSettings.setSupportedTokens` | `admin` or `owner` of Sovryn protocol |
| Set protocol admin | `ProtocolSettings.setAdmin` | `owner` of Sovryn protocol |
| Add collateral params (Torque/margin) | `LoanTokenSettingsLowerAdmin.setupLoanParams` | `owner` or `admin` of each loan token |
| Set tx limits (optional) | `LoanTokenSettingsLowerAdmin.setTransactionLimits` | `owner` or `admin` of each loan token |

Governance addresses:
- TimeLockOwner: `0x967c84b731679E36A344002b8E3CE50620A7F69f`
- TimeLockAdmin: `0x6c94c8aa97C08fC31fb06fbFDa90e1E09529FB13`

These are the pivotal governance roles that ultimately control PriceFeeds ownership and Sovryn protocol ownership/admin via the timelock.

### Hardhat task: misc:roles:check-authorities
Checks who currently holds authority:
```
hh misc:roles:check-authorities --network rskSovrynMainnet
```
Reports:
- Sovryn protocol owner/admin (`getAdmin()`).
- PriceFeeds owner.
- Each loan token’s owner/admin (defaults include iXUSD, iRBTC, iBPRO, iDOC, iDLLR, iUSDT; override via `--loanTokens` comma list).

## Checking Collateral Enablement
Use the Hardhat task to confirm whether a token is enabled as collateral:
```
hh misc:loan:check-collateral --loanToken <address|deployment> --collateral <tokenAddress> --network <...>
```
- Checks both Torque and margin if you run twice with `--isTorque true/false` (default true).
- For all mainnet loan tokens: `hh misc:loan:check-collateral-all --collateral <token> --network <...>`.

If a collateral is not enabled, you will see `loanParamsId` as zero for that mode.

## Inspecting the Feed and Underlying Oracle
```
hh misc:pricefeed:get-oracle --token <token> --network <...>
```
Prints the feed address set in `PriceFeeds.pricesFeeds(token)` and attempts common oracle getters (`rskOracleAddress`, `mocOracleAddress`, `v1PoolOracleAddress`, `oracle`, etc.).

---

With these steps and checks, you can fully onboard a new collateral asset and verify on-chain that governance-controlled roles (timelock owner/admin) or designated admins have executed the required actions. This serves as a building block for crafting a SIP for GovernorAlpha execution. 

## Authority Snapshot and SIP Implications
Run this to see who currently holds the relevant roles:
```
hh misc:roles:check-authorities --network rskSovrynMainnet
```
It reports:
- Sovryn protocol `owner` and `admin` (`getAdmin()`).
- PriceFeeds `owner`.
- Each loan token’s `owner` and `admin` (defaults: iXUSD, iRBTC, iBPRO, iDOC, iDLLR, iUSDT; override with `--loanTokens`).

Function-level execution rights and SIP requirement:

| Contract / Function | Executes by | SIP required if role is timelock? |
| --- | --- | --- |
| PriceFeeds: `setPriceFeed`, `setDecimals`, `transferOwnership` | PriceFeeds `owner` | Yes, if `owner` is TimelockOwner/Admin (`0x967c84b731679E36A344002b8E3CE50620A7F69f` / `0x6c94c8aa97C08fC31fb06fbFDa90e1E09529FB13`) |
| ProtocolSettings: `setSupportedTokens`, `setAdmin`, `setPriceFeedContract`, `setSwapsImplContract`, fee setters | Sovryn `admin` or `owner` (see modifiers) | Yes, when the role matches a timelock address |
| LoanTokenSettingsLowerAdmin: `setupLoanParams` (Torque/margin), `setTransactionLimits`, `setAdmin`, `setPauser` | Loan token `owner` or `admin` | Yes, if that role is held by a timelock |
| LoanToken proxy/beacon ownership changes | Loan token `owner` | Yes, if `owner` is a timelock |

If `misc:roles:check-authorities` shows a timelock address (above) in any of these fields, the action must be scheduled and executed via a SIP through the corresponding GovernorAlpha instance.

## Quorum Requirements for SIPs
GovernorAlpha calculates quorum as a percentage of current total voting power (`staking.getPriorTotalVotingPower`), defined at deployment:
- Code: `contracts/governance/GovernorAlpha.sol` (`quorumVotes()` uses `quorumPercentageVotes`).
- Deployment params: `scripts/deployment/deploy_governance.py`
  - **GovernorOwner (TimelockOwner)**: `ownerQuorumVotes = 20` → 20% quorum.
  - **GovernorAdmin (TimelockAdmin)**: `adminQuorumVotes = 5` → 5% quorum.

SIP types:
- Proposals targeting **TimelockOwner** (e.g., owner-level actions) require 20% quorum and the TimelockOwner address `0x967c84b731679E36A344002b8E3CE50620A7F69f`.
- Proposals targeting **TimelockAdmin** (e.g., admin-level actions) require 5% quorum and the TimelockAdmin address `0x6c94c8aa97C08fC31fb06fbFDa90e1E09529FB13`.

When preparing a SIP, route the transaction to the appropriate GovernorAlpha (Owner vs Admin) based on which timelock controls the target contract’s `owner`/`admin` as reported by `misc:roles:check-authorities`.
