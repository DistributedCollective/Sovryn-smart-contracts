// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import { IStaking } from "./interfaces/IStaking.sol";
import { IStakingProxy } from "./interfaces/IStaking.sol";
import { IStakingModulesProxy } from "./interfaces/IStaking.sol";
import {
    IFeeSharingCollector,
    IFeeSharingCollectorProxy
} from "./interfaces/IFeeSharingCollector.sol";
import { IERC20 } from "./interfaces/ITokens.sol";
import { DummyMockContract } from "./mocks/DummyMockContract.sol";

contract StakingFuzzTest is Test {
    // Test Variables
    address private user;
    address private user2;
    address private delegatee;
    uint256 private invalidLockDate;
    uint256 private amount;
    uint256 private kickoffTS;
    uint256 private maxDuration;
    IStaking private staking;
    IERC20 private sov;
    IFeeSharingCollector private feeSharingCollector;
    DummyMockContract private dummyProtocol; // general mock contract, used for foundry mockCall

    uint96 constant MAX_96 = 2**96 - 1;
    uint256 constant MAX_256 = 2**256 - 1;
    uint32 constant MAX_32 = 2**32 - 1;

    struct TestData {
        uint256 userBalance;
        uint256 userStakeTS;
        uint256 delegateeBalance;
        uint256 delegateeStakeTS;
        uint256 userVotingPower;
        uint256 delegateeVotingPower;
        uint256 stakingBalance;
    }

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

    event DelegateChanged(
        address indexed delegator,
        uint256 lockedUntil,
        address indexed fromDelegate,
        address indexed toDelegate
    );

    event StakingWithdrawn(
        address indexed staker,
        uint256 amount,
        uint256 until,
        address indexed receiver,
        bool isGovernance
    );

    // Test Setup
    function setUp() public virtual {
        // Initialize test variables
        sov = IERC20(
            deployCode("TestToken.sol", abi.encode("Sovryn", "SOV", 18, 100_000_000 ether))
        );

        dummyProtocol = new DummyMockContract();

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
        // console.log("kickoffTS + 2 weeks: %s", kickoffTS + 2 weeks);

        // Deploy FeeSharingCollector
        IFeeSharingCollectorProxy feeSharingCollectorProxy =
            IFeeSharingCollectorProxy(
                deployCode(
                    "FeeSharingCollectorProxy.sol",
                    abi.encode(address(dummyProtocol), address(staking))
                )
            );
        feeSharingCollector = IFeeSharingCollector(deployCode("FeeSharingCollector.sol"));
        feeSharingCollectorProxy.setImplementation(address(feeSharingCollector));
        feeSharingCollector = IFeeSharingCollector(address(feeSharingCollectorProxy));

        // Set FeeSharingCollectorProxy as the fee sharing address in the staking contract
        staking.setFeeSharing(address(feeSharingCollector));

        amount = 1000;
        user = address(1);
        user2 = address(2);
        delegatee = address(3);

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
                    ) / 2 weeks) *
                    2 weeks;

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
            kickoffTS + 2 weeks,
            block.timestamp + maxDuration
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
            kickoffTS + 2 weeks,
            block.timestamp + maxDuration
        );*/
        // _amount = bound(_amount, 0, sov.totalSupply());
        deal(address(sov), user, amount);
        mineBlocks(1);
        vm.startPrank(user);
        sov.approve(address(staking), amount);
        mineBlocks(1);
        uint256 lockedDate = kickoffTS + 2 weeks * 2;

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
        mineBlocks(1);
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
        assertEq(priorTotalStakeBefore2, amount2);

        uint256 priorTotalStakeAfter2 =
            staking.getPriorTotalStakesForDate(lockedDate2, blockAfter);
        assertEq(priorTotalStakeAfter2, amount + amount2);

        vm.stopPrank();
    }

    function testFuzz_ExtendStakingDuration(uint256 _extendUntil) external {
        deal(address(sov), user, amount);
        mineBlocks(1);
        vm.startPrank(user);
        sov.approve(address(staking), amount);
        mineBlocks(1);
        uint256 lockedDate = kickoffTS + 2 weeks * 2;

        mineBlocks(1);

        _extendUntil = bound(_extendUntil, kickoffTS + 2 weeks, block.timestamp + maxDuration);

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

        // EXTEND DURATION WITHOUT ANOTHER STAKE

        uint256 blockBefore = block.number;
        mineBlocks(1);
        _extendUntil = bound(_extendUntil, kickoffTS + 2 weeks, block.timestamp + maxDuration);
        uint256 latest = staking.timestampToLockDate(block.timestamp + maxDuration);
        uint256 expectedExtendUntil = staking.timestampToLockDate(_extendUntil);
        if (_extendUntil > latest) {
            assertEq(expectedExtendUntil, latest);
        }
        vm.expectEmit();
        emit ExtendedStakingDuration(user, lockedDate, expectedExtendUntil, amount);
        staking.extendStakingDuration(lockedDate, _extendUntil);
        mineBlocks(1);
        uint256 blockAfter = block.number;
        mineBlocks(1);

        // getPriorUserStakeByDate
        assertEq(staking.getPriorUserStakeByDate(user, lockedDate, blockAfter), 0);
        assertEq(staking.getPriorUserStakeByDate(user, expectedExtendUntil, blockAfter), amount);

        //check delegatee
        assertEq(staking.delegates(user, expectedExtendUntil), user);

        //check getPriorTotalStakesForDate
        uint256 priorTotalStakeBefore =
            staking.getPriorTotalStakesForDate(lockedDate, blockBefore);
        uint256 priorTotalStakeAfter =
            staking.getPriorTotalStakesForDate(expectedExtendUntil, blockAfter);
        assertEq(priorTotalStakeBefore, priorTotalStakeAfter);

        vm.stopPrank();
    }

    function testFuzz_IncreaseStaking(uint256 _increaseAmount) external {
        // prepare
        mineBlocks(1);
        vm.startPrank(user);
        mineBlocks(1);
        uint256 lockedTS = kickoffTS + 4 weeks;
        uint96 _increaseAmount96 = uint96(_increaseAmount);
        uint256 firstStakeBlockNumber;
        uint256 secondStakeBlockNumber;

        sov.approve(address(staking), amount + _increaseAmount96);
        deal(address(sov), user, amount + _increaseAmount96);

        mineBlocks(1);
        firstStakeBlockNumber = block.number;
        staking.stake(uint96(amount), lockedTS, address(0), address(0));

        // test
        mineBlocks(1);
        uint256 userBalanceBeforeIncrease = sov.balanceOf(user);
        assertTrue(sov.balanceOf(address(staking)) == amount);

        console.log("_increaseAmount96: %s", _increaseAmount96);
        console.log("MAX_96: %s", MAX_96);
        if (_increaseAmount96 == 0) {
            vm.expectRevert("amount needs to be bigger than 0");
            staking.stake(_increaseAmount96, lockedTS, address(0), address(0));
            return;
        }

        console.log(
            "_increaseAmount96 %s + amount %s == %s",
            _increaseAmount96,
            amount,
            _increaseAmount96 + amount
        );
        console.log("uint256(MAX_96): %s", uint256(MAX_96));
        if (_increaseAmount96 + amount > uint256(MAX_96)) {
            vm.expectRevert("increaseStake: overflow");
            staking.stake(_increaseAmount96, lockedTS, address(0), address(0));
            return;
        }

        uint256 stakingBalance = sov.balanceOf(address(staking));
        assertTrue(stakingBalance == amount, "Unexpected staking balance");

        address actualDelegatee = staking.delegates(user, lockedTS);
        assertTrue(actualDelegatee == user, "Unexpected delegatee");

        secondStakeBlockNumber = block.number;

        // increase staking
        vm.expectEmit();
        emit TokensStaked({
            staker: user,
            amount: _increaseAmount96,
            lockedUntil: lockedTS,
            totalStaked: amount + _increaseAmount96
        });

        staking.stake(_increaseAmount96, lockedTS, address(0), user2);

        mineBlocks(1);

        // check delegatee
        delegatee = staking.delegates(user, lockedTS);
        assertTrue(delegatee == user2, "Unexpected delegatee");

        stakingBalance = sov.balanceOf(address(staking));
        assertTrue(stakingBalance == amount + _increaseAmount96, "Unexpected staking balance");
        uint256 userBalanceAfterIncrease = sov.balanceOf(user);
        assertTrue(
            userBalanceBeforeIncrease - userBalanceAfterIncrease == _increaseAmount96,
            "Unexpected token balance change"
        );

        // _increaseDailyStake
        uint32 numTotalStakingCheckpoints = staking.numTotalStakingCheckpoints(lockedTS);
        assertTrue(
            numTotalStakingCheckpoints == 2,
            "Unexpected number of total staking checkpoints"
        );

        IStaking.Checkpoint memory checkpoint = staking.totalStakingCheckpoints(lockedTS, 0);
        assertTrue(
            checkpoint.fromBlock == firstStakeBlockNumber,
            "Unexpected total staking checkpoint fromBlock"
        );
        assertTrue(checkpoint.stake == amount, "Unexpected total staking checkpoint stake");

        checkpoint = staking.totalStakingCheckpoints(lockedTS, 1);
        assertTrue(
            checkpoint.fromBlock == secondStakeBlockNumber,
            "Unexpected total staking checkpoint fromBlock"
        );
        assertTrue(
            checkpoint.stake == amount + _increaseAmount96,
            "Unexpected total staking checkpoint stake"
        );

        // _writeUserCheckpoint
        uint256 numUserCheckpoints = staking.numUserStakingCheckpoints(user, lockedTS);
        assertTrue(numUserCheckpoints == 2, "Unexpected number of user staking checkpoints");
        checkpoint = staking.userStakingCheckpoints(user, lockedTS, 0);
        assertTrue(
            checkpoint.fromBlock == firstStakeBlockNumber,
            "Unexpected user staking checkpoint fromBlock"
        );
        assertTrue(checkpoint.stake == amount, "Unexpected user staking checkpoint stake");
        checkpoint = staking.userStakingCheckpoints(user, lockedTS, 1);
        assertTrue(
            checkpoint.fromBlock == secondStakeBlockNumber,
            "Unexpected user staking checkpoint fromBlock"
        );
        assertTrue(
            checkpoint.stake == amount + _increaseAmount96,
            "Unexpected user staking checkpoint stake"
        );

        // delegateStakingCheckpoints - user
        uint32 numDelegateStakingCheckpoints =
            staking.numDelegateStakingCheckpoints(user, lockedTS);
        assertTrue(
            numDelegateStakingCheckpoints == 2,
            "Unexpected number of delegate staking checkpoints for user"
        );
        checkpoint = staking.delegateStakingCheckpoints(user, lockedTS, 0);
        assertTrue(
            checkpoint.fromBlock == firstStakeBlockNumber,
            "Unexpected delegate staking checkpoint fromBlock"
        );
        assertTrue(checkpoint.stake == amount, "Unexpected delegate staking checkpoint stake");
        checkpoint = staking.delegateStakingCheckpoints(user, lockedTS, 1);
        assertTrue(
            checkpoint.fromBlock == secondStakeBlockNumber,
            "Unexpected delegate staking checkpoint fromBlock"
        );
        assertTrue(checkpoint.stake == 0, "Unexpected delegate staking checkpoint stake");

        // delegateStakingCheckpoints - user2
        numDelegateStakingCheckpoints = staking.numDelegateStakingCheckpoints(user2, lockedTS);
        assertTrue(
            numDelegateStakingCheckpoints == 1,
            "Unexpected number of delegate staking checkpoints for account1"
        );
        checkpoint = staking.delegateStakingCheckpoints(user2, lockedTS, 0);
        assertTrue(
            checkpoint.fromBlock == secondStakeBlockNumber,
            "Unexpected delegate staking checkpoint fromBlock"
        );
        assertTrue(
            checkpoint.stake == amount + _increaseAmount96,
            "Unexpected delegate staking checkpoint stake"
        );

        vm.stopPrank();
    }

    // STAKE BY SCHEDULE TESTS

    function testFuzz_StakeBySchedule(
        uint256 _intervalLength,
        uint256 _amount,
        uint256 _duration,
        uint256 _cliff
    ) external {
        vm.startPrank(user);
        if (_amount > 0) {
            emit log_named_uint("deal user", _amount);
            deal(address(sov), user, _amount);
            mineBlocks(1);
            emit log("approving the amount to staking");
            sov.approve(address(staking), _amount);
        }
        mineBlocks(1);
        //vm.assume(intervalLength != (intervalLength / 14 days) * 14 days);
        //uint256 cliff = 2 weeks;
        //uint256 duration = maxDuration;

        // _amount = bound(_amount, 0, sov.totalSupply());
        //uint256 intervalCount = amount / intervalAmount;
        emit log("- TEST KNOWN EXCEPTIONS");
        if (MAX_256 - _cliff < block.timestamp || MAX_256 - _duration < block.timestamp) {
            emit log(">> _cliff or _duration overflow");
            return;
        }
        uint256 startDate = staking.timestampToLockDate(block.timestamp + _cliff);
        uint256 endDate = staking.timestampToLockDate(block.timestamp + _duration);

        // TEST KNOWN EXCEPTIONS
        emit log("TEST KNOWN EXCEPTIONS");

        /*require(
            until > block.timestamp,
            "Staking::_timestampToLockDate: staking period too short"
        ); */
        if (MAX_256 - _duration < startDate) {
            emit log(">> startDate + _duration overflow");
            // vm.expectRevert("Arithmetic over/underflow");
            // startDate + _duration;
            return;
        }

        if (
            _intervalLength == 0 ||
            _amount == 0 ||
            _duration > maxDuration ||
            startDate > endDate ||
            _intervalLength % 2 weeks != 0 ||
            startDate < block.timestamp
        ) {
            vm.expectRevert();
            staking.stakeBySchedule(
                _amount,
                _cliff,
                _duration,
                _intervalLength,
                address(0),
                address(0)
            );
            return;
        }
        // @todo this test is not fuzzz kind of test, but need to check if it can cause issues when used not from the vesting contracts
        vm.expectRevert("Only stakeFor account is allowed to change delegatee");
        staking.stakeBySchedule({
            amount: _amount,
            cliff: _cliff,
            duration: _duration,
            intervalLength: _intervalLength,
            stakeFor: user2,
            delegatee: delegatee
        });

        // TEST UNKNOWN EXCEPTIONS
        emit log("TEST UNKNOWN EXCEPTIONS");

        uint256 intervalCount;
        if (startDate < endDate) {
            intervalCount = (endDate - startDate) / _intervalLength + 1;
        } else {
            intervalCount = 1;
        }

        uint256 intervalAmount = _amount / intervalCount;
        uint256 blockBefore = block.number - 1;
        uint256 blockAfter = block.number;

        for (
            uint256 lockedDate = startDate;
            lockedDate <= endDate;
            lockedDate += _intervalLength
        ) {
            vm.expectEmit();
            emit TokensStaked(user, intervalAmount, lockedDate, intervalAmount);
            emit DelegateChanged(user, lockedDate, address(0), delegatee);
        }

        staking.stakeBySchedule({
            amount: _amount,
            cliff: _cliff,
            duration: _duration,
            intervalLength: _intervalLength,
            stakeFor: user,
            delegatee: delegatee
        });

        for (
            uint256 lockedDate = startDate;
            lockedDate <= endDate;
            lockedDate += _intervalLength
        ) {
            // Check delegatee
            address userDelegatee = staking.delegates(user, lockedDate);
            assertTrue(userDelegatee == delegatee, "Unexpected delegatee");

            // Check getPriorTotalStakesForDate
            uint256 priorTotalStakeBefore =
                staking.getPriorTotalStakesForDate(lockedDate, blockBefore);
            uint256 priorTotalStakeAfter =
                staking.getPriorTotalStakesForDate(lockedDate, blockAfter);
            assertTrue(
                priorTotalStakeAfter - priorTotalStakeBefore == intervalAmount,
                "Unexpected prior total stake difference"
            );

            // Check getPriorUserStakeByDate
            uint256 priorUserStakeBefore =
                staking.getPriorUserStakeByDate(user, lockedDate, blockBefore);
            uint256 priorUserStakeAfter =
                staking.getPriorUserStakeByDate(user, lockedDate, blockAfter);
            assertTrue(
                priorUserStakeAfter - priorUserStakeBefore == intervalAmount,
                "Unexpected prior user stake difference"
            );

            // Check getPriorStakeByDateForDelegatee
            uint256 priorDelegateStakeBefore =
                staking.getPriorStakeByDateForDelegatee(delegatee, lockedDate, blockBefore);
            uint256 priorDelegateStakeAfter =
                staking.getPriorStakeByDateForDelegatee(delegatee, lockedDate, blockAfter);
            assertTrue(
                priorDelegateStakeAfter - priorDelegateStakeBefore == intervalAmount,
                "Unexpected prior delegate stake difference"
            );

            // Event verification
            /*
            vm.expectEmit();
            emit TokensStaked(user, intervalAmount, lockedDate, intervalAmount);
            emit DelegateChanged(user, lockedDate, address(0), delegatee);
            */
        }
        vm.stopPrank();
    }

    /**
     * @param _withdrawTS - random timestamp after the stake timestamp to time travel to and withdraw
     * @param _withdrawAmount - random amount to withdraw
     */
    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_Withdraw(uint256 _withdrawTS, uint256 _withdrawAmount) external {
        // _amount = bound(_amount, 0, sov.totalSupply());
        _withdrawAmount = bound(_withdrawAmount, 0, MAX_96);
        // deal(address(sov), user, _withdrawAmount);
        //deal(address(sov), user, amount);
        //mineBlocks(1);
        // set staking to have more than on stake

        uint256 stakeTimestampToLockDate = staking.timestampToLockDate(block.timestamp);
        uint256 lockDate = staking.timestampToLockDate(block.timestamp + 365 days);

        deal(address(sov), user2, amount * 2);
        vm.startPrank(user2);
        sov.approve(address(staking), amount * 2);
        staking.stake(uint96(amount * 2), 365 days, address(0), address(0));
        emit log_named_uint(
            "1. user2::stake staking.numTotalStakingCheckpoints(lockDate)",
            staking.numTotalStakingCheckpoints(lockDate)
        );
        vm.stopPrank();

        // mineBlocks(7 days);

        vm.startPrank(user);
        sov.approve(address(staking), amount);
        staking.stake(uint96(amount), 365 days, address(0), address(0));
        emit log_named_uint(
            "2. user::stake staking.numTotalStakingCheckpoints(lockDate)",
            staking.numTotalStakingCheckpoints(lockDate)
        );
        //sov.approve(address(staking), amount);

        //@test-case 1) unstaking at the same block as staking, any amount should revert
        vm.expectRevert();
        staking.withdraw(uint96(_withdrawAmount), lockDate, address(0));
        vm.expectRevert();
        staking.withdraw(uint96(amount), lockDate, address(0));

        mineBlocks(1);
        // uint256 timestampToLockDate = staking.timestampToLockDate(_withdrawTS);

        emit log_named_uint("MAX_32", MAX_32);
        emit log_named_uint("MAX_32 * 30", uint256(MAX_32) * 30);
        emit log_named_uint(
            "MAX_32 * 30 + block.timestamp",
            uint256(MAX_32) * 30 + block.timestamp
        );
        uint256 userBalanceBefore = sov.balanceOf(user);
        uint256 stakingBalanceBefore = sov.balanceOf(address(staking));

        // block.number * _timePerBlockInSeconds < MAX_256
        _withdrawTS = bound(
            _withdrawTS,
            block.timestamp,
            (uint256(MAX_32) - block.timestamp - 1) * 30 + block.timestamp
        );

        emit log_named_uint("kickoffTS", kickoffTS);
        emit log_named_uint("block.timestamp", block.timestamp);
        emit log_named_uint("_withdrawTS", _withdrawTS);
        emit log_named_uint(
            "(_withdrawTS - block.timestamp) / 30",
            (_withdrawTS - block.timestamp) / 30
        );
        mineBlocks((_withdrawTS - block.timestamp) / 30);
        mineBlocks(1);

        //@todo set withdrawable timestamp here
        //@todo remove this bound to test an arbitrary amounts testing
        // _withdrawAmount = bound(_withdrawAmount, 1, 1000);
        if (_withdrawAmount == 0 || _withdrawAmount > amount) {
            vm.expectRevert();
            staking.withdraw(uint96(_withdrawAmount), lockDate, address(0));
            return;
        }
        emit log_named_uint("_withdrawAmount", _withdrawAmount);
        uint256 blockNumberAtWithdrawTS = block.number;
        emit log_named_uint("block.number after moving to _withdrawTS", block.number);
        emit log_named_uint("block.timestamp after moving to _withdrawTS", block.timestamp);
        emit log_named_uint("lockDate", lockDate);

        uint96 expectedWithdrawAmount;
        uint96 expectedSlashAmount;

        //@test-case 2) _withdrawTS is in (stake, lockDate) - should withdraw mostly with penalties, depending on amount and time left to lockDate (can be zeroed if close to it)

        if (block.timestamp > stakeTimestampToLockDate) {
            (expectedWithdrawAmount, expectedSlashAmount) = lockDate > block.timestamp
                ? staking.getWithdrawAmounts(uint96(_withdrawAmount), lockDate)
                : (uint96(_withdrawAmount), 0);

            emit log_named_uint("test case 2: expectedWithdrawAmount", expectedWithdrawAmount);
            emit log_named_uint("test case 2: expectedSlashAmount", expectedSlashAmount);
            emit log_named_uint("test case 2: block.timestamp", block.timestamp);

            vm.expectEmit();
            emit StakingWithdrawn({
                staker: user,
                amount: expectedWithdrawAmount,
                until: lockDate,
                receiver: user,
                isGovernance: false
            });

            vm.mockCall(
                address(dummyProtocol),
                abi.encodeWithSelector(dummyProtocol.wrbtcToken.selector),
                abi.encode(address(4))
            );
            emit log_named_uint("test case 2: block.timestamp before withdraw", block.timestamp);
            staking.withdraw(uint96(_withdrawAmount), lockDate, address(0));

            emit log_named_uint("test case 2: block.timestamp after withdraw", block.timestamp);

            assertEq(sov.balanceOf(address(feeSharingCollector)), expectedSlashAmount);

            //@test-case 3) _withdrawTS is in (lockDate, ∞) - should withdraw with no penalties
            if (block.timestamp >= lockDate) {
                assertEq(
                    expectedSlashAmount,
                    0,
                    "block.timestamp >= lockDate but expectedSlashAmount is not 0"
                );
            }
        } else {
            vm.expectRevert();
            staking.withdraw(uint96(_withdrawAmount), lockDate, address(0));
            return;
        }

        //@todo remove tmp return
        //return;

        mineBlocks(1);
        uint256 blockAfter = block.number;
        mineBlocks(1);

        // Get final balances
        uint256 userBalanceAfter = sov.balanceOf(user);
        uint256 stakingBalanceAfter = sov.balanceOf(address(staking));

        // Check balances
        assertEq(userBalanceAfter - userBalanceBefore, expectedWithdrawAmount);
        assertEq(
            stakingBalanceBefore - stakingBalanceAfter,
            expectedWithdrawAmount + expectedSlashAmount
        );

        uint256 withdrawAmount2 = _withdrawAmount; // just pushing up in stack to to work around stack too deep issue

        // Check getPriorUserStakeByDate

        // uint256 withdrawTsToLockDate = staking.timestampToLockDate(_withdrawTS);
        uint256 priorUserStakeBefore =
            staking.getPriorUserStakeByDate(user, lockDate, blockAfter - 2);
        uint256 priorUserStakeAfter = staking.getPriorUserStakeByDate(user, lockDate, blockAfter);

        assertEq(priorUserStakeBefore - priorUserStakeAfter, withdrawAmount2);

        // check user2 staking unchanged
        (uint256[] memory dates, uint96[] memory stakes) = staking.getStakes(user2);
        assertEq(dates.length, 1);
        assertEq(stakes.length, 1);
        assertEq(dates[0], lockDate);
        assertEq(stakes[0], amount * 2);

        // Extended validation
        // _increaseDailyStake
        uint256 lockDate2 = lockDate; // just pushing up in stack to to work around stack too deep issue
        uint32 numTotalStakingCheckpoints = staking.numTotalStakingCheckpoints(lockDate2);
        assertEq(
            numTotalStakingCheckpoints,
            2,
            "1. Unexpected number of total staking checkpoints"
        );

        IStaking.Checkpoint memory checkpoint = staking.totalStakingCheckpoints(lockDate2, 0);

        assertTrue(checkpoint.fromBlock == 2, "2. Unexpected total staking checkpoint fromBlock");

        assertTrue(checkpoint.stake == amount * 3, "3. Unexpected total staking checkpoint stake"); // 2 stakes, 3 amounts in total

        checkpoint = staking.totalStakingCheckpoints(lockDate2, 1);
        assertTrue(
            checkpoint.fromBlock == blockNumberAtWithdrawTS,
            "4. Unexpected total staking checkpoint fromBlock"
        );
        assertTrue(
            checkpoint.stake == amount * 3 - withdrawAmount2,
            "5. Unexpected total staking checkpoint stake"
        );

        // _writeUserCheckpoint
        assertTrue(
            staking.numUserStakingCheckpoints(user, lockDate2) == 2,
            "6. Unexpected number of user staking checkpoints"
        );

        assertTrue(
            staking.numUserStakingCheckpoints(user2, lockDate2) == 1,
            "7. Unexpected number of user2 staking checkpoints"
        );

        checkpoint = staking.userStakingCheckpoints(user, lockDate2, 0);
        assertTrue(checkpoint.fromBlock == 2, "8. Unexpected user staking checkpoint fromBlock");
        assertTrue(checkpoint.stake == amount, "9. Unexpected user staking checkpoint stake");

        checkpoint = staking.userStakingCheckpoints(user, lockDate2, 1);
        assertTrue(
            checkpoint.fromBlock == blockNumberAtWithdrawTS,
            "10. Unexpected user staking checkpoint fromBlock"
        );
        assertTrue(
            checkpoint.stake == amount - withdrawAmount2,
            "11. Unexpected user staking checkpoint stake"
        );

        // _decreaseDelegateStake
        uint32 numDelegateStakingCheckpoints =
            staking.numDelegateStakingCheckpoints(user, lockDate2);
        checkpoint = staking.delegateStakingCheckpoints(
            user,
            lockDate2,
            numDelegateStakingCheckpoints - 1
        );
        assertTrue(
            checkpoint.fromBlock == blockNumberAtWithdrawTS,
            "12. Unexpected delegate staking checkpoint fromBlock"
        );
        assertTrue(
            checkpoint.stake == amount - withdrawAmount2,
            "13. Unexpected delegate staking checkpoint stake"
        );
        assertTrue(
            numDelegateStakingCheckpoints == 2,
            "14. Unexpected number of delegate staking checkpoints"
        );
        vm.clearMockedCalls();
        vm.stopPrank();
    }

    function testFuzz_Delegate(
        uint256 _delegateTS,
        uint256 _stakeAmount,
        address _delegateeIndex,
        uint256 _blocksBetweenStakesIndex,
        bool _userStakesFirst,
        bool _userUnstakesStakesFirst
    ) external {
        _delegateeIndex = bound(_delegateeIndex, 0, 2);
        address[3] memory fuzzDelegatees = [address(0), user, user2];
        uint256[5] memory blocksRangeBetweenStakes =
            [0, 1 days, 14 days, 28 days, 50 days, 60 days]; // 1 block - 30 seconds
        address fuzzDelegatee = fuzzDelegatees[_delegateeIndex];
        _stakeAmount = bound(_stakeAmount, 1, MAX_96);
        _blocksBetweenStakes = bound(_blocksBetweenStakes, 0, 5);
        address firstStakingUser = _userStakeFirst ? user : fuzzDelegatee;
        address secondStakingUser = _userStakeFirst ? fuzzDelegatee : user;

        TestData memory dataBeforeDelegation;
        TestData memory dataAfterDelegation;

        deal(address(sov), user, _stakeAmount);

        mineBlocks(1);

        // fuzz _delegateTS, _withdrawAmount, bool: mine blocks between stakes and delegate addresses to {0x0, user, delegatee}, rsndom stake/unstale order
        // scenario:
        // prepare:
        // - stake for user and delegatee random amounts in random order with random: 0 or a block block between stakes
        // test:
        // - delegate VP from user to delegatee -> check voting power of each
        // - withdraw stake by user and by delegatee in random order, check voting power

        // SETUP
        uint256 stakeTimestampToLockDate = staking.timestampToLockDate(block.timestamp);
        uint256 lockDate = staking.timestampToLockDate(block.timestamp + 365 days);

        deal(address(sov), firstStakingUser, amount * 2);

        vm.startPrank(firstStakingUser);
        uint256 stakeAmount = amount * (firstStakingUser == user ? 1 : 2);
        sov.approve(address(staking), stakeAmount);
        staking.stake(uint96(stakeAmount), 365 days, address(0), address(0));
        emit log_named_uint(
            "1. user2::stake staking.numTotalStakingCheckpoints(lockDate)",
            staking.numTotalStakingCheckpoints(lockDate)
        );
        vm.stopPrank();

        if (firstStakeUser == user) {
            dataBeforeDelegation.userStakeTS = block.timestamp;
        } else {
            dataBeforeDelegation.delegateeStakeTS = block.timestamp;
        }

        uint256 blocksBetweenStakes = blocksRangeBetweenStakes[_blocksBetweenStakesIndex];
        if (mineBlocksBetweenStakes > 0) {
            mineBlocks(blocksBetweenStakes);
        }

        vm.startPrank(secondStakingUser);
        stakeAmount = amount * (secondStakingUser == user ? 1 : 2);
        sov.approve(address(staking), stakeAmount);
        staking.stake(uint96(stakeAmount), 365 days, address(0), address(0));
        vm.stopPrank();

        if (secondStakingUser == user) {
            dataBeforeDelegation.userStakeTS = block.timestamp;
        } else {
            dataBeforeDelegation.delegateeStakeTS = block.timestamp;
        }

        // TEST
        vm.startPrank(user);
        emit log_named_uint(
            "2. user::stake staking.numTotalStakingCheckpoints(lockDate)",
            staking.numTotalStakingCheckpoints(lockDate)
        );
        //sov.approve(address(staking), amount);

        //@test-case 1) delegating in the same block as staking should fail
        vm.expectRevert();
        staking.delegate(fuzzDelegatee, lockDate);

        // mineBlocks(1);
        // uint256 timestampToLockDate = staking.timestampToLockDate(_delegateTS);

        // emit log_named_uint("MAX_32", MAX_32);
        // emit log_named_uint("MAX_32 * 30", uint256(MAX_32) * 30);
        // emit log_named_uint(
        //     "MAX_32 * 30 + block.timestamp",
        //     uint256(MAX_32) * 30 + block.timestamp
        // );

        (
            dataBeforeDelegation.userBalance,
            dataBeforeDelegation.delegateeBalance,
            dataBeforeDelegation.stakingBalance
        ) = (sov.balanceOf(user), sov.balanceOf(fuzzDelegatee), sov.balanceOf(staking));

        // block.number * _timePerBlockInSeconds < MAX_256
        _delegateTS = bound(
            _delegateTS,
            block.timestamp,
            (uint256(MAX_32) - block.timestamp - 1) * 30 + block.timestamp
        );

        emit log_named_uint("kickoffTS", kickoffTS);
        emit log_named_uint("block.timestamp", block.timestamp);
        emit log_named_uint("_delegateTS", _delegateTS);
        emit log_named_uint(
            "(_delegateTS - block.timestamp) / 30",
            (_delegateTS - block.timestamp) / 30
        );

        uint256 mineBlocksQty = (_delegateTS - block.timestamp) / 30;
        mineBlocks(mineBlocksQty);
        if (_delegateTS < dataBeforeDelegation.userStakeTS || _delegateTS > lockDate) {
            vm.ExpectRevert();
            staking.delegate(fuzzDelegatee, lockDate);
            _delegateTS = bound(_delegateTS, block.timestamp + 30, lockDate);
            vm.warp(_delegateTS);
            vm.roll(block.timestamp - mineBlocksQty);
            mineBlocksQty = (_delegateTS - block.timestamp) / 30;
            mineBlocks(mineBlocksQty);
        }

        vm.mockCall(
            address(dummyProtocol),
            abi.encodeWithSelector(dummyProtocol.wrbtcToken.selector),
            abi.encode(address(4))
        );
        //@todo tests (split?), check balances and delegated stake - ? invariants
        // - delegate should pass, check balances and delegated stake
        // - delegate back to the staker (user)
        // - user withdraw, delegate - fail
        // - fuzzDelegatee - withdraw, user - delegate

        vm.expectEmit();
        emit DelegateStakeChanged(fuzzDelegatee, lockedTS, amount * 2, amount * 3);
        emit DelegateStakeChanged(user, lockedTS, amount, 0);
        emit DelegateChanged(user, lockedTS, user, fuzzDelegatee);
        staking.delegate(fuzzDelegatee, lockDate);

        vm.expectEmit();
        emit DelegateStakeChanged(fuzzDelegatee, lockedTS, amount * 3, amount * 2);
        emit DelegateStakeChanged(user, lockedTS, 0, amount);
        emit DelegateChanged(user, lockedTS, fuzzDelegatee, user);
        staking.delegate(user, lockDate);

        assertEq(sov.balanceOf(user), 0);
        assertEq(sov.balanceOf(fuzzDelegatee), 0);
        assertEq(sov.balanceOf(staking), amount * 3);

        mineBlocks(blocksBetweenStakes);
        staking.withdraw(uint96(amount), lockDate, address(0));

        assertEq(sov.balanceOf(user), amount);
        assertEq(sov.balanceOf(staking), amount * 2);
        assertEq(sov.balanceOf(fuzzDelegatee), 0);

        vm.expectRevert();
        staking.delegate(fuzzDelegatee, lockDate);

        mineBlocks(1);
        vm.expectRevert();
        staking.delegate(fuzzDelegatee, lockDate);

        //@todo add checkpoints check

        emit log_named_uint("test case 2: block.timestamp before withdraw", block.timestamp);

        emit log_named_uint("test case 2: block.timestamp after withdraw", block.timestamp);

        //@todo remove tmp return
        //return;

        mineBlocks(1);
        uint256 blockAfter = block.number;
        mineBlocks(1);

        // Get final balances
        uint256 userBalanceAfter = sov.balanceOf(user);
        uint256 stakingBalanceAfter = sov.balanceOf(address(staking));

        // Check balances
        assertEq(userBalanceAfter - userBalanceBefore, expectedWithdrawAmount);
        assertEq(
            stakingBalanceBefore - stakingBalanceAfter,
            expectedWithdrawAmount + expectedSlashAmount
        );

        uint256 withdrawAmount2 = _withdrawAmount; // just pushing up in stack to to work around stack too deep issue

        // Check getPriorUserStakeByDate

        // uint256 withdrawTsToLockDate = staking.timestampToLockDate(_delegateTS);
        uint256 priorUserStakeBefore =
            staking.getPriorUserStakeByDate(user, lockDate, blockAfter - 2);
        uint256 priorUserStakeAfter = staking.getPriorUserStakeByDate(user, lockDate, blockAfter);

        assertEq(priorUserStakeBefore - priorUserStakeAfter, withdrawAmount2);

        // check user2 staking unchanged
        (uint256[] memory dates, uint96[] memory stakes) = staking.getStakes(user2);
        assertEq(dates.length, 1);
        assertEq(stakes.length, 1);
        assertEq(dates[0], lockDate);
        assertEq(stakes[0], amount * 2);

        // Extended validation
        // _increaseDailyStake
        uint256 lockDate2 = lockDate; // just pushing up in stack to to work around stack too deep issue
        uint32 numTotalStakingCheckpoints = staking.numTotalStakingCheckpoints(lockDate2);
        assertEq(
            numTotalStakingCheckpoints,
            2,
            "1. Unexpected number of total staking checkpoints"
        );

        IStaking.Checkpoint memory checkpoint = staking.totalStakingCheckpoints(lockDate2, 0);

        assertTrue(checkpoint.fromBlock == 2, "2. Unexpected total staking checkpoint fromBlock");

        assertTrue(checkpoint.stake == amount * 3, "3. Unexpected total staking checkpoint stake"); // 2 stakes, 3 amounts in total

        checkpoint = staking.totalStakingCheckpoints(lockDate2, 1);
        assertTrue(
            checkpoint.fromBlock == blockNumberAtWithdrawTS,
            "4. Unexpected total staking checkpoint fromBlock"
        );
        assertTrue(
            checkpoint.stake == amount * 3 - withdrawAmount2,
            "5. Unexpected total staking checkpoint stake"
        );

        // _writeUserCheckpoint
        assertTrue(
            staking.numUserStakingCheckpoints(user, lockDate2) == 2,
            "6. Unexpected number of user staking checkpoints"
        );

        assertTrue(
            staking.numUserStakingCheckpoints(user2, lockDate2) == 1,
            "7. Unexpected number of user2 staking checkpoints"
        );

        checkpoint = staking.userStakingCheckpoints(user, lockDate2, 0);
        assertTrue(checkpoint.fromBlock == 2, "8. Unexpected user staking checkpoint fromBlock");
        assertTrue(checkpoint.stake == amount, "9. Unexpected user staking checkpoint stake");

        checkpoint = staking.userStakingCheckpoints(user, lockDate2, 1);
        assertTrue(
            checkpoint.fromBlock == blockNumberAtWithdrawTS,
            "10. Unexpected user staking checkpoint fromBlock"
        );
        assertTrue(
            checkpoint.stake == amount - withdrawAmount2,
            "11. Unexpected user staking checkpoint stake"
        );

        // _decreaseDelegateStake
        uint32 numDelegateStakingCheckpoints =
            staking.numDelegateStakingCheckpoints(user, lockDate2);
        checkpoint = staking.delegateStakingCheckpoints(
            user,
            lockDate2,
            numDelegateStakingCheckpoints - 1
        );
        assertTrue(
            checkpoint.fromBlock == blockNumberAtWithdrawTS,
            "12. Unexpected delegate staking checkpoint fromBlock"
        );
        assertTrue(
            checkpoint.stake == amount - withdrawAmount2,
            "13. Unexpected delegate staking checkpoint stake"
        );
        assertTrue(
            numDelegateStakingCheckpoints == 2,
            "14. Unexpected number of delegate staking checkpoints"
        );
        vm.clearMockedCalls();
        vm.stopPrank();
    }
}
