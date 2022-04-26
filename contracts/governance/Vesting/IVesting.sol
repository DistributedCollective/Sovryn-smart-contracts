pragma solidity ^0.5.17;

/**
 * @title Interface for Vesting contract.
 * @dev Interfaces are used to cast a contract address into a callable instance.
 * This interface is used by VestingLogic contract to implement stakeTokens function
 * and on VestingRegistry contract to call IVesting(vesting).stakeTokens function
 * at a vesting instance.
 */
interface IVesting {
    function duration() external returns (uint256);

    function endDate() external returns (uint256);

    function stakeTokens(uint256 amount) external;
}
