# Perform token swaps for loans and trades. (SwapsUser.sol)

View Source: [contracts/swaps/SwapsUser.sol](../contracts/swaps/SwapsUser.sol)

**↗ Extends: [State](State.md), [SwapsEvents](SwapsEvents.md), [FeesHelper](FeesHelper.md)**
**↘ Derived Contracts: [LoanClosingsShared](LoanClosingsShared.md), [LoanMaintenance](LoanMaintenance.md), [LoanOpenings](LoanOpenings.md), [SwapsExternal](SwapsExternal.md)**

**SwapsUser**

## Functions

- [_loanSwap(bytes32 loanId, address sourceToken, address destToken, address user, uint256 minSourceTokenAmount, uint256 maxSourceTokenAmount, uint256 requiredDestTokenAmount, bool bypassFee, bytes loanDataBytes)](#_loanswap)
- [_swapsCall(address[5] addrs, uint256[3] vals, bytes32 loanId, bool miscBool, bytes loanDataBytes, bool isSwapExternal)](#_swapscall)
- [_swapsCall_internal(address[5] addrs, uint256[3] vals)](#_swapscall_internal)
- [_swapsExpectedReturn(address sourceToken, address destToken, uint256 sourceTokenAmount)](#_swapsexpectedreturn)
- [_checkSwapSize(address tokenAddress, uint256 amount)](#_checkswapsize)

---    

> ### _loanSwap

Internal loan swap.
     *

```solidity
function _loanSwap(bytes32 loanId, address sourceToken, address destToken, address user, uint256 minSourceTokenAmount, uint256 maxSourceTokenAmount, uint256 requiredDestTokenAmount, bool bypassFee, bytes loanDataBytes) internal nonpayable
returns(destTokenAmountReceived uint256, sourceTokenAmountUsed uint256, sourceToDestSwapRate uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan. | 
| sourceToken | address | The address of the source tokens. | 
| destToken | address | The address of destiny tokens. | 
| user | address | The user address. | 
| minSourceTokenAmount | uint256 | The minimum amount of source tokens to swap. | 
| maxSourceTokenAmount | uint256 | The maximum amount of source tokens to swap. | 
| requiredDestTokenAmount | uint256 | The required amount of destination tokens. | 
| bypassFee | bool | To bypass or not the fee. | 
| loanDataBytes | bytes | The payload for the call. These loan DataBytes are   additional loan data (not in use for token swaps).      * | 

**Returns**

destTokenAmountReceived

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _loanSwap(
        bytes32 loanId,
        address sourceToken,
        address destToken,
        address user,
        uint256 minSourceTokenAmount,
        uint256 maxSourceTokenAmount,
        uint256 requiredDestTokenAmount,
        bool bypassFee,
        bytes memory loanDataBytes
    )
        internal
        returns (
            uint256 destTokenAmountReceived,
            uint256 sourceTokenAmountUsed,
            uint256 sourceToDestSwapRate
        )
    {
        (destTokenAmountReceived, sourceTokenAmountUsed) = _swapsCall(
            [
                sourceToken,
                destToken,
                address(this), // receiver
                address(this), // returnToSender
                user
            ],
            [minSourceTokenAmount, maxSourceTokenAmount, requiredDestTokenAmount],
            loanId,
            bypassFee,
            loanDataBytes,
            false // swap external flag, set to false so that it will use the tradingFeePercent
        );

        /// Will revert if swap size too large.
        _checkSwapSize(sourceToken, sourceTokenAmountUsed);

        /// Will revert if disagreement found.
        sourceToDestSwapRate = IPriceFeeds(priceFeeds).checkPriceDisagreement(
            sourceToken,
            destToken,
            sourceTokenAmountUsed,
            destTokenAmountReceived,
            maxDisagreement
        );

        emit LoanSwap(
            loanId,
            sourceToken,
            destToken,
            user,
            sourceTokenAmountUsed,
            destTokenAmountReceived
        );
    }
```
</details>

---    

> ### _swapsCall

Calculate amount of source and destiny tokens.
     *

```solidity
function _swapsCall(address[5] addrs, uint256[3] vals, bytes32 loanId, bool miscBool, bytes loanDataBytes, bool isSwapExternal) internal nonpayable
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| addrs | address[5] | The array of addresses. | 
| vals | uint256[3] | The array of values. | 
| loanId | bytes32 | The Id of the associated loan. | 
| miscBool | bool | True/false to bypassFee. | 
| loanDataBytes | bytes | Additional loan data (not in use yet).      * | 
| isSwapExternal | bool |  | 

**Returns**

destTokenAmountReceived The amount of destiny tokens received.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _swapsCall(
        address[5] memory addrs,
        uint256[3] memory vals,
        bytes32 loanId,
        bool miscBool, /// bypassFee
        bytes memory loanDataBytes,
        bool isSwapExternal
    ) internal returns (uint256, uint256) {
        /// addrs[0]: sourceToken
        /// addrs[1]: destToken
        /// addrs[2]: receiver
        /// addrs[3]: returnToSender
        /// addrs[4]: user
        /// vals[0]:  minSourceTokenAmount
        /// vals[1]:  maxSourceTokenAmount
        /// vals[2]:  requiredDestTokenAmount

        require(vals[0] != 0 || vals[1] != 0, "min or max source token amount needs to be set");

        if (vals[1] == 0) {
            vals[1] = vals[0];
        }
        require(vals[0] <= vals[1], "sourceAmount larger than max");

        uint256 destTokenAmountReceived;
        uint256 sourceTokenAmountUsed;

        uint256 tradingFee;
        if (!miscBool) {
            /// bypassFee
            if (vals[2] == 0) {
                /// condition: vals[0] will always be used as sourceAmount

                if (isSwapExternal) {
                    tradingFee = _getSwapExternalFee(vals[0]);
                } else {
                    tradingFee = _getTradingFee(vals[0]);
                }

                if (tradingFee != 0) {
                    _payTradingFee(
                        addrs[4], /// user
                        loanId,
                        addrs[0], /// sourceToken (feeToken)
                        addrs[1], /// pairToken (used to check if there is any special rebates or not) -- to pay fee reward
                        tradingFee
                    );

                    vals[0] = vals[0].sub(tradingFee);
                }
            } else {
                /// Condition: unknown sourceAmount will be used.

                if (isSwapExternal) {
                    tradingFee = _getSwapExternalFee(vals[2]);
                } else {
                    tradingFee = _getTradingFee(vals[2]);
                }

                if (tradingFee != 0) {
                    vals[2] = vals[2].add(tradingFee);
                }
            }
        }

        require(loanDataBytes.length == 0, "invalid state");

        (destTokenAmountReceived, sourceTokenAmountUsed) = _swapsCall_internal(addrs, vals);

        if (vals[2] == 0) {
            /// There's no minimum destTokenAmount, but all of vals[0]
            /// (minSourceTokenAmount) must be spent.
            require(sourceTokenAmountUsed == vals[0], "swap too large to fill");

            if (tradingFee != 0) {
                sourceTokenAmountUsed = sourceTokenAmountUsed.add(tradingFee);
            }
        } else {
            /// There's a minimum destTokenAmount required, but
            /// sourceTokenAmountUsed won't be greater
            /// than vals[1] (maxSourceTokenAmount)
            require(sourceTokenAmountUsed <= vals[1], "swap fill too large");
            require(destTokenAmountReceived >= vals[2], "insufficient swap liquidity");

            if (tradingFee != 0) {
                _payTradingFee(
                    addrs[4], /// user
                    loanId, /// loanId,
                    addrs[1], /// destToken (feeToken)
                    addrs[0], /// pairToken (used to check if there is any special rebates or not) -- to pay fee reward
                    tradingFee
                );

                destTokenAmountReceived = destTokenAmountReceived.sub(tradingFee);
            }
        }

        return (destTokenAmountReceived, sourceTokenAmountUsed);
    }
```
</details>

---    

> ### _swapsCall_internal

Calculate amount of source and destiny tokens.
     *

```solidity
function _swapsCall_internal(address[5] addrs, uint256[3] vals) internal nonpayable
returns(destTokenAmountReceived uint256, sourceTokenAmountUsed uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| addrs | address[5] | The array of addresses. | 
| vals | uint256[3] | The array of values.      * | 

**Returns**

destTokenAmountReceived The amount of destiny tokens received.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _swapsCall_internal(address[5] memory addrs, uint256[3] memory vals)
        internal
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        bytes memory data =
            abi.encodeWithSelector(
                ISwapsImpl(swapsImpl).internalSwap.selector,
                addrs[0], /// sourceToken
                addrs[1], /// destToken
                addrs[2], /// receiverAddress
                addrs[3], /// returnToSenderAddress
                vals[0], /// minSourceTokenAmount
                vals[1], /// maxSourceTokenAmount
                vals[2] /// requiredDestTokenAmount
            );

        bool success;
        (success, data) = swapsImpl.delegatecall(data);
        require(success, "swap failed");

        assembly {
            destTokenAmountReceived := mload(add(data, 32))
            sourceTokenAmountUsed := mload(add(data, 64))
        }
    }
```
</details>

---    

> ### _swapsExpectedReturn

Calculate expected amount of destiny tokens.
     *

```solidity
function _swapsExpectedReturn(address sourceToken, address destToken, uint256 sourceTokenAmount) internal view
returns(destTokenAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source tokens. | 
| destToken | address | The address of the destiny tokens. | 
| sourceTokenAmount | uint256 | The amount of the source tokens.      * | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _swapsExpectedReturn(
        address sourceToken,
        address destToken,
        uint256 sourceTokenAmount
    ) internal view returns (uint256 destTokenAmount) {
        destTokenAmount = ISwapsImpl(swapsImpl).internalExpectedReturn(
            sourceToken,
            destToken,
            sourceTokenAmount,
            sovrynSwapContractRegistryAddress
        );
    }
```
</details>

---    

> ### _checkSwapSize

Verify that the amount of tokens are under the swap limit.
     *

```solidity
function _checkSwapSize(address tokenAddress, uint256 amount) internal view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| tokenAddress | address | The address of the token to calculate price. | 
| amount | uint256 | The amount of tokens to calculate price. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _checkSwapSize(address tokenAddress, uint256 amount) internal view {
        uint256 _maxSwapSize = maxSwapSize;
        if (_maxSwapSize != 0) {
            uint256 amountInEth;
            if (tokenAddress == address(wrbtcToken)) {
                amountInEth = amount;
            } else {
                amountInEth = IPriceFeeds(priceFeeds).amountInEth(tokenAddress, amount);
            }
            require(amountInEth <= _maxSwapSize, "swap too large");
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
