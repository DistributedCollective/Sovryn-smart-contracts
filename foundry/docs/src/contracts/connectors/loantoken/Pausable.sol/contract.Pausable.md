# Pausable
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/Pausable.sol)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized margin
trading and lending https://bzx.network similar to the dYdX protocol.
The contract implements pausable functionality by reading on slots the
pause state of contract functions.


## State Variables
### Pausable_FunctionPause
keccak256("Pausable_FunctionPause")


```solidity
bytes32 internal constant Pausable_FunctionPause = 0xa7143c84d793a15503da6f19bf9119a2dac94448ca45d77c8bf08f57b2e91047;
```


## Functions
### pausable


```solidity
modifier pausable(bytes4 sig);
```

### _isPaused

Check whether a function is paused.

*Used to read externally from the smart contract to see if a
function is paused.*


```solidity
function _isPaused(bytes4 sig) internal view returns (bool isPaused);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sig`|`bytes4`|The function ID, the selector on bytes4.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`isPaused`|`bool`|Whether the function is paused: true or false.|


