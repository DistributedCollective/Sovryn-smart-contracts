# StakingVestingModule
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Staking/modules/StakingVestingModule.sol)

**Inherits:**
[IFunctionsList](/contracts/proxy/modules/interfaces/IFunctionsList.sol/interface.IFunctionsList.md), [StakingShared](/contracts/governance/Staking/modules/shared/StakingShared.sol/contract.StakingShared.md)

Implements interaction with Vesting functionality: vesting registry, vesting staking


## Functions
### setVestingRegistry

sets vesting registry

*_vestingRegistryProxy can be set to 0 as this function can be reused by
various other functionalities without the necessity of linking it with Vesting Registry*


```solidity
function setVestingRegistry(address _vestingRegistryProxy) external onlyOwner whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vestingRegistryProxy`|`address`|the address of vesting registry proxy contract|


### setVestingStakes

Sets the users' vesting stakes for a giving lock dates and writes checkpoints.


```solidity
function setVestingStakes(uint256[] calldata lockedDates, uint96[] calldata values)
    external
    onlyAuthorized
    whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lockedDates`|`uint256[]`|The arrays of lock dates.|
|`values`|`uint96[]`|The array of values to add to the staked balance. TODO: remove - it was designed as a disposable function to initialize vesting checkpoints|


### _setVestingStake

Sets the users' vesting stake for a giving lock date and writes a checkpoint.


```solidity
function _setVestingStake(uint256 lockedTS, uint96 value) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lockedTS`|`uint256`|The lock date.|
|`value`|`uint96`|The value to be set. TODO: remove - it was designed as a disposable function to initialize vesting checkpoints|


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
|`date`|`uint256`|The lock date. Adjusted to the next valid lock date, if necessary.|
|`blockNumber`|`uint256`|The block number to get the vote balance at.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The number of votes the account had as of the given block.|


### getPriorVestingWeightedStake

Weighted Vesting Stake computation for fee sharing ******************************

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


### weightedVestingStakeByDate

Compute the voting power for a specific date.
Power = stake * weight

*If date is not an exact break point, start weight computation from the previous break point (alternative would be the next).*

*Max 78 iterations.*


```solidity
function weightedVestingStakeByDate(uint256 date, uint256 startDate, uint256 blockNumber)
    external
    view
    returns (uint96 power);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`date`|`uint256`|The staking date to compute the power for. Adjusted to the previous valid lock date, if necessary.|
|`startDate`|`uint256`|The date for which we need to know the power of the stake. Adjusted to the previous valid lock date, if necessary.|
|`blockNumber`|`uint256`|The block number, needed for checkpointing.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`power`|`uint96`|The stacking power.|


### _weightedVestingStakeByDate

Compute the voting power for a specific date.
Power = stake * weight


```solidity
function _weightedVestingStakeByDate(uint256 date, uint256 startDate, uint256 blockNumber)
    internal
    view
    returns (uint96 power);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`date`|`uint256`|The staking date to compute the power for.|
|`startDate`|`uint256`|The date for which we need to know the power of the stake.|
|`blockNumber`|`uint256`|The block number, needed for checkpointing.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`power`|`uint96`|The stacking power.|


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
|`date`|`uint256`|The lock date. Adjusted to the next valid lock date, if necessary.|
|`blockNumber`|`uint256`|The block number to get the vote balance at.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The number of votes the account had as of the given block.|


### _getPriorVestingStakeByDate

Determine the prior number of vested stake for an account until a
certain lock date as of a block number.

*All functions of Staking contract use this internal version,
we need to modify public function in order to workaround issue with Vesting.withdrawTokens:
return 1 instead of 0 if message sender is a contract.*


```solidity
function _getPriorVestingStakeByDate(uint256 date, uint256 blockNumber) internal view returns (uint96);
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


### addContractCodeHash

Add vesting contract's code hash to a map of code hashes.

*First check most recent balance.*

*Next check implicit zero balance.*

*ceil, avoiding overflow.*

*We need it to use isVestingContract() function instead of isContract()*


```solidity
function addContractCodeHash(address vesting) external onlyAuthorized whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vesting`|`address`|The address of Vesting contract.|


### removeContractCodeHash

Remove vesting contract's code hash to a map of code hashes.

*We need it to use isVestingContract() function instead of isContract()*


```solidity
function removeContractCodeHash(address vesting) external onlyAuthorized whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vesting`|`address`|The address of Vesting contract.|


### isVestingContract

Return flag whether the given address is a registered vesting contract.


```solidity
function isVestingContract(address stakerAddress) external view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`stakerAddress`|`address`|the address to check|


### _getCodeHash

Return hash of contract code


```solidity
function _getCodeHash(address _contract) internal view returns (bytes32);
```

### getFunctionsList


```solidity
function getFunctionsList() external pure returns (bytes4[] memory);
```

## Events
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

