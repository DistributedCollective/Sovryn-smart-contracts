# ILoanTokenModules.sol

View Source: [contracts/interfaces/ILoanTokenModules.sol](../contracts/interfaces/ILoanTokenModules.sol)

**ILoanTokenModules**

## Structs
### LoanParams

```js
struct LoanParams {
 bytes32 id,
 bool active,
 address owner,
 address loanToken,
 address collateralToken,
 uint256 minInitialMargin,
 uint256 maintenanceMargin,
 uint256 maxLoanTerm
}
```

**Events**

```js
event Transfer(address indexed from, address indexed to, uint256  value);
event Approval(address indexed owner, address indexed spender, uint256  value);
event AllowanceUpdate(address indexed owner, address indexed spender, uint256  valueBefore, uint256  valueAfter);
event Mint(address indexed minter, uint256  tokenAmount, uint256  assetAmount, uint256  price);
event Burn(address indexed burner, uint256  tokenAmount, uint256  assetAmount, uint256  price);
event FlashBorrow(address  borrower, address  target, address  loanToken, uint256  loanAmount);
event SetTransactionLimits(address[]  addresses, uint256[]  limits);
event WithdrawRBTCTo(address indexed to, uint256  amount);
event ToggledFunctionPaused(string  functionId, bool  prevFlag, bool  newFlag);
```

## Functions

- [setAdmin(address _admin)](#setadmin)
- [setPauser(address _pauser)](#setpauser)
- [setupLoanParams(struct ILoanTokenModules.LoanParams[] loanParamsList, bool areTorqueLoans)](#setuploanparams)
- [disableLoanParams(address[] collateralTokens, bool[] isTorqueLoans)](#disableloanparams)
- [setDemandCurve(uint256 _baseRate, uint256 _rateMultiplier, uint256 _lowUtilBaseRate, uint256 _lowUtilRateMultiplier, uint256 _targetLevel, uint256 _kinkLevel, uint256 _maxScaleRate)](#setdemandcurve)
- [toggleFunctionPause(string funcId, bool isPaused)](#togglefunctionpause)
- [setTransactionLimits(address[] addresses, uint256[] limits)](#settransactionlimits)
- [changeLoanTokenNameAndSymbol(string _name, string _symbol)](#changeloantokennameandsymbol)
- [marginTrade(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minReturn, bytes loanDataBytes)](#margintrade)
- [marginTradeAffiliate(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minReturn, address affiliateReferrer, bytes loanDataBytes)](#margintradeaffiliate)
- [borrowInterestRate()](#borrowinterestrate)
- [mint(address receiver, uint256 depositAmount)](#mint)
- [burn(address receiver, uint256 burnAmount)](#burn)
- [checkPause(string funcId)](#checkpause)
- [nextBorrowInterestRate(uint256 borrowAmount)](#nextborrowinterestrate)
- [totalAssetBorrow()](#totalassetborrow)
- [totalAssetSupply()](#totalassetsupply)
- [borrow(bytes32 loanId, uint256 withdrawAmount, uint256 initialLoanDuration, uint256 collateralTokenSent, address collateralTokenAddress, address borrower, address receiver, bytes )](#borrow)
- [transfer(address _to, uint256 _value)](#transfer)
- [transferFrom(address _from, address _to, uint256 _value)](#transferfrom)
- [setLiquidityMiningAddress(address LMAddress)](#setliquidityminingaddress)
- [getLiquidityMiningAddress()](#getliquidityminingaddress)
- [getEstimatedMarginDetails(uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress)](#getestimatedmargindetails)
- [getDepositAmountForBorrow(uint256 borrowAmount, uint256 initialLoanDuration, address collateralTokenAddress)](#getdepositamountforborrow)
- [getBorrowAmountForDeposit(uint256 depositAmount, uint256 initialLoanDuration, address collateralTokenAddress)](#getborrowamountfordeposit)
- [checkPriceDivergence(uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, uint256 minReturn)](#checkpricedivergence)
- [getMaxEscrowAmount(uint256 leverageAmount)](#getmaxescrowamount)
- [checkpointPrice(address _user)](#checkpointprice)
- [assetBalanceOf(address _owner)](#assetbalanceof)
- [profitOf(address user)](#profitof)
- [tokenPrice()](#tokenprice)
- [avgBorrowInterestRate()](#avgborrowinterestrate)
- [supplyInterestRate()](#supplyinterestrate)
- [nextSupplyInterestRate(uint256 supplyAmount)](#nextsupplyinterestrate)
- [totalSupplyInterestRate(uint256 assetSupply)](#totalsupplyinterestrate)
- [loanTokenAddress()](#loantokenaddress)
- [getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount)](#getmarginborrowamountandrate)
- [withdrawRBTCTo(address payable _receiverAddress, uint256 _amount)](#withdrawrbtcto)
- [initialPrice()](#initialprice)
- [mint(address receiver, uint256 depositAmount, bool useLM)](#mint)
- [burn(address receiver, uint256 burnAmount, bool useLM)](#burn)
- [mintWithBTC(address receiver, bool useLM)](#mintwithbtc)
- [burnToBTC(address receiver, uint256 burnAmount, bool useLM)](#burntobtc)
- [liquidityMiningAddress()](#liquidityminingaddress)
- [name()](#name)
- [symbol()](#symbol)
- [approve(address _spender, uint256 _value)](#approve)
- [allowance(address _owner, address _spender)](#allowance)
- [balanceOf(address _owner)](#balanceof)
- [totalSupply()](#totalsupply)

### setAdmin

```js
function setAdmin(address _admin) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _admin | address |  | 

### setPauser

```js
function setPauser(address _pauser) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _pauser | address |  | 

### setupLoanParams

```js
function setupLoanParams(struct ILoanTokenModules.LoanParams[] loanParamsList, bool areTorqueLoans) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsList | struct ILoanTokenModules.LoanParams[] |  | 
| areTorqueLoans | bool |  | 

### disableLoanParams

```js
function disableLoanParams(address[] collateralTokens, bool[] isTorqueLoans) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| collateralTokens | address[] |  | 
| isTorqueLoans | bool[] |  | 

### setDemandCurve

```js
function setDemandCurve(uint256 _baseRate, uint256 _rateMultiplier, uint256 _lowUtilBaseRate, uint256 _lowUtilRateMultiplier, uint256 _targetLevel, uint256 _kinkLevel, uint256 _maxScaleRate) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _baseRate | uint256 |  | 
| _rateMultiplier | uint256 |  | 
| _lowUtilBaseRate | uint256 |  | 
| _lowUtilRateMultiplier | uint256 |  | 
| _targetLevel | uint256 |  | 
| _kinkLevel | uint256 |  | 
| _maxScaleRate | uint256 |  | 

### toggleFunctionPause

```js
function toggleFunctionPause(string funcId, bool isPaused) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| funcId | string |  | 
| isPaused | bool |  | 

### setTransactionLimits

```js
function setTransactionLimits(address[] addresses, uint256[] limits) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| addresses | address[] |  | 
| limits | uint256[] |  | 

### changeLoanTokenNameAndSymbol

```js
function changeLoanTokenNameAndSymbol(string _name, string _symbol) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _name | string |  | 
| _symbol | string |  | 

### marginTrade

```js
function marginTrade(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minReturn, bytes loanDataBytes) external payable
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| leverageAmount | uint256 |  | 
| loanTokenSent | uint256 |  | 
| collateralTokenSent | uint256 |  | 
| collateralTokenAddress | address |  | 
| trader | address |  | 
| minReturn | uint256 |  | 
| loanDataBytes | bytes |  | 

### marginTradeAffiliate

```js
function marginTradeAffiliate(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minReturn, address affiliateReferrer, bytes loanDataBytes) external payable
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| leverageAmount | uint256 |  | 
| loanTokenSent | uint256 |  | 
| collateralTokenSent | uint256 |  | 
| collateralTokenAddress | address |  | 
| trader | address |  | 
| minReturn | uint256 |  | 
| affiliateReferrer | address |  | 
| loanDataBytes | bytes |  | 

### borrowInterestRate

```js
function borrowInterestRate() external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### mint

```js
function mint(address receiver, uint256 depositAmount) external nonpayable
returns(mintAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| depositAmount | uint256 |  | 

### burn

```js
function burn(address receiver, uint256 burnAmount) external nonpayable
returns(loanAmountPaid uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| burnAmount | uint256 |  | 

### checkPause

```js
function checkPause(string funcId) external view
returns(isPaused bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| funcId | string |  | 

### nextBorrowInterestRate

```js
function nextBorrowInterestRate(uint256 borrowAmount) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| borrowAmount | uint256 |  | 

### totalAssetBorrow

```js
function totalAssetBorrow() external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### totalAssetSupply

```js
function totalAssetSupply() external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### borrow

```js
function borrow(bytes32 loanId, uint256 withdrawAmount, uint256 initialLoanDuration, uint256 collateralTokenSent, address collateralTokenAddress, address borrower, address receiver, bytes ) external payable
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| withdrawAmount | uint256 |  | 
| initialLoanDuration | uint256 |  | 
| collateralTokenSent | uint256 |  | 
| collateralTokenAddress | address |  | 
| borrower | address |  | 
| receiver | address |  | 
|  | bytes |  | 

### transfer

```js
function transfer(address _to, uint256 _value) external nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _to | address |  | 
| _value | uint256 |  | 

### transferFrom

```js
function transferFrom(address _from, address _to, uint256 _value) external nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _from | address |  | 
| _to | address |  | 
| _value | uint256 |  | 

### setLiquidityMiningAddress

```js
function setLiquidityMiningAddress(address LMAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| LMAddress | address |  | 

### getLiquidityMiningAddress

```js
function getLiquidityMiningAddress() external view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### getEstimatedMarginDetails

```js
function getEstimatedMarginDetails(uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress) external view
returns(principal uint256, collateral uint256, interestRate uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| leverageAmount | uint256 |  | 
| loanTokenSent | uint256 |  | 
| collateralTokenSent | uint256 |  | 
| collateralTokenAddress | address |  | 

### getDepositAmountForBorrow

```js
function getDepositAmountForBorrow(uint256 borrowAmount, uint256 initialLoanDuration, address collateralTokenAddress) external view
returns(depositAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| borrowAmount | uint256 |  | 
| initialLoanDuration | uint256 |  | 
| collateralTokenAddress | address |  | 

### getBorrowAmountForDeposit

```js
function getBorrowAmountForDeposit(uint256 depositAmount, uint256 initialLoanDuration, address collateralTokenAddress) external view
returns(borrowAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| depositAmount | uint256 |  | 
| initialLoanDuration | uint256 |  | 
| collateralTokenAddress | address |  | 

### checkPriceDivergence

```js
function checkPriceDivergence(uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, uint256 minReturn) external view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| leverageAmount | uint256 |  | 
| loanTokenSent | uint256 |  | 
| collateralTokenSent | uint256 |  | 
| collateralTokenAddress | address |  | 
| minReturn | uint256 |  | 

### getMaxEscrowAmount

```js
function getMaxEscrowAmount(uint256 leverageAmount) external view
returns(maxEscrowAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| leverageAmount | uint256 |  | 

### checkpointPrice

```js
function checkpointPrice(address _user) external view
returns(price uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address |  | 

### assetBalanceOf

```js
function assetBalanceOf(address _owner) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _owner | address |  | 

### profitOf

```js
function profitOf(address user) external view
returns(int256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address |  | 

### tokenPrice

```js
function tokenPrice() external view
returns(price uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### avgBorrowInterestRate

```js
function avgBorrowInterestRate() external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### supplyInterestRate

```js
function supplyInterestRate() external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### nextSupplyInterestRate

```js
function nextSupplyInterestRate(uint256 supplyAmount) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| supplyAmount | uint256 |  | 

### totalSupplyInterestRate

```js
function totalSupplyInterestRate(uint256 assetSupply) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| assetSupply | uint256 |  | 

### loanTokenAddress

```js
function loanTokenAddress() external view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### getMarginBorrowAmountAndRate

```js
function getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount) external view
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| leverageAmount | uint256 |  | 
| depositAmount | uint256 |  | 

### withdrawRBTCTo

```js
function withdrawRBTCTo(address payable _receiverAddress, uint256 _amount) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiverAddress | address payable |  | 
| _amount | uint256 |  | 

### initialPrice

```js
function initialPrice() external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### mint

```js
function mint(address receiver, uint256 depositAmount, bool useLM) external nonpayable
returns(minted uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| depositAmount | uint256 |  | 
| useLM | bool |  | 

### burn

```js
function burn(address receiver, uint256 burnAmount, bool useLM) external nonpayable
returns(redeemed uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| burnAmount | uint256 |  | 
| useLM | bool |  | 

### mintWithBTC

```js
function mintWithBTC(address receiver, bool useLM) external payable
returns(mintAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| useLM | bool |  | 

### burnToBTC

```js
function burnToBTC(address receiver, uint256 burnAmount, bool useLM) external nonpayable
returns(loanAmountPaid uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| burnAmount | uint256 |  | 
| useLM | bool |  | 

### liquidityMiningAddress

```js
function liquidityMiningAddress() external view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### name

```js
function name() external view
returns(string)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### symbol

```js
function symbol() external view
returns(string)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### approve

```js
function approve(address _spender, uint256 _value) external nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _spender | address |  | 
| _value | uint256 |  | 

### allowance

```js
function allowance(address _owner, address _spender) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _owner | address |  | 
| _spender | address |  | 

### balanceOf

```js
function balanceOf(address _owner) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _owner | address |  | 

### totalSupply

```js
function totalSupply() external view
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
