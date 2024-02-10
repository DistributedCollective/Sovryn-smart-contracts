pragma solidity ^0.5.17;

/**
 * @title Interface for TeamVesting contract.
 * @dev Interfaces are used to cast a contract address into a callable instance.
 * This interface is used by Staking contract to cancel the team vesting
 * function having the vesting contract instance address.
 */
interface ITeamVesting {
    function startDate() external view returns (uint256);

    function cliff() external view returns (uint256);

    function endDate() external view returns (uint256);

    function duration() external view returns (uint256);

    function tokenOwner() external view returns (address);

    function governanceWithdrawTokens(address receiver) external;
}
