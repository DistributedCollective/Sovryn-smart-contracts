pragma solidity ^0.5.17;

pragma experimental ABIEncoderV2;

/**
 * @title Interface for Staking modules governance/Staking/modules
 */

interface IStaking {
    /*************************** StakingAdminModule ***************************/

    /**
     * @notice Add account to Admins ACL.
     * @param _admin The addresses of the account to grant permissions.
     * */
    function addAdmin(address _admin) external;

    /**
     * @notice Remove account from Admins ACL.
     * @param _admin The addresses of the account to revoke permissions.
     * */
    function removeAdmin(address _admin) external;

    /**
     * @notice Add account to pausers ACL.
     * @param _pauser The address to grant pauser permissions.
     * */
    function addPauser(address _pauser) external;

    /**
     * @notice Remove account from pausers ACL.
     * @param _pauser The address to grant pauser permissions.
     * */
    function removePauser(address _pauser) external;

    /**
     * @notice Pause/unpause contract
     * @param _pause true when pausing, false when unpausing
     * */
    function pauseUnpause(bool _pause) external;

    /**
     * @notice Freeze contract - disable all functions
     * @param _freeze true when freezing, false when unfreezing
     * @dev When freezing, pause is always applied too. When unfreezing, the contract is left in paused stated.
     * */
    function freezeUnfreeze(bool _freeze) external;

    /**
     * @notice Allows the owner to set a fee sharing proxy contract.
     * We need it for unstaking with slashing.
     * @param _feeSharing The address of FeeSharingProxy contract.
     * */
    function setFeeSharing(address _feeSharing) external;

    /**
     * @notice Allow the owner to set weight scaling.
     * We need it for unstaking with slashing.
     * @param _weightScaling The weight scaling.
     * */
    function setWeightScaling(uint96 _weightScaling) external;

    /**
     * @notice Allow the owner to set a new staking contract.
     * As a consequence it allows the stakers to migrate their positions
     * to the new contract.
     * @dev Doesn't have any influence as long as migrateToNewStakingContract
     * is not implemented.
     * @param _newStakingContract The address of the new staking contract.
     * */
    function setNewStakingContract(address _newStakingContract) external;

    /**
     * @notice Allow a staker to migrate his positions to the new staking contract.
     * @dev Staking contract needs to be set before by the owner.
     * Currently not implemented, just needed for the interface.
     *      In case it's needed at some point in the future,
     *      the implementation needs to be changed first.
     * */
    function migrateToNewStakingContract() external; // dummy - not implemented as of now

    /*************************** StakingGovernanceModule ***************************/

    /**
     * @notice Compute the total voting power at a given time.
     * @param blockNumber The block number, needed for checkpointing.
     * @param time The timestamp for which to calculate the total voting power.
     * @return The total voting power at the given time.
     * */
    function getPriorTotalVotingPower(uint32 blockNumber, uint256 time)
        external
        view
        returns (uint96);

    /**
     * @notice Get the current votes balance for a user account.
     * @param account The address to get votes balance.
     * @dev This is a wrapper to simplify arguments. The actual computation is
     * performed on WeightedStaking parent contract.
     * @return The number of current votes for a user account.
     * */
    function getCurrentVotes(address account) external view returns (uint96);

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
    ) external view returns (uint96);

    /**
     * @notice Determine the prior number of stake for an account as of a block number.
     * @dev Block number must be a finalized block or else this function will
     * revert to prevent misinformation.
     * @param account The address of the account to check.
     * @param date The staking date to compute the power for.
     * @param blockNumber The block number to get the vote balance at.
     * @return The number of votes the account had as of the given block.
     * */
    function getPriorStakeByDateForDelegatee(
        address account,
        uint256 date,
        uint256 blockNumber
    ) external view returns (uint96);

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
    function getPriorTotalStakesForDate(uint256 date, uint256 blockNumber)
        external
        view
        returns (uint96);

    /**
     * @notice Delegate votes from `msg.sender` which are locked until lockDate to `delegatee`.
     * @param delegatee The address to delegate votes to.
     * @param lockDate the date if the position to delegate.
     * */
    function delegate(address delegatee, uint256 lockDate) external;

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
    ) external;

    /*************************** StakingStakeModule ***************************/

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
    ) external;

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
    ) external;

    /**
     * @notice Receives approval from SOV token.
     * @param _data The data will be used for low level call.
     */
    function receiveApproval(
        address _sender,
        uint256 _amount,
        address _token,
        bytes calldata _data
    ) external;

    /**
     * @notice Extend the staking duration until the specified date.
     * @param previousLock The old unlocking timestamp.
     * @param until The new unlocking timestamp in seconds.
     * */
    function extendStakingDuration(uint256 previousLock, uint256 until) external;

    /**
     * @dev DO NOT USE this misspelled function. Use stakeBySchedule function instead.
     * This function cannot be deprecated while we have non-upgradeable vesting contracts.
     * */
    function stakesBySchedule(
        uint256 amount,
        uint256 cliff,
        uint256 duration,
        uint256 intervalLength,
        address stakeFor,
        address delegatee
    ) external;

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
    ) external;

    /**
     * @notice Get the number of staked tokens held by the user account.
     * @dev Iterate checkpoints adding up stakes.
     * @param account The address of the account to get the balance of.
     * @return The number of tokens held.
     * */
    function balanceOf(address account) external view returns (uint96 balance);

    /**
     * @notice Get the current number of tokens staked for a day.
     * @param lockedTS The timestamp to get the staked tokens for.
     * */
    function getCurrentStakedUntil(uint256 lockedTS) external view returns (uint96);

    /**
     * @notice Get list of stakes for a user account.
     * @param account The address to get stakes.
     * @return The arrays of dates and stakes.
     * */
    function getStakes(address account)
        external
        view
        returns (uint256[] memory dates, uint96[] memory stakes);

    /**
     * @notice Unstaking is possible every 2 weeks only. This means, to
     * calculate the key value for the staking checkpoints, we need to
     * map the intended timestamp to the closest available date.
     * @param timestamp The unlocking timestamp.
     * @return The actual unlocking date (might be up to 2 weeks shorter than intended).
     * */
    function timestampToLockDate(uint256 timestamp) external view returns (uint256);

    /*************************** StakingStorageModule ***************************/

    /// @notice The maximum duration to stake tokens
    /// @return MAX_DURATION to stake tokens
    function getStorageMaxDurationToStakeTokens() external pure returns (uint256);

    /// @notice The maximum possible voting weight before adding +1 (actually 10, but need 9 for computation).
    /// @return uint256(MAX_VOTING_WEIGHT);
    function getStorageMaxVotingWeight() external pure returns (uint256);

    /// @notice weight is multiplied with this factor (for allowing decimals, like 1.2x).
    /// @dev MAX_VOTING_WEIGHT * WEIGHT_FACTOR needs to be < 792, because there are 100,000,000 SOV with 18 decimals
    /// @return uint256(WEIGHT_FACTOR);
    function getStorageWeightFactor() external pure returns (uint256);

    /// @return uint256(DEFAULT_WEIGHT_SCALING);
    function getStorageDefaultWeightScaling() external pure returns (uint256);

    /// @notice return (uint256(MIN_WEIGHT_SCALING), uint256(MAX_WEIGHT_SCALING))
    function getStorageRangeForWeightScaling()
        external
        pure
        returns (uint256 minWeightScaling, uint256 maxWeightScaling);

    /// @notice The EIP-712 typehash for the contract's domain.
    /// @return uint256(DOMAIN_TYPEHASH);
    function getStorageDomainTypehash() external pure returns (uint256);

    /// @notice The EIP-712 typehash for the delegation struct used by the contract.
    /// @return uint256(DELEGATION_TYPEHASH);
    function getStorageDelegationTypehash() external pure returns (uint256);

    /// @return name;
    function getStorageName() external view returns (string memory);

    /// AUTOGENERATED FUNCTIONS FROM THE STAKING STORAGE PUBLIC VARIABLES ///

    /// @notice The timestamp of contract creation. Base for the staking period calculation.
    function kickoffTS() external view returns (uint256);

    /// @notice The token to be staked
    function SOVToken() external view returns (address);

    /// @notice Stakers delegated voting power
    /// @param staker - the delegating address
    /// @param until - delegated voting
    /// @return _delegate - voting power delegated to address
    function delegates(address staker, uint256 until) external view returns (address _delegate);

    /// @notice If this flag is set to true, all tokens are unlocked immediately
    /// see function unlockAllTokens() for details
    function allUnlocked() external view returns (bool);

    /// @notice Used for stake migrations to a new staking contract with a different storage structure
    function newStakingContract() external view returns (address);

    /// CHECKPOINTS
    struct Checkpoint {
        uint32 fromBlock;
        uint96 stake;
    }

    /// @notice A record of tokens to be unstaked at a given time in total.
    /// For total voting power computation. Voting weights get adjusted bi-weekly.
    /// @dev totalStakingCheckpoints[date][index] is a checkpoint
    function totalStakingCheckpoints(uint256 date, uint32 index)
        external
        view
        returns (Checkpoint memory);

    /// @notice The number of total staking checkpoints for each date.
    /// @dev numTotalStakingCheckpoints[date] is a number.
    function numTotalStakingCheckpoints(uint256 date)
        external
        view
        returns (bytes32 checkpointsQty);

    /// @notice A record of tokens to be unstaked at a given time which were delegated to a certain address.
    /// For delegatee voting power computation. Voting weights get adjusted bi-weekly.
    /// @dev delegateStakingCheckpoints[delegatee][date][index] is a checkpoint.
    function delegateStakingCheckpoints(
        address delagatee,
        uint256 date,
        uint32 index
    ) external view returns (Checkpoint memory);

    /// @notice The number of total staking checkpoints for each date per delegate.
    /// @dev numDelegateStakingCheckpoints[delegatee][date] is a number.
    function numDelegateStakingCheckpoints(address delegatee, uint256 date)
        external
        view
        returns (bytes32 checkpointsQty);

    /// @notice A record of tokens to be unstaked at a given time which per user address (address -> lockDate -> stake checkpoint)
    /// @dev userStakingCheckpoints[user][date][index] is a checkpoint.
    function userStakingCheckpoints(
        address user,
        uint256 date,
        uint32 index
    ) external view returns (Checkpoint memory);

    /// @notice The number of total staking checkpoints for each date per user.
    /// @dev numUserStakingCheckpoints[user][date] is a number
    function numUserStakingCheckpoints(address user, uint256 date)
        external
        view
        returns (uint32 checkpointsQty);

    /// @notice A record of states for signing / validating signatures
    /// @dev nonces[user] is a number.
    function nonces(address user) external view returns (uint256 nonce);

    /// SLASHING ///

    /// @notice the address of FeeSharingProxy contract, we need it for unstaking with slashing.
    function feeSharing() external view returns (address);

    /// @notice used for weight scaling when unstaking with slashing.
    /// @return uint96 DEFAULT_WEIGHT_SCALING
    function weightScaling() external view returns (uint96);

    /// @notice List of vesting contracts, tokens for these contracts won't be slashed if unstaked by governance.
    /// @dev vestingWhitelist[contract] is true/false.
    function vestingWhitelist(address isWhitelisted) external view returns (bool);

    /// @dev user => flag whether user has admin role.
    /// @dev multisig should be an admin, admin can invoke only governanceWithdrawVesting function,
    /// 	this function works only with Team Vesting contracts
    function admins(address isAdmin) external view returns (bool);

    /// @dev vesting contract code hash => flag whether it's registered code hash
    function vestingCodeHashes(bytes32 vestingLogicCodeHash) external view returns (bool);

    /// @notice A record of tokens to be unstaked from vesting contract at a given time (lockDate -> vest checkpoint)
    /// @dev vestingCheckpoints[date][index] is a checkpoint.
    function vestingCheckpoints(uint256 date, uint32 index)
        external
        view
        returns (Checkpoint memory);

    /// @notice The number of total vesting checkpoints for each date.
    /// @dev numVestingCheckpoints[date] is a number.
    function numVestingCheckpoints(uint256 date) external view returns (uint32 checkpointsQty);

    ///@notice vesting registry contract PROXY address
    function vestingRegistryLogic() external view returns (address);

    /// @dev user => flag whether user has pauser role.
    function pausers(address isPauser) external view returns (bool);

    /// @dev Staking contract is paused
    function paused() external view returns (bool);

    /// @dev Staking contract is frozen
    function frozen() external view returns (bool);

    /*************************** StakingVestingModule ***************************/

    /**
     * @notice Return flag whether the given address is a registered vesting contract.
     * @param stakerAddress the address to check
     */
    function isVestingContract(address stakerAddress) external view returns (bool);

    /**
     * @notice Remove vesting contract's code hash to a map of code hashes.
     * @param vesting The address of Vesting contract.
     * @dev We need it to use isVestingContract() function instead of isContract()
     */
    function removeContractCodeHash(address vesting) external;

    /**
     * @notice Add vesting contract's code hash to a map of code hashes.
     * @param vesting The address of Vesting contract.
     * @dev We need it to use isVestingContract() function instead of isContract()
     */
    function addContractCodeHash(address vesting) external;

    /**
     * @notice Determine the prior number of vested stake for an account until a
     * certain lock date as of a block number.
     * @dev Block number must be a finalized block or else this function
     * will revert to prevent misinformation.
     * @param date The lock date.
     * @param blockNumber The block number to get the vote balance at.
     * @return The number of votes the account had as of the given block.
     * */
    function getPriorVestingStakeByDate(uint256 date, uint256 blockNumber)
        external
        view
        returns (uint96);

    /**
     * @notice Compute the voting power for a specific date.
     * Power = stake * weight
     * @param date The staking date to compute the power for. Adjusted to the next valid lock date, if necessary.
     * @param startDate The date for which we need to know the power of the stake.
     * @param blockNumber The block number, needed for checkpointing.
     * @return The stacking power.
     * */
    function weightedVestingStakeByDate(
        uint256 date,
        uint256 startDate,
        uint256 blockNumber
    ) external view returns (uint96 power);

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
    function getPriorVestingWeightedStake(uint256 blockNumber, uint256 date)
        external
        view
        returns (uint96 votes);

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
    ) external view returns (uint96);

    /**
     * @notice Sets the users' vesting stakes for a giving lock dates and writes checkpoints.
     * @param lockedDates The arrays of lock dates.
     * @param values The array of values to add to the staked balance.
     */
    function setVestingStakes(uint256[] calldata lockedDates, uint96[] calldata values) external;

    /**
     * @notice sets vesting registry
     * @param _vestingRegistryProxy the address of vesting registry proxy contract
     * @dev _vestingRegistryProxy can be set to 0 as this function can be reused by
     * various other functionalities without the necessity of linking it with Vesting Registry
     */
    function setVestingRegistry(address _vestingRegistryProxy) external;

    /*************************** StakingWithdrawModule ***************************/

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
    ) external;

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
    ) external;

    /**
     * @notice Get available and punished amount for withdrawing.
     * @param amount The number of tokens to withdraw.
     * @param until The date until which the tokens were staked.
     * */
    function getWithdrawAmounts(uint96 amount, uint256 until)
        external
        view
        returns (uint96, uint96);

    /**
     * @notice Allow the owner to unlock all tokens in case the staking contract
     * is going to be replaced
     * Note: Not reversible on purpose. once unlocked, everything is unlocked.
     * The owner should not be able to just quickly unlock to withdraw his own
     * tokens and lock again.
     * @dev Last resort.
     * */
    function unlockAllTokens() external;

    /*************************** WeightedStakingModule ***************************/

    /**
     * @notice Determine the prior weighted stake for an account as of a block number.
     * Iterate through checkpoints adding up voting power.
     * @dev Block number must be a finalized block or else this function will
     * revert to prevent misinformation.
     *      Used for fee sharing, not voting.
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
    ) external view returns (uint96 priorWeightedStake);

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
    ) external view returns (uint96 power);

    /**
     * @notice Compute the weight for a specific date.
     * @param date The unlocking date.
     * @param startDate We compute the weight for the tokens staked until 'date' on 'startDate'.
     * @return The weighted stake the account had as of the given block.
     * */
    function computeWeightByDate(uint256 date, uint256 startDate)
        external
        pure
        returns (uint96 weight);

    /**
     * @notice Returns public constant MAX_DURATION
     * preserved for backwards compatibility
     * Use getStorageMaxDurationToStakeTokens()
     * @return uint96 MAX_DURATION for staking
     **/
    function MAX_DURATION() external view returns (uint256);

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() external view returns (address);

    /**
     * @dev Returns true if the caller is the current owner.
     */
    function isOwner() external view returns (bool);

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) external;

    /**
     * @notice Governance withdraw vesting directly through staking contract.
     * This direct withdraw vesting solves the out of gas issue when there are too many iterations when withdrawing.
     * This function only allows cancelling vesting contract of the TeamVesting type.
     *
     * @param vesting The vesting address.
     * @param receiver The receiving address.
     * @param startFrom The start value for the iterations.
     */
    function cancelTeamVesting(
        address vesting,
        address receiver,
        uint256 startFrom
    ) external;

    /**
     * @notice Max iteration for direct withdrawal from staking to prevent out of gas issue.
     *
     * @return max iteration value.
     */
    function getMaxVestingWithdrawIterations() external view returns (uint256);

    /**
     * @dev set max withdraw iterations.
     *
     * @param maxIterations new max iterations value.
     */
    function setMaxVestingWithdrawIterations(uint256 maxIterations) external;
}
