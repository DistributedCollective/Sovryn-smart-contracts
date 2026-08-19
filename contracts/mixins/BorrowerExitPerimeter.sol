pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./ModuleCommonFunctionalities.sol";
import "./VaultController.sol";
import "../interfaces/perimeter/IExitFeeController.sol";
import "../utils/PerimeterLib.sol";
import "../utils/BorrowerExitPerimeterOps.sol";

/// @title  BorrowerExitPerimeter
/// @notice Protocol-side Perimeter borrower-exit helpers (the close-origin gate,
///         the charge-hook stub, and the security-perimeter delay reroute),
///         inherited by the modules that charge a borrower exit. Adds no storage.
/// @dev    Inherits `VaultController` so the delay reroute can PUSH the user leg
///         into the queue via the same `vaultWithdraw`/`vaultEtherWithdraw`
///         primitives the direct payout uses. Both consuming modules
///         (`LoanMaintenance`, `LoanClosingsShared`) already list `VaultController`
///         BEFORE `BorrowerExitPerimeter`, so C3 linearization is preserved and no
///         storage layout shifts (both derive from the same shared `State`).
contract BorrowerExitPerimeter is ModuleCommonFunctionalities, VaultController {
    /// @dev The literal is the surface id: its keccak hash is the key the
    ///      controller resolves a rate policy under. Changing the string
    ///      changes the id, so a policy must be configured against the new
    ///      hash before this surface can charge.
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

    /// @notice The ExitDelayQueue pinned on the protocol singleton (address(0)
    ///         until governance pins one ⇒ the security-perimeter reroute is
    ///         unwired ⇒ borrower exits pay direct). Reads the shared slot on the
    ///         protocol proxy's own storage — no cross-contract call — because the
    ///         borrower/margin modules ALREADY run in the protocol singleton
    ///         context (the registered allowed source for these records).
    function exitDelayQueue() public view returns (address queue) {
        return PerimeterLib.getExitDelayQueue();
    }

    /// @notice Reroute the (post-fee) borrower-exit user leg into the queue when
    ///         the perimeter imposes a delay, returning whether it was escrowed.
    ///         The caller pays the user leg directly iff this returns false.
    ///
    ///         The delay QUOTE is resolved here, reading the controller pointer
    ///         directly, so the perimeter's decision never depends on the
    ///         charge-hook pointer. Only the escrow itself — queue lookup, push
    ///         and record — runs in the deployed `BorrowerExitPerimeterOps` via
    ///         `delegatecall`, in this proxy's context and the SAME outer
    ///         transaction, so a record revert rolls back the push.
    ///
    ///         FAIL-CLOSED once a delay is established: with `d > 0` an
    ///         unreachable or reverting hook reverts the exit rather than paying
    ///         direct, so an imposed delay can never be skipped. With `d == 0`
    ///         the hook is never called.
    /// @param loanLocal  The loan being closed (owner = `borrower`,
    ///                   subProduct = `lender`).
    /// @param assetToken Withdraw token (address == wrbtcToken ⇒ native leg).
    /// @param receiver   Immutable payout destination.
    /// @param toUser     Net (post-fee) borrower payout amount.
    /// @return delayed   True iff the amount was escrowed into the queue.
    function _maybeDelayBorrowerExit(
        Loan storage loanLocal,
        address assetToken,
        address receiver,
        uint256 toUser
    ) internal returns (bool delayed) {
        if (toUser == 0) return false;

        // rawOriginator = entry-point msg.sender (borrower or delegated manager),
        // owner = loanLocal.borrower, no passthrough on this surface.
        (uint32 d, address effOrig, address effOwner) = PerimeterLib.safeQuoteDelay(
            PerimeterLib.getController(),
            msg.sender,
            loanLocal.borrower,
            receiver,
            PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW,
            loanLocal.lender
        );
        if (d == 0) return false; // queue untouched (liveness)

        (bool ok, bytes memory ret) = PerimeterLib.getBorrowerExitOps().delegatecall(
            abi.encodeWithSelector(
                BorrowerExitPerimeterOps(address(0)).escrowBorrowerExit.selector,
                loanLocal.lender,
                assetToken,
                receiver,
                toUser,
                d,
                effOrig,
                effOwner
            )
        );
        if (!ok) {
            // Propagate the hook's revert reason unchanged.
            assembly {
                revert(add(ret, 0x20), mload(ret))
            }
        }
        // An unset or code-less hook returns no data; a delay is established, so
        // this must not fall through to a direct payout.
        require(ret.length == 32, "PERIMETER:exit-ops-unset");
        return abi.decode(ret, (bool));
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
