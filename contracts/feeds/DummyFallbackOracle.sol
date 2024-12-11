// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

/// @title A generic interface for external price providers
interface IExternalPriceFeed {
    /// @dev The returned price should be 18-decimal value
    /// @return the prive value and a boolean stating if the query was successful
    function latestAnswer() external view returns (uint256, bool);
}

/**
 * @dev Dummy Oracle contract that supports MoC medianizer interface (latestAnswer) which will always return (0, false) value
 */
contract DummyFallbackOracle is IExternalPriceFeed {
    constructor() public {}

    /**
     * @dev dummy function to support MoC medianizer
     * @return priceValue which is hardcoded to 0
     * @return flag that indicate if the price is valid or not, hardcoded to false
     */
    function latestAnswer() external view returns (uint256, bool) {
        return (0, false);
    }
}
