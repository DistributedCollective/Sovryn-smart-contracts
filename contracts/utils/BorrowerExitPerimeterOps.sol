// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../mixins/VaultController.sol";
import "../interfaces/perimeter/IExitFeeController.sol";
import "../interfaces/perimeter/IExitDelayQueueHook.sol";
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
contract BorrowerExitPerimeterOps is VaultController, IPerimeterEvents {
    /// @dev The literal is the surface id: its keccak hash is the key the
    ///      controller resolves a rate policy under. Changing the string
    ///      changes the id, so a policy must be configured against the new
    ///      hash before this surface can charge.
    /// keccak256("PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW")
    bytes32 internal constant PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW =
        keccak256("PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW");

    /// @notice A resolved borrower-exit delay leg, bundled to keep the reroute
    ///         off the stack (0.5.17 stack-depth limit). `token == address(0)` is
    ///         the native (measured-receipt) leg; otherwise the ERC20
    ///         (measured-delta) leg. `effOrig`/`effOwner` are the effective
    ///         identities from the up-front quote (raw for this no-passthrough
    ///         surface); `subProduct` is the iToken pool.
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

    /// @notice Escrow the (post-fee) borrower-exit user leg into the queue.
    ///         PUSH-then-record via the `sovrynProtocol` singleton (the registered
    ///         allowed source): the vault primitive sends `toUser` to the queue and
    ///         the queue credits it via measured-delta.
    ///
    ///         Called ONLY once the caller has resolved a delay (`d > 0`), so the
    ///         queue is never touched on a direct-pay exit. Runs under
    ///         `delegatecall` in the protocol proxy's context, so the vault
    ///         primitives spend protocol balances. FAIL-CLOSED throughout: an
    ///         unresolvable queue or a rejected record reverts, and the caller
    ///         propagates that so the whole exit reverts.
    /// @param  subProduct  Policy resolution key — the iToken proxy the loan was
    ///                     originated against (`loanLocal.lender`).
    /// @param  assetToken  Withdraw token (address == wrbtcToken ⇒ native leg).
    /// @param  receiver    Immutable payout destination.
    /// @param  toUser      Net (post-fee) borrower payout amount.
    /// @param  d           Delay in seconds, already resolved by the caller.
    /// @param  effOrig     Effective originator from the caller's quote.
    /// @param  effOwner    Effective owner from the caller's quote.
    /// @return escrowed    Always true; a failure reverts instead.
    function escrowBorrowerExit(
        address subProduct,
        address assetToken,
        address receiver,
        uint256 toUser,
        uint32 d,
        address effOrig,
        address effOwner
    ) public returns (bool escrowed) {
        DelayLeg memory leg;
        leg.receiver = receiver;
        leg.toUser = toUser;
        leg.subProduct = subProduct;
        leg.d = d;
        leg.effOrig = effOrig;
        leg.effOwner = effOwner;

        leg.queue = PerimeterLib.getExitDelayQueue();
        require(leg.queue != address(0), "PERIMETER:queue-unset");

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

    /// @notice Record a borrower-exit user leg into the queue AFTER the caller has
    ///         PUSHED `toUser` to it (measured-delta ingress). The queue measures
    ///         the non-backing surplus, requires it `>= toUser`, and credits
    ///         EXACTLY `toUser` — so a stray donation can never brick the record.
    function _recordBorrowerExitToQueue(DelayLeg memory leg) internal {
        require(leg.toUser <= uint256(uint128(-1)), "PERIMETER:amount-too-large");
        if (leg.token == address(0)) {
            IExitDelayQueueHook(leg.queue).recordReceivedNativeExit(
                uint128(leg.toUser),
                leg.d,
                PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW,
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
                PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW,
                leg.subProduct,
                leg.effOrig,
                leg.effOwner,
                leg.receiver
            );
        }
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
