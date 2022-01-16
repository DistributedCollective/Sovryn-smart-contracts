# Weighted Staking contract. (WeightedStaking.sol)

View Source: [contracts/governance/Staking/WeightedStaking.sol](../contracts/governance/Staking/WeightedStaking.sol)

**↗ Extends: [Checkpoints](Checkpoints.md)**
**↘ Derived Contracts: [Staking](Staking.md)**

**WeightedStaking**

Computation of power and votes used by FeeSharingProxy and
GovernorAlpha and Staking contracts w/ mainly 3 public functions:
  + getPriorTotalVotingPower => Total voting power.
  + getPriorVotes  => Delegatee voting power.
  + getPriorWeightedStake  => User Weighted Stake.
Staking contract inherits WeightedStaking.
FeeSharingProxy and GovernorAlpha invoke Staking instance functions.

## Modifiers

- [onlyAuthorized](#onlyauthorized)

### onlyAuthorized

Throws if called by any account other than the owner or admin.

```js
modifier onlyAuthorized() internal
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

## Functions

- [setVestingRegistry(address _vestingRegistryProxy)](#setvestingregistry)
- [setVestingStakes(uint256[] lockedDates, uint96[] values)](#setvestingstakes)
- [_setVestingStake(uint256 lockedTS, uint96 value)](#_setvestingstake)
- [getPriorTotalVotingPower(uint32 blockNumber, uint256 time)](#getpriortotalvotingpower)
- [_totalPowerByDate(uint256 date, uint256 startDate, uint256 blockNumber)](#_totalpowerbydate)
- [getPriorTotalStakesForDate(uint256 date, uint256 blockNumber)](#getpriortotalstakesfordate)
- [getPriorVotes(address account, uint256 blockNumber, uint256 date)](#getpriorvotes)
- [_totalPowerByDateForDelegatee(address account, uint256 date, uint256 startDate, uint256 blockNumber)](#_totalpowerbydatefordelegatee)
- [getPriorStakeByDateForDelegatee(address account, uint256 date, uint256 blockNumber)](#getpriorstakebydatefordelegatee)
- [getPriorWeightedStake(address account, uint256 blockNumber, uint256 date)](#getpriorweightedstake)
- [weightedStakeByDate(address account, uint256 date, uint256 startDate, uint256 blockNumber)](#weightedstakebydate)
- [getPriorUserStakeByDate(address account, uint256 date, uint256 blockNumber)](#getprioruserstakebydate)
- [_getPriorUserStakeByDate(address account, uint256 date, uint256 blockNumber)](#_getprioruserstakebydate)
- [getPriorVestingWeightedStake(uint256 blockNumber, uint256 date)](#getpriorvestingweightedstake)
- [weightedVestingStakeByDate(uint256 date, uint256 startDate, uint256 blockNumber)](#weightedvestingstakebydate)
- [getPriorVestingStakeByDate(uint256 date, uint256 blockNumber)](#getpriorvestingstakebydate)
- [_getPriorVestingStakeByDate(uint256 date, uint256 blockNumber)](#_getpriorvestingstakebydate)
- [_getCurrentBlockNumber()](#_getcurrentblocknumber)
- [computeWeightByDate(uint256 date, uint256 startDate)](#computeweightbydate)
- [timestampToLockDate(uint256 timestamp)](#timestamptolockdate)
- [_adjustDateForOrigin(uint256 date)](#_adjustdatefororigin)
- [addAdmin(address _admin)](#addadmin)
- [removeAdmin(address _admin)](#removeadmin)
- [addContractCodeHash(address vesting)](#addcontractcodehash)
- [removeContractCodeHash(address vesting)](#removecontractcodehash)
- [isVestingContract(address stakerAddress)](#isvestingcontract)
- [_getCodeHash(address _contract)](#_getcodehash)

### setVestingRegistry

sets vesting registry

```js
function setVestingRegistry(address _vestingRegistryProxy) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingRegistryProxy | address | the address of vesting registry proxy contract | 

### setVestingStakes

Sets the users' vesting stakes for a giving lock dates and writes checkpoints.

```js
function setVestingStakes(uint256[] lockedDates, uint96[] values) external nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedDates | uint256[] | The arrays of lock dates. | 
| values | uint96[] | The array of values to add to the staked balance. | 

### _setVestingStake

Sets the users' vesting stake for a giving lock date and writes a checkpoint.

```js
function _setVestingStake(uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to be set. | 

### getPriorTotalVotingPower

⤾ overrides [IStaking.getPriorTotalVotingPower](IStaking.md#getpriortotalvotingpower)

⤿ Overridden Implementation(s): [StakingMockup.getPriorTotalVotingPower](StakingMockup.md#getpriortotalvotingpower)

Compute the total voting power at a given time.

```js
function getPriorTotalVotingPower(uint32 blockNumber, uint256 time) public view
returns(totalVotingPower uint96)
```

**Returns**

The total voting power at the given time.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| blockNumber | uint32 | The block number, needed for checkpointing. | 
| time | uint256 | The timestamp for which to calculate the total voting power. | 

### _totalPowerByDate

Compute the voting power for a specific date.
Power = stake * weight

```js
function _totalPowerByDate(uint256 date, uint256 startDate, uint256 blockNumber) internal view
returns(power uint96)
```

**Returns**

The stacking power.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The staking date to compute the power for. | 
| startDate | uint256 | The date for which we need to know the power of the stake. | 
| blockNumber | uint256 | The block number, needed for checkpointing. | 

### getPriorTotalStakesForDate

Determine the prior number of stake for an unlocking date as of a block number.

```js
function getPriorTotalStakesForDate(uint256 date, uint256 blockNumber) public view
returns(uint96)
```

**Returns**

The number of votes the account had as of the given block.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The date to check the stakes for. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

### getPriorVotes

⤾ overrides [IStaking.getPriorVotes](IStaking.md#getpriorvotes)

Determine the prior number of votes for a delegatee as of a block number.
Iterate through checkpoints adding up voting power.

```js
function getPriorVotes(address account, uint256 blockNumber, uint256 date) public view
returns(votes uint96)
```

**Returns**

The number of votes the delegatee had as of the given block.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 
| date | uint256 | The staking date to compute the power for. | 

### _totalPowerByDateForDelegatee

Compute the voting power for a specific date.
Power = stake * weight

```js
function _totalPowerByDateForDelegatee(address account, uint256 date, uint256 startDate, uint256 blockNumber) internal view
returns(power uint96)
```

**Returns**

The stacking power.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| date | uint256 | The staking date to compute the power for. | 
| startDate | uint256 | The date for which we need to know the power of the stake. | 
| blockNumber | uint256 | The block number, needed for checkpointing. | 

### getPriorStakeByDateForDelegatee

Determine the prior number of stake for an account as of a block number.

```js
function getPriorStakeByDateForDelegatee(address account, uint256 date, uint256 blockNumber) public view
returns(uint96)
```

**Returns**

The number of votes the account had as of the given block.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| date | uint256 | The staking date to compute the power for. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

### getPriorWeightedStake

⤾ overrides [IStaking.getPriorWeightedStake](IStaking.md#getpriorweightedstake)

⤿ Overridden Implementation(s): [StakingMockup.getPriorWeightedStake](StakingMockup.md#getpriorweightedstake)

Determine the prior weighted stake for an account as of a block number.
Iterate through checkpoints adding up voting power.

```js
function getPriorWeightedStake(address account, uint256 blockNumber, uint256 date) public view
returns(votes uint96)
```

**Returns**

The weighted stake the account had as of the given block.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 
| date | uint256 | The date/timestamp of the unstaking time. | 

### weightedStakeByDate

Compute the voting power for a specific date.
Power = stake * weight
TODO: WeightedStaking::weightedStakeByDate should probably better
be internal instead of a public function.

```js
function weightedStakeByDate(address account, uint256 date, uint256 startDate, uint256 blockNumber) public view
returns(power uint96)
```

**Returns**

The stacking power.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The user address. | 
| date | uint256 | The staking date to compute the power for. | 
| startDate | uint256 | The date for which we need to know the power of the stake. | 
| blockNumber | uint256 | The block number, needed for checkpointing. | 

### getPriorUserStakeByDate

Determine the prior number of stake for an account until a
certain lock date as of a block number.

```js
function getPriorUserStakeByDate(address account, uint256 date, uint256 blockNumber) external view
returns(uint96)
```

**Returns**

The number of votes the account had as of the given block.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| date | uint256 | The lock date. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

### _getPriorUserStakeByDate

Determine the prior number of stake for an account until a
		certain lock date as of a block number.

```js
function _getPriorUserStakeByDate(address account, uint256 date, uint256 blockNumber) internal view
returns(uint96)
```

**Returns**

The number of votes the account had as of the given block.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| date | uint256 | The lock date. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

### getPriorVestingWeightedStake

⤾ overrides [IStaking.getPriorVestingWeightedStake](IStaking.md#getpriorvestingweightedstake)

Determine the prior weighted vested amount for an account as of a block number.
Iterate through checkpoints adding up voting power.

```js
function getPriorVestingWeightedStake(uint256 blockNumber, uint256 date) public view
returns(votes uint96)
```

**Returns**

The weighted stake the account had as of the given block.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| blockNumber | uint256 | The block number to get the vote balance at. | 
| date | uint256 | The staking date to compute the power for. | 

### weightedVestingStakeByDate

Compute the voting power for a specific date.
Power = stake * weight
TODO: WeightedStaking::weightedVestingStakeByDate should probably better
be internal instead of a public function.

```js
function weightedVestingStakeByDate(uint256 date, uint256 startDate, uint256 blockNumber) public view
returns(power uint96)
```

**Returns**

The stacking power.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The staking date to compute the power for. | 
| startDate | uint256 | The date for which we need to know the power of the stake. | 
| blockNumber | uint256 | The block number, needed for checkpointing. | 

### getPriorVestingStakeByDate

Determine the prior number of vested stake for an account until a
certain lock date as of a block number.

```js
function getPriorVestingStakeByDate(uint256 date, uint256 blockNumber) external view
returns(uint96)
```

**Returns**

The number of votes the account had as of the given block.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The lock date. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

### _getPriorVestingStakeByDate

Determine the prior number of vested stake for an account until a
		certain lock date as of a block number.

```js
function _getPriorVestingStakeByDate(uint256 date, uint256 blockNumber) internal view
returns(uint96)
```

**Returns**

The number of votes the account had as of the given block.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The lock date. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

### _getCurrentBlockNumber

⤿ Overridden Implementation(s): [StakingMock._getCurrentBlockNumber](StakingMock.md#_getcurrentblocknumber)

Determine the current Block Number

```js
function _getCurrentBlockNumber() internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### computeWeightByDate

Compute the weight for a specific date.

```js
function computeWeightByDate(uint256 date, uint256 startDate) public pure
returns(weight uint96)
```

**Returns**

The weighted stake the account had as of the given block.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The unlocking date. | 
| startDate | uint256 | We compute the weight for the tokens staked until 'date' on 'startDate'. | 

### timestampToLockDate

⤾ overrides [IStaking.timestampToLockDate](IStaking.md#timestamptolockdate)

Unstaking is possible every 2 weeks only. This means, to
calculate the key value for the staking checkpoints, we need to
map the intended timestamp to the closest available date.

```js
function timestampToLockDate(uint256 timestamp) public view
returns(lockDate uint256)
```

**Returns**

The actual unlocking date (might be up to 2 weeks shorter than intended).

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| timestamp | uint256 | The unlocking timestamp. | 

### _adjustDateForOrigin

origin vesting contracts have different dates
we need to add 2 weeks to get end of period (by default, it's start)

```js
function _adjustDateForOrigin(uint256 date) internal view
returns(uint256)
```

**Returns**

unlocking date.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The staking date to compute the power for. | 

### addAdmin

Add account to ACL.

```js
function addAdmin(address _admin) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _admin | address | The addresses of the account to grant permissions. | 

### removeAdmin

Remove account from ACL.

```js
function removeAdmin(address _admin) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _admin | address | The addresses of the account to revoke permissions. | 

### addContractCodeHash

⤿ Overridden Implementation(s): [StakingMockup.addContractCodeHash](StakingMockup.md#addcontractcodehash)

Add vesting contract's code hash to a map of code hashes.

```js
function addContractCodeHash(address vesting) public nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vesting | address | The address of Vesting contract. | 

### removeContractCodeHash

⤿ Overridden Implementation(s): [StakingMockup.removeContractCodeHash](StakingMockup.md#removecontractcodehash)

Add vesting contract's code hash to a map of code hashes.

```js
function removeContractCodeHash(address vesting) public nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vesting | address | The address of Vesting contract. | 

### isVestingContract

⤾ overrides [IStaking.isVestingContract](IStaking.md#isvestingcontract)

⤿ Overridden Implementation(s): [StakingMockup.isVestingContract](StakingMockup.md#isvestingcontract)

Return flag whether the given address is a registered vesting contract.

```js
function isVestingContract(address stakerAddress) public view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| stakerAddress | address | the address to check | 

### _getCodeHash

⤿ Overridden Implementation(s): [StakingMockup._getCodeHash](StakingMockup.md#_getcodehash)

Return hash of contract code

```js
function _getCodeHash(address _contract) internal view
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _contract | address |  | 

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
