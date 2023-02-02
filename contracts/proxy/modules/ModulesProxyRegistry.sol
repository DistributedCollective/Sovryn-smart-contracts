// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

import "../../utils/Utils.sol";
import "../../utils/ProxyOwnable.sol";
import "../modules/interfaces/IFunctionsList.sol";
import "../modules/interfaces/IModulesProxyRegistry.sol";
import "../../openzeppelin/Address.sol";

/**
 * ModulesProxyRegistry provides modules registration/removing/replacing functionality to ModulesProxy
 * Designed to be inherited
 */

contract ModulesProxyRegistry is IModulesProxyRegistry, ProxyOwnable {
    using Address for address;

    bytes32 internal constant KEY_IMPLEMENTATION = keccak256("key.implementation");

    ///@notice Constructor is internal to make contract abstract
    constructor() internal {
        // abstract
    }

    /// @notice Add module functions.
    /// Overriding functions is not allowed. To replace modules use replaceModule function.
    /// @param _impl Module implementation address
    function addModule(address _impl) external onlyProxyOwner {
        _addModule(_impl);
    }

    /// @notice Add modules functions.
    /// @param _implementations Modules implementation addresses
    function addModules(address[] calldata _implementations) external onlyProxyOwner {
        _addModules(_implementations);
    }

    /// @notice Replace module - remove the previous, add the new one
    /// @param _oldModuleImpl Module implementation address to remove
    /// @param _newModuleImpl Module implementation address to add
    function replaceModule(address _oldModuleImpl, address _newModuleImpl)
        external
        onlyProxyOwner
    {
        _replaceModule(_oldModuleImpl, _newModuleImpl);
    }

    /// @notice Add modules functions.
    /// @param _implementationsFrom Modules to replace
    /// @param _implementationsTo Replacing modules
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

    /// @notice To disable module - set all its functions implementation to address(0)
    /// @param _impl implementation address
    function removeModule(address _impl) external onlyProxyOwner {
        _removeModule(_impl);
    }

    /// @notice Add modules functions.
    /// @param _implementations Modules implementation addresses
    function removeModules(address[] calldata _implementations) external onlyProxyOwner {
        _removeModules(_implementations);
    }

    /// @param _sig Function signature to get impmementation address for
    /// @return Function's contract implelementation address
    function getFuncImplementation(bytes4 _sig) external view returns (address) {
        return _getFuncImplementation(_sig);
    }

    /// @notice Verifies if no functions from the module already registered
    /// @param _impl Module implementation address to verify
    /// @return True if module can be added
    function canAddModule(address _impl) external view returns (bool) {
        return _canAddModule(_impl);
    }

    /// @notice Multiple modules verification if there are functions from the modules already registered
    /// @param _implementations modules implementation addresses to verify
    /// @return addresses of registered modules
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

    /// @notice Used externally to verify module being added for clashing
    /// @param _newModule module implementation which functions to verify
    /// @return Clashing functions signatures and corresponding modules (contracts) addresses
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

    /// Verifies if the address is a registered module contract
    /// @param _impl deployment address to verify
    /// @return true if _impl address is a registered module
    function isModuleRegistered(address _impl) external view returns (bool) {
        return _getRegisteredModuleAddress(_impl) == _impl;
    }

    /// @notice Finds respective registered module address by getting the _impl
    ///         functions signatures implementation. Stops at the first match.
    ///         Useful when replacing modules
    /// @param _impl Given an implementation address
    /// @return Corresponding registered module address or null address if
    function getRegisteredModuleAddress(address _impl) external view returns (address) {
        return _getRegisteredModuleAddress(_impl);
    }

    /****************** INTERNAL FUNCTIONS ******************/

    function _getRegisteredModuleAddress(address _impl) internal view returns (address) {
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

    function _getFuncImplementation(bytes4 _sig) internal view returns (address) {
        //TODO: add querying Registry for logic address and then delegate call to it OR use proxy memory slots like this:
        bytes32 key = keccak256(abi.encode(_sig, KEY_IMPLEMENTATION));
        address implementation;
        assembly {
            implementation := sload(key)
        }
        return implementation;
    }

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

    function _addModules(address[] memory _implementations) internal {
        for (uint256 i = 0; i < _implementations.length; i++) {
            _addModule(_implementations[i]);
        }
    }

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

    function _removeModules(address[] memory _implementations) internal {
        for (uint256 i = 0; i < _implementations.length; i++) {
            _removeModule(_implementations[i]);
        }
    }

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

    function _setModuleFuncImplementation(bytes4 _sig, address _impl) internal {
        emit SetModuleFuncImplementation(_sig, _getFuncImplementation(_sig), _impl);

        bytes32 key = keccak256(abi.encode(_sig, KEY_IMPLEMENTATION));
        assembly {
            sstore(key, _impl)
        }
    }

    function _isFuncClashingWithProxyFunctions(bytes4 _sig) internal pure returns (bool) {
        bytes4[] memory functionList = _getFunctionsList();
        for (uint256 i = 0; i < functionList.length; i++) {
            if (_sig == functionList[i])
                //ModulesProxyRegistry has function with the same id
                return true;
        }
        return false;
    }

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

    function _getFunctionsList() internal pure returns (bytes4[] memory) {
        bytes4[] memory functionList = new bytes4[](14);
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
        functionList[13] = this.getRegisteredModuleAddress.selector;
        return functionList;
    }
}
