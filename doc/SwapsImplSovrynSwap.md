# Swaps Implementation Sovryn contract.

- (SwapsImplSovrynSwap.sol)

View Source: [contracts/swaps/connectors/SwapsImplSovrynSwap.sol](../contracts/swaps/connectors/SwapsImplSovrynSwap.sol)

**↗ Extends: [State](State.md), [ISwapsImpl](ISwapsImpl.md)**

**SwapsImplSovrynSwap**

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.

- This contract contains the implementation of swap process and rate
  calculations for Sovryn network.

## Functions

- [getContractHexName(string source)](#getcontracthexname)
- [getSovrynSwapNetworkContract(address sovrynSwapRegistryAddress)](#getsovrynswapnetworkcontract)
- [internalSwap(address sourceTokenAddress, address destTokenAddress, address receiverAddress, address returnToSenderAddress, uint256 minSourceTokenAmount, uint256 maxSourceTokenAmount, uint256 requiredDestTokenAmount)](#internalswap)
- [allowTransfer(uint256 tokenAmount, address tokenAddress, address sovrynSwapNetwork)](#allowtransfer)
- [estimateSourceTokenAmount(address sourceTokenAddress, address destTokenAddress, uint256 requiredDestTokenAmount, uint256 maxSourceTokenAmount)](#estimatesourcetokenamount)
- [internalExpectedRate(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount, address sovrynSwapContractRegistryAddress)](#internalexpectedrate)
- [internalExpectedReturn(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount, address sovrynSwapContractRegistryAddress)](#internalexpectedreturn)

### getContractHexName

```js
function getContractHexName(string source) public pure
returns(result bytes32)
```

**Arguments**

| Name   | Type   | Description               |
| ------ | ------ | ------------------------- |
| source | string | The name of the contract. |

### getSovrynSwapNetworkContract

```js
function getSovrynSwapNetworkContract(address sovrynSwapRegistryAddress) public view
returns(contract ISovrynSwapNetwork)
```

**Arguments**

| Name                      | Type    | Description                  |
| ------------------------- | ------- | ---------------------------- |
| sovrynSwapRegistryAddress | address | The address of the registry. |

### internalSwap

⤾ overrides [ISwapsImpl.internalSwap](ISwapsImpl.md#internalswap)

```js
function internalSwap(address sourceTokenAddress, address destTokenAddress, address receiverAddress, address returnToSenderAddress, uint256 minSourceTokenAmount, uint256 maxSourceTokenAmount, uint256 requiredDestTokenAmount) public payable
returns(destTokenAmountReceived uint256, sourceTokenAmountUsed uint256)
```

**Arguments**

| Name                    | Type    | Description                                                                                               |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| sourceTokenAddress      | address | The address of the source tokens.                                                                         |
| destTokenAddress        | address | The address of the destination tokens.                                                                    |
| receiverAddress         | address | The address who will received the swap token results                                                      |
| returnToSenderAddress   | address | The address to return unspent tokens to (when called by the protocol, it's always the protocol contract). |
| minSourceTokenAmount    | uint256 | The minimum amount of source tokens to swapped (only considered if requiredDestTokens == 0).              |
| maxSourceTokenAmount    | uint256 | The maximum amount of source tokens to swapped.                                                           |
| requiredDestTokenAmount | uint256 | The required amount of destination tokens.                                                                |

### allowTransfer

Check whether the existing allowance suffices to transfer
the needed amount of tokens.
If not, allows the transfer of an arbitrary amount of tokens. \*

```js
function allowTransfer(uint256 tokenAmount, address tokenAddress, address sovrynSwapNetwork) internal nonpayable
```

**Arguments**

| Name              | Type    | Description                                     |
| ----------------- | ------- | ----------------------------------------------- |
| tokenAmount       | uint256 | The amount to transfer.                         |
| tokenAddress      | address | The address of the token to transfer.           |
| sovrynSwapNetwork | address | The address of the sovrynSwap network contract. |

### estimateSourceTokenAmount

Calculate the number of source tokens to provide in order to
obtain the required destination amount. \*

```js
function estimateSourceTokenAmount(address sourceTokenAddress, address destTokenAddress, uint256 requiredDestTokenAmount, uint256 maxSourceTokenAmount) internal view
returns(estimatedSourceAmount uint256)
```

**Returns**

The estimated amount of source tokens needed.
Minimum: minSourceTokenAmount, maximum: maxSourceTokenAmount

**Arguments**

| Name                    | Type    | Description                                   |
| ----------------------- | ------- | --------------------------------------------- |
| sourceTokenAddress      | address | The address of the source token address.      |
| destTokenAddress        | address | The address of the destination token address. |
| requiredDestTokenAmount | uint256 | The number of destination tokens needed.      |
| maxSourceTokenAmount    | uint256 | The maximum number of source tokens to spend. |
| \*                      |

### internalExpectedRate

⤾ overrides [ISwapsImpl.internalExpectedRate](ISwapsImpl.md#internalexpectedrate)

Get the expected rate for 1 source token when exchanging the
given amount of source tokens. \*

```js
function internalExpectedRate(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount, address sovrynSwapContractRegistryAddress) public view
returns(uint256)
```

**Arguments**

| Name                              | Type    | Description                                      |
| --------------------------------- | ------- | ------------------------------------------------ |
| sourceTokenAddress                | address | The address of the source token contract.        |
| destTokenAddress                  | address | The address of the destination token contract.   |
| sourceTokenAmount                 | uint256 | The amount of source tokens to get the rate for. |
| sovrynSwapContractRegistryAddress | address |                                                  |

### internalExpectedReturn

⤾ overrides [ISwapsImpl.internalExpectedReturn](ISwapsImpl.md#internalexpectedreturn)

Get the expected return amount when exchanging the given
amount of source tokens. \*

```js
function internalExpectedReturn(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount, address sovrynSwapContractRegistryAddress) public view
returns(expectedReturn uint256)
```

**Arguments**

| Name                              | Type    | Description                                        |
| --------------------------------- | ------- | -------------------------------------------------- |
| sourceTokenAddress                | address | The address of the source token contract.          |
| destTokenAddress                  | address | The address of the destination token contract.     |
| sourceTokenAmount                 | uint256 | The amount of source tokens to get the return for. |
| sovrynSwapContractRegistryAddress | address |                                                    |

## Contracts

- [Address](Address.md)
- [Administered](Administered.md)
- [AdminRole](AdminRole.md)
- [AdvancedToken](AdvancedToken.md)
- [AdvancedTokenStorage](AdvancedTokenStorage.md)
- [Affiliates](Affiliates.md)
- [AffiliatesEvents](AffiliatesEvents.md)
- [ApprovalReceiver](ApprovalReceiver.md)
- [BlockMockUp](BlockMockUp.md)
- [BProPriceFeed](BProPriceFeed.md)
- [BProPriceFeedMockup](BProPriceFeedMockup.md)
- [Checkpoints](Checkpoints.md)
- [Context](Context.md)
- [DevelopmentFund](DevelopmentFund.md)
- [DummyContract](DummyContract.md)
- [ECDSA](ECDSA.md)
- [EnumerableAddressSet](EnumerableAddressSet.md)
- [EnumerableBytes32Set](EnumerableBytes32Set.md)
- [EnumerableBytes4Set](EnumerableBytes4Set.md)
- [ERC20](ERC20.md)
- [ERC20Detailed](ERC20Detailed.md)
- [ErrorDecoder](ErrorDecoder.md)
- [Escrow](Escrow.md)
- [EscrowReward](EscrowReward.md)
- [FeedsLike](FeedsLike.md)
- [FeesEvents](FeesEvents.md)
- [FeeSharingLogic](FeeSharingLogic.md)
- [FeeSharingProxy](FeeSharingProxy.md)
- [FeeSharingProxyMockup](FeeSharingProxyMockup.md)
- [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
- [FeesHelper](FeesHelper.md)
- [FlashLoanerTest](FlashLoanerTest.md)
- [GenericTokenSender](GenericTokenSender.md)
- [GovernorAlpha](GovernorAlpha.md)
- [GovernorAlphaMockup](GovernorAlphaMockup.md)
- [GovernorVault](GovernorVault.md)
- [IApproveAndCall](IApproveAndCall.md)
- [IChai](IChai.md)
- [IContractRegistry](IContractRegistry.md)
- [IConverterAMM](IConverterAMM.md)
- [IERC20\_](IERC20_.md)
- [IERC20](IERC20.md)
- [IFeeSharingProxy](IFeeSharingProxy.md)
- [ILiquidityMining](ILiquidityMining.md)
- [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
- [ILoanPool](ILoanPool.md)
- [ILoanToken](ILoanToken.md)
- [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
- [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
- [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
- [ILoanTokenModules](ILoanTokenModules.md)
- [ILoanTokenModulesMock](ILoanTokenModulesMock.md)
- [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
- [ILockedSOV](ILockedSOV.md)
- [IMoCState](IMoCState.md)
- [ImplementationMockup](ImplementationMockup.md)
- [Initializable](Initializable.md)
- [InterestUser](InterestUser.md)
- [IPot](IPot.md)
- [IPriceFeeds](IPriceFeeds.md)
- [IPriceFeedsExt](IPriceFeedsExt.md)
- [IProtocol](IProtocol.md)
- [IRSKOracle](IRSKOracle.md)
- [ISovryn](ISovryn.md)
- [ISovrynSwapNetwork](ISovrynSwapNetwork.md)
- [IStaking](IStaking.md)
- [ISwapsImpl](ISwapsImpl.md)
- [ITeamVesting](ITeamVesting.md)
- [ITimelock](ITimelock.md)
- [ITokenFlashLoanTest](ITokenFlashLoanTest.md)
- [IV1PoolOracle](IV1PoolOracle.md)
- [IVesting](IVesting.md)
- [IVestingFactory](IVestingFactory.md)
- [IVestingRegistry](IVestingRegistry.md)
- [IWrbtc](IWrbtc.md)
- [IWrbtcERC20](IWrbtcERC20.md)
- [LenderInterestStruct](LenderInterestStruct.md)
- [LiquidationHelper](LiquidationHelper.md)
- [LiquidityMining](LiquidityMining.md)
- [LiquidityMiningConfigToken](LiquidityMiningConfigToken.md)
- [LiquidityMiningMockup](LiquidityMiningMockup.md)
- [LiquidityMiningProxy](LiquidityMiningProxy.md)
- [LiquidityMiningStorage](LiquidityMiningStorage.md)
- [LiquidityPoolV1ConverterMockup](LiquidityPoolV1ConverterMockup.md)
- [LoanClosingsEvents](LoanClosingsEvents.md)
- [LoanClosingsLiquidation](LoanClosingsLiquidation.md)
- [LoanClosingsRollover](LoanClosingsRollover.md)
- [LoanClosingsShared](LoanClosingsShared.md)
- [LoanClosingsWith](LoanClosingsWith.md)
- [LoanInterestStruct](LoanInterestStruct.md)
- [LoanMaintenance](LoanMaintenance.md)
- [LoanMaintenanceEvents](LoanMaintenanceEvents.md)
- [LoanOpenings](LoanOpenings.md)
- [LoanOpeningsEvents](LoanOpeningsEvents.md)
- [LoanParamsStruct](LoanParamsStruct.md)
- [LoanSettings](LoanSettings.md)
- [LoanSettingsEvents](LoanSettingsEvents.md)
- [LoanStruct](LoanStruct.md)
- [LoanToken](LoanToken.md)
- [LoanTokenBase](LoanTokenBase.md)
- [LoanTokenLogicBeacon](LoanTokenLogicBeacon.md)
- [LoanTokenLogicLM](LoanTokenLogicLM.md)
- [LoanTokenLogicLMMockup](LoanTokenLogicLMMockup.md)
- [LoanTokenLogicLMV1Mockup](LoanTokenLogicLMV1Mockup.md)
- [LoanTokenLogicLMV2Mockup](LoanTokenLogicLMV2Mockup.md)
- [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
- [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
- [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
- [LoanTokenLogicTest](LoanTokenLogicTest.md)
- [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
- [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
- [LockedSOV](LockedSOV.md)
- [LockedSOVFailedMockup](LockedSOVFailedMockup.md)
- [LockedSOVMockup](LockedSOVMockup.md)
- [Medianizer](Medianizer.md)
- [MockAffiliates](MockAffiliates.md)
- [MockLoanTokenLogic](MockLoanTokenLogic.md)
- [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
- [ModulesCommonEvents](ModulesCommonEvents.md)
- [MultiSigKeyHolders](MultiSigKeyHolders.md)
- [MultiSigWallet](MultiSigWallet.md)
- [Objects](Objects.md)
- [OrderStruct](OrderStruct.md)
- [OrigingVestingCreator](OrigingVestingCreator.md)
- [OriginInvestorsClaim](OriginInvestorsClaim.md)
- [Ownable](Ownable.md)
- [Pausable](Pausable.md)
- [PausableOz](PausableOz.md)
- [PreviousLoanToken](PreviousLoanToken.md)
- [PreviousLoanTokenSettingsLowerAdmin](PreviousLoanTokenSettingsLowerAdmin.md)
- [PriceFeedRSKOracle](PriceFeedRSKOracle.md)
- [PriceFeedRSKOracleMockup](PriceFeedRSKOracleMockup.md)
- [PriceFeeds](PriceFeeds.md)
- [PriceFeedsConstants](PriceFeedsConstants.md)
- [PriceFeedsMoC](PriceFeedsMoC.md)
- [PriceFeedsMoCMockup](PriceFeedsMoCMockup.md)
- [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
- [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
- [ProtocolLike](ProtocolLike.md)
- [ProtocolSettings](ProtocolSettings.md)
- [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
- [ProtocolSettingsLike](ProtocolSettingsLike.md)
- [ProtocolSettingsMockup](ProtocolSettingsMockup.md)
- [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
- [ProtocolTokenUser](ProtocolTokenUser.md)
- [Proxy](Proxy.md)
- [ProxyMockup](ProxyMockup.md)
- [RBTCWrapperProxyMockup](RBTCWrapperProxyMockup.md)
- [ReentrancyGuard](ReentrancyGuard.md)
- [RewardHelper](RewardHelper.md)
- [RSKAddrValidator](RSKAddrValidator.md)
- [SafeERC20](SafeERC20.md)
- [SafeMath](SafeMath.md)
- [SafeMath96](SafeMath96.md)
- [setGet](setGet.md)
- [SignedSafeMath](SignedSafeMath.md)
- [SOV](SOV.md)
- [sovrynProtocol](sovrynProtocol.md)
- [Staking](Staking.md)
- [StakingInterface](StakingInterface.md)
- [StakingMock](StakingMock.md)
- [StakingMockup](StakingMockup.md)
- [StakingProxy](StakingProxy.md)
- [StakingRewards](StakingRewards.md)
- [StakingRewardsMockUp](StakingRewardsMockUp.md)
- [StakingRewardsProxy](StakingRewardsProxy.md)
- [StakingRewardsStorage](StakingRewardsStorage.md)
- [StakingStorage](StakingStorage.md)
- [State](State.md)
- [StorageMockup](StorageMockup.md)
- [SVR](SVR.md)
- [SwapsEvents](SwapsEvents.md)
- [SwapsExternal](SwapsExternal.md)
- [SwapsImplLocal](SwapsImplLocal.md)
- [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
- [SwapsUser](SwapsUser.md)
- [TeamVesting](TeamVesting.md)
- [TestCoverage](TestCoverage.md)
- [TestLibraries](TestLibraries.md)
- [TestSovrynSwap](TestSovrynSwap.md)
- [TestToken](TestToken.md)
- [TestWrbtc](TestWrbtc.md)
- [Timelock](Timelock.md)
- [TimelockHarness](TimelockHarness.md)
- [TimelockInterface](TimelockInterface.md)
- [TimelockTest](TimelockTest.md)
- [TokenSender](TokenSender.md)
- [UpgradableProxy](UpgradableProxy.md)
- [USDTPriceFeed](USDTPriceFeed.md)
- [VaultController](VaultController.md)
- [Vesting](Vesting.md)
- [VestingCreator](VestingCreator.md)
- [VestingFactory](VestingFactory.md)
- [VestingLogic](VestingLogic.md)
- [VestingLogicMockup](VestingLogicMockup.md)
- [VestingRegistry](VestingRegistry.md)
- [VestingRegistry2](VestingRegistry2.md)
- [VestingRegistry3](VestingRegistry3.md)
- [VestingRegistryLogic](VestingRegistryLogic.md)
- [VestingRegistryLogicMockup](VestingRegistryLogicMockup.md)
- [VestingRegistryProxy](VestingRegistryProxy.md)
- [VestingRegistryStorage](VestingRegistryStorage.md)
- [VestingStorage](VestingStorage.md)
- [WeightedStaking](WeightedStaking.md)
- [WRBTC](WRBTC.md)
