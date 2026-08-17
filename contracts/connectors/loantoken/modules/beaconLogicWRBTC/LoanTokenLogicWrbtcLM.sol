// SPDX-License-Identifier: MIT

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../LoanTokenLogicSplit.sol";
import "../../../../interfaces/colfee/IExitDelayQueueHook.sol";

contract LoanTokenLogicWrbtcLM is LoanTokenLogicSplit {
    /**
     * @notice This function is MANDATORY, which will be called by LoanTokenLogicBeacon and be registered.
     * Every new public function, the signature needs to be included in this function.
     *
     * @dev This function will return the list of function signature in this contract that are available for public call
     * Then this function will be called by LoanTokenLogicBeacon, and the function signatures will be registred in LoanTokenLogicBeacon.
     * @dev To save the gas we can just directly return the list of function signature from this pure function.
     * The other workaround (fancy way) is we can create a storage for the list of the function signature, and then we can store each function signature to that storage from the constructor.
     * Then, in this function we just need to return that storage variable.
     *
     * @return The list of function signatures (bytes4[])
     */
    function getListFunctionSignatures()
        external
        pure
        returns (bytes4[] memory functionSignatures, bytes32 moduleName)
    {
        bytes4[] memory res = new bytes4[](6);

        // Loan Token Mint and Burn.
        res[0] = this.mint.selector;
        res[1] = this.burn.selector;

        // Loan Token WRBTC
        res[2] = this.mintWithBTC.selector;
        res[3] = this.burnToBTC.selector;

        // ColFee controller view. Manual keccak256 for selector stability
        // under overloaded names.
        res[4] = bytes4(keccak256("exitFeeController()"));

        // Security-perimeter delay-queue view.
        res[5] = bytes4(keccak256("exitDelayQueue()"));

        return (res, stringToBytes32("LoanTokenLogicWrbtcLM"));
    }

    function mintWithBTC(
        address receiver,
        bool useLM
    ) external payable nonReentrant globallyNonReentrant returns (uint256 mintAmount) {
        if (useLM) return _mintWithLM(receiver, msg.value);
        else return _mintToken(receiver, msg.value);
    }

    /// @return loanAmountPaid The GROSS amount of underlying redeemed (paid out
    ///         as native RBTC). When a ColFee exit-fee policy is active the
    ///         receiver is paid this amount minus the fee (split published in
    ///         `ExitFeeApplied`) — do not treat the return value as the amount
    ///         received.
    function burnToBTC(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external nonReentrant globallyNonReentrant returns (uint256 loanAmountPaid) {
        loanAmountPaid = useLM ? _burnFromLM(burnAmount) : _burnToken(burnAmount);
        // ColFee: native-RBTC payout path (charge + unwrap + send).
        _chargeExitFeeAndPayAsNative(receiver, loanAmountPaid);
    }

    /// @notice ColFee charge for the native-RBTC burn path: every leg pays out
    ///         as native RBTC via `_transferNativeRBTC`.
    function _chargeExitFeeAndPayAsNative(address receiver, uint256 gross) internal {
        if (gross == 0) return;

        IExitFeeController.ExitFeeQuote memory q = _safeQuoteExitFee(
            SURFACE_LENDING_LENDER_WITHDRAW,
            address(this),
            msg.sender,
            gross
        );

        if (q.active && q.feeAmount > 0) {
            if (!_exitFeeQuoteIsValid(q, gross)) {
                emit ExitFeeSkipped(
                    SURFACE_LENDING_LENDER_WITHDRAW,
                    msg.sender,
                    loanTokenAddress,
                    gross,
                    q.rateBps,
                    uint8(IExitFeeController.SkipReason.INVALID_QUOTE)
                );
            } else {
                bool feeOk = _transferNativeRBTC(q.feeReceiver, q.feeAmount, true);
                if (feeOk) {
                    emit ExitFeeApplied(
                        SURFACE_LENDING_LENDER_WITHDRAW,
                        msg.sender,
                        loanTokenAddress,
                        address(this),
                        receiver,
                        gross,
                        q.feeAmount,
                        q.netAmount,
                        q.feeReceiver
                    );
                    // USER leg (net): reroute WRBTC into the delay queue when
                    // d > 0 (queue unwraps at delivery), else the existing native
                    // primitive (WRBTC escrow, deferred unwrap).
                    _payExitUserLegNative(receiver, q.netAmount);
                    return;
                }
                emit ExitFeeSkipped(
                    SURFACE_LENDING_LENDER_WITHDRAW,
                    msg.sender,
                    loanTokenAddress,
                    gross,
                    q.rateBps,
                    uint8(IExitFeeController.SkipReason.VAULT_REVERT)
                );
            }
        } else {
            emit ExitFeeSkipped(
                SURFACE_LENDING_LENDER_WITHDRAW,
                msg.sender,
                loanTokenAddress,
                gross,
                q.rateBps,
                q.reason
            );
        }
        // Full-gross fallback site: reroute behind the delay too.
        _payExitUserLegNative(receiver, gross);
    }

    /// @notice Pay the native (RBTC) user leg of the `burnToBTC` exit, rerouting
    ///         into the ExitDelayQueue when the perimeter imposes a delay
    ///         (`d > 0`): the queue escrows WRBTC and unwraps it on delivery.
    ///         The iToken STILL holds WRBTC at this point (the unwrap is
    ///         deferred to `executeExit`), so the delayed user leg transfers
    ///         WRBTC to the queue with `unwrapOnDelivery=true` and
    ///         `_transferNativeRBTC` is SKIPPED on the delayed leg. The fee leg
    ///         is unchanged (native, fail-open, re-wrap on failure). When
    ///         `d == 0` this is the existing native primitive, paid direct.
    /// @param receiver   Immutable payout destination.
    /// @param userAmount Net on fee-success, full gross on fee-failure.
    function _payExitUserLegNative(address receiver, uint256 userAmount) internal {
        if (userAmount == 0) return;

        // owner == rawOriginator == msg.sender (see `_payExitUserLeg`): the
        // burner is both the withdrawal originator and the position owner.
        (uint32 d, address effOrig, address effOwner) = _safeQuoteExitDelay(
            msg.sender,
            msg.sender,
            receiver,
            SURFACE_LENDING_LENDER_WITHDRAW,
            address(this)
        );

        if (d > 0) {
            require(userAmount <= uint256(uint128(-1)), "COLFEE:amount-too-large");
            address queue = exitDelayQueue();
            require(queue != address(0), "COLFEE:queue-unset");
            // Escrow WRBTC (NOT native): the iToken hands the queue WRBTC + the
            // unwrap flag; the queue unwraps to native RBTC at executeExit. No
            // `_transferNativeRBTC` on this delayed user leg. Use the shared
            // optional-return `_safeApprove`: WRBTC returns a bool today,
            // but this keeps BOTH exit-leg approve sites on one no-return-safe
            // primitive. Allowance is provably 0 at entry (queue pulls exactly
            // `userAmount`), so no zero-first reset is needed.
            _safeApprove(wrbtcTokenAddress, queue, userAmount);
            IExitDelayQueueHook(queue).recordERC20Exit(
                wrbtcTokenAddress,
                uint128(userAmount),
                d,
                SURFACE_LENDING_LENDER_WITHDRAW,
                address(this),
                effOrig,
                effOwner,
                receiver,
                true // unwrapOnDelivery: queue holds WRBTC, unwraps at delivery
            );
        } else {
            _transferNativeRBTC(receiver, userAmount, false);
        }
    }

    /// @notice Unwrap WRBTC and send native RBTC.
    ///         nonBlocking=true  → low-level call; on failure re-wrap the
    ///                              withdrawn native back into WRBTC and return
    ///                              false (fee leg).
    ///         nonBlocking=false → `Address.sendValue`, reverts on failure
    ///                              (user leg).
    function _transferNativeRBTC(
        address to,
        uint256 amount,
        bool nonBlocking
    ) internal returns (bool) {
        if (amount == 0) return true;
        IWrbtcERC20(wrbtcTokenAddress).withdraw(amount);
        if (nonBlocking) {
            (bool ok, ) = to.call.value(amount)("");
            if (ok) return true;
            // Re-wrap on failure: native back into WRBTC, no residue in the iToken.
            IWrbtc(wrbtcTokenAddress).deposit.value(amount)();
            return false;
        }
        Address.sendValue(address(uint160(to)), amount);
        return true;
    }
}
