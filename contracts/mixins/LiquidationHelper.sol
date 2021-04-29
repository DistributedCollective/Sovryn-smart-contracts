/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../core/State.sol";

/**
 * @title The Liquidation Helper contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized margin
 * trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract computes the liquidation amount.
 * */
contract LiquidationHelper is State {
	/**
	 * @notice Compute how much needs to be liquidated in order to restore the
	 * desired margin (maintenance + 5%).
	 *
	 * @param principal The total borrowed amount (in loan tokens).
	 * @param collateral The collateral (in collateral tokens).
	 * @param currentMargin The current margin.
	 * @param maintenanceMargin The maintenance (minimum) margin.
	 * @param collateralToLoanRate The exchange rate from collateral to loan
	 *   tokens.
	 *
	 * @return maxLiquidatable The collateral you can get liquidating.
	 * @return maxSeizable The loan you available for liquidation.
	 * @return incentivePercent The discount on collateral.
	 * */
	function _getLiquidationAmounts(
		uint256 principal,
		uint256 collateral,
		uint256 currentMargin,
		uint256 maintenanceMargin,
		uint256 collateralToLoanRate
	)
		internal
		view
		returns (
			uint256 maxLiquidatable,
			uint256 maxSeizable,
			uint256 incentivePercent
		)
	{
		incentivePercent = liquidationIncentivePercent;
		if (currentMargin > maintenanceMargin || collateralToLoanRate == 0) {
			return (maxLiquidatable, maxSeizable, incentivePercent);
		} else if (currentMargin <= incentivePercent) {
			return (principal, collateral, currentMargin);
		}

		/// 5 percentage points above maintenance.
		uint256 desiredMargin = maintenanceMargin.add(5 ether);

		/// maxLiquidatable = ((1 + desiredMargin)*principal - collateralToLoanRate*collateral) / (desiredMargin - 0.05)
		maxLiquidatable = desiredMargin.add(10**20).mul(principal).div(10**20);
		maxLiquidatable = maxLiquidatable.sub(collateral.mul(collateralToLoanRate).div(10**18));
		maxLiquidatable = maxLiquidatable.mul(10**20).div(desiredMargin.sub(incentivePercent));
		if (maxLiquidatable > principal) {
			maxLiquidatable = principal;
		}

		/// maxSeizable = maxLiquidatable * (1 + incentivePercent) / collateralToLoanRate
		maxSeizable = maxLiquidatable.mul(incentivePercent.add(10**20));
		maxSeizable = maxSeizable.div(collateralToLoanRate).div(100);
		if (maxSeizable > collateral) {
			maxSeizable = collateral;
		}

		return (maxLiquidatable, maxSeizable, incentivePercent);
	}
}
