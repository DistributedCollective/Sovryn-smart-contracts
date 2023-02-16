# Swaps Implementation Local contract.
 * (SwapsImplLocal.sol)

View Source: [contracts/swaps/connectors/testnet/SwapsImplLocal.sol](../contracts/swaps/connectors/testnet/SwapsImplLocal.sol)

**↗ Extends: [State](State.md), [ISwapsImpl](ISwapsImpl.md)**

**SwapsImplLocal**

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
 * This contract contains the implementation of swap process and rate calculations.

## Functions

- [internalSwap(address sourceTokenAddress, address destTokenAddress, address , address returnToSenderAddress, uint256 minSourceTokenAmount, uint256 maxSourceTokenAmount, uint256 requiredDestTokenAmount)](#internalswap)
- [internalExpectedRate(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount, address unused)](#internalexpectedrate)
- [internalExpectedReturn(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount, address unused)](#internalexpectedreturn)

---    

> ### internalSwap

⤾ overrides [ISwapsImpl.internalSwap](ISwapsImpl.md#internalswap)

Swap two tokens.
     *

```solidity
function internalSwap(address sourceTokenAddress, address destTokenAddress, address , address returnToSenderAddress, uint256 minSourceTokenAmount, uint256 maxSourceTokenAmount, uint256 requiredDestTokenAmount) public payable
returns(destTokenAmountReceived uint256, sourceTokenAmountUsed uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceTokenAddress | address | The address of the source tokens. | 
| destTokenAddress | address | The address of the destiny tokens.      * | 
|  | address | sourceTokenAddress The address of the source tokens. | 
| returnToSenderAddress | address |  | 
| minSourceTokenAmount | uint256 |  | 
| maxSourceTokenAmount | uint256 |  | 
| requiredDestTokenAmount | uint256 |  | 

**Returns**

destTokenAmountReceived The amount of destiny tokens sent.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function internalSwap(
        address sourceTokenAddress,
        address destTokenAddress,
        address, /*receiverAddress*/
        address returnToSenderAddress,
        uint256 minSourceTokenAmount,
        uint256 maxSourceTokenAmount,
        uint256 requiredDestTokenAmount
    ) public payable returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed) {
        require(sourceTokenAddress != destTokenAddress, "source == dest");

        (uint256 tradeRate, uint256 precision) =
            IPriceFeeds(priceFeeds).queryRate(sourceTokenAddress, destTokenAddress);

        if (requiredDestTokenAmount == 0) {
            sourceTokenAmountUsed = minSourceTokenAmount;
            destTokenAmountReceived = minSourceTokenAmount.mul(tradeRate).div(precision);
        } else {
            destTokenAmountReceived = requiredDestTokenAmount;
            sourceTokenAmountUsed = requiredDestTokenAmount.mul(precision).div(tradeRate);
            require(sourceTokenAmountUsed <= minSourceTokenAmount, "destAmount too great");
        }

        TestToken(sourceTokenAddress).burn(address(this), sourceTokenAmountUsed);
        TestToken(destTokenAddress).mint(address(this), destTokenAmountReceived);

        if (returnToSenderAddress != address(this)) {
            if (sourceTokenAmountUsed < maxSourceTokenAmount) {
                /// Send unused source token back.
                IERC20(sourceTokenAddress).safeTransfer(
                    returnToSenderAddress,
                    maxSourceTokenAmount - sourceTokenAmountUsed
                );
            }
        }
    }
```
</details>

---    

> ### internalExpectedRate

⤾ overrides [ISwapsImpl.internalExpectedRate](ISwapsImpl.md#internalexpectedrate)

Calculate the expected price rate of swapping a given amount
  of tokens.
     *

```solidity
function internalExpectedRate(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount, address unused) public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceTokenAddress | address | The address of the source tokens. | 
| destTokenAddress | address | The address of the destiny tokens. | 
| sourceTokenAmount | uint256 | The amount of source tokens. | 
| unused | address | Fourth parameter ignored.      * | 

**Returns**

precision The expected price rate.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function internalExpectedRate(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        address unused
    ) public view returns (uint256) {
        (uint256 sourceToDestRate, uint256 sourceToDestPrecision) =
            IPriceFeeds(priceFeeds).queryRate(sourceTokenAddress, destTokenAddress);

        return sourceTokenAmount.mul(sourceToDestRate).div(sourceToDestPrecision);
    }
```
</details>

---    

> ### internalExpectedReturn

⤾ overrides [ISwapsImpl.internalExpectedReturn](ISwapsImpl.md#internalexpectedreturn)

Calculate the expected return of swapping a given amount
  of tokens.
     *

```solidity
function internalExpectedReturn(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount, address unused) public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceTokenAddress | address | The address of the source tokens. | 
| destTokenAddress | address | The address of the destiny tokens. | 
| sourceTokenAmount | uint256 | The amount of source tokens. | 
| unused | address | Fourth parameter ignored.      * | 

**Returns**

precision The expected return.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function internalExpectedReturn(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        address unused
    ) public view returns (uint256) {
        (uint256 sourceToDestRate, uint256 sourceToDestPrecision) =
            IPriceFeeds(priceFeeds).queryRate(sourceTokenAddress, destTokenAddress);

        return sourceTokenAmount.mul(sourceToDestRate).div(sourceToDestPrecision);
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
