/**
 * Test file simulating the bancor network
 * */

pragma solidity 0.5.17;

import "../openzeppelin/SafeERC20.sol";
import "../feeds/IPriceFeeds.sol";
import "./TestToken.sol";
import "../openzeppelin/SafeMath.sol";

contract TestBancor {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    
    address public priceFeeds;
    
    constructor(address feed) public{
        priceFeeds = feed;
    }
    
    function addressOf(bytes32 contractName) public view returns(address){
        return address(this);
    }
    
    function convertByPath(
        IERC20[] calldata _path, 
        uint256 _amount, 
        uint256 _minReturn, 
        address _beneficiary, 
        address _affiliateAccount, 
        uint256 _affiliateFee
    ) external payable returns (uint256){
        TestToken(address(_path[0])).burn(address(msg.sender), _amount);
        TestToken(address(_path[1])).mint(address(msg.sender), _minReturn);
        return _minReturn;
    }
    
    function rateByPath(
        IERC20[] calldata _path, 
        uint256 _amount
    ) external view returns (uint256){
        (uint256 sourceToDestRate, uint256 sourceToDestPrecision) = IPriceFeeds(priceFeeds).queryRate(
            address(_path[0]),
            address(_path[1])
        );

        return _amount
            .mul(sourceToDestRate)
            .div(sourceToDestPrecision);

    }
    
    function conversionPath(
        IERC20 _sourceToken, 
        IERC20 _targetToken
    ) external view returns (IERC20[] memory){
        IERC20[] memory path = new IERC20[](2);
        path[0] = _sourceToken; 
        path[1] = _targetToken;
        return  path;
    }
}