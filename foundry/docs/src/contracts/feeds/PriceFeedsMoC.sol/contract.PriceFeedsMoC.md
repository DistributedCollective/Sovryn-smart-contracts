# PriceFeedsMoC
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/feeds/PriceFeedsMoC.sol)

**Inherits:**
[IPriceFeedsExt](/contracts/feeds/PriceFeeds.sol/interface.IPriceFeedsExt.md), [Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)


## State Variables
### mocOracleAddress

```solidity
address public mocOracleAddress;
```


### fallbackOracleAddress

```solidity
address public fallbackOracleAddress;
```


## Functions
### constructor

Initialize a new MoC Oracle.


```solidity
constructor(address _mocOracleAddress, address _fallbackOracleAddress) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_mocOracleAddress`|`address`|The MoC Oracle address.|
|`_fallbackOracleAddress`|`address`|The fallback Oracle address.|


### latestAnswer

Get the las time oracle updated the price.


```solidity
function latestAnswer() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The latest time.|


### setMoCOracleAddress

Set the MoC Oracle address.


```solidity
function setMoCOracleAddress(address _mocOracleAddress) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_mocOracleAddress`|`address`|The MoC Oracle address.|


### setFallbackOracleAddress

Set the fallback Oracle address.


```solidity
function setFallbackOracleAddress(address _fallbackOracleAddress) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_fallbackOracleAddress`|`address`|The fallback Oracle address.|


## Events
### SetMoCOracleAddress

```solidity
event SetMoCOracleAddress(address indexed mocOracleAddress, address changerAddress);
```

### SetFallbackOracleAddress

```solidity
event SetFallbackOracleAddress(address indexed fallbackOracleAddress, address changerAddress);
```

