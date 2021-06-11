pragma solidity >=0.5.0 <0.6.0;

interface IV1PoolOracle {
	function read(uint256 price, uint256 timestamp) external view returns(
        uint256,
		uint256,
		uint256,
		uint256,
		uint256,
		uint256
    );

	function latestAnswer() external view returns (uint256);
}
