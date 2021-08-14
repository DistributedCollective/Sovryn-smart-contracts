pragma solidity 0.5.17;

/// @title This interface helps decoupling the Liquidity Mining reward
/// @dev Implement this interface in order to transfer the rewards with different logic. For example:
///			 SOV tokens
interface IRewardTransferLogic {
	/// @dev Returns the reward token address this contract will transfer
	function getRewardTokenAddress() external returns (address);

	/// @notice Transfers will be executed from this address so it must be approved before invoking
	function senderToAuthorize() external returns (address);

	/// @notice Transfers the reward amount to the specified address
	/// @param _to The address to transfer the reward to
	/// @param _value The amount of the reward to transfer
	/// @param _isWithdrawal If true, means that the reward and the LP deposited tokens are being compeltely withdrawn
	function transferReward(
		address _to,
		uint256 _value,
		bool _isWithdrawal
	) external;
}
