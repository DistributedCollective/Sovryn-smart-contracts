# WeightedStakingModule
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Staking/modules/WeightedStakingModule.sol)

**Inherits:**
[IFunctionsList](/contracts/proxy/modules/interfaces/IFunctionsList.sol/interface.IFunctionsList.md), [StakingShared](/contracts/governance/Staking/modules/shared/StakingShared.sol/contract.StakingShared.md), [CheckpointsShared](/contracts/governance/Staking/modules/shared/CheckpointsShared.sol/contract.CheckpointsShared.md)

Implements getters for weighted staking functionality


## Functions
### getPriorWeightedStake

User Weighted Stake computation for fee sharing ******************************

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
|`date`|`uint256`|The start date/timestamp from which to calculate the weighted stake.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`priorWeightedStake`|`uint96`|The weighted stake the account had as of the given block.|


### _getPriorWeightedStake


```solidity
function _getPriorWeightedStake(address account, uint256 blockNumber, uint256 date)
    internal
    view
    returns (uint96 priorWeightedStake);
```

### weightedStakeByDate

Compute the voting power for a specific date.
Power = stake * weight

*If date is not an exact break point, start weight computation from the previous break point (alternative would be the next).*

*Max 78 iterations.*


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
|`date`|`uint256`|The staking date to compute the power for. Adjusted to the previous valid lock date, if necessary.|
|`startDate`|`uint256`|The date for which we need to know the power of the stake. Adjusted to the previous valid lock date, if necessary.|
|`blockNumber`|`uint256`|The block number, needed for checkpointing.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`power`|`uint96`|The staking power.|


### _weightedStakeByDate

Compute the voting power for a specific date.
Power = stake * weight


```solidity
function _weightedStakeByDate(address account, uint256 date, uint256 startDate, uint256 blockNumber)
    internal
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
|`power`|`uint96`|The staking power.|


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


### getFunctionsList


```solidity
function getFunctionsList() external pure returns (bytes4[] memory);
```

