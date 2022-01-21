# Interface for contract governance/Staking/Staking.sol (IStaking.sol)

View Source: [contracts/governance/Staking/IStaking.sol](../contracts/governance/Staking/IStaking.sol)

**↘ Derived Contracts: [Staking](Staking.md)**

**IStaking**

Interfaces are used to cast a contract address into a callable instance.

## Functions

- [stakesBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee)](#stakesbyschedule)
- [stake(uint96 amount, uint256 until, address stakeFor, address delegatee)](#stake)
- [getPriorVotes(address account, uint256 blockNumber, uint256 date)](#getpriorvotes)
- [getPriorTotalVotingPower(uint32 blockNumber, uint256 time)](#getpriortotalvotingpower)
- [getPriorWeightedStake(address account, uint256 blockNumber, uint256 date)](#getpriorweightedstake)
- [getPriorVestingWeightedStake(uint256 blockNumber, uint256 date)](#getpriorvestingweightedstake)
- [timestampToLockDate(uint256 timestamp)](#timestamptolockdate)
- [isVestingContract(address stakerAddress)](#isvestingcontract)

### stakesBySchedule

⤿ Overridden Implementation(s): [Staking.stakesBySchedule](Staking.md#stakesbyschedule)

```js
function stakesBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee) external nonpayable
```

**Arguments**

| Name           | Type    | Description |
| -------------- | ------- | ----------- |
| amount         | uint256 |             |
| cliff          | uint256 |             |
| duration       | uint256 |             |
| intervalLength | uint256 |             |
| stakeFor       | address |             |
| delegatee      | address |             |

### stake

⤿ Overridden Implementation(s): [Staking.stake](Staking.md#stake)

```js
function stake(uint96 amount, uint256 until, address stakeFor, address delegatee) external nonpayable
```

**Arguments**

| Name      | Type    | Description |
| --------- | ------- | ----------- |
| amount    | uint96  |             |
| until     | uint256 |             |
| stakeFor  | address |             |
| delegatee | address |             |

### getPriorVotes

⤿ Overridden Implementation(s): [WeightedStaking.getPriorVotes](WeightedStaking.md#getpriorvotes)

```js
function getPriorVotes(address account, uint256 blockNumber, uint256 date) external view
returns(uint96)
```

**Arguments**

| Name        | Type    | Description |
| ----------- | ------- | ----------- |
| account     | address |             |
| blockNumber | uint256 |             |
| date        | uint256 |             |

### getPriorTotalVotingPower

⤿ Overridden Implementation(s): [StakingMockup.getPriorTotalVotingPower](StakingMockup.md#getpriortotalvotingpower),[WeightedStaking.getPriorTotalVotingPower](WeightedStaking.md#getpriortotalvotingpower)

```js
function getPriorTotalVotingPower(uint32 blockNumber, uint256 time) external view
returns(uint96)
```

**Arguments**

| Name        | Type    | Description |
| ----------- | ------- | ----------- |
| blockNumber | uint32  |             |
| time        | uint256 |             |

### getPriorWeightedStake

⤿ Overridden Implementation(s): [StakingMockup.getPriorWeightedStake](StakingMockup.md#getpriorweightedstake),[WeightedStaking.getPriorWeightedStake](WeightedStaking.md#getpriorweightedstake)

```js
function getPriorWeightedStake(address account, uint256 blockNumber, uint256 date) external view
returns(uint96)
```

**Arguments**

| Name        | Type    | Description |
| ----------- | ------- | ----------- |
| account     | address |             |
| blockNumber | uint256 |             |
| date        | uint256 |             |

### getPriorVestingWeightedStake

⤿ Overridden Implementation(s): [WeightedStaking.getPriorVestingWeightedStake](WeightedStaking.md#getpriorvestingweightedstake)

```js
function getPriorVestingWeightedStake(uint256 blockNumber, uint256 date) external view
returns(uint96)
```

**Arguments**

| Name        | Type    | Description |
| ----------- | ------- | ----------- |
| blockNumber | uint256 |             |
| date        | uint256 |             |

### timestampToLockDate

⤿ Overridden Implementation(s): [WeightedStaking.timestampToLockDate](WeightedStaking.md#timestamptolockdate)

```js
function timestampToLockDate(uint256 timestamp) external view
returns(lockDate uint256)
```

**Arguments**

| Name      | Type    | Description |
| --------- | ------- | ----------- |
| timestamp | uint256 |             |

### isVestingContract

⤿ Overridden Implementation(s): [StakingMockup.isVestingContract](StakingMockup.md#isvestingcontract),[WeightedStaking.isVestingContract](WeightedStaking.md#isvestingcontract)

```js
function isVestingContract(address stakerAddress) external view
returns(bool)
```

**Arguments**

| Name          | Type    | Description |
| ------------- | ------- | ----------- |
| stakerAddress | address |             |

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
