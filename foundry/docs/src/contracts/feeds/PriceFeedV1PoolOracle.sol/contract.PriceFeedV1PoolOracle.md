# PriceFeedV1PoolOracle
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/feeds/PriceFeedV1PoolOracle.sol)

**Inherits:**
[IPriceFeedsExt](/contracts/feeds/PriceFeeds.sol/interface.IPriceFeedsExt.md), [Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

The Price Feed V1 Pool Oracle contract.
This contract implements V1 Pool Oracle query functionality,
getting the price from v1 pool oracle.


## State Variables
### v1PoolOracleAddress

```solidity
address public v1PoolOracleAddress;
```


### wRBTCAddress

```solidity
address public wRBTCAddress;
```


### docAddress

```solidity
address public docAddress;
```


### baseCurrency

```solidity
address public baseCurrency;
```


## Functions
### constructor

Initialize a new V1 Pool Oracle.


```solidity
constructor(address _v1PoolOracleAddress, address _wRBTCAddress, address _docAddress, address _baseCurrency) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_v1PoolOracleAddress`|`address`|The V1 Pool Oracle address.|
|`_wRBTCAddress`|`address`|The wrbtc token address.|
|`_docAddress`|`address`|The doc token address.|
|`_baseCurrency`|`address`||


### latestAnswer

Get the oracle price.


```solidity
function latestAnswer() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The price from Oracle.|


### _convertAnswerToUsd


```solidity
function _convertAnswerToUsd(uint256 _valueInBTC) private view returns (uint256);
```

### setV1PoolOracleAddress

Need to multiply by query precision (doc's precision) and divide by 1*10^18 (Because the based price in v1 pool is using 18 decimals)

Set the V1 Pool Oracle address.


```solidity
function setV1PoolOracleAddress(address _v1PoolOracleAddress) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_v1PoolOracleAddress`|`address`|The V1 Pool Oracle address.|


### setRBTCAddress

Set the rBtc address. V1 pool based price is BTC, so need to convert the value from v1 pool to USD. That's why we need to get the price of the rBtc


```solidity
function setRBTCAddress(address _wRBTCAddress) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_wRBTCAddress`|`address`|The rBTC address|


### setDOCAddress

Set the DoC address. V1 pool based price is BTC, so need to convert the value from v1 pool to USD. That's why we need to get the price of the DoC


```solidity
function setDOCAddress(address _docAddress) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_docAddress`|`address`|The DoC address|


### setBaseCurrency

Set the base currency address. That's the reserve address which is not WRBTC


```solidity
function setBaseCurrency(address _baseCurrency) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_baseCurrency`|`address`|The base currency address|


## Events
### SetV1PoolOracleAddress

```solidity
event SetV1PoolOracleAddress(address indexed v1PoolOracleAddress, address changerAddress);
```

### SetWRBTCAddress

```solidity
event SetWRBTCAddress(address indexed wRBTCAddress, address changerAddress);
```

### SetDOCAddress

```solidity
event SetDOCAddress(address indexed docAddress, address changerAddress);
```

### SetBaseCurrency

```solidity
event SetBaseCurrency(address indexed baseCurrency, address changerAddress);
```

