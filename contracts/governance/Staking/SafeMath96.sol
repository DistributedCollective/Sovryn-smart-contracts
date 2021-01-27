pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

contract SafeMath96 {
	function safe32(uint256 n, string memory errorMessage) internal pure returns (uint32) {
		require(n < 2**32, errorMessage);
		return uint32(n);
	}

	function safe64(uint256 n, string memory errorMessage) internal pure returns (uint64) {
		require(n < 2**64, errorMessage);
		return uint64(n);
	}

	function safe96(uint256 n, string memory errorMessage) internal pure returns (uint96) {
		require(n < 2**96, errorMessage);
		return uint96(n);
	}

	function add96(
		uint96 a,
		uint96 b,
		string memory errorMessage
	) internal pure returns (uint96) {
		uint96 c = a + b;
		require(c >= a, errorMessage);
		return c;
	}

	function sub96(
		uint96 a,
		uint96 b,
		string memory errorMessage
	) internal pure returns (uint96) {
		require(b <= a, errorMessage);
		return a - b;
	}

	function mul96(
		uint96 a,
		uint96 b,
		string memory errorMessage
	) internal pure returns (uint96) {
		if (a == 0) {
			return 0;
		}

		uint96 c = a * b;
		require(c / a == b, errorMessage);

		return c;
	}
}
