# ProtocolTokenUser
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/mixins/ProtocolTokenUser.sol)

**Inherits:**
[State](/contracts/core/State.sol/contract.State.md)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized margin
trading and lending https://bzx.network similar to the dYdX protocol.
This contract implements functionality to withdraw protocol tokens.


## Functions
### _withdrawProtocolToken

Internal function to withdraw an amount of protocol tokens from this contract.


```solidity
function _withdrawProtocolToken(address receiver, uint256 amount) internal returns (address, bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|The address of the recipient.|
|`amount`|`uint256`|The amount of tokens to withdraw.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The protocol token address.|
|`<none>`|`bool`|Withdrawal success (true/false).|


