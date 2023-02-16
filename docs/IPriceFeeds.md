# IPriceFeeds.sol

View Source: [contracts/feeds/IPriceFeeds.sol](../contracts/feeds/IPriceFeeds.sol)

**IPriceFeeds**

## Functions

- [queryRate(address sourceToken, address destToken)](#queryrate)
- [queryPrecision(address sourceToken, address destToken)](#queryprecision)
- [queryReturn(address sourceToken, address destToken, uint256 sourceAmount)](#queryreturn)
- [checkPriceDisagreement(address sourceToken, address destToken, uint256 sourceAmount, uint256 destAmount, uint256 maxSlippage)](#checkpricedisagreement)
- [amountInEth(address Token, uint256 amount)](#amountineth)
- [getMaxDrawdown(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount, uint256 maintenanceMargin)](#getmaxdrawdown)
- [getCurrentMarginAndCollateralSize(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount)](#getcurrentmarginandcollateralsize)
- [getCurrentMargin(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount)](#getcurrentmargin)
- [shouldLiquidate(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount, uint256 maintenanceMargin)](#shouldliquidate)
- [getFastGasPrice(address payToken)](#getfastgasprice)

---    

> ### queryRate

```solidity
function queryRate(address sourceToken, address destToken) external view
returns(rate uint256, precision uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address |  | 
| destToken | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function queryRate(address sourceToken, address destToken)
        external
        view
        returns (uint256 rate, uint256 precision);
```
</details>

---    

> ### queryPrecision

```solidity
function queryPrecision(address sourceToken, address destToken) external view
returns(precision uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address |  | 
| destToken | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function queryPrecision(address sourceToken, address destToken)
        external
        view
        returns (uint256 precision);
```
</details>

---    

> ### queryReturn

```solidity
function queryReturn(address sourceToken, address destToken, uint256 sourceAmount) external view
returns(destAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address |  | 
| destToken | address |  | 
| sourceAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function queryReturn(
        address sourceToken,
        address destToken,
        uint256 sourceAmount
    ) external view returns (uint256 destAmount);
```
</details>

---    

> ### checkPriceDisagreement

```solidity
function checkPriceDisagreement(address sourceToken, address destToken, uint256 sourceAmount, uint256 destAmount, uint256 maxSlippage) external view
returns(sourceToDestSwapRate uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address |  | 
| destToken | address |  | 
| sourceAmount | uint256 |  | 
| destAmount | uint256 |  | 
| maxSlippage | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function checkPriceDisagreement(
        address sourceToken,
        address destToken,
        uint256 sourceAmount,
        uint256 destAmount,
        uint256 maxSlippage
    ) external view returns (uint256 sourceToDestSwapRate);
```
</details>

---    

> ### amountInEth

```solidity
function amountInEth(address Token, uint256 amount) external view
returns(ethAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| Token | address |  | 
| amount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function amountInEth(address Token, uint256 amount) external view returns (uint256 ethAmount);
```
</details>

---    

> ### getMaxDrawdown

```solidity
function getMaxDrawdown(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount, uint256 maintenanceMargin) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address |  | 
| collateralToken | address |  | 
| loanAmount | uint256 |  | 
| collateralAmount | uint256 |  | 
| maintenanceMargin | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getMaxDrawdown(
        address loanToken,
        address collateralToken,
        uint256 loanAmount,
        uint256 collateralAmount,
        uint256 maintenanceMargin
    ) external view returns (uint256);
```
</details>

---    

> ### getCurrentMarginAndCollateralSize

```solidity
function getCurrentMarginAndCollateralSize(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount) external view
returns(currentMargin uint256, collateralInEthAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address |  | 
| collateralToken | address |  | 
| loanAmount | uint256 |  | 
| collateralAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getCurrentMarginAndCollateralSize(
        address loanToken,
        address collateralToken,
        uint256 loanAmount,
        uint256 collateralAmount
    ) external view returns (uint256 currentMargin, uint256 collateralInEthAmount);
```
</details>

---    

> ### getCurrentMargin

```solidity
function getCurrentMargin(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount) external view
returns(currentMargin uint256, collateralToLoanRate uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address |  | 
| collateralToken | address |  | 
| loanAmount | uint256 |  | 
| collateralAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getCurrentMargin(
        address loanToken,
        address collateralToken,
        uint256 loanAmount,
        uint256 collateralAmount
    ) external view returns (uint256 currentMargin, uint256 collateralToLoanRate);
```
</details>

---    

> ### shouldLiquidate

```solidity
function shouldLiquidate(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount, uint256 maintenanceMargin) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address |  | 
| collateralToken | address |  | 
| loanAmount | uint256 |  | 
| collateralAmount | uint256 |  | 
| maintenanceMargin | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function shouldLiquidate(
        address loanToken,
        address collateralToken,
        uint256 loanAmount,
        uint256 collateralAmount,
        uint256 maintenanceMargin
    ) external view returns (bool);
```
</details>

---    

> ### getFastGasPrice

```solidity
function getFastGasPrice(address payToken) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| payToken | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getFastGasPrice(address payToken) external view returns (uint256);
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
