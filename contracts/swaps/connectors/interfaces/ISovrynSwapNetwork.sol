pragma solidity >=0.4.26 <=0.5.17;

import "../../../interfaces/IERC20Sovryn.sol";

contract ISovrynSwapNetwork {

    function convertByPath(
        IERC20Sovryn[] calldata _path,
        uint256 _amount,
        uint256 _minReturn,
        address _beneficiary,
        address _affiliateAccount,
        uint256 _affiliateFee
    ) external payable returns (uint256);

    function rateByPath(
        IERC20Sovryn[] calldata _path,
        uint256 _amount
    ) external view returns (uint256);

    function conversionPath(
        IERC20Sovryn _sourceToken,
        IERC20Sovryn _targetToken
    ) external view returns (IERC20Sovryn[] memory);
}


