pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "./Vesting.sol";
import "./TeamVesting.sol";
import "./IVestingFactory.sol";

contract VestingFactory is IVestingFactory, Ownable {
	address public vestingLogic;

	constructor(address _vestingLogic) public {
		require(_vestingLogic != address(0), "invalid vesting logic address");
		vestingLogic = _vestingLogic;
	}

	/**
	 * @notice deploys Vesting contract
	 * @param _SOV the address of SOV token
	 * @param _staking the address of staking contract
	 * @param _tokenOwner the owner of the tokens
	 * @param _cliff the cliff in seconds
	 * @param _duration the total duration in seconds
	 * @param _feeSharing the address of fee sharing contract
	 * @param _vestingOwner the address of an owner of vesting contract
	 */
	function deployVesting(
		address _SOV,
		address _staking,
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		address _feeSharing,
		address _vestingOwner
	)
		external
		onlyOwner //owner - VestingRegistry
		returns (address)
	{
		address vesting = address(new Vesting(vestingLogic, _SOV, _staking, _tokenOwner, _cliff, _duration, _feeSharing));
		Ownable(vesting).transferOwnership(_vestingOwner);
		return vesting;
	}

	/**
	 * @notice deploys Team Vesting contract
	 * @param _SOV the address of SOV token
	 * @param _staking the address of staking contract
	 * @param _tokenOwner the owner of the tokens
	 * @param _cliff the cliff in seconds
	 * @param _duration the total duration in seconds
	 * @param _feeSharing the address of fee sharing contract
	 * @param _vestingOwner the address of an owner of vesting contract
	 */
	function deployTeamVesting(
		address _SOV,
		address _staking,
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		address _feeSharing,
		address _vestingOwner
	)
		external
		onlyOwner //owner - VestingRegistry
		returns (address)
	{
		address vesting = address(new TeamVesting(vestingLogic, _SOV, _staking, _tokenOwner, _cliff, _duration, _feeSharing));
		Ownable(vesting).transferOwnership(_vestingOwner);
		return vesting;
	}
}
