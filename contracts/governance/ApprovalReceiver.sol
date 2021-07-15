pragma solidity ^0.5.17;

import "./ErrorDecoder.sol";
import "../token/IApproveAndCall.sol";

/**
 * @title Base contract for receiving approval from SOV token.
 */
contract ApprovalReceiver is ErrorDecoder, IApproveAndCall {
	modifier onlyThisContract() {
		// Accepts calls only from receiveApproval function.
		require(msg.sender == address(this), "unauthorized");
		_;
	}

	/**
	 * @notice Receives approval from SOV token.
	 * @param _data The data will be used for low level call.
	 */
	function receiveApproval(
		address _sender,
		uint256 _amount,
		address _token,
		bytes calldata _data
	) external {
		// Accepts calls only from SOV token.
		require(msg.sender == _getToken(), "unauthorized");
		require(msg.sender == _token, "unauthorized");

		// Only allowed methods.
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

		// Check sender and amount.
		address sender;
		uint256 amount;
		(, sender, amount) = abi.decode(abi.encodePacked(bytes28(0), _data), (bytes32, address, uint256));
		require(sender == _sender, "sender mismatch");
		require(amount == _amount, "amount mismatch");

		_call(_data);
	}

	/**
	 * @notice Returns token address, only this address can be a sender for receiveApproval.
	 * @dev Should be overridden in child contracts, otherwise error will be thrown.
	 * @return By default, 0x. When overriden, the token address making the call.
	 */
	function _getToken() internal view returns (address) {
		return address(0);
	}

	/**
	 * @notice Returns list of function selectors allowed to be invoked.
	 * @dev Should be overridden in child contracts, otherwise error will be thrown.
	 * @return By default, empty array. When overriden, allowed selectors.
	 */
	function _getSelectors() internal view returns (bytes4[] memory) {
		return new bytes4[](0);
	}

	/**
	 * @notice Makes call and reverts w/ enhanced error message.
	 * @param _data Error message as bytes.
	 */
	function _call(bytes memory _data) internal {
		(bool success, bytes memory returnData) = address(this).call(_data);
		if (!success) {
			if (returnData.length <= ERROR_MESSAGE_SHIFT) {
				revert("receiveApproval: Transaction execution reverted.");
			} else {
				revert(_addErrorMessage("receiveApproval: ", string(returnData)));
			}
		}
	}

	/**
	 * @notice Extracts the called function selector, a hash of the signature.
	 * @dev The first four bytes of the call data for a function call specifies
	 * the function to be called. It is the first (left, high-order in big-endian)
	 * four bytes of the Keccak-256 (SHA-3) hash of the signature of the function.
	 * Solidity doesn't yet support a casting of byte[4] to bytes4.
	 * Example:
	 *  msg.data:
	 *    0xcdcd77c000000000000000000000000000000000000000000000000000000000000
	 *    000450000000000000000000000000000000000000000000000000000000000000001
	 *  selector (or method ID): 0xcdcd77c0
	 *  signature: baz(uint32,bool)
	 * @param _data The msg.data from the low level call.
	 * @return sig First 4 bytes of msg.data i.e. the selector, hash of the signature.
	 */
	function _getSig(bytes memory _data) internal pure returns (bytes4 sig) {
		assembly {
			sig := mload(add(_data, 32))
		}
	}
}
