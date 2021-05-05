pragma solidity 0.5.17;

contract BProPriceFeedMockup {
	uint256 public value;

	/**
	 * @dev BPro USD PRICE
	 * @return the BPro USD Price [using mocPrecision]
	 */
	function bproUsdPrice() public view returns (uint256) {
		return value;
	}

	function setValue(uint256 _value) public {
		value = _value;
	}
}
