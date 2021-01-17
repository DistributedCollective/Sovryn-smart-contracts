pragma solidity >=0.4.26 <=0.5.17;

import "../../../interfaces/IERC20.sol";

contract ISovrynSwapNetwork {
    function convertByPath(
        IERC20[] calldata _path,
        uint256 _amount,
        uint256 _minReturn,
        address _beneficiary,
        address _affiliateAccount,
        uint256 _affiliateFee
    ) external payable returns (uint256);

    function rateByPath(IERC20[] calldata _path, uint256 _amount)
        external
        view
        returns (uint256);

    function conversionPath(IERC20 _sourceToken, IERC20 _targetToken)
        external
        view
        returns (IERC20[] memory);
}
