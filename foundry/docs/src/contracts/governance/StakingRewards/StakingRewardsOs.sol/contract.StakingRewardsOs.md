# StakingRewardsOs
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/StakingRewards/StakingRewardsOs.sol)

**Inherits:**
[StakingRewardsOsStorage](/contracts/governance/StakingRewards/StakingRewardsOsStorage.sol/contract.StakingRewardsOsStorage.md), [Initializable](/contracts/openzeppelin/Initializable.sol/contract.Initializable.md)

This is a trial incentive program.
In this, the osSOV minted to voluntary stakers and is locked until transferred to BitcoinOS


## Functions
### initialize

Replacement of constructor by initialize function for Upgradable Contracts
This function will be called only once by the owner.


```solidity
function initialize(address _osSOV, IStaking _staking, uint256 _averageBlockTime) external onlyOwner initializer;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_osSOV`|`address`|osSOV token address|
|`_staking`|`IStaking`|StakingProxy address should be passed|
|`_averageBlockTime`|`uint256`|average block time used for calculating rewards|


### stop

Stops the current rewards program.

*Users will only get rewards up to the stop block*


```solidity
function stop() external onlyOwner;
```

### collectReward

Collect rewards

*User calls this function to collect osSOV staking rewards accrued by this contract
The weighted stake is calculated using getPriorWeightedStake. Block number sent to the functon
must be a finalised block, hence we deduct 1 from the current block. User is only allowed to withdraw
after intervals of 14 days.*


```solidity
function collectReward(uint256 _startTime) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_startTime`|`uint256`|The time from which to start the staking rewards calculation The issue is that we can only run for a max duration and if someone stakes for the first time after the max duration is over, the reward will always return 0. Thus, we need to restart from the duration that elapsed without generating rewards.|


### setAverageBlockTime

Changes average block time - based on blockchain

*If average block time significantly changes, we can update it here and use for block number calculation*


```solidity
function setAverageBlockTime(uint256 _averageBlockTime) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_averageBlockTime`|`uint256`|- average block time used for calculating checkpoint blocks|


### setBlock

This function computes the last staking checkpoint and calculates the corresponding
block number using the average block time which is then added to the mapping `checkpointBlockNumber`.


```solidity
function setBlock() external;
```

### setHistoricalBlock

This function computes the block number using the average block time for a given historical
checkpoint which is added to the mapping `checkpointBlockNumber`.


```solidity
function setHistoricalBlock(uint256 _time) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_time`|`uint256`|Exact staking checkpoint time|


### setMaxDuration

Sets the max duration

*Rewards can be collected for a maximum duration at a time. This
is to avoid Block Gas Limit failures. Setting it zero would mean that it will loop
through the entire duration since the start of rewards program.
It should ideally be set to a value, for which the rewards can be easily processed.*


```solidity
function setMaxDuration(uint256 _duration) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_duration`|`uint256`|Max duration for which rewards can be collected at a go (in seconds)|


### _computeWeightedStakeForDate

Internal function to calculate weighted stake

*Users will receive rewards uo till the stop block*


```solidity
function _computeWeightedStakeForDate(address _staker, uint256 _block, uint256 _date)
    internal
    view
    returns (uint256 weightedStake);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_staker`|`address`|Staker address|
|`_block`|`uint256`|Last finalised block|
|`_date`|`uint256`|The date to compute prior weighted stakes|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`weightedStake`|`uint256`|The weighted stake|


### _payReward

Internal function to pay rewards

*Base rate is annual, but we pay interest for 14 days,
which is 1/26 of one staking year (1092 days)*


```solidity
function _payReward(address _staker, uint256 _amount) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_staker`|`address`|Staker address|
|`_amount`|`uint256`|the reward amount|


### _getCurrentBlockNumber

Determine the current Block Number

*This is segregated from the _getPriorUserStakeByDate function to better test
advancing blocks functionality using Mock Contracts*


```solidity
function _getCurrentBlockNumber() internal view returns (uint256);
```

### _setBlock

Internal function to calculate and set block


```solidity
function _setBlock(uint256 _checkpointTime) internal;
```

### getStakerCurrentReward

Get staker's current accumulated reward

*getStakerCurrentReward function internally calls this function to calculate reward amount of msg.sender*


```solidity
function getStakerCurrentReward(bool _considerMaxDuration, uint256 _startTime)
    external
    view
    returns (uint256 nextWithdrawTimestamp, uint256 amount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_considerMaxDuration`|`bool`|True: Runs for the maximum duration - used in tx not to run out of gas False - to query total rewards|
|`_startTime`|`uint256`|The time from which the staking rewards calculation shall restart.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`nextWithdrawTimestamp`|`uint256`|The timestamp of last withdrawal|
|`amount`|`uint256`|The accumulated reward|


### getArbitraryStakerCurrentReward

Get any staker's current accumulated reward

*getArbitraryStakerCurrentReward function internally calls this function to calculate reward amount*


```solidity
function getArbitraryStakerCurrentReward(bool _considerMaxDuration, uint256 _startTime, address _staker)
    external
    view
    returns (uint256 nextWithdrawTimestamp, uint256 amount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_considerMaxDuration`|`bool`|True: Runs for the maximum duration - used in tx not to run out of gas False - to query total rewards|
|`_startTime`|`uint256`|The time from which the staking rewards calculation shall restart.|
|`_staker`|`address`|The staker address to calculate rewards for|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`nextWithdrawTimestamp`|`uint256`|The timestamp of last withdrawal|
|`amount`|`uint256`|The accumulated reward|


### _getStakerCurrentReward

Internal function to calculate staker's current reward

*Normally the start time is 0. If this function returns a valid withdraw timestamp
and zero amount - that means there were no valid rewards for that period. So the new period must start
from the end of the last interval or till the time no rewards are accumulated i.e. _startTime*


```solidity
function _getStakerCurrentReward(address _staker, bool _considerMaxDuration, uint256 _startTime)
    internal
    view
    returns (uint256 nextWithdrawTimestamp, uint256 amount);
```

## Events
### RewardWithdrawn
Emitted when osSOV is withdrawn


```solidity
event RewardWithdrawn(address indexed receiver, uint256 amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|The address which recieves the osSOV|
|`amount`|`uint256`|The amount withdrawn from the Smart Contract|

## Structs
### RewardsInterval
fromTimestamp - left boundary of the rewards interval

toTimestamp - right boundary of the rewards interval


```solidity
struct RewardsInterval {
    uint256 fromTimestamp;
    uint256 toTimestamp;
}
```

