/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./LoanTokenLogicStandard.sol";

contract LoanTokenLogicWrbtc is LoanTokenLogicStandard {
    function mintWithBTC(address receiver)
        external
        payable
        nonReentrant
        returns (uint256 mintAmount)
    {
        return _mintToken(receiver, msg.value);
    }

    function burnToBTC(address receiver, uint256 burnAmount)
        external
        nonReentrant
        returns (uint256 loanAmountPaid)
    {
        loanAmountPaid = _burnToken(burnAmount);

        if (loanAmountPaid != 0) {
            IWrbtcERC20(wrbtcTokenAddress).withdraw(loanAmountPaid);
            Address.sendValue(receiver, loanAmountPaid);
        }
    }

    /* Internal functions */

    // sentAddresses[0]: lender
    // sentAddresses[1]: borrower
    // sentAddresses[2]: receiver
    // sentAddresses[3]: manager
    // sentAmounts[0]: interestRate
    // sentAmounts[1]: newPrincipal
    // sentAmounts[2]: interestInitialAmount
    // sentAmounts[3]: loanTokenSent
    // sentAmounts[4]: collateralTokenSent
    function _verifyTransfers(
        address collateralTokenAddress,
        address[4] memory sentAddresses,
        uint256[5] memory sentAmounts,
        uint256 withdrawalAmount
    ) internal returns (uint256 msgValue) {
        address _wrbtcToken = wrbtcTokenAddress;
        address _loanTokenAddress = _wrbtcToken;
        address receiver = sentAddresses[2];
        uint256 newPrincipal = sentAmounts[1];
        uint256 loanTokenSent = sentAmounts[3];
        uint256 collateralTokenSent = sentAmounts[4];

        require(_loanTokenAddress != collateralTokenAddress, "26");

        msgValue = msg.value;

        if (withdrawalAmount != 0) {
            // withdrawOnOpen == true
            IWrbtcERC20(_wrbtcToken).withdraw(withdrawalAmount);
            Address.sendValue(receiver, withdrawalAmount);
            if (newPrincipal > withdrawalAmount) {
                _safeTransfer(
                    _loanTokenAddress,
                    sovrynContractAddress,
                    newPrincipal - withdrawalAmount,
                    ""
                );
            }
        } else {
            _safeTransfer(
                _loanTokenAddress,
                sovrynContractAddress,
                newPrincipal,
                "27"
            );
        }

        if (collateralTokenSent != 0) {
            _safeTransferFrom(
                collateralTokenAddress,
                msg.sender,
                sovrynContractAddress,
                collateralTokenSent,
                "28"
            );
        }

        if (loanTokenSent != 0) {
            if (msgValue != 0 && msgValue >= loanTokenSent) {
                IWrbtc(_wrbtcToken).deposit.value(loanTokenSent)();
                _safeTransfer(
                    _loanTokenAddress,
                    sovrynContractAddress,
                    loanTokenSent,
                    "29"
                );
                msgValue -= loanTokenSent;
            } else {
                _safeTransferFrom(
                    _loanTokenAddress,
                    msg.sender,
                    sovrynContractAddress,
                    loanTokenSent,
                    "29"
                );
            }
        }
    }
}
