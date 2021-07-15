pragma solidity ^0.5.17;

/**
 * @title Interface for TeamVesting contract.
 * @dev Interfaces are used to cast a contract address into a callable instance.
 * This interface is used by Staking contract to call governanceWithdrawTokens
 * function having the vesting contract instance address.
 */
interface ITeamVesting {
	function governanceWithdrawTokens(address receiver) external;
}
