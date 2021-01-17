pragma solidity >=0.5.0 <0.6.0;

interface IMoCState {
    function getRbtcInBitPro(bytes32 bucket) external view returns (uint256);

    function globalMaxBPro() external view returns (uint256);

    function maxBPro(bytes32 bucket) external view returns (uint256);

    function absoluteMaxBPro() external view returns (uint256);

    function maxBProWithDiscount() external view returns (uint256);

    function bproTecPrice() external view returns (uint256);

    function bucketBProTecPrice(bytes32 bucket) external view returns (uint256);

    function bproDiscountPrice() external view returns (uint256);

    function bproUsdPrice() external view returns (uint256);

    function bproSpotDiscountRate() external view returns (uint256);

    function getBucketNBPro(bytes32 bucket) external view returns (uint256);
}
