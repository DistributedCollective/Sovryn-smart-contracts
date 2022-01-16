# Checkpoints contract. (Checkpoints.sol)

View Source: [contracts/governance/Staking/Checkpoints.sol](../contracts/governance/Staking/Checkpoints.sol)

**↗ Extends: [StakingStorage](StakingStorage.md), [SafeMath96](SafeMath96.md)**
**↘ Derived Contracts: [WeightedStaking](WeightedStaking.md)**

**Checkpoints**

Increases and decreases storage values for users, delegatees and
total daily stake.

**Events**

```js
event DelegateChanged(address indexed delegator, uint256  lockedUntil, address indexed fromDelegate, address indexed toDelegate);
event DelegateStakeChanged(address indexed delegate, uint256  lockedUntil, uint256  previousBalance, uint256  newBalance);
event TokensStaked(address indexed staker, uint256  amount, uint256  lockedUntil, uint256  totalStaked);
event StakingWithdrawn(address indexed staker, uint256  amount, uint256  until, address indexed receiver, bool  isGovernance);
event VestingTokensWithdrawn(address  vesting, address  receiver);
event TokensUnlocked(uint256  amount);
event ExtendedStakingDuration(address indexed staker, uint256  previousDate, uint256  newDate, uint256  amountStaked);
event AdminAdded(address  admin);
event AdminRemoved(address  admin);
event ContractCodeHashAdded(bytes32  hash);
event ContractCodeHashRemoved(bytes32  hash);
event VestingStakeSet(uint256  lockedTS, uint96  value);
```

## Functions

- [_increaseVestingStake(uint256 lockedTS, uint96 value)](#_increasevestingstake)
- [_decreaseVestingStake(uint256 lockedTS, uint96 value)](#_decreasevestingstake)
- [_writeVestingCheckpoint(uint256 lockedTS, uint32 nCheckpoints, uint96 newVest)](#_writevestingcheckpoint)
- [_increaseUserStake(address account, uint256 lockedTS, uint96 value)](#_increaseuserstake)
- [_decreaseUserStake(address account, uint256 lockedTS, uint96 value)](#_decreaseuserstake)
- [_writeUserCheckpoint(address account, uint256 lockedTS, uint32 nCheckpoints, uint96 newStake)](#_writeusercheckpoint)
- [_increaseDelegateStake(address delegatee, uint256 lockedTS, uint96 value)](#_increasedelegatestake)
- [_decreaseDelegateStake(address delegatee, uint256 lockedTS, uint96 value)](#_decreasedelegatestake)
- [_writeDelegateCheckpoint(address delegatee, uint256 lockedTS, uint32 nCheckpoints, uint96 newStake)](#_writedelegatecheckpoint)
- [_increaseDailyStake(uint256 lockedTS, uint96 value)](#_increasedailystake)
- [_decreaseDailyStake(uint256 lockedTS, uint96 value)](#_decreasedailystake)
- [_writeStakingCheckpoint(uint256 lockedTS, uint32 nCheckpoints, uint96 newStake)](#_writestakingcheckpoint)

### _increaseVestingStake

Increases the user's vesting stake for a giving lock date and writes a checkpoint.

```js
function _increaseVestingStake(uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to add to the staked balance. | 

### _decreaseVestingStake

Decreases the user's vesting stake for a giving lock date and writes a checkpoint.

```js
function _decreaseVestingStake(uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to substract to the staked balance. | 

### _writeVestingCheckpoint

Writes on storage the user vested amount.

```js
function _writeVestingCheckpoint(uint256 lockedTS, uint32 nCheckpoints, uint96 newVest) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The lock date. | 
| nCheckpoints | uint32 | The number of checkpoints, to find out the last one index. | 
| newVest | uint96 | The new vest balance. | 

### _increaseUserStake

Increases the user's stake for a giving lock date and writes a checkpoint.

```js
function _increaseUserStake(address account, uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The user address. | 
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to add to the staked balance. | 

### _decreaseUserStake

Decreases the user's stake for a giving lock date and writes a checkpoint.

```js
function _decreaseUserStake(address account, uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The user address. | 
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to substract to the staked balance. | 

### _writeUserCheckpoint

Writes on storage the user stake.

```js
function _writeUserCheckpoint(address account, uint256 lockedTS, uint32 nCheckpoints, uint96 newStake) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The user address. | 
| lockedTS | uint256 | The lock date. | 
| nCheckpoints | uint32 | The number of checkpoints, to find out the last one index. | 
| newStake | uint96 | The new staked balance. | 

### _increaseDelegateStake

Increases the delegatee's stake for a giving lock date and writes a checkpoint.

```js
function _increaseDelegateStake(address delegatee, uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delegatee | address | The delegatee address. | 
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to add to the staked balance. | 

### _decreaseDelegateStake

Decreases the delegatee's stake for a giving lock date and writes a checkpoint.

```js
function _decreaseDelegateStake(address delegatee, uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delegatee | address | The delegatee address. | 
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to substract to the staked balance. | 

### _writeDelegateCheckpoint

Writes on storage the delegate stake.

```js
function _writeDelegateCheckpoint(address delegatee, uint256 lockedTS, uint32 nCheckpoints, uint96 newStake) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delegatee | address | The delegate address. | 
| lockedTS | uint256 | The lock date. | 
| nCheckpoints | uint32 | The number of checkpoints, to find out the last one index. | 
| newStake | uint96 | The new staked balance. | 

### _increaseDailyStake

Increases the total stake for a giving lock date and writes a checkpoint.

```js
function _increaseDailyStake(uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to add to the staked balance. | 

### _decreaseDailyStake

Decreases the total stake for a giving lock date and writes a checkpoint.

```js
function _decreaseDailyStake(uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to substract to the staked balance. | 

### _writeStakingCheckpoint

Writes on storage the total stake.

```js
function _writeStakingCheckpoint(uint256 lockedTS, uint32 nCheckpoints, uint96 newStake) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The lock date. | 
| nCheckpoints | uint32 | The number of checkpoints, to find out the last one index. | 
| newStake | uint96 | The new staked balance. | 

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
