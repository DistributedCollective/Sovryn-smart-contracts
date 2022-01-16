# Library for managing loan sets.
 * (EnumerableBytes4Set.sol)

View Source: [contracts/mixins/EnumerableBytes4Set.sol](../contracts/mixins/EnumerableBytes4Set.sol)

**EnumerableBytes4Set**

Sets have the following properties:
 * - Elements are added, removed, and checked for existence in constant time
(O(1)).
- Elements are enumerated in O(n). No guarantees are made on the ordering.
 * Include with `using EnumerableBytes4Set for EnumerableBytes4Set.Bytes4Set;`.

## Structs
### Bytes4Set

```js
struct Bytes4Set {
 mapping(bytes4 => uint256) index,
 bytes4[] values
}
```

## Functions

- [addAddress(struct EnumerableBytes4Set.Bytes4Set set, address addrvalue)](#addaddress)
- [addBytes4(struct EnumerableBytes4Set.Bytes4Set set, bytes4 value)](#addbytes4)
- [removeAddress(struct EnumerableBytes4Set.Bytes4Set set, address addrvalue)](#removeaddress)
- [removeBytes4(struct EnumerableBytes4Set.Bytes4Set set, bytes4 value)](#removebytes4)
- [contains(struct EnumerableBytes4Set.Bytes4Set set, bytes4 value)](#contains)
- [containsAddress(struct EnumerableBytes4Set.Bytes4Set set, address addrvalue)](#containsaddress)
- [enumerate(struct EnumerableBytes4Set.Bytes4Set set, uint256 start, uint256 count)](#enumerate)
- [length(struct EnumerableBytes4Set.Bytes4Set set)](#length)
- [get(struct EnumerableBytes4Set.Bytes4Set set, uint256 index)](#get)

### addAddress

Add an address value to a set. O(1).
	 *

```js
function addAddress(struct EnumerableBytes4Set.Bytes4Set set, address addrvalue) internal nonpayable
returns(bool)
```

**Returns**

False if the value was already in the set.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values. | 
| addrvalue | address | The address to add.
	 * | 

### addBytes4

Add a value to a set. O(1).
	 *

```js
function addBytes4(struct EnumerableBytes4Set.Bytes4Set set, bytes4 value) internal nonpayable
returns(bool)
```

**Returns**

False if the value was already in the set.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values. | 
| value | bytes4 | The new value to add.
	 * | 

### removeAddress

Remove an address value from a set. O(1).
	 *

```js
function removeAddress(struct EnumerableBytes4Set.Bytes4Set set, address addrvalue) internal nonpayable
returns(bool)
```

**Returns**

False if the address was not present in the set.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values. | 
| addrvalue | address | The address to remove.
	 * | 

### removeBytes4

Remove a value from a set. O(1).
	 *

```js
function removeBytes4(struct EnumerableBytes4Set.Bytes4Set set, bytes4 value) internal nonpayable
returns(bool)
```

**Returns**

False if the value was not present in the set.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values. | 
| value | bytes4 | The value to remove.
	 * | 

### contains

Find out whether a value exists in the set.
	 *

```js
function contains(struct EnumerableBytes4Set.Bytes4Set set, bytes4 value) internal view
returns(bool)
```

**Returns**

True if the value is in the set. O(1).

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values. | 
| value | bytes4 | The value to find.
	 * | 

### containsAddress

Returns true if the value is in the set. O(1).

```js
function containsAddress(struct EnumerableBytes4Set.Bytes4Set set, address addrvalue) internal view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set |  | 
| addrvalue | address |  | 

### enumerate

Get all set values.
	 *

```js
function enumerate(struct EnumerableBytes4Set.Bytes4Set set, uint256 start, uint256 count) internal view
returns(output bytes4[])
```

**Returns**

An array with all values in the set. O(N).
	 *

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values. | 
| start | uint256 | The offset of the returning set. | 
| count | uint256 | The limit of number of values to return.
	 * | 

### length

Get the legth of the set.
	 *

```js
function length(struct EnumerableBytes4Set.Bytes4Set set) internal view
returns(uint256)
```

**Returns**

the number of elements on the set. O(1).

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values.
	 * | 

### get

Get an item from the set by its index.
	 *

```js
function get(struct EnumerableBytes4Set.Bytes4Set set, uint256 index) internal view
returns(bytes4)
```

**Returns**

the element stored at position `index` in the set. O(1).

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values. | 
| index | uint256 | The index of the value to return.
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
