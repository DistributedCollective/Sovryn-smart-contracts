# StakingRewardsStorage
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/StakingRewards/StakingRewardsStorage.sol)

**Inherits:**
[Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

Just the storage part of staking rewards contract, no functions,
only constant, variables and required structures (mappings).
Used by StackingRewardsProxy.
What is SOV staking rewards - SIP-0024?
The purpose of the SOV staking rewards - SIP-0024 is to reward,
"marginal stakers" (ie, stakers by choice, not currently vesting) with liquid SOV
at the beginning of each new staking interval.


## State Variables
### SOV
The SOV token contract.


```solidity
IERC20 public SOV;
```


### staking
the staking proxy contract address


```solidity
IStaking public staking;
```


### TWO_WEEKS
2 weeks in seconds.


```solidity
uint256 public constant TWO_WEEKS = 1209600;
```


### BASE_RATE
Annual Base Rate - it is the maximum interest rate(APY)


```solidity
uint256 public constant BASE_RATE = 2975;
```


### DIVISOR
DIVISOR is set as 2600000 = 26 (num periods per year) * 10 (max voting weight) * 10000 (2975 -> 0.2975)


```solidity
uint256 public constant DIVISOR = 2600000;
```


### maxDuration
Maximum duration to collect rewards at one go


```solidity
uint256 public maxDuration;
```


### startTime
Represents the time when the contract is deployed


```solidity
uint256 public startTime;
```


### stopBlock
Represents the block when the Staking Rewards pogram is stopped


```solidity
uint256 public stopBlock;
```


### withdrawals
User Address -> Last Withdrawn Timestamp


```solidity
mapping(address => uint256) public withdrawals;
```


### claimedBalances
User Address -> Claimed Balance


```solidity
mapping(address => uint256) public claimedBalances;
```


### deploymentBlock
Represents the block when the StakingRwards Program is started


```solidity
uint256 public deploymentBlock;
```


### _initialized
Moved the variables from Initializable contract to resolve issue caused by incorrect Inheritance Order

*Indicates that the contract has been initialized.*


```solidity
bool private _initialized;
```


### _initializing
*Indicates that the contract is in the process of being initialized.*


```solidity
bool private _initializing;
```


### checkpointBlockDetails
BlockTime -> BlockNumber for a Staking Checkpoint


```solidity
mapping(uint256 => uint256) public checkpointBlockDetails;
```


### averageBlockTime
Average Block Time - making it flexible


```solidity
uint256 public averageBlockTime;
```


