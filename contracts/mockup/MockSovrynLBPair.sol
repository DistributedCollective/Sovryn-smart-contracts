pragma solidity 0.5.17;

import "../interfaces/IERC20.sol";
import "../governance/IFeeSharingCollectorMultiToken.sol";
import "../interfaces/ISovrynLBFactoryDex.sol";

contract MockSovrynLBPair {
    address lbFactory;
    address tokenX;
    address tokenY;

    uint128 amountTokenX;
    uint128 amountTokenY;

    modifier onlyFeeRecipient() {
        require(
            ISovrynLBFactoryDex(lbFactory).getFeeRecipient() == msg.sender,
            "Only feeRecipient"
        );
        _;
    }

    function getTokenX() public returns (address _tokenX) {
        return tokenX;
    }

    function getTokenY() public returns (address _tokenY) {
        return tokenY;
    }

    constructor(
        address _lbFactory,
        address _tokenX,
        address _tokenY,
        uint128 _amountTokenX,
        uint128 _amountTokenY
    ) public {
        tokenX = _tokenX;
        tokenY = _tokenY;
        amountTokenX = _amountTokenX;
        amountTokenY = _amountTokenY;
        lbFactory = _lbFactory;
    }

    function getProtocolFees() public view returns (uint128 protocolFeeX, uint128 protocolFeeY) {
        return (amountTokenX, amountTokenY);
    }

    function collectProtocolFees() public onlyFeeRecipient returns (bytes32) {
        IERC20(tokenX).transfer(msg.sender, amountTokenX);
        IERC20(tokenY).transfer(msg.sender, amountTokenY);
    }
}
