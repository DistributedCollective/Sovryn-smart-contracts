pragma solidity ^0.5.17;

/**
 *  @title An interface for the Locked SOV Contract.
 *  @author Franklin Richards - powerhousefrank@protonmail.com
 *  @dev This is not a complete interface of the Locked SOV Contract.
 */
interface ILockedSOV {
	/**
	 * @notice Adds SOV to the locked balance of a user.
	 * @param _userAddress The user whose locked balance has to be updated with _sovAmount.
	 * @param _sovAmount The amount of SOV to be added to the locked balance.
	 */
	function depositSOV(address _userAddress, uint256 _sovAmount) external;
}
