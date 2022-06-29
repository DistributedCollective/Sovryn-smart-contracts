# LoanClosingsRollover contract. (LoanClosingsRollover.sol)

View Source: [contracts/modules/LoanClosingsRollover.sol](../contracts/modules/LoanClosingsRollover.sol)

**↗ Extends: [LoanClosingsShared](LoanClosingsShared.md), [LiquidationHelper](LiquidationHelper.md)**

**LoanClosingsRollover**

Ways to close a loan: rollover. Margin trade
  positions are always closed with a swap.
 *

## Contract Members
**Constants & Variables**

```js
uint256 internal constant MONTH;

```

## Functions

- [constructor()](#constructor)
- [constructor()](#constructor)
- [initialize(address target)](#initialize)
- [rollover(bytes32 loanId, bytes )](#rollover)
- [_rollover(bytes32 loanId, bytes loanDataBytes)](#_rollover)
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
        address prevModuleContractAddress = logicTargets[this.rollover.selector];
        _setTarget(this.rollover.selector, target);
        emit ProtocolModuleContractReplaced(
            prevModuleContractAddress,
            target,
            "LoanClosingsRollover"
        );
    }
```
</details>

---    

> ### rollover

Roll over a loan.
     *

```solidity
function rollover(bytes32 loanId, bytes ) external nonpayable nonReentrant whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan to roll over. // param calldata The payload for the call. These loan DataBytes are additional loan data (not in use for token swaps). | 
|  | bytes | loanId The ID of the loan to roll over. // param calldata The payload for the call. These loan DataBytes are additional loan data (not in use for token swaps). | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function rollover(
        bytes32 loanId,
        bytes calldata // for future use /*loanDataBytes*/
    ) external nonReentrant whenNotPaused {
        // restrict to EOAs to prevent griefing attacks, during interest rate recalculation
        require(msg.sender == tx.origin, "EOAs call");

        return
            _rollover(
                loanId,
                "" // loanDataBytes
            );
    }
```
</details>

---    

> ### _rollover

Internal function for roll over a loan.
     * Each loan has a duration. In case of a margin trade it is set to 28
days, in case of borrowing, it can be set by the user. On loan
openning, the user pays the interest for this duration in advance.
If closing early, he gets the excess refunded. If it is not closed
before the end date, it needs to be rolled over. On rollover the
interest is paid for the next period. In case of margin trading
it's 28 days, in case of borrowing it's a month.
     *

```solidity
function _rollover(bytes32 loanId, bytes loanDataBytes) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan to roll over. | 
| loanDataBytes | bytes | The payload for the call. These loan DataBytes are   additional loan data (not in use for token swaps). | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _rollover(bytes32 loanId, bytes memory loanDataBytes) internal {
        (Loan storage loanLocal, LoanParams storage loanParamsLocal) = _checkLoan(loanId);
        require(block.timestamp > loanLocal.endTimestamp.sub(3600), "healthy position");
        require(loanPoolToUnderlying[loanLocal.lender] != address(0), "invalid lender");

        // pay outstanding interest to lender
        _payInterest(loanLocal.lender, loanParamsLocal.loanToken);

        LoanInterest storage loanInterestLocal = loanInterest[loanLocal.id];
        LenderInterest storage lenderInterestLocal =
            lenderInterest[loanLocal.lender][loanParamsLocal.loanToken];

        _settleFeeRewardForInterestExpense(
            loanInterestLocal,
            loanLocal.id,
            loanParamsLocal.loanToken, /// fee token
            loanParamsLocal.collateralToken, /// pairToken (used to check if there is any special rebates or not) -- to pay fee reward
            loanLocal.borrower,
            block.timestamp
        );

        // Handle back interest: calculates interest owned since the loan endtime passed but the loan remained open
        uint256 backInterestTime;
        uint256 backInterestOwed;
        if (block.timestamp > loanLocal.endTimestamp) {
            backInterestTime = block.timestamp.sub(loanLocal.endTimestamp);
            backInterestOwed = backInterestTime.mul(loanInterestLocal.owedPerDay);
            backInterestOwed = backInterestOwed.div(1 days);
        }

        //note: to avoid code duplication, it would be nicer to store loanParamsLocal.maxLoanTerm in a local variable
        //however, we've got stack too deep issues if we do so.
        if (loanParamsLocal.maxLoanTerm != 0) {
            // fixed-term loan, so need to query iToken for latest variable rate
            uint256 owedPerDay =
                loanLocal.principal.mul(ILoanPool(loanLocal.lender).borrowInterestRate()).div(
                    365 * 10**20
                );

            lenderInterestLocal.owedPerDay = lenderInterestLocal.owedPerDay.add(owedPerDay);
            lenderInterestLocal.owedPerDay = lenderInterestLocal.owedPerDay.sub(
                loanInterestLocal.owedPerDay
            );

            loanInterestLocal.owedPerDay = owedPerDay;

            //if the loan has been open for longer than an additional period, add at least 1 additional day
            if (backInterestTime >= loanParamsLocal.maxLoanTerm) {
                loanLocal.endTimestamp = loanLocal.endTimestamp.add(backInterestTime).add(1 days);
            }
            //extend by the max loan term
            else {
                loanLocal.endTimestamp = loanLocal.endTimestamp.add(loanParamsLocal.maxLoanTerm);
            }
        } else {
            // loanInterestLocal.owedPerDay doesn't change
            if (backInterestTime >= MONTH) {
                loanLocal.endTimestamp = loanLocal.endTimestamp.add(backInterestTime).add(1 days);
            } else {
                loanLocal.endTimestamp = loanLocal.endTimestamp.add(MONTH);
            }
        }

        uint256 interestAmountRequired = loanLocal.endTimestamp.sub(block.timestamp);
        interestAmountRequired = interestAmountRequired.mul(loanInterestLocal.owedPerDay);
        interestAmountRequired = interestAmountRequired.div(1 days);

        loanInterestLocal.depositTotal = loanInterestLocal.depositTotal.add(
            interestAmountRequired
        );

        lenderInterestLocal.owedTotal = lenderInterestLocal.owedTotal.add(interestAmountRequired);

        // add backInterestOwed
        interestAmountRequired = interestAmountRequired.add(backInterestOwed);

        // collect interest (needs to be converted from the collateral)
        (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed, ) =
            _doCollateralSwap(
                loanLocal,
                loanParamsLocal,
                0, //min swap 0 -> swap connector estimates the amount of source tokens to use
                interestAmountRequired, //required destination tokens
                true, // returnTokenIsCollateral
                loanDataBytes
            );

        //received more tokens than needed to pay the interest
        if (destTokenAmountReceived > interestAmountRequired) {
            // swap rest back to collateral, if the amount is big enough to cover gas cost
            if (
                worthTheTransfer(
                    loanParamsLocal.loanToken,
                    destTokenAmountReceived - interestAmountRequired
                )
            ) {
                (destTokenAmountReceived, , ) = _swapBackExcess(
                    loanLocal,
                    loanParamsLocal,
                    destTokenAmountReceived - interestAmountRequired, //amount to be swapped
                    loanDataBytes
                );
                sourceTokenAmountUsed = sourceTokenAmountUsed.sub(destTokenAmountReceived);
            }
            //else give it to the protocol as a lending fee
            else {
                _payLendingFee(
                    loanLocal.borrower,
                    loanParamsLocal.loanToken,
                    destTokenAmountReceived - interestAmountRequired
                );
            }
        }

        //subtract the interest from the collateral
        loanLocal.collateral = loanLocal.collateral.sub(sourceTokenAmountUsed);

        if (backInterestOwed != 0) {
            // pay out backInterestOwed

            _payInterestTransfer(loanLocal.lender, loanParamsLocal.loanToken, backInterestOwed);
        }

        uint256 rolloverReward =
            _getRolloverReward(
                loanParamsLocal.collateralToken,
                loanParamsLocal.loanToken,
                loanLocal.principal
            );

        if (rolloverReward != 0) {
            // if the reward > collateral:
            if (rolloverReward > loanLocal.collateral) {
                // 1. pay back the remaining loan to the lender
                // 2. pay the remaining collateral to msg.sender
                // 3. close the position & emit close event
                _closeWithSwap(
                    loanLocal.id,
                    msg.sender,
                    loanLocal.collateral,
                    false,
                    "" // loanDataBytes
                );
            } else {
                // pay out reward to caller
                loanLocal.collateral = loanLocal.collateral.sub(rolloverReward);

                _withdrawAsset(loanParamsLocal.collateralToken, msg.sender, rolloverReward);
            }
        }

        if (loanLocal.collateral > 0) {
            //close whole loan if tiny position will remain
            if (_getAmountInRbtc(loanParamsLocal.loanToken, loanLocal.principal) <= TINY_AMOUNT) {
                _closeWithSwap(
                    loanLocal.id,
                    loanLocal.borrower,
                    loanLocal.collateral, // swap all collaterals
                    false,
                    "" /// loanDataBytes
                );
            } else {
                (uint256 currentMargin, ) =
                    IPriceFeeds(priceFeeds).getCurrentMargin(
                        loanParamsLocal.loanToken,
                        loanParamsLocal.collateralToken,
                        loanLocal.principal,
                        loanLocal.collateral
                    );

                require(
                    currentMargin > 3 ether, // ensure there's more than 3% margin remaining
                    "unhealthy position"
                );
            }
        }

        if (loanLocal.active) {
            emit Rollover(
                loanLocal.borrower, // user (borrower)
                loanLocal.lender, // lender
                loanLocal.id, // loanId
                loanLocal.principal, // principal
                loanLocal.collateral, // collateral
                loanLocal.endTimestamp, // endTimestamp
                msg.sender, // rewardReceiver
                rolloverReward // reward
            );
        }
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
