pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "./Vesting.sol";
import "./TeamVesting.sol";
import "./IVestingFactory.sol";

/**
 * @title Vesting Factory: Contract to deploy vesting contracts
 * of two types: vesting (TokenHolder) and team vesting (Multisig).
 * @notice Factory pattern allows to create multiple instances
 * of the same contract and keep track of them easier.
 * */
contract VestingFactory is IVestingFactory, Ownable {
	address public vestingLogic;

	constructor(address _vestingLogic) public {
		require(_vestingLogic != address(0), "invalid vesting logic address");
		vestingLogic = _vestingLogic;
	}

	/**
	 * @notice Deploys Vesting contract.
	 * @param _SOV the address of SOV token.
	 * @param _staking The address of staking contract.
	 * @param _tokenOwner The owner of the tokens.
	 * @param _cliff The cliff in seconds.
	 * @param _duration The total duration in seconds.
	 * @param _feeSharing The address of fee sharing contract.
	 * @param _vestingOwner The address of an owner of vesting contract.
	 * @return The vesting contract address.
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
		onlyOwner /// @dev owner - VestingRegistry
		returns (address)
	{
		address vesting = address(new Vesting(vestingLogic, _SOV, _staking, _tokenOwner, _cliff, _duration, _feeSharing));
		Ownable(vesting).transferOwnership(_vestingOwner);
		return vesting;
	}

	/**
	 * @notice deploys Team Vesting contract.
	 * @param _SOV The address of SOV token.
	 * @param _staking The address of staking contract.
	 * @param _tokenOwner The owner of the tokens.
	 * @param _cliff The cliff in seconds.
	 * @param _duration The total duration in seconds.
	 * @param _feeSharing The address of fee sharing contract.
	 * @param _vestingOwner The address of an owner of vesting contract.
	 * @return The vesting contract address.
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
