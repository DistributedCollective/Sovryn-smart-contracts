# PausableRole
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/utils/PausableRole.sol)

**Inherits:**
[PausableOz](/contracts/openzeppelin/PausableOz.sol/contract.PausableOz.md)


## State Variables
### pauser

```solidity
address public pauser;
```


## Functions
### onlyPauserOrOwner

*Modifier to make a function callable only when the caller is pauser or owner*


```solidity
modifier onlyPauserOrOwner();
```

### setPauser

Set the pauser address.
only pauser can perform this action.


```solidity
function setPauser(address newPauser) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newPauser`|`address`|The new address of the pauser.|


### pause

*Called by the owner to pause, triggers stopped state.*


```solidity
function pause() public onlyPauserOrOwner whenNotPaused;
```

### unpause

*Called by the owner to unpause, returns to normal state.*


```solidity
function unpause() public onlyPauserOrOwner whenPaused;
```

## Events
### SetPauser

```solidity
event SetPauser(address indexed sender, address indexed oldPauser, address indexed newPauser);
```

