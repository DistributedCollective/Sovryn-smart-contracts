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
    uint256 private maxDuration;
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
        maxDuration = staking.MAX_DURATION();
        // console.log("kickoffTS: %s", kickoffTS);
        // console.log("kickoffTS + 2 weeks: %s", kickoffTS + TWO_WEEKS);

        amount = 1000;
        user = address(1);

        // Fund user
        vm.deal(user, 1 ether);
        deal(address(sov), user, amount);
        // console.log("0. block.number: %s, block.timestamp %s", block.number, block.timestamp);
        mineBlocks(1);
        // console.log("1. block.number: %s, block.timestamp %s", block.number, block.timestamp);
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

    /*
    // Test that any invalid lock date is adjusted to the earlier valid lock date
    function testFuzz_AdjustLockDateWithinLegitBoundaries(uint256 _randomLockTimestamp) external {
        vm.startPrank(user);
        sov.approve(address(staking), amount);
        mineBlocks(1);

        // Get initial balances
        uint256 userBalanceBefore = sov.balanceOf(user);
        uint256 stakingBalanceBefore = sov.balanceOf(address(staking));

        mineBlocks(1);
        _randomLockTimestamp = bound(
            _randomLockTimestamp,
            kickoffTS + TWO_WEEKS,
            block.timestamp + 60 + staking.MAX_DURATION()
        );
        // shifting timestamp to make it invalid if fuzz is a valid timestamp
        uint256 calculatedExpectedTimestamp =
            kickoffTS + ((_randomLockTimestamp - kickoffTS) / TWO_WEEKS) * TWO_WEEKS;
        if (calculatedExpectedTimestamp == _randomLockTimestamp) {
            _randomLockTimestamp += 3600;
        }
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
        } else {
            console.log(
                "_randomLockTimestamp > block.timestamp => until: %s, block.number, block.timestamp: %s",
                _randomLockTimestamp,
                block.number,
                block.timestamp
            );
            uint256 timestampToLockDate = staking.timestampToLockDate(_randomLockTimestamp);
            assertEq(calculatedExpectedTimestamp, timestampToLockDate);
            console.log("timestampToLockDate: %s", timestampToLockDate);

            vm.expectEmit(true, true, true, true);
            emit TokensStaked(user, amount, timestampToLockDate, amount);
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

            mineBlocks((timestampToLockDate - block.timestamp) / 30 + 10);
            // Check getPriorUserStakeByDate

            uint256 priorUserStakeBefore =
                staking.getPriorUserStakeByDate(user, timestampToLockDate, blockBefore);
            uint256 priorUserStakeAfter =
                staking.getPriorUserStakeByDate(user, timestampToLockDate, blockAfter);

            console.log(
                "priorUserStakeAfter: %s, priorUserStakeBefore: %s",
                priorUserStakeAfter,
                priorUserStakeBefore
            );
            (uint256[] memory dates, uint96[] memory stakes) = staking.getStakes(user);
            for (uint256 i = 0; i < stakes.length; i++) {
                console.log("stake %s @ date %s", uint256(stakes[i]), dates[i]);
            }
            
                // console.log(
                //     "staking.numUserStakingCheckpoints(user, timestampToLockDate: %s) == %s, _randomLockTimestamp: %s",
                //     timestampToLockDate,
                //     uint256(staking.numUserStakingCheckpoints(user, timestampToLockDate)),
                //     _randomLockTimestamp
                // );
                // console.log(
                //     "staking.numUserStakingCheckpoints(user, 90) == %s",
                //     uint256(staking.numUserStakingCheckpoints(user, 90))
                // );
                // console.log(
                //     "staking.numUserStakingCheckpoints(user, 120) == %s",
                //     uint256(staking.numUserStakingCheckpoints(user, 120))
                // );
            
            assertEq(priorUserStakeAfter - priorUserStakeBefore, amount);
        }

        vm.stopPrank();

        // Check event
    }

    function testFuzz_StakeFailsLessTwoWeeksFromKickoff(uint256 _randomLockTimestamp) external {
        vm.assume(
            _randomLockTimestamp >= kickoffTS && _randomLockTimestamp < kickoffTS + TWO_WEEKS
        );

        vm.startPrank(user);
        sov.approve(address(staking), amount);
        mineBlocks(1);

        mineBlocks(100);
        console.log(
            "_randomLockTimestamp <= block.timestamp => until: %s, block.number, block.timestamp: %s",
            _randomLockTimestamp,
            block.number,
            block.timestamp
        );
        vm.expectRevert("Staking::_timestampToLockDate: staking period too short");

        staking.stake(uint96(amount), _randomLockTimestamp, address(0), address(0));

        vm.stopPrank();

        // Check event
    }

    function testFuzz_AdjustLockDateOverMaxDuration(uint256 _randomLockTimestamp) external {
        vm.assume(_randomLockTimestamp > block.timestamp + maxDuration);

        vm.startPrank(user);
        sov.approve(address(staking), amount);
        mineBlocks(1);

        mineBlocks(100);
        console.log(
            "_randomLockTimestamp <= block.timestamp => until: %s, block.number, block.timestamp: %s",
            _randomLockTimestamp,
            block.number,
            block.timestamp
        );
        vm.expectRevert("Staking::_timestampToLockDate: staking period too short");

        staking.stake(uint96(amount), _randomLockTimestamp, address(0), address(0));

        vm.stopPrank();

        // Check event
    }
*/

    function testFuzz_AdjustLockDateAndStake(uint256 _randomLockTimestamp) external {
        // vm.assume(_randomLockTimestamp > block.timestamp + maxDuration);

        vm.startPrank(user);
        sov.approve(address(staking), amount);
        mineBlocks(1);
        uint256 timestampToLockDate;
        if (_randomLockTimestamp < kickoffTS) {
            vm.expectRevert();
            timestampToLockDate = staking.timestampToLockDate(_randomLockTimestamp);
        } else {
            uint256 calculatedExpectedTimestamp =
                kickoffTS +
                    ((
                        _randomLockTimestamp > kickoffTS + maxDuration
                            ? kickoffTS + maxDuration
                            : _randomLockTimestamp - kickoffTS
                    ) / TWO_WEEKS) *
                    TWO_WEEKS;
            /*if (calculatedExpectedTimestamp == _randomLockTimestamp) {
                _randomLockTimestamp += 3600;
            }*/
            timestampToLockDate = staking.timestampToLockDate(_randomLockTimestamp);
            if (timestampToLockDate > calculatedExpectedTimestamp) {
                timestampToLockDate = calculatedExpectedTimestamp;
            }
            if (timestampToLockDate <= block.timestamp || _randomLockTimestamp < kickoffTS) {
                //vm.expectRevert("Staking::_timestampToLockDate: staking period too short");
                emit log("SHOULD BE REVERTING...");
                emit log(
                    "kickoffTS, maxDuration, kickoffTS + maxDuration, block.timestamp, _randomLockTimestamp, timestampToLockDate ->"
                );
                emit log_uint(kickoffTS);
                emit log_uint(maxDuration);
                emit log_uint(kickoffTS + maxDuration);
                emit log_uint(block.timestamp);
                emit log_uint(_randomLockTimestamp);
                emit log_uint(timestampToLockDate);
                if (timestampToLockDate <= block.timestamp) {
                    emit log("timestampToLockDate <= block.timestamp");
                }
                if (_randomLockTimestamp < kickoffTS) {
                    emit log("_randomLockTimestamp < kickoffTS");
                }
                if (timestampToLockDate > kickoffTS + maxDuration) {
                    emit log("timestampToLockDate > kickoffTS + maxDuration");
                }
                vm.expectRevert();
                staking.stake(uint96(amount), _randomLockTimestamp, address(0), address(0));
            } else {
                emit log("SHOULD BE PASSING...");
                // mineBlocks(100);
                console.log(
                    "_randomLockTimestamp <= block.timestamp => until: %s, block.number, block.timestamp: %s",
                    _randomLockTimestamp,
                    block.number,
                    block.timestamp
                );
                console.log("calculatedExpectedTimestamp: %s", calculatedExpectedTimestamp);
                console.log("timestampToLockDate: %s", timestampToLockDate);

                uint256 userBalanceBefore = sov.balanceOf(user);
                uint256 stakingBalanceBefore = sov.balanceOf(address(staking));

                uint256 blockBefore = block.number;
                mineBlocks(1);

                vm.expectEmit(true, true, true, true);
                emit TokensStaked(user, amount, calculatedExpectedTimestamp, amount);
                staking.stake(uint96(amount), _randomLockTimestamp, address(0), address(0));
                mineBlocks(1);
                uint256 blockAfter = block.number;
                console.log("blockBefore: %s, blockAfter: %s", blockBefore, blockAfter);
                //mineBlocks(1);

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

                mineBlocks((timestampToLockDate - block.timestamp) / 30 + 10);
                // Check getPriorUserStakeByDate

                uint256 priorUserStakeBefore =
                    staking.getPriorUserStakeByDate(user, timestampToLockDate, blockBefore);
                uint256 priorUserStakeAfter =
                    staking.getPriorUserStakeByDate(user, timestampToLockDate, blockAfter);

                console.log(
                    "priorUserStakeAfter: %s, priorUserStakeBefore: %s",
                    priorUserStakeAfter,
                    priorUserStakeBefore
                );
                (uint256[] memory dates, uint96[] memory stakes) = staking.getStakes(user);
                for (uint256 i = 0; i < stakes.length; i++) {
                    console.log("stake %s @ date %s", uint256(stakes[i]), dates[i]);
                }

                assertEq(priorUserStakeAfter - priorUserStakeBefore, amount);
            }
        }
        vm.stopPrank();

        // Check event
    }
}
