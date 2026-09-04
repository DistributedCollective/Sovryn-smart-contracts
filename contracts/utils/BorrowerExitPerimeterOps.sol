// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../core/State.sol";
import "../interfaces/perimeter/IExitFeeController.sol";
import "../interfaces/perimeter/IPerimeterEvents.sol";
import "../interfaces/IERC20.sol";
import "./PerimeterLib.sol";

/// @title  BorrowerExitPerimeterOps
/// @notice Protocol-side Perimeter borrower-exit charge hook: quotes the
///         controller, validates the quote, pays the fee leg, emits the audit
///         event, and returns the amount to pay the user.
///
/// @dev    Runs only under `delegatecall` in the calling proxy's context:
///         storage is the proxy's (controller pointer, `wrbtcToken`),
///         `address(this)` is the proxy (the fee leg spends protocol
///         balances), and `msg.sender` is the exiting actor. Declares no
///         storage of its own.
///
///         Fail-open: a misbehaving controller, an invalid quote, or a failed
///         fee transfer each resolve to "charge nothing, pay full gross". A
///         direct (non-delegatecall) call runs against this contract's own
///         empty storage and it holds no funds, so it is an inert no-op.
contract BorrowerExitPerimeterOps is State, IPerimeterEvents {
    /// @notice Split a borrower-side exit payout into fee + net: quote,
    ///         validate, pay the fee leg, emit the audit event, and return the
    ///         amount the caller pays the user (the caller does the user-leg
    ///         payout on its own vault primitives).
    /// @param  surfaceId   Perimeter surface key (borrower-withdraw).
    /// @param  subProduct  Policy resolution key — the iToken proxy the loan
    ///                     was originated against (`loanLocal.lender`).
    /// @param  receiver    User payout recipient (logged in ExitFeeApplied).
    /// @param  payoutAsset Asset being paid; selects native vs ERC20 in the
    ///                     fee leg.
    /// @param  gross       Pre-fee borrower payout amount.
    /// @return toUser      `gross` minus a transferred fee, or full `gross` on
    ///                     any non-charging path.
    function chargeExitFeeAndPay(
        bytes32 surfaceId,
        address subProduct,
        address receiver,
        address payoutAsset,
        uint256 gross
    ) public returns (uint256 toUser) {
        if (gross == 0) return 0;

        IExitFeeController.ExitFeeQuote memory q = PerimeterLib.safeQuote(
            PerimeterLib.getController(),
            surfaceId,
            subProduct,
            msg.sender,
            gross
        );

        if (q.active && q.feeAmount > 0) {
            if (!PerimeterLib.quoteIsValid(q, gross)) {
                emit ExitFeeSkipped(
                    surfaceId,
                    msg.sender,
                    payoutAsset,
                    gross,
                    q.rateBps,
                    uint8(IExitFeeController.SkipReason.INVALID_QUOTE)
                );
                return gross;
            }
            bool feeOk = _payExitFeeLeg(q.feeReceiver, payoutAsset, q.feeAmount);
            if (feeOk) {
                emit ExitFeeApplied(
                    surfaceId,
                    msg.sender,
                    payoutAsset,
                    subProduct,
                    receiver,
                    gross,
                    q.feeAmount,
                    q.netAmount,
                    q.feeReceiver
                );
                return q.netAmount;
            }
            emit ExitFeeSkipped(
                surfaceId,
                msg.sender,
                payoutAsset,
                gross,
                q.rateBps,
                uint8(IExitFeeController.SkipReason.VAULT_REVERT)
            );
            return gross;
        }
        emit ExitFeeSkipped(surfaceId, msg.sender, payoutAsset, gross, q.rateBps, q.reason);
        return gross;
    }

    /// @notice Fail-open fee-leg transfer: returns false on any transfer
    ///         failure instead of reverting, so the caller can fall back to a
    ///         full-gross payout.
    ///         - Native (asset == wrbtcToken): unwrap, low-level `call.value`;
    ///           on failure re-wrap so no native residue remains.
    ///         - ERC20: low-level `transfer` with a length-gated bool decode.
    function _payExitFeeLeg(
        address receiver,
        address asset,
        uint256 amount
    ) internal returns (bool) {
        if (amount == 0) return true;
        if (asset == address(wrbtcToken)) {
            uint256 balance = address(this).balance;
            if (amount > balance) {
                wrbtcToken.withdraw(amount - balance);
            }
            (bool ok, ) = receiver.call.value(amount)("");
            if (ok) return true;
            // Re-wrap on failure: native back into WRBTC, no orphan native,
            // no WRBTC underflow against the protocol's vault accounting.
            wrbtcToken.deposit.value(amount)();
            return false;
        }
        (bool ok, bytes memory ret) = asset.call(
            abi.encodeWithSelector(IERC20(asset).transfer.selector, receiver, amount)
        );
        if (!ok) return false;
        if (ret.length == 0) return true;
        if (ret.length != 32) return false;
        return abi.decode(ret, (bool));
    }
}
