pragma solidity ^0.5.17;

/**
 * @title Interface for Four Year Vesting contract.
 * @dev Interfaces are used to cast a contract address into a callable instance.
 * This interface is used by FourYearVestingLogic contract to implement stakeTokens function
 * and on VestingRegistry contract to call IFourYearVesting(vesting).stakeTokens function
 * at a vesting instance.
 */
interface IFourYearVesting {
	function duration() external returns (uint256);

	function endDate() external returns (uint256);

	function stakeTokens(uint256 _amount, uint256 _restartStakeSchedule) external returns (uint256 lastSchedule, uint256 remainingAmount);
}
