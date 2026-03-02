# sovrynProtocol
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/core/Protocol.sol)

**Inherits:**
[State](/contracts/core/State.sol/contract.State.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains the proxy functionality to deploy Protocol anchor
and logic apart, turning it upgradable.

*TODO: can I change this proxy to EIP-1822 proxy standard, please.
https://eips.ethereum.org/EIPS/eip-1822*


## Functions
### function

Fallback function performs a delegate call
to the actual implementation address is pointing this proxy.
Returns whatever the implementation call returns.


```solidity
function() external payable;
```

### replaceContract

External owner target initializer.


```solidity
function replaceContract(address target) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`target`|`address`|The target addresses.|


### setTargets

External owner setter for target addresses.


```solidity
function setTargets(string[] calldata sigsArr, address[] calldata targetsArr) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sigsArr`|`string[]`|The array of signatures.|
|`targetsArr`|`address[]`|The array of addresses.|


### getTarget

External getter for target addresses.


```solidity
function getTarget(string calldata sig) external view returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sig`|`string`|The signature.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The address for a given signature.|


