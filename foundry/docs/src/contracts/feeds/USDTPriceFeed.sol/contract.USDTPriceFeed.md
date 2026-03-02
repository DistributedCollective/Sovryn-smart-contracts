# USDTPriceFeed
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/feeds/USDTPriceFeed.sol)

**Inherits:**
[IPriceFeedsExt](/contracts/feeds/PriceFeeds.sol/interface.IPriceFeedsExt.md)

The Price Feed USDT contract.
This contract implements USDT query functionality,
getting the price and the last timestamp from a
trivial formula, always returning 1 and now.


## State Variables
### USDT_RATE

```solidity
uint256 private constant USDT_RATE = 1 ether;
```


## Functions
### latestAnswer

Get the USDT price.


```solidity
function latestAnswer() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Always returns the trivial rate of 1.|


### latestTimestamp

Get the las time the price was updated.


```solidity
function latestTimestamp() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Always trivial current block's timestamp.|


