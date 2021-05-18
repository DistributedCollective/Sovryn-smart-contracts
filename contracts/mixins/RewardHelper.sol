pragma solidity 0.5.17;

import "../core/State.sol";
import "../feeds/IPriceFeeds.sol";

/**
 * @title The Reward Helper contract.
 * @notice This contract calculates the reward for rollover transactions.
 *
 * A rollover is a renewal of a deposit. Instead of liquidating a deposit
 * on maturity, you can roll it over into a new deposit. The outstanding
 * principal of the old deposit is rolled over with or without the interest
 * outstanding on it.
 * */
contract RewardHelper is State {
	using SafeMath for uint256;

	/**
	 * @notice Calculate the reward of a rollover transaction.
	 *
	 * @param collateralToken The address of the collateral token.
	 * @param loanToken The address of the loan token.
	 * @param positionSize The amount of value of the position.
	 *
	 * @return The base fee + the flex fee.
	 */
	function _getRolloverReward(
		address collateralToken,
		address loanToken,
		uint256 positionSize
	) internal view returns (uint256 reward) {
		uint256 positionSizeInCollateralToken = IPriceFeeds(priceFeeds).queryReturn(loanToken, collateralToken, positionSize);
		uint256 rolloverBaseRewardInCollateralToken =
			IPriceFeeds(priceFeeds).queryReturn(address(wrbtcToken), collateralToken, rolloverBaseReward);

		return
			rolloverBaseRewardInCollateralToken
				.mul(2) /// baseFee
				.add(positionSizeInCollateralToken.mul(rolloverFlexFeePercent).div(10**20)); /// flexFee = 0.1% of position size
	}
}
