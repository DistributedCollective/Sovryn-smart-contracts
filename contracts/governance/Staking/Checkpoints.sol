pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./StakingStorage.sol";
import "./SafeMath96.sol";

/**
 * @title Checkpoints contract.
 * @notice Increases and decreases storage values for users, delegatees and
 * total daily stake.
 * */
contract Checkpoints is StakingStorage, SafeMath96 {
    /// @notice An event emitted when an account changes its delegate.
    event DelegateChanged(
        address indexed delegator,
        uint256 lockedUntil,
        address indexed fromDelegate,
        address indexed toDelegate
    );

    /// @notice An event emitted when a delegate account's stake balance changes.
    event DelegateStakeChanged(
        address indexed delegate,
        uint256 lockedUntil,
        uint256 previousBalance,
        uint256 newBalance
    );

    /// @notice An event emitted when tokens get staked.
    event TokensStaked(
        address indexed staker,
        uint256 amount,
        uint256 lockedUntil,
        uint256 totalStaked
    );

    /// @notice An event emitted when staked tokens get withdrawn.
    event StakingWithdrawn(
        address indexed staker,
        uint256 amount,
        uint256 until,
        address indexed receiver,
        bool isGovernance
    );

    /// @notice An event emitted when vesting tokens get withdrawn.
    event VestingTokensWithdrawn(address vesting, address receiver);

    /// @notice An event emitted when the owner unlocks all tokens.
    event TokensUnlocked(uint256 amount);

    /// @notice An event emitted when a staking period gets extended.
    event ExtendedStakingDuration(
        address indexed staker,
        uint256 previousDate,
        uint256 newDate,
        uint256 amountStaked
    );

    event AdminAdded(address admin);

    event AdminRemoved(address admin);

    event ContractCodeHashAdded(bytes32 hash);

    event ContractCodeHashRemoved(bytes32 hash);

    event VestingStakeSet(uint256 lockedTS, uint96 value);

    /**
     * @notice Increases the user's vesting stake for a giving lock date and writes a checkpoint.
     * @param lockedTS The lock date.
     * @param value The value to add to the staked balance.
     * */
    function _increaseVestingStake(uint256 lockedTS, uint96 value) internal {
        uint32 nCheckpoints = numVestingCheckpoints[lockedTS];
        uint96 vested = vestingCheckpoints[lockedTS][nCheckpoints - 1].stake;
        uint96 newVest =
            add96(vested, value, "Staking::_increaseVestingStake: vested amount overflow");
        _writeVestingCheckpoint(lockedTS, nCheckpoints, newVest);
    }

    /**
     * @notice Decreases the user's vesting stake for a giving lock date and writes a checkpoint.
     * @param lockedTS The lock date.
     * @param value The value to substract to the staked balance.
     * */
    function _decreaseVestingStake(uint256 lockedTS, uint96 value) internal {
        uint32 nCheckpoints = numVestingCheckpoints[lockedTS];
        uint96 vested = vestingCheckpoints[lockedTS][nCheckpoints - 1].stake;
        uint96 newVest =
            sub96(vested, value, "Staking::_decreaseVestingStake: vested amount underflow");
        _writeVestingCheckpoint(lockedTS, nCheckpoints, newVest);
    }

    /**
     * @notice Writes on storage the user vested amount.
     * @param lockedTS The lock date.
     * @param nCheckpoints The number of checkpoints, to find out the last one index.
     * @param newVest The new vest balance.
     * */
    function _writeVestingCheckpoint(
        uint256 lockedTS,
        uint32 nCheckpoints,
        uint96 newVest
    ) internal {
        uint32 blockNumber =
            safe32(block.number, "Staking::_writeVestingCheckpoint: block number exceeds 32 bits");

        if (
            nCheckpoints > 0 &&
            vestingCheckpoints[lockedTS][nCheckpoints - 1].fromBlock == blockNumber
        ) {
            vestingCheckpoints[lockedTS][nCheckpoints - 1].stake = newVest;
        } else {
            vestingCheckpoints[lockedTS][nCheckpoints] = Checkpoint(blockNumber, newVest);
            numVestingCheckpoints[lockedTS] = nCheckpoints + 1;
        }
    }

    /**
     * @notice Increases the user's stake for a giving lock date and writes a checkpoint.
     * @param account The user address.
     * @param lockedTS The lock date.
     * @param value The value to add to the staked balance.
     * */
    function _increaseUserStake(
        address account,
        uint256 lockedTS,
        uint96 value
    ) internal {
        uint32 nCheckpoints = numUserStakingCheckpoints[account][lockedTS];
        uint96 staked = userStakingCheckpoints[account][lockedTS][nCheckpoints - 1].stake;
        uint96 newStake =
            add96(staked, value, "Staking::_increaseUserStake: staked amount overflow");
        _writeUserCheckpoint(account, lockedTS, nCheckpoints, newStake);
    }

    /**
     * @notice Decreases the user's stake for a giving lock date and writes a checkpoint.
     * @param account The user address.
     * @param lockedTS The lock date.
     * @param value The value to substract to the staked balance.
     * */
    function _decreaseUserStake(
        address account,
        uint256 lockedTS,
        uint96 value
    ) internal {
        uint32 nCheckpoints = numUserStakingCheckpoints[account][lockedTS];
        uint96 staked = userStakingCheckpoints[account][lockedTS][nCheckpoints - 1].stake;
        uint96 newStake =
            sub96(staked, value, "Staking::_decreaseUserStake: staked amount underflow");
        _writeUserCheckpoint(account, lockedTS, nCheckpoints, newStake);
    }

    /**
     * @notice Writes on storage the user stake.
     * @param account The user address.
     * @param lockedTS The lock date.
     * @param nCheckpoints The number of checkpoints, to find out the last one index.
     * @param newStake The new staked balance.
     * */
    function _writeUserCheckpoint(
        address account,
        uint256 lockedTS,
        uint32 nCheckpoints,
        uint96 newStake
    ) internal {
        uint32 blockNumber =
            safe32(block.number, "Staking::_writeStakingCheckpoint: block number exceeds 32 bits");

        if (
            nCheckpoints > 0 &&
            userStakingCheckpoints[account][lockedTS][nCheckpoints - 1].fromBlock == blockNumber
        ) {
            userStakingCheckpoints[account][lockedTS][nCheckpoints - 1].stake = newStake;
        } else {
            userStakingCheckpoints[account][lockedTS][nCheckpoints] = Checkpoint(
                blockNumber,
                newStake
            );
            numUserStakingCheckpoints[account][lockedTS] = nCheckpoints + 1;
        }
    }

    /**
     * @notice Increases the delegatee's stake for a giving lock date and writes a checkpoint.
     * @param delegatee The delegatee address.
     * @param lockedTS The lock date.
     * @param value The value to add to the staked balance.
     * */
    function _increaseDelegateStake(
        address delegatee,
        uint256 lockedTS,
        uint96 value
    ) internal {
        uint32 nCheckpoints = numDelegateStakingCheckpoints[delegatee][lockedTS];
        uint96 staked = delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake;
        uint96 newStake =
            add96(staked, value, "Staking::_increaseDelegateStake: staked amount overflow");
        _writeDelegateCheckpoint(delegatee, lockedTS, nCheckpoints, newStake);
    }

    /**
     * @notice Decreases the delegatee's stake for a giving lock date and writes a checkpoint.
     * @param delegatee The delegatee address.
     * @param lockedTS The lock date.
     * @param value The value to substract to the staked balance.
     * */
    function _decreaseDelegateStake(
        address delegatee,
        uint256 lockedTS,
        uint96 value
    ) internal {
        uint32 nCheckpoints = numDelegateStakingCheckpoints[delegatee][lockedTS];
        uint96 staked = delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake;
        uint96 newStake = 0;
        // @dev We need to check delegate checkpoint value here,
        //		because we had an issue in `stake` function:
        //		delegate checkpoint wasn't updating for the second and next stakes for the same date
        //		if first stake was withdrawn completely and stake was delegated to the staker
        //		(no delegation to another address).
        // @dev It can be greater than 0, but inconsistent after 3 transactions
        if (staked > value) {
            newStake = sub96(
                staked,
                value,
                "Staking::_decreaseDelegateStake: staked amount underflow"
            );
        }
        _writeDelegateCheckpoint(delegatee, lockedTS, nCheckpoints, newStake);
    }

    /**
     * @notice Writes on storage the delegate stake.
     * @param delegatee The delegate address.
     * @param lockedTS The lock date.
     * @param nCheckpoints The number of checkpoints, to find out the last one index.
     * @param newStake The new staked balance.
     * */
    function _writeDelegateCheckpoint(
        address delegatee,
        uint256 lockedTS,
        uint32 nCheckpoints,
        uint96 newStake
    ) internal {
        uint32 blockNumber =
            safe32(block.number, "Staking::_writeStakingCheckpoint: block number exceeds 32 bits");
        uint96 oldStake = delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake;

        if (
            nCheckpoints > 0 &&
            delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].fromBlock ==
            blockNumber
        ) {
            delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake = newStake;
        } else {
            delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints] = Checkpoint(
                blockNumber,
                newStake
            );
            numDelegateStakingCheckpoints[delegatee][lockedTS] = nCheckpoints + 1;
        }
        emit DelegateStakeChanged(delegatee, lockedTS, oldStake, newStake);
    }

    /**
     * @notice Increases the total stake for a giving lock date and writes a checkpoint.
     * @param lockedTS The lock date.
     * @param value The value to add to the staked balance.
     * */
    function _increaseDailyStake(uint256 lockedTS, uint96 value) internal {
        uint32 nCheckpoints = numTotalStakingCheckpoints[lockedTS];
        uint96 staked = totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake;
        uint96 newStake =
            add96(staked, value, "Staking::_increaseDailyStake: staked amount overflow");
        _writeStakingCheckpoint(lockedTS, nCheckpoints, newStake);
    }

    /**
     * @notice Decreases the total stake for a giving lock date and writes a checkpoint.
     * @param lockedTS The lock date.
     * @param value The value to substract to the staked balance.
     * */
    function _decreaseDailyStake(uint256 lockedTS, uint96 value) internal {
        uint32 nCheckpoints = numTotalStakingCheckpoints[lockedTS];
        uint96 staked = totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake;
        uint96 newStake =
            sub96(staked, value, "Staking::_decreaseDailyStake: staked amount underflow");
        _writeStakingCheckpoint(lockedTS, nCheckpoints, newStake);
    }

    /**
     * @notice Writes on storage the total stake.
     * @param lockedTS The lock date.
     * @param nCheckpoints The number of checkpoints, to find out the last one index.
     * @param newStake The new staked balance.
     * */
    function _writeStakingCheckpoint(
        uint256 lockedTS,
        uint32 nCheckpoints,
        uint96 newStake
    ) internal {
        uint32 blockNumber =
            safe32(block.number, "Staking::_writeStakingCheckpoint: block number exceeds 32 bits");

        if (
            nCheckpoints > 0 &&
            totalStakingCheckpoints[lockedTS][nCheckpoints - 1].fromBlock == blockNumber
        ) {
            totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake = newStake;
        } else {
            totalStakingCheckpoints[lockedTS][nCheckpoints] = Checkpoint(blockNumber, newStake);
            numTotalStakingCheckpoints[lockedTS] = nCheckpoints + 1;
        }
    }
}
