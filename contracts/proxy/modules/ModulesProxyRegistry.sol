// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

import "../../utils/Utils.sol";
import "../../utils/ProxyOwnable.sol";
import "../modules/interfaces/IFunctionsList.sol";
import "../modules/interfaces/IModulesProxyRegistry.sol";
import "../../openzeppelin/Address.sol";

/**
 * ModulesRegistry provides modules registration/removing/replacing functionality to ModulesProxy
 * Designed to be inherited
 */

contract ModulesProxyRegistry is IModulesProxyRegistry, ProxyOwnable {
    using Address for address;

    bytes32 internal constant KEY_IMPLEMENTATION = keccak256("key.implementation");

    ///@notice constructor is internal to make contract abstract
    constructor() internal {
        // abstract
    }

    /// @notice Add module functions.
    /// Overriding functions is not allowed. To replace modules use ReplaceModule function.
    /// @param _impl Module implementation address
    function addModule(address _impl) external onlyProxyOwner {
        _addModule(_impl);
    }

    /// @notice Add modules functions.
    /// @param _implementations Modules implementation addresses
    function addModules(address[] calldata _implementations) external onlyProxyOwner {
        for (uint256 i = 0; i < _implementations.length; i++) _addModule(_implementations[i]);
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
        require(_implementationsFrom.length == _implementationsTo.length, "MR10"); //arrays sizes must be equal
        for (uint256 i = 0; i < _implementationsFrom.length; i++)
            _replaceModule(_implementationsFrom[i], _implementationsTo[i]);
    }

    /// @notice to disable module - set all its functions implementation to address(0)
    /// @param _impl implementation address
    function removeModule(address _impl) external onlyProxyOwner {
        _removeModule(_impl);
    }

    /// @notice Add modules functions.
    /// @param _implementations Modules implementation addresses
    function removeModules(address[] calldata _implementations) external onlyProxyOwner {
        for (uint256 i = 0; i < _implementations.length; i++) _removeModule(_implementations[i]);
    }

    /// @param _sig function signature to get impmementation address for
    /// @return function's contract implelementation address
    function getFuncImplementation(bytes4 _sig) external view returns (address) {
        return _getFuncImplementation(_sig);
    }

    /// @notice verifies if no functions from the module deployed already registered
    /// @param _impl module implementation address to verify
    /// @return true if module can be added
    function canAddModule(address _impl) external view returns (bool) {
        require(_impl.isContract(), "MR06"); //Proxy::canAddModule: address is not a contract
        bytes4[] memory functions = IFunctionsList(_impl).getFunctionsList();
        for (uint256 i = 0; i < functions.length; i++)
            if (_getFuncImplementation(functions[i]) != address(0)) return (false);
        return true;
    }

    /// @notice used externally to verify module being added for clashing
    /// @param _newModule module implementation which functions to verify
    /// @return clashing functions signatures and corresponding modules (contracts) addresses
    function checkClashingFuncSelectors(address _newModule)
        external
        view
        returns (
            address[] memory clashingModules,
            bytes4[] memory clashingFuncSelectors,
            bytes4[] memory registryClashingSelectors
        )
    {
        require(_newModule.isContract(), "MR06"); //Proxy::canAddModule: address is not a contract
        bytes4[] memory functions = IFunctionsList(_newModule).getFunctionsList();
        bytes4[] memory functionList = _getFunctionsList(); //registry functions list
        uint256 clashingRegistrySize;
        uint256 clashingArraySize;
        uint256 clashingArrayIndex;
        uint256 clashingRegistryArrayIndex;
        for (uint256 i = 0; i < functions.length; i++) {
            address funcImpl = _getFuncImplementation(functions[i]);
            if (funcImpl != address(0)) {
                clashingArraySize++;
            }
            if (_checkClashingWithProxyFunctions(functions[i])) clashingRegistrySize++;
        }

        clashingModules = new address[](clashingArraySize);
        clashingFuncSelectors = new bytes4[](clashingArraySize);
        registryClashingSelectors = new bytes4[](clashingRegistrySize);

        for (uint256 i = 0; i < functions.length; i++) {
            address funcImpl = _getFuncImplementation(functions[i]);
            if (funcImpl != address(0)) {
                clashingModules[clashingArrayIndex] = funcImpl;
                clashingFuncSelectors[clashingArrayIndex] = functions[i];
                clashingArrayIndex++;
            }
            for (uint256 j = 0; j < functionList.length; j++) {
                //ModulesRegistry has function with the same selector
                if (functionList[j] == functions[i]) {
                    clashingFuncSelectors[clashingRegistryArrayIndex] = functions[i];
                    clashingRegistryArrayIndex++;
                }
            }
        }
    }

    /****************** INTERNAL FUNCTIONS ******************/

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
        require(_impl.isContract(), "MR01"); //ModulesRegistry::_addModule: address is not a contract
        bytes4[] memory functions = IFunctionsList(_impl).getFunctionsList();
        for (uint256 i = 0; i < functions.length; i++) {
            require(_getFuncImplementation(functions[i]) == address(0), "MR02"); //function already registered in another module - use ReplaceModule if you need to replace the whole module
            require(functions[i] != bytes4(0), "MR03"); // does not allow empty function id
            require(_checkClashingWithProxyFunctions(functions[i]), "MR09"); //ModulesRegistry has function with the same signature
            _setModuleFuncImplementation(functions[i], _impl);
        }
        emit AddModule(_impl);
    }

    function _removeModule(address _impl) internal onlyProxyOwner {
        require(_impl.isContract(), "MR07"); //ModulesRegistry::_removeModuleImplementation: address is not a contract
        bytes4[] memory functions = IFunctionsList(_impl).getFunctionsList();
        for (uint256 i = 0; i < functions.length; i++)
            _setModuleFuncImplementation(functions[i], address(0));

        emit RemoveModule(_impl);
    }

    function _replaceModule(address _oldModuleImpl, address _newModuleImpl) internal {
        require(_newModuleImpl.isContract(), "MR03"); //ModulesRegistry::replaceModule - _newModuleImpl is not a contract
        require(_oldModuleImpl.isContract(), "MR04"); //ModulesRegistry::replaceModule - _oldModuleImpl is not a contract
        _removeModule(_oldModuleImpl);
        _addModule(_newModuleImpl);

        emit ReplaceModule(_oldModuleImpl, _newModuleImpl);
    }

    function _setModuleFuncImplementation(bytes4 _sig, address _impl) internal {
        emit SetModuleFuncImplementation(_sig, _getFuncImplementation(_sig), _impl);

        bytes32 key = keccak256(abi.encode(_sig, KEY_IMPLEMENTATION));
        assembly {
            sstore(key, _impl)
        }
    }

    function _checkClashingWithProxyFunctions(bytes4 _sig) internal pure returns (bool) {
        bytes4[] memory functionList = _getFunctionsList();
        for (uint256 i = 0; i < functionList.length; i++) {
            if (_sig == functionList[i])
                //ModulesRegistry has function with the same id
                return false;
        }
        return true;
    }

    function _getFunctionsList() internal pure returns (bytes4[] memory) {
        bytes4[] memory functionList = new bytes4[](11);
        functionList[0] = this.getFuncImplementation.selector;
        functionList[1] = this.addModule.selector;
        functionList[2] = this.addModules.selector;
        functionList[3] = this.removeModule.selector;
        functionList[4] = this.removeModules.selector;
        functionList[5] = this.replaceModule.selector;
        functionList[6] = this.replaceModules.selector;
        functionList[7] = this.canAddModule.selector;
        functionList[8] = this.setProxyOwner.selector;
        functionList[9] = this.getProxyOwner.selector;
        functionList[10] = this.checkClashingFuncSelectors.selector;
        return functionList;
    }
}
