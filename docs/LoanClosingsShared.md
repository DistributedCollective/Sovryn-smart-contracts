# LoanClosingsShared contract. (LoanClosingsShared.sol)

View Source: [contracts/modules/LoanClosingsShared.sol](../contracts/modules/LoanClosingsShared.sol)

**↗ Extends: [LoanClosingsEvents](LoanClosingsEvents.md), [VaultController](VaultController.md), [InterestUser](InterestUser.md), [SwapsUser](SwapsUser.md), [RewardHelper](RewardHelper.md), [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)**
**↘ Derived Contracts: [LoanClosingsLiquidation](LoanClosingsLiquidation.md), [LoanClosingsRollover](LoanClosingsRollover.md), [LoanClosingsWith](LoanClosingsWith.md)**

**LoanClosingsShared**

This contract should only contains the internal function that is being used / utilized by
  LoanClosingsLiquidation, LoanClosingsRollover & LoanClosingsWith contract
 *

**Enums**
### CloseTypes

```js
enum CloseTypes {
 Deposit,
 Swap,
 Liquidation
}
```

## Contract Members
**Constants & Variables**

```js
//internal members
uint256 internal constant MONTH;

//public members
uint256 public constant paySwapExcessToBorrowerThreshold;
uint256 public constant TINY_AMOUNT;

```

## Functions

- [_settleInterestToPrincipal(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 loanCloseAmount, address receiver)](#_settleinteresttoprincipal)
- [_returnPrincipalWithDeposit(address loanToken, address receiver, uint256 principalNeeded)](#_returnprincipalwithdeposit)
- [worthTheTransfer(address asset, uint256 amount)](#worththetransfer)
- [_doCollateralSwap(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 swapAmount, uint256 principalNeeded, bool returnTokenIsCollateral, bytes loanDataBytes)](#_docollateralswap)
- [_withdrawAsset(address assetToken, address receiver, uint256 assetAmount)](#_withdrawasset)
- [_closeLoan(struct LoanStruct.Loan loanLocal, uint256 loanCloseAmount)](#_closeloan)
- [_settleInterest(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 closePrincipal)](#_settleinterest)
- [_checkAuthorized(bytes32 loanId)](#_checkauthorized)
- [_closeWithSwap(bytes32 loanId, address receiver, uint256 swapAmount, bool returnTokenIsCollateral, bytes loanDataBytes)](#_closewithswap)
- [_finalizeClose(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 loanCloseAmount, uint256 collateralCloseAmount, uint256 collateralToLoanSwapRate, enum LoanClosingsShared.CloseTypes closeType)](#_finalizeclose)
- [_coverPrincipalWithSwap(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 swapAmount, uint256 principalNeeded, bool returnTokenIsCollateral, bytes loanDataBytes)](#_coverprincipalwithswap)
- [_emitClosingEvents(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 loanCloseAmount, uint256 collateralCloseAmount, uint256 collateralToLoanRate, uint256 collateralToLoanSwapRate, uint256 currentMargin, enum LoanClosingsShared.CloseTypes closeType)](#_emitclosingevents)
- [_getAmountInRbtc(address asset, uint256 amount)](#_getamountinrbtc)
- [_checkLoan(bytes32 loanId)](#_checkloan)

### _settleInterestToPrincipal

computes the interest which needs to be refunded to the borrower based on the amount he's closing and either
subtracts it from the amount which still needs to be paid back (in case outstanding amount > interest) or withdraws the
excess to the borrower (in case interest > outstanding).

```js
function _settleInterestToPrincipal(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 loanCloseAmount, address receiver) internal nonpayable
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanLocal | struct LoanStruct.Loan | the loan | 
| loanParamsLocal | struct LoanParamsStruct.LoanParams | the loan params | 
| loanCloseAmount | uint256 | the amount to be closed (base for the computation) | 
| receiver | address | the address of the receiver (usually the borrower) | 

### _returnPrincipalWithDeposit

```js
function _returnPrincipalWithDeposit(address loanToken, address receiver, uint256 principalNeeded) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address |  | 
| receiver | address |  | 
| principalNeeded | uint256 |  | 

### worthTheTransfer

checks if the amount of the asset to be transfered is worth the transfer fee

```js
function worthTheTransfer(address asset, uint256 amount) internal nonpayable
returns(bool)
```

**Returns**

True if the amount is bigger than the threshold

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| asset | address | the asset to be transfered | 
| amount | uint256 | the amount to be transfered | 

### _doCollateralSwap

```js
function _doCollateralSwap(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 swapAmount, uint256 principalNeeded, bool returnTokenIsCollateral, bytes loanDataBytes) internal nonpayable
returns(destTokenAmountReceived uint256, sourceTokenAmountUsed uint256, collateralToLoanSwapRate uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanLocal | struct LoanStruct.Loan | the loan object | 
| loanParamsLocal | struct LoanParamsStruct.LoanParams | the loan parameters | 
| swapAmount | uint256 | the amount to be swapped | 
| principalNeeded | uint256 | the required destination token amount | 
| returnTokenIsCollateral | bool | if true -> required destination token amount will be passed on, else not
         note: quite dirty. should be refactored. | 
| loanDataBytes | bytes | additional loan data (not in use for token swaps) | 

### _withdrawAsset

Withdraw asset to receiver.
	 *

```js
function _withdrawAsset(address assetToken, address receiver, uint256 assetAmount) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| assetToken | address | The loan token. | 
| receiver | address | The address of the receiver. | 
| assetAmount | uint256 | The loan token amount. | 

### _closeLoan

Internal function to close a loan.
	 *

```js
function _closeLoan(struct LoanStruct.Loan loanLocal, uint256 loanCloseAmount) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanLocal | struct LoanStruct.Loan | The loan object. | 
| loanCloseAmount | uint256 | The amount to close: principal or lower.
	 * | 

### _settleInterest

```js
function _settleInterest(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 closePrincipal) internal nonpayable
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams |  | 
| loanLocal | struct LoanStruct.Loan |  | 
| closePrincipal | uint256 |  | 

### _checkAuthorized

Check sender is borrower or delegatee and loan id exists.
	 *

```js
function _checkAuthorized(bytes32 loanId) internal view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | byte32 of the loan id. | 

### _closeWithSwap

Internal function for closing a position by swapping the
collateral back to loan tokens, paying the lender and withdrawing
the remainder.
	 *

```js
function _closeWithSwap(bytes32 loanId, address receiver, uint256 swapAmount, bool returnTokenIsCollateral, bytes loanDataBytes) internal nonpayable
returns(loanCloseAmount uint256, withdrawAmount uint256, withdrawToken address)
```

**Returns**

loanCloseAmount The amount of the collateral token of the loan.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The id of the loan. | 
| receiver | address | The receiver of the remainder (unused collatral + profit). | 
| swapAmount | uint256 | Defines how much of the position should be closed and
  is denominated in collateral tokens.
    If swapAmount >= collateral, the complete position will be closed.
    Else if returnTokenIsCollateral, (swapAmount/collateral) * principal will be swapped (partial closure).
    Else coveredPrincipal | 
| returnTokenIsCollateral | bool | Defines if the remainder should be paid
  out in collateral tokens or underlying loan tokens.
	 * | 
| loanDataBytes | bytes |  | 

### _finalizeClose

Close a loan.
	 *

```js
function _finalizeClose(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 loanCloseAmount, uint256 collateralCloseAmount, uint256 collateralToLoanSwapRate, enum LoanClosingsShared.CloseTypes closeType) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanLocal | struct LoanStruct.Loan | The loan object. | 
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan params. | 
| loanCloseAmount | uint256 | The amount to close: principal or lower. | 
| collateralCloseAmount | uint256 | The amount of collateral to close. | 
| collateralToLoanSwapRate | uint256 | The price rate collateral/loan token. | 
| closeType | enum LoanClosingsShared.CloseTypes | The type of loan close. | 

### _coverPrincipalWithSwap

Swaps a share of a loan's collateral or the complete collateral
  in order to cover the principle.
	 *

```js
function _coverPrincipalWithSwap(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 swapAmount, uint256 principalNeeded, bool returnTokenIsCollateral, bytes loanDataBytes) internal nonpayable
returns(coveredPrincipal uint256, usedCollateral uint256, withdrawAmount uint256, collateralToLoanSwapRate uint256)
```

**Returns**

coveredPrincipal The amount of principal that is covered.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanLocal | struct LoanStruct.Loan | the loan | 
| loanParamsLocal | struct LoanParamsStruct.LoanParams | the loan parameters | 
| swapAmount | uint256 | in case principalNeeded == 0 or !returnTokenIsCollateral, this is the amount which is going to be swapped.
 Else, swapAmount doesn't matter, because the amount of source tokens needed for the swap is estimated by the connector. | 
| principalNeeded | uint256 | the required amount of destination tokens in order to cover the principle (only used if returnTokenIsCollateral) | 
| returnTokenIsCollateral | bool | tells if the user wants to withdraw his remaining collateral + profit in collateral tokens | 
| loanDataBytes | bytes |  | 

### _emitClosingEvents

```js
function _emitClosingEvents(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 loanCloseAmount, uint256 collateralCloseAmount, uint256 collateralToLoanRate, uint256 collateralToLoanSwapRate, uint256 currentMargin, enum LoanClosingsShared.CloseTypes closeType) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams |  | 
| loanLocal | struct LoanStruct.Loan |  | 
| loanCloseAmount | uint256 |  | 
| collateralCloseAmount | uint256 |  | 
| collateralToLoanRate | uint256 |  | 
| collateralToLoanSwapRate | uint256 |  | 
| currentMargin | uint256 |  | 
| closeType | enum LoanClosingsShared.CloseTypes |  | 

### _getAmountInRbtc

returns amount of the asset converted to RBTC

```js
function _getAmountInRbtc(address asset, uint256 amount) internal nonpayable
returns(uint256)
```

**Returns**

amount in RBTC

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| asset | address | the asset to be transferred | 
| amount | uint256 | the amount to be transferred | 

### _checkLoan

private function which check the loanLocal & loanParamsLocal does exist
	 *

```js
function _checkLoan(bytes32 loanId) internal view
returns(struct LoanStruct.Loan, struct LoanParamsStruct.LoanParams)
```

**Returns**

Loan storage

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | bytes32 of loanId
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
