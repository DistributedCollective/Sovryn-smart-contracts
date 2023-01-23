pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../governance/Staking/interfaces/IStaking.sol";
import "../../interfaces/IERC20.sol";

import "hardhat/console.sol";

contract StakingWrapperMockup {
    IStaking staking;
    IERC20 token;

    constructor(IStaking _staking, IERC20 _token) public {
        staking = _staking;
        token = _token;
    }

    function stake2times(
        uint96 amount,
        uint256 until,
        address stakeFor,
        address delegatee
    ) external {
        require(token.transferFrom(msg.sender, address(this), amount * 2));
        token.approve(address(staking), amount * 2);

        staking.stake(amount, until, stakeFor, delegatee);
        staking.stake(amount, until, stakeFor, delegatee);
    }
}
