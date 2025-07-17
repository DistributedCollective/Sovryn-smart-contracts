# SwapsUser
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/swaps/SwapsUser.sol)

**Inherits:**
[State](/contracts/core/State.sol/contract.State.md), [SwapsEvents](/contracts/events/SwapsEvents.sol/contract.SwapsEvents.md), [FeesHelper](/contracts/mixins/FeesHelper.sol/contract.FeesHelper.md)

Copyright 2017-2021, bZeroX, LLC <https://bzx.network/>. All Rights Reserved.
Licensed under the Apache License, Version 2.0.


## Functions
### _loanSwap

Internal loan swap.


```solidity
function _loanSwap(
    bytes32 loanId,
    address sourceToken,
    address destToken,
    address user,
    uint256 minSourceTokenAmount,
    uint256 maxSourceTokenAmount,
    uint256 requiredDestTokenAmount,
    bool bypassFee,
    bytes memory loanDataBytes
) internal returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed, uint256 sourceToDestSwapRate);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|The ID of the loan.|
|`sourceToken`|`address`|The address of the source tokens.|
|`destToken`|`address`|The address of destination tokens.|
|`user`|`address`|The user address.|
|`minSourceTokenAmount`|`uint256`|The minimum amount of source tokens to swap.|
|`maxSourceTokenAmount`|`uint256`|The maximum amount of source tokens to swap.|
|`requiredDestTokenAmount`|`uint256`|The required amount of destination tokens.|
|`bypassFee`|`bool`|To bypass or not the fee.|
|`loanDataBytes`|`bytes`|The payload for the call. These loan DataBytes are additional loan data (not in use for token swaps).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`destTokenAmountReceived`|`uint256`|destTokenAmountReceived|
|`sourceTokenAmountUsed`|`uint256`|sourceTokenAmountUsed|
|`sourceToDestSwapRate`|`uint256`|sourceToDestSwapRate|


### _swapsCall

Will revert if swap size too large.
Will revert if disagreement found.

Calculate amount of source and destination tokens.

*Wrapper for _swapsCall_internal function.*


```solidity
function _swapsCall(
    address[5] memory addrs,
    uint256[3] memory vals,
    bytes32 loanId,
    bool miscBool,
    bytes memory loanDataBytes,
    bool isSwapExternal
) internal returns (uint256, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`addrs`|`address[5]`|The array of addresses.|
|`vals`|`uint256[3]`|The array of values.|
|`loanId`|`bytes32`|The Id of the associated loan.|
|`miscBool`|`bool`|True/false to bypassFee.|
|`loanDataBytes`|`bytes`|Additional loan data (not in use yet).|
|`isSwapExternal`|`bool`||

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|destTokenAmountReceived The amount of destination tokens received.|
|`<none>`|`uint256`|sourceTokenAmountUsed The amount of source tokens used.|


### _swapsCall_internal

addrs[0]: sourceToken
addrs[1]: destToken
addrs[2]: receiver
addrs[3]: returnToSender
addrs[4]: user
vals[0]:  minSourceTokenAmount
vals[1]:  maxSourceTokenAmount
vals[2]:  requiredDestTokenAmount
bypassFee
condition: vals[0] will always be used as sourceAmount
user
sourceToken (feeToken)
pairToken (used to check if there is any special rebates or not) -- to pay fee reward
Condition: unknown sourceAmount will be used.
There's no minimum destTokenAmount, but all of vals[0]
(minSourceTokenAmount) must be spent.
There's a minimum destTokenAmount required, but
sourceTokenAmountUsed won't be greater
than vals[1] (maxSourceTokenAmount)
user
loanId,
destToken (feeToken)
pairToken (used to check if there is any special rebates or not) -- to pay fee reward

Calculate amount of source and destination tokens.

*Calls swapsImpl::internalSwap*


```solidity
function _swapsCall_internal(address[5] memory addrs, uint256[3] memory vals)
    internal
    returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`addrs`|`address[5]`|The array of addresses.|
|`vals`|`uint256[3]`|The array of values.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`destTokenAmountReceived`|`uint256`|The amount of destination tokens received.|
|`sourceTokenAmountUsed`|`uint256`|The amount of source tokens used.|


### _swapsExpectedReturn

Calculate expected amount of destination tokens.

*Calls swapsImpl::internalExpectedReturn*


```solidity
function _swapsExpectedReturn(address sourceToken, address destToken, uint256 sourceTokenAmount)
    internal
    view
    returns (uint256 destTokenAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceToken`|`address`|The address of the source tokens.|
|`destToken`|`address`|The address of the destination tokens.|
|`sourceTokenAmount`|`uint256`|The amount of the source tokens.|


### _checkSwapSize

Verify that the amount of tokens are under the swap limit.

*Calls priceFeeds::amountInEth*


```solidity
function _checkSwapSize(address tokenAddress, uint256 amount) internal view;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenAddress`|`address`|The address of the token to calculate price.|
|`amount`|`uint256`|The amount of tokens to calculate price.|


