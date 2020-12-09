pragma solidity >=0.5.0 <0.6.0;

interface IRSKOracle {

    function updatePrice(uint price, uint timestamp) external;

    function getPricing() external view returns(uint, uint);

    function setOracleAddress(address addr) external;

    function clearOracleAddress() external;

}