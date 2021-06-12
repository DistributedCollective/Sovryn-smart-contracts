pragma solidity 0.5.17;

contract PriceFeedV1PoolOracleMockup {
	uint256 value;
    address public liquidityPool;

	constructor(uint256 _value, address _liquidityPool) public {
		value = _value;
        liquidityPool = _liquidityPool;
	}

	function latestAnswer() external view returns (uint256) {
		return value;
	}

	function setValue(uint256 _value) public {
		value = _value;
	}

    function setLiquidityPool(address _liquidityPool) public {
        liquidityPool = _liquidityPool;
    }
}