// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

import "./ModulesProxyRegistry.sol";

/**
 * ModulesProxy serves as a storage processed by a set of logic contracts - modules
 * Modules functions are registered in the contract's slots generated per func sig
 * All the function calls except for own Proxy functions are delegated to
 * the registered functions
 * The ModulesProxy is designed as a universal solution for refactorig contracts
 * reaching a 24K size limit (EIP-170)
 *
 * Upgradability is implemented at a module level to provide consistency
 * It does not allow to replace separate functions - only the whole module
 * meaning that if a module being registered contains other modules function signatures
 * then these modulea should be replaced completely - all the functions should be removed
 * to avoid leftovers or accidental replacements and therefore functional inconsistency.
 *
 * A module is either a new non-overlapping with registered modules
 * or a complete replacement of another registered module
 * in which case all the old module functions are unregistered and then
 * the new module functions are registered
 * There is also a separate function to unregister a module which unregisters all the functions
 * There is no option to unregister a subset of module functions - one should use pausable functionality
 * to achieve this
 */

contract ModulesProxy is ModulesProxyRegistry {
    // Uncomment for using beforeFallback() hook
    /*
    bytes private constant BEFORE_FALLBACK_SIG = abi.encodeWithSignature("beforeFallback()");
    bytes4 private constant BEFORE_FALLBACK_SIG_BYTES4 = bytes4(keccak256(abi.encodePacked("beforeFallback()")));
    */

    /**
     * @notice Fallback function delegates calls to modules.
     * Returns whatever the implementation call returns.
     * Has a hook to execute before delegating calls
     * To activate register a module with beforeFallback() function
     */
    function() external payable {
        /*
        // Commented to safe gas by default
        // Uncomment for using beforeFallback() hook 
        // Implement and register beforeFallback() function in a module
        address beforeFallback = _getFuncImplementation(BEFORE_FALLBACK_SIG_BYTES4);
        if (beforeFallback != address(0)) {
            (bool success, ) = beforeFallback.delegatecall(bytes(0x39b0111a)); // abi.encodeWithSignature("beforeFallback()")
            require(success, "ModulesProxy::fallback: beforeFallback() fail"); //MP02
        }
        */

        address target = _getFuncImplementation(msg.sig);
        require(target != address(0), "ModulesProxy:target module not registered"); // MP03

        bytes memory data = msg.data;
        assembly {
            let result := delegatecall(gas, target, add(data, 0x20), mload(data), 0, 0)
            let size := returndatasize
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, size)
            switch result
                case 0 {
                    revert(ptr, size)
                }
                default {
                    return(ptr, size)
                }
        }
    }
}
