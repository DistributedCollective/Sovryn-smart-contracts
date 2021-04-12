pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./StakingStorage.sol";
import "./SafeMath96.sol";

/**
 * @title Checkpoints contract.
 * @notice Increases and decreases storage values for users, delegatees and daily stake.
 * */
contract Checkpoints is StakingStorage, SafeMath96 {
	/// @notice An event triggered when an account changes its delegate.
	event DelegateChanged(address indexed delegator, uint256 lockedUntil, address indexed fromDelegate, address indexed toDelegate);

	/// @notice An event triggered when a delegate account's stake balance changes.
	event DelegateStakeChanged(address indexed delegate, uint256 lockedUntil, uint256 previousBalance, uint256 newBalance);

	/// @notice An event triggered when tokens get staked.
	event TokensStaked(address indexed staker, uint256 amount, uint256 lockedUntil, uint256 totalStaked);

	/// @notice An event triggered when tokens get withdrawn.
	event TokensWithdrawn(address indexed staker, address receiver, uint256 amount);

	/// @notice An event triggered when vesting tokens get withdrawn.
	event VestingTokensWithdrawn(address vesting, address receiver);

	/// @notice An event triggered when the owner unlocks all tokens.
	event TokensUnlocked(uint256 amount);

	/// @notice An event triggered when a staking period gets extended.
	event ExtendedStakingDuration(address indexed staker, uint256 previousDate, uint256 newDate);

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
		uint96 newStake = add96(staked, value, "Staking::_increaseUserStake: staked amount overflow");
		_writeUserCheckpoint(account, lockedTS, nCheckpoints, newStake);
	}

	/**
	 * @notice Decreases the user's stake for a giving lock date and writes a checkpoint.
	 * @param account The user address.
	 * @param lockedTS The lock date.
	 * @param value The value to add to the staked balance.
	 * */
	function _decreaseUserStake(
		address account,
		uint256 lockedTS,
		uint96 value
	) internal {
		uint32 nCheckpoints = numUserStakingCheckpoints[account][lockedTS];
		uint96 staked = userStakingCheckpoints[account][lockedTS][nCheckpoints - 1].stake;
		uint96 newStake = sub96(staked, value, "Staking::_decreaseUserStake: staked amount underflow");
		_writeUserCheckpoint(account, lockedTS, nCheckpoints, newStake);
	}

	function _writeUserCheckpoint(
		address account,
		uint256 lockedTS,
		uint32 nCheckpoints,
		uint96 newStake
	) internal {
		uint32 blockNumber = safe32(block.number, "Staking::_writeStakingCheckpoint: block number exceeds 32 bits");
		if (nCheckpoints > 0 && userStakingCheckpoints[account][lockedTS][nCheckpoints - 1].fromBlock == blockNumber) {
			userStakingCheckpoints[account][lockedTS][nCheckpoints - 1].stake = newStake;
		} else {
			userStakingCheckpoints[account][lockedTS][nCheckpoints] = Checkpoint(blockNumber, newStake);
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
		uint96 newStake = add96(staked, value, "Staking::_increaseDelegateeStake: staked amount overflow");
		_writeDelegateCheckpoint(delegatee, lockedTS, nCheckpoints, newStake);
	}

	/**
	 * @notice Decreases the delegatee's stake for a giving lock date and writes a checkpoint.
	 * @param delegatee The delegatee address.
	 * @param lockedTS The lock date.
	 * @param value The value to add to the staked balance.
	 * */
	function _decreaseDelegateStake(
		address delegatee,
		uint256 lockedTS,
		uint96 value
	) internal {
		uint32 nCheckpoints = numDelegateStakingCheckpoints[delegatee][lockedTS];
		uint96 staked = delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake;
		uint96 newStake = sub96(staked, value, "Staking::_decreaseDailyStake: staked amount underflow");
		_writeDelegateCheckpoint(delegatee, lockedTS, nCheckpoints, newStake);
	}

	function _writeDelegateCheckpoint(
		address delegatee,
		uint256 lockedTS,
		uint32 nCheckpoints,
		uint96 newStake
	) internal {
		uint32 blockNumber = safe32(block.number, "Staking::_writeStakingCheckpoint: block number exceeds 32 bits");
		uint96 oldStake = delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake;

		if (nCheckpoints > 0 && delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].fromBlock == blockNumber) {
			delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake = newStake;
		} else {
			delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints] = Checkpoint(blockNumber, newStake);
			numDelegateStakingCheckpoints[delegatee][lockedTS] = nCheckpoints + 1;
		}
		emit DelegateStakeChanged(delegatee, lockedTS, oldStake, newStake);
	}

	function _increaseDailyStake(uint256 lockedTS, uint96 value) internal {
		uint32 nCheckpoints = numTotalStakingCheckpoints[lockedTS];
		uint96 staked = totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake;
		uint96 newStake = add96(staked, value, "Staking::_increaseDailyStake: staked amount overflow");
		_writeStakingCheckpoint(lockedTS, nCheckpoints, newStake);
	}

	function _decreaseDailyStake(uint256 lockedTS, uint96 value) internal {
		uint32 nCheckpoints = numTotalStakingCheckpoints[lockedTS];
		uint96 staked = totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake;
		uint96 newStake = sub96(staked, value, "Staking::_decreaseDailyStake: staked amount underflow");
		_writeStakingCheckpoint(lockedTS, nCheckpoints, newStake);
	}

	function _writeStakingCheckpoint(
		uint256 lockedTS,
		uint32 nCheckpoints,
		uint96 newStake
	) internal {
		uint32 blockNumber = safe32(block.number, "Staking::_writeStakingCheckpoint: block number exceeds 32 bits");

		if (nCheckpoints > 0 && totalStakingCheckpoints[lockedTS][nCheckpoints - 1].fromBlock == blockNumber) {
			totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake = newStake;
		} else {
			totalStakingCheckpoints[lockedTS][nCheckpoints] = Checkpoint(blockNumber, newStake);
			numTotalStakingCheckpoints[lockedTS] = nCheckpoints + 1;
		}
	}
}
