pragma solidity 0.5.17;

import "./PriceFeeds.sol";

contract SOVPriceFeed is IPriceFeedsExt {
	uint256 private constant SOV_RATE = 1 ether;

	/**
	 * @dev returns the trivial SOV/SOV rate
	 *
	 * @return always returns the trivial rate of 1
	 */
	function latestAnswer() external view returns (uint256) {
		return SOV_RATE;
	}

	/**
	 * @dev returns the update time
	 *
	 * @return always returns current block's timestamp
	 */
	function latestTimestamp() external view returns (uint256) {
		return now;
	}
}
