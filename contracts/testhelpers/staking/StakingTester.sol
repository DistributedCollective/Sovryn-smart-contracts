pragma solidity ^0.5.17;

import "../../governance/Staking/interfaces/IStaking.sol";
import "../TestToken.sol";

contract StakingTester {
    IStaking public staking;
    TestToken public token;

    constructor(address _staking, address _token) public {
        staking = IStaking(_staking);
        token = TestToken(_token);
    }

    function stakeAndWithdraw(uint96 _amount, uint256 _until) public {
        token.mint(address(this), _amount);
        token.approve(address(staking), _amount);
        staking.stake(_amount, _until, address(this), address(this));
        staking.withdraw(_amount, _until, address(this));
    }
}
