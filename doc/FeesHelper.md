# The Fees Helper contract. (FeesHelper.sol)

View Source: [contracts/mixins/FeesHelper.sol](../contracts/mixins/FeesHelper.sol)

**↗ Extends: [State](State.md), [FeesEvents](FeesEvents.md)**
**↘ Derived Contracts: [InterestUser](InterestUser.md), [SwapsUser](SwapsUser.md)**

**FeesHelper**

This contract code comes from bZx. bZx is a protocol for tokenized margin
trading and lending https://bzx.network similar to the dYdX protocol.
 * This contract calculates and pays lending/borrow fees and rewards.

## Functions

- [_getTradingFee(uint256 feeTokenAmount)](#_gettradingfee)
- [_getSwapExternalFee(uint256 feeTokenAmount)](#_getswapexternalfee)
- [_getBorrowingFee(uint256 feeTokenAmount)](#_getborrowingfee)
- [_payTradingFeeToAffiliate(address referrer, address trader, address feeToken, uint256 tradingFee)](#_paytradingfeetoaffiliate)
- [_payTradingFee(address user, bytes32 loanId, address feeToken, address feeTokenPair, uint256 tradingFee)](#_paytradingfee)
- [_payBorrowingFee(address user, bytes32 loanId, address feeToken, address feeTokenPair, uint256 borrowingFee)](#_payborrowingfee)
- [_payLendingFee(address user, address feeToken, uint256 lendingFee)](#_paylendingfee)
- [_settleFeeRewardForInterestExpense(struct LoanInterestStruct.LoanInterest loanInterestLocal, bytes32 loanId, address feeToken, address feeTokenPair, address user, uint256 interestTime)](#_settlefeerewardforinterestexpense)
- [_payFeeReward(address user, bytes32 loanId, address feeToken, address feeTokenPair, uint256 feeAmount)](#_payfeereward)

### _getTradingFee

Calculate trading fee.

```js
function _getTradingFee(uint256 feeTokenAmount) internal view
returns(uint256)
```

**Returns**

The fee of the trade.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| feeTokenAmount | uint256 | The amount of tokens to trade. | 

### _getSwapExternalFee

Calculate swap external fee.

```js
function _getSwapExternalFee(uint256 feeTokenAmount) internal view
returns(uint256)
```

**Returns**

The fee of the swap.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| feeTokenAmount | uint256 | The amount of token to swap. | 

### _getBorrowingFee

Calculate the loan origination fee.

```js
function _getBorrowingFee(uint256 feeTokenAmount) internal view
returns(uint256)
```

**Returns**

The fee of the loan.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| feeTokenAmount | uint256 | The amount of tokens to borrow. | 

### _payTradingFeeToAffiliate

Settle the trading fee and pay the token reward to the affiliates referrer.
	 *

```js
function _payTradingFeeToAffiliate(address referrer, address trader, address feeToken, uint256 tradingFee) internal nonpayable
returns(affiliatesBonusSOVAmount uint256, affiliatesBonusTokenAmount uint256)
```

**Returns**

affiliatesBonusSOVAmount the total SOV amount that is distributed to the referrer

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The affiliate referrer address to send the reward to. | 
| trader | address | The account that performs this trade. | 
| feeToken | address | The address of the token in which the trading fee is paid. | 
| tradingFee | uint256 | The amount of tokens accrued as fees on the trading.
	 * | 

### _payTradingFee

Settle the trading fee and pay the token reward to the user.

```js
function _payTradingFee(address user, bytes32 loanId, address feeToken, address feeTokenPair, uint256 tradingFee) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The address to send the reward to. | 
| loanId | bytes32 | The Id of the associated loan - used for logging only. | 
| feeToken | address | The address of the token in which the trading fee is paid. | 
| feeTokenPair | address |  | 
| tradingFee | uint256 | The amount of tokens accrued as fees on the trading. | 

### _payBorrowingFee

Settle the borrowing fee and pay the token reward to the user.

```js
function _payBorrowingFee(address user, bytes32 loanId, address feeToken, address feeTokenPair, uint256 borrowingFee) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The address to send the reward to. | 
| loanId | bytes32 | The Id of the associated loan - used for logging only. | 
| feeToken | address | The address of the token in which the borrowig fee is paid. | 
| feeTokenPair | address |  | 
| borrowingFee | uint256 | The height of the fee. | 

### _payLendingFee

Settle the lending fee (based on the interest). Pay no token reward to the user.

```js
function _payLendingFee(address user, address feeToken, uint256 lendingFee) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The address to send the reward to. | 
| feeToken | address | The address of the token in which the lending fee is paid. | 
| lendingFee | uint256 | The height of the fee. | 

### _settleFeeRewardForInterestExpense

```js
function _settleFeeRewardForInterestExpense(struct LoanInterestStruct.LoanInterest loanInterestLocal, bytes32 loanId, address feeToken, address feeTokenPair, address user, uint256 interestTime) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanInterestLocal | struct LoanInterestStruct.LoanInterest |  | 
| loanId | bytes32 |  | 
| feeToken | address |  | 
| feeTokenPair | address |  | 
| user | address |  | 
| interestTime | uint256 |  | 

### _payFeeReward

Pay the potocolToken reward to user. The reward is worth 50% of the trading/borrowing fee.

```js
function _payFeeReward(address user, bytes32 loanId, address feeToken, address feeTokenPair, uint256 feeAmount) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The address to send the reward to. | 
| loanId | bytes32 | The Id of the associeated loan - used for logging only. | 
| feeToken | address | The address of the token in which the trading/borrowing fee was paid. | 
| feeTokenPair | address |  | 
| feeAmount | uint256 | The height of the fee. | 

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
