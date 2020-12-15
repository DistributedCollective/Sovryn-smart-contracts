pragma solidity ^0.5.17;

interface IVesting {
    function governanceWithdrawTokens(address receiver) external;
}