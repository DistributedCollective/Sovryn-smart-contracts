pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./ModuleCommonFunctionalities.sol";
import "../interfaces/perimeter/IExitFeeController.sol";
import "../utils/PerimeterLib.sol";
import "../utils/BorrowerExitPerimeterOps.sol";

/// @title  BorrowerExitPerimeter
/// @notice Protocol-side Perimeter borrower-exit helpers (the close-origin gate
///         and the charge-hook stub), inherited by the modules that charge a
///         borrower exit. Adds no storage.
contract BorrowerExitPerimeter is ModuleCommonFunctionalities {
    /// keccak256("PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW")
    bytes32 internal constant PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW =
        keccak256("PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW");

    /// @notice Origin of a position close, threaded from the public entry
    ///         points to gate the exit fee. Only `VoluntaryClose` is
    ///         chargeable; `Rollover` and `Liquidation` are exempt.
    enum CloseOrigin {
        VoluntaryClose,
        Rollover,
        Liquidation
    }

    /// @notice Quote the borrower-exit fee from the pinned controller
    ///         (fail-open). Reads the controller from the shared slot.
    function _safeQuoteExitFee(
        bytes32 surfaceId,
        address subProduct,
        address actor,
        uint256 gross
    ) internal view returns (IExitFeeController.ExitFeeQuote memory q) {
        return
            PerimeterLib.safeQuote(
                PerimeterLib.getController(),
                surfaceId,
                subProduct,
                actor,
                gross
            );
    }

    /// @notice Whether a borrower-side close should be charged the exit fee:
    ///         true only for a borrower-/delegate-initiated `VoluntaryClose`.
    ///         Rollover and liquidation are exempt by origin. Shared by the swap
    ///         and deposit close paths.
    /// @param origin     Close origin threaded from the public entry point.
    /// @param loanLocal  The loan being closed (for the actor identity check).
    function _exitFeeChargeable(
        CloseOrigin origin,
        Loan storage loanLocal
    ) internal view returns (bool) {
        if (origin != CloseOrigin.VoluntaryClose) return false;
        return msg.sender == loanLocal.borrower || delegatedManagers[loanLocal.id][msg.sender];
    }

    /// @notice Charge the borrower-exit fee and return the amount to pay the
    ///         user; the caller does the user-leg payout on its own vault
    ///         primitives. Stub over the charge hook: the body runs in the
    ///         deployed `BorrowerExitPerimeterOps` (address from the shared slot)
    ///         via `delegatecall`. Fail-open: an unset/non-contract pointer or
    ///         any revert in the hook yields non-32-byte returndata → full
    ///         gross, with the hook's fee transfer and events rolled back
    ///         atomically.
    /// @param receiver    User payout recipient (logged in ExitFeeApplied).
    /// @param payoutAsset Asset being paid; selects native vs ERC20 in the
    ///                    fee leg.
    /// @param subProduct  Policy resolution key — the iToken proxy the loan was
    ///                    originated against (`loanLocal.lender`).
    /// @param gross       Pre-fee borrower payout amount.
    /// @return toUser     `gross` minus a transferred fee, or full `gross` on
    ///                    any non-charging path.
    function _chargeExitFeeReturnNet(
        address receiver,
        address payoutAsset,
        address subProduct,
        uint256 gross
    ) internal returns (uint256) {
        (bool ok, bytes memory ret) = PerimeterLib.getBorrowerExitOps().delegatecall(
            abi.encodeWithSelector(
                BorrowerExitPerimeterOps(address(0)).chargeExitFeeAndPay.selector,
                PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW,
                subProduct,
                receiver,
                payoutAsset,
                gross
            )
        );
        if (ok && ret.length == 32) {
            uint256 toUser = abi.decode(ret, (uint256));
            // Defensive bound: the hook can only ever deduct, never inflate.
            if (toUser <= gross) return toUser;
        }
        // Fail-open: non-32-byte returndata (unset pointer or hook revert) ->
        // pay full gross.
        return gross;
    }
}
