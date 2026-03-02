# IStaking
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Staking/interfaces/IStaking.sol)


## Functions
### addAdmin

StakingAdminModule **************************

Add account to Admins ACL.


```solidity
function addAdmin(address _admin) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_admin`|`address`|The addresses of the account to grant permissions.|


### removeAdmin

Remove account from Admins ACL.


```solidity
function removeAdmin(address _admin) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_admin`|`address`|The addresses of the account to revoke permissions.|


### addPauser

Add account to pausers ACL.


```solidity
function addPauser(address _pauser) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_pauser`|`address`|The address to grant pauser permissions.|


### removePauser

Remove account from pausers ACL.


```solidity
function removePauser(address _pauser) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_pauser`|`address`|The address to grant pauser permissions.|


### pauseUnpause

Pause/unpause contract


```solidity
function pauseUnpause(bool _pause) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_pause`|`bool`|true when pausing, false when unpausing|


### freezeUnfreeze

Freeze contract - disable all functions

*When freezing, pause is always applied too. When unfreezing, the contract is left in paused stated.*


```solidity
function freezeUnfreeze(bool _freeze) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_freeze`|`bool`|true when freezing, false when unfreezing|


### setFeeSharing

Allows the owner to set a fee sharing proxy contract.
We need it for unstaking with slashing.


```solidity
function setFeeSharing(address _feeSharing) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_feeSharing`|`address`|The address of FeeSharingCollectorProxy contract.|


### setWeightScaling

Allow the owner to set weight scaling.
We need it for unstaking with slashing.


```solidity
function setWeightScaling(uint96 _weightScaling) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_weightScaling`|`uint96`|The weight scaling.|


### setNewStakingContract

Allow the owner to set a new staking contract.
As a consequence it allows the stakers to migrate their positions
to the new contract.

*Doesn't have any influence as long as migrateToNewStakingContract
is not implemented.*


```solidity
function setNewStakingContract(address _newStakingContract) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newStakingContract`|`address`|The address of the new staking contract.|


### migrateToNewStakingContract

Allow a staker to migrate his positions to the new staking contract.

*Staking contract needs to be set before by the owner.
Currently not implemented, just needed for the interface.
In case it's needed at some point in the future,
the implementation needs to be changed first.*


```solidity
function migrateToNewStakingContract() external;
```

### getPriorTotalVotingPower

StakingGovernanceModule **************************

Compute the total voting power at a given time.


```solidity
function getPriorTotalVotingPower(uint32 blockNumber, uint256 time) external view returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`blockNumber`|`uint32`|The block number, needed for checkpointing.|
|`time`|`uint256`|The timestamp for which to calculate the total voting power.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The total voting power at the given time.|


### getCurrentVotes

Get the current votes balance for a user account.

*This is a wrapper to simplify arguments. The actual computation is
performed on WeightedStaking parent contract.*


```solidity
function getCurrentVotes(address account) external view returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|The address to get votes balance.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The number of current votes for a user account.|


### getPriorVotes

Determine the prior number of votes for a delegatee as of a block number.
Iterate through checkpoints adding up voting power.

*Block number must be a finalized block or else this function will revert
to prevent misinformation.
Used for Voting, not for fee sharing.*


```solidity
function getPriorVotes(address account, uint256 blockNumber, uint256 date) external view returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|The address of the account to check.|
|`blockNumber`|`uint256`|The block number to get the vote balance at.|
|`date`|`uint256`|The staking date to compute the power for.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The number of votes the delegatee had as of the given block.|


### getPriorStakeByDateForDelegatee

Determine the prior number of stake for an account as of a block number.

*Block number must be a finalized block or else this function will
revert to prevent misinformation.*


```solidity
function getPriorStakeByDateForDelegatee(address account, uint256 date, uint256 blockNumber)
    external
    view
    returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|The address of the account to check.|
|`date`|`uint256`|The staking date to compute the power for.|
|`blockNumber`|`uint256`|The block number to get the vote balance at.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The number of votes the account had as of the given block.|


### getPriorTotalStakesForDate

Determine the prior number of stake for an unlocking date as of a block number.

*Block number must be a finalized block or else this function will
revert to prevent misinformation.
TODO: WeightedStaking::getPriorTotalStakesForDate should probably better
be internal instead of a public function.*


```solidity
function getPriorTotalStakesForDate(uint256 date, uint256 blockNumber) external view returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`date`|`uint256`|The date to check the stakes for.|
|`blockNumber`|`uint256`|The block number to get the vote balance at.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The number of votes the account had as of the given block.|


### delegate

Delegate votes from `msg.sender` which are locked until lockDate to `delegatee`.


```solidity
function delegate(address delegatee, uint256 lockDate) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`delegatee`|`address`|The address to delegate votes to.|
|`lockDate`|`uint256`|the date if the position to delegate.|


### stake

Stake the given amount for the given duration of time.


```solidity
function stake(uint96 amount, uint256 until, address stakeFor, address delegatee) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint96`|The number of tokens to stake.|
|`until`|`uint256`|Timestamp indicating the date until which to stake.|
|`stakeFor`|`address`|The address to stake the tokens for or 0x0 if staking for oneself.|
|`delegatee`|`address`|The address of the delegatee or 0x0 if there is none.|


### stakeWithApproval

Stake the given amount for the given duration of time.

*This function will be invoked from receiveApproval*

*SOV.approveAndCall -> this.receiveApproval -> this.stakeWithApproval*


```solidity
function stakeWithApproval(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee)
    external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sender`|`address`|The sender of SOV.approveAndCall|
|`amount`|`uint96`|The number of tokens to stake.|
|`until`|`uint256`|Timestamp indicating the date until which to stake.|
|`stakeFor`|`address`|The address to stake the tokens for or 0x0 if staking for oneself.|
|`delegatee`|`address`|The address of the delegatee or 0x0 if there is none.|


### receiveApproval

Receives approval from SOV token.


```solidity
function receiveApproval(address _sender, uint256 _amount, address _token, bytes calldata _data) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_sender`|`address`||
|`_amount`|`uint256`||
|`_token`|`address`||
|`_data`|`bytes`|The data will be used for low level call.|


### extendStakingDuration

Extend the staking duration until the specified date.


```solidity
function extendStakingDuration(uint256 previousLock, uint256 until) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`previousLock`|`uint256`|The old unlocking timestamp.|
|`until`|`uint256`|The new unlocking timestamp in seconds.|


### stakesBySchedule

*DO NOT USE this misspelled function. Use stakeBySchedule function instead.
This function cannot be deprecated while we have non-upgradeable vesting contracts.*


```solidity
function stakesBySchedule(
    uint256 amount,
    uint256 cliff,
    uint256 duration,
    uint256 intervalLength,
    address stakeFor,
    address delegatee
) external;
```

### stakeBySchedule

Stake tokens according to the vesting schedule.


```solidity
function stakeBySchedule(
    uint256 amount,
    uint256 cliff,
    uint256 duration,
    uint256 intervalLength,
    address stakeFor,
    address delegatee
) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|The amount of tokens to stake.|
|`cliff`|`uint256`|The time interval to the first withdraw.|
|`duration`|`uint256`|The staking duration.|
|`intervalLength`|`uint256`|The length of each staking interval when cliff passed.|
|`stakeFor`|`address`|The address to stake the tokens for or 0x0 if staking for oneself.|
|`delegatee`|`address`|The address of the delegatee or 0x0 if there is none.|


### balanceOf

Get the number of staked tokens held by the user account.

*Iterate checkpoints adding up stakes.*


```solidity
function balanceOf(address account) external view returns (uint96 balance);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|The address of the account to get the balance of.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`balance`|`uint96`|The number of tokens held.|


### getCurrentStakedUntil

Get the current number of tokens staked for a day.


```solidity
function getCurrentStakedUntil(uint256 lockedTS) external view returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lockedTS`|`uint256`|The timestamp to get the staked tokens for.|


### getStakes

Get list of stakes for a user account.


```solidity
function getStakes(address account) external view returns (uint256[] memory dates, uint96[] memory stakes);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|The address to get stakes.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`dates`|`uint256[]`|The arrays of dates and stakes.|
|`stakes`|`uint96[]`||


### timestampToLockDate

Unstaking is possible every 2 weeks only. This means, to
calculate the key value for the staking checkpoints, we need to
map the intended timestamp to the closest available date.


```solidity
function timestampToLockDate(uint256 timestamp) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`timestamp`|`uint256`|The unlocking timestamp.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The actual unlocking date (might be up to 2 weeks shorter than intended).|


### getStorageMaxDurationToStakeTokens

StakingStorageModule **************************

The maximum duration to stake tokens


```solidity
function getStorageMaxDurationToStakeTokens() external pure returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|MAX_DURATION to stake tokens|


### getStorageMaxVotingWeight

The maximum possible voting weight before adding +1 (actually 10, but need 9 for computation).


```solidity
function getStorageMaxVotingWeight() external pure returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|uint256(MAX_VOTING_WEIGHT);|


### getStorageWeightFactor

weight is multiplied with this factor (for allowing decimals, like 1.2x).

*MAX_VOTING_WEIGHT * WEIGHT_FACTOR needs to be < 792, because there are 100,000,000 SOV with 18 decimals*


```solidity
function getStorageWeightFactor() external pure returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|uint256(WEIGHT_FACTOR);|


### getStorageDefaultWeightScaling


```solidity
function getStorageDefaultWeightScaling() external pure returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|uint256(DEFAULT_WEIGHT_SCALING);|


### getStorageRangeForWeightScaling

return (uint256(MIN_WEIGHT_SCALING), uint256(MAX_WEIGHT_SCALING))


```solidity
function getStorageRangeForWeightScaling() external pure returns (uint256 minWeightScaling, uint256 maxWeightScaling);
```

### getStorageDomainTypehash

The EIP-712 typehash for the contract's domain.


```solidity
function getStorageDomainTypehash() external pure returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|uint256(DOMAIN_TYPEHASH);|


### getStorageDelegationTypehash

The EIP-712 typehash for the delegation struct used by the contract.


```solidity
function getStorageDelegationTypehash() external pure returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|uint256(DELEGATION_TYPEHASH);|


### getStorageName


```solidity
function getStorageName() external view returns (string memory);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`string`|name;|


### kickoffTS

AUTOGENERATED FUNCTIONS FROM THE STAKING STORAGE PUBLIC VARIABLES ///

The timestamp of contract creation. Base for the staking period calculation.


```solidity
function kickoffTS() external view returns (uint256);
```

### SOVToken

The token to be staked


```solidity
function SOVToken() external view returns (address);
```

### delegates

Stakers delegated voting power


```solidity
function delegates(address staker, uint256 until) external view returns (address _delegate);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`staker`|`address`|- the delegating address|
|`until`|`uint256`|- delegated voting|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_delegate`|`address`|- voting power delegated to address|


### allUnlocked

If this flag is set to true, all tokens are unlocked immediately
see function unlockAllTokens() for details


```solidity
function allUnlocked() external view returns (bool);
```

### newStakingContract

Used for stake migrations to a new staking contract with a different storage structure


```solidity
function newStakingContract() external view returns (address);
```

### totalStakingCheckpoints

A record of tokens to be unstaked at a given time in total.
For total voting power computation. Voting weights get adjusted bi-weekly.

*totalStakingCheckpoints[date][index] is a checkpoint*


```solidity
function totalStakingCheckpoints(uint256 date, uint32 index) external view returns (Checkpoint memory);
```

### numTotalStakingCheckpoints

The number of total staking checkpoints for each date.

*numTotalStakingCheckpoints[date] is a number.*


```solidity
function numTotalStakingCheckpoints(uint256 date) external view returns (uint32 checkpointsQty);
```

### delegateStakingCheckpoints

A record of tokens to be unstaked at a given time which were delegated to a certain address.
For delegatee voting power computation. Voting weights get adjusted bi-weekly.

*delegateStakingCheckpoints[delegatee][date][index] is a checkpoint.*


```solidity
function delegateStakingCheckpoints(address delagatee, uint256 date, uint32 index)
    external
    view
    returns (Checkpoint memory);
```

### numDelegateStakingCheckpoints

The number of total staking checkpoints for each date per delegate.

*numDelegateStakingCheckpoints[delegatee][date] is a number.*


```solidity
function numDelegateStakingCheckpoints(address delegatee, uint256 date) external view returns (uint32 checkpointsQty);
```

### userStakingCheckpoints

A record of tokens to be unstaked at a given time which per user address (address -> lockDate -> stake checkpoint)

*userStakingCheckpoints[user][date][index] is a checkpoint.*


```solidity
function userStakingCheckpoints(address user, uint256 date, uint32 index) external view returns (Checkpoint memory);
```

### numUserStakingCheckpoints

The number of total staking checkpoints for each date per user.

*numUserStakingCheckpoints[user][date] is a number*


```solidity
function numUserStakingCheckpoints(address user, uint256 date) external view returns (uint32 checkpointsQty);
```

### nonces

A record of states for signing / validating signatures

*nonces[user] is a number.*


```solidity
function nonces(address user) external view returns (uint256 nonce);
```

### feeSharing

SLASHING ///

the address of FeeSharingCollectorProxy contract, we need it for unstaking with slashing.


```solidity
function feeSharing() external view returns (address);
```

### weightScaling

used for weight scaling when unstaking with slashing.


```solidity
function weightScaling() external view returns (uint96);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|uint96 DEFAULT_WEIGHT_SCALING|


### vestingWhitelist

List of vesting contracts, tokens for these contracts won't be slashed if unstaked by governance.

*vestingWhitelist[contract] is true/false.*


```solidity
function vestingWhitelist(address isWhitelisted) external view returns (bool);
```

### admins

*user => flag whether user has admin role.*

*multisig should be an admin, admin can invoke only governanceWithdrawVesting function,
this function works only with Team Vesting contracts*


```solidity
function admins(address isAdmin) external view returns (bool);
```

### vestingCodeHashes

*vesting contract code hash => flag whether it's registered code hash*


```solidity
function vestingCodeHashes(bytes32 vestingLogicCodeHash) external view returns (bool);
```

### vestingCheckpoints

A record of tokens to be unstaked from vesting contract at a given time (lockDate -> vest checkpoint)

*vestingCheckpoints[date][index] is a checkpoint.*


```solidity
function vestingCheckpoints(uint256 date, uint32 index) external view returns (Checkpoint memory);
```

### numVestingCheckpoints

The number of total vesting checkpoints for each date.

*numVestingCheckpoints[date] is a number.*


```solidity
function numVestingCheckpoints(uint256 date) external view returns (uint32 checkpointsQty);
```

### vestingRegistryLogic

vesting registry contract PROXY address


```solidity
function vestingRegistryLogic() external view returns (address);
```

### pausers

*user => flag whether user has pauser role.*


```solidity
function pausers(address isPauser) external view returns (bool);
```

### paused

*Staking contract is paused*


```solidity
function paused() external view returns (bool);
```

### frozen

*Staking contract is frozen*


```solidity
function frozen() external view returns (bool);
```

### isVestingContract

Return flag whether the given address is a registered vesting contract.


```solidity
function isVestingContract(address stakerAddress) external view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`stakerAddress`|`address`|the address to check|


### removeContractCodeHash

Remove vesting contract's code hash to a map of code hashes.

*We need it to use isVestingContract() function instead of isContract()*


```solidity
function removeContractCodeHash(address vesting) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vesting`|`address`|The address of Vesting contract.|


### addContractCodeHash

Add vesting contract's code hash to a map of code hashes.

*We need it to use isVestingContract() function instead of isContract()*


```solidity
function addContractCodeHash(address vesting) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vesting`|`address`|The address of Vesting contract.|


### getPriorVestingStakeByDate

Determine the prior number of vested stake for an account until a
certain lock date as of a block number.

*Block number must be a finalized block or else this function
will revert to prevent misinformation.*


```solidity
function getPriorVestingStakeByDate(uint256 date, uint256 blockNumber) external view returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`date`|`uint256`|The lock date.|
|`blockNumber`|`uint256`|The block number to get the vote balance at.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The number of votes the account had as of the given block.|


### weightedVestingStakeByDate

Compute the voting power for a specific date.
Power = stake * weight


```solidity
function weightedVestingStakeByDate(uint256 date, uint256 startDate, uint256 blockNumber)
    external
    view
    returns (uint96 power);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`date`|`uint256`|The staking date to compute the power for. Adjusted to the next valid lock date, if necessary.|
|`startDate`|`uint256`|The date for which we need to know the power of the stake.|
|`blockNumber`|`uint256`|The block number, needed for checkpointing.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`power`|`uint96`|The stacking power.|


### getPriorVestingWeightedStake

Determine the prior weighted vested amount for an account as of a block number.
Iterate through checkpoints adding up voting power.

*Block number must be a finalized block or else this function will
revert to prevent misinformation.
Used for fee sharing, not voting.
TODO: WeightedStaking::getPriorVestingWeightedStake is using the variable name "votes"
to add up token stake, and that could be misleading.*


```solidity
function getPriorVestingWeightedStake(uint256 blockNumber, uint256 date) external view returns (uint96 votes);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`blockNumber`|`uint256`|The block number to get the vote balance at.|
|`date`|`uint256`|The staking date to compute the power for.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`votes`|`uint96`|The weighted stake the account had as of the given block.|


### getPriorUserStakeByDate

Determine the prior number of stake for an account until a
certain lock date as of a block number.

*Block number must be a finalized block or else this function
will revert to prevent misinformation.*


```solidity
function getPriorUserStakeByDate(address account, uint256 date, uint256 blockNumber) external view returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|The address of the account to check.|
|`date`|`uint256`|The lock date.|
|`blockNumber`|`uint256`|The block number to get the vote balance at.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The number of votes the account had as of the given block.|


### setVestingStakes

Sets the users' vesting stakes for a giving lock dates and writes checkpoints.


```solidity
function setVestingStakes(uint256[] calldata lockedDates, uint96[] calldata values) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lockedDates`|`uint256[]`|The arrays of lock dates.|
|`values`|`uint96[]`|The array of values to add to the staked balance.|


### setVestingRegistry

sets vesting registry

*_vestingRegistryProxy can be set to 0 as this function can be reused by
various other functionalities without the necessity of linking it with Vesting Registry*


```solidity
function setVestingRegistry(address _vestingRegistryProxy) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vestingRegistryProxy`|`address`|the address of vesting registry proxy contract|


### withdraw

StakingWithdrawModule **************************

Withdraw the given amount of tokens if they are unlocked.


```solidity
function withdraw(uint96 amount, uint256 until, address receiver) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint96`|The number of tokens to withdraw.|
|`until`|`uint256`|The date until which the tokens were staked.|
|`receiver`|`address`|The receiver of the tokens. If not specified, send to the msg.sender|


### governanceWithdraw

Withdraw the given amount of tokens.

*Can be invoked only by whitelisted contract passed to governanceWithdrawVesting*

***WARNING** This function should not be no longer used by Sovryn Protocol.
Sovryn protocol will use the cancelTeamVesting function for the withdrawal moving forward.*


```solidity
function governanceWithdraw(uint96 amount, uint256 until, address receiver) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint96`|The number of tokens to withdraw.|
|`until`|`uint256`|The date until which the tokens were staked.|
|`receiver`|`address`|The receiver of the tokens. If not specified, send to the msg.sender|


### governanceWithdrawVesting

Withdraw tokens for vesting contract.

*Can be invoked only by whitelisted contract passed to governanceWithdrawVesting.*


```solidity
function governanceWithdrawVesting(address vesting, address receiver) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vesting`|`address`|The address of Vesting contract.|
|`receiver`|`address`|The receiver of the tokens. If not specified, send to the msg.sender|


### getWithdrawAmounts

Get available and punished amount for withdrawing.


```solidity
function getWithdrawAmounts(uint96 amount, uint256 until) external view returns (uint96, uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint96`|The number of tokens to withdraw.|
|`until`|`uint256`|The date until which the tokens were staked.|


### unlockAllTokens

Allow the owner to unlock all tokens in case the staking contract
is going to be replaced
Note: Not reversible on purpose. once unlocked, everything is unlocked.
The owner should not be able to just quickly unlock to withdraw his own
tokens and lock again.

*Last resort.*


```solidity
function unlockAllTokens() external;
```

### getPriorWeightedStake

WeightedStakingModule **************************

Determine the prior weighted stake for an account as of a block number.
Iterate through checkpoints adding up voting power.

*Block number must be a finalized block or else this function will
revert to prevent misinformation.
Used for fee sharing, not voting.*


```solidity
function getPriorWeightedStake(address account, uint256 blockNumber, uint256 date)
    external
    view
    returns (uint96 priorWeightedStake);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|The address of the account to check.|
|`blockNumber`|`uint256`|The block number to get the vote balance at.|
|`date`|`uint256`|The date/timestamp of the unstaking time.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`priorWeightedStake`|`uint96`|The weighted stake the account had as of the given block.|


### weightedStakeByDate

Compute the voting power for a specific date.
Power = stake * weight
TODO: WeightedStaking::weightedStakeByDate should probably better
be internal instead of a public function.


```solidity
function weightedStakeByDate(address account, uint256 date, uint256 startDate, uint256 blockNumber)
    external
    view
    returns (uint96 power);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|The user address.|
|`date`|`uint256`|The staking date to compute the power for.|
|`startDate`|`uint256`|The date for which we need to know the power of the stake.|
|`blockNumber`|`uint256`|The block number, needed for checkpointing.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`power`|`uint96`|The stacking power.|


### computeWeightByDate

Compute the weight for a specific date.


```solidity
function computeWeightByDate(uint256 date, uint256 startDate) external pure returns (uint96 weight);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`date`|`uint256`|The unlocking date.|
|`startDate`|`uint256`|We compute the weight for the tokens staked until 'date' on 'startDate'.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`weight`|`uint96`|The weighted stake the account had as of the given block.|


### MAX_DURATION

Returns public constant MAX_DURATION
preserved for backwards compatibility
Use getStorageMaxDurationToStakeTokens()


```solidity
function MAX_DURATION() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|uint96 MAX_DURATION for staking|


### owner

*Returns the address of the current owner.*


```solidity
function owner() external view returns (address);
```

### isOwner

*Returns true if the caller is the current owner.*


```solidity
function isOwner() external view returns (bool);
```

### transferOwnership

*Transfers ownership of the contract to a new account (`newOwner`).
Can only be called by the current owner.*


```solidity
function transferOwnership(address newOwner) external;
```

### cancelTeamVesting

Governance withdraw vesting directly through staking contract.
This direct withdraw vesting solves the out of gas issue when there are too many iterations when withdrawing.
This function only allows cancelling vesting contract of the TeamVesting type.


```solidity
function cancelTeamVesting(address vesting, address receiver, uint256 startFrom) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vesting`|`address`|The vesting address.|
|`receiver`|`address`|The receiving address.|
|`startFrom`|`uint256`|The start value for the iterations.|


### getMaxVestingWithdrawIterations

Max iteration for direct withdrawal from staking to prevent out of gas issue.


```solidity
function getMaxVestingWithdrawIterations() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|max iteration value.|


### setMaxVestingWithdrawIterations

*set max withdraw iterations.*


```solidity
function setMaxVestingWithdrawIterations(uint256 maxIterations) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`maxIterations`|`uint256`|new max iterations value.|


## Events
### TokensStaked
StakingStakeModule **************************


```solidity
event TokensStaked(address indexed staker, uint256 amount, uint256 lockedUntil, uint256 totalStaked);
```

### VestingStakeSet
StakingVestingModule **************************


```solidity
event VestingStakeSet(uint256 lockedTS, uint96 value);
```

## Structs
### Checkpoint
CHECKPOINTS


```solidity
struct Checkpoint {
    uint32 fromBlock;
    uint96 stake;
}
```

