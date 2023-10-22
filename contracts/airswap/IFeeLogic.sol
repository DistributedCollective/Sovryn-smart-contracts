pragma solidity 0.5.17;

interface IFeeLogic {

    function setInputFee(uint256 _inputFeeInPoints) external;
    function setOutputFee(uint256 _outputFeeInPoints) external;

    function calculateInputFee(uint256 sendAmount) external returns (uint256);
    function calculateOutputFee(uint256 receiveAmount) external returns (uint256);
}
