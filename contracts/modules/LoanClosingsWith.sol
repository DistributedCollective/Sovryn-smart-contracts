/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../interfaces/ILoanPool.sol";
import "./LoanClosingsShared.sol";

/**
 * @title LoanClosingsWith contract.
 * @notice Close a loan w/deposit, close w/swap. There are 2 functions for ending a loan on the
 *   protocol contract: closeWithSwap and closeWithDeposit. Margin trade
 *   positions are always closed with a swap.
 *
 * Loans are liquidated if the position goes below margin maintenance.
 * */
contract LoanClosingsWith is LoanClosingsShared {
	constructor() public {}

	function() external {
		revert("fallback not allowed");
	}

	function initialize(address target) external onlyOwner {
		address prevModuleContractAddress = logicTargets[this.closeWithDeposit.selector];
		_setTarget(this.closeWithDeposit.selector, target);
		_setTarget(this.closeWithSwap.selector, target);
		emit ProtocolModuleContractReplaced(prevModuleContractAddress, target, "LoanClosingsWith");
	}

	/**
	 * @notice Closes a loan by doing a deposit.
	 *
	 * @dev Public wrapper for _closeWithDeposit internal function.
	 *
	 * @param loanId The id of the loan.
	 * @param receiver The receiver of the remainder.
	 * @param depositAmount Defines how much of the position should be closed.
	 *   It is denominated in loan tokens. (e.g. rBTC on a iSUSD contract).
	 *     If depositAmount > principal, the complete loan will be closed
	 *     else deposit amount (partial closure).
	 *
	 * @return loanCloseAmount The amount of the collateral token of the loan.
	 * @return withdrawAmount The withdraw amount in the collateral token.
	 * @return withdrawToken The loan token address.
	 * */
	function closeWithDeposit(
		bytes32 loanId,
		address receiver,
		uint256 depositAmount /// Denominated in loanToken.
	)
		public
		payable
		nonReentrant
		whenNotPaused
		returns (
			uint256 loanCloseAmount,
			uint256 withdrawAmount,
			address withdrawToken
		)
	{
		return _closeWithDeposit(loanId, receiver, depositAmount);
	}

	/**
	 * @notice Close a position by swapping the collateral back to loan tokens
	 * paying the lender and withdrawing the remainder.
	 *
	 * @dev Public wrapper for _closeWithSwap internal function.
	 *
	 * @param loanId The id of the loan.
	 * @param receiver The receiver of the remainder (unused collateral + profit).
	 * @param swapAmount Defines how much of the position should be closed and
	 *   is denominated in collateral tokens.
	 *      If swapAmount >= collateral, the complete position will be closed.
	 *      Else if returnTokenIsCollateral, (swapAmount/collateral) * principal will be swapped (partial closure).
	 *      Else coveredPrincipal
	 * @param returnTokenIsCollateral Defines if the remainder should be paid out
	 *   in collateral tokens or underlying loan tokens.
	 *
	 * @return loanCloseAmount The amount of the collateral token of the loan.
	 * @return withdrawAmount The withdraw amount in the collateral token.
	 * @return withdrawToken The loan token address.
	 * */
	function closeWithSwap(
		bytes32 loanId,
		address receiver,
		uint256 swapAmount, // denominated in collateralToken
		bool returnTokenIsCollateral, // true: withdraws collateralToken, false: withdraws loanToken
		bytes memory // for future use /*loanDataBytes*/
	)
		public
		nonReentrant
		whenNotPaused
		returns (
			uint256 loanCloseAmount,
			uint256 withdrawAmount,
			address withdrawToken
		)
	{
		return
			_closeWithSwap(
				loanId,
				receiver,
				swapAmount,
				returnTokenIsCollateral,
				"" /// loanDataBytes
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
		bytes memory loanDataBytes
	)
		internal
		returns (
			uint256 loanCloseAmount,
			uint256 withdrawAmount,
			address withdrawToken
		)
	{
		require(swapAmount != 0, "swapAmount == 0");

		Loan storage loanLocal = loans[loanId];
		LoanParams storage loanParamsLocal = loanParams[loanLocal.loanParamsId];
		_checkAuthorized(loanLocal, loanParamsLocal);

		/// Can't swap more than collateral.
		swapAmount = swapAmount > loanLocal.collateral ? loanLocal.collateral : swapAmount;

		//close whole loan if tiny position will remain
		if (loanLocal.collateral - swapAmount > 0) {
			if (_getAmountInRbtc(loanParamsLocal.collateralToken, loanLocal.collateral - swapAmount) <= TINY_AMOUNT) {
				swapAmount = loanLocal.collateral;
			}
		}

		uint256 loanCloseAmountLessInterest;
		if (swapAmount == loanLocal.collateral || returnTokenIsCollateral) {
			/// loanCloseAmountLessInterest will be passed as required amount amount of destination tokens.
			/// this means, the actual swapAmount passed to the swap contract does not matter at all.
			/// the source token amount will be computed depending on the required amount amount of destination tokens.
			loanCloseAmount = swapAmount == loanLocal.collateral
				? loanLocal.principal
				: loanLocal.principal.mul(swapAmount).div(loanLocal.collateral);
			require(loanCloseAmount != 0, "loanCloseAmount == 0");

			/// Computes the interest refund for the borrower and sends it to the lender to cover part of the principal.
			loanCloseAmountLessInterest = _settleInterestToPrincipal(loanLocal, loanParamsLocal, loanCloseAmount, receiver);
		} else {
			/// loanCloseAmount is calculated after swap; for this case we want to swap the entire source amount
			/// and determine the loanCloseAmount and withdraw amount based on that.
			loanCloseAmountLessInterest = 0;
		}

		uint256 coveredPrincipal;
		uint256 usedCollateral;
		/// swapAmount repurposed for collateralToLoanSwapRate to avoid stack too deep error.
		(coveredPrincipal, usedCollateral, withdrawAmount, swapAmount) = _coverPrincipalWithSwap(
			loanLocal,
			loanParamsLocal,
			swapAmount, /// The amount of source tokens to swap (only matters if !returnTokenIsCollateral or loanCloseAmountLessInterest = 0)
			loanCloseAmountLessInterest, /// This is the amount of destination tokens we want to receive (only matters if returnTokenIsCollateral)
			returnTokenIsCollateral,
			loanDataBytes
		);

		if (loanCloseAmountLessInterest == 0) {
			/// Condition prior to swap: swapAmount != loanLocal.collateral && !returnTokenIsCollateral

			/// Amounts that is closed.
			loanCloseAmount = coveredPrincipal;
			if (coveredPrincipal != loanLocal.principal) {
				loanCloseAmount = loanCloseAmount.mul(usedCollateral).div(loanLocal.collateral);
			}
			require(loanCloseAmount != 0, "loanCloseAmount == 0");

			/// Amount that is returned to the lender.
			loanCloseAmountLessInterest = _settleInterestToPrincipal(loanLocal, loanParamsLocal, loanCloseAmount, receiver);

			/// Remaining amount withdrawn to the receiver.
			withdrawAmount = withdrawAmount.add(coveredPrincipal).sub(loanCloseAmountLessInterest);
		} else {
			/// Pay back the amount which was covered by the swap.
			loanCloseAmountLessInterest = coveredPrincipal;
		}

		require(loanCloseAmountLessInterest != 0, "closeAmount is 0 after swap");

		/// Reduce the collateral by the amount which was swapped for the closure.
		if (usedCollateral != 0) {
			loanLocal.collateral = loanLocal.collateral.sub(usedCollateral);
		}

		/// Repays principal to lender.
		/// The lender always gets back an ERC20 (even wrbtc), so we call
		/// withdraw directly rather than use the _withdrawAsset helper function.
		vaultWithdraw(loanParamsLocal.loanToken, loanLocal.lender, loanCloseAmountLessInterest);

		withdrawToken = returnTokenIsCollateral ? loanParamsLocal.collateralToken : loanParamsLocal.loanToken;

		if (withdrawAmount != 0) {
			_withdrawAsset(withdrawToken, receiver, withdrawAmount);
		}

		_finalizeClose(
			loanLocal,
			loanParamsLocal,
			loanCloseAmount,
			usedCollateral,
			swapAmount, /// collateralToLoanSwapRate
			CloseTypes.Swap
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
		bytes memory loanDataBytes
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
		(destTokenAmountReceived, sourceTokenAmountUsed, collateralToLoanSwapRate) = _doCollateralSwap(
			loanLocal,
			loanParamsLocal,
			swapAmount,
			principalNeeded,
			returnTokenIsCollateral,
			loanDataBytes
		);

		if (returnTokenIsCollateral) {
			coveredPrincipal = principalNeeded;

			/// Better fill than expected.
			if (destTokenAmountReceived > coveredPrincipal) {
				/// Send excess to borrower if the amount is big enough to be
				/// worth the gas fees.
				if (worthTheTransfer(loanParamsLocal.loanToken, destTokenAmountReceived - coveredPrincipal)) {
					_withdrawAsset(loanParamsLocal.loanToken, loanLocal.borrower, destTokenAmountReceived - coveredPrincipal);
				}
				/// Else, give the excess to the lender (if it goes to the
				/// borrower, they're very confused. causes more trouble than it's worth)
				else {
					coveredPrincipal = destTokenAmountReceived;
				}
			}
			withdrawAmount = swapAmount > sourceTokenAmountUsed ? swapAmount - sourceTokenAmountUsed : 0;
		} else {
			require(sourceTokenAmountUsed == swapAmount, "swap error");

			if (swapAmount == loanLocal.collateral) {
				/// sourceTokenAmountUsed == swapAmount == loanLocal.collateral

				coveredPrincipal = principalNeeded;
				withdrawAmount = destTokenAmountReceived - principalNeeded;
			} else {
				/// sourceTokenAmountUsed == swapAmount < loanLocal.collateral

				if (destTokenAmountReceived >= loanLocal.principal) {
					/// Edge case where swap covers full principal.

					coveredPrincipal = loanLocal.principal;
					withdrawAmount = destTokenAmountReceived - loanLocal.principal;

					/// Excess collateral refunds to the borrower.
					_withdrawAsset(loanParamsLocal.collateralToken, loanLocal.borrower, loanLocal.collateral - sourceTokenAmountUsed);
					sourceTokenAmountUsed = loanLocal.collateral;
				} else {
					coveredPrincipal = destTokenAmountReceived;
					withdrawAmount = 0;
				}
			}
		}

		usedCollateral = sourceTokenAmountUsed > swapAmount ? sourceTokenAmountUsed : swapAmount;
	}
}
