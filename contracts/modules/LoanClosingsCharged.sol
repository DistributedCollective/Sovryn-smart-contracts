/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./LoanClosingsShared.sol";

/**
 * @title LoanClosingsCharged contract.
 * @notice Close-path settlement for VOLUNTARY borrower closes: the exit fee is
 *   taken and the remainder is subject to the security-perimeter delay before
 *   the receiver is paid.
 *
 * Modules that can only close a position on the borrower's own initiative
 * inherit this contract. Modules that close a position on someone else's
 * initiative — rollover and liquidation — inherit `LoanClosingsShared`
 * directly and settle through its perimeter-free payout instead. Splitting the
 * two by inheritance rather than by a runtime flag means a forced-close module
 * has no reachable path to the fee or the delay at all.
 * */
contract LoanClosingsCharged is LoanClosingsShared {
    /**
     * @notice Pay a voluntary borrower close: fee leg first, then the delay.
     *
     * @dev Overrides the perimeter-free base payout.
     *
     *   The fee leg returns the net amount, or the full gross on any
     *   non-charging path — a fee fault never blocks the withdrawal. The delay
     *   leg then either escrows that amount and returns true, or returns false
     *   and leaves the caller to pay the receiver directly.
     *
     *   `_exitFeeChargeable` still gates both legs on the actor: only the
     *   borrower or a delegated manager is charged, so a voluntary entry point
     *   reached by anyone else settles as a plain payout.
     *
     * @param origin The close origin, threaded from the public entry point.
     * @param loanLocal The loan being closed.
     * @param assetToken The asset to pay out.
     * @param receiver The payout recipient.
     * @param assetAmount The gross payout amount.
     * @param allowDonationOnFailure Forwarded to `_withdrawAsset`.
     * */
    function _payoutBorrowerExit(
        CloseOrigin origin,
        Loan storage loanLocal,
        address assetToken,
        address receiver,
        uint256 assetAmount,
        bool allowDonationOnFailure
    ) internal {
        if (!_exitFeeChargeable(origin, loanLocal)) {
            _withdrawAsset(assetToken, receiver, assetAmount, allowDonationOnFailure);
            return;
        }

        uint256 toUser = _chargeExitFeeReturnNet(
            receiver,
            assetToken,
            loanLocal.lender,
            assetAmount
        );

        if (!_maybeDelayBorrowerExit(loanLocal, assetToken, receiver, toUser)) {
            _withdrawAsset(assetToken, receiver, toUser, allowDonationOnFailure);
        }
    }
}
