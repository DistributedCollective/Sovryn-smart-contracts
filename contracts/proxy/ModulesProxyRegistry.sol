// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

import "../mixins/EnumerableBytes4Set.sol";
import "../utils/Utils.sol";
import "../utils/ProxyOwnable.sol";
import "./modules/interfaces/IFunctionsList.sol";
import "../openzeppelin/Address.sol";

/**
 * ModulesRegistry provides modules registration/removing/replacing functionality to ModulesProxy
 * Designed to be inherited, should not be deployed
 */

contract ModulesProxyRegistry is ProxyOwnable {
    using EnumerableBytes4Set for EnumerableBytes4Set.Bytes4Set;
    using Address for address;

    bytes32 internal constant KEY_IMPLEMENTATION = keccak256("key.implementation");

    event SetModuleFuncImplementation(
        bytes4 indexed _funcSig,
        address indexed _oldImplementation,
        address indexed _newImplementation
    );

    /// @notice Add new module functions.
    /// Overriding functions is not allowed - use ReplaceModule instead.
    /// @param _impl Module implementation address
    function addNewModule(address _impl) external onlyProxyOwner {
        _addNewModule(_impl);
    }

    /// @notice Replace module - remove the previous, add the new one
    /// @param _oldModuleImpl Module implementation address to remove
    /// @param _newModuleImpl Module implementation address to add
    function replaceModule(address _oldModuleImpl, address _newModuleImpl)
        external
        onlyProxyOwner
    {
        require(_newModuleImpl.isContract(), "MR03"); //ModulesRegistry::replaceModule - _newModuleImpl is not a contract
        require(_oldModuleImpl.isContract(), "MR04"); //ModulesRegistry::replaceModule - _oldModuleImpl is not a contract
        _removeModule(_oldModuleImpl);
        _addNewModule(_newModuleImpl);
    }

    function getFuncImplementation(bytes4 _sig) external view returns (address) {
        return _getFuncImplementation(_sig);
    }

    /// @notice verifies if no functions from the module deployed already registered
    /// @param _impl module implementation address to verify
    function canAddModule(address _impl) external view returns (bool) {
        require(_impl.isContract(), "MR06"); //Proxy::canAddModule: address is not a contract
        bytes4[] memory functions = IFunctionsList(_impl).getFunctionsList();
        for (uint256 i = 1; i < functions.length; i++)
            if (_getFuncImplementation(functions[i]) != address(0)) return (false);
        return true;
    }

    /// @notice to disable module - set all its functions implementation to address(0)
    /// @param _impl implementation address
    function removeModule(address _impl) external onlyProxyOwner {
        _removeModule(_impl);
    }

    /****************** INTERNAL FUNCTIONS ******************/

    function _addNewModule(address _impl) internal {
        require(_impl.isContract(), "MR01"); //ModulesRegistry::_addNewModule: address is not a contract
        bytes4[] memory functions = IFunctionsList(_impl).getFunctionsList();
        for (uint256 i = 1; i < functions.length; i++) {
            require(_getFuncImplementation(functions[i]) == address(0), "MR02"); //function already registered in another module - use ReplaceModule if you need to replace the whole module
            _setModuleFuncImplementation(functions[i], _impl);
        }
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

    function _removeModule(address _impl) internal onlyProxyOwner {
        require(_impl.isContract(), "MR07"); //ModulesRegistry::_removeModuleImplementation: address is not a contract
        bytes4[] memory functions = IFunctionsList(_impl).getFunctionsList();
        for (uint256 i = 1; i < functions.length; i++)
            _setModuleFuncImplementation(functions[i], address(0));
    }

    function _setModuleFuncImplementation(bytes4 _sig, address _impl) internal {
        _checkClashing(_sig);
        bytes32 key = keccak256(abi.encode(_sig, KEY_IMPLEMENTATION));
        assembly {
            sstore(key, _impl)
        }

        emit SetModuleFuncImplementation(_sig, _getFuncImplementation(_sig), _impl);
    }

    function _checkClashing(bytes4 _sig) internal pure {
        bytes4[] memory functionList = _getFunctionsList();
        for (uint256 i = 0; i < functionList.length; i++) {
            require(_sig != functionList[i], "MR09"); //ModulesRegistry has function with the same id
        }
    }

    function _getFunctionsList() internal pure returns (bytes4[] memory) {
        bytes4[] memory functionList = new bytes4[](7);
        functionList[0] = this.getFuncImplementation.selector;
        functionList[1] = this.addNewModule.selector;
        functionList[2] = this.removeModule.selector;
        functionList[3] = this.canAddModule.selector;
        functionList[4] = this.replaceModule.selector;
        functionList[5] = this.setProxyOwner.selector;
        functionList[6] = this.getProxyOwner.selector;
        return functionList;
    }
}
