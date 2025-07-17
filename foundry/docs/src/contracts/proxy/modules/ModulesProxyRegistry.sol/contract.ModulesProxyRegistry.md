# ModulesProxyRegistry
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/proxy/modules/ModulesProxyRegistry.sol)

**Inherits:**
[IModulesProxyRegistry](/contracts/proxy/modules/interfaces/IModulesProxyRegistry.sol/contract.IModulesProxyRegistry.md), [ProxyOwnable](/contracts/utils/ProxyOwnable.sol/contract.ProxyOwnable.md)

ModulesProxyRegistry provides modules registration/removing/replacing functionality to ModulesProxy
Designed to be inherited


## State Variables
### KEY_IMPLEMENTATION

```solidity
bytes32 internal constant KEY_IMPLEMENTATION = keccak256("key.implementation");
```


## Functions
### constructor

Constructor is internal to make contract abstract


```solidity
constructor() internal;
```

### addModule

Add module functions.
Overriding functions is not allowed. To replace modules use replaceModule function.


```solidity
function addModule(address _impl) external onlyProxyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_impl`|`address`|Module implementation address|


### addModules

Add modules functions.


```solidity
function addModules(address[] calldata _implementations) external onlyProxyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_implementations`|`address[]`|Modules implementation addresses|


### replaceModule

Replace module - remove the previous, add the new one


```solidity
function replaceModule(address _oldModuleImpl, address _newModuleImpl) external onlyProxyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_oldModuleImpl`|`address`|Module implementation address to remove|
|`_newModuleImpl`|`address`|Module implementation address to add|


### replaceModules

Add modules functions.


```solidity
function replaceModules(address[] calldata _implementationsFrom, address[] calldata _implementationsTo)
    external
    onlyProxyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_implementationsFrom`|`address[]`|Modules to replace|
|`_implementationsTo`|`address[]`|Replacing modules|


### removeModule

To disable module - set all its functions implementation to address(0)


```solidity
function removeModule(address _impl) external onlyProxyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_impl`|`address`|implementation address|


### removeModules

Add modules functions.


```solidity
function removeModules(address[] calldata _implementations) external onlyProxyOwner;
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
|`_sig`|`bytes4`|Function signature to get impmementation address for|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|Function's contract implelementation address|


### canAddModule

Verifies if no functions from the module already registered


```solidity
function canAddModule(address _impl) external view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_impl`|`address`|Module implementation address to verify|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|True if module can be added|


### canNotAddModules

Multiple modules verification if there are functions from the modules already registered


```solidity
function canNotAddModules(address[] memory _implementations) public view returns (address[] memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_implementations`|`address[]`|modules implementation addresses to verify|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address[]`|addresses of registered modules|


### checkClashingFuncSelectors

Used externally to verify module being added for clashing


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
|`clashingModules`|`address[]`|Clashing functions signatures and corresponding modules (contracts) addresses|
|`clashingModulesFuncSelectors`|`bytes4[]`||
|`clashingProxyRegistryFuncSelectors`|`bytes4[]`||


### isModuleRegistered

Verifies the deployed contract address is a registered module contract


```solidity
function isModuleRegistered(address _impl) external view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_impl`|`address`|deployment address to verify|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|true if _impl address is a registered module|


### _getFirstRegisteredModuleAddress

INTERNAL FUNCTIONS *****************


```solidity
function _getFirstRegisteredModuleAddress(address _impl) internal view returns (address);
```

### _getFuncImplementation


```solidity
function _getFuncImplementation(bytes4 _sig) internal view returns (address);
```

### _addModule


```solidity
function _addModule(address _impl) internal;
```

### _addModules


```solidity
function _addModules(address[] memory _implementations) internal;
```

### _removeModule


```solidity
function _removeModule(address _impl) internal onlyProxyOwner;
```

### _removeModules


```solidity
function _removeModules(address[] memory _implementations) internal;
```

### _replaceModule


```solidity
function _replaceModule(address _oldModuleImpl, address _newModuleImpl) internal;
```

### _setModuleFuncImplementation


```solidity
function _setModuleFuncImplementation(bytes4 _sig, address _impl) internal;
```

### _isFuncClashingWithProxyFunctions


```solidity
function _isFuncClashingWithProxyFunctions(bytes4 _sig) internal pure returns (bool);
```

### _canAddModule


```solidity
function _canAddModule(address _impl) internal view returns (bool);
```

### _getFunctionsList


```solidity
function _getFunctionsList() internal pure returns (bytes4[] memory);
```

