// SPDX-License-Identifier: MIT

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../LoanTokenLogicSplit.sol";

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
        bytes4[] memory res = new bytes4[](5);

        // Loan Token Mint and Burn.
        res[0] = this.mint.selector;
        res[1] = this.burn.selector;

        // Loan Token WRBTC
        res[2] = this.mintWithBTC.selector;
        res[3] = this.burnToBTC.selector;

        // Perimeter controller view. Manual keccak256 for selector stability
        // under overloaded names.
        res[4] = bytes4(keccak256("exitFeeController()"));

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
    ///         as native RBTC). When a Perimeter exit-fee policy is active the
    ///         receiver is paid this amount minus the fee (split published in
    ///         `ExitFeeApplied`) — do not treat the return value as the amount
    ///         received.
    function burnToBTC(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external nonReentrant globallyNonReentrant returns (uint256 loanAmountPaid) {
        loanAmountPaid = useLM ? _burnFromLM(burnAmount) : _burnToken(burnAmount);
        // Perimeter: native-RBTC payout path (charge + unwrap + send).
        _chargeExitFeeAndPayAsNative(receiver, loanAmountPaid);
    }

    /// @notice Perimeter charge for the native-RBTC burn path: every leg pays out
    ///         as native RBTC via `_transferNativeRBTC`.
    function _chargeExitFeeAndPayAsNative(address receiver, uint256 gross) internal {
        if (gross == 0) return;

        IExitFeeController.ExitFeeQuote memory q = _safeQuoteExitFee(
            PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
            address(this),
            msg.sender,
            gross
        );

        if (q.active && q.feeAmount > 0) {
            if (!_exitFeeQuoteIsValid(q, gross)) {
                emit ExitFeeSkipped(
                    PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
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
                        PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
                        msg.sender,
                        loanTokenAddress,
                        address(this),
                        receiver,
                        gross,
                        q.feeAmount,
                        q.netAmount,
                        q.feeReceiver
                    );
                    _transferNativeRBTC(receiver, q.netAmount, false);
                    return;
                }
                emit ExitFeeSkipped(
                    PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
                    msg.sender,
                    loanTokenAddress,
                    gross,
                    q.rateBps,
                    uint8(IExitFeeController.SkipReason.VAULT_REVERT)
                );
            }
        } else {
            emit ExitFeeSkipped(
                PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
                msg.sender,
                loanTokenAddress,
                gross,
                q.rateBps,
                q.reason
            );
        }
        _transferNativeRBTC(receiver, gross, false);
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
