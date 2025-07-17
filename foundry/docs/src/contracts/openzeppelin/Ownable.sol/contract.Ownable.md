# Ownable
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/openzeppelin/Ownable.sol)

**Inherits:**
[Context](/contracts/openzeppelin/Context.sol/contract.Context.md)

*Contract module which provides a basic access control mechanism, where
there is an account (an owner) that can be granted exclusive access to
specific functions.
This module is used through inheritance. It will make available the modifier
`onlyOwner`, which can be applied to your functions to restrict their use to
the owner.*


## State Variables
### _owner

```solidity
address private _owner;
```


## Functions
### constructor

*Initializes the contract setting the deployer as the initial owner.*


```solidity
constructor() internal;
```

### owner

*Returns the address of the current owner.*


```solidity
function owner() public view returns (address);
```

### onlyOwner

*Throws if called by any account other than the owner.*


```solidity
modifier onlyOwner();
```

### isOwner

*Returns true if the caller is the current owner.*


```solidity
function isOwner() public view returns (bool);
```

### transferOwnership

*Transfers ownership of the contract to a new account (`newOwner`).
Can only be called by the current owner.*


```solidity
function transferOwnership(address newOwner) public onlyOwner;
```

### _transferOwnership

*Transfers ownership of the contract to a new account (`newOwner`).*


```solidity
function _transferOwnership(address newOwner) internal;
```

## Events
### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

