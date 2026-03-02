# StakingRewardsOsStorage
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/StakingRewards/StakingRewardsOsStorage.sol)

**Inherits:**
[Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

Just the storage part of staking rewards contract, no functions,
only constant, variables and required structures (mappings).
Used by StackingRewardsProxy.
What is SOV staking rewards ?
The purpose of the SOV staking rewards program is to reward,
"marginal stakers" (ie, stakers by choice, not currently vesting) with liquid SOV
at the beginning of each new staking interval.


## State Variables
### TWO_WEEKS
2 weeks in seconds.


```solidity
uint256 public constant TWO_WEEKS = 1209600;
```


### BASE_RATE
Annual Base Rate - it is the maximum interest rate(APY)


```solidity
uint256 public constant BASE_RATE = 900;
```


### DIVISOR
DIVISOR is set as 2600000 = 26 (num periods per year) * 10 (max voting weight) * 10000 (900 -> 0.09)


```solidity
uint256 public constant DIVISOR = 2600000;
```


### osSOV
The SOV token contract.


```solidity
IERC20Mintable internal osSOV;
```


### staking
the staking proxy contract address


```solidity
IStaking internal staking;
```


### maxDuration
Maximum duration to collect rewards at one go


```solidity
uint256 internal maxDuration;
```


### rewardsProgramStartTime
Represents the time when the contract is deployed


```solidity
uint256 internal rewardsProgramStartTime;
```


### stopBlock
Represents the block when the Staking Rewards pogram is stopped


```solidity
uint256 internal stopBlock;
```


### stopRewardsTimestamp
Timestamp of the stopBlock adjusted to the staking lock timestamp


```solidity
uint256 internal stopRewardsTimestamp;
```


### stakerNextWithdrawTimestamp
User Address -> Next Withdrawn Timestamp


```solidity
mapping(address => uint256) internal stakerNextWithdrawTimestamp;
```


### claimedBalances
User Address -> Claimed Balance


```solidity
mapping(address => uint256) internal claimedBalances;
```


### deploymentBlock
Represents the block when the StakingRwards Program is started


```solidity
uint256 internal deploymentBlock;
```


### checkpointBlockNumber
BlockTime -> BlockNumber for a Staking Checkpoint


```solidity
mapping(uint256 => uint256) internal checkpointBlockNumber;
```


### averageBlockTime
Average Block Time - making it flexible


```solidity
uint256 internal averageBlockTime;
```


## Functions
### getCheckpointBlockNumber

GETTERS


```solidity
function getCheckpointBlockNumber(uint256 _checkpointTimestamp) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_checkpointTimestamp`|`uint256`|Checkpoint timestamp|


### getOsSOV


```solidity
function getOsSOV() external view returns (IERC20Mintable);
```

### getStaking


```solidity
function getStaking() external view returns (IStaking);
```

### getMaxDuration


```solidity
function getMaxDuration() external view returns (uint256);
```

### getRewardsProgramStartTime


```solidity
function getRewardsProgramStartTime() external view returns (uint256);
```

### getStopBlock


```solidity
function getStopBlock() external view returns (uint256);
```

### getStopRewardsTimestamp


```solidity
function getStopRewardsTimestamp() external view returns (uint256);
```

### getStakerNextWithdrawTimestamp


```solidity
function getStakerNextWithdrawTimestamp(address _staker) external view returns (uint256);
```

### getDeploymentBlock


```solidity
function getDeploymentBlock() external view returns (uint256);
```

### getAverageBlockTime


```solidity
function getAverageBlockTime() external view returns (uint256);
```

### getClaimedBalances


```solidity
function getClaimedBalances(address _staker) external view returns (uint256);
```

