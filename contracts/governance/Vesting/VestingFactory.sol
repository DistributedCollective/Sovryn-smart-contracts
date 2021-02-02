pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "./Vesting.sol";
import "./TeamVesting.sol";
import "./DevelopmentVesting.sol";
import "./IVestingFactory.sol";

contract VestingFactory is IVestingFactory, Ownable {

	function deployVesting(
		address _SOV,
		address _staking,
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		address _feeSharing,
		address _vestingOwner
	)
		onlyOwner //owner - VestingRegistry
		external
		returns (address)
	{
		address vesting = address(new Vesting(_SOV, _staking, _tokenOwner, _cliff, _duration, _feeSharing));
		Ownable(vesting).transferOwnership(_vestingOwner);
		return vesting;
	}

	function deployTeamVesting(
		address _SOV,
		address _staking,
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		address _feeSharing,
		address _vestingOwner
	)
		onlyOwner //owner - VestingRegistry
		external
		returns (address)
	{
		address vesting = address(new TeamVesting(_SOV, _staking, _tokenOwner, _cliff, _duration, _feeSharing));
		Ownable(vesting).transferOwnership(_vestingOwner);
		return vesting;
	}

	function deployDevelopmentVesting(
		address _SOV,
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		uint256 _frequency,
		address _vestingOwner
	)
	onlyOwner //owner - VestingRegistry
	external
	returns (address)
	{
		address vesting = address(new DevelopmentVesting(_SOV, _tokenOwner, _cliff, _duration, _frequency));
		Ownable(vesting).transferOwnership(_vestingOwner);
		return vesting;
	}

}
