pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./ModuleCommonFunctionalities.sol";
import "./VaultController.sol";
import "../interfaces/colfee/IExitFeeController.sol";
import "../interfaces/colfee/IExitDelayQueueHook.sol";
import "../utils/ColFeeLib.sol";
import "../utils/ColFeeBorrowerExitOps.sol";

/// @title  ColFeeBorrowerExit
/// @notice Protocol-side ColFee borrower-exit helpers (the close-origin gate,
///         the charge-hook stub, and the security-perimeter delay reroute),
///         inherited by the modules that charge a borrower exit. Adds no storage.
/// @dev    Inherits `VaultController` so the delay reroute can PUSH the user leg
///         into the queue via the same `vaultWithdraw`/`vaultEtherWithdraw`
///         primitives the direct payout uses. Both consuming modules
///         (`LoanMaintenance`, `LoanClosingsShared`) already list `VaultController`
///         BEFORE `ColFeeBorrowerExit`, so C3 linearization is preserved and no
///         storage layout shifts (both derive from the same shared `State`).
contract ColFeeBorrowerExit is ModuleCommonFunctionalities, VaultController {
    /// keccak256("COLFEE:SURFACE_LENDING_BORROWER_WITHDRAW")
    bytes32 internal constant SURFACE_LENDING_BORROWER_WITHDRAW =
        keccak256("COLFEE:SURFACE_LENDING_BORROWER_WITHDRAW");

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
        return ColFeeLib.safeQuote(ColFeeLib.getController(), surfaceId, subProduct, actor, gross);
    }

    /// @notice The ExitDelayQueue pinned on the protocol singleton (address(0)
    ///         until governance pins one ⇒ the security-perimeter reroute is
    ///         unwired ⇒ borrower exits pay direct). Reads the shared slot on the
    ///         protocol proxy's own storage — no cross-contract call — because the
    ///         borrower/margin modules ALREADY run in the protocol singleton
    ///         context (the registered allowed source for these records).
    function exitDelayQueue() public view returns (address queue) {
        return ColFeeLib.getExitDelayQueue();
    }

    /// @notice Fail-CLOSED delay quote for the borrower-withdraw surface.
    ///         Borrower/margin has NO passthrough, so `effOrig`/`effOwner`
    ///         come back as the raw identities; the record uses them as-is.
    function _safeQuoteExitDelayBorrower(
        address rawOriginator,
        address owner,
        address receiver,
        address subProduct
    ) internal view returns (uint32 d, address effOrig, address effOwner) {
        return
            ColFeeLib.safeQuoteDelay(
                ColFeeLib.getController(),
                rawOriginator,
                owner,
                receiver,
                SURFACE_LENDING_BORROWER_WITHDRAW,
                subProduct
            );
    }

    /// @notice A resolved borrower-exit delay leg, bundled to keep the reroute
    ///         off the stack (0.5.17 stack-depth limit). `token == address(0)` is
    ///         the native (measured-receipt) leg; otherwise the ERC20
    ///         (measured-delta) leg. `effOrig`/`effOwner` are the effective
    ///         identities from the up-front quote (raw for this no-passthrough
    ///         surface); `subProduct` is the iToken pool (loanLocal.lender).
    struct DelayLeg {
        address queue;
        address token;
        uint256 toUser;
        uint32 d;
        address effOrig;
        address effOwner;
        address receiver;
        address subProduct;
    }

    /// @notice Record a borrower-exit user leg into the queue AFTER the caller has
    ///         PUSHED `toUser` to it (measured-delta ingress). The caller
    ///         (`LoanClosings*` / `LoanMaintenance`) runs in the `sovrynProtocol`
    ///         singleton context, which is the registered allowed source, so
    ///         `msg.sender` at the queue is that singleton. The queue measures the
    ///         non-backing surplus, requires it `>= toUser`, and credits EXACTLY
    ///         `toUser` — so a stray donation can never brick the record.
    ///
    ///         MUST be called only when `d > 0` (queue untouched otherwise)
    ///         and only after the matching push in the SAME outer transaction, so a
    ///         record revert rolls back the push (fail-closed).
    function _recordBorrowerExitToQueue(DelayLeg memory leg) internal {
        require(leg.toUser <= uint256(uint128(-1)), "COLFEE:amount-too-large");
        if (leg.token == address(0)) {
            IExitDelayQueueHook(leg.queue).recordReceivedNativeExit(
                uint128(leg.toUser),
                leg.d,
                SURFACE_LENDING_BORROWER_WITHDRAW,
                leg.subProduct,
                leg.effOrig,
                leg.effOwner,
                leg.receiver
            );
        } else {
            IExitDelayQueueHook(leg.queue).recordReceivedERC20Exit(
                leg.token,
                uint128(leg.toUser),
                leg.d,
                SURFACE_LENDING_BORROWER_WITHDRAW,
                leg.subProduct,
                leg.effOrig,
                leg.effOwner,
                leg.receiver
            );
        }
    }

    /// @notice Reroute the (post-fee) borrower-exit user leg into the queue when
    ///         the perimeter imposes a delay (`d > 0`), returning whether it was
    ///         escrowed. PUSH-then-record via the `sovrynProtocol` singleton (the
    ///         registered allowed source): the vault primitive sends `toUser`
    ///         to the queue and the queue credits it via measured-delta. The queue
    ///         is NEVER touched until `d > 0` is established off-queue.
    ///
    ///         MUST be called only on the chargeable (voluntary) path. The
    ///         caller pays the user leg directly (its existing primitive) iff this
    ///         returns false. Both the push and the record sit in the SAME outer
    ///         transaction, so a record revert rolls back the push (fail-closed).
    /// @param loanLocal  The loan being closed (owner = loanLocal.borrower;
    ///                   subProduct = loanLocal.lender).
    /// @param assetToken Withdraw token (address == wrbtcToken ⇒ native leg).
    /// @param receiver   Immutable payout destination.
    /// @param toUser     Net (post-fee) borrower payout amount.
    /// @return delayed   True iff the amount was escrowed into the queue (the
    ///                   caller must then NOT also pay it out directly).
    function _maybeDelayBorrowerExit(
        Loan storage loanLocal,
        address assetToken,
        address receiver,
        uint256 toUser
    ) internal returns (bool delayed) {
        if (toUser == 0) return false;

        DelayLeg memory leg;
        leg.receiver = receiver;
        leg.toUser = toUser;
        leg.subProduct = loanLocal.lender;

        // rawOriginator = entry-point msg.sender (borrower or delegated manager),
        // owner = loanLocal.borrower, no passthrough.
        (leg.d, leg.effOrig, leg.effOwner) = _safeQuoteExitDelayBorrower(
            msg.sender,
            loanLocal.borrower,
            receiver,
            loanLocal.lender
        );

        if (leg.d == 0) return false; // queue untouched (liveness)

        leg.queue = exitDelayQueue();
        require(leg.queue != address(0), "COLFEE:queue-unset");

        // PUSH to the queue, then measured-record — both in the SAME outer tx, so
        // a record revert rolls back the push (fail-closed).
        if (assetToken == address(wrbtcToken)) {
            // native leg: unwrap WRBTC → native RBTC into the queue's receive().
            leg.token = address(0);
            vaultEtherWithdraw(leg.queue, toUser);
        } else {
            leg.token = assetToken;
            vaultWithdraw(assetToken, leg.queue, toUser);
        }
        _recordBorrowerExitToQueue(leg);
        return true;
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
    ///         deployed `ColFeeBorrowerExitOps` (address from the shared slot)
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
        (bool ok, bytes memory ret) = ColFeeLib.getBorrowerExitOps().delegatecall(
            abi.encodeWithSelector(
                ColFeeBorrowerExitOps(address(0)).chargeExitFeeAndPay.selector,
                SURFACE_LENDING_BORROWER_WITHDRAW,
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
