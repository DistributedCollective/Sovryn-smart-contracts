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

---    

> ### _getTradingFee

Calculate trading fee.

```solidity
function _getTradingFee(uint256 feeTokenAmount) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| feeTokenAmount | uint256 | The amount of tokens to trade. | 

**Returns**

The fee of the trade.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getTradingFee(uint256 feeTokenAmount) internal view returns (uint256) {
        return feeTokenAmount.mul(tradingFeePercent).divCeil(10**20);
    }
```
</details>

---    

> ### _getSwapExternalFee

Calculate swap external fee.

```solidity
function _getSwapExternalFee(uint256 feeTokenAmount) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| feeTokenAmount | uint256 | The amount of token to swap. | 

**Returns**

The fee of the swap.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getSwapExternalFee(uint256 feeTokenAmount) internal view returns (uint256) {
        return feeTokenAmount.mul(swapExtrernalFeePercent).divCeil(10**20);
    }
```
</details>

---    

> ### _getBorrowingFee

Calculate the loan origination fee.

```solidity
function _getBorrowingFee(uint256 feeTokenAmount) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| feeTokenAmount | uint256 | The amount of tokens to borrow. | 

**Returns**

The fee of the loan.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getBorrowingFee(uint256 feeTokenAmount) internal view returns (uint256) {
        return feeTokenAmount.mul(borrowingFeePercent).divCeil(10**20);
        /*
		// p3.9 from bzx peckshield-audit-report-bZxV2-v1.0rc1.pdf
		// cannot be applied solely nor with LoanOpenings.sol as it drives to some other tests failure
		uint256 collateralAmountRequired =
			feeTokenAmount.mul(10**20).divCeil(
				10**20 - borrowingFeePercent // never will overflow
			);
		return collateralAmountRequired.sub(feeTokenAmount);*/
    }
```
</details>

---    

> ### _payTradingFeeToAffiliate

Settle the trading fee and pay the token reward to the affiliates referrer.
     *

```solidity
function _payTradingFeeToAffiliate(address referrer, address trader, address feeToken, uint256 tradingFee) internal nonpayable
returns(affiliatesBonusSOVAmount uint256, affiliatesBonusTokenAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The affiliate referrer address to send the reward to. | 
| trader | address | The account that performs this trade. | 
| feeToken | address | The address of the token in which the trading fee is paid. | 
| tradingFee | uint256 | The amount of tokens accrued as fees on the trading.      * | 

**Returns**

affiliatesBonusSOVAmount the total SOV amount that is distributed to the referrer

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _payTradingFeeToAffiliate(
        address referrer,
        address trader,
        address feeToken,
        uint256 tradingFee
    ) internal returns (uint256 affiliatesBonusSOVAmount, uint256 affiliatesBonusTokenAmount) {
        (affiliatesBonusSOVAmount, affiliatesBonusTokenAmount) = ProtocolAffiliatesInterface(
            address(this)
        )
            .payTradingFeeToAffiliatesReferrer(referrer, trader, feeToken, tradingFee);
    }
```
</details>

---    

> ### _payTradingFee

Settle the trading fee and pay the token reward to the user.

```solidity
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

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _payTradingFee(
        address user,
        bytes32 loanId,
        address feeToken,
        address feeTokenPair,
        uint256 tradingFee
    ) internal {
        uint256 protocolTradingFee = tradingFee; /// Trading fee paid to protocol.
        if (tradingFee != 0) {
            if (affiliatesUserReferrer[user] != address(0)) {
                _payTradingFeeToAffiliate(
                    affiliatesUserReferrer[user],
                    user,
                    feeToken,
                    protocolTradingFee
                );
                protocolTradingFee = (
                    protocolTradingFee.sub(protocolTradingFee.mul(affiliateFeePercent).div(10**20))
                )
                    .sub(protocolTradingFee.mul(affiliateTradingTokenFeePercent).div(10**20));
            }

            /// Increase the storage variable keeping track of the accumulated fees.
            tradingFeeTokensHeld[feeToken] = tradingFeeTokensHeld[feeToken].add(
                protocolTradingFee
            );

            emit PayTradingFee(user, feeToken, loanId, protocolTradingFee);

            /// Pay the token reward to the user.
            _payFeeReward(user, loanId, feeToken, feeTokenPair, tradingFee);
        }
    }
```
</details>

---    

> ### _payBorrowingFee

Settle the borrowing fee and pay the token reward to the user.

```solidity
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

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _payBorrowingFee(
        address user,
        bytes32 loanId,
        address feeToken,
        address feeTokenPair,
        uint256 borrowingFee
    ) internal {
        if (borrowingFee != 0) {
            /// Increase the storage variable keeping track of the accumulated fees.
            borrowingFeeTokensHeld[feeToken] = borrowingFeeTokensHeld[feeToken].add(borrowingFee);

            emit PayBorrowingFee(user, feeToken, loanId, borrowingFee);

            /// Pay the token reward to the user.
            _payFeeReward(user, loanId, feeToken, feeTokenPair, borrowingFee);
        }
    }
```
</details>

---    

> ### _payLendingFee

Settle the lending fee (based on the interest). Pay no token reward to the user.

```solidity
function _payLendingFee(address user, address feeToken, uint256 lendingFee) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The address to send the reward to. | 
| feeToken | address | The address of the token in which the lending fee is paid. | 
| lendingFee | uint256 | The height of the fee. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _payLendingFee(
        address user,
        address feeToken,
        uint256 lendingFee
    ) internal {
        if (lendingFee != 0) {
            /// Increase the storage variable keeping track of the accumulated fees.
            lendingFeeTokensHeld[feeToken] = lendingFeeTokensHeld[feeToken].add(lendingFee);

            emit PayLendingFee(user, feeToken, lendingFee);

            //// NOTE: Lenders do not receive a fee reward ////
        }
    }
```
</details>

---    

> ### _settleFeeRewardForInterestExpense

```solidity
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

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _settleFeeRewardForInterestExpense(
        LoanInterest storage loanInterestLocal,
        bytes32 loanId,
        address feeToken,
        address feeTokenPair,
        address user,
        uint256 interestTime
    ) internal {
        /// This represents the fee generated by a borrower's interest payment.
        uint256 interestExpenseFee =
            interestTime
                .sub(loanInterestLocal.updatedTimestamp)
                .mul(loanInterestLocal.owedPerDay)
                .mul(lendingFeePercent)
                .div(1 days * 10**20);

        loanInterestLocal.updatedTimestamp = interestTime;

        if (interestExpenseFee != 0) {
            _payFeeReward(user, loanId, feeToken, feeTokenPair, interestExpenseFee);
        }
    }
```
</details>

---    

> ### _payFeeReward

Pay the potocolToken reward to user. The reward is worth 50% of the trading/borrowing fee.

```solidity
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

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _payFeeReward(
        address user,
        bytes32 loanId,
        address feeToken,
        address feeTokenPair,
        uint256 feeAmount
    ) internal {
        uint256 rewardAmount;
        uint256 _feeRebatePercent = feeRebatePercent;
        address _priceFeeds = priceFeeds;

        if (specialRebates[feeToken][feeTokenPair] > 0) {
            _feeRebatePercent = specialRebates[feeToken][feeTokenPair];
        }

        /// Note: this should be refactored.
        /// Calculate the reward amount, querying the price feed.
        (bool success, bytes memory data) =
            _priceFeeds.staticcall(
                abi.encodeWithSelector(
                    IPriceFeeds(_priceFeeds).queryReturn.selector,
                    feeToken,
                    sovTokenAddress, /// Price rewards using BZRX price rather than vesting token price.
                    feeAmount.mul(_feeRebatePercent).div(10**20)
                )
            );
        // solhint-disable-next-line no-inline-assembly
        assembly {
            if eq(success, 1) {
                rewardAmount := mload(add(data, 32))
            }
        }

        // Check the dedicated SOV that is used to pay trading rebate rewards
        uint256 dedicatedSOV = ISovryn(address(this)).getDedicatedSOVRebate();
        if (rewardAmount != 0 && dedicatedSOV >= rewardAmount) {
            IERC20(sovTokenAddress).approve(lockedSOVAddress, rewardAmount);

            (bool success, ) =
                lockedSOVAddress.call(
                    abi.encodeWithSignature(
                        "deposit(address,uint256,uint256)",
                        user,
                        rewardAmount,
                        tradingRebateRewardsBasisPoint
                    )
                );

            if (success) {
                protocolTokenPaid = protocolTokenPaid.add(rewardAmount);

                emit EarnReward(
                    user,
                    sovTokenAddress,
                    loanId,
                    _feeRebatePercent,
                    rewardAmount,
                    tradingRebateRewardsBasisPoint
                );
            } else {
                emit EarnRewardFail(
                    user,
                    sovTokenAddress,
                    loanId,
                    _feeRebatePercent,
                    rewardAmount,
                    tradingRebateRewardsBasisPoint
                );
            }
        } else if (rewardAmount != 0 && dedicatedSOV < rewardAmount) {
            emit EarnRewardFail(
                user,
                sovTokenAddress,
                loanId,
                _feeRebatePercent,
                rewardAmount,
                tradingRebateRewardsBasisPoint
            );
        }
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
