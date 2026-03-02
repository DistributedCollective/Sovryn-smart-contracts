# StakingRewards
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/StakingRewards/StakingRewards.sol)

**Inherits:**
[StakingRewardsStorage](/contracts/governance/StakingRewards/StakingRewardsStorage.sol/contract.StakingRewardsStorage.md)

This is a trial incentive program.
In this, the SOV emitted and becoming liquid from the Adoption Fund could be utilized
to offset the higher APY's offered for Liquidity Mining events.
Vesting contract stakes are excluded from these rewards.
Only wallets which have staked previously liquid SOV are eligible for these rewards.
Tokenholders who stake their SOV receive staking rewards, a pro-rata share
of the revenue that the platform generates from various transaction fees
plus revenues from stakers who have a portion of their SOV slashed for
early unstaking.


## Functions
### initialize

Replacement of constructor by initialize function for Upgradable Contracts
This function will be called only once by the owner.


```solidity
function initialize(address _SOV, IStaking _staking) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_SOV`|`address`|SOV token address|
|`_staking`|`IStaking`|StakingProxy address should be passed|


### stop

Stops the current rewards program.

*All stakes existing on the contract at the point in time of
cancellation continue accruing rewards until the end of the staking
period being rewarded*


```solidity
function stop() external onlyOwner;
```

### collectReward

Collect rewards

*User calls this function to collect SOV staking rewards as per the SIP-0024 program.
The weighted stake is calculated using getPriorWeightedStake. Block number sent to the functon
must be a finalised block, hence we deduct 1 from the current block. User is only allowed to withdraw
after intervals of 14 days.*


```solidity
function collectReward(uint256 restartTime) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`restartTime`|`uint256`|The time from which the staking rewards calculation shall restart. The issue is that we can only run for a max duration and if someone stakes for the first time after the max duration is over, the reward will always return 0. Thus, we need to restart from the duration that elapsed without generating rewards.|


### withdrawTokensByOwner

Withdraws all token from the contract by Multisig.


```solidity
function withdrawTokensByOwner(address _receiverAddress) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_receiverAddress`|`address`|The address where the tokens has to be transferred.|


### setAverageBlockTime

Changes average block time - based on blockchain

*If average block time significantly changes, we can update it here and use for block number calculation*


```solidity
function setAverageBlockTime(uint256 _averageBlockTime) external onlyOwner;
```

### setBlock

This function computes the last staking checkpoint and calculates the corresponding
block number using the average block time which is then added to the mapping `checkpointBlockDetails`.


```solidity
function setBlock() external;
```

### setHistoricalBlock

This function computes the block number using the average block time for a given historical
checkpoint which is added to the mapping `checkpointBlockDetails`.


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


### _computeRewardForDate

Internal function to calculate weighted stake

*If the rewards program is stopped, the user will still continue to
earn till the end of staking period based on the stop block.*


```solidity
function _computeRewardForDate(address _staker, uint256 _block, uint256 _date)
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
function _payReward(address _staker, uint256 amount) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_staker`|`address`|User address|
|`amount`|`uint256`|the reward amount|


### _transferSOV

transfers SOV tokens to given address


```solidity
function _transferSOV(address _receiver, uint256 _amount) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_receiver`|`address`|the address of the SOV receiver|
|`_amount`|`uint256`|the amount to be transferred|


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

*The collectReward() function internally calls this function to calculate reward amount*


```solidity
function getStakerCurrentReward(bool considerMaxDuration, uint256 restartTime)
    public
    view
    returns (uint256 lastWithdrawalInterval, uint256 amount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`considerMaxDuration`|`bool`|True: Runs for the maximum duration - used in tx not to run out of gas False - to query total rewards|
|`restartTime`|`uint256`|The time from which the staking rewards calculation shall restart.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`lastWithdrawalInterval`|`uint256`|The timestamp of last withdrawal|
|`amount`|`uint256`|The accumulated reward|


## Events
### RewardWithdrawn
Emitted when SOV is withdrawn


```solidity
event RewardWithdrawn(address indexed receiver, uint256 amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|The address which recieves the SOV|
|`amount`|`uint256`|The amount withdrawn from the Smart Contract|

