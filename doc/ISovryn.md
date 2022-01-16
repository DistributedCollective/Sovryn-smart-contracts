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
- [getLoan(bytes32 loanId)](#getloan)
- [getActiveLoans(uint256 start, uint256 count, bool unsafeOnly)](#getactiveloans)
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

### replaceContract

```js
function replaceContract(address target) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address |  | 

### setTargets

```js
function setTargets(string[] sigsArr, address[] targetsArr) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sigsArr | string[] |  | 
| targetsArr | address[] |  | 

### getTarget

```js
function getTarget(string sig) external view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sig | string |  | 

### setSovrynProtocolAddress

```js
function setSovrynProtocolAddress(address newProtocolAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newProtocolAddress | address |  | 

### setSOVTokenAddress

```js
function setSOVTokenAddress(address newSovTokenAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newSovTokenAddress | address |  | 

### setLockedSOVAddress

```js
function setLockedSOVAddress(address newSOVLockedAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newSOVLockedAddress | address |  | 

### setMinReferralsToPayoutAffiliates

```js
function setMinReferralsToPayoutAffiliates(uint256 newMinReferrals) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newMinReferrals | uint256 |  | 

### setPriceFeedContract

```js
function setPriceFeedContract(address newContract) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newContract | address |  | 

### setSwapsImplContract

```js
function setSwapsImplContract(address newContract) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newContract | address |  | 

### setLoanPool

```js
function setLoanPool(address[] pools, address[] assets) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| pools | address[] |  | 
| assets | address[] |  | 

### setSupportedTokens

```js
function setSupportedTokens(address[] addrs, bool[] toggles) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| addrs | address[] |  | 
| toggles | bool[] |  | 

### setLendingFeePercent

```js
function setLendingFeePercent(uint256 newValue) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 |  | 

### setTradingFeePercent

```js
function setTradingFeePercent(uint256 newValue) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 |  | 

### setBorrowingFeePercent

```js
function setBorrowingFeePercent(uint256 newValue) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 |  | 

### setSwapExternalFeePercent

```js
function setSwapExternalFeePercent(uint256 newValue) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 |  | 

### setAffiliateFeePercent

```js
function setAffiliateFeePercent(uint256 newValue) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 |  | 

### setAffiliateTradingTokenFeePercent

```js
function setAffiliateTradingTokenFeePercent(uint256 newValue) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 |  | 

### setLiquidationIncentivePercent

```js
function setLiquidationIncentivePercent(uint256 newAmount) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newAmount | uint256 |  | 

### setMaxDisagreement

```js
function setMaxDisagreement(uint256 newAmount) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newAmount | uint256 |  | 

### setSourceBuffer

```js
function setSourceBuffer(uint256 newAmount) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newAmount | uint256 |  | 

### setMaxSwapSize

```js
function setMaxSwapSize(uint256 newAmount) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newAmount | uint256 |  | 

### setFeesController

```js
function setFeesController(address newController) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newController | address |  | 

### withdrawLendingFees

```js
function withdrawLendingFees(address token, address receiver, uint256 amount) external nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address |  | 
| receiver | address |  | 
| amount | uint256 |  | 

### withdrawTradingFees

```js
function withdrawTradingFees(address token, address receiver, uint256 amount) external nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address |  | 
| receiver | address |  | 
| amount | uint256 |  | 

### withdrawBorrowingFees

```js
function withdrawBorrowingFees(address token, address receiver, uint256 amount) external nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address |  | 
| receiver | address |  | 
| amount | uint256 |  | 

### withdrawProtocolToken

```js
function withdrawProtocolToken(address receiver, uint256 amount) external nonpayable
returns(address, bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| amount | uint256 |  | 

### depositProtocolToken

```js
function depositProtocolToken(uint256 amount) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint256 |  | 

### getLoanPoolsList

```js
function getLoanPoolsList(uint256 start, uint256 count) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| start | uint256 |  | 
| count | uint256 |  | 

### isLoanPool

```js
function isLoanPool(address loanPool) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanPool | address |  | 

### setWrbtcToken

```js
function setWrbtcToken(address wrbtcTokenAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| wrbtcTokenAddress | address |  | 

### setSovrynSwapContractRegistryAddress

```js
function setSovrynSwapContractRegistryAddress(address registryAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| registryAddress | address |  | 

### setProtocolTokenAddress

```js
function setProtocolTokenAddress(address _protocolTokenAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _protocolTokenAddress | address |  | 

### setRolloverBaseReward

```js
function setRolloverBaseReward(uint256 transactionCost) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| transactionCost | uint256 |  | 

### setRebatePercent

```js
function setRebatePercent(uint256 rebatePercent) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| rebatePercent | uint256 |  | 

### setSpecialRebates

```js
function setSpecialRebates(address sourceToken, address destToken, uint256 specialRebatesPercent) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address |  | 
| destToken | address |  | 
| specialRebatesPercent | uint256 |  | 

### getSpecialRebates

```js
function getSpecialRebates(address sourceToken, address destToken) external view
returns(specialRebatesPercent uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address |  | 
| destToken | address |  | 

### togglePaused

```js
function togglePaused(bool paused) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| paused | bool |  | 

### isProtocolPaused

```js
function isProtocolPaused() external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### setupLoanParams

```js
function setupLoanParams(struct LoanParamsStruct.LoanParams[] loanParamsList) external nonpayable
returns(loanParamsIdList bytes32[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsList | struct LoanParamsStruct.LoanParams[] |  | 

### disableLoanParams

```js
function disableLoanParams(bytes32[] loanParamsIdList) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsIdList | bytes32[] |  | 

### getLoanParams

```js
function getLoanParams(bytes32[] loanParamsIdList) external view
returns(loanParamsList struct LoanParamsStruct.LoanParams[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsIdList | bytes32[] |  | 

### getLoanParamsList

```js
function getLoanParamsList(address owner, uint256 start, uint256 count) external view
returns(loanParamsList bytes32[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| owner | address |  | 
| start | uint256 |  | 
| count | uint256 |  | 

### getTotalPrincipal

```js
function getTotalPrincipal(address lender, address loanToken) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lender | address |  | 
| loanToken | address |  | 

### minInitialMargin

```js
function minInitialMargin(bytes32 loanParamsId) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsId | bytes32 |  | 

### borrowOrTradeFromPool

```js
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

### setDelegatedManager

```js
function setDelegatedManager(bytes32 loanId, address delegated, bool toggle) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| delegated | address |  | 
| toggle | bool |  | 

### getEstimatedMarginExposure

```js
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

### getRequiredCollateral

```js
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

### getBorrowAmount

```js
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

### liquidate

```js
function liquidate(bytes32 loanId, address receiver, uint256 closeAmount) external payable
returns(loanCloseAmount uint256, seizedAmount uint256, seizedToken address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| receiver | address |  | 
| closeAmount | uint256 |  | 

### rollover

```js
function rollover(bytes32 loanId, bytes loanDataBytes) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| loanDataBytes | bytes |  | 

### closeWithDeposit

```js
function closeWithDeposit(bytes32 loanId, address receiver, uint256 depositAmount) external payable
returns(loanCloseAmount uint256, withdrawAmount uint256, withdrawToken address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| receiver | address |  | 
| depositAmount | uint256 |  | 

### closeWithSwap

```js
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

### depositCollateral

```js
function depositCollateral(bytes32 loanId, uint256 depositAmount) external payable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| depositAmount | uint256 |  | 

### withdrawCollateral

```js
function withdrawCollateral(bytes32 loanId, address receiver, uint256 withdrawAmount) external nonpayable
returns(actualWithdrawAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| receiver | address |  | 
| withdrawAmount | uint256 |  | 

### extendLoanByInterest

```js
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

### reduceLoanByInterest

```js
function reduceLoanByInterest(bytes32 loanId, address receiver, uint256 withdrawAmount) external nonpayable
returns(secondsReduced uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| receiver | address |  | 
| withdrawAmount | uint256 |  | 

### withdrawAccruedInterest

```js
function withdrawAccruedInterest(address loanToken) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address |  | 

### getLenderInterestData

```js
function getLenderInterestData(address lender, address loanToken) external view
returns(interestPaid uint256, interestPaidDate uint256, interestOwedPerDay uint256, interestUnPaid uint256, interestFeePercent uint256, principalTotal uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lender | address |  | 
| loanToken | address |  | 

### getLoanInterestData

```js
function getLoanInterestData(bytes32 loanId) external view
returns(loanToken address, interestOwedPerDay uint256, interestDepositTotal uint256, interestDepositRemaining uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 

### getUserLoans

```js
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

### getLoan

```js
function getLoan(bytes32 loanId) external view
returns(loanData struct ISovryn.LoanReturnData)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 

### getActiveLoans

```js
function getActiveLoans(uint256 start, uint256 count, bool unsafeOnly) external view
returns(loansData struct ISovryn.LoanReturnData[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| start | uint256 |  | 
| count | uint256 |  | 
| unsafeOnly | bool |  | 

### setLegacyOracles

```js
function setLegacyOracles(address[] refs, address[] oracles) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| refs | address[] |  | 
| oracles | address[] |  | 

### getLegacyOracle

```js
function getLegacyOracle(address ref) external view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ref | address |  | 

### swapExternal

```js
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

### getSwapExpectedReturn

```js
function getSwapExpectedReturn(address sourceToken, address destToken, uint256 sourceTokenAmount) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address |  | 
| destToken | address |  | 
| sourceTokenAmount | uint256 |  | 

### checkPriceDivergence

```js
function checkPriceDivergence(address sourceToken, address destToken, uint256 sourceTokenAmount, uint256 minReturn) public view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address |  | 
| destToken | address |  | 
| sourceTokenAmount | uint256 |  | 
| minReturn | uint256 |  | 

### getUserNotFirstTradeFlag

```js
function getUserNotFirstTradeFlag(address user) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address |  | 

### setUserNotFirstTradeFlag

```js
function setUserNotFirstTradeFlag(address user) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address |  | 

### payTradingFeeToAffiliatesReferrer

```js
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

### setAffiliatesReferrer

```js
function setAffiliatesReferrer(address user, address referrer) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address |  | 
| referrer | address |  | 

### getReferralsList

```js
function getReferralsList(address referrer) external view
returns(refList address[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address |  | 

### getAffiliatesReferrerBalances

```js
function getAffiliatesReferrerBalances(address referrer) external view
returns(referrerTokensList address[], referrerTokensBalances uint256[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address |  | 

### getAffiliatesReferrerTokensList

```js
function getAffiliatesReferrerTokensList(address referrer) external view
returns(tokensList address[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address |  | 

### getAffiliatesReferrerTokenBalance

```js
function getAffiliatesReferrerTokenBalance(address referrer, address token) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address |  | 
| token | address |  | 

### withdrawAffiliatesReferrerTokenFees

```js
function withdrawAffiliatesReferrerTokenFees(address token, address receiver, uint256 amount) external nonpayable
returns(withdrawAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address |  | 
| receiver | address |  | 
| amount | uint256 |  | 

### withdrawAllAffiliatesReferrerTokenFees

```js
function withdrawAllAffiliatesReferrerTokenFees(address receiver) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 

### getProtocolAddress

```js
function getProtocolAddress() external view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### getSovTokenAddress

```js
function getSovTokenAddress() external view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### getLockedSOVAddress

```js
function getLockedSOVAddress() external view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### getFeeRebatePercent

```js
function getFeeRebatePercent() external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### getMinReferralsToPayout

```js
function getMinReferralsToPayout() external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### getAffiliatesUserReferrer

```js
function getAffiliatesUserReferrer(address user) external view
returns(referrer address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address |  | 

### getAffiliateRewardsHeld

```js
function getAffiliateRewardsHeld(address referrer) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address |  | 

### getAffiliateTradingTokenFeePercent

```js
function getAffiliateTradingTokenFeePercent() external view
returns(affiliateTradingTokenFeePercent uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### getAffiliatesTokenRewardsValueInRbtc

```js
function getAffiliatesTokenRewardsValueInRbtc(address referrer) external view
returns(rbtcTotalAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address |  | 

### getSwapExternalFeePercent

```js
function getSwapExternalFeePercent() external view
returns(swapExternalFeePercent uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### setTradingRebateRewardsBasisPoint

```js
function setTradingRebateRewardsBasisPoint(uint256 newBasisPoint) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newBasisPoint | uint256 |  | 

### getTradingRebateRewardsBasisPoint

```js
function getTradingRebateRewardsBasisPoint() external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### getDedicatedSOVRebate

```js
function getDedicatedSOVRebate() external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

## Contracts

* [Address](Address.md)
* [Administered](Administered.md)
* [AdminRole](AdminRole.md)
* [AdvancedToken](AdvancedToken.md)
* [AdvancedTokenStorage](AdvancedTokenStorage.md)
* [Affiliates](Affiliates.md)
* [AffiliatesEvents](AffiliatesEvents.md)
* [ApprovalReceiver](ApprovalReceiver.md)
* [BlockMockUp](BlockMockUp.md)
* [BProPriceFeed](BProPriceFeed.md)
* [BProPriceFeedMockup](BProPriceFeedMockup.md)
* [Checkpoints](Checkpoints.md)
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
* [FeeSharingProxyMockup](FeeSharingProxyMockup.md)
* [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
* [FeesHelper](FeesHelper.md)
* [FlashLoanerTest](FlashLoanerTest.md)
* [GenericTokenSender](GenericTokenSender.md)
* [GovernorAlpha](GovernorAlpha.md)
* [GovernorAlphaMockup](GovernorAlphaMockup.md)
* [GovernorVault](GovernorVault.md)
* [IApproveAndCall](IApproveAndCall.md)
* [IChai](IChai.md)
* [IContractRegistry](IContractRegistry.md)
* [IConverterAMM](IConverterAMM.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IFeeSharingProxy](IFeeSharingProxy.md)
* [ILiquidityMining](ILiquidityMining.md)
* [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
* [ILoanPool](ILoanPool.md)
* [ILoanToken](ILoanToken.md)
* [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
* [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
* [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
* [ILoanTokenModules](ILoanTokenModules.md)
* [ILoanTokenModulesMock](ILoanTokenModulesMock.md)
* [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
* [ILockedSOV](ILockedSOV.md)
* [IMoCState](IMoCState.md)
* [ImplementationMockup](ImplementationMockup.md)
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
* [ITokenFlashLoanTest](ITokenFlashLoanTest.md)
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
* [LiquidityMiningMockup](LiquidityMiningMockup.md)
* [LiquidityMiningProxy](LiquidityMiningProxy.md)
* [LiquidityMiningStorage](LiquidityMiningStorage.md)
* [LiquidityPoolV1ConverterMockup](LiquidityPoolV1ConverterMockup.md)
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
* [LoanTokenLogicLMMockup](LoanTokenLogicLMMockup.md)
* [LoanTokenLogicLMV1Mockup](LoanTokenLogicLMV1Mockup.md)
* [LoanTokenLogicLMV2Mockup](LoanTokenLogicLMV2Mockup.md)
* [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
* [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
* [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
* [LoanTokenLogicTest](LoanTokenLogicTest.md)
* [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
* [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
* [LockedSOV](LockedSOV.md)
* [LockedSOVFailedMockup](LockedSOVFailedMockup.md)
* [LockedSOVMockup](LockedSOVMockup.md)
* [Medianizer](Medianizer.md)
* [MockAffiliates](MockAffiliates.md)
* [MockLoanTokenLogic](MockLoanTokenLogic.md)
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
* [PriceFeedRSKOracleMockup](PriceFeedRSKOracleMockup.md)
* [PriceFeeds](PriceFeeds.md)
* [PriceFeedsConstants](PriceFeedsConstants.md)
* [PriceFeedsMoC](PriceFeedsMoC.md)
* [PriceFeedsMoCMockup](PriceFeedsMoCMockup.md)
* [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
* [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
* [ProtocolLike](ProtocolLike.md)
* [ProtocolSettings](ProtocolSettings.md)
* [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
* [ProtocolSettingsLike](ProtocolSettingsLike.md)
* [ProtocolSettingsMockup](ProtocolSettingsMockup.md)
* [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
* [ProtocolTokenUser](ProtocolTokenUser.md)
* [Proxy](Proxy.md)
* [ProxyMockup](ProxyMockup.md)
* [RBTCWrapperProxyMockup](RBTCWrapperProxyMockup.md)
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
* [StakingMock](StakingMock.md)
* [StakingMockup](StakingMockup.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsMockUp](StakingRewardsMockUp.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingStorage](StakingStorage.md)
* [State](State.md)
* [StorageMockup](StorageMockup.md)
* [SVR](SVR.md)
* [SwapsEvents](SwapsEvents.md)
* [SwapsExternal](SwapsExternal.md)
* [SwapsImplLocal](SwapsImplLocal.md)
* [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
* [SwapsUser](SwapsUser.md)
* [TeamVesting](TeamVesting.md)
* [TestCoverage](TestCoverage.md)
* [TestLibraries](TestLibraries.md)
* [TestSovrynSwap](TestSovrynSwap.md)
* [TestToken](TestToken.md)
* [TestWrbtc](TestWrbtc.md)
* [Timelock](Timelock.md)
* [TimelockHarness](TimelockHarness.md)
* [TimelockInterface](TimelockInterface.md)
* [TimelockTest](TimelockTest.md)
* [TokenSender](TokenSender.md)
* [UpgradableProxy](UpgradableProxy.md)
* [USDTPriceFeed](USDTPriceFeed.md)
* [VaultController](VaultController.md)
* [Vesting](Vesting.md)
* [VestingCreator](VestingCreator.md)
* [VestingFactory](VestingFactory.md)
* [VestingLogic](VestingLogic.md)
* [VestingLogicMockup](VestingLogicMockup.md)
* [VestingRegistry](VestingRegistry.md)
* [VestingRegistry2](VestingRegistry2.md)
* [VestingRegistry3](VestingRegistry3.md)
* [VestingRegistryLogic](VestingRegistryLogic.md)
* [VestingRegistryLogicMockup](VestingRegistryLogicMockup.md)
* [VestingRegistryProxy](VestingRegistryProxy.md)
* [VestingRegistryStorage](VestingRegistryStorage.md)
* [VestingStorage](VestingStorage.md)
* [WeightedStaking](WeightedStaking.md)
* [WRBTC](WRBTC.md)
