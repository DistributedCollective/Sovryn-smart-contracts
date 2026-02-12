/**
 * Mock Redstone Oracle for testing USDT0PriceFeed wrapper
 * Simulates Redstone's USDT price feed which returns 8 decimals
 * Implements latestRoundData() for realistic testing
 */

pragma solidity 0.5.17;

contract MockRedstoneOracle {
    int256 private price;
    uint80 private currentRound;
    uint256 private lastUpdateTime;

    constructor() public {
        price = 100000000; // $1.00 with 8 decimals
        currentRound = 1;
        lastUpdateTime = block.timestamp;
    }

    function setPrice(int256 _price) external {
        price = _price;
        currentRound++;
        lastUpdateTime = block.timestamp;
    }

    function setUpdatedAt(uint256 _timestamp) external {
        lastUpdateTime = _timestamp;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (currentRound, price, lastUpdateTime, lastUpdateTime, currentRound);
    }

    /// @dev Always returns 8 decimals to match real Redstone oracle
    function decimals() external pure returns (uint8) {
        return 8;
    }
}
