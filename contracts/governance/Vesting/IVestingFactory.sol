pragma solidity ^0.5.17;

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
