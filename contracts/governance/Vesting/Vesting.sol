pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./TeamVesting.sol";

/**
 * @title Vesting Contract.
 * @notice Team tokens and investor tokens are vested. Therefore, a smart
 * contract needs to be developed to enforce the vesting schedule.
 *
 * @dev TODO add tests for governanceWithdrawTokens.
 * */
contract Vesting is TeamVesting {
	/**
	 * @notice Setup the vesting schedule.
	 * @param _logic The address of logic contract.
	 * @param _SOV The SOV token address.
	 * @param _tokenOwner The owner of the tokens.
	 * @param _cliff The time interval to the first withdraw in seconds.
	 * @param _duration The total duration in seconds.
	 * */
	constructor(
		address _logic,
		address _SOV,
		address _stakingAddress,
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		address _feeSharingProxy
	) public TeamVesting(_logic, _SOV, _stakingAddress, _tokenOwner, _cliff, _duration, _feeSharingProxy) {}

	/**
	 * @dev we need to add this implementation to prevent proxy call VestingLogic.governanceWithdrawTokens
	 * @param receiver The receiver of the token withdrawal.
	 */
	function governanceWithdrawTokens(address receiver) public {
		revert("operation not supported");
	}
}
