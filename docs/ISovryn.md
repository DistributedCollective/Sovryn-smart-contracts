# ISovryn.sol

View Source: [contracts/interfaces/ISovryn.sol](../contracts/interfaces/ISovryn.sol)

**↗ Extends: [State](State.md), [ProtocolSettingsEvents](ProtocolSettingsEvents.md), [LoanSettingsEvents](LoanSettingsEvents.md), [LoanOpeningsEvents](LoanOpeningsEvents.md), [LoanMaintenanceEvents](LoanMaintenanceEvents.md), [LoanClosingsEvents](LoanClosingsEvents.md), [SwapsEvents](SwapsEvents.md), [AffiliatesEvents](AffiliatesEvents.md), [FeesEvents](FeesEvents.md)**

**ISovryn**

## Structs
### LoanReturnData

```js
struct LoanReturnData {
 bytes32 loanId,
 address loanToken,
 address collateralToken,
 uint256 principal,
 uint256 collateral,
 uint256 interestOwedPerDay,
 uint256 interestDepositRemaining,
 uint256 startRate,
 uint256 startMargin,
 uint256 maintenanceMargin,
 uint256 currentMargin,
 uint256 maxLoanTerm,
 uint256 endTimestamp,
 uint256 maxLiquidatable,
 uint256 maxSeizable
}
```

### LoanReturnDataV2

```js
struct LoanReturnDataV2 {
 bytes32 loanId,
 address loanToken,
 address collateralToken,
 address borrower,
 uint256 principal,
 uint256 collateral,
 uint256 interestOwedPerDay,
 uint256 interestDepositRemaining,
 uint256 startRate,
 uint256 startMargin,
 uint256 maintenanceMargin,
 uint256 currentMargin,
 uint256 maxLoanTerm,
 uint256 endTimestamp,
 uint256 maxLiquidatable,
 uint256 maxSeizable,
 uint256 creationTimestamp
}
```

**Events**

```js
event PayInterestTransfer(address indexed interestToken, address indexed lender, uint256  effectiveInterest);
```

## Functions

- [replaceContract(address target)](#replacecontract)
- [setTargets(string[] sigsArr, address[] targetsArr)](#settargets)
- [getTarget(string sig)](#gettarget)
- [setSovrynProtocolAddress(address newProtocolAddress)](#setsovrynprotocoladdress)
- [setSOVTokenAddress(address newSovTokenAddress)](#setsovtokenaddress)
- [setLockedSOVAddress(address newSOVLockedAddress)](#setlockedsovaddress)
- [setMinReferralsToPayoutAffiliates(uint256 newMinReferrals)](#setminreferralstopayoutaffiliates)
- [setPriceFeedContract(address newContract)](#setpricefeedcontract)
- [setSwapsImplContract(address newContract)](#setswapsimplcontract)
- [setLoanPool(address[] pools, address[] assets)](#setloanpool)
- [setSupportedTokens(address[] addrs, bool[] toggles)](#setsupportedtokens)
- [setLendingFeePercent(uint256 newValue)](#setlendingfeepercent)
- [setTradingFeePercent(uint256 newValue)](#settradingfeepercent)
- [setBorrowingFeePercent(uint256 newValue)](#setborrowingfeepercent)
- [setSwapExternalFeePercent(uint256 newValue)](#setswapexternalfeepercent)
- [setAffiliateFeePercent(uint256 newValue)](#setaffiliatefeepercent)
- [setAffiliateTradingTokenFeePercent(uint256 newValue)](#setaffiliatetradingtokenfeepercent)
- [setLiquidationIncentivePercent(uint256 newAmount)](#setliquidationincentivepercent)
- [setMaxDisagreement(uint256 newAmount)](#setmaxdisagreement)
- [setSourceBuffer(uint256 newAmount)](#setsourcebuffer)
- [setMaxSwapSize(uint256 newAmount)](#setmaxswapsize)
- [setFeesController(address newController)](#setfeescontroller)
- [withdrawLendingFees(address token, address receiver, uint256 amount)](#withdrawlendingfees)
- [withdrawTradingFees(address token, address receiver, uint256 amount)](#withdrawtradingfees)
- [withdrawBorrowingFees(address token, address receiver, uint256 amount)](#withdrawborrowingfees)
- [withdrawProtocolToken(address receiver, uint256 amount)](#withdrawprotocoltoken)
- [depositProtocolToken(uint256 amount)](#depositprotocoltoken)
- [getLoanPoolsList(uint256 start, uint256 count)](#getloanpoolslist)
- [isLoanPool(address loanPool)](#isloanpool)
- [setWrbtcToken(address wrbtcTokenAddress)](#setwrbtctoken)
- [setSovrynSwapContractRegistryAddress(address registryAddress)](#setsovrynswapcontractregistryaddress)
- [setProtocolTokenAddress(address _protocolTokenAddress)](#setprotocoltokenaddress)
- [setRolloverBaseReward(uint256 transactionCost)](#setrolloverbasereward)
- [setRebatePercent(uint256 rebatePercent)](#setrebatepercent)
- [setSpecialRebates(address sourceToken, address destToken, uint256 specialRebatesPercent)](#setspecialrebates)
- [getSpecialRebates(address sourceToken, address destToken)](#getspecialrebates)
- [togglePaused(bool paused)](#togglepaused)
- [isProtocolPaused()](#isprotocolpaused)
- [setupLoanParams(struct LoanParamsStruct.LoanParams[] loanParamsList)](#setuploanparams)
- [disableLoanParams(bytes32[] loanParamsIdList)](#disableloanparams)
- [getLoanParams(bytes32[] loanParamsIdList)](#getloanparams)
- [getLoanParamsList(address owner, uint256 start, uint256 count)](#getloanparamslist)
- [getTotalPrincipal(address lender, address loanToken)](#gettotalprincipal)
- [minInitialMargin(bytes32 loanParamsId)](#mininitialmargin)
- [borrowOrTradeFromPool(bytes32 loanParamsId, bytes32 loanId, bool isTorqueLoan, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues, bytes loanDataBytes)](#borrowortradefrompool)
- [setDelegatedManager(bytes32 loanId, address delegated, bool toggle)](#setdelegatedmanager)
- [getEstimatedMarginExposure(address loanToken, address collateralToken, uint256 loanTokenSent, uint256 collateralTokenSent, uint256 interestRate, uint256 newPrincipal)](#getestimatedmarginexposure)
- [getRequiredCollateral(address loanToken, address collateralToken, uint256 newPrincipal, uint256 marginAmount, bool isTorqueLoan)](#getrequiredcollateral)
- [getBorrowAmount(address loanToken, address collateralToken, uint256 collateralTokenAmount, uint256 marginAmount, bool isTorqueLoan)](#getborrowamount)
- [liquidate(bytes32 loanId, address receiver, uint256 closeAmount)](#liquidate)
- [rollover(bytes32 loanId, bytes loanDataBytes)](#rollover)
- [closeWithDeposit(bytes32 loanId, address receiver, uint256 depositAmount)](#closewithdeposit)
- [closeWithSwap(bytes32 loanId, address receiver, uint256 swapAmount, bool returnTokenIsCollateral, bytes loanDataBytes)](#closewithswap)
- [depositCollateral(bytes32 loanId, uint256 depositAmount)](#depositcollateral)
- [withdrawCollateral(bytes32 loanId, address receiver, uint256 withdrawAmount)](#withdrawcollateral)
- [extendLoanByInterest(bytes32 loanId, address payer, uint256 depositAmount, bool useCollateral, bytes loanDataBytes)](#extendloanbyinterest)
- [reduceLoanByInterest(bytes32 loanId, address receiver, uint256 withdrawAmount)](#reduceloanbyinterest)
- [withdrawAccruedInterest(address loanToken)](#withdrawaccruedinterest)
- [getLenderInterestData(address lender, address loanToken)](#getlenderinterestdata)
- [getLoanInterestData(bytes32 loanId)](#getloaninterestdata)
- [getUserLoans(address user, uint256 start, uint256 count, uint256 loanType, bool isLender, bool unsafeOnly)](#getuserloans)
- [getUserLoansV2(address user, uint256 start, uint256 count, uint256 loanType, bool isLender, bool unsafeOnly)](#getuserloansv2)
- [getLoan(bytes32 loanId)](#getloan)
- [getLoanV2(bytes32 loanId)](#getloanv2)
- [getActiveLoans(uint256 start, uint256 count, bool unsafeOnly)](#getactiveloans)
- [getActiveLoansV2(uint256 start, uint256 count, bool unsafeOnly)](#getactiveloansv2)
- [setLegacyOracles(address[] refs, address[] oracles)](#setlegacyoracles)
- [getLegacyOracle(address ref)](#getlegacyoracle)
- [swapExternal(address sourceToken, address destToken, address receiver, address returnToSender, uint256 sourceTokenAmount, uint256 requiredDestTokenAmount, uint256 minReturn, bytes swapData)](#swapexternal)
- [getSwapExpectedReturn(address sourceToken, address destToken, uint256 sourceTokenAmount)](#getswapexpectedreturn)
- [checkPriceDivergence(address sourceToken, address destToken, uint256 sourceTokenAmount, uint256 minReturn)](#checkpricedivergence)
- [getUserNotFirstTradeFlag(address user)](#getusernotfirsttradeflag)
- [setUserNotFirstTradeFlag(address user)](#setusernotfirsttradeflag)
- [payTradingFeeToAffiliatesReferrer(address referrer, address trader, address token, uint256 tradingFeeTokenBaseAmount)](#paytradingfeetoaffiliatesreferrer)
- [setAffiliatesReferrer(address user, address referrer)](#setaffiliatesreferrer)
- [getReferralsList(address referrer)](#getreferralslist)
- [getAffiliatesReferrerBalances(address referrer)](#getaffiliatesreferrerbalances)
- [getAffiliatesReferrerTokensList(address referrer)](#getaffiliatesreferrertokenslist)
- [getAffiliatesReferrerTokenBalance(address referrer, address token)](#getaffiliatesreferrertokenbalance)
- [withdrawAffiliatesReferrerTokenFees(address token, address receiver, uint256 amount)](#withdrawaffiliatesreferrertokenfees)
- [withdrawAllAffiliatesReferrerTokenFees(address receiver)](#withdrawallaffiliatesreferrertokenfees)
- [getProtocolAddress()](#getprotocoladdress)
- [getSovTokenAddress()](#getsovtokenaddress)
- [getLockedSOVAddress()](#getlockedsovaddress)
- [getFeeRebatePercent()](#getfeerebatepercent)
- [getMinReferralsToPayout()](#getminreferralstopayout)
- [getAffiliatesUserReferrer(address user)](#getaffiliatesuserreferrer)
- [getAffiliateRewardsHeld(address referrer)](#getaffiliaterewardsheld)
- [getAffiliateTradingTokenFeePercent()](#getaffiliatetradingtokenfeepercent)
- [getAffiliatesTokenRewardsValueInRbtc(address referrer)](#getaffiliatestokenrewardsvalueinrbtc)
- [getSwapExternalFeePercent()](#getswapexternalfeepercent)
- [setTradingRebateRewardsBasisPoint(uint256 newBasisPoint)](#settradingrebaterewardsbasispoint)
- [getTradingRebateRewardsBasisPoint()](#gettradingrebaterewardsbasispoint)
- [getDedicatedSOVRebate()](#getdedicatedsovrebate)
- [setRolloverFlexFeePercent(uint256 newRolloverFlexFeePercent)](#setrolloverflexfeepercent)
- [checkCloseWithDepositIsTinyPosition(bytes32 loanId, uint256 depositAmount)](#checkclosewithdepositistinyposition)

---    

> ### replaceContract

```solidity
function replaceContract(address target) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function replaceContract(address target) external;
```
</details>

---    

> ### setTargets

```solidity
function setTargets(string[] sigsArr, address[] targetsArr) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sigsArr | string[] |  | 
| targetsArr | address[] |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setTargets(string[] calldata sigsArr, address[] calldata targetsArr) external;
```
</details>

---    

> ### getTarget

```solidity
function getTarget(string sig) external view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sig | string |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getTarget(string calldata sig) external view returns (address);
```
</details>

---    

> ### setSovrynProtocolAddress

```solidity
function setSovrynProtocolAddress(address newProtocolAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newProtocolAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSovrynProtocolAddress(address newProtocolAddress) external;
```
</details>

---    

> ### setSOVTokenAddress

```solidity
function setSOVTokenAddress(address newSovTokenAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newSovTokenAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSOVTokenAddress(address newSovTokenAddress) external;
```
</details>

---    

> ### setLockedSOVAddress

```solidity
function setLockedSOVAddress(address newSOVLockedAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newSOVLockedAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setLockedSOVAddress(address newSOVLockedAddress) external;
```
</details>

---    

> ### setMinReferralsToPayoutAffiliates

```solidity
function setMinReferralsToPayoutAffiliates(uint256 newMinReferrals) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newMinReferrals | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setMinReferralsToPayoutAffiliates(uint256 newMinReferrals) external;
```
</details>

---    

> ### setPriceFeedContract

```solidity
function setPriceFeedContract(address newContract) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newContract | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setPriceFeedContract(address newContract) external;
```
</details>

---    

> ### setSwapsImplContract

```solidity
function setSwapsImplContract(address newContract) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newContract | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSwapsImplContract(address newContract) external;
```
</details>

---    

> ### setLoanPool

```solidity
function setLoanPool(address[] pools, address[] assets) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| pools | address[] |  | 
| assets | address[] |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setLoanPool(address[] calldata pools, address[] calldata assets) external;
```
</details>

---    

> ### setSupportedTokens

```solidity
function setSupportedTokens(address[] addrs, bool[] toggles) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| addrs | address[] |  | 
| toggles | bool[] |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSupportedTokens(address[] calldata addrs, bool[] calldata toggles) external;
```
</details>

---    

> ### setLendingFeePercent

```solidity
function setLendingFeePercent(uint256 newValue) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setLendingFeePercent(uint256 newValue) external;
```
</details>

---    

> ### setTradingFeePercent

```solidity
function setTradingFeePercent(uint256 newValue) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setTradingFeePercent(uint256 newValue) external;
```
</details>

---    

> ### setBorrowingFeePercent

```solidity
function setBorrowingFeePercent(uint256 newValue) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setBorrowingFeePercent(uint256 newValue) external;
```
</details>

---    

> ### setSwapExternalFeePercent

```solidity
function setSwapExternalFeePercent(uint256 newValue) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSwapExternalFeePercent(uint256 newValue) external;
```
</details>

---    

> ### setAffiliateFeePercent

```solidity
function setAffiliateFeePercent(uint256 newValue) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setAffiliateFeePercent(uint256 newValue) external;
```
</details>

---    

> ### setAffiliateTradingTokenFeePercent

```solidity
function setAffiliateTradingTokenFeePercent(uint256 newValue) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setAffiliateTradingTokenFeePercent(uint256 newValue) external;
```
</details>

---    

> ### setLiquidationIncentivePercent

```solidity
function setLiquidationIncentivePercent(uint256 newAmount) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setLiquidationIncentivePercent(uint256 newAmount) external;
```
</details>

---    

> ### setMaxDisagreement

```solidity
function setMaxDisagreement(uint256 newAmount) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setMaxDisagreement(uint256 newAmount) external;
```
</details>

---    

> ### setSourceBuffer

```solidity
function setSourceBuffer(uint256 newAmount) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSourceBuffer(uint256 newAmount) external;
```
</details>

---    

> ### setMaxSwapSize

```solidity
function setMaxSwapSize(uint256 newAmount) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setMaxSwapSize(uint256 newAmount) external;
```
</details>

---    

> ### setFeesController

```solidity
function setFeesController(address newController) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newController | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setFeesController(address newController) external;
```
</details>

---    

> ### withdrawLendingFees

```solidity
function withdrawLendingFees(address token, address receiver, uint256 amount) external nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address |  | 
| receiver | address |  | 
| amount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawLendingFees(
        address token,
        address receiver,
        uint256 amount
    ) external returns (bool);
```
</details>

---    

> ### withdrawTradingFees

```solidity
function withdrawTradingFees(address token, address receiver, uint256 amount) external nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address |  | 
| receiver | address |  | 
| amount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawTradingFees(
        address token,
        address receiver,
        uint256 amount
    ) external returns (bool);
```
</details>

---    

> ### withdrawBorrowingFees

```solidity
function withdrawBorrowingFees(address token, address receiver, uint256 amount) external nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address |  | 
| receiver | address |  | 
| amount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawBorrowingFees(
        address token,
        address receiver,
        uint256 amount
    ) external returns (bool);
```
</details>

---    

> ### withdrawProtocolToken

```solidity
function withdrawProtocolToken(address receiver, uint256 amount) external nonpayable
returns(address, bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| amount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawProtocolToken(address receiver, uint256 amount)
        external
        returns (address, bool);
```
</details>

---    

> ### depositProtocolToken

```solidity
function depositProtocolToken(uint256 amount) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function depositProtocolToken(uint256 amount) external;
```
</details>

---    

> ### getLoanPoolsList

```solidity
function getLoanPoolsList(uint256 start, uint256 count) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| start | uint256 |  | 
| count | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLoanPoolsList(uint256 start, uint256 count) external;
```
</details>

---    

> ### isLoanPool

```solidity
function isLoanPool(address loanPool) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanPool | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function isLoanPool(address loanPool) external view returns (bool);
```
</details>

---    

> ### setWrbtcToken

```solidity
function setWrbtcToken(address wrbtcTokenAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| wrbtcTokenAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setWrbtcToken(address wrbtcTokenAddress) external;
```
</details>

---    

> ### setSovrynSwapContractRegistryAddress

```solidity
function setSovrynSwapContractRegistryAddress(address registryAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| registryAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSovrynSwapContractRegistryAddress(address registryAddress) external;
```
</details>

---    

> ### setProtocolTokenAddress

```solidity
function setProtocolTokenAddress(address _protocolTokenAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _protocolTokenAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setProtocolTokenAddress(address _protocolTokenAddress) external;
```
</details>

---    

> ### setRolloverBaseReward

```solidity
function setRolloverBaseReward(uint256 transactionCost) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| transactionCost | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setRolloverBaseReward(uint256 transactionCost) external;
```
</details>

---    

> ### setRebatePercent

```solidity
function setRebatePercent(uint256 rebatePercent) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| rebatePercent | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setRebatePercent(uint256 rebatePercent) external;
```
</details>

---    

> ### setSpecialRebates

```solidity
function setSpecialRebates(address sourceToken, address destToken, uint256 specialRebatesPercent) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address |  | 
| destToken | address |  | 
| specialRebatesPercent | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSpecialRebates(
        address sourceToken,
        address destToken,
        uint256 specialRebatesPercent
    ) external;
```
</details>

---    

> ### getSpecialRebates

```solidity
function getSpecialRebates(address sourceToken, address destToken) external view
returns(specialRebatesPercent uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address |  | 
| destToken | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getSpecialRebates(address sourceToken, address destToken)
        external
        view
        returns (uint256 specialRebatesPercent);
```
</details>

---    

> ### togglePaused

```solidity
function togglePaused(bool paused) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| paused | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function togglePaused(bool paused) external;
```
</details>

---    

> ### isProtocolPaused

```solidity
function isProtocolPaused() external view
returns(bool)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function isProtocolPaused() external view returns (bool);
```
</details>

---    

> ### setupLoanParams

```solidity
function setupLoanParams(struct LoanParamsStruct.LoanParams[] loanParamsList) external nonpayable
returns(loanParamsIdList bytes32[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsList | struct LoanParamsStruct.LoanParams[] |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setupLoanParams(LoanParams[] calldata loanParamsList)
        external
        returns (bytes32[] memory loanParamsIdList);
```
</details>

---    

> ### disableLoanParams

```solidity
function disableLoanParams(bytes32[] loanParamsIdList) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsIdList | bytes32[] |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function disableLoanParams(bytes32[] calldata loanParamsIdList) external;
```
</details>

---    

> ### getLoanParams

```solidity
function getLoanParams(bytes32[] loanParamsIdList) external view
returns(loanParamsList struct LoanParamsStruct.LoanParams[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsIdList | bytes32[] |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLoanParams(bytes32[] calldata loanParamsIdList)
        external
        view
        returns (LoanParams[] memory loanParamsList);
```
</details>

---    

> ### getLoanParamsList

```solidity
function getLoanParamsList(address owner, uint256 start, uint256 count) external view
returns(loanParamsList bytes32[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| owner | address |  | 
| start | uint256 |  | 
| count | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLoanParamsList(
        address owner,
        uint256 start,
        uint256 count
    ) external view returns (bytes32[] memory loanParamsList);
```
</details>

---    

> ### getTotalPrincipal

```solidity
function getTotalPrincipal(address lender, address loanToken) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lender | address |  | 
| loanToken | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getTotalPrincipal(address lender, address loanToken) external view returns (uint256);
```
</details>

---    

> ### minInitialMargin

```solidity
function minInitialMargin(bytes32 loanParamsId) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsId | bytes32 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function minInitialMargin(bytes32 loanParamsId) external view returns (uint256);
```
</details>

---    

> ### borrowOrTradeFromPool

```solidity
function borrowOrTradeFromPool(bytes32 loanParamsId, bytes32 loanId, bool isTorqueLoan, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues, bytes loanDataBytes) external payable
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsId | bytes32 |  | 
| loanId | bytes32 |  | 
| isTorqueLoan | bool |  | 
| initialMargin | uint256 |  | 
| sentAddresses | address[4] |  | 
| sentValues | uint256[5] |  | 
| loanDataBytes | bytes |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function borrowOrTradeFromPool(
        bytes32 loanParamsId,
        bytes32 loanId, // if 0, start a new loan
        bool isTorqueLoan,
        uint256 initialMargin,
        address[4] calldata sentAddresses,
        // lender: must match loan if loanId provided
        // borrower: must match loan if loanId provided
        // receiver: receiver of funds (address(0) assumes borrower address)
        // manager: delegated manager of loan unless address(0)
        uint256[5] calldata sentValues,
        // newRate: new loan interest rate
        // newPrincipal: new loan size (borrowAmount + any borrowed interest)
        // torqueInterest: new amount of interest to escrow for Torque loan (determines initial loan length)
        // loanTokenReceived: total loanToken deposit (amount not sent to borrower in the case of Torque loans)
        // collateralTokenReceived: total collateralToken deposit
        bytes calldata loanDataBytes
    ) external payable returns (uint256);
```
</details>

---    

> ### setDelegatedManager

```solidity
function setDelegatedManager(bytes32 loanId, address delegated, bool toggle) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| delegated | address |  | 
| toggle | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setDelegatedManager(
        bytes32 loanId,
        address delegated,
        bool toggle
    ) external;
```
</details>

---    

> ### getEstimatedMarginExposure

```solidity
function getEstimatedMarginExposure(address loanToken, address collateralToken, uint256 loanTokenSent, uint256 collateralTokenSent, uint256 interestRate, uint256 newPrincipal) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address |  | 
| collateralToken | address |  | 
| loanTokenSent | uint256 |  | 
| collateralTokenSent | uint256 |  | 
| interestRate | uint256 |  | 
| newPrincipal | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getEstimatedMarginExposure(
        address loanToken,
        address collateralToken,
        uint256 loanTokenSent,
        uint256 collateralTokenSent,
        uint256 interestRate,
        uint256 newPrincipal
    ) external view returns (uint256);
```
</details>

---    

> ### getRequiredCollateral

```solidity
function getRequiredCollateral(address loanToken, address collateralToken, uint256 newPrincipal, uint256 marginAmount, bool isTorqueLoan) external view
returns(collateralAmountRequired uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address |  | 
| collateralToken | address |  | 
| newPrincipal | uint256 |  | 
| marginAmount | uint256 |  | 
| isTorqueLoan | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getRequiredCollateral(
        address loanToken,
        address collateralToken,
        uint256 newPrincipal,
        uint256 marginAmount,
        bool isTorqueLoan
    ) external view returns (uint256 collateralAmountRequired);
```
</details>

---    

> ### getBorrowAmount

```solidity
function getBorrowAmount(address loanToken, address collateralToken, uint256 collateralTokenAmount, uint256 marginAmount, bool isTorqueLoan) external view
returns(borrowAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address |  | 
| collateralToken | address |  | 
| collateralTokenAmount | uint256 |  | 
| marginAmount | uint256 |  | 
| isTorqueLoan | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getBorrowAmount(
        address loanToken,
        address collateralToken,
        uint256 collateralTokenAmount,
        uint256 marginAmount,
        bool isTorqueLoan
    ) external view returns (uint256 borrowAmount);
```
</details>

---    

> ### liquidate

```solidity
function liquidate(bytes32 loanId, address receiver, uint256 closeAmount) external payable
returns(loanCloseAmount uint256, seizedAmount uint256, seizedToken address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| receiver | address |  | 
| closeAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function liquidate(
        bytes32 loanId,
        address receiver,
        uint256 closeAmount // denominated in loanToken
    )
        external
        payable
        returns (
            uint256 loanCloseAmount,
            uint256 seizedAmount,
            address seizedToken
        );
```
</details>

---    

> ### rollover

```solidity
function rollover(bytes32 loanId, bytes loanDataBytes) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| loanDataBytes | bytes |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function rollover(bytes32 loanId, bytes calldata loanDataBytes) external;
```
</details>

---    

> ### closeWithDeposit

```solidity
function closeWithDeposit(bytes32 loanId, address receiver, uint256 depositAmount) external payable
returns(loanCloseAmount uint256, withdrawAmount uint256, withdrawToken address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| receiver | address |  | 
| depositAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function closeWithDeposit(
        bytes32 loanId,
        address receiver,
        uint256 depositAmount // denominated in loanToken
    )
        external
        payable
        returns (
            uint256 loanCloseAmount,
            uint256 withdrawAmount,
            address withdrawToken
        );
```
</details>

---    

> ### closeWithSwap

```solidity
function closeWithSwap(bytes32 loanId, address receiver, uint256 swapAmount, bool returnTokenIsCollateral, bytes loanDataBytes) external nonpayable
returns(loanCloseAmount uint256, withdrawAmount uint256, withdrawToken address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| receiver | address |  | 
| swapAmount | uint256 |  | 
| returnTokenIsCollateral | bool |  | 
| loanDataBytes | bytes |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function closeWithSwap(
        bytes32 loanId,
        address receiver,
        uint256 swapAmount, // denominated in collateralToken
        bool returnTokenIsCollateral, // true: withdraws collateralToken, false: withdraws loanToken
        bytes calldata loanDataBytes
    )
        external
        returns (
            uint256 loanCloseAmount,
            uint256 withdrawAmount,
            address withdrawToken
        );
```
</details>

---    

> ### depositCollateral

```solidity
function depositCollateral(bytes32 loanId, uint256 depositAmount) external payable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| depositAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function depositCollateral(
        bytes32 loanId,
        uint256 depositAmount // must match msg.value if ether is sent
    ) external payable;
```
</details>

---    

> ### withdrawCollateral

```solidity
function withdrawCollateral(bytes32 loanId, address receiver, uint256 withdrawAmount) external nonpayable
returns(actualWithdrawAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| receiver | address |  | 
| withdrawAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawCollateral(
        bytes32 loanId,
        address receiver,
        uint256 withdrawAmount
    ) external returns (uint256 actualWithdrawAmount);
```
</details>

---    

> ### extendLoanByInterest

```solidity
function extendLoanByInterest(bytes32 loanId, address payer, uint256 depositAmount, bool useCollateral, bytes loanDataBytes) external payable
returns(secondsExtended uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| payer | address |  | 
| depositAmount | uint256 |  | 
| useCollateral | bool |  | 
| loanDataBytes | bytes |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function extendLoanByInterest(
        bytes32 loanId,
        address payer,
        uint256 depositAmount,
        bool useCollateral,
        bytes calldata loanDataBytes
    ) external payable returns (uint256 secondsExtended);
```
</details>

---    

> ### reduceLoanByInterest

```solidity
function reduceLoanByInterest(bytes32 loanId, address receiver, uint256 withdrawAmount) external nonpayable
returns(secondsReduced uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| receiver | address |  | 
| withdrawAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function reduceLoanByInterest(
        bytes32 loanId,
        address receiver,
        uint256 withdrawAmount
    ) external returns (uint256 secondsReduced);
```
</details>

---    

> ### withdrawAccruedInterest

```solidity
function withdrawAccruedInterest(address loanToken) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawAccruedInterest(address loanToken) external;
```
</details>

---    

> ### getLenderInterestData

```solidity
function getLenderInterestData(address lender, address loanToken) external view
returns(interestPaid uint256, interestPaidDate uint256, interestOwedPerDay uint256, interestUnPaid uint256, interestFeePercent uint256, principalTotal uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lender | address |  | 
| loanToken | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLenderInterestData(address lender, address loanToken)
        external
        view
        returns (
            uint256 interestPaid,
            uint256 interestPaidDate,
            uint256 interestOwedPerDay,
            uint256 interestUnPaid,
            uint256 interestFeePercent,
            uint256 principalTotal
        );
```
</details>

---    

> ### getLoanInterestData

```solidity
function getLoanInterestData(bytes32 loanId) external view
returns(loanToken address, interestOwedPerDay uint256, interestDepositTotal uint256, interestDepositRemaining uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLoanInterestData(bytes32 loanId)
        external
        view
        returns (
            address loanToken,
            uint256 interestOwedPerDay,
            uint256 interestDepositTotal,
            uint256 interestDepositRemaining
        );
```
</details>

---    

> ### getUserLoans

```solidity
function getUserLoans(address user, uint256 start, uint256 count, uint256 loanType, bool isLender, bool unsafeOnly) external view
returns(loansData struct ISovryn.LoanReturnData[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address |  | 
| start | uint256 |  | 
| count | uint256 |  | 
| loanType | uint256 |  | 
| isLender | bool |  | 
| unsafeOnly | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUserLoans(
        address user,
        uint256 start,
        uint256 count,
        uint256 loanType,
        bool isLender,
        bool unsafeOnly
    ) external view returns (LoanReturnData[] memory loansData);
```
</details>

---    

> ### getUserLoansV2

```solidity
function getUserLoansV2(address user, uint256 start, uint256 count, uint256 loanType, bool isLender, bool unsafeOnly) external view
returns(loansDataV2 struct ISovryn.LoanReturnDataV2[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address |  | 
| start | uint256 |  | 
| count | uint256 |  | 
| loanType | uint256 |  | 
| isLender | bool |  | 
| unsafeOnly | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUserLoansV2(
        address user,
        uint256 start,
        uint256 count,
        uint256 loanType,
        bool isLender,
        bool unsafeOnly
    ) external view returns (LoanReturnDataV2[] memory loansDataV2);
```
</details>

---    

> ### getLoan

```solidity
function getLoan(bytes32 loanId) external view
returns(loanData struct ISovryn.LoanReturnData)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLoan(bytes32 loanId) external view returns (LoanReturnData memory loanData);
```
</details>

---    

> ### getLoanV2

```solidity
function getLoanV2(bytes32 loanId) external view
returns(loanDataV2 struct ISovryn.LoanReturnDataV2)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLoanV2(bytes32 loanId) external view returns (LoanReturnDataV2 memory loanDataV2);
```
</details>

---    

> ### getActiveLoans

```solidity
function getActiveLoans(uint256 start, uint256 count, bool unsafeOnly) external view
returns(loansData struct ISovryn.LoanReturnData[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| start | uint256 |  | 
| count | uint256 |  | 
| unsafeOnly | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getActiveLoans(
        uint256 start,
        uint256 count,
        bool unsafeOnly
    ) external view returns (LoanReturnData[] memory loansData);
```
</details>

---    

> ### getActiveLoansV2

```solidity
function getActiveLoansV2(uint256 start, uint256 count, bool unsafeOnly) external view
returns(loansDataV2 struct ISovryn.LoanReturnDataV2[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| start | uint256 |  | 
| count | uint256 |  | 
| unsafeOnly | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getActiveLoansV2(
        uint256 start,
        uint256 count,
        bool unsafeOnly
    ) external view returns (LoanReturnDataV2[] memory loansDataV2);
```
</details>

---    

> ### setLegacyOracles

```solidity
function setLegacyOracles(address[] refs, address[] oracles) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| refs | address[] |  | 
| oracles | address[] |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setLegacyOracles(address[] calldata refs, address[] calldata oracles) external;
```
</details>

---    

> ### getLegacyOracle

```solidity
function getLegacyOracle(address ref) external view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ref | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLegacyOracle(address ref) external view returns (address);
```
</details>

---    

> ### swapExternal

```solidity
function swapExternal(address sourceToken, address destToken, address receiver, address returnToSender, uint256 sourceTokenAmount, uint256 requiredDestTokenAmount, uint256 minReturn, bytes swapData) external nonpayable
returns(destTokenAmountReceived uint256, sourceTokenAmountUsed uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address |  | 
| destToken | address |  | 
| receiver | address |  | 
| returnToSender | address |  | 
| sourceTokenAmount | uint256 |  | 
| requiredDestTokenAmount | uint256 |  | 
| minReturn | uint256 |  | 
| swapData | bytes |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function swapExternal(
        address sourceToken,
        address destToken,
        address receiver,
        address returnToSender,
        uint256 sourceTokenAmount,
        uint256 requiredDestTokenAmount,
        uint256 minReturn,
        bytes calldata swapData
    ) external returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed);
```
</details>

---    

> ### getSwapExpectedReturn

```solidity
function getSwapExpectedReturn(address sourceToken, address destToken, uint256 sourceTokenAmount) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address |  | 
| destToken | address |  | 
| sourceTokenAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getSwapExpectedReturn(
        address sourceToken,
        address destToken,
        uint256 sourceTokenAmount
    ) external view returns (uint256);
```
</details>

---    

> ### checkPriceDivergence

```solidity
function checkPriceDivergence(address sourceToken, address destToken, uint256 sourceTokenAmount, uint256 minReturn) public view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address |  | 
| destToken | address |  | 
| sourceTokenAmount | uint256 |  | 
| minReturn | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function checkPriceDivergence(
        address sourceToken,
        address destToken,
        uint256 sourceTokenAmount,
        uint256 minReturn
    ) public view;
```
</details>

---    

> ### getUserNotFirstTradeFlag

```solidity
function getUserNotFirstTradeFlag(address user) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUserNotFirstTradeFlag(address user) external view returns (bool);
```
</details>

---    

> ### setUserNotFirstTradeFlag

```solidity
function setUserNotFirstTradeFlag(address user) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setUserNotFirstTradeFlag(address user) external view returns (bool);
```
</details>

---    

> ### payTradingFeeToAffiliatesReferrer

```solidity
function payTradingFeeToAffiliatesReferrer(address referrer, address trader, address token, uint256 tradingFeeTokenBaseAmount) external nonpayable
returns(affiliatesBonusSOVAmount uint256, affiliatesBonusTokenAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address |  | 
| trader | address |  | 
| token | address |  | 
| tradingFeeTokenBaseAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function payTradingFeeToAffiliatesReferrer(
        address referrer,
        address trader,
        address token,
        uint256 tradingFeeTokenBaseAmount
    ) external returns (uint256 affiliatesBonusSOVAmount, uint256 affiliatesBonusTokenAmount);
```
</details>

---    

> ### setAffiliatesReferrer

```solidity
function setAffiliatesReferrer(address user, address referrer) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address |  | 
| referrer | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setAffiliatesReferrer(address user, address referrer) external;
```
</details>

---    

> ### getReferralsList

```solidity
function getReferralsList(address referrer) external view
returns(refList address[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getReferralsList(address referrer) external view returns (address[] memory refList);
```
</details>

---    

> ### getAffiliatesReferrerBalances

```solidity
function getAffiliatesReferrerBalances(address referrer) external view
returns(referrerTokensList address[], referrerTokensBalances uint256[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getAffiliatesReferrerBalances(address referrer)
        external
        view
        returns (address[] memory referrerTokensList, uint256[] memory referrerTokensBalances);
```
</details>

---    

> ### getAffiliatesReferrerTokensList

```solidity
function getAffiliatesReferrerTokensList(address referrer) external view
returns(tokensList address[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getAffiliatesReferrerTokensList(address referrer)
        external
        view
        returns (address[] memory tokensList);
```
</details>

---    

> ### getAffiliatesReferrerTokenBalance

```solidity
function getAffiliatesReferrerTokenBalance(address referrer, address token) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address |  | 
| token | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getAffiliatesReferrerTokenBalance(address referrer, address token)
        external
        view
        returns (uint256);
```
</details>

---    

> ### withdrawAffiliatesReferrerTokenFees

```solidity
function withdrawAffiliatesReferrerTokenFees(address token, address receiver, uint256 amount) external nonpayable
returns(withdrawAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address |  | 
| receiver | address |  | 
| amount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawAffiliatesReferrerTokenFees(
        address token,
        address receiver,
        uint256 amount
    ) external returns (uint256 withdrawAmount);
```
</details>

---    

> ### withdrawAllAffiliatesReferrerTokenFees

```solidity
function withdrawAllAffiliatesReferrerTokenFees(address receiver) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawAllAffiliatesReferrerTokenFees(address receiver) external;
```
</details>

---    

> ### getProtocolAddress

```solidity
function getProtocolAddress() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getProtocolAddress() external view returns (address);
```
</details>

---    

> ### getSovTokenAddress

```solidity
function getSovTokenAddress() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getSovTokenAddress() external view returns (address);
```
</details>

---    

> ### getLockedSOVAddress

```solidity
function getLockedSOVAddress() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLockedSOVAddress() external view returns (address);
```
</details>

---    

> ### getFeeRebatePercent

```solidity
function getFeeRebatePercent() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getFeeRebatePercent() external view returns (uint256);
```
</details>

---    

> ### getMinReferralsToPayout

```solidity
function getMinReferralsToPayout() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getMinReferralsToPayout() external view returns (uint256);
```
</details>

---    

> ### getAffiliatesUserReferrer

```solidity
function getAffiliatesUserReferrer(address user) external view
returns(referrer address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getAffiliatesUserReferrer(address user) external view returns (address referrer);
```
</details>

---    

> ### getAffiliateRewardsHeld

```solidity
function getAffiliateRewardsHeld(address referrer) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getAffiliateRewardsHeld(address referrer) external view returns (uint256);
```
</details>

---    

> ### getAffiliateTradingTokenFeePercent

```solidity
function getAffiliateTradingTokenFeePercent() external view
returns(affiliateTradingTokenFeePercent uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getAffiliateTradingTokenFeePercent()
        external
        view
        returns (uint256 affiliateTradingTokenFeePercent);
```
</details>

---    

> ### getAffiliatesTokenRewardsValueInRbtc

```solidity
function getAffiliatesTokenRewardsValueInRbtc(address referrer) external view
returns(rbtcTotalAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getAffiliatesTokenRewardsValueInRbtc(address referrer)
        external
        view
        returns (uint256 rbtcTotalAmount);
```
</details>

---    

> ### getSwapExternalFeePercent

```solidity
function getSwapExternalFeePercent() external view
returns(swapExternalFeePercent uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getSwapExternalFeePercent() external view returns (uint256 swapExternalFeePercent);
```
</details>

---    

> ### setTradingRebateRewardsBasisPoint

```solidity
function setTradingRebateRewardsBasisPoint(uint256 newBasisPoint) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newBasisPoint | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setTradingRebateRewardsBasisPoint(uint256 newBasisPoint) external;
```
</details>

---    

> ### getTradingRebateRewardsBasisPoint

```solidity
function getTradingRebateRewardsBasisPoint() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getTradingRebateRewardsBasisPoint() external view returns (uint256);
```
</details>

---    

> ### getDedicatedSOVRebate

```solidity
function getDedicatedSOVRebate() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getDedicatedSOVRebate() external view returns (uint256);
```
</details>

---    

> ### setRolloverFlexFeePercent

```solidity
function setRolloverFlexFeePercent(uint256 newRolloverFlexFeePercent) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newRolloverFlexFeePercent | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setRolloverFlexFeePercent(uint256 newRolloverFlexFeePercent) external;
```
</details>

---    

> ### checkCloseWithDepositIsTinyPosition

```solidity
function checkCloseWithDepositIsTinyPosition(bytes32 loanId, uint256 depositAmount) external view
returns(isTinyPosition bool, tinyPositionAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| depositAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function checkCloseWithDepositIsTinyPosition(bytes32 loanId, uint256 depositAmount)
        external
        view
        returns (bool isTinyPosition, uint256 tinyPositionAmount);
```
</details>

## Contracts

* [Address](Address.md)
* [Administered](Administered.md)
* [AdminRole](AdminRole.md)
* [AdvancedToken](AdvancedToken.md)
* [AdvancedTokenStorage](AdvancedTokenStorage.md)
* [Affiliates](Affiliates.md)
* [AffiliatesEvents](AffiliatesEvents.md)
* [ApprovalReceiver](ApprovalReceiver.md)
* [BProPriceFeed](BProPriceFeed.md)
* [Checkpoints](Checkpoints.md)
* [Constants](Constants.md)
* [Context](Context.md)
* [DevelopmentFund](DevelopmentFund.md)
* [DummyContract](DummyContract.md)
* [ECDSA](ECDSA.md)
* [EnumerableAddressSet](EnumerableAddressSet.md)
* [EnumerableBytes32Set](EnumerableBytes32Set.md)
* [EnumerableBytes4Set](EnumerableBytes4Set.md)
* [ERC20](ERC20.md)
* [ERC20Detailed](ERC20Detailed.md)
* [ErrorDecoder](ErrorDecoder.md)
* [Escrow](Escrow.md)
* [EscrowReward](EscrowReward.md)
* [FeedsLike](FeedsLike.md)
* [FeesEvents](FeesEvents.md)
* [FeeSharingLogic](FeeSharingLogic.md)
* [FeeSharingProxy](FeeSharingProxy.md)
* [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
* [FeesHelper](FeesHelper.md)
* [FourYearVesting](FourYearVesting.md)
* [FourYearVestingFactory](FourYearVestingFactory.md)
* [FourYearVestingLogic](FourYearVestingLogic.md)
* [FourYearVestingStorage](FourYearVestingStorage.md)
* [GenericTokenSender](GenericTokenSender.md)
* [GovernorAlpha](GovernorAlpha.md)
* [GovernorVault](GovernorVault.md)
* [IApproveAndCall](IApproveAndCall.md)
* [IChai](IChai.md)
* [IContractRegistry](IContractRegistry.md)
* [IConverterAMM](IConverterAMM.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IFeeSharingProxy](IFeeSharingProxy.md)
* [IFourYearVesting](IFourYearVesting.md)
* [IFourYearVestingFactory](IFourYearVestingFactory.md)
* [ILiquidityMining](ILiquidityMining.md)
* [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
* [ILoanPool](ILoanPool.md)
* [ILoanToken](ILoanToken.md)
* [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
* [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
* [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
* [ILoanTokenModules](ILoanTokenModules.md)
* [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
* [ILockedSOV](ILockedSOV.md)
* [IMoCState](IMoCState.md)
* [Initializable](Initializable.md)
* [InterestUser](InterestUser.md)
* [IPot](IPot.md)
* [IPriceFeeds](IPriceFeeds.md)
* [IPriceFeedsExt](IPriceFeedsExt.md)
* [IProtocol](IProtocol.md)
* [IRSKOracle](IRSKOracle.md)
* [ISovryn](ISovryn.md)
* [ISovrynSwapNetwork](ISovrynSwapNetwork.md)
* [IStaking](IStaking.md)
* [ISwapsImpl](ISwapsImpl.md)
* [ITeamVesting](ITeamVesting.md)
* [ITimelock](ITimelock.md)
* [IV1PoolOracle](IV1PoolOracle.md)
* [IVesting](IVesting.md)
* [IVestingFactory](IVestingFactory.md)
* [IVestingRegistry](IVestingRegistry.md)
* [IWrbtc](IWrbtc.md)
* [IWrbtcERC20](IWrbtcERC20.md)
* [LenderInterestStruct](LenderInterestStruct.md)
* [LiquidationHelper](LiquidationHelper.md)
* [LiquidityMining](LiquidityMining.md)
* [LiquidityMiningConfigToken](LiquidityMiningConfigToken.md)
* [LiquidityMiningProxy](LiquidityMiningProxy.md)
* [LiquidityMiningStorage](LiquidityMiningStorage.md)
* [LoanClosingsEvents](LoanClosingsEvents.md)
* [LoanClosingsLiquidation](LoanClosingsLiquidation.md)
* [LoanClosingsRollover](LoanClosingsRollover.md)
* [LoanClosingsShared](LoanClosingsShared.md)
* [LoanClosingsWith](LoanClosingsWith.md)
* [LoanInterestStruct](LoanInterestStruct.md)
* [LoanMaintenance](LoanMaintenance.md)
* [LoanMaintenanceEvents](LoanMaintenanceEvents.md)
* [LoanOpenings](LoanOpenings.md)
* [LoanOpeningsEvents](LoanOpeningsEvents.md)
* [LoanParamsStruct](LoanParamsStruct.md)
* [LoanSettings](LoanSettings.md)
* [LoanSettingsEvents](LoanSettingsEvents.md)
* [LoanStruct](LoanStruct.md)
* [LoanToken](LoanToken.md)
* [LoanTokenBase](LoanTokenBase.md)
* [LoanTokenLogicBeacon](LoanTokenLogicBeacon.md)
* [LoanTokenLogicLM](LoanTokenLogicLM.md)
* [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
* [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
* [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
* [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
* [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
* [LockedSOV](LockedSOV.md)
* [Medianizer](Medianizer.md)
* [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
* [ModulesCommonEvents](ModulesCommonEvents.md)
* [MultiSigKeyHolders](MultiSigKeyHolders.md)
* [MultiSigWallet](MultiSigWallet.md)
* [Objects](Objects.md)
* [OrderStruct](OrderStruct.md)
* [OrigingVestingCreator](OrigingVestingCreator.md)
* [OriginInvestorsClaim](OriginInvestorsClaim.md)
* [Ownable](Ownable.md)
* [Pausable](Pausable.md)
* [PausableOz](PausableOz.md)
* [PreviousLoanToken](PreviousLoanToken.md)
* [PreviousLoanTokenSettingsLowerAdmin](PreviousLoanTokenSettingsLowerAdmin.md)
* [PriceFeedRSKOracle](PriceFeedRSKOracle.md)
* [PriceFeeds](PriceFeeds.md)
* [PriceFeedsLocal](PriceFeedsLocal.md)
* [PriceFeedsMoC](PriceFeedsMoC.md)
* [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
* [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
* [ProtocolLike](ProtocolLike.md)
* [ProtocolSettings](ProtocolSettings.md)
* [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
* [ProtocolSettingsLike](ProtocolSettingsLike.md)
* [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
* [ProtocolTokenUser](ProtocolTokenUser.md)
* [Proxy](Proxy.md)
* [ReentrancyGuard](ReentrancyGuard.md)
* [RewardHelper](RewardHelper.md)
* [RSKAddrValidator](RSKAddrValidator.md)
* [SafeERC20](SafeERC20.md)
* [SafeMath](SafeMath.md)
* [SafeMath96](SafeMath96.md)
* [setGet](setGet.md)
* [SignedSafeMath](SignedSafeMath.md)
* [SOV](SOV.md)
* [sovrynProtocol](sovrynProtocol.md)
* [Staking](Staking.md)
* [StakingInterface](StakingInterface.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingStorage](StakingStorage.md)
* [State](State.md)
* [SVR](SVR.md)
* [SwapsEvents](SwapsEvents.md)
* [SwapsExternal](SwapsExternal.md)
* [SwapsImplLocal](SwapsImplLocal.md)
* [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
* [SwapsUser](SwapsUser.md)
* [TeamVesting](TeamVesting.md)
* [Timelock](Timelock.md)
* [TimelockHarness](TimelockHarness.md)
* [TimelockInterface](TimelockInterface.md)
* [TokenSender](TokenSender.md)
* [UpgradableProxy](UpgradableProxy.md)
* [USDTPriceFeed](USDTPriceFeed.md)
* [VaultController](VaultController.md)
* [Vesting](Vesting.md)
* [VestingCreator](VestingCreator.md)
* [VestingFactory](VestingFactory.md)
* [VestingLogic](VestingLogic.md)
* [VestingRegistry](VestingRegistry.md)
* [VestingRegistry2](VestingRegistry2.md)
* [VestingRegistry3](VestingRegistry3.md)
* [VestingRegistryLogic](VestingRegistryLogic.md)
* [VestingRegistryProxy](VestingRegistryProxy.md)
* [VestingRegistryStorage](VestingRegistryStorage.md)
* [VestingStorage](VestingStorage.md)
* [WeightedStaking](WeightedStaking.md)
* [WRBTC](WRBTC.md)
