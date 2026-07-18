# SwapsImplLocal
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/swaps/connectors/testnet/SwapsImplLocal.sol)

**Inherits:**
[State](/contracts/core/State.sol/contract.State.md)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains the implementation of swap process and rate calculations.


## Functions
### internalSwap

Swap two tokens.


```solidity
function internalSwap(
    address sourceTokenAddress,
    address destTokenAddress,
    address,
    address returnToSenderAddress,
    uint256 minSourceTokenAmount,
    uint256 maxSourceTokenAmount,
    uint256 requiredDestTokenAmount
) public payable returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceTokenAddress`|`address`|The address of the source tokens.|
|`destTokenAddress`|`address`|The address of the destiny tokens.|
|`<none>`|`address`||
|`returnToSenderAddress`|`address`||
|`minSourceTokenAmount`|`uint256`||
|`maxSourceTokenAmount`|`uint256`||
|`requiredDestTokenAmount`|`uint256`||

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`destTokenAmountReceived`|`uint256`|The amount of destiny tokens sent.|
|`sourceTokenAmountUsed`|`uint256`|The amount of source tokens spent.|


### internalExpectedRate

Send unused source token back.

Calculate the expected price rate of swapping a given amount
of tokens.


```solidity
function internalExpectedRate(
    address sourceTokenAddress,
    address destTokenAddress,
    uint256 sourceTokenAmount,
    address unused
) public view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceTokenAddress`|`address`|The address of the source tokens.|
|`destTokenAddress`|`address`|The address of the destiny tokens.|
|`sourceTokenAmount`|`uint256`|The amount of source tokens.|
|`unused`|`address`|Fourth parameter ignored.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|precision The expected price rate.|


### internalExpectedReturn

Calculate the expected return of swapping a given amount
of tokens.


```solidity
function internalExpectedReturn(
    address sourceTokenAddress,
    address destTokenAddress,
    uint256 sourceTokenAmount,
    address unused,
    IERC20[] memory defaultPath
) public view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceTokenAddress`|`address`|The address of the source tokens.|
|`destTokenAddress`|`address`|The address of the destiny tokens.|
|`sourceTokenAmount`|`uint256`|The amount of source tokens.|
|`unused`|`address`|Fourth parameter ignored.|
|`defaultPath`|`IERC20[]`|defaultPath for swap.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|precision The expected return.|


