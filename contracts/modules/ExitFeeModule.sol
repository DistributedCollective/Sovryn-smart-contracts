/**
 * Copyright 2026, Sovryn. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../core/State.sol";
import "../events/ModulesCommonEvents.sol";
import "../interfaces/colfee/IColFeeEvents.sol";
import "../utils/ColFeeLib.sol";
import "../openzeppelin/Address.sol";

/**
 * @title ColFee admin module.
 *
 * @notice Owner-gated admin for the two ColFee protocol pointers on the
 *         sovrynProtocol proxy: the ExitFeeController and the borrower-exit
 *         charge hook (`ColFeeBorrowerExitOps`).
 */
contract ExitFeeModule is State, ModulesCommonEvents, IColFeeEvents {
    constructor() public {}

    function() external {
        revert("fallback not allowed");
    }

    function initialize(address target) external onlyOwner {
        address prev = logicTargets[this.exitFeeController.selector];
        _setTarget(this.exitFeeController.selector, target);
        _setTarget(this.setExitFeeController.selector, target);
        _setTarget(this.colFeeBorrowerExitOps.selector, target);
        _setTarget(this.setColFeeBorrowerExitOps.selector, target);
        emit ProtocolModuleContractReplaced(prev, target, "ExitFeeModule");
    }

    /// @return ctrl Pinned ExitFeeController (address(0) until pinned).
    function exitFeeController() public view returns (address ctrl) {
        return ColFeeLib.getController();
    }

    /// @notice Pin/rotate the ExitFeeController. Reverts on a non-contract so a
    ///         typo can't point the quote staticcall at a no-code address.
    function setExitFeeController(address ctrl) external onlyOwner {
        require(Address.isContract(ctrl), "EFC:not-contract");
        address prev = ColFeeLib.getController();
        ColFeeLib.setController(ctrl);
        emit ExitFeeControllerSet(prev, ctrl);
    }

    /// @return ops Pinned borrower-exit charge hook (address(0) until pinned).
    function colFeeBorrowerExitOps() public view returns (address ops) {
        return ColFeeLib.getBorrowerExitOps();
    }

    /// @notice Pin/rotate the borrower-exit charge hook. Reverts on a
    ///         non-contract so disabling charging is a deliberate act.
    function setColFeeBorrowerExitOps(address ops) external onlyOwner {
        require(Address.isContract(ops), "EFC:not-contract");
        address prev = ColFeeLib.getBorrowerExitOps();
        ColFeeLib.setBorrowerExitOps(ops);
        emit ColFeeBorrowerExitOpsSet(prev, ops);
    }
}
