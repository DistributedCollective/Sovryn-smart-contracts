pragma solidity 0.5.17;

interface ISovrynLBPairDex {
    function getProtocolFees() external view returns (uint128 protocolFeeX, uint128 protocolFeeY);

    function collectProtocolFees() external returns (bytes32 collectedProtocolFees);

    function getTokenX() external view returns (address tokenX);

    function getTokenY() external view returns (address tokenY);
}
