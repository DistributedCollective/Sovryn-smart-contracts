// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

/**
 * ModulesProxyRegistry Interface
 */

contract IModulesProxyRegistry {
    event AddModule(address moduleAddress);
    event ReplaceModule(address oldAddress, address newAddress);
    event RemoveModule(address moduleAddress);
    event SetModuleFuncImplementation(
        bytes4 indexed _funcSig,
        address indexed _oldImplementation,
        address indexed _newImplementation
    );

    /// @notice Add module functions.
    /// Overriding functions is not allowed. To replace modules use ReplaceModule function.
    /// @param _impl Module implementation address
    function addModule(address _impl) external;

    /// @notice Replace module - remove the previous, add the new one
    /// @param _oldModuleImpl Module implementation address to remove
    /// @param _newModuleImpl Module implementation address to add
    function replaceModule(address _oldModuleImpl, address _newModuleImpl) external;

    /// @param _sig function signature to get impmementation address for
    /// @return function's contract implelementation address
    function getFuncImplementation(bytes4 _sig) external view returns (address);

    /// @notice verifies if no functions from the module deployed already registered
    /// @param _impl module implementation address to verify
    /// @return true if module can be added
    function canAddModule(address _impl) external view returns (bool);

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
        );

    /// @notice to disable module - set all its functions implementation to address(0)
    /// @param _impl implementation address
    function removeModule(address _impl) external;
}
