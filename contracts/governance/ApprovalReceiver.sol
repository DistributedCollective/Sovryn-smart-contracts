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
		address /*_sender*/,
		uint256 /*_amount*/,
		address /*_token*/,
		bytes memory _data
	) public {
		_receiveApproval(_getToken(), _data, _getSelectors());
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

	function _receiveApproval(
		address _token,
		bytes memory _data,
		bytes4[] memory _selectors
	) internal {
		//accepts calls only from SOV token
		require(msg.sender == address(_token), "unauthorized");

		//only allowed methods
		bool isAllowed = false;
		bytes4 sig = _getSig(_data);
		for (uint256 i = 0; i < _selectors.length; i++) {
			if (sig == _selectors[i]) {
				isAllowed = true;
				break;
			}
		}
		require(isAllowed, "method is not allowed");

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
