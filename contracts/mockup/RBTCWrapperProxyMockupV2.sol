pragma solidity 0.5.17;

import "../farm/LiquidityMiningV2.sol";

contract RBTCWrapperProxyMockupV2 {
    LiquidityMiningV2 public liquidityMining;

    constructor(LiquidityMiningV2 _liquidityMining) public {
        liquidityMining = _liquidityMining;
    }

    function claimReward(address _poolToken) public {
        liquidityMining.claimRewards(_poolToken, msg.sender);
    }

    function claimRewardFromAllPools() public {
        liquidityMining.claimRewardFromAllPools(msg.sender);
    }

    function withdraw(address _poolToken, uint256 _amount) public {
        liquidityMining.withdraw(_poolToken, _amount, msg.sender);
    }
}
