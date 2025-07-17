# BProPriceFeed
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/feeds/BProPriceFeed.sol)

**Inherits:**
[IPriceFeedsExt](/contracts/feeds/PriceFeeds.sol/interface.IPriceFeedsExt.md), [Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)


## State Variables
### mocStateAddress

```solidity
address public mocStateAddress;
```


## Functions
### constructor

Initializes a new MoC state.


```solidity
constructor(address _mocStateAddress) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_mocStateAddress`|`address`|MoC state address|


### latestAnswer

Get BPro USD price.


```solidity
function latestAnswer() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|the BPro USD Price [using mocPrecision]|


### latestTimestamp

Supposed to get the MoC update time, but instead
get the current timestamp.


```solidity
function latestTimestamp() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Always returns current block's timestamp.|


### setMoCStateAddress

MoC state doesn't return update timestamp.

Set MoC state address.


```solidity
function setMoCStateAddress(address _mocStateAddress) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_mocStateAddress`|`address`|The MoC state address.|


## Events
### SetMoCStateAddress

```solidity
event SetMoCStateAddress(address indexed mocStateAddress, address changerAddress);
```

