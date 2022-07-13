pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../../proxy/modules/interfaces/IFunctionsList.sol";
import "../CheckpointsShared.sol";
import "../../ApprovalReceiver.sol";
import "../StakingShared.sol";

/**
 * @title Staking contract staking functionality module
 **/
contract StakingStakeModule is IFunctionsList, ApprovalReceiver, StakingShared, CheckpointsShared {
    using SafeMath for uint256;

    /**
     * @notice Stake the given amount for the given duration of time.
     * @param amount The number of tokens to stake.
     * @param until Timestamp indicating the date until which to stake.
     * @param stakeFor The address to stake the tokens for or 0x0 if staking for oneself.
     * @param delegatee The address of the delegatee or 0x0 if there is none.
     * */
    function stake(
        uint96 amount,
        uint256 until,
        address stakeFor,
        address delegatee
    ) external whenNotPaused {
        _notSameBlockAsStakingCheckpoint(until); // must wait a block before staking again for that same deadline
        _stake(msg.sender, amount, until, stakeFor, delegatee, false);
    }

    /**
     * @notice Stake the given amount for the given duration of time.
     * @dev This function will be invoked from receiveApproval
     * @dev SOV.approveAndCall -> this.receiveApproval -> this.stakeWithApproval
     * @param sender The sender of SOV.approveAndCall
     * @param amount The number of tokens to stake.
     * @param until Timestamp indicating the date until which to stake.
     * @param stakeFor The address to stake the tokens for or 0x0 if staking for oneself.
     * @param delegatee The address of the delegatee or 0x0 if there is none.
     * */

    function stakeWithApproval(
        address sender,
        uint96 amount,
        uint256 until,
        address stakeFor,
        address delegatee
    ) external onlyThisContract whenNotPaused {
        _stake(sender, amount, until, stakeFor, delegatee, false);
    }

    /**
     * @notice Send sender's tokens to this contract and update its staked balance.
     * @param sender The sender of the tokens.
     * @param amount The number of tokens to send.
     * @param until The date until which the tokens will be staked.
     * @param stakeFor The beneficiary whose stake will be increased.
     * @param delegatee The address of the delegatee or stakeFor if default 0x0.
     * @param timeAdjusted Whether fixing date to stacking periods or not.
     * */
    function _stake(
        address sender,
        uint96 amount,
        uint256 until,
        address stakeFor,
        address delegatee,
        bool timeAdjusted
    ) internal {
        require(amount > 0, "S01"); // amount needs to be bigger than 0

        if (!timeAdjusted) {
            until = _timestampToLockDate(until);
        }
        require(until > block.timestamp, "S02"); // Staking::_timestampToLockDate: staking period too short

        /// @dev Stake for the sender if not specified otherwise.
        if (stakeFor == address(0)) {
            stakeFor = sender;
        }

        /// @dev Delegate for stakeFor if not specified otherwise.
        if (delegatee == address(0)) {
            delegatee = stakeFor;
        }

        /// @dev Do not stake longer than the max duration.
        if (!timeAdjusted) {
            uint256 latest = _timestampToLockDate(block.timestamp + MAX_DURATION);
            if (until > latest) until = latest;
        }

        uint96 previousBalance = _currentBalance(stakeFor, until);

        /// @dev Increase stake.
        _increaseStake(sender, amount, stakeFor, until);

        // @dev Previous version wasn't working properly for the following case:
        //		delegate checkpoint wasn't updating for the second and next stakes for the same date
        //		if  first stake was withdrawn completely and stake was delegated to the staker
        //		(no delegation to another address).
        address previousDelegatee = delegates[stakeFor][until];
        if (previousDelegatee != delegatee) {
            /// @dev Update delegatee.
            delegates[stakeFor][until] = delegatee;

            /// @dev Decrease stake on previous balance for previous delegatee.
            _decreaseDelegateStake(previousDelegatee, until, previousBalance);

            /// @dev Add previousBalance to amount.
            amount = add96(previousBalance, amount, "S03");
        }

        /// @dev Increase stake.
        _increaseDelegateStake(delegatee, until, amount);
        emit DelegateChanged(stakeFor, until, previousDelegatee, delegatee);
    }

    /**
     * @notice Extend the staking duration until the specified date.
     * @param previousLock The old unlocking timestamp.
     * @param until The new unlocking timestamp in seconds.
     * */
    function extendStakingDuration(uint256 previousLock, uint256 until) external whenNotPaused {
        until = _timestampToLockDate(until);
        require(previousLock < until, "S04"); // must increase staking duration

        _notSameBlockAsStakingCheckpoint(previousLock);

        /// @dev Do not exceed the max duration, no overflow possible.
        uint256 latest = _timestampToLockDate(block.timestamp + MAX_DURATION);
        if (until > latest) until = latest;

        /// @dev Update checkpoints.
        /// @dev TODO James: Can reading stake at block.number -1 cause trouble with multiple tx in a block?
        uint96 amount = _getPriorUserStakeByDate(msg.sender, previousLock, block.number - 1);
        require(amount > 0, "S05"); // no stakes till the prev lock date
        _decreaseUserStake(msg.sender, previousLock, amount);
        _increaseUserStake(msg.sender, until, amount);

        if (_isVestingContract(msg.sender)) {
            _decreaseVestingStake(previousLock, amount);
            _increaseVestingStake(until, amount);
        }

        _decreaseDailyStake(previousLock, amount);
        _increaseDailyStake(until, amount);

        /// @dev Delegate might change: if there is already a delegate set for the until date, it will remain the delegate for this position
        address delegateFrom = delegates[msg.sender][previousLock];
        address delegateTo = delegates[msg.sender][until];
        if (delegateTo == address(0)) {
            delegateTo = delegateFrom;
            delegates[msg.sender][until] = delegateFrom;
        }
        delegates[msg.sender][previousLock] = address(0);
        _decreaseDelegateStake(delegateFrom, previousLock, amount);
        _increaseDelegateStake(delegateTo, until, amount);

        emit ExtendedStakingDuration(msg.sender, previousLock, until, amount);
    }

    /**
     * @notice Send sender's tokens to this contract and update its staked balance.
     * @param sender The sender of the tokens.
     * @param amount The number of tokens to send.
     * @param stakeFor The beneficiary whose stake will be increased.
     * @param until The date until which the tokens will be staked.
     * */
    function _increaseStake(
        address sender,
        uint96 amount,
        address stakeFor,
        uint256 until
    ) internal {
        /// @dev Retrieve the SOV tokens.
        bool success = SOVToken.transferFrom(sender, address(this), amount);
        require(success);

        /// @dev Increase staked balance.
        uint96 balance = _currentBalance(stakeFor, until);
        balance = add96(balance, amount, "S06"); // increaseStake: overflow

        /// @dev Update checkpoints.
        _increaseDailyStake(until, amount);
        _increaseUserStake(stakeFor, until, amount);

        if (_isVestingContract(stakeFor)) _increaseVestingStake(until, amount);

        emit TokensStaked(stakeFor, amount, until, balance);
    }

    /**
     * @notice Stake tokens according to the vesting schedule.
     * @param amount The amount of tokens to stake.
     * @param cliff The time interval to the first withdraw.
     * @param duration The staking duration.
     * @param intervalLength The length of each staking interval when cliff passed.
     * @param stakeFor The address to stake the tokens for or 0x0 if staking for oneself.
     * @param delegatee The address of the delegatee or 0x0 if there is none.
     * */
    function stakeBySchedule(
        uint256 amount,
        uint256 cliff,
        uint256 duration,
        uint256 intervalLength,
        address stakeFor,
        address delegatee
    ) external whenNotPaused {
        /**
         * @dev Stake them until lock dates according to the vesting schedule.
         * Note: because staking is only possible in periods of 2 weeks,
         * the total duration might end up a bit shorter than specified
         * depending on the date of staking.
         * */
        uint256 start = _timestampToLockDate(block.timestamp + cliff);
        if (duration > MAX_DURATION) {
            duration = MAX_DURATION;
        }
        uint256 end = _timestampToLockDate(block.timestamp + duration);
        uint256 numIntervals = (end - start) / intervalLength + 1;
        uint256 stakedPerInterval = amount / numIntervals;
        /// @dev stakedPerInterval might lose some dust on rounding. Add it to the first staking date.
        if (numIntervals >= 1) {
            _stake(
                msg.sender,
                uint96(amount - stakedPerInterval * (numIntervals - 1)),
                start,
                stakeFor,
                delegatee,
                true
            );
        }
        /// @dev Stake the rest in 4 week intervals.
        for (uint256 i = start + intervalLength; i <= end; i += intervalLength) {
            /// @dev Stakes for itself, delegates to the owner.
            _notSameBlockAsStakingCheckpoint(i); // must wait a block before staking again for that same deadline
            _stake(msg.sender, uint96(stakedPerInterval), i, stakeFor, delegatee, true);
        }
    }

    /**
     * @notice Get the number of staked tokens held by the user account.
     * @dev Iterate checkpoints adding up stakes.
     * @param account The address of the account to get the balance of.
     * @return The number of tokens held.
     * */
    function balanceOf(address account) external view returns (uint96 balance) {
        for (uint256 i = kickoffTS; i <= block.timestamp + MAX_DURATION; i += TWO_WEEKS) {
            balance = add96(balance, _currentBalance(account, i), "S12"); // Staking::balanceOf: overflow
        }
    }

    /**
     * @notice Get the current number of tokens staked for a day.
     * @param lockedTS The timestamp to get the staked tokens for.
     * */
    function getCurrentStakedUntil(uint256 lockedTS) external view returns (uint96) {
        uint32 nCheckpoints = numTotalStakingCheckpoints[lockedTS];
        return nCheckpoints > 0 ? totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake : 0;
    }

    /**
     * @notice Get list of stakes for a user account.
     * @param account The address to get stakes.
     * @return The arrays of dates and stakes.
     * */
    function getStakes(address account)
        external
        view
        returns (uint256[] memory dates, uint96[] memory stakes)
    {
        uint256 latest = _timestampToLockDate(block.timestamp + MAX_DURATION);

        /// @dev Calculate stakes.
        uint256 count = 0;
        /// @dev We need to iterate from first possible stake date after deployment to the latest from current time.
        for (uint256 i = kickoffTS + TWO_WEEKS; i <= latest; i += TWO_WEEKS) {
            if (_currentBalance(account, i) > 0) {
                count++;
            }
        }
        dates = new uint256[](count);
        stakes = new uint96[](count);

        /// @dev We need to iterate from first possible stake date after deployment to the latest from current time.
        uint256 j = 0;
        for (uint256 i = kickoffTS + TWO_WEEKS; i <= latest; i += TWO_WEEKS) {
            uint96 balance = _currentBalance(account, i);
            if (balance > 0) {
                dates[j] = i;
                stakes[j] = balance;
                j++;
            }
        }
    }

    /**
     * @notice Overrides default ApprovalReceiver._getToken function to
     * register SOV token on this contract.
     * @return The address of SOV token.
     * */
    function _getToken() internal view returns (address) {
        return address(SOVToken);
    }

    /**
     * @notice Overrides default ApprovalReceiver._getSelectors function to
     * register stakeWithApproval selector on this contract.
     * @return The array of registered selectors on this contract.
     */
    function _getSelectors() internal pure returns (bytes4[] memory) {
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = this.stakeWithApproval.selector;
        return selectors;
    }

    /**
     * @notice Unstaking is possible every 2 weeks only. This means, to
     * calculate the key value for the staking checkpoints, we need to
     * map the intended timestamp to the closest available date.
     * @param timestamp The unlocking timestamp.
     * @return The actual unlocking date (might be up to 2 weeks shorter than intended).
     * */
    function timestampToLockDate(uint256 timestamp) external view returns (uint256) {
        return _timestampToLockDate(timestamp);
    }

    function getFunctionsList() external pure returns (bytes4[] memory) {
        bytes4[] memory functionList = new bytes4[](8);
        functionList[0] = this.stake.selector;
        functionList[1] = this.stakeWithApproval.selector;
        functionList[2] = this.extendStakingDuration.selector;
        functionList[3] = this.stakeBySchedule.selector;
        functionList[4] = this.balanceOf.selector;
        functionList[5] = this.getCurrentStakedUntil.selector;
        functionList[6] = this.getStakes.selector;
        functionList[7] = this.timestampToLockDate.selector;
        return functionList;
    }
}
