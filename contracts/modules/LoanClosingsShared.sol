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
import "../interfaces/ILoanPool.sol";
import "../mixins/RewardHelper.sol";
import "./ModuleCommonFunctionalities.sol";

/**
 * @title LoanClosingsShared contract.
 * @notice This contract should only contains the internal function that is being used / utilized by
 *   LoanClosingsBase & LoanClosingsWith contract
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

	enum CloseTypes { Deposit, Swap, Liquidation }

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
		uint256 interestRefundToBorrower = _settleInterest(loanParamsLocal, loanLocal, loanCloseAmountLessInterest);

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
		emit swapExcess(amountInRbtc > paySwapExcessToBorrowerThreshold, amount, amountInRbtc, paySwapExcessToBorrowerThreshold);
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
	function _withdrawAsset(
		address assetToken,
		address receiver,
		uint256 assetAmount
	) internal {
		if (assetAmount != 0) {
			if (assetToken == address(wrbtcToken)) {
				vaultEtherWithdraw(receiver, assetAmount);
			} else {
				vaultWithdraw(assetToken, receiver, assetAmount);
			}
		}
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
		LenderInterest storage lenderInterestLocal = lenderInterest[loanLocal.lender][loanParamsLocal.loanToken];

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
			owedPerDayRefund = loanInterestLocal.owedPerDay.mul(closePrincipal).div(loanLocal.principal);
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
			loanInterestLocal.depositTotal = loanInterestLocal.depositTotal.sub(interestRefundToBorrower);
		} else {
			loanInterestLocal.depositTotal = 0;
		}

		// update remaining lender interest values
		lenderInterestLocal.principalTotal = lenderInterestLocal.principalTotal.sub(closePrincipal);

		uint256 owedTotal = lenderInterestLocal.owedTotal;
		lenderInterestLocal.owedTotal = owedTotal > interestRefundToBorrower ? owedTotal - interestRefundToBorrower : 0;

		return interestRefundToBorrower;
	}

  /**
	 * @notice Check sender is borrower or delegatee and loan id exists.
	 *
	 * @param loanLocal The loan object.
	 * @param loanParamsLocal The loan params.
	 * */
	function _checkAuthorized(Loan memory loanLocal, LoanParams memory loanParamsLocal) internal view {
		require(loanLocal.active, "loan is closed");
		require(msg.sender == loanLocal.borrower || delegatedManagers[loanLocal.id][msg.sender], "unauthorized");
		require(loanParamsLocal.id != 0, "loanParams not exists");
	}

  /**
	 * @notice Internal function for closing a loan by doing a deposit.
	 *
	 * @param loanId The id of the loan.
	 * @param receiver The receiver of the remainder.
	 * @param depositAmount Defines how much of the position should be closed.
	 *   It is denominated in loan tokens.
	 *     If depositAmount > principal, the complete loan will be closed
	 *     else deposit amount (partial closure).
	 *
	 * @return loanCloseAmount The amount of the collateral token of the loan.
	 * @return withdrawAmount The withdraw amount in the collateral token.
	 * @return withdrawToken The loan token address.
	 * */
	function _closeWithDeposit(
		bytes32 loanId,
		address receiver,
		uint256 depositAmount /// Denominated in loanToken.
	)
		internal
		returns (
			uint256 loanCloseAmount,
			uint256 withdrawAmount,
			address withdrawToken
		)
	{
		require(depositAmount != 0, "depositAmount == 0");

		Loan storage loanLocal = loans[loanId];
		LoanParams storage loanParamsLocal = loanParams[loanLocal.loanParamsId];
		//TODO should we skip this check if invoked from rollover ?
		_checkAuthorized(loanLocal, loanParamsLocal);

		/// Can't close more than the full principal.
		loanCloseAmount = depositAmount > loanLocal.principal ? loanLocal.principal : depositAmount;

		//close whole loan if tiny position will remain
		uint256 remainingAmount = loanLocal.principal - loanCloseAmount;
		if (remainingAmount > 0) {
			remainingAmount = _getAmountInRbtc(loanParamsLocal.loanToken, remainingAmount);
			if (remainingAmount <= TINY_AMOUNT) {
				loanCloseAmount = loanLocal.principal;
			}
		}

		uint256 loanCloseAmountLessInterest = _settleInterestToPrincipal(loanLocal, loanParamsLocal, loanCloseAmount, receiver);

		if (loanCloseAmountLessInterest != 0) {
			_returnPrincipalWithDeposit(loanParamsLocal.loanToken, loanLocal.lender, loanCloseAmountLessInterest);
		}

		if (loanCloseAmount == loanLocal.principal) {
			withdrawAmount = loanLocal.collateral;
		} else {
			withdrawAmount = loanLocal.collateral.mul(loanCloseAmount).div(loanLocal.principal);
		}

		withdrawToken = loanParamsLocal.collateralToken;

		if (withdrawAmount != 0) {
			loanLocal.collateral = loanLocal.collateral.sub(withdrawAmount);
			_withdrawAsset(withdrawToken, receiver, withdrawAmount);
		}

		_finalizeClose(
			loanLocal,
			loanParamsLocal,
			loanCloseAmount,
			withdrawAmount, /// collateralCloseAmount
			0, /// collateralToLoanSwapRate
			CloseTypes.Deposit
		);
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
		(bool success, bytes memory data) =
			_priceFeeds.staticcall(
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
				collateralToLoanSwapRate = SafeMath.div(10**36, collateralToLoanSwapRate);
			}

			/// currentLeverage = 100 / currentMargin
			if (currentMargin != 0) {
				currentMargin = SafeMath.div(10**38, currentMargin);
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
	function _getAmountInRbtc(address asset, uint256 amount) internal returns (uint256) {
		(uint256 rbtcRate, uint256 rbtcPrecision) = IPriceFeeds(priceFeeds).queryRate(asset, address(wrbtcToken));
		return amount.mul(rbtcRate).div(rbtcPrecision);
	}
}