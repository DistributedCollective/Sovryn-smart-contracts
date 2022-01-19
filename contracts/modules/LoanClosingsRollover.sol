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
 * @title LoanClosingsRollover contract.
 * @notice Ways to close a loan: rollover. Margin trade
 *   positions are always closed with a swap.
 *
 * */
contract LoanClosingsRollover is LoanClosingsShared, LiquidationHelper {
	uint256 internal constant MONTH = 365 days / 12;

	constructor() public {}

	function() external {
		revert("fallback not allowed");
	}

	function initialize(address target) external onlyOwner {
		address prevModuleContractAddress = logicTargets[this.rollover.selector];
		_setTarget(this.rollover.selector, target);
		emit ProtocolModuleContractReplaced(prevModuleContractAddress, target, "LoanClosingsRollover");
	}

	/**
	 * @notice Roll over a loan.
	 *
	 * @dev Public wrapper for _rollover internal function.
	 *
	 * Each loan has a duration. In case of a margin trade it is set to 28
	 * days, in case of borrowing, it can be set by the user. On loan
	 * openning, the user pays the interest for this duration in advance.
	 * If closing early, he gets the excess refunded. If it is not closed
	 * before the end date, it needs to be rolled over. On rollover the
	 * interest is paid for the next period. In case of margin trading
	 * it's 28 days, in case of borrowing it's a month.
	 *
	 * The function rollover on the protocol contract extends the loan
	 * duration by the maximum term (28 days for margin trades at the moment
	 * of writing), pays the interest to the lender and refunds the caller
	 * for the gas cost by sending 2 * the gas cost using the fast gas price
	 * as base for the calculation.
	 *
	 * @param loanId The ID of the loan to roll over.
	 * // param calldata The payload for the call. These loan DataBytes are additional loan data (not in use for token swaps).
	 * */
	function rollover(
		bytes32 loanId,
		bytes calldata // for future use /*loanDataBytes*/
	) external nonReentrant whenNotPaused {
		// restrict to EOAs to prevent griefing attacks, during interest rate recalculation
		require(msg.sender == tx.origin, "EOAs call");

		return
			_rollover(
				loanId,
				"" // loanDataBytes
			);
	}

	/**
	 * @notice Internal function for roll over a loan.
	 *
	 * Each loan has a duration. In case of a margin trade it is set to 28
	 * days, in case of borrowing, it can be set by the user. On loan
	 * openning, the user pays the interest for this duration in advance.
	 * If closing early, he gets the excess refunded. If it is not closed
	 * before the end date, it needs to be rolled over. On rollover the
	 * interest is paid for the next period. In case of margin trading
	 * it's 28 days, in case of borrowing it's a month.
	 *
	 * @param loanId The ID of the loan to roll over.
	 * @param loanDataBytes The payload for the call. These loan DataBytes are
	 *   additional loan data (not in use for token swaps).
	 * */
	function _rollover(bytes32 loanId, bytes memory loanDataBytes) internal {
		(Loan storage loanLocal, LoanParams storage loanParamsLocal) = _checkLoan(loanId);
		require(block.timestamp > loanLocal.endTimestamp.sub(3600), "healthy position");
		require(loanPoolToUnderlying[loanLocal.lender] != address(0), "invalid lender");

		// pay outstanding interest to lender
		_payInterest(loanLocal.lender, loanParamsLocal.loanToken);

		LoanInterest storage loanInterestLocal = loanInterest[loanLocal.id];
		LenderInterest storage lenderInterestLocal = lenderInterest[loanLocal.lender][loanParamsLocal.loanToken];

		_settleFeeRewardForInterestExpense(
			loanInterestLocal,
			loanLocal.id,
			loanParamsLocal.loanToken, /// fee token
			loanParamsLocal.collateralToken, /// pairToken (used to check if there is any special rebates or not) -- to pay fee reward
			loanLocal.borrower,
			block.timestamp
		);

		// Handle back interest: calculates interest owned since the loan endtime passed but the loan remained open
		uint256 backInterestTime;
		uint256 backInterestOwed;
		if (block.timestamp > loanLocal.endTimestamp) {
			backInterestTime = block.timestamp.sub(loanLocal.endTimestamp);
			backInterestOwed = backInterestTime.mul(loanInterestLocal.owedPerDay);
			backInterestOwed = backInterestOwed.div(1 days);
		}

		//note: to avoid code duplication, it would be nicer to store loanParamsLocal.maxLoanTerm in a local variable
		//however, we've got stack too deep issues if we do so.
		if (loanParamsLocal.maxLoanTerm != 0) {
			// fixed-term loan, so need to query iToken for latest variable rate
			uint256 owedPerDay = loanLocal.principal.mul(ILoanPool(loanLocal.lender).borrowInterestRate()).div(365 * 10**20);

			lenderInterestLocal.owedPerDay = lenderInterestLocal.owedPerDay.add(owedPerDay);
			lenderInterestLocal.owedPerDay = lenderInterestLocal.owedPerDay.sub(loanInterestLocal.owedPerDay);

			loanInterestLocal.owedPerDay = owedPerDay;

			//if the loan has been open for longer than an additional period, add at least 1 additional day
			if (backInterestTime >= loanParamsLocal.maxLoanTerm) {
				loanLocal.endTimestamp = loanLocal.endTimestamp.add(backInterestTime).add(1 days);
			}
			//extend by the max loan term
			else {
				loanLocal.endTimestamp = loanLocal.endTimestamp.add(loanParamsLocal.maxLoanTerm);
			}
		} else {
			// loanInterestLocal.owedPerDay doesn't change
			if (backInterestTime >= MONTH) {
				loanLocal.endTimestamp = loanLocal.endTimestamp.add(backInterestTime).add(1 days);
			} else {
				loanLocal.endTimestamp = loanLocal.endTimestamp.add(MONTH);
			}
		}

		uint256 interestAmountRequired = loanLocal.endTimestamp.sub(block.timestamp);
		interestAmountRequired = interestAmountRequired.mul(loanInterestLocal.owedPerDay);
		interestAmountRequired = interestAmountRequired.div(1 days);

		loanInterestLocal.depositTotal = loanInterestLocal.depositTotal.add(interestAmountRequired);

		lenderInterestLocal.owedTotal = lenderInterestLocal.owedTotal.add(interestAmountRequired);

		// add backInterestOwed
		interestAmountRequired = interestAmountRequired.add(backInterestOwed);

		// collect interest (needs to be converted from the collateral)
		(uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed, ) =
			_doCollateralSwap(
				loanLocal,
				loanParamsLocal,
				0, //min swap 0 -> swap connector estimates the amount of source tokens to use
				interestAmountRequired, //required destination tokens
				true, // returnTokenIsCollateral
				loanDataBytes
			);

		//received more tokens than needed to pay the interest
		if (destTokenAmountReceived > interestAmountRequired) {
			// swap rest back to collateral, if the amount is big enough to cover gas cost
			if (worthTheTransfer(loanParamsLocal.loanToken, destTokenAmountReceived - interestAmountRequired)) {
				(destTokenAmountReceived, , ) = _swapBackExcess(
					loanLocal,
					loanParamsLocal,
					destTokenAmountReceived - interestAmountRequired, //amount to be swapped
					loanDataBytes
				);
				sourceTokenAmountUsed = sourceTokenAmountUsed.sub(destTokenAmountReceived);
			}
			//else give it to the protocol as a lending fee
			else {
				_payLendingFee(loanLocal.borrower, loanParamsLocal.loanToken, destTokenAmountReceived - interestAmountRequired);
			}
		}

		//subtract the interest from the collateral
		loanLocal.collateral = loanLocal.collateral.sub(sourceTokenAmountUsed);

		if (backInterestOwed != 0) {
			// pay out backInterestOwed

			_payInterestTransfer(loanLocal.lender, loanParamsLocal.loanToken, backInterestOwed);
		}

		uint256 rolloverReward = _getRolloverReward(loanParamsLocal.collateralToken, loanParamsLocal.loanToken, loanLocal.principal);

		if (rolloverReward != 0) {
			// if the reward > collateral:
			if (rolloverReward > loanLocal.collateral) {
				// 1. pay back the remaining loan to the lender
				// 2. pay the remaining collateral to msg.sender
				// 3. close the position & emit close event
				_closeWithSwap(
					loanLocal.id,
					msg.sender,
					loanLocal.collateral,
					false,
					"" // loanDataBytes
				);
			} else {
				// pay out reward to caller
				loanLocal.collateral = loanLocal.collateral.sub(rolloverReward);

				_withdrawAsset(loanParamsLocal.collateralToken, msg.sender, rolloverReward);
			}
		}

		if (loanLocal.collateral > 0) {
			//close whole loan if tiny position will remain
			if (_getAmountInRbtc(loanParamsLocal.loanToken, loanLocal.principal) <= TINY_AMOUNT) {
				_closeWithSwap(
					loanLocal.id,
					loanLocal.borrower,
					loanLocal.collateral, // swap all collaterals
					false,
					"" /// loanDataBytes
				);
			} else {
				(uint256 currentMargin, ) =
					IPriceFeeds(priceFeeds).getCurrentMargin(
						loanParamsLocal.loanToken,
						loanParamsLocal.collateralToken,
						loanLocal.principal,
						loanLocal.collateral
					);

				require(
					currentMargin > 3 ether, // ensure there's more than 3% margin remaining
					"unhealthy position"
				);
			}
		}

		emit Rollover(
			loanLocal.borrower, // user (borrower)
			loanLocal.lender, // lender
			loanLocal.id, // loanId
			loanLocal.principal, // principal
			loanLocal.collateral, // collateral
			loanLocal.endTimestamp, // endTimestamp
			msg.sender, // rewardReceiver
			rolloverReward // reward
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
