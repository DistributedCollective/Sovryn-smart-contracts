# SharedReentrancyGuard
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/reentrancy/SharedReentrancyGuard.sol)


## State Variables
### MUTEX

```solidity
Mutex private constant MUTEX = Mutex(0xba10edD6ABC7696Eae685839217BdcC42139612b);
```


## Functions
### globallyNonReentrant


```solidity
modifier globallyNonReentrant();
```

