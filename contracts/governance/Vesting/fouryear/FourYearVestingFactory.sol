pragma solidity ^0.5.17;

import "../../../openzeppelin/Ownable.sol";
import "./FourYearVesting.sol";
import "./IFourYearVestingFactory.sol";

/**
 * @title Four Year Vesting Factory: Contract to deploy four year vesting contracts.
 * @notice Factory pattern allows to create multiple instances
 * of the same contract and keep track of them easier.
 * */
contract FourYearVestingFactory is IFourYearVestingFactory, Ownable {
	address public fourYearVestingLogic;

	constructor(address _fourYearVestingLogic) public {
		require(_fourYearVestingLogic != address(0), "invalid four year vesting logic address");
		fourYearVestingLogic = _fourYearVestingLogic;
	}

	/**
	 * @notice Deploys four year vesting contract.
	 * @param _SOV the address of SOV token.
	 * @param _staking The address of staking contract.
	 * @param _tokenOwner The owner of the tokens.
	 * @param _cliff The time interval to the first withdraw in seconds.
	 * @param _duration The total duration in seconds.
	 * @param _feeSharing The address of fee sharing contract.
	 * @param _vestingOwner The address of an owner of vesting contract.
	 * @return The four year vesting contract address.
	 * */
	function deployFourYearVesting(
		address _SOV,
		address _staking,
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		address _feeSharing,
		address _vestingOwner
	) external onlyOwner returns (address) {
		address fourYearVesting =
			address(new FourYearVesting(fourYearVestingLogic, _SOV, _staking, _tokenOwner, _cliff, _duration, _feeSharing));
		Ownable(fourYearVesting).transferOwnership(_vestingOwner);
		return fourYearVesting;
	}
}
