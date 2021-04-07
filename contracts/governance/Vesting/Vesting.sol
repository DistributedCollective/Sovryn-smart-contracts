pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./TeamVesting.sol";

//TODO add tests for governanceWithdrawTokens
contract Vesting is TeamVesting {
	/**
	 * @notice setup the vesting schedule
	 * @param _logic the address of logic contract
	 * @param _SOV the SOV token address
	 * @param _tokenOwner the owner of the tokens
	 * @param _cliff the cliff in seconds
	 * @param _duration the total duration in seconds
	 */
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
	 */
	function governanceWithdrawTokens(address receiver) public {
		revert("operation not supported");
	}
}
