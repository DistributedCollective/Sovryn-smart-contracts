pragma solidity ^0.5.17;

/**
 * @title Interface for contract governance/ApprovalReceiver.sol
 */
interface IApproveAndCall {
	/**
	 * @notice Receives approval from SOV token.
	 * @param _sender The sender of SOV.approveAndCall function.
	 * @param _amount The amount was approved.
	 * @param _token The address of token.
	 * @param _data The data will be used for low level call.
	 */
	function receiveApproval(
		address _sender,
		uint256 _amount,
		address _token,
		bytes calldata _data
	) external;
}
