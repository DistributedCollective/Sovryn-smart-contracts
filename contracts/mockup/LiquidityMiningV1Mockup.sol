pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../farm/LiquidityMiningV1.sol";

contract LiquidityMiningV1Mockup is LiquidityMiningV1 {
	function getPassedBlocksWithBonusMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
		return _getPassedBlocksWithBonusMultiplier(_from, _to);
	}

	function getPoolAccumulatedReward(address _poolToken) public view returns (uint256, uint256) {
		uint256 poolId = _getPoolId(_poolToken);
		PoolInfo storage pool = poolInfoList[poolId];
		return _getPoolAccumulatedReward(pool);
	}
}
