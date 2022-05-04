pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../farm/LiquidityMiningV2.sol";

contract LiquidityMiningMockupV2 is LiquidityMiningV2 {
    function getPoolAccumulatedReward(address _poolToken, address _rewardToken)
        external
        view
        returns (uint256, uint256)
    {
        uint256 poolId = _getPoolId(_poolToken);
        PoolInfo storage pool = poolInfoList[poolId];
        PoolInfoRewardToken storage poolRewardToken =
            poolInfoRewardTokensMap[poolId][_rewardToken];
        RewardToken storage rewardToken = rewardTokensMap[_rewardToken];
        return _getPoolAccumulatedReward(pool, poolRewardToken, rewardToken);
    }
}
