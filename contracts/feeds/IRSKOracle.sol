pragma solidity >=0.5.0 <0.6.0;

interface IRSKOracle {
    function updatePrice(uint256 price, uint256 timestamp) external;

    function getPricing() external view returns (uint256, uint256);

    function setOracleAddress(address addr) external;

    function clearOracleAddress() external;
}
