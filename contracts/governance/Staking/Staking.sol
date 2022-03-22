pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./WeightedStaking.sol";
import "./IStaking.sol";
import "../../rsk/RSKAddrValidator.sol";
import "../Vesting/ITeamVesting.sol";
import "../Vesting/IVesting.sol";
import "../ApprovalReceiver.sol";
import "../../openzeppelin/SafeMath.sol";

/**
 * @title Staking contract.
 * @notice Pay-in and pay-out function for staking and withdrawing tokens.
 * Staking is delegated and vested: To gain voting power, SOV holders must
 * stake their SOV for a given period of time. Aside from Bitocracy
 * participation, there's a financially-rewarding reason for staking SOV.
 * Tokenholders who stake their SOV receive staking rewards, a pro-rata share
 * of the revenue that the platform generates from various transaction fees
 * plus revenues from stakers who have a portion of their SOV slashed for
 * early unstaking.
 * */
contract Staking is IStaking, WeightedStaking, ApprovalReceiver {
	using SafeMath for uint256;

	/// @notice Constant used for computing the vesting dates.
	uint256 constant FOUR_WEEKS = 4 weeks;

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
	) public onlyThisContract whenNotPaused {
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
			until = timestampToLockDate(until);
		}
		require(until > block.timestamp, "S02"); // Staking::timestampToLockDate: staking period too short

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
			uint256 latest = timestampToLockDate(block.timestamp + MAX_DURATION);
			if (until > latest) until = latest;
		}

		uint96 previousBalance = currentBalance(stakeFor, until);

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
	function extendStakingDuration(uint256 previousLock, uint256 until) public whenNotPaused {
		until = timestampToLockDate(until);
		require(previousLock <= until, "S04"); // cannot reduce staking duration

		/// @dev Do not exceed the max duration, no overflow possible.
		uint256 latest = timestampToLockDate(block.timestamp + MAX_DURATION);
		if (until > latest) until = latest;

		/// @dev Update checkpoints.
		/// @dev TODO James: Can reading stake at block.number -1 cause trouble with multiple tx in a block?
		uint96 amount = _getPriorUserStakeByDate(msg.sender, previousLock, block.number - 1);
		require(amount > 0, "S05"); // no stakes till the prev lock date
		_decreaseUserStake(msg.sender, previousLock, amount);
		_increaseUserStake(msg.sender, until, amount);

		if (isVestingContract(msg.sender)) {
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
		uint96 balance = currentBalance(stakeFor, until);
		balance = add96(balance, amount, "S06"); // increaseStake: overflow

		/// @dev Update checkpoints.
		_increaseDailyStake(until, amount);
		_increaseUserStake(stakeFor, until, amount);

		if (isVestingContract(stakeFor)) _increaseVestingStake(until, amount);

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
	function stakesBySchedule(
		uint256 amount,
		uint256 cliff,
		uint256 duration,
		uint256 intervalLength,
		address stakeFor,
		address delegatee
	) public whenNotPaused {
		/**
		 * @dev Stake them until lock dates according to the vesting schedule.
		 * Note: because staking is only possible in periods of 2 weeks,
		 * the total duration might end up a bit shorter than specified
		 * depending on the date of staking.
		 * */
		uint256 start = timestampToLockDate(block.timestamp + cliff);
		if (duration > MAX_DURATION) {
			duration = MAX_DURATION;
		}
		uint256 end = timestampToLockDate(block.timestamp + duration);
		uint256 numIntervals = (end - start) / intervalLength + 1;
		uint256 stakedPerInterval = amount / numIntervals;
		/// @dev stakedPerInterval might lose some dust on rounding. Add it to the first staking date.
		if (numIntervals >= 1) {
			_stake(msg.sender, uint96(amount - stakedPerInterval * (numIntervals - 1)), start, stakeFor, delegatee, true);
		}
		/// @dev Stake the rest in 4 week intervals.
		for (uint256 i = start + intervalLength; i <= end; i += intervalLength) {
			/// @dev Stakes for itself, delegates to the owner.
			_stake(msg.sender, uint96(stakedPerInterval), i, stakeFor, delegatee, true);
		}
	}

	/**
	 * @notice Withdraw the given amount of tokens if they are unlocked.
	 * @param amount The number of tokens to withdraw.
	 * @param until The date until which the tokens were staked.
	 * @param receiver The receiver of the tokens. If not specified, send to the msg.sender
	 * */
	function withdraw(
		uint96 amount,
		uint256 until,
		address receiver
	) public whenNotFrozen {
		_withdraw(amount, until, receiver, false);
		// @dev withdraws tokens for lock date 2 weeks later than given lock date if sender is a contract
		//		we need to check block.timestamp here
		_withdrawNext(amount, until, receiver, false);
	}

	/**
	 * @notice Withdraw the given amount of tokens.
	 * @param amount The number of tokens to withdraw.
	 * @param until The date until which the tokens were staked.
	 * @param receiver The receiver of the tokens. If not specified, send to the msg.sender
	 * @dev Can be invoked only by whitelisted contract passed to governanceWithdrawVesting
	 * */
	function governanceWithdraw(
		uint96 amount,
		uint256 until,
		address receiver
	) public whenNotFrozen {
		require(vestingWhitelist[msg.sender], "S07"); // unauthorized

		_withdraw(amount, until, receiver, true);
		// @dev withdraws tokens for lock date 2 weeks later than given lock date if sender is a contract
		//		we don't need to check block.timestamp here
		_withdrawNext(amount, until, receiver, true);
	}

	/**
	 * @notice Withdraw tokens for vesting contract.
	 * @param vesting The address of Vesting contract.
	 * @param receiver The receiver of the tokens. If not specified, send to the msg.sender
	 * @dev Can be invoked only by whitelisted contract passed to governanceWithdrawVesting.
	 * */
	function governanceWithdrawVesting(address vesting, address receiver) public onlyAuthorized whenNotFrozen {
		vestingWhitelist[vesting] = true;
		ITeamVesting(vesting).governanceWithdrawTokens(receiver);
		vestingWhitelist[vesting] = false;

		emit VestingTokensWithdrawn(vesting, receiver);
	}

	/**
	 * @notice Send user' staked tokens to a receiver taking into account punishments.
	 * Sovryn encourages long-term commitment and thinking. When/if you unstake before
	 * the end of the staking period, a percentage of the original staking amount will
	 * be slashed. This amount is also added to the reward pool and is distributed
	 * between all other stakers.
	 *
	 * @param amount The number of tokens to withdraw.
	 * @param until The date until which the tokens were staked.
	 * @param receiver The receiver of the tokens. If not specified, send to the msg.sender
	 * @param isGovernance Whether all tokens (true)
	 * or just unlocked tokens (false).
	 * */
	function _withdraw(
		uint96 amount,
		uint256 until,
		address receiver,
		bool isGovernance
	) internal {
		// @dev it's very unlikely some one will have 1/10**18 SOV staked in Vesting contract
		//		this check is a part of workaround for Vesting.withdrawTokens issue
		if (amount == 1 && isVestingContract(msg.sender)) {
			return;
		}
		until = _adjustDateForOrigin(until);
		_validateWithdrawParams(amount, until);

		/// @dev Determine the receiver.
		if (receiver == address(0)) receiver = msg.sender;

		/// @dev Update the checkpoints.
		_decreaseDailyStake(until, amount);
		_decreaseUserStake(msg.sender, until, amount);
		if (isVestingContract(msg.sender)) _decreaseVestingStake(until, amount);
		_decreaseDelegateStake(delegates[msg.sender][until], until, amount);

		/// @dev Early unstaking should be punished.
		if (block.timestamp < until && !allUnlocked && !isGovernance) {
			uint96 punishedAmount = _getPunishedAmount(amount, until);
			amount -= punishedAmount;

			/// @dev punishedAmount can be 0 if block.timestamp are very close to 'until'
			if (punishedAmount > 0) {
				require(address(feeSharing) != address(0), "S08"); // FeeSharing address wasn't set
				/// @dev Move punished amount to fee sharing.
				/// @dev Approve transfer here and let feeSharing do transfer and write checkpoint.
				SOVToken.approve(address(feeSharing), punishedAmount);
				feeSharing.transferTokens(address(SOVToken), punishedAmount);
			}
		}

		/// @dev transferFrom
		bool success = SOVToken.transfer(receiver, amount);
		require(success, "S09"); // Token transfer failed

		emit StakingWithdrawn(msg.sender, amount, until, receiver, isGovernance);
	}

	// @dev withdraws tokens for lock date 2 weeks later than given lock date
	function _withdrawNext(
		uint96 amount,
		uint256 until,
		address receiver,
		bool isGovernance
	) internal {
		if (isVestingContract(msg.sender)) {
			uint256 nextLock = until.add(TWO_WEEKS);
			if (isGovernance || block.timestamp >= nextLock) {
				uint96 stakes = _getPriorUserStakeByDate(msg.sender, nextLock, block.number - 1);
				if (stakes > 0) {
					_withdraw(stakes, nextLock, receiver, isGovernance);
				}
			}
		}
	}

	/**
	 * @notice Get available and punished amount for withdrawing.
	 * @param amount The number of tokens to withdraw.
	 * @param until The date until which the tokens were staked.
	 * */
	function getWithdrawAmounts(uint96 amount, uint256 until) public view returns (uint96, uint96) {
		_validateWithdrawParams(amount, until);
		uint96 punishedAmount = _getPunishedAmount(amount, until);
		return (amount - punishedAmount, punishedAmount);
	}

	/**
	 * @notice Get punished amount for withdrawing.
	 * @param amount The number of tokens to withdraw.
	 * @param until The date until which the tokens were staked.
	 * */
	function _getPunishedAmount(uint96 amount, uint256 until) internal view returns (uint96) {
		uint256 date = timestampToLockDate(block.timestamp);
		uint96 weight = computeWeightByDate(until, date); /// @dev (10 - 1) * WEIGHT_FACTOR
		weight = weight * weightScaling;
		return (amount * weight) / WEIGHT_FACTOR / 100;
	}

	/**
	 * @notice Validate withdraw parameters.
	 * @param amount The number of tokens to withdraw.
	 * @param until The date until which the tokens were staked.
	 * */
	function _validateWithdrawParams(uint96 amount, uint256 until) internal view {
		require(amount > 0, "S10"); // Amount of tokens to withdraw must be > 0
		uint96 balance = _getPriorUserStakeByDate(msg.sender, until, block.number - 1);
		require(amount <= balance, "S11"); // Staking::withdraw: not enough balance
	}

	/**
	 * @notice Get the current balance of an account locked until a certain date.
	 * @param account The user address.
	 * @param lockDate The lock date.
	 * @return The stake amount.
	 * */
	function currentBalance(address account, uint256 lockDate) internal view returns (uint96) {
		return userStakingCheckpoints[account][lockDate][numUserStakingCheckpoints[account][lockDate] - 1].stake;
	}

	/**
	 * @notice Get the number of staked tokens held by the user account.
	 * @dev Iterate checkpoints adding up stakes.
	 * @param account The address of the account to get the balance of.
	 * @return The number of tokens held.
	 * */
	function balanceOf(address account) public view returns (uint96 balance) {
		for (uint256 i = kickoffTS; i <= block.timestamp + MAX_DURATION; i += TWO_WEEKS) {
			balance = add96(balance, currentBalance(account, i), "S12"); // Staking::balanceOf: overflow
		}
	}

	/**
	 * @notice Delegate votes from `msg.sender` which are locked until lockDate to `delegatee`.
	 * @param delegatee The address to delegate votes to.
	 * @param lockDate the date if the position to delegate.
	 * */
	function delegate(address delegatee, uint256 lockDate) public whenNotPaused {
		_delegate(msg.sender, delegatee, lockDate);
		// @dev delegates tokens for lock date 2 weeks later than given lock date
		//		if message sender is a contract
		_delegateNext(msg.sender, delegatee, lockDate);
	}

	/**
	 * @notice Delegates votes from signatory to a delegatee account.
	 * Voting with EIP-712 Signatures.
	 *
	 * Voting power can be delegated to any address, and then can be used to
	 * vote on proposals. A key benefit to users of by-signature functionality
	 * is that they can create a signed vote transaction for free, and have a
	 * trusted third-party spend rBTC(or ETH) on gas fees and write it to the
	 * blockchain for them.
	 *
	 * The third party in this scenario, submitting the SOV-holder’s signed
	 * transaction holds a voting power that is for only a single proposal.
	 * The signatory still holds the power to vote on their own behalf in
	 * the proposal if the third party has not yet published the signed
	 * transaction that was given to them.
	 *
	 * @dev The signature needs to be broken up into 3 parameters, known as
	 * v, r and s:
	 * const r = '0x' + sig.substring(2).substring(0, 64);
	 * const s = '0x' + sig.substring(2).substring(64, 128);
	 * const v = '0x' + sig.substring(2).substring(128, 130);
	 *
	 * @param delegatee The address to delegate votes to.
	 * @param lockDate The date until which the position is locked.
	 * @param nonce The contract state required to match the signature.
	 * @param expiry The time at which to expire the signature.
	 * @param v The recovery byte of the signature.
	 * @param r Half of the ECDSA signature pair.
	 * @param s Half of the ECDSA signature pair.
	 * */
	function delegateBySig(
		address delegatee,
		uint256 lockDate,
		uint256 nonce,
		uint256 expiry,
		uint8 v,
		bytes32 r,
		bytes32 s
	) public whenNotPaused {
		/**
		 * @dev The DOMAIN_SEPARATOR is a hash that uniquely identifies a
		 * smart contract. It is built from a string denoting it as an
		 * EIP712 Domain, the name of the token contract, the version,
		 * the chainId in case it changes, and the address that the
		 * contract is deployed at.
		 * */
		bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), getChainId(), address(this)));

		/// @dev GovernorAlpha uses BALLOT_TYPEHASH, while Staking uses DELEGATION_TYPEHASH
		bytes32 structHash = keccak256(abi.encode(DELEGATION_TYPEHASH, delegatee, lockDate, nonce, expiry));

		bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
		address signatory = ecrecover(digest, v, r, s);

		/// @dev Verify address is not null and PK is not null either.
		require(RSKAddrValidator.checkPKNotZero(signatory), "S12"); // Staking::delegateBySig: invalid signature
		require(nonce == nonces[signatory]++, "S14"); // Staking::delegateBySig: invalid nonce
		require(now <= expiry, "S15"); // Staking::delegateBySig: signature expired
		_delegate(signatory, delegatee, lockDate);
		// @dev delegates tokens for lock date 2 weeks later than given lock date
		//		if message sender is a contract
		_delegateNext(signatory, delegatee, lockDate);
	}

	/**
	 * @notice Get the current votes balance for a user account.
	 * @param account The address to get votes balance.
	 * @dev This is a wrapper to simplify arguments. The actual computation is
	 * performed on WeightedStaking parent contract.
	 * @return The number of current votes for a user account.
	 * */
	function getCurrentVotes(address account) external view returns (uint96) {
		return getPriorVotes(account, block.number - 1, block.timestamp);
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
	 * @notice Set new delegatee. Move from user's current delegate to a new
	 * delegatee the stake balance.
	 * @param delegator The user address to move stake balance from its current delegatee.
	 * @param delegatee The new delegatee. The address to move stake balance to.
	 * @param lockedTS The lock date.
	 * */
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

	// @dev delegates tokens for lock date 2 weeks later than given lock date
	//		if message sender is a contract
	function _delegateNext(
		address delegator,
		address delegatee,
		uint256 lockedTS
	) internal {
		if (isVestingContract(msg.sender)) {
			uint256 nextLock = lockedTS.add(TWO_WEEKS);
			address currentDelegate = delegates[delegator][nextLock];
			if (currentDelegate != delegatee) {
				_delegate(delegator, delegatee, nextLock);
			}

			// @dev workaround for the issue with a delegation of the latest stake
			uint256 endDate = IVesting(msg.sender).endDate();
			nextLock = lockedTS.add(FOUR_WEEKS);
			if (nextLock == endDate) {
				currentDelegate = delegates[delegator][nextLock];
				if (currentDelegate != delegatee) {
					_delegate(delegator, delegatee, nextLock);
				}
			}
		}
	}

	/**
	 * @notice Move an amount of delegate stake from a source address to a
	 * destination address.
	 * @param srcRep The address to get the staked amount from.
	 * @param dstRep The address to send the staked amount to.
	 * @param amount The staked amount to move.
	 * @param lockedTS The lock date.
	 * */
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

	/**
	 * @notice Retrieve CHAIN_ID of the executing chain.
	 *
	 * Chain identifier (chainID) introduced in EIP-155 protects transaction
	 * included into one chain from being included into another chain.
	 * Basically, chain identifier is an integer number being used in the
	 * processes of signing transactions and verifying transaction signatures.
	 *
	 * @dev As of version 0.5.12, Solidity includes an assembly function
	 * chainid() that provides access to the new CHAINID opcode.
	 *
	 * TODO: chainId is included in block. So you can get chain id like
	 * block timestamp or block number: block.chainid;
	 * */
	function getChainId() internal pure returns (uint256) {
		uint256 chainId;
		assembly {
			chainId := chainid()
		}
		return chainId;
	}

	/**
	 * @notice Allow the owner to set a new staking contract.
	 * As a consequence it allows the stakers to migrate their positions
	 * to the new contract.
	 * @dev Doesn't have any influence as long as migrateToNewStakingContract
	 * is not implemented.
	 * @param _newStakingContract The address of the new staking contract.
	 * */
	function setNewStakingContract(address _newStakingContract) public onlyOwner whenNotFrozen {
		require(_newStakingContract != address(0), "S16"); // can't reset the new staking contract to 0
		newStakingContract = _newStakingContract;
	}

	/**
	 * @notice Allow the owner to set a fee sharing proxy contract.
	 * We need it for unstaking with slashing.
	 * @param _feeSharing The address of FeeSharingProxy contract.
	 * */
	function setFeeSharing(address _feeSharing) public onlyOwner whenNotFrozen {
		require(_feeSharing != address(0), "S17"); // FeeSharing address shouldn't be 0
		feeSharing = IFeeSharingProxy(_feeSharing);
	}

	/**
	 * @notice Allow the owner to set weight scaling.
	 * We need it for unstaking with slashing.
	 * @param _weightScaling The weight scaling.
	 * */
	function setWeightScaling(uint96 _weightScaling) public onlyOwner whenNotFrozen {
		require(
			MIN_WEIGHT_SCALING <= _weightScaling && _weightScaling <= MAX_WEIGHT_SCALING,
			"S18" /* scaling doesn't belong to range [1, 9] */
		);
		weightScaling = _weightScaling;
	}

	/**
	 * @notice Allow a staker to migrate his positions to the new staking contract.
	 * @dev Staking contract needs to be set before by the owner.
	 * Currently not implemented, just needed for the interface.
	 *      In case it's needed at some point in the future,
	 *      the implementation needs to be changed first.
	 * */
	function migrateToNewStakingContract() public whenNotFrozen {
		require(newStakingContract != address(0), "S19"); // there is no new staking contract set
		/// @dev implementation:
		/// @dev Iterate over all possible lock dates from now until now + MAX_DURATION.
		/// @dev Read the stake & delegate of the msg.sender
		/// @dev If stake > 0, stake it at the new contract until the lock date with the current delegate.
	}

	/**
	 * @notice Allow the owner to unlock all tokens in case the staking contract
	 * is going to be replaced
	 * Note: Not reversible on purpose. once unlocked, everything is unlocked.
	 * The owner should not be able to just quickly unlock to withdraw his own
	 * tokens and lock again.
	 * @dev Last resort.
	 * */
	function unlockAllTokens() public onlyOwner whenNotFrozen {
		allUnlocked = true;
		emit TokensUnlocked(SOVToken.balanceOf(address(this)));
	}

	/**
	 * @notice Get list of stakes for a user account.
	 * @param account The address to get stakes.
	 * @return The arrays of dates and stakes.
	 * */
	function getStakes(address account) public view returns (uint256[] memory dates, uint96[] memory stakes) {
		uint256 latest = timestampToLockDate(block.timestamp + MAX_DURATION);

		/// @dev Calculate stakes.
		uint256 count = 0;
		/// @dev We need to iterate from first possible stake date after deployment to the latest from current time.
		for (uint256 i = kickoffTS + TWO_WEEKS; i <= latest; i += TWO_WEEKS) {
			if (currentBalance(account, i) > 0) {
				count++;
			}
		}
		dates = new uint256[](count);
		stakes = new uint96[](count);

		/// @dev We need to iterate from first possible stake date after deployment to the latest from current time.
		uint256 j = 0;
		for (uint256 i = kickoffTS + TWO_WEEKS; i <= latest; i += TWO_WEEKS) {
			uint96 balance = currentBalance(account, i);
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
	 * */
	function _getSelectors() internal view returns (bytes4[] memory) {
		bytes4[] memory selectors = new bytes4[](1);
		selectors[0] = this.stakeWithApproval.selector;
		return selectors;
	}
}
