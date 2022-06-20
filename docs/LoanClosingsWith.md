# LoanClosingsWith contract. (LoanClosingsWith.sol)

View Source: [contracts/modules/LoanClosingsWith.sol](../contracts/modules/LoanClosingsWith.sol)

**↗ Extends: [LoanClosingsShared](LoanClosingsShared.md)**

**LoanClosingsWith**

Close a loan w/deposit, close w/swap. There are 2 functions for ending a loan on the
  protocol contract: closeWithSwap and closeWithDeposit. Margin trade
  positions are always closed with a swap.
 * Loans are liquidated if the position goes below margin maintenance.

## Functions

- [constructor()](#constructor)
- [constructor()](#constructor)
- [initialize(address target)](#initialize)
- [closeWithDeposit(bytes32 loanId, address receiver, uint256 depositAmount)](#closewithdeposit)
- [closeWithSwap(bytes32 loanId, address receiver, uint256 swapAmount, bool returnTokenIsCollateral, bytes )](#closewithswap)
- [_closeWithDeposit(bytes32 loanId, address receiver, uint256 depositAmount)](#_closewithdeposit)
- [checkCloseWithDepositIsTinyPosition(bytes32 loanId, uint256 depositAmount)](#checkclosewithdepositistinyposition)

---    

> ### constructor

```solidity
function () public nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor() public {}
```
</details>

---    

> ### constructor

```solidity
function () external nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function() external {
        revert("fallback not allowed");
    }
```
</details>

---    

> ### initialize

```solidity
function initialize(address target) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function initialize(address target) external onlyOwner {
        address prevModuleContractAddress = logicTargets[this.closeWithDeposit.selector];
        _setTarget(this.closeWithDeposit.selector, target);
        _setTarget(this.closeWithSwap.selector, target);
        _setTarget(this.checkCloseWithDepositIsTinyPosition.selector, target);
        emit ProtocolModuleContractReplaced(prevModuleContractAddress, target, "LoanClosingsWith");
    }
```
</details>

---    

> ### closeWithDeposit

Closes a loan by doing a deposit.
     *

```solidity
function closeWithDeposit(bytes32 loanId, address receiver, uint256 depositAmount) public payable nonReentrant whenNotPaused 
returns(loanCloseAmount uint256, withdrawAmount uint256, withdrawToken address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The id of the loan. | 
| receiver | address | The receiver of the remainder. | 
| depositAmount | uint256 | Defines how much of the position should be closed.   It is denominated in loan tokens. (e.g. rBTC on a iSUSD contract).     If depositAmount > principal, the complete loan will be closed     else deposit amount (partial closure).      * | 

**Returns**

loanCloseAmount The amount of the collateral token of the loan.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function closeWithDeposit(
        bytes32 loanId,
        address receiver,
        uint256 depositAmount /// Denominated in loanToken.
    )
        public
        payable
        nonReentrant
        whenNotPaused
        returns (
            uint256 loanCloseAmount,
            uint256 withdrawAmount,
            address withdrawToken
        )
    {
        _checkAuthorized(loanId);
        return _closeWithDeposit(loanId, receiver, depositAmount);
    }
```
</details>

---    

> ### closeWithSwap

Close a position by swapping the collateral back to loan tokens
paying the lender and withdrawing the remainder.
     *

```solidity
function closeWithSwap(bytes32 loanId, address receiver, uint256 swapAmount, bool returnTokenIsCollateral, bytes ) public nonpayable nonReentrant whenNotPaused 
returns(loanCloseAmount uint256, withdrawAmount uint256, withdrawToken address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The id of the loan. | 
| receiver | address | The receiver of the remainder (unused collateral + profit). | 
| swapAmount | uint256 | Defines how much of the position should be closed and   is denominated in collateral tokens.      If swapAmount >= collateral, the complete position will be closed.      Else if returnTokenIsCollateral, (swapAmount/collateral) * principal will be swapped (partial closure).      Else coveredPrincipal | 
| returnTokenIsCollateral | bool | Defines if the remainder should be paid out   in collateral tokens or underlying loan tokens.      * | 
|  | bytes | loanId The id of the loan. | 

**Returns**

loanCloseAmount The amount of the collateral token of the loan.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function closeWithSwap(
        bytes32 loanId,
        address receiver,
        uint256 swapAmount, // denominated in collateralToken
        bool returnTokenIsCollateral, // true: withdraws collateralToken, false: withdraws loanToken
        bytes memory // for future use /*loanDataBytes*/
    )
        public
        nonReentrant
        whenNotPaused
        returns (
            uint256 loanCloseAmount,
            uint256 withdrawAmount,
            address withdrawToken
        )
    {
        _checkAuthorized(loanId);
        return
            _closeWithSwap(
                loanId,
                receiver,
                swapAmount,
                returnTokenIsCollateral,
                "" /// loanDataBytes
            );
    }
```
</details>

---    

> ### _closeWithDeposit

Internal function for closing a loan by doing a deposit.
     *

```solidity
function _closeWithDeposit(bytes32 loanId, address receiver, uint256 depositAmount) internal nonpayable
returns(loanCloseAmount uint256, withdrawAmount uint256, withdrawToken address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The id of the loan. | 
| receiver | address | The receiver of the remainder. | 
| depositAmount | uint256 | Defines how much of the position should be closed.   It is denominated in loan tokens.     If depositAmount > principal, the complete loan will be closed     else deposit amount (partial closure).      * | 

**Returns**

loanCloseAmount The amount of the collateral token of the loan.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _closeWithDeposit(
        bytes32 loanId,
        address receiver,
        uint256 depositAmount /// Denominated in loanToken.
    )
        internal
        returns (
            uint256 loanCloseAmount,
            uint256 withdrawAmount,
            address withdrawToken
        )
    {
        require(depositAmount != 0, "depositAmount == 0");

        //TODO should we skip this check if invoked from rollover ?
        (Loan storage loanLocal, LoanParams storage loanParamsLocal) = _checkLoan(loanId);

        /// Can't close more than the full principal.
        loanCloseAmount = depositAmount > loanLocal.principal
            ? loanLocal.principal
            : depositAmount;

        //revert if tiny position remains
        uint256 remainingAmount = loanLocal.principal - loanCloseAmount;
        if (remainingAmount > 0) {
            require(
                _getAmountInRbtc(loanParamsLocal.loanToken, remainingAmount) > TINY_AMOUNT,
                "Tiny amount when closing with deposit"
            );
        }

        uint256 loanCloseAmountLessInterest =
            _settleInterestToPrincipal(loanLocal, loanParamsLocal, loanCloseAmount, receiver);

        if (loanCloseAmountLessInterest != 0) {
            _returnPrincipalWithDeposit(
                loanParamsLocal.loanToken,
                loanLocal.lender,
                loanCloseAmountLessInterest
            );
        }

        if (loanCloseAmount == loanLocal.principal) {
            withdrawAmount = loanLocal.collateral;
        } else {
            withdrawAmount = loanLocal.collateral.mul(loanCloseAmount).div(loanLocal.principal);
        }

        withdrawToken = loanParamsLocal.collateralToken;

        if (withdrawAmount != 0) {
            loanLocal.collateral = loanLocal.collateral.sub(withdrawAmount);
            _withdrawAsset(withdrawToken, receiver, withdrawAmount);
        }

        _finalizeClose(
            loanLocal,
            loanParamsLocal,
            loanCloseAmount,
            withdrawAmount, /// collateralCloseAmount
            0, /// collateralToLoanSwapRate
            CloseTypes.Deposit
        );
    }
```
</details>

---    

> ### checkCloseWithDepositIsTinyPosition

Function to check whether the given loanId & deposit amount when closing with deposit will cause the tiny position
     *

```solidity
function checkCloseWithDepositIsTinyPosition(bytes32 loanId, uint256 depositAmount) external view
returns(isTinyPosition bool, tinyPositionAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The id of the loan. | 
| depositAmount | uint256 | Defines how much the deposit amount to close the position.      * | 

**Returns**

isTinyPosition true is indicating tiny position, false otherwise.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function checkCloseWithDepositIsTinyPosition(bytes32 loanId, uint256 depositAmount)
        external
        view
        returns (bool isTinyPosition, uint256 tinyPositionAmount)
    {
        (Loan memory loanLocal, LoanParams memory loanParamsLocal) = _checkLoan(loanId);

        if (depositAmount < loanLocal.principal) {
            uint256 remainingAmount = loanLocal.principal - depositAmount;
            uint256 remainingRBTCAmount =
                _getAmountInRbtc(loanParamsLocal.loanToken, remainingAmount);
            if (remainingRBTCAmount < TINY_AMOUNT) {
                isTinyPosition = true;
                tinyPositionAmount = remainingRBTCAmount;
            }
        }

        return (isTinyPosition, tinyPositionAmount);
    }
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
