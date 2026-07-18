# SwapsExternal
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/modules/SwapsExternal.sol)

**Inherits:**
[VaultController](/contracts/mixins/VaultController.sol/contract.VaultController.md), [SwapsUser](/contracts/swaps/SwapsUser.sol/contract.SwapsUser.md), [ModuleCommonFunctionalities](/contracts/mixins/ModuleCommonFunctionalities.sol/contract.ModuleCommonFunctionalities.md)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains functions to calculate and execute swaps.


## Functions
### constructor

Empty public constructor.


```solidity
constructor() public;
```

### function

Fallback function is to react to receiving value (rBTC).


```solidity
function() external;
```

### initialize

Set function selectors on target contract.


```solidity
function initialize(address target) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`target`|`address`|The address of the target contract.|


### swapExternal

Perform a swap w/ tokens or rBTC as source currency.

*External wrapper that calls SwapsUser::_swapsCall
after turning potential incoming rBTC into wrBTC tokens.*


```solidity
function swapExternal(
    address sourceToken,
    address destToken,
    address receiver,
    address returnToSender,
    uint256 sourceTokenAmount,
    uint256 requiredDestTokenAmount,
    uint256 minReturn,
    bytes memory swapData
) public payable nonReentrant whenNotPaused returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceToken`|`address`|The address of the source token instance.|
|`destToken`|`address`|The address of the destiny token instance.|
|`receiver`|`address`|The address of the recipient account.|
|`returnToSender`|`address`|The address of the sender account.|
|`sourceTokenAmount`|`uint256`|The amount of source tokens.|
|`requiredDestTokenAmount`|`uint256`|The amount of required destiny tokens.|
|`minReturn`|`uint256`|Minimum amount (position size) in the collateral tokens.|
|`swapData`|`bytes`|Additional swap data (not in use yet).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`destTokenAmountReceived`|`uint256`|The amount of destiny tokens sent.|
|`sourceTokenAmountUsed`|`uint256`|The amount of source tokens spent.|


### getSwapExpectedReturn

Get the swap expected return value.

*Get payed value, be it rBTC or tokenized.*

*Update wrBTC balance for this contract.*

*Perform the swap w/ tokens.
user
minSourceTokenAmount
maxSourceTokenAmount
loanId (not tied to a specific loan)
bypassFee
user*

*External wrapper that calls SwapsUser::_swapsExpectedReturn*


```solidity
function getSwapExpectedReturn(address sourceToken, address destToken, uint256 sourceTokenAmount)
    external
    view
    returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceToken`|`address`|The address of the source token instance.|
|`destToken`|`address`|The address of the destiny token instance.|
|`sourceTokenAmount`|`uint256`|The amount of source tokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The expected return value.|


### checkPriceDivergence

Check the slippage based on the swapExpectedReturn.


```solidity
function checkPriceDivergence(address sourceToken, address destToken, uint256 sourceTokenAmount, uint256 minReturn)
    public
    view;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceToken`|`address`|The address of the source token instance.|
|`destToken`|`address`|The address of the destiny token instance.|
|`sourceTokenAmount`|`uint256`|The amount of source tokens.|
|`minReturn`|`uint256`|The amount (max slippage) that will be compared to the swapsExpectedReturn.|


