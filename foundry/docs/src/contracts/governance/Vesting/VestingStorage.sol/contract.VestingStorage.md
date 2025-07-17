# VestingStorage
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/VestingStorage.sol)

**Inherits:**
[Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

This contract is just the storage required for vesting.
It is parent of VestingLogic and TeamVesting.

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
uint256 public cliff;
```


### duration
The duration. After this period all tokens will have been unlocked.


```solidity
uint256 public duration;
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
uint256 constant FOUR_WEEKS = 4 weeks;
```


