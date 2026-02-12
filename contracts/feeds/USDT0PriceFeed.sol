pragma solidity 0.5.17;

/**
 * @title USDT0 Price Feed Wrapper
 * @notice Wraps the Redstone USDT price feed and normalizes from 8 decimals to 18 decimals
 * for compatibility with Sovryn's PriceFeeds contract.
 *
 * Redstone USDT Price Feed on RSK Mainnet: 0x09639692ce6Ff12a06cA3AE9a24B3aAE4cD80dc8
 * Contract: RootstockPriceFeedUsdtWithoutRoundsV1
 * - latestRoundData() returns (roundId, answer, startedAt, updatedAt, answeredInRound)
 * - answer is in 8 decimals
 * - decimals() returns 8
 *
 * This wrapper:
 * 1. Validates price data is not stale or invalid
 * 2. Scales the price from 8 decimals to 18 decimals for Sovryn compatibility
 */

interface IRedstoneOracle {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
    function decimals() external view returns (uint8);
}

contract USDT0PriceFeed {
    IRedstoneOracle public oracle;

    /// @dev Maximum acceptable age for price data (24 hours)
    /// After this time, price is considered stale (referred to the heartbet of redstone)
    uint256 public constant MAX_PRICE_AGE = 24 hours;

    /**
     * @notice Constructor
     * @param _oracle The address of the Redstone USDT price feed (0x09639692ce6Ff12a06cA3AE9a24B3aAE4cD80dc8)
     */
    constructor(address _oracle) public {
        require(_oracle != address(0), "Invalid oracle address");
        oracle = IRedstoneOracle(_oracle);
    }

    /**
     * @notice Get the latest price from Redstone oracle and scale to 18 decimals
     * @dev Performs validation checks on the oracle data:
     *      - Price must be greater than 0
     *      - Price must not be stale (updated within MAX_PRICE_AGE)
     *      - Round must be complete (answeredInRound >= roundId)
     *
     *      Redstone returns 8 decimals (e.g., 99937000 = $0.99937)
     *      We scale to 18 decimals (e.g., 999370000000000000 = $0.99937)
     *
     * @return The validated price with 18 decimals
     */
    function latestAnswer() external view returns (uint256) {
        (uint80 roundId, int256 answer, , uint256 updatedAt, uint80 answeredInRound) = oracle
            .latestRoundData();

        // Validate price data
        require(answer > 0, "Invalid price: answer <= 0");
        require(updatedAt > 0, "Invalid price: updatedAt = 0");
        require(answeredInRound >= roundId, "Stale price: round not complete");
        require(block.timestamp - updatedAt <= MAX_PRICE_AGE, "Stale price: too old");

        uint256 price = uint256(answer);
        uint8 oracleDecimals = oracle.decimals();

        // Scale from oracle decimals to 18 decimals
        // price * 10^(18 - oracleDecimals)
        if (oracleDecimals < 18) {
            return price * (10 ** (18 - uint256(oracleDecimals)));
        } else if (oracleDecimals > 18) {
            return price / (10 ** (uint256(oracleDecimals) - 18));
        } else {
            return price;
        }
    }
}
