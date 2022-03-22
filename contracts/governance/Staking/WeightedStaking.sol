pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./Checkpoints.sol";
import "../../openzeppelin/Address.sol";

/**
 * @title Weighted Staking contract.
 * @notice Computation of power and votes used by FeeSharingProxy and
 * GovernorAlpha and Staking contracts w/ mainly 3 public functions:
 *   + getPriorTotalVotingPower => Total voting power.
 *   + getPriorVotes  => Delegatee voting power.
 *   + getPriorWeightedStake  => User Weighted Stake.
 * Staking contract inherits WeightedStaking.
 * FeeSharingProxy and GovernorAlpha invoke Staking instance functions.
 * */
contract WeightedStaking is Checkpoints {
	using Address for address payable;

	/**
	 * @dev Throws if called by any account other than the owner or admin.
	 */
	modifier onlyAuthorized() {
		require(isOwner() || admins[msg.sender], "WS01"); // unauthorized
		_;
	}

	/**
	 * @dev Throws if called by any account other than the owner or admin or pauser.
	 */
	modifier onlyAuthorizedOrPauser() {
		require(isOwner() || admins[msg.sender] || pausers[msg.sender], "WS02"); // unauthorized
		_;
	}

	/**
	 * @dev Throws if called by any account other than pauser.
	 * @notice Uncomment when needed
	 */
	/*
	modifier onlyPauser() {
		require(pausers[msg.sender], "Not pauser");
		_;
	}
	*/

	/**
	 * @dev Throws if paused.
	 */
	modifier whenNotPaused() {
		require(!paused, "WS03"); // paused
		_;
	}

	/**
	 * @dev Throws if frozen.
	 */
	modifier whenNotFrozen() {
		require(!frozen, "WS04"); // paused
		_;
	}

	/**
	 * @notice sets vesting registry
	 * @param _vestingRegistryProxy the address of vesting registry proxy contract
	 * @dev _vestingRegistryProxy can be set to 0 as this function can be reused by
	 * various other functionalities without the necessity of linking it with Vesting Registry
	 */
	function setVestingRegistry(address _vestingRegistryProxy) external onlyOwner whenNotFrozen {
		vestingRegistryLogic = VestingRegistryLogic(_vestingRegistryProxy);
	}

	/**
	 * @notice Sets the users' vesting stakes for a giving lock dates and writes checkpoints.
	 * @param lockedDates The arrays of lock dates.
	 * @param values The array of values to add to the staked balance.
	 */
	function setVestingStakes(uint256[] calldata lockedDates, uint96[] calldata values) external onlyAuthorized whenNotFrozen {
		require(lockedDates.length == values.length, "WS05"); // arrays mismatch

		uint256 length = lockedDates.length;
		for (uint256 i = 0; i < length; i++) {
			_setVestingStake(lockedDates[i], values[i]);
		}
	}

	/**
	 * @notice Sets the users' vesting stake for a giving lock date and writes a checkpoint.
	 * @param lockedTS The lock date.
	 * @param value The value to be set.
	 */
	function _setVestingStake(uint256 lockedTS, uint96 value) internal {
		//delete all checkpoints (shouldn't be any during the first initialization)
		uint32 nCheckpoints = numVestingCheckpoints[lockedTS];
		for (uint32 i = 0; i < nCheckpoints; i++) {
			delete vestingCheckpoints[lockedTS][i];
		}
		delete numVestingCheckpoints[lockedTS];

		//blockNumber should be in the past
		nCheckpoints = 0;
		uint32 blockNumber = 0;
		vestingCheckpoints[lockedTS][nCheckpoints] = Checkpoint(blockNumber, value);
		numVestingCheckpoints[lockedTS] = nCheckpoints + 1;

		emit VestingStakeSet(lockedTS, value);
	}

	/************* TOTAL VOTING POWER COMPUTATION ************************/

	/**
	 * @notice Compute the total voting power at a given time.
	 * @param blockNumber The block number, needed for checkpointing.
	 * @param time The timestamp for which to calculate the total voting power.
	 * @return The total voting power at the given time.
	 * */
	function getPriorTotalVotingPower(uint32 blockNumber, uint256 time) public view returns (uint96 totalVotingPower) {
		/// @dev Start the computation with the exact or previous unlocking date (voting weight remians the same until the next break point).
		uint256 start = timestampToLockDate(time);
		uint256 end = start + MAX_DURATION;

		/// @dev Max 78 iterations.
		for (uint256 i = start; i <= end; i += TWO_WEEKS) {
			totalVotingPower = add96(totalVotingPower, _totalPowerByDate(i, start, blockNumber), "WS06"); // arrays mismatch
		}
	}

	/**
	 * @notice Compute the voting power for a specific date.
	 * Power = stake * weight
	 * @param date The staking date to compute the power for.
	 * @param startDate The date for which we need to know the power of the stake.
	 * @param blockNumber The block number, needed for checkpointing.
	 * @return The stacking power.
	 * */
	function _totalPowerByDate(
		uint256 date,
		uint256 startDate,
		uint256 blockNumber
	) internal view returns (uint96 power) {
		uint96 weight = computeWeightByDate(date, startDate);
		uint96 staked = getPriorTotalStakesForDate(date, blockNumber);
		/// @dev weight is multiplied by some factor to allow decimals.
		power = mul96(staked, weight, "WS07") / WEIGHT_FACTOR; // mul overflow
	}

	/**
	 * @notice Determine the prior number of stake for an unlocking date as of a block number.
	 * @dev Block number must be a finalized block or else this function will
	 * revert to prevent misinformation.
	 * TODO: WeightedStaking::getPriorTotalStakesForDate should probably better
	 * be internal instead of a public function.
	 * @param date The date to check the stakes for.
	 * @param blockNumber The block number to get the vote balance at.
	 * @return The number of votes the account had as of the given block.
	 * */
	function getPriorTotalStakesForDate(uint256 date, uint256 blockNumber) public view returns (uint96) {
		require(blockNumber < _getCurrentBlockNumber(), "WS08"); // not determined

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
	 * Iterate through checkpoints adding up voting power.
	 * @dev Block number must be a finalized block or else this function will revert
	 * to prevent misinformation.
	 *      Used for Voting, not for fee sharing.
	 * @param account The address of the account to check.
	 * @param blockNumber The block number to get the vote balance at.
	 * @param date The staking date to compute the power for.
	 * @return The number of votes the delegatee had as of the given block.
	 * */
	function getPriorVotes(
		address account,
		uint256 blockNumber,
		uint256 date
	) public view returns (uint96 votes) {
		/// @dev If date is not an exact break point, start weight computation from the previous break point (alternative would be the next).
		uint256 start = timestampToLockDate(date);
		uint256 end = start + MAX_DURATION;

		/// @dev Max 78 iterations.
		for (uint256 i = start; i <= end; i += TWO_WEEKS) {
			votes = add96(votes, _totalPowerByDateForDelegatee(account, i, start, blockNumber), "WS09"); // overflow - total VP
		}
	}

	/**
	 * @notice Compute the voting power for a specific date.
	 * Power = stake * weight
	 * @param account The address of the account to check.
	 * @param date The staking date to compute the power for.
	 * @param startDate The date for which we need to know the power of the stake.
	 * @param blockNumber The block number, needed for checkpointing.
	 * @return The stacking power.
	 * */
	function _totalPowerByDateForDelegatee(
		address account,
		uint256 date,
		uint256 startDate,
		uint256 blockNumber
	) internal view returns (uint96 power) {
		uint96 weight = computeWeightByDate(date, startDate);
		uint96 staked = getPriorStakeByDateForDelegatee(account, date, blockNumber);
		power = mul96(staked, weight, "WS10") / WEIGHT_FACTOR; // overflow
	}

	/**
	 * @notice Determine the prior number of stake for an account as of a block number.
	 * @dev Block number must be a finalized block or else this function will
	 * revert to prevent misinformation.
	 * TODO: WeightedStaking::getPriorStakeByDateForDelegatee should probably better
	 * be internal instead of a public function.
	 * @param account The address of the account to check.
	 * @param date The staking date to compute the power for.
	 * @param blockNumber The block number to get the vote balance at.
	 * @return The number of votes the account had as of the given block.
	 * */
	function getPriorStakeByDateForDelegatee(
		address account,
		uint256 date,
		uint256 blockNumber
	) public view returns (uint96) {
		require(blockNumber < _getCurrentBlockNumber(), "WS11"); // not determined yet

		uint32 nCheckpoints = numDelegateStakingCheckpoints[account][date];
		if (nCheckpoints == 0) {
			return 0;
		}

		/// @dev First check most recent balance.
		if (delegateStakingCheckpoints[account][date][nCheckpoints - 1].fromBlock <= blockNumber) {
			return delegateStakingCheckpoints[account][date][nCheckpoints - 1].stake;
		}

		/// @dev Next check implicit zero balance.
		if (delegateStakingCheckpoints[account][date][0].fromBlock > blockNumber) {
			return 0;
		}

		uint32 lower = 0;
		uint32 upper = nCheckpoints - 1;
		while (upper > lower) {
			uint32 center = upper - (upper - lower) / 2; /// @dev ceil, avoiding overflow.
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
	 * @notice Determine the prior weighted stake for an account as of a block number.
	 * Iterate through checkpoints adding up voting power.
	 * @dev Block number must be a finalized block or else this function will
	 * revert to prevent misinformation.
	 *      Used for fee sharing, not voting.
	 * TODO: WeightedStaking::getPriorWeightedStake is using the variable name "votes"
	 * to add up token stake, and that could be misleading.
	 *
	 * @param account The address of the account to check.
	 * @param blockNumber The block number to get the vote balance at.
	 * @param date The date/timestamp of the unstaking time.
	 * @return The weighted stake the account had as of the given block.
	 * */
	function getPriorWeightedStake(
		address account,
		uint256 blockNumber,
		uint256 date
	) public view returns (uint96 votes) {
		/// @dev If date is not an exact break point, start weight computation from the previous break point (alternative would be the next).
		uint256 start = timestampToLockDate(date);
		uint256 end = start + MAX_DURATION;

		/// @dev Max 78 iterations.
		for (uint256 i = start; i <= end; i += TWO_WEEKS) {
			uint96 weightedStake = weightedStakeByDate(account, i, start, blockNumber);
			if (weightedStake > 0) {
				votes = add96(votes, weightedStake, "WS12"); // overflow on total weight
			}
		}
	}

	/**
	 * @notice Compute the voting power for a specific date.
	 * Power = stake * weight
	 * TODO: WeightedStaking::weightedStakeByDate should probably better
	 * be internal instead of a public function.
	 * @param account The user address.
	 * @param date The staking date to compute the power for.
	 * @param startDate The date for which we need to know the power of the stake.
	 * @param blockNumber The block number, needed for checkpointing.
	 * @return The stacking power.
	 * */
	function weightedStakeByDate(
		address account,
		uint256 date,
		uint256 startDate,
		uint256 blockNumber
	) public view returns (uint96 power) {
		uint96 staked = _getPriorUserStakeByDate(account, date, blockNumber);
		if (staked > 0) {
			uint96 weight = computeWeightByDate(date, startDate);
			power = mul96(staked, weight, "WS13") / WEIGHT_FACTOR; // overflow
		} else {
			power = 0;
		}
	}

	/**
	 * @notice Determine the prior number of stake for an account until a
	 * certain lock date as of a block number.
	 * @dev Block number must be a finalized block or else this function
	 * will revert to prevent misinformation.
	 * @param account The address of the account to check.
	 * @param date The lock date.
	 * @param blockNumber The block number to get the vote balance at.
	 * @return The number of votes the account had as of the given block.
	 * */
	function getPriorUserStakeByDate(
		address account,
		uint256 date,
		uint256 blockNumber
	) external view returns (uint96) {
		uint96 priorStake = _getPriorUserStakeByDate(account, date, blockNumber);
		// @dev we need to modify function in order to workaround issue with Vesting.withdrawTokens:
		//		return 1 instead of 0 if message sender is a contract.
		if (priorStake == 0 && isVestingContract(msg.sender)) {
			priorStake = 1;
		}
		return priorStake;
	}

	/**
	 * @notice Determine the prior number of stake for an account until a
	 * 		certain lock date as of a block number.
	 * @dev All functions of Staking contract use this internal version,
	 * 		we need to modify public function in order to workaround issue with Vesting.withdrawTokens:
	 * return 1 instead of 0 if message sender is a contract.
	 * @param account The address of the account to check.
	 * @param date The lock date.
	 * @param blockNumber The block number to get the vote balance at.
	 * @return The number of votes the account had as of the given block.
	 * */
	function _getPriorUserStakeByDate(
		address account,
		uint256 date,
		uint256 blockNumber
	) internal view returns (uint96) {
		require(blockNumber < _getCurrentBlockNumber(), "WS14"); // not determined

		date = _adjustDateForOrigin(date);
		uint32 nCheckpoints = numUserStakingCheckpoints[account][date];
		if (nCheckpoints == 0) {
			return 0;
		}

		/// @dev First check most recent balance.
		if (userStakingCheckpoints[account][date][nCheckpoints - 1].fromBlock <= blockNumber) {
			return userStakingCheckpoints[account][date][nCheckpoints - 1].stake;
		}

		/// @dev Next check implicit zero balance.
		if (userStakingCheckpoints[account][date][0].fromBlock > blockNumber) {
			return 0;
		}

		uint32 lower = 0;
		uint32 upper = nCheckpoints - 1;
		while (upper > lower) {
			uint32 center = upper - (upper - lower) / 2; /// @dev ceil, avoiding overflow.
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

	/*************************** Weighted Vesting Stake computation for fee sharing *******************************/

	/**
	 * @notice Determine the prior weighted vested amount for an account as of a block number.
	 * Iterate through checkpoints adding up voting power.
	 * @dev Block number must be a finalized block or else this function will
	 * revert to prevent misinformation.
	 *      Used for fee sharing, not voting.
	 * TODO: WeightedStaking::getPriorVestingWeightedStake is using the variable name "votes"
	 * to add up token stake, and that could be misleading.
	 *
	 * @param blockNumber The block number to get the vote balance at.
	 * @param date The staking date to compute the power for.
	 * @return The weighted stake the account had as of the given block.
	 * */
	function getPriorVestingWeightedStake(uint256 blockNumber, uint256 date) public view returns (uint96 votes) {
		/// @dev If date is not an exact break point, start weight computation from the previous break point (alternative would be the next).
		uint256 start = timestampToLockDate(date);
		uint256 end = start + MAX_DURATION;

		/// @dev Max 78 iterations.
		for (uint256 i = start; i <= end; i += TWO_WEEKS) {
			uint96 weightedStake = weightedVestingStakeByDate(i, start, blockNumber);
			if (weightedStake > 0) {
				votes = add96(votes, weightedStake, "WS15"); // overflow on total weight
			}
		}
	}

	/**
	 * @notice Compute the voting power for a specific date.
	 * Power = stake * weight
	 * TODO: WeightedStaking::weightedVestingStakeByDate should probably better
	 * be internal instead of a public function.
	 * @param date The staking date to compute the power for.
	 * @param startDate The date for which we need to know the power of the stake.
	 * @param blockNumber The block number, needed for checkpointing.
	 * @return The stacking power.
	 * */
	function weightedVestingStakeByDate(
		uint256 date,
		uint256 startDate,
		uint256 blockNumber
	) public view returns (uint96 power) {
		uint96 staked = _getPriorVestingStakeByDate(date, blockNumber);
		if (staked > 0) {
			uint96 weight = computeWeightByDate(date, startDate);
			power = mul96(staked, weight, "WS16") / WEIGHT_FACTOR; // multiplication overflow
		} else {
			power = 0;
		}
	}

	/**
	 * @notice Determine the prior number of vested stake for an account until a
	 * certain lock date as of a block number.
	 * @dev Block number must be a finalized block or else this function
	 * will revert to prevent misinformation.
	 * @param date The lock date.
	 * @param blockNumber The block number to get the vote balance at.
	 * @return The number of votes the account had as of the given block.
	 * */
	function getPriorVestingStakeByDate(uint256 date, uint256 blockNumber) external view returns (uint96) {
		return _getPriorVestingStakeByDate(date, blockNumber);
	}

	/**
	 * @notice Determine the prior number of vested stake for an account until a
	 * 		certain lock date as of a block number.
	 * @dev All functions of Staking contract use this internal version,
	 * 		we need to modify public function in order to workaround issue with Vesting.withdrawTokens:
	 * return 1 instead of 0 if message sender is a contract.
	 * @param date The lock date.
	 * @param blockNumber The block number to get the vote balance at.
	 * @return The number of votes the account had as of the given block.
	 * */
	function _getPriorVestingStakeByDate(uint256 date, uint256 blockNumber) internal view returns (uint96) {
		require(blockNumber < _getCurrentBlockNumber(), "WS17"); // not determined

		uint32 nCheckpoints = numVestingCheckpoints[date];
		if (nCheckpoints == 0) {
			return 0;
		}

		/// @dev First check most recent balance.
		if (vestingCheckpoints[date][nCheckpoints - 1].fromBlock <= blockNumber) {
			return vestingCheckpoints[date][nCheckpoints - 1].stake;
		}

		/// @dev Next check implicit zero balance.
		if (vestingCheckpoints[date][0].fromBlock > blockNumber) {
			return 0;
		}

		uint32 lower = 0;
		uint32 upper = nCheckpoints - 1;
		while (upper > lower) {
			uint32 center = upper - (upper - lower) / 2; /// @dev ceil, avoiding overflow.
			Checkpoint memory cp = vestingCheckpoints[date][center];
			if (cp.fromBlock == blockNumber) {
				return cp.stake;
			} else if (cp.fromBlock < blockNumber) {
				lower = center;
			} else {
				upper = center - 1;
			}
		}
		return vestingCheckpoints[date][lower].stake;
	}

	/**************** SHARED FUNCTIONS *********************/

	/**
	 * @notice Determine the current Block Number
	 * @dev This is segregated from the _getPriorUserStakeByDate function to better test
	 * advancing blocks functionality using Mock Contracts
	 * */
	function _getCurrentBlockNumber() internal view returns (uint256) {
		return block.number;
	}

	/**
	 * @notice Compute the weight for a specific date.
	 * @param date The unlocking date.
	 * @param startDate We compute the weight for the tokens staked until 'date' on 'startDate'.
	 * @return The weighted stake the account had as of the given block.
	 * */
	function computeWeightByDate(uint256 date, uint256 startDate) public pure returns (uint96 weight) {
		require(date >= startDate, "WS18"); // date < startDate
		uint256 remainingTime = (date - startDate);
		require(MAX_DURATION >= remainingTime, "WS19"); // remaining time < max duration
		/// @dev x = max days - remaining days
		uint96 x = uint96(MAX_DURATION - remainingTime) / (1 days);
		/// @dev w = (m^2 - x^2)/m^2 +1 (multiplied by the weight factor)
		weight = add96(
			WEIGHT_FACTOR,
			mul96(MAX_VOTING_WEIGHT * WEIGHT_FACTOR, 
				sub96(MAX_DURATION_POW_2, x * x, "WS20" /* weight underflow */), 
				"WS21" /* weight mul overflow */)
				 / MAX_DURATION_POW_2,
			"WS22" /* overflow on weight */
		);
	}

	/**
	 * @notice Unstaking is possible every 2 weeks only. This means, to
	 * calculate the key value for the staking checkpoints, we need to
	 * map the intended timestamp to the closest available date.
	 * @param timestamp The unlocking timestamp.
	 * @return The actual unlocking date (might be up to 2 weeks shorter than intended).
	 * */
	function timestampToLockDate(uint256 timestamp) public view returns (uint256 lockDate) {
		require(timestamp >= kickoffTS, "WS23"); // timestamp < contract creation
		/**
		 * @dev If staking timestamp does not match any of the unstaking dates
		 * , set the lockDate to the closest one before the timestamp.
		 * E.g. Passed timestamps lies 7 weeks after kickoff -> only stake for 6 weeks.
		 * */
		uint256 periodFromKickoff = (timestamp - kickoffTS) / TWO_WEEKS;
		lockDate = periodFromKickoff * TWO_WEEKS + kickoffTS;
	}

	/**
	 * @dev origin vesting contracts have different dates
	 * we need to add 2 weeks to get end of period (by default, it's start)
	 * @param date The staking date to compute the power for.
	 * @return unlocking date.
	 */
	function _adjustDateForOrigin(uint256 date) internal view returns (uint256) {
		uint256 adjustedDate = timestampToLockDate(date);
		//origin vesting contracts have different dates
		//we need to add 2 weeks to get end of period (by default, it's start)
		if (adjustedDate != date) {
			date = adjustedDate + TWO_WEEKS;
		}
		return date;
	}

	/**
	 * @notice Add account to ACL.
	 * @param _admin The addresses of the account to grant permissions.
	 * */
	function addAdmin(address _admin) public onlyOwner whenNotFrozen {
		admins[_admin] = true;
		emit AdminAdded(_admin);
	}

	/**
	 * @notice Remove account from ACL.
	 * @param _admin The addresses of the account to revoke permissions.
	 * */
	function removeAdmin(address _admin) public onlyOwner whenNotFrozen {
		admins[_admin] = false;
		emit AdminRemoved(_admin);
	}

	/**
	 * @notice Add account to pausers ACL.
	 * @param _pauser The address to grant pauser permissions.
	 * */
	function addPauser(address _pauser) public onlyOwner whenNotFrozen {
		pausers[_pauser] = true;
		emit PauserAddedOrRemoved(_pauser, true);
	}

	/**
	 * @notice Add account to pausers ACL.
	 * @param _pauser The address to grant pauser permissions.
	 * */
	function removePauser(address _pauser) public onlyOwner whenNotFrozen {
		delete pausers[_pauser];
		emit PauserAddedOrRemoved(_pauser, false);
	}

	/**
	 * @notice Pause contract
	 * @param _pause true when pausing, false when unpausing
	 * */
	function pauseUnpause(bool _pause) public onlyAuthorizedOrPauser whenNotFrozen {
		paused = _pause;
		emit StakingPaused(_pause);
	}

	/**
	 * @notice Freeze contract - disable functions available even when paused
	 * @param _freeze true when pausing, false when unpausing
	 * */
	function freezeUnfreeze(bool _freeze) public onlyAuthorizedOrPauser whenNotFrozen {
		frozen = _freeze;
		paused = _freeze;
		emit StakingFrozen(_freeze);
	}

	/**
	 * @notice Add vesting contract's code hash to a map of code hashes.
	 * @param vesting The address of Vesting contract.
	 * @dev We need it to use _isVestingContract() function instead of isContract()
	 */
	function addContractCodeHash(address vesting) public onlyAuthorized whenNotFrozen {
		bytes32 codeHash = _getCodeHash(vesting);
		vestingCodeHashes[codeHash] = true;
		emit ContractCodeHashAdded(codeHash);
	}

	/**
	 * @notice Add vesting contract's code hash to a map of code hashes.
	 * @param vesting The address of Vesting contract.
	 * @dev We need it to use _isVestingContract() function instead of isContract()
	 */
	function removeContractCodeHash(address vesting) public onlyAuthorized whenNotFrozen {
		bytes32 codeHash = _getCodeHash(vesting);
		vestingCodeHashes[codeHash] = false;
		emit ContractCodeHashRemoved(codeHash);
	}

	/**
	 * @notice Return flag whether the given address is a registered vesting contract.
	 * @param stakerAddress the address to check
	 */
	function isVestingContract(address stakerAddress) public view returns (bool) {
		bool isVesting;
		bytes32 codeHash = _getCodeHash(stakerAddress);
		if (address(vestingRegistryLogic) != address(0)) {
			isVesting = vestingRegistryLogic.isVestingAdress(stakerAddress);
		}

		if (isVesting) return true;
		if (vestingCodeHashes[codeHash]) return true;
		return false;
	}

	/**
	 * @notice Return hash of contract code
	 */
	function _getCodeHash(address _contract) internal view returns (bytes32) {
		bytes32 codeHash;
		assembly {
			codeHash := extcodehash(_contract)
		}
		return codeHash;
	}
}
