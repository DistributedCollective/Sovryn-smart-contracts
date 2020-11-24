pragma solidity ^0.5.17;

import "../governance/Staking/Staking.sol";

contract StakingMockup is Staking {
    
    function balanceOf_MultipliedByTwo(address account) external view returns (uint) {
        return balanceOf(account) * 2;
    }
    
    uint96 priorTotalVotingPower;

    function MOCK_priorTotalVotingPower(uint96 _priorTotalVotingPower) public {
        priorTotalVotingPower = _priorTotalVotingPower;
    }
    
    function getPriorTotalVotingPower(uint32 blockNumber, uint time) view public returns(uint96 totalVotingPower) {
        return priorTotalVotingPower != 0 ? priorTotalVotingPower : super.getPriorTotalVotingPower(blockNumber, time);
    }
    
    
    uint96 priorWeightedStake;
    
    function MOCK_priorWeightedStake(uint96 _priorWeightedStake) public {
        priorWeightedStake = _priorWeightedStake;
    }
    
    function getPriorWeightedStake(address account, uint blockNumber, uint date) public view returns (uint96) {
        return priorWeightedStake != 0 ? priorWeightedStake : super.getPriorWeightedStake(account, blockNumber, date);
    }

}