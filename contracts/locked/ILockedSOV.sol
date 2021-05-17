pragma solidity ^0.5.17;

/**
 *  @title The Locked SOV Interface.
 *  @author Franklin Richards - powerhousefrank@protonmail.com
 *  @notice This interface is an incomplete yet useful for future migration of LockedSOV Contract.
 *  @dev Only use it if you know what you are doing.
 */
interface ILockedSOV {
	/**
	 * @notice Adds SOV to the user balance (Locked and Unlocked Balance based on `_basisPoint`).
	 * @param _userAddress The user whose locked balance has to be updated with `_sovAmount`.
	 * @param _sovAmount The amount of SOV to be added to the locked and/or unlocked balance.
	 * @param _basisPoint The % (in Basis Point)which determines how much will be unlocked immediately.
	 */
		function deposit(
			address _userAddress,
			uint256 _sovAmount,
			uint256 _basisPoint
		) external;

	/**
	 * @notice Adds SOV to the locked balance of a user.
	 * @param _userAddress The user whose locked balance has to be updated with _sovAmount.
	 * @param _sovAmount The amount of SOV to be added to the locked balance.
	 */
	function depositSOV(address _userAddress, uint256 _sovAmount) external;
}
