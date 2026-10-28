/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./LoanClosingsCharged.sol";

/**
 * @title LoanClosingsWithSwap contract.
 * @notice Closes a loan by swapping collateral back to the loan token to repay
 *   the principal, returning any excess to the borrower. Margin trade positions
 *   are always closed this way.
 *
 * Hosted separately from LoanClosingsWith so each module carries only the close
 * path it serves; the protocol routes to both by selector.
 * */
contract LoanClosingsWithSwap is LoanClosingsCharged {
    constructor() public {}

    function() external {
        revert("fallback not allowed");
    }

    function initialize(address target) external onlyOwner {
        address prevModuleContractAddress = logicTargets[this.closeWithSwap.selector];
        _setTarget(this.closeWithSwap.selector, target);
        emit ProtocolModuleContractReplaced(
            prevModuleContractAddress,
            target,
            "LoanClosingsWithSwap"
        );
    }

    /**
     * @notice Closes a loan by swapping the collateral back to the loan token.
     *
     * @param loanId The id of the loan.
     * @param receiver The receiver of the remainder.
     * @param swapAmount Defines how much of the position should be closed and
     *   is denominated in collateral tokens.
     * @param returnTokenIsCollateral true: withdraws collateralToken,
     *   false: withdraws loanToken.
     *
     * @return loanCloseAmount The amount of the collateral token of the loan.
     * @return withdrawAmount The GROSS withdraw amount; an active exit fee is
     *         deducted before the receiver is paid.
     * @return withdrawToken The loan token address.
     * */
    function closeWithSwap(
        bytes32 loanId,
        address receiver,
        uint256 swapAmount, // denominated in collateralToken
        bool returnTokenIsCollateral, // true: withdraws collateralToken, false: withdraws loanToken
        bytes memory // for future use /*loanDataBytes*/
    )
        public
        nonReentrant
        globallyNonReentrant
        iTokenSupplyUnchanged(loanId)
        whenNotPaused
        returns (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken)
    {
        _checkAuthorized(loanId);
        return
            _closeWithSwap(
                loanId,
                receiver,
                swapAmount,
                returnTokenIsCollateral,
                "", /// loanDataBytes
                false,
                CloseOrigin.VoluntaryClose
            );
    }
}
