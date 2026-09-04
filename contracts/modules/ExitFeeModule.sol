/**
 * Copyright 2026, Sovryn. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../core/State.sol";
import "../events/ModulesCommonEvents.sol";
import "../interfaces/perimeter/IPerimeterEvents.sol";
import "../utils/PerimeterLib.sol";
import "../openzeppelin/Address.sol";

/**
 * @title Perimeter admin module.
 *
 * @notice Owner-gated admin for the two Perimeter protocol pointers on the
 *         sovrynProtocol proxy: the ExitFeeController and the borrower-exit
 *         charge hook (`BorrowerExitPerimeterOps`).
 */
contract ExitFeeModule is State, ModulesCommonEvents, IPerimeterEvents {
    constructor() public {}

    function() external {
        revert("fallback not allowed");
    }

    function initialize(address target) external onlyOwner {
        address prev = logicTargets[this.exitFeeController.selector];
        _setTarget(this.exitFeeController.selector, target);
        _setTarget(this.setExitFeeController.selector, target);
        _setTarget(this.borrowerExitPerimeterOps.selector, target);
        _setTarget(this.setBorrowerExitPerimeterOps.selector, target);
        emit ProtocolModuleContractReplaced(prev, target, "ExitFeeModule");
    }

    /// @return ctrl Pinned ExitFeeController (address(0) until pinned).
    function exitFeeController() public view returns (address ctrl) {
        return PerimeterLib.getController();
    }

    /// @notice Pin/rotate the ExitFeeController. Reverts on a non-contract so a
    ///         typo can't point the quote staticcall at a no-code address.
    function setExitFeeController(address ctrl) external onlyOwner {
        require(Address.isContract(ctrl), "EFC:not-contract");
        address prev = PerimeterLib.getController();
        PerimeterLib.setController(ctrl);
        emit ExitFeeControllerSet(prev, ctrl);
    }

    /// @return ops Pinned borrower-exit charge hook (address(0) until pinned).
    function borrowerExitPerimeterOps() public view returns (address ops) {
        return PerimeterLib.getBorrowerExitOps();
    }

    /// @notice Pin/rotate the borrower-exit charge hook. Reverts on a
    ///         non-contract so disabling charging is a deliberate act.
    function setBorrowerExitPerimeterOps(address ops) external onlyOwner {
        require(Address.isContract(ops), "EFC:not-contract");
        address prev = PerimeterLib.getBorrowerExitOps();
        PerimeterLib.setBorrowerExitOps(ops);
        emit BorrowerExitPerimeterOpsSet(prev, ops);
    }
}
