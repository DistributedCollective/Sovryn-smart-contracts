/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../core/State.sol";
import "../events/LoanClosingsEvents.sol";
import "../mixins/VaultController.sol";
import "../mixins/InterestUser.sol";
import "../swaps/SwapsUser.sol";
import "../mixins/RewardHelper.sol";
import "../mixins/ModuleCommonFunctionalities.sol";
import "../interfaces/ILoanTokenModules.sol";

interface IFeeSharingCollector {
    function transferRBTC() external payable;
}

/**
 * @title LoanClosingsShared contract.
 * @notice This contract should only contains the internal function that is being used / utilized by
 *   LoanClosingsLiquidation, LoanClosingsRollover & LoanClosingsWith contract
 *
 * */
contract LoanClosingsShared is
    LoanClosingsEvents,
    VaultController,
    InterestUser,
    SwapsUser,
    RewardHelper,
    ModuleCommonFunctionalities
{
    uint256 internal constant MONTH = 365 days / 12;
    //0.00001 BTC, would be nicer in State.sol, but would require a redeploy of the complete protocol, so adding it here instead
    //because it's not shared state anyway and only used by this contract
    uint256 public constant paySwapExcessToBorrowerThreshold = 10000000000000;

    uint256 public constant TINY_AMOUNT = 25e13;

    enum CloseTypes {
        Deposit,
        Swap,
        Liquidation
    }

    struct SwapCloseParams {
        uint256 swapAmount;
        bool returnTokenIsCollateral;
        bytes loanDataBytes;
        bool allowDonationOnFailure;
        address receiver;
    }

    struct SwapResults {
        uint256 coveredPrincipal;
        uint256 usedCollateral;
        uint256 swapWithdrawAmount;
        uint256 collateralToLoanSwapRate;
    }

    struct CoverPrincipalParams {
        uint256 swapAmount;
        uint256 principalNeeded;
        bool returnTokenIsCollateral;
        bytes loanDataBytes;
        bool allowDonationOnFailure;
    }

    /** modifier for invariant check */
    modifier iTokenSupplyUnchanged(bytes32 loanId) {
        Loan storage loanLocal = loans[loanId];

        require(loanLocal.lender != address(0), "Invalid loan token pool address");

        uint256 previousITokenSupply = ILoanTokenModules(loanLocal.lender).totalSupply();

        _;

        /// Validate iToken total supply
        require(
            previousITokenSupply == ILoanTokenModules(loanLocal.lender).totalSupply(),
            "loan token supply invariant check failure"
        );
    }

    /**
     * @dev computes the interest which needs to be refunded to the borrower based on the amount he's closing and either
     * subtracts it from the amount which still needs to be paid back (in case outstanding amount > interest) or withdraws the
     * excess to the borrower (in case interest > outstanding).
     * @param loanLocal the loan
     * @param loanParamsLocal the loan params
     * @param loanCloseAmount the amount to be closed (base for the computation)
     * @param receiver the address of the receiver (usually the borrower)
     * */
    function _settleInterestToPrincipal(
        Loan memory loanLocal,
        LoanParams memory loanParamsLocal,
        uint256 loanCloseAmount,
        address receiver
    ) internal returns (uint256) {
        uint256 loanCloseAmountLessInterest = loanCloseAmount;

        //compute the interest which neeeds to be refunded to the borrower (because full interest is paid on loan )
        uint256 interestRefundToBorrower = _settleInterest(
            loanParamsLocal,
            loanLocal,
            loanCloseAmountLessInterest
        );

        uint256 interestAppliedToPrincipal;
        //if the outstanding loan is bigger than the interest to be refunded, reduce the amount to be paid back / closed by the interest
        if (loanCloseAmountLessInterest >= interestRefundToBorrower) {
            // apply all of borrower interest refund torwards principal
            interestAppliedToPrincipal = interestRefundToBorrower;

            // principal needed is reduced by this amount
            loanCloseAmountLessInterest -= interestRefundToBorrower;

            // no interest refund remaining
            interestRefundToBorrower = 0;
        } else {
            //if the interest refund is bigger than the outstanding loan, the user needs to get back the interest
            // principal fully covered by excess interest
            interestAppliedToPrincipal = loanCloseAmountLessInterest;

            // amount refunded is reduced by this amount
            interestRefundToBorrower -= loanCloseAmountLessInterest;

            // principal fully covered by excess interest
            loanCloseAmountLessInterest = 0;

            if (interestRefundToBorrower != 0) {
                // refund overage
                _withdrawAsset(loanParamsLocal.loanToken, receiver, interestRefundToBorrower);
            }
        }

        //pay the interest to the lender
        //note: this is a waste of gas, because the loanCloseAmountLessInterest is withdrawn to the lender, too. It could be done at once.
        if (interestAppliedToPrincipal != 0) {
            // The lender always gets back an ERC20 (even wrbtc), so we call withdraw directly rather than
            // use the _withdrawAsset helper function
            vaultWithdraw(loanParamsLocal.loanToken, loanLocal.lender, interestAppliedToPrincipal);
        }

        return loanCloseAmountLessInterest;
    }

    // The receiver always gets back an ERC20 (even wrbtc)
    function _returnPrincipalWithDeposit(
        address loanToken,
        address receiver,
        uint256 principalNeeded
    ) internal {
        if (principalNeeded != 0) {
            if (msg.value == 0) {
                vaultTransfer(loanToken, msg.sender, receiver, principalNeeded);
            } else {
                require(loanToken == address(wrbtcToken), "wrong asset sent");
                require(msg.value >= principalNeeded, "not enough ether");
                wrbtcToken.deposit.value(principalNeeded)();
                if (receiver != address(this)) {
                    vaultTransfer(loanToken, address(this), receiver, principalNeeded);
                }
                if (msg.value > principalNeeded) {
                    // refund overage
                    Address.sendValue(msg.sender, msg.value - principalNeeded);
                }
            }
        } else {
            require(msg.value == 0, "wrong asset sent");
        }
    }

    /**
     * @dev checks if the amount of the asset to be transfered is worth the transfer fee
     * @param asset the asset to be transfered
     * @param amount the amount to be transfered
     * @return True if the amount is bigger than the threshold
     * */
    function worthTheTransfer(address asset, uint256 amount) internal returns (bool) {
        uint256 amountInRbtc = _getAmountInRbtc(asset, amount);
        emit swapExcess(
            amountInRbtc > paySwapExcessToBorrowerThreshold,
            amount,
            amountInRbtc,
            paySwapExcessToBorrowerThreshold
        );

        return amountInRbtc > paySwapExcessToBorrowerThreshold;
    }

    /**
     * swaps collateral tokens for loan tokens
     * @param loanLocal the loan object
     * @param loanParamsLocal the loan parameters
     * @param swapAmount the amount to be swapped
     * @param principalNeeded the required destination token amount
     * @param returnTokenIsCollateral if true -> required destination token amount will be passed on, else not
     *          note: quite dirty. should be refactored.
     * @param loanDataBytes additional loan data (not in use for token swaps)
     * */
    function _doCollateralSwap(
        Loan memory loanLocal,
        LoanParams memory loanParamsLocal,
        uint256 swapAmount,
        uint256 principalNeeded,
        bool returnTokenIsCollateral,
        bytes memory loanDataBytes
    )
        internal
        returns (
            uint256 destTokenAmountReceived,
            uint256 sourceTokenAmountUsed,
            uint256 collateralToLoanSwapRate
        )
    {
        (destTokenAmountReceived, sourceTokenAmountUsed, collateralToLoanSwapRate) = _loanSwap(
            loanLocal.id,
            loanParamsLocal.collateralToken,
            loanParamsLocal.loanToken,
            loanLocal.borrower,
            swapAmount, // minSourceTokenAmount
            loanLocal.collateral, // maxSourceTokenAmount
            returnTokenIsCollateral
                ? principalNeeded // requiredDestTokenAmount
                : 0,
            false, // bypassFee
            loanDataBytes
        );
        require(destTokenAmountReceived >= principalNeeded, "insufficient dest amount");
        require(sourceTokenAmountUsed <= loanLocal.collateral, "excessive source amount");
    }

    /**
     * @notice Withdraw asset to receiver.
     *
     * @param assetToken The loan token.
     * @param receiver The address of the receiver.
     * @param assetAmount The loan token amount.
     * */
    function _withdrawAsset(address assetToken, address receiver, uint256 assetAmount) internal {
        _withdrawAsset(assetToken, receiver, assetAmount, false);
    }

    /**
     * @notice Withdraw asset to receiver with optional donation fallback for forced operations.
     *
     * @param assetToken The token to withdraw (WRBTC or ERC20).
     * @param receiver The address to receive the tokens.
     * @param assetAmount The amount to withdraw.
     * @param allowDonationOnFailure If true, donate to FeeSharingCollector if WRBTC transfer fails.
     *                               This prevents liquidation/rollover blocking attacks where malicious
     *                               borrowers use contracts that revert on receive()/fallback() calls.
     *                               Only used for forced operations (liquidation/rollover), not normal closures.
     *                               Note: The donation fallback only applies to WRBTC/RBTC transfers.
     *                               For ERC20 tokens, the donation fallback is not used.
     */
    function _withdrawAsset(
        address assetToken,
        address receiver,
        uint256 assetAmount,
        bool allowDonationOnFailure
    ) internal {
        if (assetAmount != 0) {
            if (assetToken == address(wrbtcToken)) {
                if (allowDonationOnFailure) {
                    _safeEtherWithdraw(receiver, assetAmount);
                } else {
                    vaultEtherWithdraw(receiver, assetAmount);
                }
            } else {
                vaultWithdraw(assetToken, receiver, assetAmount);
            }
        }
    }

    /**
     * @notice Safely withdraw RBTC to receiver, donating to FeeSharingCollector if transfer fails.
     * This function is used for forced operations (liquidation/rollover) where we don't want to revert.
     *
     * @param receiver The address of the receiver.
     * @param amount The RBTC amount to withdraw.
     * */
    function _safeEtherWithdraw(address receiver, uint256 amount) internal {
        if (amount != 0) {
            IWrbtcERC20 _wrbtcToken = wrbtcToken;
            uint256 balance = address(this).balance;
            if (amount > balance) {
                _wrbtcToken.withdraw(amount - balance);
            }

            // Try to send RBTC to the receiver
            (bool success, ) = receiver.call.value(amount)("");

            if (!success) {
                // If transfer fails, donate to FeeSharingCollector instead
                _donateToFeeSharingCollector(receiver, amount);
            } else {
                emit VaultWithdraw(address(_wrbtcToken), receiver, amount);
            }
        }
    }

    /**
     * @notice Donate RBTC to FeeSharingCollector when direct transfer fails.
     *
     * @param originalRecipient The original intended recipient.
     * @param amount The RBTC amount to donate.
     * */
    function _donateToFeeSharingCollector(address originalRecipient, uint256 amount) internal {
        require(feesController != address(0), "feesController not set");

        IFeeSharingCollector(feesController).transferRBTC.value(amount)();

        emit DonateToFeeSharingCollector(originalRecipient, amount);
    }

    /**
     * @notice Internal function to close a loan.
     *
     * @param loanLocal The loan object.
     * @param loanCloseAmount The amount to close: principal or lower.
     *
     * */
    function _closeLoan(Loan storage loanLocal, uint256 loanCloseAmount) internal {
        require(loanCloseAmount != 0, "nothing to close");

        if (loanCloseAmount == loanLocal.principal) {
            loanLocal.principal = 0;
            loanLocal.active = false;
            loanLocal.endTimestamp = block.timestamp;
            loanLocal.pendingTradesId = 0;
            activeLoansSet.removeBytes32(loanLocal.id);
            lenderLoanSets[loanLocal.lender].removeBytes32(loanLocal.id);
            borrowerLoanSets[loanLocal.borrower].removeBytes32(loanLocal.id);
        } else {
            loanLocal.principal = loanLocal.principal.sub(loanCloseAmount);
        }
    }

    function _settleInterest(
        LoanParams memory loanParamsLocal,
        Loan memory loanLocal,
        uint256 closePrincipal
    ) internal returns (uint256) {
        // pay outstanding interest to lender
        _payInterest(loanLocal.lender, loanParamsLocal.loanToken);

        LoanInterest storage loanInterestLocal = loanInterest[loanLocal.id];
        LenderInterest storage lenderInterestLocal = lenderInterest[loanLocal.lender][
            loanParamsLocal.loanToken
        ];

        uint256 interestTime = block.timestamp;
        if (interestTime > loanLocal.endTimestamp) {
            interestTime = loanLocal.endTimestamp;
        }

        _settleFeeRewardForInterestExpense(
            loanInterestLocal,
            loanLocal.id,
            loanParamsLocal.loanToken, /// fee token
            loanParamsLocal.collateralToken, /// pairToken (used to check if there is any special rebates or not) -- to pay fee reward
            loanLocal.borrower,
            interestTime
        );

        uint256 owedPerDayRefund;
        if (closePrincipal < loanLocal.principal) {
            owedPerDayRefund = loanInterestLocal.owedPerDay.mul(closePrincipal).div(
                loanLocal.principal
            );
        } else {
            owedPerDayRefund = loanInterestLocal.owedPerDay;
        }

        // update stored owedPerDay
        loanInterestLocal.owedPerDay = loanInterestLocal.owedPerDay.sub(owedPerDayRefund);
        lenderInterestLocal.owedPerDay = lenderInterestLocal.owedPerDay.sub(owedPerDayRefund);

        // update borrower interest
        uint256 interestRefundToBorrower = loanLocal.endTimestamp.sub(interestTime);
        interestRefundToBorrower = interestRefundToBorrower.mul(owedPerDayRefund);
        interestRefundToBorrower = interestRefundToBorrower.div(1 days);

        if (closePrincipal < loanLocal.principal) {
            loanInterestLocal.depositTotal = loanInterestLocal.depositTotal.sub(
                interestRefundToBorrower
            );
        } else {
            loanInterestLocal.depositTotal = 0;
        }

        // update remaining lender interest values
        lenderInterestLocal.principalTotal = lenderInterestLocal.principalTotal.sub(
            closePrincipal
        );

        uint256 owedTotal = lenderInterestLocal.owedTotal;
        lenderInterestLocal.owedTotal = owedTotal > interestRefundToBorrower
            ? owedTotal - interestRefundToBorrower
            : 0;

        return interestRefundToBorrower;
    }

    /**
     * @notice Check sender is borrower or delegatee and loan id exists.
     *
     * @param loanId byte32 of the loan id.
     * */
    function _checkAuthorized(bytes32 loanId) internal view {
        Loan storage loanLocal = loans[loanId];
        require(
            msg.sender == loanLocal.borrower || delegatedManagers[loanLocal.id][msg.sender],
            "unauthorized"
        );
    }

    /**
     * @notice Internal function for closing a position by swapping the
     * collateral back to loan tokens, paying the lender and withdrawing
     * the remainder.
     *
     * @param loanId The id of the loan.
     * @param receiver The receiver of the remainder (unused collatral + profit).
     * @param swapAmount Defines how much of the position should be closed and
     *   is denominated in collateral tokens.
     *     If swapAmount >= collateral, the complete position will be closed.
     *     Else if returnTokenIsCollateral, (swapAmount/collateral) * principal will be swapped (partial closure).
     *     Else coveredPrincipal
     * @param returnTokenIsCollateral Defines if the remainder should be paid
     *   out in collateral tokens or underlying loan tokens.
     * @param allowDonationOnFailure Should be true on forced closings (liquidation, rollover) - if refund to the borrower reverts, it is donated to Sovryn stakers via FeeSharingCollector.
     *
     * @return loanCloseAmount The amount of the collateral token of the loan.
     * @return withdrawAmount The withdraw amount in the collateral token.
     * @return withdrawToken The loan token address.
     * */
    function _closeWithSwap(
        bytes32 loanId,
        address receiver,
        uint256 swapAmount,
        bool returnTokenIsCollateral,
        bytes memory loanDataBytes,
        bool allowDonationOnFailure
    ) internal returns (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken) {
        require(swapAmount != 0, "swapAmount == 0");

        (Loan storage loanLocal, LoanParams storage loanParamsLocal) = _checkLoan(loanId);

        SwapCloseParams memory params = SwapCloseParams({
            swapAmount: _adjustSwapAmountForTinyPosition(loanLocal, loanParamsLocal, swapAmount),
            returnTokenIsCollateral: returnTokenIsCollateral,
            loanDataBytes: loanDataBytes,
            allowDonationOnFailure: allowDonationOnFailure,
            receiver: receiver
        });

        (loanCloseAmount, withdrawAmount, withdrawToken) = _executeSwapAndClose(
            loanLocal,
            loanParamsLocal,
            params
        );
    }

    /**
     * @notice Adjust swap amount to close entire position if tiny amount would remain
     * @param loanLocal The loan object
     * @param loanParamsLocal The loan parameters
     * @param swapAmount The initial swap amount
     * @return The adjusted swap amount
     */
    function _adjustSwapAmountForTinyPosition(
        Loan storage loanLocal,
        LoanParams storage loanParamsLocal,
        uint256 swapAmount
    ) internal view returns (uint256) {
        /// Can't swap more than collateral.
        swapAmount = swapAmount > loanLocal.collateral ? loanLocal.collateral : swapAmount;

        //close whole loan if tiny position will remain
        if (loanLocal.collateral > swapAmount) {
            if (
                _getAmountInRbtc(
                    loanParamsLocal.collateralToken,
                    loanLocal.collateral - swapAmount
                ) <= TINY_AMOUNT
            ) {
                swapAmount = loanLocal.collateral;
            }
        }

        return swapAmount;
    }

    /**
     * @notice Execute the swap and close logic
     * @param loanLocal The loan object
     * @param loanParamsLocal The loan parameters
     * @param params The swap close parameters
     * @return loanCloseAmount The loan close amount
     * @return withdrawAmount The withdraw amount
     * @return withdrawToken The withdraw token address
     */
    function _executeSwapAndClose(
        Loan storage loanLocal,
        LoanParams storage loanParamsLocal,
        SwapCloseParams memory params
    ) internal returns (uint256, uint256, address) {
        return _processSwapClose(loanLocal, loanParamsLocal, params);
    }

    function _processSwapClose(
        Loan storage loanLocal,
        LoanParams storage loanParamsLocal,
        SwapCloseParams memory params
    ) internal returns (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken) {
        // Calculate initial close amount and settle interest if needed
        (
            uint256 loanCloseAmount,
            uint256 loanCloseAmountLessInterest
        ) = _calculateInitialCloseAmount(
                loanLocal,
                loanParamsLocal,
                params.swapAmount,
                params.returnTokenIsCollateral,
                params.receiver
            );

        return
            _executeAndFinalizeSwap(
                loanLocal,
                loanParamsLocal,
                params,
                loanCloseAmount,
                loanCloseAmountLessInterest
            );
    }

    function _executeAndFinalizeSwap(
        Loan storage loanLocal,
        LoanParams storage loanParamsLocal,
        SwapCloseParams memory params,
        uint256 loanCloseAmount,
        uint256 loanCloseAmountLessInterest
    ) internal returns (uint256, uint256, address) {
        // Execute the swap
        SwapResults memory swapResults;
        (
            swapResults.coveredPrincipal,
            swapResults.usedCollateral,
            swapResults.swapWithdrawAmount,
            swapResults.collateralToLoanSwapRate
        ) = _executeSwapForClose(
            loanLocal,
            loanParamsLocal,
            params.swapAmount,
            loanCloseAmountLessInterest,
            params.returnTokenIsCollateral,
            params.loanDataBytes,
            params.allowDonationOnFailure
        );

        // Handle post-swap calculations and finalization
        return
            _finalizeSwapClose(
                loanLocal,
                loanParamsLocal,
                params,
                loanCloseAmount,
                loanCloseAmountLessInterest,
                swapResults
            );
    }

    /**
     * @notice Calculate initial close amount and settle interest if applicable
     */
    function _calculateInitialCloseAmount(
        Loan storage loanLocal,
        LoanParams storage loanParamsLocal,
        uint256 swapAmount,
        bool returnTokenIsCollateral,
        address receiver
    ) internal returns (uint256 loanCloseAmount, uint256 loanCloseAmountLessInterest) {
        bool isFullCollateralSwap = swapAmount == loanLocal.collateral;
        if (isFullCollateralSwap || returnTokenIsCollateral) {
            /// loanCloseAmountLessInterest will be passed as required amount amount of destination tokens.
            /// this means, the actual swapAmount passed to the swap contract does not matter at all.
            /// the source token amount will be computed depending on the required amount amount of destination tokens.
            loanCloseAmount = isFullCollateralSwap
                ? loanLocal.principal
                : loanLocal.principal.mul(swapAmount).div(loanLocal.collateral);
            require(loanCloseAmount != 0, "loanCloseAmount == 0");

            /// Computes the interest refund for the borrower and sends it to the lender to cover part of the principal.
            loanCloseAmountLessInterest = _settleInterestToPrincipal(
                loanLocal,
                loanParamsLocal,
                loanCloseAmount,
                receiver
            );
        } else {
            /// loanCloseAmount is calculated after swap; for this case we want to swap the entire source amount
            /// and determine the loanCloseAmount and withdraw amount based on that.
            loanCloseAmountLessInterest = 0;
        }

        return (loanCloseAmount, loanCloseAmountLessInterest);
    }

    /**
     * @notice Execute the swap for loan closure
     */
    function _executeSwapForClose(
        Loan storage loanLocal,
        LoanParams storage loanParamsLocal,
        uint256 swapAmount,
        uint256 loanCloseAmountLessInterest,
        bool returnTokenIsCollateral,
        bytes memory loanDataBytes,
        bool allowDonationOnFailure
    )
        internal
        returns (
            uint256 coveredPrincipal,
            uint256 usedCollateral,
            uint256 withdrawAmount,
            uint256 collateralToLoanSwapRate
        )
    {
        (
            coveredPrincipal,
            usedCollateral,
            withdrawAmount,
            collateralToLoanSwapRate
        ) = _coverPrincipalWithSwap(
            loanLocal,
            loanParamsLocal,
            swapAmount,
            loanCloseAmountLessInterest,
            returnTokenIsCollateral,
            loanDataBytes,
            allowDonationOnFailure
        );
    }

    /**
     * @notice Finalize the swap closure process by calculating final amounts, updating loan state,
     *         repaying the lender, and withdrawing remaining funds to the receiver.
     * @param loanLocal The loan object containing borrower, lender, principal, collateral, etc.
     * @param loanParamsLocal The loan parameters containing loan token, collateral token, etc.
     * @param params The swap close parameters including swap amount, return token preference, etc.
     * @param loanCloseAmount The initial amount to close (principal or lower), may be recalculated
     * @param loanCloseAmountLessInterest The amount that is returned to the lender after interest settlement
     * @param swapResults The results from the swap execution including covered principal, used collateral, etc.
     * @return loanCloseAmount The final amount of the loan that was closed (principal or lower)
     * @return withdrawAmount The amount being withdrawn to the receiver (remaining collateral + profit)
     * @return withdrawToken The address of the token being withdrawn (collateral or loan token)
     */
    function _finalizeSwapClose(
        Loan storage loanLocal,
        LoanParams storage loanParamsLocal,
        SwapCloseParams memory params,
        uint256 loanCloseAmount,
        uint256 loanCloseAmountLessInterest,
        SwapResults memory swapResults
    ) internal returns (uint256, uint256, address) {
        uint256 withdrawAmount = swapResults.swapWithdrawAmount;

        if (loanCloseAmountLessInterest == 0) {
            /// Condition prior to swap: swapAmount != loanLocal.collateral && !returnTokenIsCollateral

            /// Amounts that is closed.
            loanCloseAmount = swapResults.coveredPrincipal;
            if (swapResults.coveredPrincipal != loanLocal.principal) {
                loanCloseAmount = loanCloseAmount.mul(swapResults.usedCollateral).div(
                    loanLocal.collateral
                );
            }
            require(loanCloseAmount != 0, "loanCloseAmount == 0");

            /// Amount that is returned to the lender.
            loanCloseAmountLessInterest = _settleInterestToPrincipal(
                loanLocal,
                loanParamsLocal,
                loanCloseAmount,
                params.receiver
            );

            /// Remaining amount withdrawn to the receiver.
            withdrawAmount = withdrawAmount.add(swapResults.coveredPrincipal).sub(
                loanCloseAmountLessInterest
            );
        } else {
            /// Pay back the amount which was covered by the swap.
            loanCloseAmountLessInterest = swapResults.coveredPrincipal;
        }

        require(loanCloseAmountLessInterest != 0, "closeAmount is 0 after swap");

        /// Reduce the collateral by the amount which was swapped for the closure.
        if (swapResults.usedCollateral != 0) {
            loanLocal.collateral = loanLocal.collateral.sub(swapResults.usedCollateral);
        }

        /// Repays principal to lender.
        /// The lender always gets back an ERC20 (even wrbtc), so we call
        /// withdraw directly rather than use the _withdrawAsset helper function.
        vaultWithdraw(loanParamsLocal.loanToken, loanLocal.lender, loanCloseAmountLessInterest);

        // Set withdraw token
        address withdrawToken = params.returnTokenIsCollateral
            ? loanParamsLocal.collateralToken
            : loanParamsLocal.loanToken;

        // Withdraw to receiver
        if (withdrawAmount != 0) {
            _withdrawAsset(
                withdrawToken,
                params.receiver,
                withdrawAmount,
                params.allowDonationOnFailure
            );
        }

        // Finalize
        _finalizeClose(
            loanLocal,
            loanParamsLocal,
            loanCloseAmount,
            swapResults.usedCollateral,
            swapResults.collateralToLoanSwapRate, /// collateralToLoanSwapRate
            CloseTypes.Swap
        );

        return (loanCloseAmount, withdrawAmount, withdrawToken);
    }

    /**
     * @notice Close a loan.
     *
     * @dev Wrapper for _closeLoan internal function.
     *
     * @param loanLocal The loan object.
     * @param loanParamsLocal The loan params.
     * @param loanCloseAmount The amount to close: principal or lower.
     * @param collateralCloseAmount The amount of collateral to close.
     * @param collateralToLoanSwapRate The price rate collateral/loan token.
     * @param closeType The type of loan close.
     * */
    function _finalizeClose(
        Loan storage loanLocal,
        LoanParams storage loanParamsLocal,
        uint256 loanCloseAmount,
        uint256 collateralCloseAmount,
        uint256 collateralToLoanSwapRate,
        CloseTypes closeType
    ) internal {
        _closeLoan(loanLocal, loanCloseAmount);

        address _priceFeeds = priceFeeds;
        uint256 currentMargin;
        uint256 collateralToLoanRate;

        /// This is still called even with full loan close to return collateralToLoanRate
        (bool success, bytes memory data) = _priceFeeds.staticcall(
            abi.encodeWithSelector(
                IPriceFeeds(_priceFeeds).getCurrentMargin.selector,
                loanParamsLocal.loanToken,
                loanParamsLocal.collateralToken,
                loanLocal.principal,
                loanLocal.collateral
            )
        );
        assembly {
            if eq(success, 1) {
                currentMargin := mload(add(data, 32))
                collateralToLoanRate := mload(add(data, 64))
            }
        }
        /// Note: We can safely skip the margin check if closing
        /// via closeWithDeposit or if closing the loan in full by any method.
        require(
            closeType == CloseTypes.Deposit ||
                loanLocal.principal == 0 || /// loan fully closed
                currentMargin > loanParamsLocal.maintenanceMargin,
            "unhealthy position"
        );

        _emitClosingEvents(
            loanParamsLocal,
            loanLocal,
            loanCloseAmount,
            collateralCloseAmount,
            collateralToLoanRate,
            collateralToLoanSwapRate,
            currentMargin,
            closeType
        );
    }

    /**
     * swaps a share of a loan's collateral or the complete collateral in order to cover the principle.
     * @param loanLocal the loan
     * @param loanParamsLocal the loan parameters
     * @param swapAmount in case principalNeeded == 0 or !returnTokenIsCollateral, this is the amount which is going to be swapped.
     *  Else, swapAmount doesn't matter, because the amount of source tokens needed for the swap is estimated by the connector.
     * @param principalNeeded the required amount of destination tokens in order to cover the principle (only used if returnTokenIsCollateral)
     * @param returnTokenIsCollateral tells if the user wants to withdraw his remaining collateral + profit in collateral tokens
     * @notice Swaps a share of a loan's collateral or the complete collateral
     *   in order to cover the principle.
     *
     * @param loanLocal The loan object.
     * @param loanParamsLocal The loan parameters.
     * @param swapAmount In case principalNeeded == 0 or !returnTokenIsCollateral,
     *   this is the amount which is going to be swapped.
     *   Else, swapAmount doesn't matter, because the amount of source tokens
     *   needed for the swap is estimated by the connector.
     * @param principalNeeded The required amount of destination tokens in order to
     *   cover the principle (only used if returnTokenIsCollateral).
     * @param returnTokenIsCollateral Tells if the user wants to withdraw his
     *   remaining collateral + profit in collateral tokens.
     * @param allowDonationOnFailure If true, allow donation on failure for forced operations.
     *
     * @return coveredPrincipal The amount of principal that is covered.
     * @return usedCollateral The amount of collateral used.
     * @return withdrawAmount The withdraw amount in the collateral token.
     * @return collateralToLoanSwapRate The swap rate of collateral.
     * */
    function _coverPrincipalWithSwap(
        Loan memory loanLocal,
        LoanParams memory loanParamsLocal,
        uint256 swapAmount,
        uint256 principalNeeded,
        bool returnTokenIsCollateral,
        bytes memory loanDataBytes,
        bool allowDonationOnFailure
    )
        internal
        returns (
            uint256 coveredPrincipal,
            uint256 usedCollateral,
            uint256 withdrawAmount,
            uint256 collateralToLoanSwapRate
        )
    {
        CoverPrincipalParams memory params = CoverPrincipalParams({
            swapAmount: swapAmount,
            principalNeeded: principalNeeded,
            returnTokenIsCollateral: returnTokenIsCollateral,
            loanDataBytes: loanDataBytes,
            allowDonationOnFailure: allowDonationOnFailure
        });

        return _executeCoverPrincipalWithSwap(loanLocal, loanParamsLocal, params);
    }

    function _executeCoverPrincipalWithSwap(
        Loan memory loanLocal,
        LoanParams memory loanParamsLocal,
        CoverPrincipalParams memory params
    )
        internal
        returns (
            uint256 coveredPrincipal,
            uint256 usedCollateral,
            uint256 withdrawAmount,
            uint256 collateralToLoanSwapRate
        )
    {
        uint256 destTokenAmountReceived;
        uint256 sourceTokenAmountUsed;
        (
            destTokenAmountReceived,
            sourceTokenAmountUsed,
            collateralToLoanSwapRate
        ) = _doCollateralSwap(
            loanLocal,
            loanParamsLocal,
            params.swapAmount,
            params.principalNeeded,
            params.returnTokenIsCollateral,
            params.loanDataBytes
        );

        if (params.returnTokenIsCollateral) {
            (coveredPrincipal, withdrawAmount) = _handleCollateralReturn(
                loanLocal,
                loanParamsLocal,
                params,
                destTokenAmountReceived,
                sourceTokenAmountUsed
            );
        } else {
            (coveredPrincipal, withdrawAmount, sourceTokenAmountUsed) = _handleLoanTokenReturn(
                loanLocal,
                loanParamsLocal,
                params,
                destTokenAmountReceived,
                sourceTokenAmountUsed
            );
        }

        usedCollateral = sourceTokenAmountUsed > params.swapAmount
            ? sourceTokenAmountUsed
            : params.swapAmount;

        return (coveredPrincipal, usedCollateral, withdrawAmount, collateralToLoanSwapRate);
    }

    function _handleCollateralReturn(
        Loan memory loanLocal,
        LoanParams memory loanParamsLocal,
        CoverPrincipalParams memory params,
        uint256 destTokenAmountReceived,
        uint256 sourceTokenAmountUsed
    ) internal returns (uint256 coveredPrincipal, uint256 withdrawAmount) {
        coveredPrincipal = params.principalNeeded;

        /// Better fill than expected.
        if (destTokenAmountReceived > coveredPrincipal) {
            uint256 excess = destTokenAmountReceived - coveredPrincipal;
            /// Send excess to borrower if the amount is big enough to be
            /// worth the gas fees.
            if (worthTheTransfer(loanParamsLocal.loanToken, excess)) {
                _withdrawAsset(
                    loanParamsLocal.loanToken,
                    loanLocal.borrower,
                    excess,
                    params.allowDonationOnFailure
                );
            }
            /// Else, give the excess to the lender (if it goes to the
            /// borrower, they're very confused. causes more trouble than it's worth)
            else {
                coveredPrincipal = destTokenAmountReceived;
            }
        }
        withdrawAmount = params.swapAmount > sourceTokenAmountUsed
            ? params.swapAmount - sourceTokenAmountUsed
            : 0;
    }

    function _handleLoanTokenReturn(
        Loan memory loanLocal,
        LoanParams memory loanParamsLocal,
        CoverPrincipalParams memory params,
        uint256 destTokenAmountReceived,
        uint256 sourceTokenAmountUsed
    )
        internal
        returns (uint256 coveredPrincipal, uint256 withdrawAmount, uint256 finalSourceUsed)
    {
        require(sourceTokenAmountUsed == params.swapAmount, "swap error");
        finalSourceUsed = sourceTokenAmountUsed;

        if (params.swapAmount == loanLocal.collateral) {
            /// sourceTokenAmountUsed == swapAmount == loanLocal.collateral
            coveredPrincipal = params.principalNeeded;
            withdrawAmount = destTokenAmountReceived - params.principalNeeded;
        } else {
            /// sourceTokenAmountUsed == swapAmount < loanLocal.collateral
            if (destTokenAmountReceived >= loanLocal.principal) {
                /// Edge case where swap covers full principal.
                coveredPrincipal = loanLocal.principal;
                withdrawAmount = destTokenAmountReceived - loanLocal.principal;

                /// Excess collateral refunds to the borrower.
                uint256 excessCollateral = loanLocal.collateral - sourceTokenAmountUsed;
                _withdrawAsset(
                    loanParamsLocal.collateralToken,
                    loanLocal.borrower,
                    excessCollateral,
                    params.allowDonationOnFailure
                );
                finalSourceUsed = loanLocal.collateral;
            } else {
                coveredPrincipal = destTokenAmountReceived;
                withdrawAmount = 0;
            }
        }

        return (coveredPrincipal, withdrawAmount, finalSourceUsed);
    }

    function _emitClosingEvents(
        LoanParams memory loanParamsLocal,
        Loan memory loanLocal,
        uint256 loanCloseAmount,
        uint256 collateralCloseAmount,
        uint256 collateralToLoanRate,
        uint256 collateralToLoanSwapRate,
        uint256 currentMargin,
        CloseTypes closeType
    ) internal {
        if (closeType == CloseTypes.Deposit) {
            emit CloseWithDeposit(
                loanLocal.borrower, /// user (borrower)
                loanLocal.lender, /// lender
                loanLocal.id, /// loanId
                msg.sender, /// closer
                loanParamsLocal.loanToken, /// loanToken
                loanParamsLocal.collateralToken, /// collateralToken
                loanCloseAmount, /// loanCloseAmount
                collateralCloseAmount, /// collateralCloseAmount
                collateralToLoanRate, /// collateralToLoanRate
                currentMargin /// currentMargin
            );
        } else if (closeType == CloseTypes.Swap) {
            /// exitPrice = 1 / collateralToLoanSwapRate
            if (collateralToLoanSwapRate != 0) {
                collateralToLoanSwapRate = SafeMath.div(10 ** 36, collateralToLoanSwapRate);
            }

            /// currentLeverage = 100 / currentMargin
            if (currentMargin != 0) {
                currentMargin = SafeMath.div(10 ** 38, currentMargin);
            }

            emit CloseWithSwap(
                loanLocal.borrower, /// user (trader)
                loanLocal.lender, /// lender
                loanLocal.id, /// loanId
                loanParamsLocal.collateralToken, /// collateralToken
                loanParamsLocal.loanToken, /// loanToken
                msg.sender, /// closer
                collateralCloseAmount, /// positionCloseSize
                loanCloseAmount, /// loanCloseAmount
                collateralToLoanSwapRate, /// exitPrice (1 / collateralToLoanSwapRate)
                currentMargin /// currentLeverage
            );
        } else if (closeType == CloseTypes.Liquidation) {
            emit Liquidate(
                loanLocal.borrower, // user (borrower)
                msg.sender, // liquidator
                loanLocal.id, // loanId
                loanLocal.lender, // lender
                loanParamsLocal.loanToken, // loanToken
                loanParamsLocal.collateralToken, // collateralToken
                loanCloseAmount, // loanCloseAmount
                collateralCloseAmount, // collateralCloseAmount
                collateralToLoanRate, // collateralToLoanRate
                currentMargin // currentMargin
            );
        }
    }

    /**
     * @dev returns amount of the asset converted to RBTC
     * @param asset the asset to be transferred
     * @param amount the amount to be transferred
     * @return amount in RBTC
     * */
    function _getAmountInRbtc(address asset, uint256 amount) internal view returns (uint256) {
        (uint256 rbtcRate, uint256 rbtcPrecision) = IPriceFeeds(priceFeeds).queryRate(
            asset,
            address(wrbtcToken)
        );
        return amount.mul(rbtcRate).div(rbtcPrecision);
    }

    /**
     * @dev private function which check the loanLocal & loanParamsLocal does exist
     *
     * @param loanId bytes32 of loanId
     *
     * @return Loan storage
     * @return LoanParams storage
     */
    function _checkLoan(bytes32 loanId) internal view returns (Loan storage, LoanParams storage) {
        Loan storage loanLocal = loans[loanId];
        LoanParams storage loanParamsLocal = loanParams[loanLocal.loanParamsId];

        require(loanLocal.active, "loan is closed");
        require(loanParamsLocal.id != 0, "loanParams not exists");

        return (loanLocal, loanParamsLocal);
    }
}
