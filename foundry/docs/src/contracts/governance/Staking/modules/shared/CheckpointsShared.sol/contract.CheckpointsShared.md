# CheckpointsShared
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Staking/modules/shared/CheckpointsShared.sol)

**Inherits:**
[StakingStorageShared](/contracts/governance/Staking/modules/shared/StakingStorageShared.sol/contract.StakingStorageShared.md), [SafeMath96](/contracts/governance/Staking/SafeMath96.sol/contract.SafeMath96.md)

Increases and decreases storage values for users, delegatees and
total daily stake.


## Functions
### constructor


```solidity
constructor() internal;
```

### _increaseVestingStake

Increases the user's vesting stake for a giving lock date and writes a checkpoint.


```solidity
function _increaseVestingStake(uint256 lockedTS, uint96 value) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lockedTS`|`uint256`|The lock date.|
|`value`|`uint96`|The value to add to the staked balance.|


### _decreaseVestingStake

Decreases the user's vesting stake for a giving lock date and writes a checkpoint.


```solidity
function _decreaseVestingStake(uint256 lockedTS, uint96 value) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lockedTS`|`uint256`|The lock date.|
|`value`|`uint96`|The value to substract to the staked balance.|


### _writeVestingCheckpoint

Writes on storage the user vested amount.


```solidity
function _writeVestingCheckpoint(uint256 lockedTS, uint32 nCheckpoints, uint96 newVest) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lockedTS`|`uint256`|The lock date.|
|`nCheckpoints`|`uint32`|The number of checkpoints, to find out the last one index.|
|`newVest`|`uint96`|The new vest balance.|


### _increaseUserStake

Increases the user's stake for a giving lock date and writes a checkpoint.


```solidity
function _increaseUserStake(address account, uint256 lockedTS, uint96 value) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|The user address.|
|`lockedTS`|`uint256`|The lock date.|
|`value`|`uint96`|The value to add to the staked balance.|


### _decreaseUserStake

Decreases the user's stake for a giving lock date and writes a checkpoint.


```solidity
function _decreaseUserStake(address account, uint256 lockedTS, uint96 value) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|The user address.|
|`lockedTS`|`uint256`|The lock date.|
|`value`|`uint96`|The value to substract to the staked balance.|


### _writeUserCheckpoint

Writes on storage the user stake.


```solidity
function _writeUserCheckpoint(address account, uint256 lockedTS, uint32 nCheckpoints, uint96 newStake) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|The user address.|
|`lockedTS`|`uint256`|The lock date.|
|`nCheckpoints`|`uint32`|The number of checkpoints, to find out the last one index.|
|`newStake`|`uint96`|The new staked balance.|


### _increaseDelegateStake

Increases the delegatee's stake for a giving lock date and writes a checkpoint.


```solidity
function _increaseDelegateStake(address delegatee, uint256 lockedTS, uint96 value) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`delegatee`|`address`|The delegatee address.|
|`lockedTS`|`uint256`|The lock date.|
|`value`|`uint96`|The value to add to the staked balance.|


### _decreaseDelegateStake

Decreases the delegatee's stake for a giving lock date and writes a checkpoint.


```solidity
function _decreaseDelegateStake(address delegatee, uint256 lockedTS, uint96 value) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`delegatee`|`address`|The delegatee address.|
|`lockedTS`|`uint256`|The lock date.|
|`value`|`uint96`|The value to substract to the staked balance.|


### _writeDelegateCheckpoint

Writes on storage the delegate stake.


```solidity
function _writeDelegateCheckpoint(address delegatee, uint256 lockedTS, uint32 nCheckpoints, uint96 newStake) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`delegatee`|`address`|The delegate address.|
|`lockedTS`|`uint256`|The lock date.|
|`nCheckpoints`|`uint32`|The number of checkpoints, to find out the last one index.|
|`newStake`|`uint96`|The new staked balance.|


### _increaseDailyStake

Increases the total stake for a giving lock date and writes a checkpoint.


```solidity
function _increaseDailyStake(uint256 lockedTS, uint96 value) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lockedTS`|`uint256`|The lock date.|
|`value`|`uint96`|The value to add to the staked balance.|


### _decreaseDailyStake

Decreases the total stake for a giving lock date and writes a checkpoint.


```solidity
function _decreaseDailyStake(uint256 lockedTS, uint96 value) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lockedTS`|`uint256`|The lock date.|
|`value`|`uint96`|The value to substract to the staked balance.|


### _writeStakingCheckpoint

Writes on storage the total stake.


```solidity
function _writeStakingCheckpoint(uint256 lockedTS, uint32 nCheckpoints, uint96 newStake) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lockedTS`|`uint256`|The lock date.|
|`nCheckpoints`|`uint32`|The number of checkpoints, to find out the last one index.|
|`newStake`|`uint96`|The new staked balance.|


### _currentBalance

Get the current balance of an account locked until a certain date.


```solidity
function _currentBalance(address account, uint256 lockDate) internal view returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|The user address.|
|`lockDate`|`uint256`|The lock date.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The stake amount.|


## Events
### DelegateChanged
An event emitted when an account changes its delegate.


```solidity
event DelegateChanged(
    address indexed delegator, uint256 lockedUntil, address indexed fromDelegate, address indexed toDelegate
);
```

### DelegateStakeChanged
An event emitted when a delegate account's stake balance changes.


```solidity
event DelegateStakeChanged(address indexed delegate, uint256 lockedUntil, uint256 previousBalance, uint256 newBalance);
```

### TokensStaked
An event emitted when tokens get staked.


```solidity
event TokensStaked(address indexed staker, uint256 amount, uint256 lockedUntil, uint256 totalStaked);
```

### StakingWithdrawn
An event emitted when staked tokens get withdrawn.


```solidity
event StakingWithdrawn(
    address indexed staker, uint256 amount, uint256 until, address indexed receiver, bool isGovernance
);
```

### VestingTokensWithdrawn
An event emitted when vesting tokens get withdrawn.


```solidity
event VestingTokensWithdrawn(address vesting, address receiver);
```

### TokensUnlocked
An event emitted when the owner unlocks all tokens.


```solidity
event TokensUnlocked(uint256 amount);
```

### ExtendedStakingDuration
An event emitted when a staking period gets extended.


```solidity
event ExtendedStakingDuration(address indexed staker, uint256 previousDate, uint256 newDate, uint256 amountStaked);
```

### AdminAdded

```solidity
event AdminAdded(address admin);
```

### AdminRemoved

```solidity
event AdminRemoved(address admin);
```

### PauserAddedOrRemoved

```solidity
event PauserAddedOrRemoved(address indexed pauser, bool indexed added);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`pauser`|`address`|address to grant power to pause the contract|
|`added`|`bool`|true - added, false - removed|

### StakingPaused
An event emitted when a staking is paused or unpaused


```solidity
event StakingPaused(bool indexed setPaused);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`setPaused`|`bool`|true - pause, false - unpause|

### StakingFrozen
An event emitted when a staking is frozen or unfrozen


```solidity
event StakingFrozen(bool indexed setFrozen);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`setFrozen`|`bool`|true - freeze, false - unfreeze|

### ContractCodeHashAdded

```solidity
event ContractCodeHashAdded(bytes32 hash);
```

### ContractCodeHashRemoved

```solidity
event ContractCodeHashRemoved(bytes32 hash);
```

### VestingStakeSet

```solidity
event VestingStakeSet(uint256 lockedTS, uint96 value);
```

### TeamVestingCancelled

```solidity
event TeamVestingCancelled(address indexed caller, address receiver);
```

### TeamVestingPartiallyCancelled

```solidity
event TeamVestingPartiallyCancelled(address indexed caller, address receiver, uint256 nextStartFrom);
```

