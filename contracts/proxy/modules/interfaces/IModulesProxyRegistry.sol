// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

/**
 * ModulesProxyRegistry Interface
 */

contract IModulesProxyRegistry {
    event AddModule(address indexed moduleAddress);
    event ReplaceModule(address indexed oldAddress, address indexed newAddress);
    event RemoveModule(address indexed moduleAddress);
    event SetModuleFuncImplementation(
        bytes4 indexed _funcSig,
        address indexed _oldImplementation,
        address indexed _newImplementation
    );

    /// @notice Add module functions.
    /// Overriding functions is not allowed. To replace modules use ReplaceModule function.
    /// @param _impl Module implementation address
    function addModule(address _impl) external;

    /// @notice Add modules functions.
    /// @param _implementations Modules implementation addresses
    function addModules(address[] calldata _implementations) external;

    /// @notice Replace module - remove the previous, add the new one
    /// @param _oldModuleImpl Module implementation address to remove
    /// @param _newModuleImpl Module implementation address to add
    function replaceModule(address _oldModuleImpl, address _newModuleImpl) external;

    /// @notice Add modules functions.
    /// @param _implementationsFrom Modules to replace
    /// @param _implementationsTo Replacing modules
    function replaceModules(
        address[] calldata _implementationsFrom,
        address[] calldata _implementationsTo
    ) external;

    /// @notice to disable module - set all its functions implementation to address(0)
    /// @param _impl implementation address
    function removeModule(address _impl) external;

    /// @notice Add modules functions.
    /// @param _implementations Modules implementation addresses
    function removeModules(address[] calldata _implementations) external;

    /// @param _sig function signature to get impmementation address for
    /// @return function's contract implelementation address
    function getFuncImplementation(bytes4 _sig) external view returns (address);

    /// @notice verifies if no functions from the module deployed already registered
    /// @param _impl module implementation address to verify
    /// @return true if module can be added
    function canAddModule(address _impl) external view returns (bool);

    /// @notice Multiple modules verification if no functions from the modules already registered
    /// @param _implementations modules implementation addresses to verify
    /// @return True if all modules can be added, false otherwise
    function canNotAddModules(address[] calldata _implementations)
        external
        view
        returns (address[] memory modules);

    /// @notice used externally to verify module being added for clashing
    /// @param _newModule module implementation which functions to verify
    /// @return clashing functions signatures and corresponding modules (contracts) addresses
    function checkClashingFuncSelectors(address _newModule)
        external
        view
        returns (
            address[] memory clashingModules,
            bytes4[] memory clashingModulesFuncSelectors,
            bytes4[] memory clashingProxyRegistryFuncSelectors
        );
}
