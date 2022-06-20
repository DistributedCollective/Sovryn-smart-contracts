# ProtocolLike.sol

View Source: [contracts/connectors/loantoken/interfaces/ProtocolLike.sol](../contracts/connectors/loantoken/interfaces/ProtocolLike.sol)

**ProtocolLike**

## Functions

- [borrowOrTradeFromPool(bytes32 loanParamsId, bytes32 loanId, bool isTorqueLoan, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues, bytes loanDataBytes)](#borrowortradefrompool)
- [getTotalPrincipal(address lender, address loanToken)](#gettotalprincipal)
- [withdrawAccruedInterest(address loanToken)](#withdrawaccruedinterest)
- [getLenderInterestData(address lender, address loanToken)](#getlenderinterestdata)
- [priceFeeds()](#pricefeeds)
- [getEstimatedMarginExposure(address loanToken, address collateralToken, uint256 loanTokenSent, uint256 collateralTokenSent, uint256 interestRate, uint256 newPrincipal)](#getestimatedmarginexposure)
- [getRequiredCollateral(address loanToken, address collateralToken, uint256 newPrincipal, uint256 marginAmount, bool isTorqueLoan)](#getrequiredcollateral)
- [getBorrowAmount(address loanToken, address collateralToken, uint256 collateralTokenAmount, uint256 marginAmount, bool isTorqueLoan)](#getborrowamount)
- [isLoanPool(address loanPool)](#isloanpool)
- [lendingFeePercent()](#lendingfeepercent)
- [getSwapExpectedReturn(address sourceToken, address destToken, uint256 sourceTokenAmount)](#getswapexpectedreturn)

---    

> ### borrowOrTradeFromPool

```solidity
function borrowOrTradeFromPool(bytes32 loanParamsId, bytes32 loanId, bool isTorqueLoan, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues, bytes loanDataBytes) external payable
returns(newPrincipal uint256, newCollateral uint256)
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
    ) external payable returns (uint256 newPrincipal, uint256 newCollateral);
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

> ### priceFeeds

```solidity
function priceFeeds() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function priceFeeds() external view returns (address);
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

> ### lendingFeePercent

```solidity
function lendingFeePercent() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function lendingFeePercent() external view returns (uint256);
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
