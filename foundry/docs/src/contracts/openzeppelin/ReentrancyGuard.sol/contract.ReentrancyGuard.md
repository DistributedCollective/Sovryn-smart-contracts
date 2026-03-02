# ReentrancyGuard
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/openzeppelin/ReentrancyGuard.sol)

**Author:**
Remco Bloemen <remco@2π.com>, Eenae <alexey@mixbytes.io>

*If you mark a function `nonReentrant`, you should also
mark it `external`.*


## State Variables
### REENTRANCY_GUARD_FREE
*Constant for unlocked guard state - non-zero to prevent extra gas costs.
See: https://github.com/OpenZeppelin/openzeppelin-solidity/issues/1056*


```solidity
uint256 internal constant REENTRANCY_GUARD_FREE = 1;
```


### REENTRANCY_GUARD_LOCKED
*Constant for locked guard state*


```solidity
uint256 internal constant REENTRANCY_GUARD_LOCKED = 2;
```


### reentrancyLock
*We use a single lock for the whole contract.*


```solidity
uint256 internal reentrancyLock = REENTRANCY_GUARD_FREE;
```


## Functions
### nonReentrant

*Prevents a contract from calling itself, directly or indirectly.
If you mark a function `nonReentrant`, you should also
mark it `external`. Calling one `nonReentrant` function from
another is not supported. Instead, you can implement a
`private` function doing the actual work, and an `external`
wrapper marked as `nonReentrant`.*


```solidity
modifier nonReentrant();
```

