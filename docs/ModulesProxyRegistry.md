# ModulesProxyRegistry.sol

View Source: [contracts/proxy/modules/ModulesProxyRegistry.sol](../contracts/proxy/modules/ModulesProxyRegistry.sol)

**↗ Extends: [IModulesProxyRegistry](IModulesProxyRegistry.md), [ProxyOwnable](ProxyOwnable.md)**
**↘ Derived Contracts: [ModulesProxy](ModulesProxy.md)**

**ModulesProxyRegistry**

## Contract Members
**Constants & Variables**

```js
bytes32 internal constant KEY_IMPLEMENTATION;

```

## Functions

- [constructor()](#constructor)
- [addModule(address _impl)](#addmodule)
- [addModules(address[] _implementations)](#addmodules)
- [replaceModule(address _oldModuleImpl, address _newModuleImpl)](#replacemodule)
- [replaceModules(address[] _implementationsFrom, address[] _implementationsTo)](#replacemodules)
- [removeModule(address _impl)](#removemodule)
- [removeModules(address[] _implementations)](#removemodules)
- [getFuncImplementation(bytes4 _sig)](#getfuncimplementation)
- [canAddModule(address _impl)](#canaddmodule)
- [canNotAddModules(address[] _implementations)](#cannotaddmodules)
- [checkClashingFuncSelectors(address _newModule)](#checkclashingfuncselectors)
- [isModuleRegistered(address _impl)](#ismoduleregistered)
- [_getFirstRegisteredModuleAddress(address _impl)](#_getfirstregisteredmoduleaddress)
- [_getFuncImplementation(bytes4 _sig)](#_getfuncimplementation)
- [_addModule(address _impl)](#_addmodule)
- [_addModules(address[] _implementations)](#_addmodules)
- [_removeModule(address _impl)](#_removemodule)
- [_removeModules(address[] _implementations)](#_removemodules)
- [_replaceModule(address _oldModuleImpl, address _newModuleImpl)](#_replacemodule)
- [_setModuleFuncImplementation(bytes4 _sig, address _impl)](#_setmodulefuncimplementation)
- [_isFuncClashingWithProxyFunctions(bytes4 _sig)](#_isfuncclashingwithproxyfunctions)
- [_canAddModule(address _impl)](#_canaddmodule)
- [_getFunctionsList()](#_getfunctionslist)

---    

> ### constructor

Constructor is internal to make contract abstract

```solidity
function () internal nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor() internal {
        // abstract
    }
```
</details>

---    

> ### addModule

⤾ overrides [IModulesProxyRegistry.addModule](IModulesProxyRegistry.md#addmodule)

Add module functions.
 Overriding functions is not allowed. To replace modules use replaceModule function.

```solidity
function addModule(address _impl) external nonpayable onlyProxyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _impl | address | Module implementation address | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addModule(address _impl) external onlyProxyOwner {
        _addModule(_impl);
    }
```
</details>

---    

> ### addModules

⤾ overrides [IModulesProxyRegistry.addModules](IModulesProxyRegistry.md#addmodules)

Add modules functions.

```solidity
function addModules(address[] _implementations) external nonpayable onlyProxyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _implementations | address[] | Modules implementation addresses | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addModules(address[] calldata _implementations) external onlyProxyOwner {
        _addModules(_implementations);
    }
```
</details>

---    

> ### replaceModule

⤾ overrides [IModulesProxyRegistry.replaceModule](IModulesProxyRegistry.md#replacemodule)

Replace module - remove the previous, add the new one

```solidity
function replaceModule(address _oldModuleImpl, address _newModuleImpl) external nonpayable onlyProxyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _oldModuleImpl | address | Module implementation address to remove | 
| _newModuleImpl | address | Module implementation address to add | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function replaceModule(address _oldModuleImpl, address _newModuleImpl)
        external
        onlyProxyOwner
    {
        _replaceModule(_oldModuleImpl, _newModuleImpl);
    }
```
</details>

---    

> ### replaceModules

⤾ overrides [IModulesProxyRegistry.replaceModules](IModulesProxyRegistry.md#replacemodules)

Add modules functions.

```solidity
function replaceModules(address[] _implementationsFrom, address[] _implementationsTo) external nonpayable onlyProxyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _implementationsFrom | address[] | Modules to replace | 
| _implementationsTo | address[] | Replacing modules | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function replaceModules(
        address[] calldata _implementationsFrom,
        address[] calldata _implementationsTo
    ) external onlyProxyOwner {
        require(
            _implementationsFrom.length == _implementationsTo.length,
            "ModulesProxyRegistry::replaceModules: arrays sizes must be equal"
        ); //MR10

        // because the order of addresses is arbitrary, all modules are removed first to avoid collisions
        _removeModules(_implementationsFrom);
        _addModules(_implementationsTo);
    }
```
</details>

---    

> ### removeModule

⤾ overrides [IModulesProxyRegistry.removeModule](IModulesProxyRegistry.md#removemodule)

To disable module - set all its functions implementation to address(0)

```solidity
function removeModule(address _impl) external nonpayable onlyProxyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _impl | address | implementation address | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeModule(address _impl) external onlyProxyOwner {
        _removeModule(_impl);
    }
```
</details>

---    

> ### removeModules

⤾ overrides [IModulesProxyRegistry.removeModules](IModulesProxyRegistry.md#removemodules)

Add modules functions.

```solidity
function removeModules(address[] _implementations) external nonpayable onlyProxyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _implementations | address[] | Modules implementation addresses | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeModules(address[] calldata _implementations) external onlyProxyOwner {
        _removeModules(_implementations);
    }
```
</details>

---    

> ### getFuncImplementation

⤾ overrides [IModulesProxyRegistry.getFuncImplementation](IModulesProxyRegistry.md#getfuncimplementation)

```solidity
function getFuncImplementation(bytes4 _sig) external view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sig | bytes4 | Function signature to get impmementation address for | 

**Returns**

Function's contract implelementation address

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getFuncImplementation(bytes4 _sig) external view returns (address) {
        return _getFuncImplementation(_sig);
    }
```
</details>

---    

> ### canAddModule

⤾ overrides [IModulesProxyRegistry.canAddModule](IModulesProxyRegistry.md#canaddmodule)

Verifies if no functions from the module already registered

```solidity
function canAddModule(address _impl) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _impl | address | Module implementation address to verify | 

**Returns**

True if module can be added

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function canAddModule(address _impl) external view returns (bool) {
        return _canAddModule(_impl);
    }
```
</details>

---    

> ### canNotAddModules

⤾ overrides [IModulesProxyRegistry.canNotAddModules](IModulesProxyRegistry.md#cannotaddmodules)

Multiple modules verification if there are functions from the modules already registered

```solidity
function canNotAddModules(address[] _implementations) public view
returns(address[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _implementations | address[] | modules implementation addresses to verify | 

**Returns**

addresses of registered modules

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function canNotAddModules(address[] memory _implementations)
        public
        view
        returns (address[] memory)
    {
        for (uint256 i = 0; i < _implementations.length; i++) {
            if (_canAddModule(_implementations[i])) {
                delete _implementations[i];
            }
        }
        return _implementations;
    }
```
</details>

---    

> ### checkClashingFuncSelectors

⤾ overrides [IModulesProxyRegistry.checkClashingFuncSelectors](IModulesProxyRegistry.md#checkclashingfuncselectors)

Used externally to verify module being added for clashing

```solidity
function checkClashingFuncSelectors(address _newModule) external view
returns(clashingModules address[], clashingModulesFuncSelectors bytes4[], clashingProxyRegistryFuncSelectors bytes4[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newModule | address | module implementation which functions to verify | 

**Returns**

Clashing functions signatures and corresponding modules (contracts) addresses

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function checkClashingFuncSelectors(address _newModule)
        external
        view
        returns (
            address[] memory clashingModules,
            bytes4[] memory clashingModulesFuncSelectors,
            bytes4[] memory clashingProxyRegistryFuncSelectors
        )
    {
        require(
            _newModule.isContract(),
            "ModulesProxyRegistry::checkClashingFuncSelectors: address is not a contract"
        ); //MR06
        bytes4[] memory newModuleFunctions = IFunctionsList(_newModule).getFunctionsList();
        bytes4[] memory proxyRegistryFunctions = _getFunctionsList(); //registry functions list
        uint256 clashingProxyRegistryFuncsSize;
        uint256 clashingArraySize;
        uint256 clashingArrayIndex;
        uint256 clashingRegistryArrayIndex;

        for (uint256 i = 0; i < newModuleFunctions.length; i++) {
            address funcImpl = _getFuncImplementation(newModuleFunctions[i]);
            if (funcImpl != address(0) && funcImpl != _newModule) {
                clashingArraySize++;
            } else if (_isFuncClashingWithProxyFunctions(newModuleFunctions[i]))
                clashingProxyRegistryFuncsSize++;
        }
        clashingModules = new address[](clashingArraySize);
        clashingModulesFuncSelectors = new bytes4[](clashingArraySize);
        clashingProxyRegistryFuncSelectors = new bytes4[](clashingProxyRegistryFuncsSize);

        if (clashingArraySize == 0 && clashingProxyRegistryFuncsSize == 0)
            //return empty arrays
            return (
                clashingModules,
                clashingModulesFuncSelectors,
                clashingProxyRegistryFuncSelectors
            );
        for (uint256 i = 0; i < newModuleFunctions.length; i++) {
            address funcImpl = _getFuncImplementation(newModuleFunctions[i]);
            if (funcImpl != address(0)) {
                clashingModules[clashingArrayIndex] = funcImpl;
                clashingModulesFuncSelectors[clashingArrayIndex] = newModuleFunctions[i];
                clashingArrayIndex++;
            }
            for (uint256 j = 0; j < proxyRegistryFunctions.length; j++) {
                //ModulesProxyRegistry has a clashing function selector
                if (proxyRegistryFunctions[j] == newModuleFunctions[i]) {
                    clashingProxyRegistryFuncSelectors[
                        clashingRegistryArrayIndex
                    ] = proxyRegistryFunctions[j];
                    clashingRegistryArrayIndex++;
                }
            }
        }
    }
```
</details>

---    

> ### isModuleRegistered

```solidity
function isModuleRegistered(address _impl) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _impl | address | deployment address to verify | 

**Returns**

true if _impl address is a registered module

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function isModuleRegistered(address _impl) external view returns (bool) {
        return _getFirstRegisteredModuleAddress(_impl) == _impl;
    }
```
</details>

---    

> ### _getFirstRegisteredModuleAddress

```solidity
function _getFirstRegisteredModuleAddress(address _impl) internal view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _impl | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getFirstRegisteredModuleAddress(address _impl) internal view returns (address) {
        require(
            _impl.isContract(),
            "ModulesProxyRegistry::_getRegisteredModuleAddress: address is not a contract"
        );
        bytes4[] memory functions = IFunctionsList(_impl).getFunctionsList();
        for (uint256 i = 0; i < functions.length; i++) {
            address _moduleImpl = _getFuncImplementation(functions[i]);
            if (_moduleImpl != address(0)) {
                return (_moduleImpl);
            }
        }
        return address(0);
    }
```
</details>

---    

> ### _getFuncImplementation

```solidity
function _getFuncImplementation(bytes4 _sig) internal view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sig | bytes4 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getFuncImplementation(bytes4 _sig) internal view returns (address) {
        //TODO: add querying Registry for logic address and then delegate call to it OR use proxy memory slots like this:
        bytes32 key = keccak256(abi.encode(_sig, KEY_IMPLEMENTATION));
        address implementation;
        assembly {
            implementation := sload(key)
        }
        return implementation;
    }
```
</details>

---    

> ### _addModule

```solidity
function _addModule(address _impl) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _impl | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _addModule(address _impl) internal {
        require(_impl.isContract(), "ModulesProxyRegistry::_addModule: address is not a contract"); //MR01
        bytes4[] memory functions = IFunctionsList(_impl).getFunctionsList();
        for (uint256 i = 0; i < functions.length; i++) {
            require(
                _getFuncImplementation(functions[i]) == address(0),
                "ModulesProxyRegistry::_addModule: function already registered - use replaceModule function"
            ); //MR02
            require(functions[i] != bytes4(0), "does not allow empty function id"); // MR03
            require(
                !_isFuncClashingWithProxyFunctions(functions[i]),
                "ModulesProxyRegistry::_addModule: has a function with the same signature"
            ); //MR09
            _setModuleFuncImplementation(functions[i], _impl);
        }
        emit AddModule(_impl);
    }
```
</details>

---    

> ### _addModules

```solidity
function _addModules(address[] _implementations) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _implementations | address[] |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _addModules(address[] memory _implementations) internal {
        for (uint256 i = 0; i < _implementations.length; i++) {
            _addModule(_implementations[i]);
        }
    }
```
</details>

---    

> ### _removeModule

```solidity
function _removeModule(address _impl) internal nonpayable onlyProxyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _impl | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _removeModule(address _impl) internal onlyProxyOwner {
        require(
            _impl.isContract(),
            "ModulesProxyRegistry::_removeModule: address is not a contract"
        ); //MR07
        bytes4[] memory functions = IFunctionsList(_impl).getFunctionsList();
        for (uint256 i = 0; i < functions.length; i++)
            _setModuleFuncImplementation(functions[i], address(0));

        emit RemoveModule(_impl);
    }
```
</details>

---    

> ### _removeModules

```solidity
function _removeModules(address[] _implementations) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _implementations | address[] |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _removeModules(address[] memory _implementations) internal {
        for (uint256 i = 0; i < _implementations.length; i++) {
            _removeModule(_implementations[i]);
        }
    }
```
</details>

---    

> ### _replaceModule

```solidity
function _replaceModule(address _oldModuleImpl, address _newModuleImpl) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _oldModuleImpl | address |  | 
| _newModuleImpl | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _replaceModule(address _oldModuleImpl, address _newModuleImpl) internal {
        if (_oldModuleImpl != _newModuleImpl) {
            require(
                _newModuleImpl.isContract(),
                "ModulesProxyRegistry::_replaceModule - _newModuleImpl is not a contract"
            ); //MR03
            require(
                _oldModuleImpl.isContract(),
                "ModulesProxyRegistry::_replaceModule - _oldModuleImpl is not a contract"
            ); //MR04
            _removeModule(_oldModuleImpl);
            _addModule(_newModuleImpl);

            emit ReplaceModule(_oldModuleImpl, _newModuleImpl);
        }
    }
```
</details>

---    

> ### _setModuleFuncImplementation

```solidity
function _setModuleFuncImplementation(bytes4 _sig, address _impl) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sig | bytes4 |  | 
| _impl | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _setModuleFuncImplementation(bytes4 _sig, address _impl) internal {
        emit SetModuleFuncImplementation(_sig, _getFuncImplementation(_sig), _impl);

        bytes32 key = keccak256(abi.encode(_sig, KEY_IMPLEMENTATION));
        assembly {
            sstore(key, _impl)
        }
    }
```
</details>

---    

> ### _isFuncClashingWithProxyFunctions

```solidity
function _isFuncClashingWithProxyFunctions(bytes4 _sig) internal pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sig | bytes4 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _isFuncClashingWithProxyFunctions(bytes4 _sig) internal pure returns (bool) {
        bytes4[] memory functionList = _getFunctionsList();
        for (uint256 i = 0; i < functionList.length; i++) {
            if (_sig == functionList[i])
                //ModulesProxyRegistry has function with the same id
                return true;
        }
        return false;
    }
```
</details>

---    

> ### _canAddModule

```solidity
function _canAddModule(address _impl) internal view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _impl | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _canAddModule(address _impl) internal view returns (bool) {
        require(
            _impl.isContract(),
            "ModulesProxyRegistry::_canAddModule: address is not a contract"
        ); //MR06
        bytes4[] memory functions = IFunctionsList(_impl).getFunctionsList();
        for (uint256 i = 0; i < functions.length; i++)
            if (_getFuncImplementation(functions[i]) != address(0)) return (false);
        return true;
    }
```
</details>

---    

> ### _getFunctionsList

```solidity
function _getFunctionsList() internal pure
returns(bytes4[])
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getFunctionsList() internal pure returns (bytes4[] memory) {
        bytes4[] memory functionList = new bytes4[](13);
        functionList[0] = this.getFuncImplementation.selector;
        functionList[1] = this.addModule.selector;
        functionList[2] = this.addModules.selector;
        functionList[3] = this.removeModule.selector;
        functionList[4] = this.removeModules.selector;
        functionList[5] = this.replaceModule.selector;
        functionList[6] = this.replaceModules.selector;
        functionList[7] = this.canAddModule.selector;
        functionList[8] = this.canNotAddModules.selector;
        functionList[9] = this.setProxyOwner.selector;
        functionList[10] = this.getProxyOwner.selector;
        functionList[11] = this.checkClashingFuncSelectors.selector;
        functionList[12] = this.isModuleRegistered.selector;
        return functionList;
    }
```
</details>

## Contracts

* [Address](Address.md)
* [Administered](Administered.md)
* [AdminRole](AdminRole.md)
* [AdvancedToken](AdvancedToken.md)
* [AdvancedTokenStorage](AdvancedTokenStorage.md)
* [Affiliates](Affiliates.md)
* [AffiliatesEvents](AffiliatesEvents.md)
* [ApprovalReceiver](ApprovalReceiver.md)
* [BProPriceFeed](BProPriceFeed.md)
* [CheckpointsShared](CheckpointsShared.md)
* [Constants](Constants.md)
* [Context](Context.md)
* [DevelopmentFund](DevelopmentFund.md)
* [DummyContract](DummyContract.md)
* [ECDSA](ECDSA.md)
* [EnumerableAddressSet](EnumerableAddressSet.md)
* [EnumerableBytes32Set](EnumerableBytes32Set.md)
* [EnumerableBytes4Set](EnumerableBytes4Set.md)
* [ERC20](ERC20.md)
* [ERC20Detailed](ERC20Detailed.md)
* [ErrorDecoder](ErrorDecoder.md)
* [Escrow](Escrow.md)
* [EscrowReward](EscrowReward.md)
* [FeedsLike](FeedsLike.md)
* [FeesEvents](FeesEvents.md)
* [FeeSharingCollector](FeeSharingCollector.md)
* [FeeSharingCollectorProxy](FeeSharingCollectorProxy.md)
* [FeeSharingCollectorStorage](FeeSharingCollectorStorage.md)
* [FeesHelper](FeesHelper.md)
* [FourYearVesting](FourYearVesting.md)
* [FourYearVestingFactory](FourYearVestingFactory.md)
* [FourYearVestingLogic](FourYearVestingLogic.md)
* [FourYearVestingStorage](FourYearVestingStorage.md)
* [GenericTokenSender](GenericTokenSender.md)
* [GovernorAlpha](GovernorAlpha.md)
* [GovernorVault](GovernorVault.md)
* [IApproveAndCall](IApproveAndCall.md)
* [IChai](IChai.md)
* [IContractRegistry](IContractRegistry.md)
* [IConverterAMM](IConverterAMM.md)
* [IERC1820Registry](IERC1820Registry.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IERC777](IERC777.md)
* [IERC777Recipient](IERC777Recipient.md)
* [IERC777Sender](IERC777Sender.md)
* [IFeeSharingCollector](IFeeSharingCollector.md)
* [IFourYearVesting](IFourYearVesting.md)
* [IFourYearVestingFactory](IFourYearVestingFactory.md)
* [IFunctionsList](IFunctionsList.md)
* [ILiquidityMining](ILiquidityMining.md)
* [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
* [ILoanPool](ILoanPool.md)
* [ILoanToken](ILoanToken.md)
* [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
* [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
* [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
* [ILoanTokenModules](ILoanTokenModules.md)
* [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
* [ILockedSOV](ILockedSOV.md)
* [IMoCState](IMoCState.md)
* [IModulesProxyRegistry](IModulesProxyRegistry.md)
* [Initializable](Initializable.md)
* [InterestUser](InterestUser.md)
* [IPot](IPot.md)
* [IPriceFeeds](IPriceFeeds.md)
* [IPriceFeedsExt](IPriceFeedsExt.md)
* [IProtocol](IProtocol.md)
* [IRSKOracle](IRSKOracle.md)
* [ISovryn](ISovryn.md)
* [ISovrynSwapNetwork](ISovrynSwapNetwork.md)
* [IStaking](IStaking.md)
* [ISwapsImpl](ISwapsImpl.md)
* [ITeamVesting](ITeamVesting.md)
* [ITimelock](ITimelock.md)
* [IV1PoolOracle](IV1PoolOracle.md)
* [IVesting](IVesting.md)
* [IVestingFactory](IVestingFactory.md)
* [IVestingRegistry](IVestingRegistry.md)
* [IWrbtc](IWrbtc.md)
* [IWrbtcERC20](IWrbtcERC20.md)
* [LenderInterestStruct](LenderInterestStruct.md)
* [LiquidationHelper](LiquidationHelper.md)
* [LiquidityMining](LiquidityMining.md)
* [LiquidityMiningConfigToken](LiquidityMiningConfigToken.md)
* [LiquidityMiningProxy](LiquidityMiningProxy.md)
* [LiquidityMiningStorage](LiquidityMiningStorage.md)
* [LoanClosingsEvents](LoanClosingsEvents.md)
* [LoanClosingsLiquidation](LoanClosingsLiquidation.md)
* [LoanClosingsRollover](LoanClosingsRollover.md)
* [LoanClosingsShared](LoanClosingsShared.md)
* [LoanClosingsWith](LoanClosingsWith.md)
* [LoanClosingsWithoutInvariantCheck](LoanClosingsWithoutInvariantCheck.md)
* [LoanInterestStruct](LoanInterestStruct.md)
* [LoanMaintenance](LoanMaintenance.md)
* [LoanMaintenanceEvents](LoanMaintenanceEvents.md)
* [LoanOpenings](LoanOpenings.md)
* [LoanOpeningsEvents](LoanOpeningsEvents.md)
* [LoanParamsStruct](LoanParamsStruct.md)
* [LoanSettings](LoanSettings.md)
* [LoanSettingsEvents](LoanSettingsEvents.md)
* [LoanStruct](LoanStruct.md)
* [LoanToken](LoanToken.md)
* [LoanTokenBase](LoanTokenBase.md)
* [LoanTokenLogicBeacon](LoanTokenLogicBeacon.md)
* [LoanTokenLogicLM](LoanTokenLogicLM.md)
* [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
* [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
* [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
* [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
* [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
* [LockedSOV](LockedSOV.md)
* [MarginTradeStructHelpers](MarginTradeStructHelpers.md)
* [Medianizer](Medianizer.md)
* [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
* [ModulesCommonEvents](ModulesCommonEvents.md)
* [ModulesProxy](ModulesProxy.md)
* [ModulesProxyRegistry](ModulesProxyRegistry.md)
* [MultiSigKeyHolders](MultiSigKeyHolders.md)
* [MultiSigWallet](MultiSigWallet.md)
* [Mutex](Mutex.md)
* [Objects](Objects.md)
* [OrderStruct](OrderStruct.md)
* [OrigingVestingCreator](OrigingVestingCreator.md)
* [OriginInvestorsClaim](OriginInvestorsClaim.md)
* [Ownable](Ownable.md)
* [Pausable](Pausable.md)
* [PausableOz](PausableOz.md)
* [PreviousLoanToken](PreviousLoanToken.md)
* [PreviousLoanTokenSettingsLowerAdmin](PreviousLoanTokenSettingsLowerAdmin.md)
* [PriceFeedRSKOracle](PriceFeedRSKOracle.md)
* [PriceFeeds](PriceFeeds.md)
* [PriceFeedsLocal](PriceFeedsLocal.md)
* [PriceFeedsMoC](PriceFeedsMoC.md)
* [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
* [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
* [ProtocolLike](ProtocolLike.md)
* [ProtocolSettings](ProtocolSettings.md)
* [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
* [ProtocolSettingsLike](ProtocolSettingsLike.md)
* [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
* [ProtocolTokenUser](ProtocolTokenUser.md)
* [Proxy](Proxy.md)
* [ProxyOwnable](ProxyOwnable.md)
* [ReentrancyGuard](ReentrancyGuard.md)
* [RewardHelper](RewardHelper.md)
* [RSKAddrValidator](RSKAddrValidator.md)
* [SafeERC20](SafeERC20.md)
* [SafeMath](SafeMath.md)
* [SafeMath96](SafeMath96.md)
* [setGet](setGet.md)
* [SharedReentrancyGuard](SharedReentrancyGuard.md)
* [SignedSafeMath](SignedSafeMath.md)
* [SOV](SOV.md)
* [sovrynProtocol](sovrynProtocol.md)
* [StakingAdminModule](StakingAdminModule.md)
* [StakingGovernanceModule](StakingGovernanceModule.md)
* [StakingInterface](StakingInterface.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingShared](StakingShared.md)
* [StakingStakeModule](StakingStakeModule.md)
* [StakingStorageModule](StakingStorageModule.md)
* [StakingStorageShared](StakingStorageShared.md)
* [StakingVestingModule](StakingVestingModule.md)
* [StakingWithdrawModule](StakingWithdrawModule.md)
* [State](State.md)
* [SwapsEvents](SwapsEvents.md)
* [SwapsExternal](SwapsExternal.md)
* [SwapsImplLocal](SwapsImplLocal.md)
* [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
* [SwapsUser](SwapsUser.md)
* [TeamVesting](TeamVesting.md)
* [Timelock](Timelock.md)
* [TimelockHarness](TimelockHarness.md)
* [TimelockInterface](TimelockInterface.md)
* [TokenSender](TokenSender.md)
* [UpgradableProxy](UpgradableProxy.md)
* [USDTPriceFeed](USDTPriceFeed.md)
* [Utils](Utils.md)
* [VaultController](VaultController.md)
* [Vesting](Vesting.md)
* [VestingCreator](VestingCreator.md)
* [VestingFactory](VestingFactory.md)
* [VestingLogic](VestingLogic.md)
* [VestingRegistry](VestingRegistry.md)
* [VestingRegistry2](VestingRegistry2.md)
* [VestingRegistry3](VestingRegistry3.md)
* [VestingRegistryLogic](VestingRegistryLogic.md)
* [VestingRegistryProxy](VestingRegistryProxy.md)
* [VestingRegistryStorage](VestingRegistryStorage.md)
* [VestingStorage](VestingStorage.md)
* [WeightedStakingModule](WeightedStakingModule.md)
* [WRBTC](WRBTC.md)
