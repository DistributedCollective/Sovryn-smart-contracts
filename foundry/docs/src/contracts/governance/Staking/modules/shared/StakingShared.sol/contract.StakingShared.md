# StakingShared
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Staking/modules/shared/StakingShared.sol)

**Inherits:**
[StakingStorageShared](/contracts/governance/Staking/modules/shared/StakingStorageShared.sol/contract.StakingStorageShared.md), [SafeMath96](/contracts/governance/Staking/SafeMath96.sol/contract.SafeMath96.md)


## State Variables
### FOUR_WEEKS

```solidity
uint256 internal constant FOUR_WEEKS = 4 weeks;
```


## Functions
### whenNotPaused

*Throws if paused.*


```solidity
modifier whenNotPaused();
```

### onlyAuthorized

*Throws if called by any account other than the owner or admin.*


```solidity
modifier onlyAuthorized();
```

### onlyPauserOrOwner

*Throws if called by any account other than the owner or admin or pauser.
modifier onlyAuthorizedOrPauser() {
require(isOwner() || admins[msg.sender] || pausers[msg.sender], "unauthorized"); // WS02
_;
}*

*Throws if called by any account other than the owner or pauser.*


```solidity
modifier onlyPauserOrOwner();
```

### whenNotFrozen

Uncomment when needed

*Throws if called by any account other than pauser.*

*Throws if frozen.*


```solidity
modifier whenNotFrozen();
```

### constructor


```solidity
constructor() internal;
```

### _notSameBlockAsStakingCheckpoint


```solidity
function _notSameBlockAsStakingCheckpoint(uint256 lockDate, address stakeFor) internal view;
```

### _timestampToLockDate

Unstaking is possible every 2 weeks only. This means, to
calculate the key value for the staking checkpoints, we need to
map the intended timestamp to the closest available date.


```solidity
function _timestampToLockDate(uint256 timestamp) internal view returns (uint256 lockDate);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`timestamp`|`uint256`|The unlocking timestamp.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`lockDate`|`uint256`|The actual unlocking date (might be up to 2 weeks shorter than intended).|


### _getCurrentBlockNumber

Determine the current Block Number

*If staking timestamp does not match any of the unstaking dates
, set the lockDate to the closest one before the timestamp.
E.g. Passed timestamps lies 7 weeks after kickoff -> only stake for 6 weeks.*

*This is segregated from the _getPriorUserStakeByDate function to better test
advancing blocks functionality using Mock Contracts*


```solidity
function _getCurrentBlockNumber() internal view returns (uint256);
```

### _getPriorUserStakeByDate

Determine the prior number of stake for an account until a
certain lock date as of a block number.

*All functions of Staking contract use this internal version,
we need to modify public function in order to workaround issue with Vesting.withdrawTokens:
return 1 instead of 0 if message sender is a contract.*


```solidity
function _getPriorUserStakeByDate(address account, uint256 date, uint256 blockNumber) internal view returns (uint96);
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


### _adjustDateForOrigin

*First check most recent balance.*

*Next check implicit zero balance.*

*ceil, avoiding overflow.*

*origin vesting contracts have different dates
we need to add 2 weeks to get end of period (by default, it's start)*


```solidity
function _adjustDateForOrigin(uint256 date) internal view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`date`|`uint256`|The staking date to compute the power for.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|unlocking date.|


### _computeWeightByDate

Compute the weight for a specific date.


```solidity
function _computeWeightByDate(uint256 date, uint256 startDate) internal pure returns (uint96 weight);
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


### _isVestingContract

Return flag whether the given address is a registered vesting contract.

*x = max days - remaining days*

*w = (m^2 - x^2)/m^2 +1 (multiplied by the weight factor)*


```solidity
function _isVestingContract(address stakerAddress) internal view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`stakerAddress`|`address`|the address to check|


