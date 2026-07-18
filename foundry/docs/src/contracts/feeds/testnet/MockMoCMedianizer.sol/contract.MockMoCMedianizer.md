# MockMoCMedianizer
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/feeds/testnet/MockMoCMedianizer.sol)

Mock medianizer contract that will support for MoC medianizer interface to be used for testnet


## State Variables
### price

```solidity
uint256 public price;
```


## Functions
### constructor


```solidity
constructor(uint256 _price) public;
```

### setPrice

*set mock price*


```solidity
function setPrice(uint256 _price) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_price`|`uint256`|new price|


### peek

*returning fixed price of rbtc (e.g: 100k)*


```solidity
function peek() external view returns (bytes32 value, bool hasValue);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`value`|`bytes32`|value price of rbtc|
|`hasValue`|`bool`|flag that is indicating the price is working or not|


