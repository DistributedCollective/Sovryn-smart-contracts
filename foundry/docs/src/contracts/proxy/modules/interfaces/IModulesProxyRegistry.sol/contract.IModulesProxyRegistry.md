# IModulesProxyRegistry
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/proxy/modules/interfaces/IModulesProxyRegistry.sol)

ModulesProxyRegistry Interface


## Functions
### addModule

Add module functions.
Overriding functions is not allowed. To replace modules use ReplaceModule function.


```solidity
function addModule(address _impl) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_impl`|`address`|Module implementation address|


### addModules

Add modules functions.


```solidity
function addModules(address[] calldata _implementations) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_implementations`|`address[]`|Modules implementation addresses|


### replaceModule

Replace module - remove the previous, add the new one


```solidity
function replaceModule(address _oldModuleImpl, address _newModuleImpl) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_oldModuleImpl`|`address`|Module implementation address to remove|
|`_newModuleImpl`|`address`|Module implementation address to add|


### replaceModules

Add modules functions.


```solidity
function replaceModules(address[] calldata _implementationsFrom, address[] calldata _implementationsTo) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_implementationsFrom`|`address[]`|Modules to replace|
|`_implementationsTo`|`address[]`|Replacing modules|


### removeModule

to disable module - set all its functions implementation to address(0)


```solidity
function removeModule(address _impl) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_impl`|`address`|implementation address|


### removeModules

Add modules functions.


```solidity
function removeModules(address[] calldata _implementations) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_implementations`|`address[]`|Modules implementation addresses|


### getFuncImplementation


```solidity
function getFuncImplementation(bytes4 _sig) external view returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_sig`|`bytes4`|function signature to get impmementation address for|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|function's contract implelementation address|


### canAddModule

verifies if no functions from the module deployed already registered


```solidity
function canAddModule(address _impl) external view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_impl`|`address`|module implementation address to verify|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|true if module can be added|


### canNotAddModules

Multiple modules verification if no functions from the modules already registered


```solidity
function canNotAddModules(address[] calldata _implementations) external view returns (address[] memory modules);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_implementations`|`address[]`|modules implementation addresses to verify|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`modules`|`address[]`|True if all modules can be added, false otherwise|


### checkClashingFuncSelectors

used externally to verify module being added for clashing


```solidity
function checkClashingFuncSelectors(address _newModule)
    external
    view
    returns (
        address[] memory clashingModules,
        bytes4[] memory clashingModulesFuncSelectors,
        bytes4[] memory clashingProxyRegistryFuncSelectors
    );
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newModule`|`address`|module implementation which functions to verify|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`clashingModules`|`address[]`|clashing functions signatures and corresponding modules (contracts) addresses|
|`clashingModulesFuncSelectors`|`bytes4[]`||
|`clashingProxyRegistryFuncSelectors`|`bytes4[]`||


## Events
### AddModule

```solidity
event AddModule(address indexed moduleAddress);
```

### ReplaceModule

```solidity
event ReplaceModule(address indexed oldAddress, address indexed newAddress);
```

### RemoveModule

```solidity
event RemoveModule(address indexed moduleAddress);
```

### SetModuleFuncImplementation

```solidity
event SetModuleFuncImplementation(
    bytes4 indexed _funcSig, address indexed _oldImplementation, address indexed _newImplementation
);
```

