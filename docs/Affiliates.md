# Affiliates contract. (Affiliates.sol)

View Source: [contracts/modules/Affiliates.sol](../contracts/modules/Affiliates.sol)

**↗ Extends: [State](State.md), [AffiliatesEvents](AffiliatesEvents.md), [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)**
**↘ Derived Contracts: [MockAffiliates](MockAffiliates.md)**

**Affiliates**

Track referrals and reward referrers (affiliates) with tokens.
  In-detail specifications are found at https://wiki.sovryn.app/en/community/Affiliates

## Structs
### SetAffiliatesReferrerResult

```js
struct SetAffiliatesReferrerResult {
 bool success,
 bool alreadySet,
 bool userNotFirstTradeFlag
}
```

## Modifiers

- [onlyCallableByLoanPools](#onlycallablebyloanpools)
- [onlyCallableInternal](#onlycallableinternal)

### onlyCallableByLoanPools

Function modifier to avoid any other calls not coming from loan pools.

```js
modifier onlyCallableByLoanPools() internal
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### onlyCallableInternal

Function modifier to avoid any other calls not coming from within protocol functions.

```js
modifier onlyCallableInternal() internal
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

## Functions

- [()](#)
- [()](#)
- [initialize(address target)](#initialize)
- [setAffiliatesReferrer(address user, address referrer)](#setaffiliatesreferrer)
- [getReferralsList(address referrer)](#getreferralslist)
- [getUserNotFirstTradeFlag(address user)](#getusernotfirsttradeflag)
- [setUserNotFirstTradeFlag(address user)](#setusernotfirsttradeflag)
- [_getAffiliatesTradingFeePercentForSOV()](#_getaffiliatestradingfeepercentforsov)
- [_getReferrerTradingFeeForToken(uint256 feeTokenAmount)](#_getreferrertradingfeefortoken)
- [getAffiliateTradingTokenFeePercent()](#getaffiliatetradingtokenfeepercent)
- [getMinReferralsToPayout()](#getminreferralstopayout)
- [_getSovBonusAmount(address feeToken, uint256 feeAmount)](#_getsovbonusamount)
- [payTradingFeeToAffiliatesReferrer(address referrer, address trader, address token, uint256 tradingFeeTokenBaseAmount)](#paytradingfeetoaffiliatesreferrer)
- [withdrawAffiliatesReferrerTokenFees(address token, address receiver, uint256 amount)](#withdrawaffiliatesreferrertokenfees)
- [withdrawAllAffiliatesReferrerTokenFees(address receiver)](#withdrawallaffiliatesreferrertokenfees)
- [_removeAffiliatesReferrerToken(address referrer, address token)](#_removeaffiliatesreferrertoken)
- [getAffiliatesReferrerBalances(address referrer)](#getaffiliatesreferrerbalances)
- [getAffiliatesTokenRewardsValueInRbtc(address referrer)](#getaffiliatestokenrewardsvalueinrbtc)
- [getAffiliatesReferrerTokensList(address referrer)](#getaffiliatesreferrertokenslist)
- [getAffiliatesReferrerTokenBalance(address referrer, address token)](#getaffiliatesreferrertokenbalance)
- [getAffiliatesUserReferrer(address user)](#getaffiliatesuserreferrer)
- [getAffiliateRewardsHeld(address referrer)](#getaffiliaterewardsheld)

### 

Void constructor.

```js
function () public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### 

Avoid calls to this contract except for those explicitly declared.

```js
function () external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### initialize

⤿ Overridden Implementation(s): [MockAffiliates.initialize](MockAffiliates.md#initialize)

Set delegate callable functions by proxy contract.

```js
function initialize(address target) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address | The address of a new logic implementation. | 

### setAffiliatesReferrer

Loan pool calls this function to tell affiliates
  a user coming from a referrer is trading and should be registered if not yet.
  Taking into account some user status flags may lead to the user and referrer
  become added or not to the affiliates record.
	 *

```js
function setAffiliatesReferrer(address user, address referrer) external nonpayable onlyCallableByLoanPools whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The address of the user that is trading on loan pools. | 
| referrer | address | The address of the referrer the user is coming from. | 

### getReferralsList

Getter to query the referrals coming from a referrer.

```js
function getReferralsList(address referrer) external view
returns(refList address[])
```

**Returns**

The referralsList mapping value by referrer.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The address of a given referrer. | 

### getUserNotFirstTradeFlag

Getter to query the not-first-trade flag of a user.

```js
function getUserNotFirstTradeFlag(address user) public view
returns(bool)
```

**Returns**

The userNotFirstTradeFlag mapping value by user.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The address of a given user. | 

### setUserNotFirstTradeFlag

Setter to toggle on the not-first-trade flag of a user.

```js
function setUserNotFirstTradeFlag(address user) external nonpayable onlyCallableByLoanPools whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The address of a given user. | 

### _getAffiliatesTradingFeePercentForSOV

Internal getter to query the fee share for affiliate program.

```js
function _getAffiliatesTradingFeePercentForSOV() internal view
returns(uint256)
```

**Returns**

The percentage of fee share w/ 18 decimals.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### _getReferrerTradingFeeForToken

Internal to calculate the affiliates trading token fee amount.
  Affiliates program has 2 kind of rewards:
    1. x% based on the fee of the token that is traded (in form of the token itself).
    2. x% based on the fee of the token that is traded (in form of SOV).
  This _getReferrerTradingFeeForToken calculates the first one
  by applying a custom percentage multiplier.

```js
function _getReferrerTradingFeeForToken(uint256 feeTokenAmount) internal view
returns(uint256)
```

**Returns**

The affiliates share of the trading token fee amount.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| feeTokenAmount | uint256 | The trading token fee amount. | 

### getAffiliateTradingTokenFeePercent

Getter to query the fee share of trading token fee for affiliate program.

```js
function getAffiliateTradingTokenFeePercent() public view
returns(uint256)
```

**Returns**

The percentage of fee share w/ 18 decimals.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### getMinReferralsToPayout

Getter to query referral threshold for paying out to the referrer.

```js
function getMinReferralsToPayout() public view
returns(uint256)
```

**Returns**

The minimum number of referrals set by Protocol.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### _getSovBonusAmount

Get the sovToken reward of a trade.

```js
function _getSovBonusAmount(address feeToken, uint256 feeAmount) internal view
returns(uint256)
```

**Returns**

The reward amount.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| feeToken | address | The address of the token in which the trading/borrowing fee was paid. | 
| feeAmount | uint256 | The height of the fee. | 

### payTradingFeeToAffiliatesReferrer

Protocol calls this function to pay the affiliates rewards to a user (referrer).
	 *

```js
function payTradingFeeToAffiliatesReferrer(address referrer, address trader, address token, uint256 tradingFeeTokenBaseAmount) external nonpayable onlyCallableInternal whenNotPaused 
returns(referrerBonusSovAmount uint256, referrerBonusTokenAmount uint256)
```

**Returns**

referrerBonusSovAmount The amount of SOV tokens paid to the referrer (through a vesting contract, lockedSOV).

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The address of the referrer. | 
| trader | address | The address of the trader. | 
| token | address | The address of the token in which the trading/borrowing fee was paid. | 
| tradingFeeTokenBaseAmount | uint256 | Total trading fee amount, the base for calculating referrer's fees.
	 * | 

### withdrawAffiliatesReferrerTokenFees

Referrer calls this function to receive its reward in a given token.
  It will send the other (non-SOV) reward tokens from trading protocol fees,
  to the referrer’s wallet.

```js
function withdrawAffiliatesReferrerTokenFees(address token, address receiver, uint256 amount) public nonpayable whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address | The address of the token to withdraw. | 
| receiver | address | The address of the withdrawal beneficiary. | 
| amount | uint256 | The amount of tokens to claim. If greater than balance, just sends balance. | 

### withdrawAllAffiliatesReferrerTokenFees

Withdraw to msg.sender all token fees for a referrer.

```js
function withdrawAllAffiliatesReferrerTokenFees(address receiver) external nonpayable whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address | The address of the withdrawal beneficiary. | 

### _removeAffiliatesReferrerToken

Internal function to delete a referrer's token balance.

```js
function _removeAffiliatesReferrerToken(address referrer, address token) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The address of the referrer. | 
| token | address | The address of the token specifying the balance to remove. | 

### getAffiliatesReferrerBalances

Get all token balances of a referrer.

```js
function getAffiliatesReferrerBalances(address referrer) public view
returns(referrerTokensList address[], referrerTokensBalances uint256[])
```

**Returns**

referrerTokensList The array of available tokens (keys).

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The address of the referrer. | 

### getAffiliatesTokenRewardsValueInRbtc

Get all token rewards estimation value in rbtc.
	 *

```js
function getAffiliatesTokenRewardsValueInRbtc(address referrer) external view
returns(rbtcTotalAmount uint256)
```

**Returns**

The value estimation in rbtc.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | Address of referrer.
	 * | 

### getAffiliatesReferrerTokensList

Get all available tokens at the affiliates program for a given referrer.

```js
function getAffiliatesReferrerTokensList(address referrer) public view
returns(tokensList address[])
```

**Returns**

tokensList The list of available tokens.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The address of a given referrer. | 

### getAffiliatesReferrerTokenBalance

Getter to query the affiliate balance for a given referrer and token.

```js
function getAffiliatesReferrerTokenBalance(address referrer, address token) public view
returns(uint256)
```

**Returns**

The affiliatesReferrerBalances mapping value by referrer and token keys.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The address of the referrer. | 
| token | address | The address of the token to get balance for. | 

### getAffiliatesUserReferrer

⤿ Overridden Implementation(s): [MockAffiliates.getAffiliatesUserReferrer](MockAffiliates.md#getaffiliatesuserreferrer)

Getter to query the address of referrer for a given user.

```js
function getAffiliatesUserReferrer(address user) public view
returns(address)
```

**Returns**

The address on affiliatesUserReferrer mapping value by user key.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The address of the user. | 

### getAffiliateRewardsHeld

Getter to query the reward amount held for a given referrer.

```js
function getAffiliateRewardsHeld(address referrer) public view
returns(uint256)
```

**Returns**

The affiliateRewardsHeld mapping value by referrer key.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The address of the referrer. | 

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
