pragma solidity >=0.5.0 <0.6.0;

interface IV1PoolOracle {
	function read(uint256 price, uint256 timestamp)
		external
		view
		returns (
			uint256,
			uint256,
			uint256,
			uint256,
			uint256,
			uint256
		);

	function latestAnswer() external view returns (uint256);

	function liquidityPool() external view returns (address);
}

interface ILiquidityPoolV1Converter {
	function reserveTokens(uint256 index) external view returns (address);
}
