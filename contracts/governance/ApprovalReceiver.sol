pragma solidity ^0.5.17;

import "./ErrorDecoder.sol";
import "../token/IApproveAndCall.sol";

/**
 * Base contract for receiving approval from SOV token
 */
contract ApprovalReceiver is ErrorDecoder, IApproveAndCall {
	modifier onlyThisContract() {
		//accepts calls only from receiveApproval function
		require(msg.sender == address(this), "unauthorized");
		_;
	}

	/**
	 * @notice receives approval from SOV token
	 * @param _data the data will be used for low level call
	 */
	function receiveApproval(
		address _sender,
		uint256 _amount,
		address _token,
		bytes calldata _data
	) external {
		//accepts calls only from SOV token
		require(msg.sender == _getToken(), "unauthorized");
		require(msg.sender == _token, "unauthorized");

		//only allowed methods
		bool isAllowed = false;
		bytes4[] memory selectors = _getSelectors();
		bytes4 sig = _getSig(_data);
		for (uint256 i = 0; i < selectors.length; i++) {
			if (sig == selectors[i]) {
				isAllowed = true;
				break;
			}
		}
		require(isAllowed, "method is not allowed");

		//check sender and amount
		address sender;
		uint256 amount;
		(, sender, amount) = abi.decode(abi.encodePacked(bytes28(0), _data), (bytes32, address, uint256));
		require(sender == _sender, "sender mismatch");
		require(amount == _amount, "amount mismatch");

		_call(_data);
	}

	/**
	 * @notice returns token address, only this address can be a sender for receiveApproval
	 * @dev should be overridden in child contracts, otherwise error will be thrown
	 */
	function _getToken() internal view returns (address) {
		return address(0);
	}

	/**
	 * @notice returns list of function selectors allowed to be invoked
	 * @dev should be overridden in child contracts, otherwise error will be thrown
	 */
	function _getSelectors() internal view returns (bytes4[] memory) {
		return new bytes4[](0);
	}

	function _call(bytes memory _data) internal {
		//makes call and reads error message
		(bool success, bytes memory returnData) = address(this).call(_data);
		if (!success) {
			if (returnData.length <= ERROR_MESSAGE_SHIFT) {
				revert("receiveApproval: Transaction execution reverted.");
			} else {
				revert(_addErrorMessage("receiveApproval: ", string(returnData)));
			}
		}
	}

	function _getSig(bytes memory _data) internal pure returns (bytes4 sig) {
		assembly {
			sig := mload(add(_data, 32))
		}
	}
}
