pragma solidity ^0.5.17;

contract ErrorDecoder {
	//4 bytes - 0x08c379a0 - method id
	//32 bytes - 2 parameters
	//32 bytes - bool, result
	//32 ... bytes - string, error message
	uint256 constant ERROR_MESSAGE_SHIFT = 68;

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
