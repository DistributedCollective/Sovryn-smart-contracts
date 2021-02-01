pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./Vesting.sol";

/**
 * A regular vesting contract, but the owner (governance) is able to withdraw earlier without a slashing
 **/
contract TeamVesting is Vesting {

	constructor(
		address _SOV,
		address _stakingAddress,
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		address _feeSharingProxy
	) public Vesting(_SOV, _stakingAddress, _tokenOwner, _cliff, _duration, _feeSharingProxy) {}

	/**
	 * @notice withdraws all tokens from the staking contract and forwards them to an address specified by the token owner
	 * @param receiver the receiving address
	 * @dev can be called only by owner
	 * */
	function governanceWithdrawTokens(address receiver) public {
		require(msg.sender == address(staking), "unauthorized");

		_withdrawTokens(receiver, true);
	}

}
