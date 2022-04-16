/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../openzeppelin/SafeERC20.sol";
import "../core/State.sol";
import "../mixins/VaultController.sol";
import "./FeesHelper.sol";

/**
 * @title The Interest User contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized margin
 * trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract pays loan interests.
 * */
contract InterestUser is VaultController, FeesHelper {
    using SafeERC20 for IERC20;

    /// Triggered whenever interest is paid to lender.
    event PayInterestTransfer(
        address indexed interestToken,
        address indexed lender,
        uint256 effectiveInterest
    );

    /**
     * @notice Internal function to pay interest of a loan.
     * @dev Calls _payInterestTransfer internal function to transfer tokens.
     * @param lender The account address of the lender.
     * @param interestToken The token address to pay interest with.
     * */
    function _payInterest(address lender, address interestToken) internal {
        LenderInterest storage lenderInterestLocal = lenderInterest[lender][interestToken];

        uint256 interestOwedNow = 0;
        if (lenderInterestLocal.owedPerDay != 0 && lenderInterestLocal.updatedTimestamp != 0) {
            interestOwedNow = block
                .timestamp
                .sub(lenderInterestLocal.updatedTimestamp)
                .mul(lenderInterestLocal.owedPerDay)
                .div(1 days);

            lenderInterestLocal.updatedTimestamp = block.timestamp;

            if (interestOwedNow > lenderInterestLocal.owedTotal)
                interestOwedNow = lenderInterestLocal.owedTotal;

            if (interestOwedNow != 0) {
                lenderInterestLocal.paidTotal = lenderInterestLocal.paidTotal.add(interestOwedNow);
                lenderInterestLocal.owedTotal = lenderInterestLocal.owedTotal.sub(interestOwedNow);

                _payInterestTransfer(lender, interestToken, interestOwedNow);
            }
        } else {
            lenderInterestLocal.updatedTimestamp = block.timestamp;
        }
    }

    /**
     * @notice Internal function to transfer tokens for the interest of a loan.
     * @param lender The account address of the lender.
     * @param interestToken The token address to pay interest with.
     * @param interestOwedNow The amount of interest to pay.
     * */
    function _payInterestTransfer(
        address lender,
        address interestToken,
        uint256 interestOwedNow
    ) internal {
        uint256 lendingFee = interestOwedNow.mul(lendingFeePercent).div(10**20);
        /// TODO: refactor: data incapsulation violation and DRY design principles
        /// uint256 lendingFee = interestOwedNow.mul(lendingFeePercent).divCeil(10**20); is better but produces errors in tests because of this

        _payLendingFee(lender, interestToken, lendingFee);

        /// Transfers the interest to the lender, less the interest fee.
        vaultWithdraw(interestToken, lender, interestOwedNow.sub(lendingFee));

        /// Event Log
        emit PayInterestTransfer(interestToken, lender, interestOwedNow.sub(lendingFee));
    }
}
