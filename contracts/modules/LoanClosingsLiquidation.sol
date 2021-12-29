/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../mixins/LiquidationHelper.sol";
import "../interfaces/ILoanPool.sol";
import "./LoanClosingsShared.sol";

/**
 * @title LoanClosingsLiquidation contract.
 * @notice Ways to close a loan: liquidation. Margin trade
 *   positions are always closed with a swap.
 *
 * Loans are liquidated if the position goes below margin maintenance.
 * */
contract LoanClosingsLiquidation is LoanClosingsShared, LiquidationHelper {
	uint256 internal constant MONTH = 365 days / 12;

	constructor() public {}

	function() external {
		revert("fallback not allowed");
	}

	function initialize(address target) external onlyOwner {
		address prevModuleContractAddress = logicTargets[this.liquidate.selector];
		_setTarget(this.liquidate.selector, target);
		emit ProtocolModuleContractReplaced(prevModuleContractAddress, target, "LoanClosingsLiquidation");
	}

	/**
	 * @notice Liquidate an unhealty loan.
	 *
	 * @dev Public wrapper for _liquidate internal function.
	 *
	 * The caller needs to approve the closeAmount prior to calling. Will
	 * not liquidate more than is needed to restore the desired margin
	 * (maintenance +5%).
	 *
	 * Whenever the current margin of a loan falls below maintenance margin,
	 * it needs to be liquidated. Anybody can initiate a liquidation and buy
	 * the collateral tokens at a discounted rate (5%).
	 *
	 * @param loanId The ID of the loan to liquidate.
	 *   loanId is the ID of the loan, which is created on loan opening.
	 *   It can be obtained either by parsing the Trade event or by reading
	 *   the open loans from the contract by calling getActiveLoans or getUserLoans.
	 * @param receiver The receiver of the seized amount.
	 * @param closeAmount The amount to close in loanTokens.
	 *
	 * @return loanCloseAmount The amount of the collateral token of the loan.
	 * @return seizedAmount The seized amount in the collateral token.
	 * @return seizedToken The loan token address.
	 * */
	function liquidate(
		bytes32 loanId,
		address receiver,
		uint256 closeAmount // denominated in loanToken
	)
		external
		payable
		nonReentrant
		whenNotPaused
		returns (
			uint256 loanCloseAmount,
			uint256 seizedAmount,
			address seizedToken
		)
	{
		return _liquidate(loanId, receiver, closeAmount);
	}

	/**
	 * @notice Internal function for liquidating an unhealthy loan.
	 *
	 * The caller needs to approve the closeAmount prior to calling. Will
	 * not liquidate more than is needed to restore the desired margin
	 * (maintenance +5%).
	 *
	 * Whenever the current margin of a loan falls below maintenance margin,
	 * it needs to be liquidated. Anybody can initiate a liquidation and buy
	 * the collateral tokens at a discounted rate (5%).
	 *
	 * @param loanId The ID of the loan to liquidate.
	 * @param receiver The receiver of the seized amount.
	 * @param closeAmount The amount to close in loanTokens.
	 *
	 * @return loanCloseAmount The amount of the collateral token of the loan.
	 * @return seizedAmount The seized amount in the collateral token.
	 * @return seizedToken The loan token address.
	 * */
	function _liquidate(
		bytes32 loanId,
		address receiver,
		uint256 closeAmount
	)
		internal
		returns (
			uint256 loanCloseAmount,
			uint256 seizedAmount,
			address seizedToken
		)
	{
		(Loan storage loanLocal, LoanParams storage loanParamsLocal) = _checkLoan(loanId);

		(uint256 currentMargin, uint256 collateralToLoanRate) =
			IPriceFeeds(priceFeeds).getCurrentMargin(
				loanParamsLocal.loanToken,
				loanParamsLocal.collateralToken,
				loanLocal.principal,
				loanLocal.collateral
			);
		require(currentMargin <= loanParamsLocal.maintenanceMargin, "healthy position");

		loanCloseAmount = closeAmount;

		//amounts to restore the desired margin (maintencance + 5%)
		(uint256 maxLiquidatable, uint256 maxSeizable, ) =
			_getLiquidationAmounts(
				loanLocal.principal,
				loanLocal.collateral,
				currentMargin,
				loanParamsLocal.maintenanceMargin,
				collateralToLoanRate
			);

		if (loanCloseAmount < maxLiquidatable) {
			//close maxLiquidatable if tiny position will remain
			uint256 remainingAmount = maxLiquidatable - loanCloseAmount;
			remainingAmount = _getAmountInRbtc(loanParamsLocal.loanToken, remainingAmount);
			if (remainingAmount <= TINY_AMOUNT) {
				loanCloseAmount = maxLiquidatable;
				seizedAmount = maxSeizable;
			} else {
				seizedAmount = maxSeizable.mul(loanCloseAmount).div(maxLiquidatable);
			}
		} else if (loanCloseAmount > maxLiquidatable) {
			// adjust down the close amount to the max
			loanCloseAmount = maxLiquidatable;
			seizedAmount = maxSeizable;
		} else {
			seizedAmount = maxSeizable;
		}

		require(loanCloseAmount != 0, "nothing to liquidate");

		// liquidator deposits the principal being closed
		_returnPrincipalWithDeposit(loanParamsLocal.loanToken, address(this), loanCloseAmount);

		// a portion of the principal is repaid to the lender out of interest refunded
		uint256 loanCloseAmountLessInterest = _settleInterestToPrincipal(loanLocal, loanParamsLocal, loanCloseAmount, loanLocal.borrower);

		if (loanCloseAmount > loanCloseAmountLessInterest) {
			// full interest refund goes to the borrower
			_withdrawAsset(loanParamsLocal.loanToken, loanLocal.borrower, loanCloseAmount - loanCloseAmountLessInterest);
		}

		if (loanCloseAmountLessInterest != 0) {
			// The lender always gets back an ERC20 (even wrbtc), so we call withdraw directly rather than
			// use the _withdrawAsset helper function
			vaultWithdraw(loanParamsLocal.loanToken, loanLocal.lender, loanCloseAmountLessInterest);
		}

		seizedToken = loanParamsLocal.collateralToken;

		if (seizedAmount != 0) {
			loanLocal.collateral = loanLocal.collateral.sub(seizedAmount);

			_withdrawAsset(seizedToken, receiver, seizedAmount);
		}

		_closeLoan(loanLocal, loanCloseAmount);

		_emitClosingEvents(
			loanParamsLocal,
			loanLocal,
			loanCloseAmount,
			seizedAmount,
			collateralToLoanRate,
			0,
			currentMargin,
			CloseTypes.Liquidation
		);
	}

	/**
	 * @notice Swap back excessive loan tokens to collateral tokens.
	 *
	 * @param loanLocal The loan object.
	 * @param loanParamsLocal The loan parameters.
	 * @param swapAmount The amount to be swapped.
	 * @param loanDataBytes Additional loan data (not in use for token swaps).
	 *
	 * @return destTokenAmountReceived The amount of destiny tokens received.
	 * @return sourceTokenAmountUsed The amount of source tokens used.
	 * @return collateralToLoanSwapRate The swap rate of collateral.
	 * */
	function _swapBackExcess(
		Loan memory loanLocal,
		LoanParams memory loanParamsLocal,
		uint256 swapAmount,
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
			loanParamsLocal.loanToken,
			loanParamsLocal.collateralToken,
			loanLocal.borrower,
			swapAmount, // minSourceTokenAmount
			swapAmount, // maxSourceTokenAmount
			0, // requiredDestTokenAmount
			false, // bypassFee
			loanDataBytes
		);
		require(sourceTokenAmountUsed <= swapAmount, "excessive source amount");
	}
}
