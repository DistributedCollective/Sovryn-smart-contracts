pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../core/State.sol";

contract LockedSovMockup is State {
	/**
	 * @notice Adds SOV to the locked balance of a user.
	 * @param _userAddress The user whose locked balance has to be updated with _sovAmount.
	 * @param _sovAmount The amount of SOV to be added to the locked balance.
	 */
	function depositSOV(address _userAddress, uint256 _sovAmount) public {}

	function initialize(address target) external onlyOwner {
		_setTarget(this.depositSOV.selector, target);
	}
}
