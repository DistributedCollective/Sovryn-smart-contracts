# PriceFeeds.sol

View Source: [contracts/feeds/PriceFeeds.sol](../contracts/feeds/PriceFeeds.sol)

**↗ Extends: [PriceFeedsConstants](PriceFeedsConstants.md), [Ownable](Ownable.md)**

**PriceFeeds**

## Contract Members
**Constants & Variables**

```js
mapping(address => contract IPriceFeedsExt) public pricesFeeds;
mapping(address => uint256) public decimals;
uint256 public protocolTokenEthPrice;
bool public globalPricingPaused;

```

**Events**

```js
event GlobalPricingPaused(address indexed sender, bool indexed isPaused);
```

## Functions

- [latestAnswer()](#latestanswer)
- [(address _wrbtcTokenAddress, address _protocolTokenAddress, address _baseTokenAddress)](#)
- [queryRate(address sourceToken, address destToken)](#queryrate)
- [queryPrecision(address sourceToken, address destToken)](#queryprecision)
- [queryReturn(address sourceToken, address destToken, uint256 sourceAmount)](#queryreturn)
- [checkPriceDisagreement(address sourceToken, address destToken, uint256 sourceAmount, uint256 destAmount, uint256 maxSlippage)](#checkpricedisagreement)
- [amountInEth(address tokenAddress, uint256 amount)](#amountineth)
- [getMaxDrawdown(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount, uint256 margin)](#getmaxdrawdown)
- [getCurrentMarginAndCollateralSize(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount)](#getcurrentmarginandcollateralsize)
- [getCurrentMargin(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount)](#getcurrentmargin)
- [shouldLiquidate(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount, uint256 maintenanceMargin)](#shouldliquidate)
- [setProtocolTokenEthPrice(uint256 newPrice)](#setprotocoltokenethprice)
- [setPriceFeed(address[] tokens, IPriceFeedsExt[] feeds)](#setpricefeed)
- [setDecimals(IERC20[] tokens)](#setdecimals)
- [setGlobalPricingPaused(bool isPaused)](#setglobalpricingpaused)
- [_queryRate(address sourceToken, address destToken)](#_queryrate)
- [_getDecimalPrecision(address sourceToken, address destToken)](#_getdecimalprecision)

### latestAnswer

⤿ Overridden Implementation(s): [BProPriceFeed.latestAnswer](BProPriceFeed.md#latestanswer),[Medianizer.latestAnswer](Medianizer.md#latestanswer),[PriceFeedRSKOracle.latestAnswer](PriceFeedRSKOracle.md#latestanswer),[PriceFeedsMoC.latestAnswer](PriceFeedsMoC.md#latestanswer),[PriceFeedV1PoolOracle.latestAnswer](PriceFeedV1PoolOracle.md#latestanswer),[USDTPriceFeed.latestAnswer](USDTPriceFeed.md#latestanswer)

```js
function latestAnswer() external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### 

Contract deployment requires 3 parameters.
	 *

```js
function (address _wrbtcTokenAddress, address _protocolTokenAddress, address _baseTokenAddress) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _wrbtcTokenAddress | address | The address of the wrapped wrBTC token. | 
| _protocolTokenAddress | address | The address of the protocol token. | 
| _baseTokenAddress | address | The address of the base token. | 

### queryRate

Calculate the price ratio between two tokens.
	 *

```js
function queryRate(address sourceToken, address destToken) public view
returns(rate uint256, precision uint256)
```

**Returns**

rate The price ratio source/dest.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source tokens. | 
| destToken | address | The address of the destiny tokens.
	 * | 

### queryPrecision

Calculate the relative precision between two tokens.
	 *

```js
function queryPrecision(address sourceToken, address destToken) public view
returns(uint256)
```

**Returns**

The precision ratio source/dest.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source tokens. | 
| destToken | address | The address of the destiny tokens.
	 * | 

### queryReturn

Price conversor: Calculate the price of an amount of source
tokens in destiny token units.
	 *

```js
function queryReturn(address sourceToken, address destToken, uint256 sourceAmount) public view
returns(destAmount uint256)
```

**Returns**

destAmount The amount of destiny tokens equivalent in price
  to the amount of source tokens.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source tokens. | 
| destToken | address | The address of the destiny tokens. | 
| sourceAmount | uint256 | The amount of the source tokens.
	 * | 

### checkPriceDisagreement

Calculate the swap rate between two tokens.
	 * Regarding slippage, there is a hardcoded slippage limit of 5%, enforced
by this function for all borrowing, lending and margin trading
originated swaps performed in the Sovryn exchange.
	 * This means all operations in the Sovryn exchange are subject to losing
up to 5% from the internal swap performed.
	 *

```js
function checkPriceDisagreement(address sourceToken, address destToken, uint256 sourceAmount, uint256 destAmount, uint256 maxSlippage) public view
returns(sourceToDestSwapRate uint256)
```

**Returns**

sourceToDestSwapRate The swap rate between tokens.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source tokens. | 
| destToken | address | The address of the destiny tokens. | 
| sourceAmount | uint256 | The amount of source tokens. | 
| destAmount | uint256 | The amount of destiny tokens. | 
| maxSlippage | uint256 | The maximum slippage limit.
	 * | 

### amountInEth

Calculate the rBTC amount equivalent to a given token amount.
Native coin on RSK is rBTC. This code comes from Ethereum applications,
so Eth refers to 10**18 weis of native coin, i.e.: 1 rBTC.
	 *

```js
function amountInEth(address tokenAddress, uint256 amount) public view
returns(ethAmount uint256)
```

**Returns**

ethAmount The amount of rBTC equivalent.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| tokenAddress | address | The address of the token to calculate price. | 
| amount | uint256 | The amount of tokens to calculate price.
	 * | 

### getMaxDrawdown

Calculate the maximum drawdown of a loan.
	 * A drawdown is commonly defined as the decline from a high peak to a
pullback low of a specific investment or equity in an account.
	 * Drawdown magnitude refers to the amount of value that a user loses
during the drawdown period.
	 *

```js
function getMaxDrawdown(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount, uint256 margin) public view
returns(maxDrawdown uint256)
```

**Returns**

maxDrawdown The maximum drawdown.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The address of the loan token. | 
| collateralToken | address | The address of the collateral token. | 
| loanAmount | uint256 | The amount of the loan. | 
| collateralAmount | uint256 | The amount of the collateral. | 
| margin | uint256 | The relation between the position size and the loan.
  margin = (total position size - loan) / loan
	 * | 

### getCurrentMarginAndCollateralSize

Calculate the margin and the collateral on rBTC.
	 *

```js
function getCurrentMarginAndCollateralSize(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount) public view
returns(currentMargin uint256, collateralInEthAmount uint256)
```

**Returns**

currentMargin The margin of the loan.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The address of the loan token. | 
| collateralToken | address | The address of the collateral token. | 
| loanAmount | uint256 | The amount of the loan. | 
| collateralAmount | uint256 | The amount of the collateral.
	 * | 

### getCurrentMargin

Calculate the margin of a loan.
	 *

```js
function getCurrentMargin(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount) public view
returns(currentMargin uint256, collateralToLoanRate uint256)
```

**Returns**

currentMargin The margin of the loan.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The address of the loan token. | 
| collateralToken | address | The address of the collateral token. | 
| loanAmount | uint256 | The amount of the loan. | 
| collateralAmount | uint256 | The amount of the collateral.
	 * | 

### shouldLiquidate

Get assessment about liquidating a loan.
	 *

```js
function shouldLiquidate(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount, uint256 maintenanceMargin) public view
returns(bool)
```

**Returns**

True/false to liquidate the loan.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The address of the loan token. | 
| collateralToken | address | The address of the collateral token. | 
| loanAmount | uint256 | The amount of the loan. | 
| collateralAmount | uint256 | The amount of the collateral. | 
| maintenanceMargin | uint256 | The minimum margin before liquidation.
	 * | 

### setProtocolTokenEthPrice

Set new value for protocolTokenEthPrice
	 *

```js
function setProtocolTokenEthPrice(uint256 newPrice) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newPrice | uint256 | The new value for protocolTokenEthPrice | 

### setPriceFeed

Populate pricesFeeds mapping w/ values from feeds[]
	 *

```js
function setPriceFeed(address[] tokens, IPriceFeedsExt[] feeds) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| tokens | address[] | The array of tokens to loop and get addresses. | 
| feeds | IPriceFeedsExt[] | The array of contract instances for every token. | 

### setDecimals

Populate decimals mapping w/ values from tokens[].decimals
	 *

```js
function setDecimals(IERC20[] tokens) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| tokens | IERC20[] | The array of tokens to loop and get values from. | 

### setGlobalPricingPaused

Set flag globalPricingPaused
	 *

```js
function setGlobalPricingPaused(bool isPaused) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| isPaused | bool | The new status of pause (true/false). | 

### _queryRate

Calculate the price ratio between two tokens.
	 *

```js
function _queryRate(address sourceToken, address destToken) internal view
returns(rate uint256, precision uint256)
```

**Returns**

rate The price ratio source/dest.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source tokens. | 
| destToken | address | The address of the destiny tokens.
	 * | 

### _getDecimalPrecision

Calculate the relative precision between two tokens.
	 *

```js
function _getDecimalPrecision(address sourceToken, address destToken) internal view
returns(uint256)
```

**Returns**

The precision ratio source/dest.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source tokens. | 
| destToken | address | The address of the destiny tokens.
	 * | 

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
