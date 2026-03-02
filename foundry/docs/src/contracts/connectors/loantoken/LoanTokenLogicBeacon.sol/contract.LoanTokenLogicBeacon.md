# LoanTokenLogicBeacon
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/LoanTokenLogicBeacon.sol)

**Inherits:**
[PausableRole](/contracts/utils/PausableRole.sol/contract.PausableRole.md)

This contract stored the target logic implementation of LoanTokens which has the same logic implementation (LoanTokenLogicLM / LoanTokenLogicWrbtc)
Apart from storing the target logic implementation, this contract also has a pause functionality.
By implementing pause/unpause functionality in this beacon contract, we can pause the loan token that has the same Logic (LoanTokenLogicLM / LoanTokenLogicWrbtc) at one call.
Meanwhile the pause/unpause function in the LoanTokenLogicProxy is used to pause/unpause specific LoanToken


## State Variables
### logicTargets

```solidity
mapping(bytes4 => address) private logicTargets;
```


### moduleUpgradeLog

```solidity
mapping(bytes32 => LoanTokenLogicModuleUpdate[]) public moduleUpgradeLog;
```


### activeModuleIndex
the module name as the key


```solidity
mapping(bytes32 => uint256) public activeModuleIndex;
```


### activeFuncSignatureList
To store the current active index log for module


```solidity
mapping(bytes32 => EnumerableBytes4Set.Bytes4Set) private activeFuncSignatureList;
```


## Functions
### whenNotPaused

Store the current active function signature

*Modifier to make a function callable only when the contract is not paused.
This is the overriden function from the pausable contract, so that we can use custom error message.*


```solidity
modifier whenNotPaused();
```

### registerLoanTokenModule

Register the loanTokenModule (LoanTokenSettingsLowerAdmin, LoanTokenLogicLM / LoanTokenLogicWrbtc, etc)

*This function will store the updated protocol module to the storage (For rollback purposes)*


```solidity
function registerLoanTokenModule(address loanTokenModuleAddress) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanTokenModuleAddress`|`address`|The module target address|


### _registerLoanTokenModule

Register the loanTokenModule (LoanTokenSettingsLowerAdmin, LoanTokenLogicLM / LoanTokenLogicWrbtc, etc)

*This registration will require target contract to have the exact function getListFunctionSignatures() which will return functionSignatureList and the moduleName in bytes32*


```solidity
function _registerLoanTokenModule(address loanTokenModuleAddress) private returns (bytes32);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanTokenModuleAddress`|`address`|the target logic of the loan token module|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes32`|the module name|


### getActiveFuncSignatureList

register / update the module function signature address implementation
delete the "removed" module function signature in the current implementation

*get all active function signature list based on the module name.*


```solidity
function getActiveFuncSignatureList(bytes32 moduleName) public view returns (bytes4[] memory signatureList);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`moduleName`|`bytes32`|in bytes32.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`signatureList`|`bytes4[]`|the array of function signature.|


### getModuleUpgradeLogLength

*Get total length of the module upgrade log.*


```solidity
function getModuleUpgradeLogLength(bytes32 moduleName) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`moduleName`|`bytes32`|in bytes32.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|length of module upgrade log.|


### rollback

This function will rollback particular module to the spesific index / version of deployment


```solidity
function rollback(bytes32 moduleName, uint256 index) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`moduleName`|`bytes32`|Name of module in bytes32 format|
|`index`|`uint256`|index / version of previous deployment|


### getTarget

External getter for target addresses.


```solidity
function getTarget(bytes4 sig) external view whenNotPaused returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sig`|`bytes4`|The signature.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The address for a given signature.|


## Structs
### LoanTokenLogicModuleUpdate

```solidity
struct LoanTokenLogicModuleUpdate {
    address implementation;
    uint256 updateTimestamp;
}
```

