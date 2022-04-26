pragma solidity 0.5.17;

import "./PriceFeeds.sol";

/**
 * @notice The Price Feed USDT contract.
 *
 * This contract implements USDT query functionality,
 * getting the price and the last timestamp from a
 * trivial formula, always returning 1 and now.
 * */
contract USDTPriceFeed is IPriceFeedsExt {
    uint256 private constant USDT_RATE = 1 ether;

    /**
     * @notice Get the USDT price.
     *
     * @return Always returns the trivial rate of 1.
     * */
    function latestAnswer() external view returns (uint256) {
        return USDT_RATE;
    }

    /**
     * @notice Get the las time the price was updated.
     * @return Always trivial current block's timestamp.
     */
    function latestTimestamp() external view returns (uint256) {
        return now;
    }
}
