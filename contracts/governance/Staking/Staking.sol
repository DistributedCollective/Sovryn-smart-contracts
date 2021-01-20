pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./WeightedStaking.sol";
import "./IStaking.sol";
import "../Vesting/IVesting.sol";

contract Staking is IStaking, WeightedStaking {
	/**
	 * @notice stakes the given amount for the given duration of time.
	 * @dev only if staked balance is 0.
	 * @param amount the number of tokens to stake
	 * @param until timestamp indicating the date until which to stake
	 * @param stakeFor the address to stake the tokens for or 0x0 if staking for oneself
	 * @param delegatee the address of the delegatee or 0x0 if there is none.
	 */
	function stake(
		uint96 amount,
		uint256 until,
		address stakeFor,
		address delegatee
	) public {
		require(amount > 0, "Staking::stake: amount of tokens to stake needs to be bigger than 0");

		until = timestampToLockDate(until);
		require(until > block.timestamp, "Staking::timestampToLockDate: staking period too short");

		//stake for the msg.sender if not specified otherwise
		if (stakeFor == address(0)) {
			stakeFor = msg.sender;
		}
		//delegate for stakeFor if not specified otherwise
		if (delegatee == address(0)) {
			delegatee = stakeFor;
		}
		//do not stake longer than the max duration
		uint256 latest = timestampToLockDate(block.timestamp + MAX_DURATION);
		if (until > latest) until = latest;

		uint96 previousBalance = currentBalance(stakeFor, until);
		//increase stake
		_increaseStake(amount, stakeFor, until);

		if (previousBalance == 0) {
			//regular delegation if it's a first stake
			_delegate(stakeFor, delegatee, until);
		} else {
			address previousDelegatee = delegates[stakeFor][until];
			if (previousDelegatee != delegatee) {
				//decrease stake on previous balance for previous delegatee
				_decreaseDelegateStake(previousDelegatee, until, previousBalance);
				//add previousBalance to amount
				amount = add96(previousBalance, amount, "Staking::stake: balance overflow");
			}
			//increase stake
			_increaseDelegateStake(delegatee, until, amount);
		}
	}

	/**
	 * @notice extends the staking duration until the specified date
	 * @param previousLock the old unlocking timestamp
	 * @param until the new unlocking timestamp in S
	 * */
	function extendStakingDuration(uint256 previousLock, uint256 until) public {
		until = timestampToLockDate(until);
		require(previousLock <= until, "Staking::extendStakingDuration: cannot reduce the staking duration");

		//do not exceed the max duration, no overflow possible
		uint256 latest = timestampToLockDate(block.timestamp + MAX_DURATION);
		if (until > latest) until = latest;

		//update checkpoints
		//todo James: can reading stake at block.number -1 cause trouble with multiple tx in a block?
		uint96 amount = getPriorUserStakeByDate(msg.sender, previousLock, block.number - 1);
		require(amount > 0, "Staking::extendStakingDuration: nothing staked until the previous lock date");
		_decreaseUserStake(msg.sender, previousLock, amount);
		_increaseUserStake(msg.sender, until, amount);
		_decreaseDailyStake(previousLock, amount);
		_increaseDailyStake(until, amount);
		//delegate might change: if there is already a delegate set for the until date, it will remain the delegate for this position
		address delegateFrom = delegates[msg.sender][previousLock];
		address delegateTo = delegates[msg.sender][until];
		if (delegateTo == address(0)) {
			delegateTo = delegateFrom;
			delegates[msg.sender][until] = delegateFrom;
		}
		delegates[msg.sender][previousLock] = address(0);
		_decreaseDelegateStake(delegateFrom, previousLock, amount);
		_increaseDelegateStake(delegateTo, until, amount);

		emit ExtendedStakingDuration(msg.sender, previousLock, until);
	}

	function _increaseStake(
		uint96 amount,
		address stakeFor,
		uint256 until
	) internal {
		//retrieve the SOV tokens
		bool success = SOVToken.transferFrom(msg.sender, address(this), amount);
		require(success);

		//increase staked balance
		uint96 balance = currentBalance(stakeFor, until);
		balance = add96(balance, amount, "Staking::increaseStake: balance overflow");

		//update checkpoints
		_increaseDailyStake(until, amount);
		_increaseUserStake(stakeFor, until, amount);

		emit TokensStaked(stakeFor, amount, until, balance);
	}

	/**
	 * @notice stakes tokens according to the vesting schedule
	 * @param amount the amount of tokens to stake
	 * @param cliff the time interval to the first withdraw
	 * @param duration the staking duration
	 * @param intervalLength the length of each staking interval when cliff passed
	 * @param stakeFor the address to stake the tokens for or 0x0 if staking for oneself
	 * @param delegatee the address of the delegatee or 0x0 if there is none.
	 * */
	function stakesBySchedule(
		uint256 amount,
		uint256 cliff,
		uint256 duration,
		uint256 intervalLength,
		address stakeFor,
		address delegatee
	) public {
		//stake them until lock dates according to the vesting schedule
		//note: because staking is only possible in periods of 2 weeks, the total duration might
		//end up a bit shorter than specified depending on the date of staking.
		uint256 start = block.timestamp + cliff;
		uint256 end = block.timestamp + duration;
		uint256 numIntervals = (end - start) / intervalLength + 1;
		uint256 stakedPerInterval = amount / numIntervals;
		//stakedPerInterval might lose some dust on rounding. add it to the first staking date
		if (numIntervals > 1) {
			stake(uint96(amount - stakedPerInterval * (numIntervals - 1)), start, stakeFor, delegatee);
		}
		//stake the rest in 4 week intervals
		for (uint256 i = start + intervalLength; i <= end; i += intervalLength) {
			//stakes for itself, delegates to the owner
			stake(uint96(stakedPerInterval), i, stakeFor, delegatee);
		}
	}

	/**
	 * @notice withdraws the given amount of tokens if they are unlocked
	 * @param amount the number of tokens to withdraw
	 * @param until the date until which the tokens were staked
	 * @param receiver the receiver of the tokens. If not specified, send to the msg.sender
	 * */
	function withdraw(
		uint96 amount,
		uint256 until,
		address receiver
	) public {
		_withdraw(amount, until, receiver, false);
	}

	/**
	 * @notice withdraws the given amount of tokens
	 * @param amount the number of tokens to withdraw
	 * @param until the date until which the tokens were staked
	 * @param receiver the receiver of the tokens. If not specified, send to the msg.sender
	 * @dev can be invoked only by whitelisted contract passed to governanceWithdrawVesting
	 * */
	function governanceWithdraw(
		uint96 amount,
		uint256 until,
		address receiver
	) public {
		require(vestingWhitelist[msg.sender], "unauthorized");

		_withdraw(amount, until, receiver, true);
	}

	/**
	 * @notice withdraws tokens for vesting contact
	 * @param vesting the address of Vesting contract
	 * @param receiver the receiver of the tokens. If not specified, send to the msg.sender
	 * @dev can be invoked only by whitelisted contract passed to governanceWithdrawVesting
	 * */
	function governanceWithdrawVesting(address vesting, address receiver) public onlyOwner {
		vestingWhitelist[vesting] = true;
		IVesting(vesting).governanceWithdrawTokens(receiver);
		vestingWhitelist[vesting] = false;

		emit VestingTokensWithdrawn(vesting, receiver);
	}

	function _withdraw(
		uint96 amount,
		uint256 until,
		address receiver,
		bool isGovernance
	) internal {
		_validateWithdrawParams(amount, until);

		//determine the receiver
		if (receiver == address(0)) receiver = msg.sender;

		//update the checkpoints
		_decreaseDailyStake(until, amount);
		_decreaseUserStake(msg.sender, until, amount);
		_decreaseDelegateStake(delegates[msg.sender][until], until, amount);

		//early unstaking should be punished
		if (block.timestamp < until && !allUnlocked && !isGovernance) {
			uint96 punishedAmount = _getPunishedAmount(amount, until);
			amount -= punishedAmount;

			//punishedAmount can be 0 if block.timestamp are very close to 'until'
			if (punishedAmount > 0) {
				require(address(feeSharing) != address(0), "Staking::withdraw: FeeSharing address wasn't set");
				//move punished amount to fee sharing
				//approve transfer here and let feeSharing do transfer and write checkpoint
				SOVToken.approve(address(feeSharing), punishedAmount);
				feeSharing.transferTokens(address(SOVToken), punishedAmount);
			}
		}

		//transferFrom
		bool success = SOVToken.transfer(receiver, amount);
		require(success, "Staking::withdraw: Token transfer failed");

		emit TokensWithdrawn(msg.sender, receiver, amount);
	}

	/**
	 * @notice returns available and punished amount for withdrawing
	 * @param amount the number of tokens to withdraw
	 * @param until the date until which the tokens were staked
	 * */
	function getWithdrawAmounts(uint96 amount, uint256 until) public view returns (uint96, uint96) {
		_validateWithdrawParams(amount, until);
		uint96 punishedAmount = _getPunishedAmount(amount, until);
		return (amount - punishedAmount, punishedAmount);
	}

	/**
	 * @notice returns punished amount for withdrawing
	 * @param amount the number of tokens to withdraw
	 * @param until the date until which the tokens were staked
	 * */
	function _getPunishedAmount(uint96 amount, uint256 until) internal view returns (uint96) {
		uint256 date = timestampToLockDate(block.timestamp);
		uint96 weight = computeWeightByDate(until, date); // (10 - 1) * WEIGHT_FACTOR
		weight = weight * weightScaling;
		return (amount * weight) / WEIGHT_FACTOR / 100;
	}

	/**
	 * @notice validates withdraw parameters
	 * @param amount the number of tokens to withdraw
	 * @param until the date until which the tokens were staked
	 * */
	function _validateWithdrawParams(uint96 amount, uint256 until) internal view {
		require(amount > 0, "Staking::withdraw: amount of tokens to be withdrawn needs to be bigger than 0");
		uint96 balance = getPriorUserStakeByDate(msg.sender, until, block.number - 1);
		require(amount <= balance, "Staking::withdraw: not enough balance");
	}

	/**
	 * @notice returns the current balance of for an account locked until a certain date
	 * @param account the user address
	 * @param lockDate the lock date
	 * @return the lock date of the last checkpoint
	 * */
	function currentBalance(address account, uint256 lockDate) internal view returns (uint96) {
		return userStakingCheckpoints[account][lockDate][numUserStakingCheckpoints[account][lockDate] - 1].stake;
	}

	/**
	 * @notice Get the number of staked tokens held by the `account`
	 * @param account The address of the account to get the balance of
	 * @return The number of tokens held
	 */
	function balanceOf(address account) public view returns (uint96 balance) {
		for (uint256 i = kickoffTS; i <= block.timestamp + MAX_DURATION; i += TWO_WEEKS) {
			balance = add96(balance, currentBalance(account, i), "Staking::balanceOf: overflow");
		}
	}

	/**
	 * @notice Delegate votes from `msg.sender` which are locked until lockDate to `delegatee`
	 * @param delegatee The address to delegate votes to
	 * @param lockDate the date if the position to delegate
	 */
	function delegate(address delegatee, uint256 lockDate) public {
		return _delegate(msg.sender, delegatee, lockDate);
	}

	/**
	 * @notice Delegates votes from signatory to `delegatee`
	 * @param delegatee The address to delegate votes to
	 * @param lockDate the date until which the position is locked
	 * @param nonce The contract state required to match the signature
	 * @param expiry The time at which to expire the signature
	 * @param v The recovery byte of the signature
	 * @param r Half of the ECDSA signature pair
	 * @param s Half of the ECDSA signature pair
	 */
	function delegateBySig(
		address delegatee,
		uint256 lockDate,
		uint256 nonce,
		uint256 expiry,
		uint8 v,
		bytes32 r,
		bytes32 s
	) public {
		bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), getChainId(), address(this)));
		bytes32 structHash = keccak256(abi.encode(DELEGATION_TYPEHASH, delegatee, lockDate, nonce, expiry));
		bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
		address signatory = ecrecover(digest, v, r, s);
		require(signatory != address(0), "Staking::delegateBySig: invalid signature");
		require(nonce == nonces[signatory]++, "Staking::delegateBySig: invalid nonce");
		require(now <= expiry, "Staking::delegateBySig: signature expired");
		return _delegate(signatory, delegatee, lockDate);
	}

	/**
	 * @notice Gets the current votes balance for `account`
	 * @param account The address to get votes balance
	 * @return The number of current votes for `account`
	 */
	function getCurrentVotes(address account) external view returns (uint96) {
		return getPriorVotes(account, block.number - 1, block.timestamp);
	}

	/**
	 * @notice gets the current number of tokens staked for a day
	 * @param lockedTS the timestamp to get the staked tokens for
	 */
	function getCurrentStakedUntil(uint256 lockedTS) external view returns (uint96) {
		uint32 nCheckpoints = numTotalStakingCheckpoints[lockedTS];
		return nCheckpoints > 0 ? totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake : 0;
	}

	function _delegate(
		address delegator,
		address delegatee,
		uint256 lockedTS
	) internal {
		address currentDelegate = delegates[delegator][lockedTS];
		uint96 delegatorBalance = currentBalance(delegator, lockedTS);
		delegates[delegator][lockedTS] = delegatee;

		emit DelegateChanged(delegator, lockedTS, currentDelegate, delegatee);

		_moveDelegates(currentDelegate, delegatee, delegatorBalance, lockedTS);
	}

	function _moveDelegates(
		address srcRep,
		address dstRep,
		uint96 amount,
		uint256 lockedTS
	) internal {
		if (srcRep != dstRep && amount > 0) {
			if (srcRep != address(0)) _decreaseDelegateStake(srcRep, lockedTS, amount);

			if (dstRep != address(0)) _increaseDelegateStake(dstRep, lockedTS, amount);
		}
	}

	function getChainId() internal pure returns (uint256) {
		uint256 chainId;
		assembly {
			chainId := chainid()
		}
		return chainId;
	}

	/**
	 * @notice allows the owner to set a new staking contract. as a consequence it allows the stakers to migrate their positions
	 * to the new contract.
	 * @dev doesn't have any influence as long as migrateToNewStakingContract is not implemented.
	 * @param _newStakingContract the address of the new staking contract
	 */
	function setNewStakingContract(address _newStakingContract) public onlyOwner {
		require(_newStakingContract != address(0), "can't reset the new staking contract to 0");
		newStakingContract = _newStakingContract;
	}

	/**
	 * @notice allows the owner to set a fee sharing proxy contract, we need it for unstaking with slashing.
	 * @param _feeSharing the address of FeeSharingProxy contract
	 */
	function setFeeSharing(address _feeSharing) public onlyOwner {
		require(_feeSharing != address(0), "FeeSharing address shouldn't be 0");
		feeSharing = IFeeSharingProxy(_feeSharing);
	}

	/**
	 * @notice allows the owner to set weight scaling, we need it for unstaking with slashing.
	 * @param _weightScaling the weight scaling
	 */
	function setWeightScaling(uint96 _weightScaling) public onlyOwner {
		require(
			MIN_WEIGHT_SCALING <= _weightScaling && _weightScaling <= MAX_WEIGHT_SCALING,
			"weight scaling doesn't belong to range [1, 9]"
		);
		weightScaling = _weightScaling;
	}

	/**
	 * @notice allows a staker to migrate his positions to the new staking contract.
	 * @dev staking contract needs to be set before by the owner. currently not implemented, just needed for the interface.
	 *      in case it's needed at some point in the future, the implementation needs to be changed first.
	 */
	function migrateToNewStakingContract() public {
		require(newStakingContract != address(0), "there is no new staking contract set");
		//implementation:
		//iterate over all possible lock dates from now until now + MAX_DURATION
		//read the stake & delegate of the msg.sender
		//if stake > 0, stake it at the new contract until the lock date with the current delegate
	}

	/**
	 * @notice allow the owner to unlock all tokens in case the staking contract is going to be replaced
	 * note: not reversible on purpose. once unlocked, everything is unlocked. the owner should not be able to just quickly
	 * unlock to withdraw his own tokens and lock again.
	 * @dev last resort.
	 */
	function unlockAllTokens() public onlyOwner {
		allUnlocked = true;
		emit TokensUnlocked(SOVToken.balanceOf(address(this)));
	}

	/**
	 * @notice Gets list of stakes for `account`
	 * @param account The address to get stakes
	 * @return The arrays of dates and stakes
	 */
	function getStakes(address account) external view returns (uint256[] memory dates, uint96[] memory stakes) {
		uint256 latest = timestampToLockDate(block.timestamp + MAX_DURATION);

		//calculate stakes
		uint256 count = 0;
		//we need to iterate from first possible stake date after deployment to the latest from current time
		for (uint256 i = kickoffTS + TWO_WEEKS; i <= latest; i += TWO_WEEKS) {
			if (currentBalance(account, i) > 0) {
				count++;
			}
		}
		dates = new uint256[](count);
		stakes = new uint96[](count);

		//we need to iterate from first possible stake date after deployment to the latest from current time
		uint256 j = 0;
		for (uint256 i = kickoffTS + TWO_WEEKS; i <= latest; i += TWO_WEEKS) {
			uint96 currentBalance = currentBalance(account, i);
			if (currentBalance > 0) {
				dates[j] = i;
				stakes[j] = currentBalance;
				j++;
			}
		}
	}
}
