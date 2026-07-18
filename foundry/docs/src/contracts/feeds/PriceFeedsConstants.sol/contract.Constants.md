# Constants
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/feeds/PriceFeedsConstants.sol)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract keep the addresses of token instances for wrBTC, base token
and protocol token.


## State Variables
### wrbtcToken

```solidity
IWrbtcERC20 public wrbtcToken;
```


### baseToken

```solidity
IWrbtcERC20 public baseToken;
```


### protocolTokenAddress

```solidity
address internal protocolTokenAddress;
```


## Functions
### _setWrbtcToken

Set wrBTC token address.


```solidity
function _setWrbtcToken(address _wrbtcTokenAddress) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_wrbtcTokenAddress`|`address`|The address of the wrapped wrBTC token.|


### _setProtocolTokenAddress

Set protocol token address.


```solidity
function _setProtocolTokenAddress(address _protocolTokenAddress) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_protocolTokenAddress`|`address`|The address of the protocol token.|


### _setBaseToken

Set base token address.


```solidity
function _setBaseToken(address _baseTokenAddress) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_baseTokenAddress`|`address`|The address of the base token.|


