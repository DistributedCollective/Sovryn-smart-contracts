pragma solidity 0.5.17;

import "../farm/LiquidityMining.sol";

contract RBTCWrapperProxyMockup {
    LiquidityMining public liquidityMining;

    constructor(LiquidityMining _liquidityMining) public {
        liquidityMining = _liquidityMining;
    }

    function claimReward(address _poolToken) public {
        liquidityMining.claimReward(_poolToken, msg.sender);
    }

    function claimRewardFromAllPools() public {
        liquidityMining.claimRewardFromAllPools(msg.sender);
    }

    function withdraw(address _poolToken, uint256 _amount) public {
        liquidityMining.withdraw(_poolToken, _amount, msg.sender);
    }
}
