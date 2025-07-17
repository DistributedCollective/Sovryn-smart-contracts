# ProxyOwnable
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/utils/ProxyOwnable.sol)

Based on OpenZeppelin's Ownable contract:
https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol

*Contract module which provides a basic access control mechanism, where
there is an account (an owner) that can be granted exclusive access to
specific functions.
This module is used through inheritance. It will make available the modifier
`onlyOwner`, which can be applied to your functions to restrict their use to
the owner.*


## State Variables
### KEY_OWNER

```solidity
bytes32 private constant KEY_OWNER = keccak256("key.proxy.owner");
```


## Functions
### constructor

*Initializes the contract setting the deployer as the initial owner.*


```solidity
constructor() internal;
```

### onlyProxyOwner

*Throws if called by any account other than the owner.*


```solidity
modifier onlyProxyOwner();
```

### _setProxyOwner

Set address of the owner.


```solidity
function _setProxyOwner(address _owner) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_owner`|`address`|Address of the owner.|


### setProxyOwner

Set address of the owner (only owner can call this function)


```solidity
function setProxyOwner(address _owner) public onlyProxyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_owner`|`address`|Address of the owner.|


### getProxyOwner

Return address of the owner.


```solidity
function getProxyOwner() public view returns (address _owner);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_owner`|`address`|Address of the owner.|


## Events
### ProxyOwnershipTransferred

```solidity
event ProxyOwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

