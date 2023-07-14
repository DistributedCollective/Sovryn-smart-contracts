// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import { IStaking } from "./interfaces/IStaking.sol";
import { IStakingProxy } from "./interfaces/IStaking.sol";
import { IStakingModulesProxy } from "./interfaces/IStaking.sol";
import { IERC20 } from "./interfaces/ITokens.sol";

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

    event ExtendedStakingDuration(
        address indexed staker,
        uint256 previousDate,
        uint256 newDate,
        uint256 amountStaked
    );

    // Test Setup
    function setUp() public virtual {
        // Initialize test variables
        sov = IERC20(
            deployCode("TestToken.sol", abi.encode("Sovryn", "SOV", 18, 100_000_000 ether))
        );
        // console.log("SOV total supply:", sov.totalSupply());

        address[7] memory stakingModules =
            [
                deployCode("StakingAdminModule.sol"),
                deployCode("StakingGovernanceModule.sol"),
                deployCode("StakingStakeModule.sol"),
                deployCode("StakingStorageModule.sol"),
                deployCode("StakingVestingModule.sol"),
                deployCode("StakingWithdrawModule.sol"),
                deployCode("WeightedStakingModule.sol")
            ];

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

    /* @dev commented tests below are aggregated into one test; leaving them here for reference.
    
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

    function testFuzz_AdjustLockDate(uint256 _randomLockTimestamp) external {
        // vm.skip(true); not working here
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
                        _randomLockTimestamp > block.timestamp + maxDuration
                            ? block.timestamp - kickoffTS + maxDuration
                            : _randomLockTimestamp - kickoffTS
                    ) / TWO_WEEKS) *
                    TWO_WEEKS;

            timestampToLockDate = staking.timestampToLockDate(_randomLockTimestamp);
            if (timestampToLockDate > calculatedExpectedTimestamp) {
                timestampToLockDate = calculatedExpectedTimestamp;
            }
            if (timestampToLockDate <= block.timestamp || _randomLockTimestamp < kickoffTS) {
                //vm.expectRevert("Staking::_timestampToLockDate: staking period too short");
                emit log("SHOULD BE REVERTING...");
                vm.expectRevert();
                staking.stake(uint96(amount), _randomLockTimestamp, address(0), address(0));
            } else {
                emit log("SHOULD BE PASSING...");

                uint256 userBalanceBefore = sov.balanceOf(user);
                uint256 stakingBalanceBefore = sov.balanceOf(address(staking));

                uint256 blockBefore = block.number;
                mineBlocks(1);

                vm.expectEmit(true, true, true, true);
                emit TokensStaked(user, amount, calculatedExpectedTimestamp, amount);
                staking.stake(uint96(amount), _randomLockTimestamp, address(0), address(0));
                mineBlocks(1);
                uint256 blockAfter = block.number;

                // Get final balances
                uint256 userBalanceAfter = sov.balanceOf(user);
                uint256 stakingBalanceAfter = sov.balanceOf(address(staking));

                // Check balances
                assertEq(userBalanceBefore - userBalanceAfter, amount);
                assertEq(stakingBalanceAfter - stakingBalanceBefore, amount);

                mineBlocks((timestampToLockDate - block.timestamp) / 30 + 10);
                // Check getPriorUserStakeByDate

                uint256 priorUserStakeBefore =
                    staking.getPriorUserStakeByDate(user, timestampToLockDate, blockBefore);
                uint256 priorUserStakeAfter =
                    staking.getPriorUserStakeByDate(user, timestampToLockDate, blockAfter);

                (uint256[] memory dates, uint96[] memory stakes) = staking.getStakes(user);
                for (uint256 i = 0; i < stakes.length; i++) {
                    console.log("stake %s @ date %s", uint256(stakes[i]), dates[i]);
                }

                assertEq(priorUserStakeAfter - priorUserStakeBefore, amount);
            }
        }
        vm.stopPrank();
    }

    function testFuzz_Stake(uint256 _randomLockTimestamp, uint256 _amount) external {
        // vm.skip(true); not working here
        _randomLockTimestamp = bound(
            _randomLockTimestamp,
            kickoffTS + TWO_WEEKS,
            block.timestamp + staking.MAX_DURATION()
        );
        _amount = bound(_amount, 0, sov.totalSupply());
        amount = _amount;
        deal(address(sov), user, amount);
        mineBlocks(1);
        vm.startPrank(user);
        sov.approve(address(staking), amount);
        mineBlocks(1);
        uint256 timestampToLockDate = staking.timestampToLockDate(_randomLockTimestamp);

        uint256 userBalanceBefore = sov.balanceOf(user);
        uint256 stakingBalanceBefore = sov.balanceOf(address(staking));

        uint256 blockBefore = block.number;
        mineBlocks(1);

        if (amount == 0) {
            vm.expectRevert("amount needs to be bigger than 0");
            staking.stake(uint96(amount), _randomLockTimestamp, address(0), address(0));
            return;
        }

        vm.expectEmit(true, true, true, true);
        emit TokensStaked(user, amount, timestampToLockDate, amount);
        staking.stake(uint96(amount), _randomLockTimestamp, address(0), address(0));
        mineBlocks(1);
        uint256 blockAfter = block.number;

        // Get final balances
        uint256 userBalanceAfter = sov.balanceOf(user);
        uint256 stakingBalanceAfter = sov.balanceOf(address(staking));

        // Check balances
        assertEq(userBalanceBefore - userBalanceAfter, amount);
        assertEq(stakingBalanceAfter - stakingBalanceBefore, amount);

        mineBlocks((timestampToLockDate - block.timestamp) / 30 + 10);
        // Check getPriorUserStakeByDate

        uint256 priorUserStakeBefore =
            staking.getPriorUserStakeByDate(user, timestampToLockDate, blockBefore);
        uint256 priorUserStakeAfter =
            staking.getPriorUserStakeByDate(user, timestampToLockDate, blockAfter);

        (uint256[] memory dates, uint96[] memory stakes) = staking.getStakes(user);
        for (uint256 i = 0; i < stakes.length; i++) {
            console.log("stake %s @ date %s", uint256(stakes[i]), dates[i]);
        }

        assertEq(priorUserStakeAfter - priorUserStakeBefore, amount);

        vm.stopPrank();
    }

    function testFuzz_ExtendStakingDurationWith2Stakes(uint256 _extendUntil) external {
        /*@todo remove
        _randomLockTimestamp = bound(
            _randomLockTimestamp,
            kickoffTS + TWO_WEEKS,
            block.timestamp + staking.MAX_DURATION()
        );*/
        // _amount = bound(_amount, 0, sov.totalSupply());
        deal(address(sov), user, amount);
        mineBlocks(1);
        vm.startPrank(user);
        sov.approve(address(staking), amount);
        mineBlocks(1);
        uint256 lockedDate = kickoffTS + TWO_WEEKS * 2;

        // @todo check require(previousLock < until, "must increase staking duration");
        // @todo check emit ExtendedStakingDuration(msg.sender, previousLock, until, amount);

        uint256 userBalanceBefore = sov.balanceOf(user);
        uint256 stakingBalanceBefore = sov.balanceOf(address(staking));

        // uint256 blockBefore = block.number;
        mineBlocks(1);

        staking.stake(uint96(amount), lockedDate, address(0), address(0));

        console.log("timestamp %s < contract creation %s?", lockedDate, _extendUntil);
        if (_extendUntil == 0 || _extendUntil < kickoffTS) {
            vm.expectRevert("timestamp < contract creation");
            staking.extendStakingDuration(lockedDate, _extendUntil);
            return;
        }

        // extending in the same block as staking is not allowed
        vm.expectRevert("cannot be mined in the same block as last stake");
        staking.extendStakingDuration(lockedDate, _extendUntil);

        mineBlocks(1);

        //require(previousLock < until, "must increase staking duration");
        if (staking.timestampToLockDate(_extendUntil) <= lockedDate) {
            vm.expectRevert("must increase staking duration");
            staking.extendStakingDuration(lockedDate, _extendUntil);
            return;
        }

        /* console.log(
            "staking.timestampToLockDate(_extendUntil) %s > lockedDate %s ?",
            staking.timestampToLockDate(_extendUntil),
            lockedDate
        );*/

        // should fail if previous lock date has no stake
        if (staking.timestampToLockDate(_extendUntil) > lockedDate + 2 * 1 weeks) {
            vm.expectRevert("no stakes till the prev lock date");
            staking.extendStakingDuration(lockedDate + 2 * 1 weeks, _extendUntil);
            return;
        }

        // should revert on incorrect until timestamp
        if (_extendUntil == 0) {
            vm.expectRevert();
            staking.extendStakingDuration(lockedDate, _extendUntil);
        }

        uint96 amount2 = uint96(2000);
        deal(address(sov), user, amount2);
        sov.approve(address(staking), amount2);
        uint256 lockedDate2 = lockedDate + 2 * 1 weeks;
        staking.stake(amount2, lockedDate2, address(0), address(0));

        uint256 blockBefore = block.number;
        mineBlocks(1);

        // EXTEND DURATION WITH ANOTHER STAKE
        vm.expectEmit();
        emit ExtendedStakingDuration(user, lockedDate, lockedDate2, amount);
        staking.extendStakingDuration(lockedDate, lockedDate2);
        uint256 blockAfter = block.number;

        mineBlocks(1);

        // getPriorTotalStakesByDate
        assertEq(staking.getPriorUserStakeByDate(user, lockedDate, blockAfter), 0);
        assertEq(staking.getPriorUserStakeByDate(user, lockedDate2, blockAfter), amount2 + amount);

        //check delegatee
        assertEq(staking.delegates(user, lockedDate), address(0));
        assertEq(staking.delegates(user, lockedDate2), user);

        //check getPriorTotalStakesForDate
        uint256 priorTotalStakeBefore =
            staking.getPriorTotalStakesForDate(lockedDate, blockBefore);
        uint256 priorTotalStakeAfter = staking.getPriorTotalStakesForDate(lockedDate, blockAfter);
        assertEq(priorTotalStakeBefore - priorTotalStakeAfter, amount);

        uint256 priorTotalStakeBefore2 =
            staking.getPriorTotalStakesForDate(lockedDate2, blockBefore);
        uint256 priorTotalStakeAfter2 =
            staking.getPriorTotalStakesForDate(lockedDate2, blockAfter);
        assertEq(priorTotalStakeBefore2 - priorTotalStakeAfter2, amount);

        vm.stopPrank();
    }
}
