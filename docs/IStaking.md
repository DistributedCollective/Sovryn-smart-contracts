# Interface for Staking modules governance/Staking/modules (IStaking.sol)

View Source: [contracts/governance/Staking/interfaces/IStaking.sol](../contracts/governance/Staking/interfaces/IStaking.sol)

**IStaking**

## Structs
### Checkpoint

```js
struct Checkpoint {
 uint32 fromBlock,
 uint96 stake
}
```

**Events**

```js
event VestingStakeSet(uint256  lockedTS, uint96  value);
```

## Functions

- [addAdmin(address _admin)](#addadmin)
- [removeAdmin(address _admin)](#removeadmin)
- [addPauser(address _pauser)](#addpauser)
- [removePauser(address _pauser)](#removepauser)
- [pauseUnpause(bool _pause)](#pauseunpause)
- [freezeUnfreeze(bool _freeze)](#freezeunfreeze)
- [setFeeSharing(address _feeSharing)](#setfeesharing)
- [setWeightScaling(uint96 _weightScaling)](#setweightscaling)
- [setNewStakingContract(address _newStakingContract)](#setnewstakingcontract)
- [migrateToNewStakingContract()](#migratetonewstakingcontract)
- [getPriorTotalVotingPower(uint32 blockNumber, uint256 time)](#getpriortotalvotingpower)
- [getCurrentVotes(address account)](#getcurrentvotes)
- [getPriorVotes(address account, uint256 blockNumber, uint256 date)](#getpriorvotes)
- [getPriorStakeByDateForDelegatee(address account, uint256 date, uint256 blockNumber)](#getpriorstakebydatefordelegatee)
- [getPriorTotalStakesForDate(uint256 date, uint256 blockNumber)](#getpriortotalstakesfordate)
- [delegate(address delegatee, uint256 lockDate)](#delegate)
- [delegateBySig(address delegatee, uint256 lockDate, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s)](#delegatebysig)
- [stake(uint96 amount, uint256 until, address stakeFor, address delegatee)](#stake)
- [stakeWithApproval(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee)](#stakewithapproval)
- [receiveApproval(address _sender, uint256 _amount, address _token, bytes _data)](#receiveapproval)
- [extendStakingDuration(uint256 previousLock, uint256 until)](#extendstakingduration)
- [stakesBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee)](#stakesbyschedule)
- [stakeBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee)](#stakebyschedule)
- [balanceOf(address account)](#balanceof)
- [getCurrentStakedUntil(uint256 lockedTS)](#getcurrentstakeduntil)
- [getStakes(address account)](#getstakes)
- [timestampToLockDate(uint256 timestamp)](#timestamptolockdate)
- [getStorageMaxDurationToStakeTokens()](#getstoragemaxdurationtostaketokens)
- [getStorageMaxVotingWeight()](#getstoragemaxvotingweight)
- [getStorageWeightFactor()](#getstorageweightfactor)
- [getStorageDefaultWeightScaling()](#getstoragedefaultweightscaling)
- [getStorageRangeForWeightScaling()](#getstoragerangeforweightscaling)
- [getStorageDomainTypehash()](#getstoragedomaintypehash)
- [getStorageDelegationTypehash()](#getstoragedelegationtypehash)
- [getStorageName()](#getstoragename)
- [kickoffTS()](#kickoffts)
- [SOVToken()](#sovtoken)
- [delegates(address staker, uint256 until)](#delegates)
- [allUnlocked()](#allunlocked)
- [newStakingContract()](#newstakingcontract)
- [totalStakingCheckpoints(uint256 date, uint32 index)](#totalstakingcheckpoints)
- [numTotalStakingCheckpoints(uint256 date)](#numtotalstakingcheckpoints)
- [delegateStakingCheckpoints(address delagatee, uint256 date, uint32 index)](#delegatestakingcheckpoints)
- [numDelegateStakingCheckpoints(address delegatee, uint256 date)](#numdelegatestakingcheckpoints)
- [userStakingCheckpoints(address user, uint256 date, uint32 index)](#userstakingcheckpoints)
- [numUserStakingCheckpoints(address user, uint256 date)](#numuserstakingcheckpoints)
- [nonces(address user)](#nonces)
- [feeSharing()](#feesharing)
- [weightScaling()](#weightscaling)
- [vestingWhitelist(address isWhitelisted)](#vestingwhitelist)
- [admins(address isAdmin)](#admins)
- [vestingCodeHashes(bytes32 vestingLogicCodeHash)](#vestingcodehashes)
- [vestingCheckpoints(uint256 date, uint32 index)](#vestingcheckpoints)
- [numVestingCheckpoints(uint256 date)](#numvestingcheckpoints)
- [vestingRegistryLogic()](#vestingregistrylogic)
- [pausers(address isPauser)](#pausers)
- [paused()](#paused)
- [frozen()](#frozen)
- [isVestingContract(address stakerAddress)](#isvestingcontract)
- [removeContractCodeHash(address vesting)](#removecontractcodehash)
- [addContractCodeHash(address vesting)](#addcontractcodehash)
- [getPriorVestingStakeByDate(uint256 date, uint256 blockNumber)](#getpriorvestingstakebydate)
- [weightedVestingStakeByDate(uint256 date, uint256 startDate, uint256 blockNumber)](#weightedvestingstakebydate)
- [getPriorVestingWeightedStake(uint256 blockNumber, uint256 date)](#getpriorvestingweightedstake)
- [getPriorUserStakeByDate(address account, uint256 date, uint256 blockNumber)](#getprioruserstakebydate)
- [setVestingStakes(uint256[] lockedDates, uint96[] values)](#setvestingstakes)
- [setVestingRegistry(address _vestingRegistryProxy)](#setvestingregistry)
- [withdraw(uint96 amount, uint256 until, address receiver)](#withdraw)
- [governanceWithdraw(uint96 amount, uint256 until, address receiver)](#governancewithdraw)
- [governanceWithdrawVesting(address vesting, address receiver)](#governancewithdrawvesting)
- [getWithdrawAmounts(uint96 amount, uint256 until)](#getwithdrawamounts)
- [unlockAllTokens()](#unlockalltokens)
- [getPriorWeightedStake(address account, uint256 blockNumber, uint256 date)](#getpriorweightedstake)
- [weightedStakeByDate(address account, uint256 date, uint256 startDate, uint256 blockNumber)](#weightedstakebydate)
- [computeWeightByDate(uint256 date, uint256 startDate)](#computeweightbydate)
- [MAX_DURATION()](#max_duration)
- [owner()](#owner)
- [isOwner()](#isowner)
- [transferOwnership(address newOwner)](#transferownership)
- [cancelTeamVesting(address vesting, address receiver, uint256 startFrom)](#cancelteamvesting)
- [getMaxVestingWithdrawIterations()](#getmaxvestingwithdrawiterations)
- [setMaxVestingWithdrawIterations(uint256 maxIterations)](#setmaxvestingwithdrawiterations)

---    

> ### addAdmin

Add account to Admins ACL.

```solidity
function addAdmin(address _admin) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _admin | address | The addresses of the account to grant permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addAdmin(address _admin) external;
```
</details>

---    

> ### removeAdmin

Remove account from Admins ACL.

```solidity
function removeAdmin(address _admin) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _admin | address | The addresses of the account to revoke permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeAdmin(address _admin) external;
```
</details>

---    

> ### addPauser

Add account to pausers ACL.

```solidity
function addPauser(address _pauser) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _pauser | address | The address to grant pauser permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addPauser(address _pauser) external;
```
</details>

---    

> ### removePauser

Remove account from pausers ACL.

```solidity
function removePauser(address _pauser) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _pauser | address | The address to grant pauser permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removePauser(address _pauser) external;
```
</details>

---    

> ### pauseUnpause

Pause/unpause contract

```solidity
function pauseUnpause(bool _pause) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _pause | bool | true when pausing, false when unpausing | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function pauseUnpause(bool _pause) external;
```
</details>

---    

> ### freezeUnfreeze

Freeze contract - disable all functions

```solidity
function freezeUnfreeze(bool _freeze) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _freeze | bool | true when freezing, false when unfreezing | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function freezeUnfreeze(bool _freeze) external;
```
</details>

---    

> ### setFeeSharing

Allows the owner to set a fee sharing proxy contract.
We need it for unstaking with slashing.

```solidity
function setFeeSharing(address _feeSharing) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _feeSharing | address | The address of FeeSharingCollectorProxy contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setFeeSharing(address _feeSharing) external;
```
</details>

---    

> ### setWeightScaling

Allow the owner to set weight scaling.
We need it for unstaking with slashing.

```solidity
function setWeightScaling(uint96 _weightScaling) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _weightScaling | uint96 | The weight scaling. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setWeightScaling(uint96 _weightScaling) external;
```
</details>

---    

> ### setNewStakingContract

Allow the owner to set a new staking contract.
As a consequence it allows the stakers to migrate their positions
to the new contract.

```solidity
function setNewStakingContract(address _newStakingContract) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newStakingContract | address | The address of the new staking contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setNewStakingContract(address _newStakingContract) external;
```
</details>

---    

> ### migrateToNewStakingContract

Allow a staker to migrate his positions to the new staking contract.

```solidity
function migrateToNewStakingContract() external nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function migrateToNewStakingContract() external;
```
</details>

---    

> ### getPriorTotalVotingPower

Compute the total voting power at a given time.

```solidity
function getPriorTotalVotingPower(uint32 blockNumber, uint256 time) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| blockNumber | uint32 | The block number, needed for checkpointing. | 
| time | uint256 | The timestamp for which to calculate the total voting power. | 

**Returns**

The total voting power at the given time.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPriorTotalVotingPower(uint32 blockNumber, uint256 time)
        external
        view
        returns (uint96);
```
</details>

---    

> ### getCurrentVotes

Get the current votes balance for a user account.

```solidity
function getCurrentVotes(address account) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address to get votes balance. | 

**Returns**

The number of current votes for a user account.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getCurrentVotes(address account) external view returns (uint96);
```
</details>

---    

> ### getPriorVotes

Determine the prior number of votes for a delegatee as of a block number.
Iterate through checkpoints adding up voting power.

```solidity
function getPriorVotes(address account, uint256 blockNumber, uint256 date) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 
| date | uint256 | The staking date to compute the power for. | 

**Returns**

The number of votes the delegatee had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPriorVotes(
        address account,
        uint256 blockNumber,
        uint256 date
    ) external view returns (uint96);
```
</details>

---    

> ### getPriorStakeByDateForDelegatee

Determine the prior number of stake for an account as of a block number.

```solidity
function getPriorStakeByDateForDelegatee(address account, uint256 date, uint256 blockNumber) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| date | uint256 | The staking date to compute the power for. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

**Returns**

The number of votes the account had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPriorStakeByDateForDelegatee(
        address account,
        uint256 date,
        uint256 blockNumber
    ) external view returns (uint96);
```
</details>

---    

> ### getPriorTotalStakesForDate

Determine the prior number of stake for an unlocking date as of a block number.

```solidity
function getPriorTotalStakesForDate(uint256 date, uint256 blockNumber) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The date to check the stakes for. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

**Returns**

The number of votes the account had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPriorTotalStakesForDate(uint256 date, uint256 blockNumber)
        external
        view
        returns (uint96);
```
</details>

---    

> ### delegate

Delegate votes from `msg.sender` which are locked until lockDate to `delegatee`.

```solidity
function delegate(address delegatee, uint256 lockDate) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delegatee | address | The address to delegate votes to. | 
| lockDate | uint256 | the date if the position to delegate. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function delegate(address delegatee, uint256 lockDate) external;
```
</details>

---    

> ### delegateBySig

Delegates votes from signatory to a delegatee account.
Voting with EIP-712 Signatures.
     * Voting power can be delegated to any address, and then can be used to
vote on proposals. A key benefit to users of by-signature functionality
is that they can create a signed vote transaction for free, and have a
trusted third-party spend rBTC(or ETH) on gas fees and write it to the
blockchain for them.
     * The third party in this scenario, submitting the SOV-holder’s signed
transaction holds a voting power that is for only a single proposal.
The signatory still holds the power to vote on their own behalf in
the proposal if the third party has not yet published the signed
transaction that was given to them.
     *

```solidity
function delegateBySig(address delegatee, uint256 lockDate, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delegatee | address | The address to delegate votes to. | 
| lockDate | uint256 | The date until which the position is locked. | 
| nonce | uint256 | The contract state required to match the signature. | 
| expiry | uint256 | The time at which to expire the signature. | 
| v | uint8 | The recovery byte of the signature. | 
| r | bytes32 | Half of the ECDSA signature pair. | 
| s | bytes32 | Half of the ECDSA signature pair. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction delegateBySig(
        address delegatee,
        uint256 lockDate,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

```
</details>

---    

> ### stake

Stake the given amount for the given duration of time.

```solidity
function stake(uint96 amount, uint256 until, address stakeFor, address delegatee) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to stake. | 
| until | uint256 | Timestamp indicating the date until which to stake. | 
| stakeFor | address | The address to stake the tokens for or 0x0 if staking for oneself. | 
| delegatee | address | The address of the delegatee or 0x0 if there is none. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction stake(
        uint96 amount,
        uint256 until,
        address stakeFor,
        address delegatee
    ) external;

```
</details>

---    

> ### stakeWithApproval

Stake the given amount for the given duration of time.

```solidity
function stakeWithApproval(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sender | address | The sender of SOV.approveAndCall | 
| amount | uint96 | The number of tokens to stake. | 
| until | uint256 | Timestamp indicating the date until which to stake. | 
| stakeFor | address | The address to stake the tokens for or 0x0 if staking for oneself. | 
| delegatee | address | The address of the delegatee or 0x0 if there is none. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction stakeWithApproval(
        address sender,
        uint96 amount,
        uint256 until,
        address stakeFor,
        address delegatee
    ) external;

```
</details>

---    

> ### receiveApproval

Receives approval from SOV token.

```solidity
function receiveApproval(address _sender, uint256 _amount, address _token, bytes _data) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sender | address |  | 
| _amount | uint256 |  | 
| _token | address |  | 
| _data | bytes | The data will be used for low level call. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction receiveApproval(
        address _sender,
        uint256 _amount,
        address _token,
        bytes calldata _data
    ) external;

```
</details>

---    

> ### extendStakingDuration

Extend the staking duration until the specified date.

```solidity
function extendStakingDuration(uint256 previousLock, uint256 until) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| previousLock | uint256 | The old unlocking timestamp. | 
| until | uint256 | The new unlocking timestamp in seconds. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction extendStakingDuration(uint256 previousLock, uint256 until) external;

```
</details>

---    

> ### stakesBySchedule

DO NOT USE this misspelled function. Use stakeBySchedule function instead.
This function cannot be deprecated while we have non-upgradeable vesting contracts.

```solidity
function stakesBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint256 |  | 
| cliff | uint256 |  | 
| duration | uint256 |  | 
| intervalLength | uint256 |  | 
| stakeFor | address |  | 
| delegatee | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction stakesBySchedule(
        uint256 amount,
        uint256 cliff,
        uint256 duration,
        uint256 intervalLength,
        address stakeFor,
        address delegatee
    ) external;

```
</details>

---    

> ### stakeBySchedule

Stake tokens according to the vesting schedule.

```solidity
function stakeBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint256 | The amount of tokens to stake. | 
| cliff | uint256 | The time interval to the first withdraw. | 
| duration | uint256 | The staking duration. | 
| intervalLength | uint256 | The length of each staking interval when cliff passed. | 
| stakeFor | address | The address to stake the tokens for or 0x0 if staking for oneself. | 
| delegatee | address | The address of the delegatee or 0x0 if there is none. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction stakeBySchedule(
        uint256 amount,
        uint256 cliff,
        uint256 duration,
        uint256 intervalLength,
        address stakeFor,
        address delegatee
    ) external;

```
</details>

---    

> ### balanceOf

Get the number of staked tokens held by the user account.

```solidity
function balanceOf(address account) external view
returns(balance uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to get the balance of. | 

**Returns**

The number of tokens held.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction balanceOf(address account) external view returns (uint96 balance);

```
</details>

---    

> ### getCurrentStakedUntil

Get the current number of tokens staked for a day.

```solidity
function getCurrentStakedUntil(uint256 lockedTS) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The timestamp to get the staked tokens for. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getCurrentStakedUntil(uint256 lockedTS) external view returns (uint96);

```
</details>

---    

> ### getStakes

Get list of stakes for a user account.

```solidity
function getStakes(address account) external view
returns(dates uint256[], stakes uint96[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address to get stakes. | 

**Returns**

The arrays of dates and stakes.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getStakes(address account)
        external
        view
        returns (uint256[] memory dates, uint96[] memory stakes);

```
</details>

---    

> ### timestampToLockDate

Unstaking is possible every 2 weeks only. This means, to
calculate the key value for the staking checkpoints, we need to
map the intended timestamp to the closest available date.

```solidity
function timestampToLockDate(uint256 timestamp) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| timestamp | uint256 | The unlocking timestamp. | 

**Returns**

The actual unlocking date (might be up to 2 weeks shorter than intended).

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction timestampToLockDate(uint256 timestamp) external view returns (uint256);

```
</details>

---    

> ### getStorageMaxDurationToStakeTokens

The maximum duration to stake tokens

```solidity
function getStorageMaxDurationToStakeTokens() external pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getStorageMaxDurationToStakeTokens() external pure returns (uint256);

```
</details>

---    

> ### getStorageMaxVotingWeight

The maximum possible voting weight before adding +1 (actually 10, but need 9 for computation).

```solidity
function getStorageMaxVotingWeight() external pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getStorageMaxVotingWeight() external pure returns (uint256);

```
</details>

---    

> ### getStorageWeightFactor

weight is multiplied with this factor (for allowing decimals, like 1.2x).

```solidity
function getStorageWeightFactor() external pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getStorageWeightFactor() external pure returns (uint256);

```
</details>

---    

> ### getStorageDefaultWeightScaling

```solidity
function getStorageDefaultWeightScaling() external pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getStorageDefaultWeightScaling() external pure returns (uint256);

```
</details>

---    

> ### getStorageRangeForWeightScaling

return (uint256(MIN_WEIGHT_SCALING), uint256(MAX_WEIGHT_SCALING))

```solidity
function getStorageRangeForWeightScaling() external pure
returns(minWeightScaling uint256, maxWeightScaling uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getStorageRangeForWeightScaling()
        external
        pure
        returns (uint256 minWeightScaling, uint256 maxWeightScaling);

```
</details>

---    

> ### getStorageDomainTypehash

The EIP-712 typehash for the contract's domain.

```solidity
function getStorageDomainTypehash() external pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getStorageDomainTypehash() external pure returns (uint256);

```
</details>

---    

> ### getStorageDelegationTypehash

The EIP-712 typehash for the delegation struct used by the contract.

```solidity
function getStorageDelegationTypehash() external pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getStorageDelegationTypehash() external pure returns (uint256);

```
</details>

---    

> ### getStorageName

```solidity
function getStorageName() external view
returns(string)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getStorageName() external view returns (string memory);

```
</details>

---    

> ### kickoffTS

The timestamp of contract creation. Base for the staking period calculation.

```solidity
function kickoffTS() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction kickoffTS() external view returns (uint256);

```
</details>

---    

> ### SOVToken

The token to be staked

```solidity
function SOVToken() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction SOVToken() external view returns (address);

```
</details>

---    

> ### delegates

Stakers delegated voting power

```solidity
function delegates(address staker, uint256 until) external view
returns(_delegate address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| staker | address | - the delegating address | 
| until | uint256 | - delegated voting | 

**Returns**

_delegate - voting power delegated to address

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction delegates(address staker, uint256 until) external view returns (address _delegate);

```
</details>

---    

> ### allUnlocked

If this flag is set to true, all tokens are unlocked immediately
 see function unlockAllTokens() for details

```solidity
function allUnlocked() external view
returns(bool)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction allUnlocked() external view returns (bool);

```
</details>

---    

> ### newStakingContract

Used for stake migrations to a new staking contract with a different storage structure

```solidity
function newStakingContract() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction newStakingContract() external view returns (address);

```
</details>

---    

> ### totalStakingCheckpoints

A record of tokens to be unstaked at a given time in total.
 For total voting power computation. Voting weights get adjusted bi-weekly.

```solidity
function totalStakingCheckpoints(uint256 date, uint32 index) external view
returns(struct IStaking.Checkpoint)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 |  | 
| index | uint32 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction totalStakingCheckpoints(uint256 date, uint32 index)
        external
        view
        returns (Checkpoint memory);

```
</details>

---    

> ### numTotalStakingCheckpoints

The number of total staking checkpoints for each date.

```solidity
function numTotalStakingCheckpoints(uint256 date) external view
returns(checkpointsQty bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction numTotalStakingCheckpoints(uint256 date)
        external
        view
        returns (bytes32 checkpointsQty);

```
</details>

---    

> ### delegateStakingCheckpoints

A record of tokens to be unstaked at a given time which were delegated to a certain address.
 For delegatee voting power computation. Voting weights get adjusted bi-weekly.

```solidity
function delegateStakingCheckpoints(address delagatee, uint256 date, uint32 index) external view
returns(struct IStaking.Checkpoint)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delagatee | address |  | 
| date | uint256 |  | 
| index | uint32 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction delegateStakingCheckpoints(
        address delagatee,
        uint256 date,
        uint32 index
    ) external view returns (Checkpoint memory);

```
</details>

---    

> ### numDelegateStakingCheckpoints

The number of total staking checkpoints for each date per delegate.

```solidity
function numDelegateStakingCheckpoints(address delegatee, uint256 date) external view
returns(checkpointsQty bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delegatee | address |  | 
| date | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction numDelegateStakingCheckpoints(address delegatee, uint256 date)
        external
        view
        returns (bytes32 checkpointsQty);

```
</details>

---    

> ### userStakingCheckpoints

A record of tokens to be unstaked at a given time which per user address (address -> lockDate -> stake checkpoint)

```solidity
function userStakingCheckpoints(address user, uint256 date, uint32 index) external view
returns(struct IStaking.Checkpoint)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address |  | 
| date | uint256 |  | 
| index | uint32 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction userStakingCheckpoints(
        address user,
        uint256 date,
        uint32 index
    ) external view returns (Checkpoint memory);

```
</details>

---    

> ### numUserStakingCheckpoints

The number of total staking checkpoints for each date per user.

```solidity
function numUserStakingCheckpoints(address user, uint256 date) external view
returns(checkpointsQty uint32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address |  | 
| date | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction numUserStakingCheckpoints(address user, uint256 date)
        external
        view
        returns (uint32 checkpointsQty);

```
</details>

---    

> ### nonces

A record of states for signing / validating signatures

```solidity
function nonces(address user) external view
returns(nonce uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction nonces(address user) external view returns (uint256 nonce);

```
</details>

---    

> ### feeSharing

the address of FeeSharingCollectorProxy contract, we need it for unstaking with slashing.

```solidity
function feeSharing() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction feeSharing() external view returns (address);

```
</details>

---    

> ### weightScaling

used for weight scaling when unstaking with slashing.

```solidity
function weightScaling() external view
returns(uint96)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction weightScaling() external view returns (uint96);

```
</details>

---    

> ### vestingWhitelist

List of vesting contracts, tokens for these contracts won't be slashed if unstaked by governance.

```solidity
function vestingWhitelist(address isWhitelisted) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| isWhitelisted | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction vestingWhitelist(address isWhitelisted) external view returns (bool);

```
</details>

---    

> ### admins

user => flag whether user has admin role.

```solidity
function admins(address isAdmin) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| isAdmin | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction admins(address isAdmin) external view returns (bool);

```
</details>

---    

> ### vestingCodeHashes

vesting contract code hash => flag whether it's registered code hash

```solidity
function vestingCodeHashes(bytes32 vestingLogicCodeHash) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vestingLogicCodeHash | bytes32 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction vestingCodeHashes(bytes32 vestingLogicCodeHash) external view returns (bool);

```
</details>

---    

> ### vestingCheckpoints

A record of tokens to be unstaked from vesting contract at a given time (lockDate -> vest checkpoint)

```solidity
function vestingCheckpoints(uint256 date, uint32 index) external view
returns(struct IStaking.Checkpoint)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 |  | 
| index | uint32 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction vestingCheckpoints(uint256 date, uint32 index)
        external
        view
        returns (Checkpoint memory);

```
</details>

---    

> ### numVestingCheckpoints

The number of total vesting checkpoints for each date.

```solidity
function numVestingCheckpoints(uint256 date) external view
returns(checkpointsQty uint32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction numVestingCheckpoints(uint256 date) external view returns (uint32 checkpointsQty);

```
</details>

---    

> ### vestingRegistryLogic

vesting registry contract PROXY address

```solidity
function vestingRegistryLogic() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction vestingRegistryLogic() external view returns (address);

```
</details>

---    

> ### pausers

user => flag whether user has pauser role.

```solidity
function pausers(address isPauser) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| isPauser | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction pausers(address isPauser) external view returns (bool);

```
</details>

---    

> ### paused

Staking contract is paused

```solidity
function paused() external view
returns(bool)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction paused() external view returns (bool);

```
</details>

---    

> ### frozen

Staking contract is frozen

```solidity
function frozen() external view
returns(bool)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction frozen() external view returns (bool);

```
</details>

---    

> ### isVestingContract

Return flag whether the given address is a registered vesting contract.

```solidity
function isVestingContract(address stakerAddress) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| stakerAddress | address | the address to check | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction isVestingContract(address stakerAddress) external view returns (bool);

```
</details>

---    

> ### removeContractCodeHash

Remove vesting contract's code hash to a map of code hashes.

```solidity
function removeContractCodeHash(address vesting) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vesting | address | The address of Vesting contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction removeContractCodeHash(address vesting) external;

```
</details>

---    

> ### addContractCodeHash

Add vesting contract's code hash to a map of code hashes.

```solidity
function addContractCodeHash(address vesting) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vesting | address | The address of Vesting contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction addContractCodeHash(address vesting) external;

```
</details>

---    

> ### getPriorVestingStakeByDate

Determine the prior number of vested stake for an account until a
certain lock date as of a block number.

```solidity
function getPriorVestingStakeByDate(uint256 date, uint256 blockNumber) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The lock date. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

**Returns**

The number of votes the account had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getPriorVestingStakeByDate(uint256 date, uint256 blockNumber)
        external
        view
        returns (uint96);

```
</details>

---    

> ### weightedVestingStakeByDate

Compute the voting power for a specific date.
Power = stake * weight

```solidity
function weightedVestingStakeByDate(uint256 date, uint256 startDate, uint256 blockNumber) external view
returns(power uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The staking date to compute the power for. Adjusted to the next valid lock date, if necessary. | 
| startDate | uint256 | The date for which we need to know the power of the stake. | 
| blockNumber | uint256 | The block number, needed for checkpointing. | 

**Returns**

The stacking power.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction weightedVestingStakeByDate(
        uint256 date,
        uint256 startDate,
        uint256 blockNumber
    ) external view returns (uint96 power);

```
</details>

---    

> ### getPriorVestingWeightedStake

Determine the prior weighted vested amount for an account as of a block number.
Iterate through checkpoints adding up voting power.

```solidity
function getPriorVestingWeightedStake(uint256 blockNumber, uint256 date) external view
returns(votes uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| blockNumber | uint256 | The block number to get the vote balance at. | 
| date | uint256 | The staking date to compute the power for. | 

**Returns**

The weighted stake the account had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getPriorVestingWeightedStake(uint256 blockNumber, uint256 date)
        external
        view
        returns (uint96 votes);

```
</details>

---    

> ### getPriorUserStakeByDate

Determine the prior number of stake for an account until a
certain lock date as of a block number.

```solidity
function getPriorUserStakeByDate(address account, uint256 date, uint256 blockNumber) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| date | uint256 | The lock date. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

**Returns**

The number of votes the account had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getPriorUserStakeByDate(
        address account,
        uint256 date,
        uint256 blockNumber
    ) external view returns (uint96);

```
</details>

---    

> ### setVestingStakes

Sets the users' vesting stakes for a giving lock dates and writes checkpoints.

```solidity
function setVestingStakes(uint256[] lockedDates, uint96[] values) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedDates | uint256[] | The arrays of lock dates. | 
| values | uint96[] | The array of values to add to the staked balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction setVestingStakes(uint256[] calldata lockedDates, uint96[] calldata values) external;

```
</details>

---    

> ### setVestingRegistry

sets vesting registry

```solidity
function setVestingRegistry(address _vestingRegistryProxy) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingRegistryProxy | address | the address of vesting registry proxy contract | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction setVestingRegistry(address _vestingRegistryProxy) external;

```
</details>

---    

> ### withdraw

Withdraw the given amount of tokens if they are unlocked.

```solidity
function withdraw(uint96 amount, uint256 until, address receiver) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. | 
| receiver | address | The receiver of the tokens. If not specified, send to the msg.sender | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction withdraw(
        uint96 amount,
        uint256 until,
        address receiver
    ) external;

```
</details>

---    

> ### governanceWithdraw

Withdraw the given amount of tokens.

```solidity
function governanceWithdraw(uint96 amount, uint256 until, address receiver) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. | 
| receiver | address | The receiver of the tokens. If not specified, send to the msg.sender | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction governanceWithdraw(
        uint96 amount,
        uint256 until,
        address receiver
    ) external;

```
</details>

---    

> ### governanceWithdrawVesting

Withdraw tokens for vesting contract.

```solidity
function governanceWithdrawVesting(address vesting, address receiver) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vesting | address | The address of Vesting contract. | 
| receiver | address | The receiver of the tokens. If not specified, send to the msg.sender | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction governanceWithdrawVesting(address vesting, address receiver) external;

```
</details>

---    

> ### getWithdrawAmounts

Get available and punished amount for withdrawing.

```solidity
function getWithdrawAmounts(uint96 amount, uint256 until) external view
returns(uint96, uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getWithdrawAmounts(uint96 amount, uint256 until)
        external
        view
        returns (uint96, uint96);

```
</details>

---    

> ### unlockAllTokens

Allow the owner to unlock all tokens in case the staking contract
is going to be replaced
Note: Not reversible on purpose. once unlocked, everything is unlocked.
The owner should not be able to just quickly unlock to withdraw his own
tokens and lock again.

```solidity
function unlockAllTokens() external nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction unlockAllTokens() external;

```
</details>

---    

> ### getPriorWeightedStake

Determine the prior weighted stake for an account as of a block number.
Iterate through checkpoints adding up voting power.

```solidity
function getPriorWeightedStake(address account, uint256 blockNumber, uint256 date) external view
returns(priorWeightedStake uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 
| date | uint256 | The date/timestamp of the unstaking time. | 

**Returns**

The weighted stake the account had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getPriorWeightedStake(
        address account,
        uint256 blockNumber,
        uint256 date
    ) external view returns (uint96 priorWeightedStake);

```
</details>

---    

> ### weightedStakeByDate

Compute the voting power for a specific date.
Power = stake * weight
TODO: WeightedStaking::weightedStakeByDate should probably better
be internal instead of a public function.

```solidity
function weightedStakeByDate(address account, uint256 date, uint256 startDate, uint256 blockNumber) external view
returns(power uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The user address. | 
| date | uint256 | The staking date to compute the power for. | 
| startDate | uint256 | The date for which we need to know the power of the stake. | 
| blockNumber | uint256 | The block number, needed for checkpointing. | 

**Returns**

The stacking power.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction weightedStakeByDate(
        address account,
        uint256 date,
        uint256 startDate,
        uint256 blockNumber
    ) external view returns (uint96 power);

```
</details>

---    

> ### computeWeightByDate

Compute the weight for a specific date.

```solidity
function computeWeightByDate(uint256 date, uint256 startDate) external pure
returns(weight uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The unlocking date. | 
| startDate | uint256 | We compute the weight for the tokens staked until 'date' on 'startDate'. | 

**Returns**

The weighted stake the account had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction computeWeightByDate(uint256 date, uint256 startDate)
        external
        pure
        returns (uint96 weight);

```
</details>

---    

> ### MAX_DURATION

Returns public constant MAX_DURATION
preserved for backwards compatibility
Use getStorageMaxDurationToStakeTokens()

```solidity
function MAX_DURATION() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction MAX_DURATION() external view returns (uint256);

```
</details>

---    

> ### owner

Returns the address of the current owner.

```solidity
function owner() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction owner() external view returns (address);

```
</details>

---    

> ### isOwner

Returns true if the caller is the current owner.

```solidity
function isOwner() external view
returns(bool)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction isOwner() external view returns (bool);

```
</details>

---    

> ### transferOwnership

Transfers ownership of the contract to a new account (`newOwner`).
Can only be called by the current owner.

```solidity
function transferOwnership(address newOwner) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newOwner | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction transferOwnership(address newOwner) external;

```
</details>

---    

> ### cancelTeamVesting

Governance withdraw vesting directly through staking contract.
This direct withdraw vesting solves the out of gas issue when there are too many iterations when withdrawing.
This function only allows cancelling vesting contract of the TeamVesting type.
     *

```solidity
function cancelTeamVesting(address vesting, address receiver, uint256 startFrom) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vesting | address | The vesting address. | 
| receiver | address | The receiving address. | 
| startFrom | uint256 | The start value for the iterations. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction cancelTeamVesting(
        address vesting,
        address receiver,
        uint256 startFrom
    ) external;

```
</details>

---    

> ### getMaxVestingWithdrawIterations

Max iteration for direct withdrawal from staking to prevent out of gas issue.
     *

```solidity
function getMaxVestingWithdrawIterations() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getMaxVestingWithdrawIterations() external view returns (uint256);

```
</details>

---    

> ### setMaxVestingWithdrawIterations

set max withdraw iterations.
     *

```solidity
function setMaxVestingWithdrawIterations(uint256 maxIterations) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| maxIterations | uint256 | new max iterations value. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction setMaxVestingWithdrawIterations(uint256 maxIterations) external;
}
```
</details>

## Contracts

* [Address](Address.md)
* [Administered](Administered.md)
* [AdminRole](AdminRole.md)
* [AdvancedToken](AdvancedToken.md)
* [AdvancedTokenStorage](AdvancedTokenStorage.md)
* [Affiliates](Affiliates.md)
* [AffiliatesEvents](AffiliatesEvents.md)
* [ApprovalReceiver](ApprovalReceiver.md)
* [BProPriceFeed](BProPriceFeed.md)
* [CheckpointsShared](CheckpointsShared.md)
* [Constants](Constants.md)
* [Context](Context.md)
* [DevelopmentFund](DevelopmentFund.md)
* [DummyContract](DummyContract.md)
* [EnumerableAddressSet](EnumerableAddressSet.md)
* [EnumerableBytes32Set](EnumerableBytes32Set.md)
* [EnumerableBytes4Set](EnumerableBytes4Set.md)
* [ERC20](ERC20.md)
* [ERC20Detailed](ERC20Detailed.md)
* [ErrorDecoder](ErrorDecoder.md)
* [Escrow](Escrow.md)
* [EscrowReward](EscrowReward.md)
* [FeedsLike](FeedsLike.md)
* [FeesEvents](FeesEvents.md)
* [FeeSharingCollector](FeeSharingCollector.md)
* [FeeSharingCollectorProxy](FeeSharingCollectorProxy.md)
* [FeeSharingCollectorStorage](FeeSharingCollectorStorage.md)
* [FeesHelper](FeesHelper.md)
* [FourYearVesting](FourYearVesting.md)
* [FourYearVestingFactory](FourYearVestingFactory.md)
* [FourYearVestingLogic](FourYearVestingLogic.md)
* [FourYearVestingStorage](FourYearVestingStorage.md)
* [GenericTokenSender](GenericTokenSender.md)
* [GovernorAlpha](GovernorAlpha.md)
* [GovernorVault](GovernorVault.md)
* [IApproveAndCall](IApproveAndCall.md)
* [IChai](IChai.md)
* [IContractRegistry](IContractRegistry.md)
* [IConverterAMM](IConverterAMM.md)
* [IERC1820Registry](IERC1820Registry.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IERC777](IERC777.md)
* [IERC777Recipient](IERC777Recipient.md)
* [IERC777Sender](IERC777Sender.md)
* [IFeeSharingCollector](IFeeSharingCollector.md)
* [IFourYearVesting](IFourYearVesting.md)
* [IFourYearVestingFactory](IFourYearVestingFactory.md)
* [IFunctionsList](IFunctionsList.md)
* [ILiquidityMining](ILiquidityMining.md)
* [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
* [ILoanPool](ILoanPool.md)
* [ILoanToken](ILoanToken.md)
* [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
* [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
* [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
* [ILoanTokenModules](ILoanTokenModules.md)
* [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
* [ILockedSOV](ILockedSOV.md)
* [IMoCState](IMoCState.md)
* [IModulesProxyRegistry](IModulesProxyRegistry.md)
* [Initializable](Initializable.md)
* [InterestUser](InterestUser.md)
* [IPot](IPot.md)
* [IPriceFeeds](IPriceFeeds.md)
* [IPriceFeedsExt](IPriceFeedsExt.md)
* [IProtocol](IProtocol.md)
* [IRSKOracle](IRSKOracle.md)
* [ISovryn](ISovryn.md)
* [ISovrynSwapNetwork](ISovrynSwapNetwork.md)
* [IStaking](IStaking.md)
* [ISwapsImpl](ISwapsImpl.md)
* [ITeamVesting](ITeamVesting.md)
* [ITimelock](ITimelock.md)
* [IV1PoolOracle](IV1PoolOracle.md)
* [IVesting](IVesting.md)
* [IVestingFactory](IVestingFactory.md)
* [IVestingRegistry](IVestingRegistry.md)
* [IWrbtc](IWrbtc.md)
* [IWrbtcERC20](IWrbtcERC20.md)
* [LenderInterestStruct](LenderInterestStruct.md)
* [LiquidationHelper](LiquidationHelper.md)
* [LiquidityMining](LiquidityMining.md)
* [LiquidityMiningConfigToken](LiquidityMiningConfigToken.md)
* [LiquidityMiningProxy](LiquidityMiningProxy.md)
* [LiquidityMiningStorage](LiquidityMiningStorage.md)
* [LoanClosingsEvents](LoanClosingsEvents.md)
* [LoanClosingsLiquidation](LoanClosingsLiquidation.md)
* [LoanClosingsRollover](LoanClosingsRollover.md)
* [LoanClosingsShared](LoanClosingsShared.md)
* [LoanClosingsWith](LoanClosingsWith.md)
* [LoanClosingsWithoutInvariantCheck](LoanClosingsWithoutInvariantCheck.md)
* [LoanInterestStruct](LoanInterestStruct.md)
* [LoanMaintenance](LoanMaintenance.md)
* [LoanMaintenanceEvents](LoanMaintenanceEvents.md)
* [LoanOpenings](LoanOpenings.md)
* [LoanOpeningsEvents](LoanOpeningsEvents.md)
* [LoanParamsStruct](LoanParamsStruct.md)
* [LoanSettings](LoanSettings.md)
* [LoanSettingsEvents](LoanSettingsEvents.md)
* [LoanStruct](LoanStruct.md)
* [LoanToken](LoanToken.md)
* [LoanTokenBase](LoanTokenBase.md)
* [LoanTokenLogicBeacon](LoanTokenLogicBeacon.md)
* [LoanTokenLogicLM](LoanTokenLogicLM.md)
* [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
* [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
* [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
* [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
* [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
* [LockedSOV](LockedSOV.md)
* [MarginTradeStructHelpers](MarginTradeStructHelpers.md)
* [Medianizer](Medianizer.md)
* [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
* [ModulesCommonEvents](ModulesCommonEvents.md)
* [ModulesProxy](ModulesProxy.md)
* [ModulesProxyRegistry](ModulesProxyRegistry.md)
* [MultiSigKeyHolders](MultiSigKeyHolders.md)
* [MultiSigWallet](MultiSigWallet.md)
* [Mutex](Mutex.md)
* [Objects](Objects.md)
* [OrderStruct](OrderStruct.md)
* [OrigingVestingCreator](OrigingVestingCreator.md)
* [OriginInvestorsClaim](OriginInvestorsClaim.md)
* [Ownable](Ownable.md)
* [Pausable](Pausable.md)
* [PausableOz](PausableOz.md)
* [PreviousLoanToken](PreviousLoanToken.md)
* [PreviousLoanTokenSettingsLowerAdmin](PreviousLoanTokenSettingsLowerAdmin.md)
* [PriceFeedRSKOracle](PriceFeedRSKOracle.md)
* [PriceFeeds](PriceFeeds.md)
* [PriceFeedsLocal](PriceFeedsLocal.md)
* [PriceFeedsMoC](PriceFeedsMoC.md)
* [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
* [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
* [ProtocolLike](ProtocolLike.md)
* [ProtocolSettings](ProtocolSettings.md)
* [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
* [ProtocolSettingsLike](ProtocolSettingsLike.md)
* [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
* [ProtocolTokenUser](ProtocolTokenUser.md)
* [Proxy](Proxy.md)
* [ProxyOwnable](ProxyOwnable.md)
* [ReentrancyGuard](ReentrancyGuard.md)
* [RewardHelper](RewardHelper.md)
* [RSKAddrValidator](RSKAddrValidator.md)
* [SafeERC20](SafeERC20.md)
* [SafeMath](SafeMath.md)
* [SafeMath96](SafeMath96.md)
* [setGet](setGet.md)
* [SharedReentrancyGuard](SharedReentrancyGuard.md)
* [SignedSafeMath](SignedSafeMath.md)
* [SOV](SOV.md)
* [sovrynProtocol](sovrynProtocol.md)
* [StakingAdminModule](StakingAdminModule.md)
* [StakingGovernanceModule](StakingGovernanceModule.md)
* [StakingInterface](StakingInterface.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingShared](StakingShared.md)
* [StakingStakeModule](StakingStakeModule.md)
* [StakingStorageModule](StakingStorageModule.md)
* [StakingStorageShared](StakingStorageShared.md)
* [StakingVestingModule](StakingVestingModule.md)
* [StakingWithdrawModule](StakingWithdrawModule.md)
* [State](State.md)
* [SwapsEvents](SwapsEvents.md)
* [SwapsExternal](SwapsExternal.md)
* [SwapsImplLocal](SwapsImplLocal.md)
* [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
* [SwapsUser](SwapsUser.md)
* [TeamVesting](TeamVesting.md)
* [Timelock](Timelock.md)
* [TimelockHarness](TimelockHarness.md)
* [TimelockInterface](TimelockInterface.md)
* [TokenSender](TokenSender.md)
* [UpgradableProxy](UpgradableProxy.md)
* [USDTPriceFeed](USDTPriceFeed.md)
* [Utils](Utils.md)
* [VaultController](VaultController.md)
* [Vesting](Vesting.md)
* [VestingCreator](VestingCreator.md)
* [VestingFactory](VestingFactory.md)
* [VestingLogic](VestingLogic.md)
* [VestingRegistry](VestingRegistry.md)
* [VestingRegistry2](VestingRegistry2.md)
* [VestingRegistry3](VestingRegistry3.md)
* [VestingRegistryLogic](VestingRegistryLogic.md)
* [VestingRegistryProxy](VestingRegistryProxy.md)
* [VestingRegistryStorage](VestingRegistryStorage.md)
* [VestingStorage](VestingStorage.md)
* [WeightedStakingModule](WeightedStakingModule.md)
* [WRBTC](WRBTC.md)
