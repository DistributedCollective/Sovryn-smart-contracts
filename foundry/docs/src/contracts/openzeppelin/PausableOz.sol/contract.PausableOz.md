# PausableOz
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/openzeppelin/PausableOz.sol)

**Inherits:**
[Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)


## State Variables
### _paused

```solidity
bool internal _paused;
```


## Functions
### constructor


```solidity
constructor() internal;
```

### paused

*Returns true if the contract is paused, and false otherwise.*


```solidity
function paused() public view returns (bool);
```

### whenNotPaused

*Modifier to make a function callable only when the contract is not paused.*


```solidity
modifier whenNotPaused();
```

### whenPaused

*Modifier to make a function callable only when the contract is paused.*


```solidity
modifier whenPaused();
```

### pause

*Called by the owner to pause, triggers stopped state.*


```solidity
function pause() public onlyOwner whenNotPaused;
```

### unpause

*Called by the owner to unpause, returns to normal state.*


```solidity
function unpause() public onlyOwner whenPaused;
```

## Events
### Paused
*Emitted when the pause is triggered by the owner (`account`).*


```solidity
event Paused(address account);
```

### Unpaused
*Emitted when the pause is lifted by the owner (`account`).*


```solidity
event Unpaused(address account);
```

