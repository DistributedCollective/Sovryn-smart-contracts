# Loan Openings contract.
 * (LoanOpenings.sol)

View Source: [contracts/modules/LoanOpenings.sol](../contracts/modules/LoanOpenings.sol)

**↗ Extends: [LoanOpeningsEvents](LoanOpeningsEvents.md), [VaultController](VaultController.md), [InterestUser](InterestUser.md), [SwapsUser](SwapsUser.md), [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)**

**LoanOpenings**

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
 * This contract contains functions to borrow and trade.

## Functions

- [()](#)
- [()](#)
- [initialize(address target)](#initialize)
- [borrowOrTradeFromPool(bytes32 loanParamsId, bytes32 loanId, bool isTorqueLoan, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues, bytes loanDataBytes)](#borrowortradefrompool)
- [setDelegatedManager(bytes32 loanId, address delegated, bool toggle)](#setdelegatedmanager)
- [getEstimatedMarginExposure(address loanToken, address collateralToken, uint256 loanTokenSent, uint256 collateralTokenSent, uint256 interestRate, uint256 newPrincipal)](#getestimatedmarginexposure)
- [getRequiredCollateral(address loanToken, address collateralToken, uint256 newPrincipal, uint256 marginAmount, bool isTorqueLoan)](#getrequiredcollateral)
- [getBorrowAmount(address loanToken, address collateralToken, uint256 collateralTokenAmount, uint256 marginAmount, bool isTorqueLoan)](#getborrowamount)
- [_borrowOrTrade(struct LoanParamsStruct.LoanParams loanParamsLocal, bytes32 loanId, bool isTorqueLoan, uint256 collateralAmountRequired, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues, bytes loanDataBytes)](#_borrowortrade)
- [_finalizeOpen(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, address[4] sentAddresses, uint256[5] sentValues, bool isTorqueLoan)](#_finalizeopen)
- [_emitOpeningEvents(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, address[4] sentAddresses, uint256[5] sentValues, uint256 collateralToLoanRate, uint256 margin, bool isTorqueLoan)](#_emitopeningevents)
- [_setDelegatedManager(bytes32 loanId, address delegator, address delegated, bool toggle)](#_setdelegatedmanager)
- [_isCollateralSatisfied(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 initialMargin, uint256 newCollateral, uint256 collateralAmountRequired)](#_iscollateralsatisfied)
- [_initializeLoan(struct LoanParamsStruct.LoanParams loanParamsLocal, bytes32 loanId, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues)](#_initializeloan)
- [_initializeInterest(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 newRate, uint256 newPrincipal, uint256 torqueInterest)](#_initializeinterest)
- [_getRequiredCollateral(address loanToken, address collateralToken, uint256 newPrincipal, uint256 marginAmount, bool isTorqueLoan)](#_getrequiredcollateral)

### 

```js
function () public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### 

Fallback function is to react to receiving value (rBTC).

```js
function () external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### initialize

Set function selectors on target contract.
	 *

```js
function initialize(address target) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address | The address of the target contract. | 

### borrowOrTradeFromPool

Borrow or trade from pool.
	 *

```js
function borrowOrTradeFromPool(bytes32 loanParamsId, bytes32 loanId, bool isTorqueLoan, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues, bytes loanDataBytes) external payable nonReentrant whenNotPaused 
returns(newPrincipal uint256, newCollateral uint256)
```

**Returns**

newPrincipal The new loan size.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsId | bytes32 | The ID of the loan parameters. | 
| loanId | bytes32 | The ID of the loan. If 0, start a new loan. | 
| isTorqueLoan | bool | Whether the loan is a Torque loan. | 
| initialMargin | uint256 | The initial amount of margin. | 
| sentAddresses | address[4] | The addresses to send tokens: lender, borrower,
  receiver and manager:
    lender: must match loan if loanId provided.
    borrower: must match loan if loanId provided.
    receiver: receiver of funds (address(0) assumes borrower address).
    manager: delegated manager of loan unless address(0). | 
| sentValues | uint256[5] | The values to send:
    newRate: New loan interest rate.
    newPrincipal: New loan size (borrowAmount + any borrowed interest).
    torqueInterest: New amount of interest to escrow for Torque loan (determines initial loan length).
    loanTokenReceived: Total loanToken deposit (amount not sent to borrower in the case of Torque loans).
    collateralTokenReceived: Total collateralToken deposit. | 
| loanDataBytes | bytes | The payload for the call. These loan DataBytes are
  additional loan data (not in use for token swaps).
	 * | 

### setDelegatedManager

Set the delegated manager.
	 *

```js
function setDelegatedManager(bytes32 loanId, address delegated, bool toggle) external nonpayable whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan. If 0, start a new loan. | 
| delegated | address | The address of the delegated manager. | 
| toggle | bool | The flag true/false for the delegated manager. | 

### getEstimatedMarginExposure

Get the estimated margin exposure.
	 * Margin is the money borrowed from a broker to purchase an investment
and is the difference between the total value of investment and the
loan amount. Margin trading refers to the practice of using borrowed
funds from a broker to trade a financial asset, which forms the
collateral for the loan from the broker.
	 *

```js
function getEstimatedMarginExposure(address loanToken, address collateralToken, uint256 loanTokenSent, uint256 collateralTokenSent, uint256 interestRate, uint256 newPrincipal) external view
returns(uint256)
```

**Returns**

The margin exposure.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The loan token instance address. | 
| collateralToken | address | The collateral token instance address. | 
| loanTokenSent | uint256 | The amount of loan tokens sent. | 
| collateralTokenSent | uint256 | The amount of collateral tokens sent. | 
| interestRate | uint256 | The interest rate. Percentage w/ 18 decimals. | 
| newPrincipal | uint256 | The updated amount of principal (current debt).
	 * | 

### getRequiredCollateral

Get the required collateral.
	 *

```js
function getRequiredCollateral(address loanToken, address collateralToken, uint256 newPrincipal, uint256 marginAmount, bool isTorqueLoan) public view
returns(collateralAmountRequired uint256)
```

**Returns**

collateralAmountRequired The required collateral.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The loan token instance address. | 
| collateralToken | address | The collateral token instance address. | 
| newPrincipal | uint256 | The updated amount of principal (current debt). | 
| marginAmount | uint256 | The amount of margin of the trade. | 
| isTorqueLoan | bool | Whether the loan is a Torque loan.
	 * | 

### getBorrowAmount

Get the borrow amount of a trade loan.
	 *

```js
function getBorrowAmount(address loanToken, address collateralToken, uint256 collateralTokenAmount, uint256 marginAmount, bool isTorqueLoan) public view
returns(borrowAmount uint256)
```

**Returns**

borrowAmount The borrow amount.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The loan token instance address. | 
| collateralToken | address | The collateral token instance address. | 
| collateralTokenAmount | uint256 | The amount of collateral. | 
| marginAmount | uint256 | The amount of margin of the trade. | 
| isTorqueLoan | bool | Whether the loan is a Torque loan.
	 * | 

### _borrowOrTrade

Borrow or trade.
	 *

```js
function _borrowOrTrade(struct LoanParamsStruct.LoanParams loanParamsLocal, bytes32 loanId, bool isTorqueLoan, uint256 collateralAmountRequired, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues, bytes loanDataBytes) internal nonpayable
returns(uint256, uint256)
```

**Returns**

The new loan size.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters. | 
| loanId | bytes32 | The ID of the loan. If 0, start a new loan. | 
| isTorqueLoan | bool | Whether the loan is a Torque loan. | 
| collateralAmountRequired | uint256 | The required amount of collateral. | 
| initialMargin | uint256 | The initial amount of margin. | 
| sentAddresses | address[4] | The addresses to send tokens: lender, borrower,
  receiver and manager:
    lender: must match loan if loanId provided.
    borrower: must match loan if loanId provided.
    receiver: receiver of funds (address(0) assumes borrower address).
    manager: delegated manager of loan unless address(0). | 
| sentValues | uint256[5] | The values to send:
    newRate: New loan interest rate.
    newPrincipal: New loan size (borrowAmount + any borrowed interest).
    torqueInterest: New amount of interest to escrow for Torque loan (determines initial loan length).
    loanTokenReceived: Total loanToken deposit (amount not sent to borrower in the case of Torque loans).
    collateralTokenReceived: Total collateralToken deposit. | 
| loanDataBytes | bytes | The payload for the call. These loan DataBytes are
  additional loan data (not in use for token swaps).
	 * | 

### _finalizeOpen

Finalize an open loan.
	 *

```js
function _finalizeOpen(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, address[4] sentAddresses, uint256[5] sentValues, bool isTorqueLoan) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters. | 
| loanLocal | struct LoanStruct.Loan | The loan object. | 
| sentAddresses | address[4] | The addresses to send tokens: lender, borrower,
  receiver and manager:
    lender: must match loan if loanId provided.
    borrower: must match loan if loanId provided.
    receiver: receiver of funds (address(0) assumes borrower address).
    manager: delegated manager of loan unless address(0). | 
| sentValues | uint256[5] | The values to send:
    newRate: New loan interest rate.
    newPrincipal: New loan size (borrowAmount + any borrowed interest).
    torqueInterest: New amount of interest to escrow for Torque loan (determines initial loan length).
    loanTokenReceived: Total loanToken deposit (amount not sent to borrower in the case of Torque loans).
    collateralTokenReceived: Total collateralToken deposit. | 
| isTorqueLoan | bool | Whether the loan is a Torque loan. | 

### _emitOpeningEvents

Emit the opening events.
	 *

```js
function _emitOpeningEvents(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, address[4] sentAddresses, uint256[5] sentValues, uint256 collateralToLoanRate, uint256 margin, bool isTorqueLoan) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters. | 
| loanLocal | struct LoanStruct.Loan | The loan object. | 
| sentAddresses | address[4] | The addresses to send tokens: lender, borrower,
  receiver and manager:
    lender: must match loan if loanId provided.
    borrower: must match loan if loanId provided.
    receiver: receiver of funds (address(0) assumes borrower address).
    manager: delegated manager of loan unless address(0). | 
| sentValues | uint256[5] | The values to send:
    newRate: New loan interest rate.
    newPrincipal: New loan size (borrowAmount + any borrowed interest).
    torqueInterest: New amount of interest to escrow for Torque loan (determines initial loan length).
    loanTokenReceived: Total loanToken deposit (amount not sent to borrower in the case of Torque loans).
    collateralTokenReceived: Total collateralToken deposit. | 
| collateralToLoanRate | uint256 | The exchange rate from collateral to loan
  tokens. | 
| margin | uint256 | The amount of margin of the trade. | 
| isTorqueLoan | bool | Whether the loan is a Torque loan. | 

### _setDelegatedManager

Set the delegated manager.
	 *

```js
function _setDelegatedManager(bytes32 loanId, address delegator, address delegated, bool toggle) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan. If 0, start a new loan. | 
| delegator | address | The address of previous manager. | 
| delegated | address | The address of the delegated manager. | 
| toggle | bool | The flag true/false for the delegated manager. | 

### _isCollateralSatisfied

Calculate whether the collateral is satisfied.
	 *

```js
function _isCollateralSatisfied(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 initialMargin, uint256 newCollateral, uint256 collateralAmountRequired) internal view
returns(bool)
```

**Returns**

Whether the collateral is satisfied.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters. | 
| loanLocal | struct LoanStruct.Loan | The loan object. | 
| initialMargin | uint256 | The initial amount of margin. | 
| newCollateral | uint256 | The amount of new collateral. | 
| collateralAmountRequired | uint256 | The amount of required collateral.
	 * | 

### _initializeLoan

Initialize a loan.
	 *

```js
function _initializeLoan(struct LoanParamsStruct.LoanParams loanParamsLocal, bytes32 loanId, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues) internal nonpayable
returns(bytes32)
```

**Returns**

The loanId.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters. | 
| loanId | bytes32 | The ID of the loan. | 
| initialMargin | uint256 | The amount of margin of the trade. | 
| sentAddresses | address[4] | The addresses to send tokens: lender, borrower,
  receiver and manager:
    lender: must match loan if loanId provided.
    borrower: must match loan if loanId provided.
    receiver: receiver of funds (address(0) assumes borrower address).
    manager: delegated manager of loan unless address(0). | 
| sentValues | uint256[5] | The values to send:
    newRate: New loan interest rate.
    newPrincipal: New loan size (borrowAmount + any borrowed interest).
    torqueInterest: New amount of interest to escrow for Torque loan (determines initial loan length).
    loanTokenReceived: Total loanToken deposit (amount not sent to borrower in the case of Torque loans).
    collateralTokenReceived: Total collateralToken deposit. | 

### _initializeInterest

Initialize a loan interest.
	 *

```js
function _initializeInterest(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 newRate, uint256 newPrincipal, uint256 torqueInterest) internal nonpayable
returns(interestAmountRequired uint256)
```

**Returns**

interestAmountRequired The interest amount required.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters. | 
| loanLocal | struct LoanStruct.Loan | The loan object. | 
| newRate | uint256 | The new interest rate of the loan. | 
| newPrincipal | uint256 | The new principal amount of the loan. | 
| torqueInterest | uint256 | The interest rate of the Torque loan.
	 * | 

### _getRequiredCollateral

Get the required collateral.
	 *

```js
function _getRequiredCollateral(address loanToken, address collateralToken, uint256 newPrincipal, uint256 marginAmount, bool isTorqueLoan) internal view
returns(collateralTokenAmount uint256)
```

**Returns**

collateralTokenAmount The required collateral.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The loan token instance address. | 
| collateralToken | address | The collateral token instance address. | 
| newPrincipal | uint256 | The updated amount of principal (current debt). | 
| marginAmount | uint256 | The amount of margin of the trade. | 
| isTorqueLoan | bool | Whether the loan is a Torque loan.
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
