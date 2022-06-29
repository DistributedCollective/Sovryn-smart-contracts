# Weighted Staking contract. (WeightedStaking.sol)

View Source: [contracts/governance/Staking/WeightedStaking.sol](../contracts/governance/Staking/WeightedStaking.sol)

**↗ Extends: [Checkpoints](Checkpoints.md)**
**↘ Derived Contracts: [Staking](Staking.md)**

**WeightedStaking**

Computation of power and votes used by FeeSharingProxy and
GovernorAlpha and Staking contracts w/ mainly 3 public functions:
  + getPriorTotalVotingPower => Total voting power.
  + getPriorVotes  => Delegatee voting power.
  + getPriorWeightedStake  => User Weighted Stake.
Staking contract inherits WeightedStaking.
FeeSharingProxy and GovernorAlpha invoke Staking instance functions.

## Modifiers

- [onlyAuthorized](#onlyauthorized)
- [onlyPauserOrOwner](#onlypauserorowner)
- [whenNotPaused](#whennotpaused)
- [whenNotFrozen](#whennotfrozen)

### onlyAuthorized

Throws if called by any account other than the owner or admin.

```js
modifier onlyAuthorized() internal
```

### onlyPauserOrOwner

Throws if called by any account other than the owner or pauser.

```js
modifier onlyPauserOrOwner() internal
```

### whenNotPaused

Throws if paused.

```js
modifier whenNotPaused() internal
```

### whenNotFrozen

Throws if frozen.

```js
modifier whenNotFrozen() internal
```

## Functions

- [setVestingRegistry(address _vestingRegistryProxy)](#setvestingregistry)
- [setVestingStakes(uint256[] lockedDates, uint96[] values)](#setvestingstakes)
- [_setVestingStake(uint256 lockedTS, uint96 value)](#_setvestingstake)
- [getPriorTotalVotingPower(uint32 blockNumber, uint256 time)](#getpriortotalvotingpower)
- [_totalPowerByDate(uint256 date, uint256 startDate, uint256 blockNumber)](#_totalpowerbydate)
- [getPriorTotalStakesForDate(uint256 date, uint256 blockNumber)](#getpriortotalstakesfordate)
- [getPriorVotes(address account, uint256 blockNumber, uint256 date)](#getpriorvotes)
- [_totalPowerByDateForDelegatee(address account, uint256 date, uint256 startDate, uint256 blockNumber)](#_totalpowerbydatefordelegatee)
- [getPriorStakeByDateForDelegatee(address account, uint256 date, uint256 blockNumber)](#getpriorstakebydatefordelegatee)
- [getPriorWeightedStake(address account, uint256 blockNumber, uint256 date)](#getpriorweightedstake)
- [weightedStakeByDate(address account, uint256 date, uint256 startDate, uint256 blockNumber)](#weightedstakebydate)
- [getPriorUserStakeByDate(address account, uint256 date, uint256 blockNumber)](#getprioruserstakebydate)
- [_getPriorUserStakeByDate(address account, uint256 date, uint256 blockNumber)](#_getprioruserstakebydate)
- [getPriorVestingWeightedStake(uint256 blockNumber, uint256 date)](#getpriorvestingweightedstake)
- [weightedVestingStakeByDate(uint256 date, uint256 startDate, uint256 blockNumber)](#weightedvestingstakebydate)
- [getPriorVestingStakeByDate(uint256 date, uint256 blockNumber)](#getpriorvestingstakebydate)
- [_getPriorVestingStakeByDate(uint256 date, uint256 blockNumber)](#_getpriorvestingstakebydate)
- [_getCurrentBlockNumber()](#_getcurrentblocknumber)
- [computeWeightByDate(uint256 date, uint256 startDate)](#computeweightbydate)
- [timestampToLockDate(uint256 timestamp)](#timestamptolockdate)
- [_adjustDateForOrigin(uint256 date)](#_adjustdatefororigin)
- [addAdmin(address _admin)](#addadmin)
- [removeAdmin(address _admin)](#removeadmin)
- [addPauser(address _pauser)](#addpauser)
- [removePauser(address _pauser)](#removepauser)
- [pauseUnpause(bool _pause)](#pauseunpause)
- [freezeUnfreeze(bool _freeze)](#freezeunfreeze)
- [addContractCodeHash(address vesting)](#addcontractcodehash)
- [removeContractCodeHash(address vesting)](#removecontractcodehash)
- [isVestingContract(address stakerAddress)](#isvestingcontract)
- [_getCodeHash(address _contract)](#_getcodehash)

---    

> ### setVestingRegistry

sets vesting registry

```solidity
function setVestingRegistry(address _vestingRegistryProxy) external nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingRegistryProxy | address | the address of vesting registry proxy contract | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setVestingRegistry(address _vestingRegistryProxy) external onlyOwner whenNotFrozen {
        vestingRegistryLogic = VestingRegistryLogic(_vestingRegistryProxy);
    }
```
</details>

---    

> ### setVestingStakes

Sets the users' vesting stakes for a giving lock dates and writes checkpoints.

```solidity
function setVestingStakes(uint256[] lockedDates, uint96[] values) external nonpayable onlyAuthorized whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedDates | uint256[] | The arrays of lock dates. | 
| values | uint96[] | The array of values to add to the staked balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setVestingStakes(uint256[] calldata lockedDates, uint96[] calldata values)
        external
        onlyAuthorized
        whenNotFrozen
    {
        require(lockedDates.length == values.length, "WS05"); // arrays mismatch

        uint256 length = lockedDates.length;
        for (uint256 i = 0; i < length; i++) {
            _setVestingStake(lockedDates[i], values[i]);
        }
    }
```
</details>

---    

> ### _setVestingStake

Sets the users' vesting stake for a giving lock date and writes a checkpoint.

```solidity
function _setVestingStake(uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to be set. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### getPriorTotalVotingPower

⤾ overrides [IStaking.getPriorTotalVotingPower](IStaking.md#getpriortotalvotingpower)

Compute the total voting power at a given time.

```solidity
function getPriorTotalVotingPower(uint32 blockNumber, uint256 time) public view
returns(totalVotingPower uint96)
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
        public
        view
        returns (uint96 totalVotingPower)
    {
        /// @dev Start the computation with the exact or previous unlocking date (voting weight remians the same until the next break point).
        uint256 start = timestampToLockDate(time);
        uint256 end = start + MAX_DURATION;

        /// @dev Max 78 iterations.
        for (uint256 i = start; i <= end; i += TWO_WEEKS) {
            totalVotingPower = add96(
                totalVotingPower,
                _totalPowerByDate(i, start, blockNumber),
                "WS06"
            ); // arrays mismatch
        }
    }
```
</details>

---    

> ### _totalPowerByDate

Compute the voting power for a specific date.
Power = stake * weight

```solidity
function _totalPowerByDate(uint256 date, uint256 startDate, uint256 blockNumber) internal view
returns(power uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The staking date to compute the power for. | 
| startDate | uint256 | The date for which we need to know the power of the stake. | 
| blockNumber | uint256 | The block number, needed for checkpointing. | 

**Returns**

The stacking power.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### getPriorTotalStakesForDate

Determine the prior number of stake for an unlocking date as of a block number.

```solidity
function getPriorTotalStakesForDate(uint256 date, uint256 blockNumber) public view
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
        public
        view
        returns (uint96)
    {
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
```
</details>

---    

> ### getPriorVotes

⤾ overrides [IStaking.getPriorVotes](IStaking.md#getpriorvotes)

Determine the prior number of votes for a delegatee as of a block number.
Iterate through checkpoints adding up voting power.

```solidity
function getPriorVotes(address account, uint256 blockNumber, uint256 date) public view
returns(votes uint96)
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
    ) public view returns (uint96 votes) {
        /// @dev If date is not an exact break point, start weight computation from the previous break point (alternative would be the next).
        uint256 start = timestampToLockDate(date);
        uint256 end = start + MAX_DURATION;

        /// @dev Max 78 iterations.
        for (uint256 i = start; i <= end; i += TWO_WEEKS) {
            votes = add96(
                votes,
                _totalPowerByDateForDelegatee(account, i, start, blockNumber),
                "WS09"
            ); // overflow - total VP
        }
    }
```
</details>

---    

> ### _totalPowerByDateForDelegatee

Compute the voting power for a specific date.
Power = stake * weight

```solidity
function _totalPowerByDateForDelegatee(address account, uint256 date, uint256 startDate, uint256 blockNumber) internal view
returns(power uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| date | uint256 | The staking date to compute the power for. | 
| startDate | uint256 | The date for which we need to know the power of the stake. | 
| blockNumber | uint256 | The block number, needed for checkpointing. | 

**Returns**

The stacking power.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### getPriorStakeByDateForDelegatee

Determine the prior number of stake for an account as of a block number.

```solidity
function getPriorStakeByDateForDelegatee(address account, uint256 date, uint256 blockNumber) public view
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
```
</details>

---    

> ### getPriorWeightedStake

⤾ overrides [IStaking.getPriorWeightedStake](IStaking.md#getpriorweightedstake)

Determine the prior weighted stake for an account as of a block number.
Iterate through checkpoints adding up voting power.

```solidity
function getPriorWeightedStake(address account, uint256 blockNumber, uint256 date) public view
returns(votes uint96)
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
```
</details>

---    

> ### weightedStakeByDate

Compute the voting power for a specific date.
Power = stake * weight
TODO: WeightedStaking::weightedStakeByDate should probably better
be internal instead of a public function.

```solidity
function weightedStakeByDate(address account, uint256 date, uint256 startDate, uint256 blockNumber) public view
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
```
</details>

---    

> ### _getPriorUserStakeByDate

Determine the prior number of stake for an account until a
		certain lock date as of a block number.

```solidity
function _getPriorUserStakeByDate(address account, uint256 date, uint256 blockNumber) internal view
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
```
</details>

---    

> ### getPriorVestingWeightedStake

⤾ overrides [IStaking.getPriorVestingWeightedStake](IStaking.md#getpriorvestingweightedstake)

Determine the prior weighted vested amount for an account as of a block number.
Iterate through checkpoints adding up voting power.

```solidity
function getPriorVestingWeightedStake(uint256 blockNumber, uint256 date) public view
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
function getPriorVestingWeightedStake(uint256 blockNumber, uint256 date)
        public
        view
        returns (uint96 votes)
    {
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
```
</details>

---    

> ### weightedVestingStakeByDate

Compute the voting power for a specific date.
Power = stake * weight
TODO: WeightedStaking::weightedVestingStakeByDate should probably better
be internal instead of a public function.

```solidity
function weightedVestingStakeByDate(uint256 date, uint256 startDate, uint256 blockNumber) public view
returns(power uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The staking date to compute the power for. | 
| startDate | uint256 | The date for which we need to know the power of the stake. | 
| blockNumber | uint256 | The block number, needed for checkpointing. | 

**Returns**

The stacking power.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
function getPriorVestingStakeByDate(uint256 date, uint256 blockNumber)
        external
        view
        returns (uint96)
    {
        return _getPriorVestingStakeByDate(date, blockNumber);
    }
```
</details>

---    

> ### _getPriorVestingStakeByDate

Determine the prior number of vested stake for an account until a
		certain lock date as of a block number.

```solidity
function _getPriorVestingStakeByDate(uint256 date, uint256 blockNumber) internal view
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
function _getPriorVestingStakeByDate(uint256 date, uint256 blockNumber)
        internal
        view
        returns (uint96)
    {
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
```
</details>

---    

> ### _getCurrentBlockNumber

Determine the current Block Number

```solidity
function _getCurrentBlockNumber() internal view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getCurrentBlockNumber() internal view returns (uint256) {
        return block.number;
    }
```
</details>

---    

> ### computeWeightByDate

Compute the weight for a specific date.

```solidity
function computeWeightByDate(uint256 date, uint256 startDate) public pure
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
function computeWeightByDate(uint256 date, uint256 startDate)
        public
        pure
        returns (uint96 weight)
    {
        require(date >= startDate, "WS18"); // date < startDate
        uint256 remainingTime = (date - startDate);
        require(MAX_DURATION >= remainingTime, "WS19"); // remaining time < max duration
        /// @dev x = max days - remaining days
        uint96 x = uint96(MAX_DURATION - remainingTime) / (1 days);
        /// @dev w = (m^2 - x^2)/m^2 +1 (multiplied by the weight factor)
        weight = add96(
            WEIGHT_FACTOR,
            mul96(
                MAX_VOTING_WEIGHT * WEIGHT_FACTOR,
                sub96(
                    MAX_DURATION_POW_2,
                    x * x,
                    "WS20" /* weight underflow */
                ),
                "WS21" /* weight mul overflow */
            ) / MAX_DURATION_POW_2,
            "WS22" /* overflow on weight */
        );
    }
```
</details>

---    

> ### timestampToLockDate

⤾ overrides [IStaking.timestampToLockDate](IStaking.md#timestamptolockdate)

Unstaking is possible every 2 weeks only. This means, to
calculate the key value for the staking checkpoints, we need to
map the intended timestamp to the closest available date.

```solidity
function timestampToLockDate(uint256 timestamp) public view
returns(lockDate uint256)
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
```
</details>

---    

> ### _adjustDateForOrigin

origin vesting contracts have different dates
we need to add 2 weeks to get end of period (by default, it's start)

```solidity
function _adjustDateForOrigin(uint256 date) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The staking date to compute the power for. | 

**Returns**

unlocking date.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _adjustDateForOrigin(uint256 date) internal view returns (uint256) {
        uint256 adjustedDate = timestampToLockDate(date);
        //origin vesting contracts have different dates
        //we need to add 2 weeks to get end of period (by default, it's start)
        if (adjustedDate != date) {
            date = adjustedDate + TWO_WEEKS;
        }
        return date;
    }
```
</details>

---    

> ### addAdmin

Add account to ACL.

```solidity
function addAdmin(address _admin) public nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _admin | address | The addresses of the account to grant permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addAdmin(address _admin) public onlyOwner whenNotFrozen {
        admins[_admin] = true;
        emit AdminAdded(_admin);
    }
```
</details>

---    

> ### removeAdmin

Remove account from ACL.

```solidity
function removeAdmin(address _admin) public nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _admin | address | The addresses of the account to revoke permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeAdmin(address _admin) public onlyOwner whenNotFrozen {
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }
```
</details>

---    

> ### addPauser

Add account to pausers ACL.

```solidity
function addPauser(address _pauser) public nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _pauser | address | The address to grant pauser permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addPauser(address _pauser) public onlyOwner whenNotFrozen {
        pausers[_pauser] = true;
        emit PauserAddedOrRemoved(_pauser, true);
    }
```
</details>

---    

> ### removePauser

Add account to pausers ACL.

```solidity
function removePauser(address _pauser) public nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _pauser | address | The address to grant pauser permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removePauser(address _pauser) public onlyOwner whenNotFrozen {
        delete pausers[_pauser];
        emit PauserAddedOrRemoved(_pauser, false);
    }
```
</details>

---    

> ### pauseUnpause

Pause contract

```solidity
function pauseUnpause(bool _pause) public nonpayable onlyPauserOrOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _pause | bool | true when pausing, false when unpausing | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function pauseUnpause(bool _pause) public onlyPauserOrOwner whenNotFrozen {
        paused = _pause;
        emit StakingPaused(_pause);
    }
```
</details>

---    

> ### freezeUnfreeze

Freeze contract - disable all functions

```solidity
function freezeUnfreeze(bool _freeze) public nonpayable onlyPauserOrOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _freeze | bool | true when freezing, false when unfreezing | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function freezeUnfreeze(bool _freeze) public onlyPauserOrOwner {
        require(_freeze != frozen, "WS25");
        if (_freeze) pauseUnpause(true);
        frozen = _freeze;
        emit StakingFrozen(_freeze);
    }
```
</details>

---    

> ### addContractCodeHash

Add vesting contract's code hash to a map of code hashes.

```solidity
function addContractCodeHash(address vesting) public nonpayable onlyAuthorized whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vesting | address | The address of Vesting contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addContractCodeHash(address vesting) public onlyAuthorized whenNotFrozen {
        bytes32 codeHash = _getCodeHash(vesting);
        vestingCodeHashes[codeHash] = true;
        emit ContractCodeHashAdded(codeHash);
    }
```
</details>

---    

> ### removeContractCodeHash

Add vesting contract's code hash to a map of code hashes.

```solidity
function removeContractCodeHash(address vesting) public nonpayable onlyAuthorized whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vesting | address | The address of Vesting contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeContractCodeHash(address vesting) public onlyAuthorized whenNotFrozen {
        bytes32 codeHash = _getCodeHash(vesting);
        vestingCodeHashes[codeHash] = false;
        emit ContractCodeHashRemoved(codeHash);
    }
```
</details>

---    

> ### isVestingContract

⤾ overrides [IStaking.isVestingContract](IStaking.md#isvestingcontract)

Return flag whether the given address is a registered vesting contract.

```solidity
function isVestingContract(address stakerAddress) public view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| stakerAddress | address | the address to check | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### _getCodeHash

Return hash of contract code

```solidity
function _getCodeHash(address _contract) internal view
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _contract | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getCodeHash(address _contract) internal view returns (bytes32) {
        bytes32 codeHash;
        assembly {
            codeHash := extcodehash(_contract)
        }
        return codeHash;
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
* [Checkpoints](Checkpoints.md)
* [Constants](Constants.md)
* [Context](Context.md)
* [DevelopmentFund](DevelopmentFund.md)
* [DummyContract](DummyContract.md)
* [ECDSA](ECDSA.md)
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
* [FeeSharingLogic](FeeSharingLogic.md)
* [FeeSharingProxy](FeeSharingProxy.md)
* [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
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
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IFeeSharingProxy](IFeeSharingProxy.md)
* [IFourYearVesting](IFourYearVesting.md)
* [IFourYearVestingFactory](IFourYearVestingFactory.md)
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
* [Medianizer](Medianizer.md)
* [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
* [ModulesCommonEvents](ModulesCommonEvents.md)
* [MultiSigKeyHolders](MultiSigKeyHolders.md)
* [MultiSigWallet](MultiSigWallet.md)
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
* [ReentrancyGuard](ReentrancyGuard.md)
* [RewardHelper](RewardHelper.md)
* [RSKAddrValidator](RSKAddrValidator.md)
* [SafeERC20](SafeERC20.md)
* [SafeMath](SafeMath.md)
* [SafeMath96](SafeMath96.md)
* [setGet](setGet.md)
* [SignedSafeMath](SignedSafeMath.md)
* [SOV](SOV.md)
* [sovrynProtocol](sovrynProtocol.md)
* [Staking](Staking.md)
* [StakingInterface](StakingInterface.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingStorage](StakingStorage.md)
* [State](State.md)
* [SVR](SVR.md)
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
* [WeightedStaking](WeightedStaking.md)
* [WRBTC](WRBTC.md)
