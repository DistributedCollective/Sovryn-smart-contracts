pragma solidity 0.5.17;

interface ISovrynLBFactoryDex {
    function getNumberOfLBPairs() external view returns (uint256);

    function getLBPairAtIndex(uint256 id) external returns (address);

    function getFeeRecipient() external view returns (address);
}
