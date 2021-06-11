pragma solidity 0.5.17;

contract PriceFeedV1PoolOracleMockup {
    uint256 value;

    constructor(uint256 _value) public {
        value = _value;
    }

    function latestAnswer() external view returns (uint256) {
        return value;
	}

    function setValue(uint256 _value) public {
		value = _value;
	}
}
