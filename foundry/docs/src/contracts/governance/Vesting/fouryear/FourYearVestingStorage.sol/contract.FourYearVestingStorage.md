# FourYearVestingStorage
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/fouryear/FourYearVestingStorage.sol)

**Inherits:**
[Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

This contract is just the storage required for four year vesting.
It is parent of FourYearVestingLogic and FourYearVesting.

*Use Ownable as a parent to align storage structure for Logic and Proxy contracts.*


## State Variables
### SOV
The SOV token contract.


```solidity
IERC20 public SOV;
```


### staking
The staking contract address.


```solidity
IStaking public staking;
```


### tokenOwner
The owner of the vested tokens.


```solidity
address public tokenOwner;
```


### feeSharingCollector
Fee sharing Proxy.


```solidity
IFeeSharingCollector public feeSharingCollector;
```


### cliff
The cliff. After this time period the tokens begin to unlock.


```solidity
uint256 public constant cliff = 4 weeks;
```


### duration
The duration. After this period all tokens will have been unlocked.


```solidity
uint256 public constant duration = 156 weeks;
```


### startDate
The start date of the vesting.


```solidity
uint256 public startDate;
```


### endDate
The end date of the vesting.


```solidity
uint256 public endDate;
```


### FOUR_WEEKS
Constant used for computing the vesting dates.


```solidity
uint256 public constant FOUR_WEEKS = 4 weeks;
```


### maxInterval
Maximum interval to stake tokens at one go


```solidity
uint256 public maxInterval;
```


### lastStakingSchedule
End of previous staking schedule.


```solidity
uint256 public lastStakingSchedule;
```


### remainingStakeAmount
Amount of shares left to be staked.


```solidity
uint256 public remainingStakeAmount;
```


### durationLeft
Durations left.


```solidity
uint256 public durationLeft;
```


### cliffAdded
Cliffs added.


```solidity
uint256 public cliffAdded;
```


### newTokenOwner
Address of new token owner.


```solidity
address public newTokenOwner;
```


### newImplementation
Address of new implementation.


```solidity
address public newImplementation;
```


### extendDurationFor
Duration(from start) till the time unlocked tokens are extended(for 3 years)


```solidity
uint256 public extendDurationFor;
```


