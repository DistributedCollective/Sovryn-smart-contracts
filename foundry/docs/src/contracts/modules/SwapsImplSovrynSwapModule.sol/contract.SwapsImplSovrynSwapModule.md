# SwapsImplSovrynSwapModule
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/modules/SwapsImplSovrynSwapModule.sol)

**Inherits:**
[State](/contracts/core/State.sol/contract.State.md), [ModulesCommonEvents](/contracts/events/ModulesCommonEvents.sol/contract.ModulesCommonEvents.md)


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


### getContractHexName

Get the hex name of a contract.


```solidity
function getContractHexName(string memory source) public pure returns (bytes32 result);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`source`|`string`|The name of the contract.|


### getSovrynSwapNetworkContract

Look up the Sovryn swap network contract registered at the given address.


```solidity
function getSovrynSwapNetworkContract(address sovrynSwapRegistryAddress) public view returns (ISovrynSwapNetwork);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sovrynSwapRegistryAddress`|`address`|The address of the registry.|


### swapsImplExpectedRate

Get the expected rate for 1 source token when exchanging the
given amount of source tokens.


```solidity
function swapsImplExpectedRate(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount)
    external
    view
    returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceTokenAddress`|`address`|The address of the source token contract.|
|`destTokenAddress`|`address`|The address of the destination token contract.|
|`sourceTokenAmount`|`uint256`|The amount of source tokens to get the rate for.|


### swapsImplExpectedReturn

Get the expected return amount when exchanging the given
amount of source tokens.

Right now, this function is being called directly by _swapsExpectedReturn from the protocol
So, this function is not using _getConversionPath function since it will try to read the defaultPath storage which is stored in the protocol's slot, and it will cause an issue for direct call.
Instead, this function is accepting additional parameters called defaultPath which value can be declared by the caller (protocol in this case).


```solidity
function swapsImplExpectedReturn(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount)
    external
    view
    returns (uint256 expectedReturn);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceTokenAddress`|`address`|The address of the source token contract.|
|`destTokenAddress`|`address`|The address of the destination token contract.|
|`sourceTokenAmount`|`uint256`|The amount of source tokens to get the return for.|


