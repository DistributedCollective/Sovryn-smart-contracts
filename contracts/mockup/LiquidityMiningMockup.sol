pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../farm/LiquidityMining.sol";

contract LiquidityMiningMockup is LiquidityMining {
	// FIXME
	// function getPoolAccumulatedReward(address _poolToken) public view returns (uint256, uint256) {
	// 	uint256 poolId = _getPoolId(_poolToken);
	// 	PoolInfo storage pool = poolInfoList[poolId];
	// 	return _getPoolAccumulatedReward(pool);
	// }
}
