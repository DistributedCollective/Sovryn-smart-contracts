# PriceFeedRSKOracle
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/feeds/PriceFeedRSKOracle.sol)

**Inherits:**
[IPriceFeedsExt](/contracts/feeds/PriceFeeds.sol/interface.IPriceFeedsExt.md), [Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

The Price Feed RSK Oracle contract.
This contract implements RSK Oracle query functionality,
getting the price and the last timestamp from an external oracle contract.


## State Variables
### rskOracleAddress

```solidity
address public rskOracleAddress;
```


## Functions
### constructor

Initialize a new RSK Oracle.


```solidity
constructor(address _rskOracleAddress) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_rskOracleAddress`|`address`|The RSK Oracle address.|


### latestAnswer

Get the oracle price.


```solidity
function latestAnswer() external view returns (uint256 _price);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_price`|`uint256`|The price from Oracle.|


### latestTimestamp

Get the las time oracle updated the price.


```solidity
function latestTimestamp() external view returns (uint256 _timestamp);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_timestamp`|`uint256`|The latest time.|


### setRSKOracleAddress

Set the RSK Oracle address.


```solidity
function setRSKOracleAddress(address _rskOracleAddress) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_rskOracleAddress`|`address`|The RSK Oracle address.|


## Events
### SetRSKOracleAddress

```solidity
event SetRSKOracleAddress(address indexed rskOracleAddress, address changerAddress);
```

