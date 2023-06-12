pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../governance/Staking/interfaces/IStaking.sol";
import "../../interfaces/IERC20.sol";

contract StakingWrapperMockup {
    uint256 constant TWO_WEEKS = 1209600;

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

    function stakeAndExtend(uint96 amount, uint256 until) external {
        require(token.transferFrom(msg.sender, address(this), amount));
        token.approve(address(staking), amount);

        staking.stake(amount, until, address(this), address(this));
        staking.extendStakingDuration(until, until + TWO_WEEKS);
    }

    function stakeAndStakeBySchedule(
        uint96 amount,
        uint256 until,
        uint256 cliff,
        uint256 duration,
        uint256 intervalLength,
        address stakeFor,
        address delegatee
    ) external {
        require(token.transferFrom(msg.sender, address(this), amount * 2));
        token.approve(address(staking), amount * 2);

        staking.stake(amount, until, stakeFor, delegatee);
        staking.stakeBySchedule(amount, cliff, duration, intervalLength, stakeFor, delegatee);
    }
}
