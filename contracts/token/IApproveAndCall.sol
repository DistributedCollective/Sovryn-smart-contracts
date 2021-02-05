pragma solidity ^0.5.17;

interface IApproveAndCall {
	/**
	 * @notice receives approval from SOV token
	 * @param _sender the sender of SOV.approveAndCall function
	 * @param _amount the amount was approved
	 * @param _token the address of token
	 * @param _data the data will be used for low level call
	 */
	function receiveApproval(
		address _sender,
		uint256 _amount,
		address _token,
		bytes calldata _data
	) external;
}
