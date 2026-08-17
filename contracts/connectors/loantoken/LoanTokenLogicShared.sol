pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./LoanTokenLogicStorage.sol";
import "./interfaces/ProtocolLike.sol";
import "./interfaces/FeedsLike.sol";
import "./interfaces/ProtocolSettingsLike.sol";
import "../../modules/interfaces/ProtocolAffiliatesInterface.sol";
import "../../farm/ILiquidityMining.sol";
import "../../governance/Staking/interfaces/IStaking.sol";
import "../../governance/Vesting/IVesting.sol";
import "../../interfaces/colfee/IExitFeeController.sol";
import "../../interfaces/colfee/IExitDelayQueueHook.sol";
import "../../interfaces/colfee/IColFeeEvents.sol";
import "../../utils/ColFeeLib.sol";

/**
 * @dev This contract shares functions used by both LoanTokenLogicSplit and LoanTokenLogicStandard
 */
contract LoanTokenLogicShared is LoanTokenLogicStorage, IColFeeEvents {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    /// DON'T ADD VARIABLES HERE, PLEASE
    /// ColFee keeps no state on the iToken; the controller is read from the
    /// protocol below.

    /// keccak256("COLFEE:SURFACE_LENDING_LENDER_WITHDRAW")
    bytes32 internal constant SURFACE_LENDING_LENDER_WITHDRAW =
        keccak256("COLFEE:SURFACE_LENDING_LENDER_WITHDRAW");

    /// @notice The ExitFeeController, read from the protocol via a fail-open
    ///         staticcall (zero until pinned — the burn then skips the fee).
    /// @return ctrl ExitFeeController address, or address(0).
    function exitFeeController() public view returns (address ctrl) {
        return ColFeeLib.safeControllerLookup(sovrynContractAddress);
    }

    /// @notice The ExitDelayQueue, read from the protocol singleton via a
    ///         fail-open staticcall (address(0) until governance pins one ⇒ the
    ///         security-perimeter reroute is unwired ⇒ the burn pays direct).
    ///         Mirrors `exitFeeController()`: a single protocol-side pointer that
    ///         every iToken reads through, so rotation is one Owner/SIP action.
    /// @return queue ExitDelayQueue address, or address(0).
    function exitDelayQueue() public view returns (address queue) {
        return ColFeeLib.safeQueueLookup(sovrynContractAddress);
    }

    /// @notice Fail-CLOSED delay quote for the lender-exit surface. A
    ///         quote failure reverts the exit; the disabled-perimeter case is a
    ///         healthy `d = 0` return from inside the controller (liveness).
    function _safeQuoteExitDelay(
        address rawOriginator,
        address owner,
        address receiver,
        bytes32 surfaceId,
        address subProduct
    ) internal view returns (uint32 d, address effOrig, address effOwner) {
        return
            ColFeeLib.safeQuoteDelay(
                exitFeeController(),
                rawOriginator,
                owner,
                receiver,
                surfaceId,
                subProduct
            );
    }

    /// @notice Pay the ERC20 user leg of a lender exit, rerouting into the
    ///         ExitDelayQueue when the security perimeter imposes a delay
    ///         (`d > 0`). Fee leg is UNCHANGED and already ran in the caller; this
    ///         only governs the USER leg's destination.
    ///
    ///         The quote is taken ONCE per exit and drives BOTH the net (fee-ok)
    ///         and the full-gross (fee-failed) payout sites, so a fee-vault
    ///         failure still escrows gross behind the delay and cannot bypass it.
    ///         The queue is NEVER touched until `d > 0` is established:
    ///         when `d == 0` this is the existing direct primitive, byte-identical
    ///         to today's behaviour.
    ///
    ///         Fail-open POINTER / fail-closed QUOTE split: the
    ///         controller-pointer read behind `_safeQuoteExitDelay`
    ///         (`exitFeeController()` → `ColFeeLib.safeControllerLookup`) is
    ///         FAIL-OPEN — an unset/unreachable pointer resolves to address(0),
    ///         yields `d == 0`, and pays direct (a missing pointer silently
    ///         disables the perimeter for this host rather than bricking the
    ///         exit on a botched module rotation). Once the controller IS
    ///         reachable the QUOTE stays FAIL-CLOSED: a reverting
    ///         `quoteExitDelayFor` reverts the whole exit, so an active
    ///         perimeter can never be bypassed. Accepted residual + monitoring:
    ///         see `ColFeeLib.safeControllerLookup`.
    /// @param receiver   Immutable payout destination (the burn's `receiver` arg).
    /// @param userAmount Net on fee-success, full gross on fee-failure.
    /// @param errorMsg   Revert reason for the direct fail-closed transfer.
    function _payExitUserLeg(
        address receiver,
        uint256 userAmount,
        string memory errorMsg
    ) internal {
        if (userAmount == 0) return;

        // owner == rawOriginator == msg.sender: `burn(receiver, amt)` burns the
        // CALLER's iTokens (the position/pool share), so the burner is both the
        // withdrawal originator and the position owner. The controller normalizes
        // a registered wrapper passthrough (→ receiver) for BOTH inside the quote.
        (uint32 d, address effOrig, address effOwner) = _safeQuoteExitDelay(
            msg.sender,
            msg.sender,
            receiver,
            SURFACE_LENDING_LENDER_WITHDRAW,
            address(this)
        );

        if (d > 0) {
            // fail-CLOSED escrow. Only now — with the delay path active — do we
            // touch the queue. Narrow guard is the caller's responsibility;
            // enforce it here before any escrow accounting.
            require(userAmount <= uint256(uint128(-1)), "COLFEE:amount-too-large");
            address queue = exitDelayQueue();
            require(queue != address(0), "COLFEE:queue-unset");
            // Pull path: approve the queue for exactly `userAmount`, then it
            // `safeTransferFrom`s and proves the received amount == amount.
            // Optional-return approve: `loanTokenAddress` is the iToken
            // UNDERLYING and MAY be a USDT-style no-return ERC20 (this repo
            // supports them via `_callOptionalReturn`/`_safeTransfer`). A raw
            // high-level `.approve()` would revert on such tokens and DoS every
            // delayed lender exit; `_safeApprove` tolerates the missing return.
            // Allowance is provably 0 at entry (the queue pulls EXACTLY
            // `userAmount`, returning the allowance to 0), so no zero-first
            // reset is needed.
            _safeApprove(loanTokenAddress, queue, userAmount);
            IExitDelayQueueHook(queue).recordERC20Exit(
                loanTokenAddress,
                uint128(userAmount),
                d,
                SURFACE_LENDING_LENDER_WITHDRAW,
                address(this),
                effOrig,
                effOwner,
                receiver,
                false // unwrapOnDelivery: this is the plain-ERC20 burn path
            );
        } else {
            // direct — the QUEUE IS NEVER TOUCHED (liveness). Existing
            // fail-closed user-payout primitive, unchanged from today.
            _transferUnderlyingToken(receiver, userAmount, false, errorMsg);
        }
    }

    /// @notice Quote the lender-exit fee from this iToken's controller
    ///         (fail-open).
    function _safeQuoteExitFee(
        bytes32 surfaceId,
        address subProduct,
        address actor,
        uint256 gross
    ) internal view returns (IExitFeeController.ExitFeeQuote memory q) {
        return ColFeeLib.safeQuote(exitFeeController(), surfaceId, subProduct, actor, gross);
    }

    /// @dev Defensive sanity-check on a quote returned by the (upgradable,
    ///      external) controller. Delegates to the shared invariant set in
    ///      `ColFeeLib.quoteIsValid`; failure routes to INVALID_QUOTE.
    function _exitFeeQuoteIsValid(
        IExitFeeController.ExitFeeQuote memory q,
        uint256 gross
    ) internal pure returns (bool) {
        return ColFeeLib.quoteIsValid(q, gross);
    }

    /// @notice Single ColFee-aware payout entry point for lender burn variants.
    ///         Charges (when policy active + non-zero fee AND the quote passes
    ///         defensive invariants) by transferring the fee leg to
    ///         `q.feeReceiver` (fail-open via nonBlocking=true) and the user
    ///         leg to `receiver` (fail-closed via nonBlocking=false).
    ///         On any non-charging path, pays the full `gross` to `receiver`.
    function _chargeExitFeeAndPay(
        address receiver,
        uint256 gross,
        string memory errorMsg
    ) internal {
        if (gross == 0) return;

        IExitFeeController.ExitFeeQuote memory q = _safeQuoteExitFee(
            SURFACE_LENDING_LENDER_WITHDRAW,
            address(this),
            msg.sender,
            gross
        );

        if (q.active && q.feeAmount > 0) {
            if (!_exitFeeQuoteIsValid(q, gross)) {
                // Trust-but-verify: controller said charge but quote is bogus.
                // Skip the fee leg, pay full gross, advertise the reason.
                emit ExitFeeSkipped(
                    SURFACE_LENDING_LENDER_WITHDRAW,
                    msg.sender,
                    loanTokenAddress,
                    gross,
                    q.rateBps,
                    uint8(IExitFeeController.SkipReason.INVALID_QUOTE)
                );
            } else {
                bool feeOk = _transferUnderlyingToken(q.feeReceiver, q.feeAmount, true, "");
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
                    // USER leg (net): reroute into the delay queue when d > 0,
                    // else the existing fail-closed direct transfer.
                    _payExitUserLeg(receiver, q.netAmount, errorMsg);
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
        // Fallback to full-gross to user (covers !active, INVALID_QUOTE,
        // and fee-leg failure). Full-gross fallback site: reroute behind
        // the delay too, so a fee-vault failure cannot bypass the perimeter.
        _payExitUserLeg(receiver, gross, errorMsg);
    }

    /// @notice ERC20 transfer of `loanTokenAddress` shared by both ColFee legs.
    ///         nonBlocking=true  → returns false on any failure (fee leg).
    ///         nonBlocking=false → reverts via `_safeTransfer` with `errorMsg`
    ///                              (user leg); `errorMsg` is the caller's own
    ///                              revert reason.
    function _transferUnderlyingToken(
        address to,
        uint256 amount,
        bool nonBlocking,
        string memory errorMsg
    ) internal returns (bool) {
        if (amount == 0) return true;
        if (nonBlocking) {
            (bool ok, bytes memory ret) = loanTokenAddress.call(
                abi.encodeWithSelector(IERC20(loanTokenAddress).transfer.selector, to, amount)
            );
            if (!ok) return false;
            // USDT-style ERC20s return no value on success; treat as ok.
            // Anything other than a 32-byte canonical bool is non-standard
            // for our vetted underlyings — fail the fee leg open rather
            // than risk decoding into a surprising shape.
            if (ret.length == 0) return true;
            if (ret.length != 32) return false;
            return abi.decode(ret, (bool));
        }
        _safeTransfer(loanTokenAddress, to, amount, errorMsg);
        return true;
    }

    /**
     * @notice Update the user's checkpoint price and profit so far.
     * In this loan token contract, whenever some tokens are minted or burned,
     * the _updateCheckpoints() function is invoked to update the stats to
     * reflect the balance changes.
     *
     * @param _user The user address.
     * @param _oldBalance The user's previous balance.
     * @param _newBalance The user's updated balance.
     * @param _currentPrice The current loan token price.
     * */
    function _updateCheckpoints(
        address _user,
        uint256 _oldBalance,
        uint256 _newBalance,
        uint256 _currentPrice
    ) internal {
        /// @dev keccak256("iToken_ProfitSoFar")
        bytes32 slot = keccak256(abi.encodePacked(_user, iToken_ProfitSoFar));

        int256 _currentProfit;
        if (_newBalance == 0) {
            _currentPrice = 0;
        } else if (_oldBalance != 0) {
            _currentProfit = _profitOf(slot, _oldBalance, _currentPrice, checkpointPrices_[_user]);
        }

        assembly {
            sstore(slot, _currentProfit)
        }

        checkpointPrices_[_user] = _currentPrice;
    }

    /** INTERNAL FUNCTION */

    /**
     * @notice Transfer tokens, low level.
     * Checks allowance, updates sender and recipient balances
     * and updates checkpoints too.
     *
     * @param _from The tokens' owner.
     * @param _to The recipient of the tokens.
     * @param _value The amount of tokens sent.
     * @param _allowanceAmount The amount of tokens allowed to transfer.
     *
     * @return Success true/false.
     * */
    function _internalTransferFrom(
        address _from,
        address _to,
        uint256 _value,
        uint256 _allowanceAmount
    ) internal returns (bool) {
        if (_allowanceAmount != uint256(-1)) {
            allowed[_from][msg.sender] = _allowanceAmount.sub(_value, "14");
            /// @dev Allowance mapping update requires an event log
            emit AllowanceUpdate(_from, msg.sender, _allowanceAmount, allowed[_from][msg.sender]);
        }

        require(_to != address(0), "15");

        uint256 _balancesFrom = balances[_from];
        uint256 _balancesFromNew = _balancesFrom.sub(_value, "16");
        balances[_from] = _balancesFromNew;

        uint256 _balancesTo = balances[_to];
        uint256 _balancesToNew = _balancesTo.add(_value);
        balances[_to] = _balancesToNew;

        /// @dev Handle checkpoint update.
        uint256 _currentPrice = tokenPrice();

        //checkpoints are not being used by the smart contract logic itself, but just for external use (query the profit)
        //only update the checkpoints of a user if he's not depositing to / withdrawing from the lending pool
        if (_from != liquidityMiningAddress && _to != liquidityMiningAddress) {
            _updateCheckpoints(_from, _balancesFrom, _balancesFromNew, _currentPrice);
            _updateCheckpoints(_to, _balancesTo, _balancesToNew, _currentPrice);
        }

        emit Transfer(_from, _to, _value);
        return true;
    }

    /**
     * @notice Profit calculation based on checkpoints of price.
     * @param slot The user slot.
     * @param _balance The user balance.
     * @param _currentPrice The current price of the loan token.
     * @param _checkpointPrice The price of the loan token on checkpoint.
     * @return The profit of a user.
     * */
    function _profitOf(
        bytes32 slot,
        uint256 _balance,
        uint256 _currentPrice,
        uint256 _checkpointPrice
    ) internal view returns (int256 profitSoFar) {
        if (_checkpointPrice == 0) {
            return 0;
        }

        assembly {
            profitSoFar := sload(slot)
        }

        profitSoFar = int256(_currentPrice)
            .sub(int256(_checkpointPrice))
            .mul(int256(_balance))
            .div(sWEI_PRECISION)
            .add(profitSoFar);
    }

    /**
     * @notice Loan token price calculation considering unpaid interests.
     * @return The loan token price.
     * */
    function tokenPrice() public view returns (uint256 price) {
        uint256 interestUnPaid;
        if (lastSettleTime_ != uint88(block.timestamp)) {
            (, interestUnPaid) = _getAllInterest();
        }

        return _tokenPrice(_totalAssetSupply(interestUnPaid));
    }

    /**
     * @notice Get the total amount of loan tokens on debt.
     * Calls protocol getTotalPrincipal function.
     * In the context of borrowing, principal is the initial size of a loan.
     * It can also be the amount still owed on a loan. If you take out a
     * $50,000 mortgage, for example, the principal is $50,000. If you pay off
     * $30,000, the principal balance now consists of the remaining $20,000.
     *
     * @return The total amount of loan tokens on debt.
     * */
    function totalAssetBorrow() public view returns (uint256) {
        return
            ProtocolLike(sovrynContractAddress).getTotalPrincipal(address(this), loanTokenAddress);
    }

    /** INTERNAL FUNCTION */

    /**
     * @notice .
     *
     * @param collateralTokenAddress The address of the token to be used as
     *   collateral. Cannot be the loan token address.
     * @param sentAddresses The addresses to send tokens: lender, borrower,
     *   receiver and manager.
     * @param sentAmounts The amounts to send to each address.
     * @param withdrawalAmount The amount of tokens to withdraw.
     *
     * @return msgValue The amount of rBTC sent minus the collateral on tokens.
     * */
    function _verifyTransfers(
        address collateralTokenAddress,
        MarginTradeStructHelpers.SentAddresses memory sentAddresses,
        MarginTradeStructHelpers.SentAmounts memory sentAmounts,
        uint256 withdrawalAmount
    ) internal returns (uint256 msgValue) {
        address _wrbtcToken = wrbtcTokenAddress;
        address _loanTokenAddress = loanTokenAddress;
        uint256 newPrincipal = sentAmounts.newPrincipal;
        uint256 loanTokenSent = sentAmounts.loanTokenSent;
        uint256 collateralTokenSent = sentAmounts.collateralTokenSent;

        require(_loanTokenAddress != collateralTokenAddress, "26");

        msgValue = msg.value;

        if (withdrawalAmount != 0) {
            /// withdrawOnOpen == true
            _safeTransfer(_loanTokenAddress, sentAddresses.receiver, withdrawalAmount, "");
            if (newPrincipal > withdrawalAmount) {
                _safeTransfer(
                    _loanTokenAddress,
                    sovrynContractAddress,
                    newPrincipal - withdrawalAmount,
                    ""
                );
            }
        } else {
            _safeTransfer(_loanTokenAddress, sovrynContractAddress, newPrincipal, "27");
        }
        /**
         * This is a critical piece of code!
         * rBTC are supposed to be held by the contract itself, while other tokens are being transfered from the sender directly.
         * */
        if (collateralTokenSent != 0) {
            if (
                collateralTokenAddress == _wrbtcToken &&
                msgValue != 0 &&
                msgValue >= collateralTokenSent
            ) {
                IWrbtc(_wrbtcToken).deposit.value(collateralTokenSent)();
                _safeTransfer(
                    collateralTokenAddress,
                    sovrynContractAddress,
                    collateralTokenSent,
                    "28-a"
                );
                msgValue -= collateralTokenSent;
            } else {
                _safeTransferFrom(
                    collateralTokenAddress,
                    msg.sender,
                    sovrynContractAddress,
                    collateralTokenSent,
                    "28-b"
                );
            }
        }

        if (loanTokenSent != 0) {
            _safeTransferFrom(
                _loanTokenAddress,
                msg.sender,
                sovrynContractAddress,
                loanTokenSent,
                "29"
            );
        }
    }

    /**
     * @notice Withdraw loan token interests from protocol.
     * This function only operates once per block.
     * It asks protocol to withdraw accrued interests for the loan token.
     *
     * @dev Internal sync required on every loan trade before starting.
     * */
    function _settleInterest() internal {
        uint88 ts = uint88(block.timestamp);
        if (lastSettleTime_ != ts) {
            ProtocolLike(sovrynContractAddress).withdrawAccruedInterest(loanTokenAddress);

            lastSettleTime_ = ts;
        }
    }

    /**
     * @notice Imitate a Solidity high-level call (i.e. a regular function
     * call to a contract), relaxing the requirement on the return value:
     * the return value is optional (but if data is returned, it must not be
     * false).
     *
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     * @param errorMsg The error message on failure.
     * */
    function _callOptionalReturn(
        address token,
        bytes memory data,
        string memory errorMsg
    ) internal {
        require(Address.isContract(token), "call to a non-contract address");
        (bool success, bytes memory returndata) = token.call(data);
        require(success, errorMsg);

        if (returndata.length != 0) {
            require(abi.decode(returndata, (bool)), errorMsg);
        }
    }

    /**
     * @notice Execute the ERC20 token's `transfer` function and reverts
     * upon failure the main purpose of this function is to prevent a non
     * standard ERC20 token from failing silently.
     *
     * @dev Wrappers around ERC20 operations that throw on failure (when the
     * token contract returns false). Tokens that return no value (and instead
     * revert or throw on failure) are also supported, non-reverting calls are
     * assumed to be successful.
     *
     * @param token The ERC20 token address.
     * @param to The target address.
     * @param amount The transfer amount.
     * @param errorMsg The error message on failure.
     */
    function _safeTransfer(
        address token,
        address to,
        uint256 amount,
        string memory errorMsg
    ) internal {
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(IERC20(token).transfer.selector, to, amount),
            errorMsg
        );
    }

    /**
     * @notice Execute the ERC20 token's `transferFrom` function and reverts
     * upon failure the main purpose of this function is to prevent a non
     * standard ERC20 token from failing silently.
     *
     * @dev Wrappers around ERC20 operations that throw on failure (when the
     * token contract returns false). Tokens that return no value (and instead
     * revert or throw on failure) are also supported, non-reverting calls are
     * assumed to be successful.
     *
     * @param token The ERC20 token address.
     * @param from The source address.
     * @param to The target address.
     * @param amount The transfer amount.
     * @param errorMsg The error message on failure.
     */
    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount,
        string memory errorMsg
    ) internal {
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(IERC20(token).transferFrom.selector, from, to, amount),
            errorMsg
        );
    }

    /**
     * @notice Execute the ERC20 token's `approve` function, tolerating
     * USDT-style no-return implementations exactly as `_safeTransfer` /
     * `_safeTransferFrom` do (via `_callOptionalReturn`): a no-return call is
     * treated as success, a returned `false` reverts. A raw high-level
     * `IERC20(token).approve(...)` would revert on no-return underlyings and
     * DoS the delayed-exit pull path; this helper avoids that.
     *
     * @dev Zero-first reset (approve(0) then approve(amount)) for full
     * USDT-style safety: some no-return tokens REVERT on a non-zero → non-zero
     * approve, so any residual allowance is first cleared to 0 before the new
     * amount is set — matching `VaultController.vaultApprove`. Callers on the
     * delayed-exit pull path normally hold a provably-zero prior allowance (the
     * queue pulls EXACTLY the approved amount, returning the allowance to 0), so
     * the reset is defensive; the `allowance != 0` guard skips the extra SSTORE
     * in the common zero-residual case. Fail-closed is preserved: a returned
     * `false` from either approve reverts here (COLFEE:approve-failed), and a
     * silently-failed approve still surfaces as the queue's `safeTransferFrom`
     * revert on the pull.
     *
     * @param token The ERC20 token address.
     * @param spender The address being approved.
     * @param amount The approval amount.
     */
    function _safeApprove(address token, address spender, uint256 amount) internal {
        if (amount != 0 && IERC20(token).allowance(address(this), spender) != 0) {
            _callOptionalReturn(
                token,
                abi.encodeWithSelector(IERC20(token).approve.selector, spender, 0),
                "COLFEE:approve-failed"
            );
        }
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(IERC20(token).approve.selector, spender, amount),
            "COLFEE:approve-failed"
        );
    }

    /** Internal view function */
    /**
     * @notice Compute the token price.
     * @param assetSupply The amount of loan tokens supplied.
     * @return The token price.
     * */
    function _tokenPrice(uint256 assetSupply) internal view returns (uint256) {
        uint256 totalTokenSupply = totalSupply_;

        return
            totalTokenSupply != 0 ? assetSupply.mul(10 ** 18).div(totalTokenSupply) : initialPrice;
    }

    /**
     * @notice Get two kind of interests: owed per day and yet to be paid.
     * @return interestOwedPerDay The interest per day.
     * @return interestUnPaid The interest not yet paid.
     * */
    function _getAllInterest()
        internal
        view
        returns (uint256 interestOwedPerDay, uint256 interestUnPaid)
    {
        /// interestPaid, interestPaidDate, interestOwedPerDay, interestUnPaid, interestFeePercent, principalTotal
        uint256 interestFeePercent;
        (, , interestOwedPerDay, interestUnPaid, interestFeePercent, ) = ProtocolLike(
            sovrynContractAddress
        ).getLenderInterestData(address(this), loanTokenAddress);

        interestUnPaid = interestUnPaid.mul(SafeMath.sub(10 ** 20, interestFeePercent)).div(
            10 ** 20
        );
    }

    /**
     * @notice Compute the total amount of loan tokens on supply.
     * @param interestUnPaid The interest not yet paid.
     * @return assetSupply The total amount of loan tokens on supply.
     * */
    function _totalAssetSupply(
        uint256 interestUnPaid
    ) internal view returns (uint256 assetSupply) {
        if (totalSupply_ != 0) {
            uint256 assetsBalance = _flTotalAssetSupply; /// Temporary locked totalAssetSupply during a flash loan transaction.
            if (assetsBalance == 0) {
                assetsBalance = _underlyingBalance().add(totalAssetBorrow());
            }

            return assetsBalance.add(interestUnPaid);
        }
    }

    /**
     * @notice Get the loan contract balance.
     * @return The balance of the loan token for this contract.
     * */
    function _underlyingBalance() internal view returns (uint256) {
        return IERC20(loanTokenAddress).balanceOf(address(this));
    }
}
