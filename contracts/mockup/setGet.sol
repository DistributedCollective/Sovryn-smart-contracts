pragma solidity 0.5.17;

/**
 * @title A simple smart contract for setting and getting values.
 * @author Franklin Richards
 * @dev This is going to be used for testing purposes.
 */
contract setGet {
	uint256 public value;

	event valueSet(uint256 indexed _value);

	/**
	 * @notice To get the `value`.
	 * @return _value The value.
	 */
	function get() public returns (uint256 _value) {
		return value;
	}

	/**
	 * @notice To set the `value`.
	 * @param _value The value.
	 */
	function set(uint256 _value) public {
		value = _value;
	}
}
