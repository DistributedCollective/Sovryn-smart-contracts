pragma solidity ^0.5.17;

import "../../governance/Staking/Staking.sol";

contract StakingMockup is Staking {
    
    function balanceOf_MultipliedByTwo(address account) external view returns (uint) {
        return balanceOf(account) * 2;
    }
    
}
