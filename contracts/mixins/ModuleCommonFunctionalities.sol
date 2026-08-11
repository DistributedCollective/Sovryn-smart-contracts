pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../core/State.sol";

/// @title  ModuleCommonFunctionalities
/// @notice Tiny mixin of functionality common to every protocol module.
/// @dev    Keep this generic — module-specific concerns (e.g. ColFee) live in
///         their own scoped mixins (see `ColFeeBorrowerExit`), not here, since
///         this is inherited by every module. DON'T ADD STATE VARIABLES HERE:
///         it sits on the shared `State` layout used by the upgradeable proxy.
contract ModuleCommonFunctionalities is State {
    modifier whenNotPaused() {
        require(!pause, "Paused");
        _;
    }
}
