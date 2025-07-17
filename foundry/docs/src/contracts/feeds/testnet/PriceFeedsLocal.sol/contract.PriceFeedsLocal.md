# PriceFeedsLocal
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/feeds/testnet/PriceFeedsLocal.sol)

**Inherits:**
[PriceFeeds](/contracts/feeds/PriceFeeds.sol/contract.PriceFeeds.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains the logic of setting and getting rates between two tokens.


## State Variables
### rates

```solidity
mapping(address => mapping(address => uint256)) public rates;
```


## Functions
### constructor

uint256 public slippageMultiplier = 100 ether;

Deploy local price feed contract.


```solidity
constructor(address _wrbtcTokenAddress, address _protocolTokenAddress)
    public
    PriceFeeds(_wrbtcTokenAddress, _protocolTokenAddress, _wrbtcTokenAddress);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_wrbtcTokenAddress`|`address`|The address of the wrBTC instance.|
|`_protocolTokenAddress`|`address`|The address of the protocol token instance.|


### _queryRate

Calculate the price ratio between two tokens.


```solidity
function _queryRate(address sourceToken, address destToken) internal view returns (uint256 rate, uint256 precision);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceToken`|`address`|The address of the source tokens.|
|`destToken`|`address`|The address of the destiny tokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`rate`|`uint256`|The price ratio source/dest.|
|`precision`|`uint256`|The ratio precision.|


### setRates

Hack for testnet; only returns price in rBTC.
Hack for testnet; only returns price in rBTC.

Owner set price ratio between two tokens.


```solidity
function setRates(address sourceToken, address destToken, uint256 rate) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceToken`|`address`|The address of the source tokens.|
|`destToken`|`address`|The address of the destiny tokens.|
|`rate`|`uint256`|The price ratio source/dest.|


