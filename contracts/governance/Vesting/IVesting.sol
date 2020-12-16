pragma solidity ^0.5.17;

interface IVesting {
    function duration() external returns (uint);
    function endDate() external returns (uint);
    function stakeTokens(uint amount) external;
}