pragma solidity ^0.5.17;

/**
 * @title Interface for Vesting Factory contract.
 * @dev Interfaces are used to cast a contract address into a callable instance.
 * This interface is used by VestingFactory contract to override empty
 * implemention of deployVesting and deployTeamVesting functions
 * and on VestingRegistry contract to use an instance of VestingFactory.
 */
interface IVestingFactory {
	function deployVesting(
		address _SOV,
		address _staking,
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		address _feeSharing,
		address _owner
	) external returns (address);

	function deployTeamVesting(
		address _SOV,
		address _staking,
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		address _feeSharing,
		address _owner
	) external returns (address);
}
