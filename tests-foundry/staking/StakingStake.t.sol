// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
//import { StakingStakeModule } from "contracts/governance/Staking/modules/StakingStakeModule.sol";
//import { StakingProxy } from "contracts/governance/Staking/StakingProxy.sol";
//import { TestToken } from "contracts/testhelpers/TestToken.sol";
import { IStaking } from "./interfaces/IStaking.sol";

interface IERC20 {
    function name() external view returns (string memory);

    function decimals() external view returns (uint8);

    function symbol() external view returns (string memory);

    function totalSupply() external view returns (uint256);

    function balanceOf(address _who) external view returns (uint256);

    function allowance(address _owner, address _spender) external view returns (uint256);

    function approve(address _spender, uint256 _value) external returns (bool);

    function transfer(address _to, uint256 _value) external returns (bool);

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface IStakingProxy {
    function setImplementation(address _implementation) external;
}

interface IStakingModulesProxy {
    function addModule(address _implementation) external;
}

/*interface IStaking {
    function stake(
        uint96 amount,
        uint256 until,
        address stakeFor,
        address delegatee
    ) external;
}*/

contract StakingFuzzTest is Test {
    uint256 internal constant TWO_WEEKS = 14 days;

    // Test Variables
    address private user;
    uint256 private invalidLockDate;
    uint256 private amount;
    uint256 private kickoffTS;
    IStaking private staking;
    IERC20 private sov;

    event TokensStaked(
        address indexed staker,
        uint256 amount,
        uint256 lockedUntil,
        uint256 totalStaked
    );

    // Test Setup
    function setUp() public virtual {
        // Initialize test variables
        sov = IERC20(
            deployCode("TestToken.sol", abi.encode("Sovryn", "SOV", 18, 100_000_000 ether))
        );
        // console.log("SOV total supply:", sov.totalSupply());

        address[2] memory stakingModules =
            [deployCode("StakingStakeModule.sol"), deployCode("StakingVestingModule.sol")];

        IStakingProxy stakingProxy =
            IStakingProxy(deployCode("StakingProxy.sol", abi.encode(address(sov))));
        address stakingProxyAddress = address(stakingProxy);
        stakingProxy.setImplementation(deployCode("ModulesProxy.sol"));
        IStakingModulesProxy stakingModulesProxy = IStakingModulesProxy(stakingProxyAddress);

        for (uint256 i = 0; i < stakingModules.length; i++) {
            stakingModulesProxy.addModule(stakingModules[i]);
        }

        staking = IStaking(stakingProxyAddress);

        kickoffTS = staking.kickoffTS();

        // console.log("kickoffTS: %s", kickoffTS);
        // console.log("kickoffTS + 2 weeks: %s", kickoffTS + TWO_WEEKS);

        amount = 1000;
        user = address(1);

        // Fund user
        vm.deal(user, 1 ether);
        deal(address(sov), user, amount);
        console.log("0. block.number: %s, block.timestamp %s", block.number, block.timestamp);
        mineBlocks(1);
        console.log("1. block.number: %s, block.timestamp %s", block.number, block.timestamp);
    }

    // helpers
    // @todo extract to a helper contract
    function mineBlocksTime(uint256 _blocks, uint256 _timePerBlockInSeconds) internal {
        vm.roll(block.number + _blocks);
        vm.warp(block.number * _timePerBlockInSeconds);
    }

    function mineBlocks(uint256 _blocks) internal {
        mineBlocksTime(_blocks, 30);
    }

    // Test that any invalid lock date is adjusted to the earlier valid lock date
    function testFuzzAdjustLockDateWithinLegitBoundaries(uint256 _randomLockTimestamp) external {
        vm.startPrank(user);
        sov.approve(address(staking), amount);
        mineBlocks(1);
        console.log("2. block.number: %s, block.timestamp %s", block.number, block.timestamp);

        // Get initial balances
        uint256 userBalanceBefore = sov.balanceOf(user);
        uint256 stakingBalanceBefore = sov.balanceOf(address(staking));

        // Stake tokens with random lock date
        _randomLockTimestamp = bound(
            _randomLockTimestamp,
            kickoffTS + TWO_WEEKS,
            block.timestamp + staking.MAX_DURATION()
        );

        mineBlocks(1);
        if (_randomLockTimestamp <= block.timestamp) {
            console.log(
                "_randomLockTimestamp <= block.timestamp => until: %s, block.number, block.timestamp: %s",
                _randomLockTimestamp,
                block.number,
                block.timestamp
            );
            vm.expectRevert("Staking::_timestampToLockDate: staking period too short");
            staking.stake(uint96(amount), _randomLockTimestamp, address(0), address(0));
            mineBlocks(1);
            console.log("3. block.number: %s, block.timestamp %s", block.number, block.timestamp);
            // return;
        } else {
            console.log(
                "_randomLockTimestamp > block.timestamp => until: %s, block.number, block.timestamp: %s",
                _randomLockTimestamp,
                block.number,
                block.timestamp
            );
            uint256 expectedLockTimestamp = staking.timestampToLockDate(_randomLockTimestamp);
            assertEq(
                kickoffTS + ((_randomLockTimestamp - kickoffTS) / TWO_WEEKS) * TWO_WEEKS,
                expectedLockTimestamp
            );
            console.log("expectedLockTimestamp: %s", expectedLockTimestamp);
            vm.expectEmit(true, true, true, true);
            emit TokensStaked(user, amount, expectedLockTimestamp, amount);
            uint256 blockBefore = block.number;
            mineBlocks(1);
            staking.stake(uint96(amount), _randomLockTimestamp, address(0), address(0));
            mineBlocks(1);
            uint256 blockAfter = block.number;
            console.log("blockBefore: %s, blockAfter: %s", blockBefore, blockAfter);
            mineBlocks(1);

            // Get final balances
            uint256 userBalanceAfter = sov.balanceOf(user);
            uint256 stakingBalanceAfter = sov.balanceOf(address(staking));

            console.log(
                "userBalanceBefore %s - userBalanceAfter %s == %s",
                userBalanceBefore,
                userBalanceAfter,
                userBalanceBefore - userBalanceAfter
            );
            console.log(
                "stakingBalanceAfter %s - stakingBalanceBefore %s == %s",
                stakingBalanceAfter,
                stakingBalanceBefore,
                stakingBalanceAfter - stakingBalanceBefore
            );

            // Check balances
            assertEq(userBalanceBefore - userBalanceAfter, amount);
            assertEq(stakingBalanceAfter - stakingBalanceBefore, amount);

            mineBlocks((expectedLockTimestamp - block.timestamp) / 30 + 10);
            // Check getPriorUserStakeByDate

            uint256 priorUserStakeAfter =
                staking.getPriorUserStakeByDate(user, expectedLockTimestamp, blockAfter);
            uint256 priorUserStakeBefore =
                staking.getPriorUserStakeByDate(user, expectedLockTimestamp, blockBefore);

            console.log(
                "priorUserStakeAfter: %s, priorUserStakeBefore: %s",
                priorUserStakeAfter,
                priorUserStakeBefore
            );
            (uint256[] memory dates, uint96[] memory stakes) = staking.getStakes(user);
            for (uint256 i = 0; i < stakes.length; i++) {
                console.log("stake %s @ date %s", uint256(stakes[i]), dates[i]);
            }
            console.log(
                "staking.numUserStakingCheckpoints(user, expectedLockTimestamp: %s) == %s, _randomLockTimestamp: %s",
                expectedLockTimestamp,
                uint256(staking.numUserStakingCheckpoints(user, expectedLockTimestamp)),
                _randomLockTimestamp
            );
            console.log(
                "staking.numUserStakingCheckpoints(user, 90) == %s",
                uint256(staking.numUserStakingCheckpoints(user, 90))
            );
            console.log(
                "staking.numUserStakingCheckpoints(user, 120) == %s",
                uint256(staking.numUserStakingCheckpoints(user, 120))
            );
            assertEq(priorUserStakeAfter - priorUserStakeBefore, amount);
        }
        vm.stopPrank();

        // Check event
    }
}
