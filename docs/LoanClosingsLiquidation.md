# LoanClosingsLiquidation contract. (LoanClosingsLiquidation.sol)

View Source: [contracts/modules/LoanClosingsLiquidation.sol](../contracts/modules/LoanClosingsLiquidation.sol)

**↗ Extends: [LoanClosingsShared](LoanClosingsShared.md), [LiquidationHelper](LiquidationHelper.md)**

**LoanClosingsLiquidation**

Ways to close a loan: liquidation. Margin trade
  positions are always closed with a swap.
 * Loans are liquidated if the position goes below margin maintenance.

## Contract Members
**Constants & Variables**

```js
uint256 internal constant MONTH;

```

## Functions

- [constructor()](#constructor)
- [constructor()](#constructor)
- [initialize(address target)](#initialize)
- [liquidate(bytes32 loanId, address receiver, uint256 closeAmount)](#liquidate)
- [_liquidate(bytes32 loanId, address receiver, uint256 closeAmount)](#_liquidate)
- [_swapBackExcess(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 swapAmount, bytes loanDataBytes)](#_swapbackexcess)

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
        address prevModuleContractAddress = logicTargets[this.liquidate.selector];
        _setTarget(this.liquidate.selector, target);
        emit ProtocolModuleContractReplaced(
            prevModuleContractAddress,
            target,
            "LoanClosingsLiquidation"
        );
    }
```
</details>

---    

> ### liquidate

Liquidate an unhealty loan.
     *

```solidity
function liquidate(bytes32 loanId, address receiver, uint256 closeAmount) external payable nonReentrant whenNotPaused 
returns(loanCloseAmount uint256, seizedAmount uint256, seizedToken address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan to liquidate.   loanId is the ID of the loan, which is created on loan opening.   It can be obtained either by parsing the Trade event or by reading   the open loans from the contract by calling getActiveLoans or getUserLoans. | 
| receiver | address | The receiver of the seized amount. | 
| closeAmount | uint256 | The amount to close in loanTokens.      * | 

**Returns**

loanCloseAmount The amount of the collateral token of the loan.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function liquidate(
        bytes32 loanId,
        address receiver,
        uint256 closeAmount // denominated in loanToken
    )
        external
        payable
        nonReentrant
        whenNotPaused
        returns (
            uint256 loanCloseAmount,
            uint256 seizedAmount,
            address seizedToken
        )
    {
        return _liquidate(loanId, receiver, closeAmount);
    }
```
</details>

---    

> ### _liquidate

Internal function for liquidating an unhealthy loan.
     * The caller needs to approve the closeAmount prior to calling. Will
not liquidate more than is needed to restore the desired margin
(maintenance +5%).
     * Whenever the current margin of a loan falls below maintenance margin,
it needs to be liquidated. Anybody can initiate a liquidation and buy
the collateral tokens at a discounted rate (5%).
     *

```solidity
function _liquidate(bytes32 loanId, address receiver, uint256 closeAmount) internal nonpayable
returns(loanCloseAmount uint256, seizedAmount uint256, seizedToken address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan to liquidate. | 
| receiver | address | The receiver of the seized amount. | 
| closeAmount | uint256 | The amount to close in loanTokens.      * | 

**Returns**

loanCloseAmount The amount of the collateral token of the loan.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _liquidate(
        bytes32 loanId,
        address receiver,
        uint256 closeAmount
    )
        internal
        returns (
            uint256 loanCloseAmount,
            uint256 seizedAmount,
            address seizedToken
        )
    {
        (Loan storage loanLocal, LoanParams storage loanParamsLocal) = _checkLoan(loanId);

        (uint256 currentMargin, uint256 collateralToLoanRate) =
            IPriceFeeds(priceFeeds).getCurrentMargin(
                loanParamsLocal.loanToken,
                loanParamsLocal.collateralToken,
                loanLocal.principal,
                loanLocal.collateral
            );
        require(currentMargin <= loanParamsLocal.maintenanceMargin, "healthy position");

        loanCloseAmount = closeAmount;

        //amounts to restore the desired margin (maintencance + 5%)
        (uint256 maxLiquidatable, uint256 maxSeizable, ) =
            _getLiquidationAmounts(
                loanLocal.principal,
                loanLocal.collateral,
                currentMargin,
                loanParamsLocal.maintenanceMargin,
                collateralToLoanRate
            );

        if (loanCloseAmount < maxLiquidatable) {
            //close maxLiquidatable if tiny position will remain
            uint256 remainingAmount = maxLiquidatable - loanCloseAmount;
            remainingAmount = _getAmountInRbtc(loanParamsLocal.loanToken, remainingAmount);
            if (remainingAmount <= TINY_AMOUNT) {
                loanCloseAmount = maxLiquidatable;
                seizedAmount = maxSeizable;
            } else {
                seizedAmount = maxSeizable.mul(loanCloseAmount).div(maxLiquidatable);
            }
        } else if (loanCloseAmount > maxLiquidatable) {
            // adjust down the close amount to the max
            loanCloseAmount = maxLiquidatable;
            seizedAmount = maxSeizable;
        } else {
            seizedAmount = maxSeizable;
        }

        require(loanCloseAmount != 0, "nothing to liquidate");

        // liquidator deposits the principal being closed
        _returnPrincipalWithDeposit(loanParamsLocal.loanToken, address(this), loanCloseAmount);

        // a portion of the principal is repaid to the lender out of interest refunded
        uint256 loanCloseAmountLessInterest =
            _settleInterestToPrincipal(
                loanLocal,
                loanParamsLocal,
                loanCloseAmount,
                loanLocal.borrower
            );

        if (loanCloseAmount > loanCloseAmountLessInterest) {
            // full interest refund goes to the borrower
            _withdrawAsset(
                loanParamsLocal.loanToken,
                loanLocal.borrower,
                loanCloseAmount - loanCloseAmountLessInterest
            );
        }

        if (loanCloseAmountLessInterest != 0) {
            // The lender always gets back an ERC20 (even wrbtc), so we call withdraw directly rather than
            // use the _withdrawAsset helper function
            vaultWithdraw(
                loanParamsLocal.loanToken,
                loanLocal.lender,
                loanCloseAmountLessInterest
            );
        }

        seizedToken = loanParamsLocal.collateralToken;

        if (seizedAmount != 0) {
            loanLocal.collateral = loanLocal.collateral.sub(seizedAmount);

            _withdrawAsset(seizedToken, receiver, seizedAmount);
        }

        _closeLoan(loanLocal, loanCloseAmount);

        _emitClosingEvents(
            loanParamsLocal,
            loanLocal,
            loanCloseAmount,
            seizedAmount,
            collateralToLoanRate,
            0,
            currentMargin,
            CloseTypes.Liquidation
        );
    }
```
</details>

---    

> ### _swapBackExcess

Swap back excessive loan tokens to collateral tokens.
     *

```solidity
function _swapBackExcess(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 swapAmount, bytes loanDataBytes) internal nonpayable
returns(destTokenAmountReceived uint256, sourceTokenAmountUsed uint256, collateralToLoanSwapRate uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanLocal | struct LoanStruct.Loan | The loan object. | 
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters. | 
| swapAmount | uint256 | The amount to be swapped. | 
| loanDataBytes | bytes | Additional loan data (not in use for token swaps).      * | 

**Returns**

destTokenAmountReceived The amount of destiny tokens received.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _swapBackExcess(
        Loan memory loanLocal,
        LoanParams memory loanParamsLocal,
        uint256 swapAmount,
        bytes memory loanDataBytes
    )
        internal
        returns (
            uint256 destTokenAmountReceived,
            uint256 sourceTokenAmountUsed,
            uint256 collateralToLoanSwapRate
        )
    {
        (destTokenAmountReceived, sourceTokenAmountUsed, collateralToLoanSwapRate) = _loanSwap(
            loanLocal.id,
            loanParamsLocal.loanToken,
            loanParamsLocal.collateralToken,
            loanLocal.borrower,
            swapAmount, // minSourceTokenAmount
            swapAmount, // maxSourceTokenAmount
            0, // requiredDestTokenAmount
            false, // bypassFee
            loanDataBytes
        );
        require(sourceTokenAmountUsed <= swapAmount, "excessive source amount");
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
