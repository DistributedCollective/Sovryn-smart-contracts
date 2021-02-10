pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./Checkpoints.sol";

contract WeightedStaking is Checkpoints {
	/************* TOTAL VOTING POWER COMPUTATION ************************/

	/**
	 * @notice computes the total voting power at a given time
	 * @param time the timestamp for which to calculate the total voting power
	 * @return the total voting power at the given time
	 * */
	function getPriorTotalVotingPower(uint32 blockNumber, uint256 time) public view returns (uint96 totalVotingPower) {
		//start the computation with the exact or previous unlocking date (voting weight remians the same until the next break point)
		uint256 start = timestampToLockDate(time);
		uint256 end = start + MAX_DURATION;

		//max 78 iterations
		for (uint256 i = start; i <= end; i += TWO_WEEKS) {
			totalVotingPower = add96(
				totalVotingPower,
				_totalPowerByDate(i, start, blockNumber),
				"WeightedStaking::getPriorTotalVotingPower: overflow on total voting power computation"
			);
		}
	}

	/**
	 * @notice computes the voting power for a secific date
	 * @param date the staking date to compute the power for
	 * @param startDate the date for which we need to know the power of the stake
	 * @param blockNumber the block number. needed for checkpointing.
	 * */
	function _totalPowerByDate(
		uint256 date,
		uint256 startDate,
		uint256 blockNumber
	) internal view returns (uint96 power) {
		uint96 weight = computeWeightByDate(date, startDate);
		uint96 staked = getPriorTotalStakesForDate(date, blockNumber);
		//weight is multiplied by some factor to allow decimals.
		power = mul96(staked, weight, "WeightedStaking::_totalPowerByDate: multiplication overflow") / WEIGHT_FACTOR;
	}

	/**
	 * @notice Determine the prior number of stake for an unlocking date as of a block number
	 * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
	 * @param date The date to check the stakes for
	 * @param blockNumber The block number to get the vote balance at
	 * @return The number of votes the account had as of the given block
	 */
	function getPriorTotalStakesForDate(uint256 date, uint256 blockNumber) public view returns (uint96) {
		require(blockNumber < block.number, "WeightedStaking::getPriorTotalStakesForDate: not yet determined");

		uint32 nCheckpoints = numTotalStakingCheckpoints[date];
		if (nCheckpoints == 0) {
			return 0;
		}

		// First check most recent balance
		if (totalStakingCheckpoints[date][nCheckpoints - 1].fromBlock <= blockNumber) {
			return totalStakingCheckpoints[date][nCheckpoints - 1].stake;
		}

		// Next check implicit zero balance
		if (totalStakingCheckpoints[date][0].fromBlock > blockNumber) {
			return 0;
		}

		uint32 lower = 0;
		uint32 upper = nCheckpoints - 1;
		while (upper > lower) {
			uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
			Checkpoint memory cp = totalStakingCheckpoints[date][center];
			if (cp.fromBlock == blockNumber) {
				return cp.stake;
			} else if (cp.fromBlock < blockNumber) {
				lower = center;
			} else {
				upper = center - 1;
			}
		}
		return totalStakingCheckpoints[date][lower].stake;
	}

	/****************************** DELEGATED VOTING POWER COMPUTATION ************************/

	/**
	 * @notice Determine the prior number of votes for a delegatee as of a block number.
	 * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
	 *      Used for Voting, not for fee sharing.
	 * @param account The address of the account to check
	 * @param blockNumber The block number to get the vote balance at
	 * @return The number of votes the delegatee had as of the given block
	 */
	function getPriorVotes(
		address account,
		uint256 blockNumber,
		uint256 date
	) public view returns (uint96 votes) {
		//if date is not an exact break point, start weight computation from the previous break point (alternative would be the next)
		uint256 start = timestampToLockDate(date);
		uint256 end = start + MAX_DURATION;

		//max 78 iterations
		for (uint256 i = start; i <= end; i += TWO_WEEKS) {
			votes = add96(
				votes,
				_totalPowerByDateForDelegatee(account, i, start, blockNumber),
				"WeightedStaking::getPriorVotes: overflow on total voting power computation"
			);
		}
	}

	/**
	 * @notice computes the voting power for a secific date
	 * @param date the staking date to compute the power for
	 * @param startDate the date for which we need to know the power of the stake
	 * @param blockNumber the block number. needed for checkpointing.
	 * */
	function _totalPowerByDateForDelegatee(
		address account,
		uint256 date,
		uint256 startDate,
		uint256 blockNumber
	) internal view returns (uint96 power) {
		uint96 weight = computeWeightByDate(date, startDate);
		uint96 staked = getPriorStakeByDateForDelegatee(account, date, blockNumber);
		power = mul96(staked, weight, "WeightedStaking::_totalPowerByDateForDelegatee: multiplication overflow") / WEIGHT_FACTOR;
	}

	/**
	 * @notice Determine the prior number of stake for an account as of a block number
	 * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
	 * @param account The address of the account to check
	 * @param blockNumber The block number to get the vote balance at
	 * @return The number of votes the account had as of the given block
	 */
	function getPriorStakeByDateForDelegatee(
		address account,
		uint256 date,
		uint256 blockNumber
	) public view returns (uint96) {
		require(blockNumber < block.number, "WeightedStaking::getPriorStakeByDateForDelegatee: not yet determined");

		uint32 nCheckpoints = numDelegateStakingCheckpoints[account][date];
		if (nCheckpoints == 0) {
			return 0;
		}

		// First check most recent balance
		if (delegateStakingCheckpoints[account][date][nCheckpoints - 1].fromBlock <= blockNumber) {
			return delegateStakingCheckpoints[account][date][nCheckpoints - 1].stake;
		}

		// Next check implicit zero balance
		if (delegateStakingCheckpoints[account][date][0].fromBlock > blockNumber) {
			return 0;
		}

		uint32 lower = 0;
		uint32 upper = nCheckpoints - 1;
		while (upper > lower) {
			uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
			Checkpoint memory cp = delegateStakingCheckpoints[account][date][center];
			if (cp.fromBlock == blockNumber) {
				return cp.stake;
			} else if (cp.fromBlock < blockNumber) {
				lower = center;
			} else {
				upper = center - 1;
			}
		}
		return delegateStakingCheckpoints[account][date][lower].stake;
	}

	/*************************** User Weighted Stake computation for fee sharing *******************************/

	/**
	 * @notice Determine the prior weighted stake for an account as of a block number
	 * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
	 *      Used for fee sharing, not voting.
	 * @param account The address of the account to check
	 * @param blockNumber The block number to get the vote balance at
	 * @return The weighted stake the account had as of the given block
	 */
	function getPriorWeightedStake(
		address account,
		uint256 blockNumber,
		uint256 date
	) public view returns (uint96 votes) {
		//if date is not an exact break point, start weight computation from the previous break point (alternative would be the next)
		uint256 start = timestampToLockDate(date);
		uint256 end = start + MAX_DURATION;

		//max 78 iterations
		for (uint256 i = start; i <= end; i += TWO_WEEKS) {
			uint96 weightedStake = weightedStakeByDate(account, i, start, blockNumber);
			if (weightedStake > 0) {
				votes = add96(votes, weightedStake, "WeightedStaking::getPriorWeightedStake: overflow on total weight computation");
			}
		}
	}

	/**
	 * @notice computes the voting power for a secific date
	 * @param date the staking date to compute the power for
	 * @param startDate the date for which we need to know the power of the stake
	 * @param blockNumber the block number. needed for checkpointing.
	 * */
	function weightedStakeByDate(
		address account,
		uint256 date,
		uint256 startDate,
		uint256 blockNumber
	) public view returns (uint96 power) {
		uint96 staked = getPriorUserStakeByDate(account, date, blockNumber);
		if (staked > 0) {
			uint96 weight = computeWeightByDate(date, startDate);
			power = mul96(staked, weight, "WeightedStaking::weightedStakeByDate: multiplication overflow") / WEIGHT_FACTOR;
		} else {
			power = 0;
		}
	}

	/**
	 * @notice Determine the prior number of stake for an account until a certain lock date as of a block number
	 * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
	 * @param account The address of the account to check
	 * @param date the lock date
	 * @param blockNumber The block number to get the vote balance at
	 * @return The number of votes the account had as of the given block
	 */
	function getPriorUserStakeByDate(
		address account,
		uint256 date,
		uint256 blockNumber
	) public view returns (uint96) {
		require(blockNumber < block.number, "WeightedStaking::getPriorUserStakeAndDate: not yet determined");

		uint32 nCheckpoints = numUserStakingCheckpoints[account][date];
		if (nCheckpoints == 0) {
			return 0;
		}

		// First check most recent balance
		if (userStakingCheckpoints[account][date][nCheckpoints - 1].fromBlock <= blockNumber) {
			return userStakingCheckpoints[account][date][nCheckpoints - 1].stake;
		}

		// Next check implicit zero balance
		if (userStakingCheckpoints[account][date][0].fromBlock > blockNumber) {
			return 0;
		}

		uint32 lower = 0;
		uint32 upper = nCheckpoints - 1;
		while (upper > lower) {
			uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
			Checkpoint memory cp = userStakingCheckpoints[account][date][center];
			if (cp.fromBlock == blockNumber) {
				return cp.stake;
			} else if (cp.fromBlock < blockNumber) {
				lower = center;
			} else {
				upper = center - 1;
			}
		}
		return userStakingCheckpoints[account][date][lower].stake;
	}

	/**************** SHARED FUNCTIONS *********************/

	/**
	 * @notice compute the weight for a specific date
	 * @param date the unlocking date
	 * @param startDate we compute the weight for the tokens staked until 'date' on 'startDate'
	 * */
	function computeWeightByDate(uint256 date, uint256 startDate) public pure returns (uint96 weight) {
		require(date >= startDate, "WeightedStaking::computeWeightByDate: date needs to be bigger than startDate");
		uint256 remainingTime = (date - startDate);
		require(MAX_DURATION >= remainingTime, "Staking::computeWeightByDate:remaining time can't be bigger than max duration");
		// x = max days - remaining days
		uint96 x = uint96(MAX_DURATION - remainingTime) / (1 days);
		//w = (m^2 - x^2)/m^2 +1 (multiplied by the weight factor)
		weight = add96(
			WEIGHT_FACTOR,
			mul96(
				MAX_VOTING_WEIGHT * WEIGHT_FACTOR,
				sub96(MAX_DURATION_POW_2, x * x, "underflow on weight calculation"),
				"multiplication overflow on weight computation"
			) / MAX_DURATION_POW_2,
			"overflow on weight computation"
		);
	}

	/**
	 * @notice unstaking is posisble every 2 weeks only. this means, to calculate the key value for the staking
	 * checkpoints, we need to map the intended timestamp to the closest available date
	 * @param timestamp the unlocking timestamp
	 * @return the actual unlocking date (might be up to 2 weeks shorter than intended)
	 * */
	function timestampToLockDate(uint256 timestamp) public view returns (uint256 lockDate) {
		require(timestamp >= kickoffTS, "WeightedStaking::timestampToLockDate: timestamp lies before contract creation");
		//if staking timestamp does not match any of the unstaking dates, set the lockDate to the closest one before the timestamp
		//e.g. passed timestamps lies 7 weeks after kickoff -> only stake for 6 weeks
		uint256 periodFromKickoff = (timestamp - kickoffTS) / TWO_WEEKS;
		lockDate = periodFromKickoff * TWO_WEEKS + kickoffTS;
	}
}
