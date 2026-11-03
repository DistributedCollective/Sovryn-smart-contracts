// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

/// @notice Reverts every call without modifying storage.
contract AMMEmergencyHalt {
    function() external payable {
        revert("AMM: emergency shutdown");
    }
}
