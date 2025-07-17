# DummyFallbackOracle
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/feeds/DummyFallbackOracle.sol)

**Inherits:**
[IExternalPriceFeed](/contracts/feeds/DummyFallbackOracle.sol/interface.IExternalPriceFeed.md)

*Dummy Oracle contract that supports MoC medianizer interface (latestAnswer) which will always return (0, false) value*


## Functions
### constructor


```solidity
constructor() public;
```

### latestAnswer

*dummy function to support MoC medianizer*


```solidity
function latestAnswer() external view returns (uint256, bool);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|priceValue which is hardcoded to 0|
|`<none>`|`bool`|flag that indicate if the price is valid or not, hardcoded to false|


