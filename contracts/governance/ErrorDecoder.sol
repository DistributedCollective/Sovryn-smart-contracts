pragma solidity ^0.5.17;

/**
 * @title Base contract to properly handle returned data on failed calls
 * @dev On EVM if the return data length of a call is less than 68,
 * then the transaction fails silently without a revert message!
 * As described in the Solidity documentation
 * https://solidity.readthedocs.io/en/v0.5.10/control-structures.html#revert
 * the revert reason is an ABI-encoded string consisting of:
 * 0x08c379a0 // Function selector (method id) for "Error(string)" signature
 * 0x0000000000000000000000000000000000000000000000000000000000000020 // Data offset
 * 0x000000000000000000000000000000000000000000000000000000000000001a // String length
 * 0x4e6f7420656e6f7567682045746865722070726f76696465642e000000000000 // String data
*/
contract ErrorDecoder {
	// 4 bytes - 0x08c379a0 - method id
	// 32 bytes - 2 parameters
	// 32 bytes - bool, result
	// 32 ... bytes - string, error message
	uint256 constant ERROR_MESSAGE_SHIFT = 68;

	/**
	 * @notice Concats two error strings taking into account ERROR_MESSAGE_SHIFT.
	 * @param str1 First string, usually a hardcoded context written by dev.
	 * @param str2 Second string, usually the error message from the reverted call.
	 * @return The concatenated error string
	 */
	function _addErrorMessage(string memory str1, string memory str2) internal pure returns (string memory) {
		bytes memory bytesStr1 = bytes(str1);
		bytes memory bytesStr2 = bytes(str2);
		string memory str12 = new string(bytesStr1.length + bytesStr2.length - ERROR_MESSAGE_SHIFT);
		bytes memory bytesStr12 = bytes(str12);
		uint256 j = 0;
		for (uint256 i = 0; i < bytesStr1.length; i++) {
			bytesStr12[j++] = bytesStr1[i];
		}
		for (uint256 i = ERROR_MESSAGE_SHIFT; i < bytesStr2.length; i++) {
			bytesStr12[j++] = bytesStr2[i];
		}
		return string(bytesStr12);
	}
}
