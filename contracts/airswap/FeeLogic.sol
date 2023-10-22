pragma solidity 0.5.17;

import "../openzeppelin/SafeMath.sol";
import "../openzeppelin/Ownable.sol";
import "../openzeppelin/IERC20_.sol";

import "./IFeeLogic.sol";

contract FeeLogic is Ownable, IFeeLogic {
    using SafeMath for uint256;

    uint256 public constant POINTS = 1000;

    uint256 public inputFeeInPoints;
    uint256 public outputFeeInPoints;

    event InputFeeChanged(address indexed sender, uint256 feeInPoints);
    event OutputFeeChanged(address indexed sender, uint256 feeInPoints);

    /*** setters  ***/

    function setInputFee(uint256 _inputFeeInPoints) public onlyOwner {
        inputFeeInPoints = _inputFeeInPoints;
        emit InputFeeChanged(msg.sender, inputFeeInPoints);
    }

    function setOutputFee(uint256 _outputFeeInPoints) public onlyOwner {
        outputFeeInPoints = _outputFeeInPoints;
        emit OutputFeeChanged(msg.sender, outputFeeInPoints);
    }

    function calculateInputFee(uint256 _sendAmount) public returns (uint256) {
        return _sendAmount.mul(inputFeeInPoints).div(POINTS);
    }

    function calculateOutputFee(uint256 _receiveAmount) public returns (uint256) {
        return _receiveAmount.mul(outputFeeInPoints).div(POINTS);
    }
}
