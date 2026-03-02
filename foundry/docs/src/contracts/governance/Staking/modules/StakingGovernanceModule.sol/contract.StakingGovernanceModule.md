# StakingGovernanceModule
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Staking/modules/StakingGovernanceModule.sol)

**Inherits:**
[IFunctionsList](/contracts/proxy/modules/interfaces/IFunctionsList.sol/interface.IFunctionsList.md), [StakingShared](/contracts/governance/Staking/modules/shared/StakingShared.sol/contract.StakingShared.md), [CheckpointsShared](/contracts/governance/Staking/modules/shared/CheckpointsShared.sol/contract.CheckpointsShared.md)

Implements voting power and delegation functionality


## Functions
### getPriorTotalVotingPower

TOTAL VOTING POWER COMPUTATION ***********************

Compute the total voting power at a given time.


```solidity
function getPriorTotalVotingPower(uint32 blockNumber, uint256 time) public view returns (uint96 totalVotingPower);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`blockNumber`|`uint32`|The block number, needed for checkpointing.|
|`time`|`uint256`|The timestamp for which to calculate the total voting power.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`totalVotingPower`|`uint96`|The total voting power at the given time.|


### _totalPowerByDate

Compute the voting power for a specific date.
Power = stake * weight

*Start the computation with the exact or previous unlocking date (voting weight remians the same until the next break point).*

*Max 78 iterations.*


```solidity
function _totalPowerByDate(uint256 date, uint256 startDate, uint256 blockNumber) internal view returns (uint96 power);
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


### getCurrentVotes

Get the current votes balance for a user account.

*weight is multiplied by some factor to allow decimals.
DELEGATED VOTING POWER COMPUTATION ************************

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
function getPriorVotes(address account, uint256 blockNumber, uint256 date) public view returns (uint96 votes);
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
|`votes`|`uint96`|The number of votes the delegatee had as of the given block.|


### _totalPowerByDateForDelegatee

Compute the voting power for a specific date.
Power = stake * weight

*If date is not an exact break point, start weight computation from the previous break point (alternative would be the next).*

*Max 78 iterations.*


```solidity
function _totalPowerByDateForDelegatee(address account, uint256 date, uint256 startDate, uint256 blockNumber)
    internal
    view
    returns (uint96 power);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|The address of the account to check.|
|`date`|`uint256`|The staking date to compute the power for.|
|`startDate`|`uint256`|The date for which we need to know the power of the stake.|
|`blockNumber`|`uint256`|The block number, needed for checkpointing.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`power`|`uint96`|The stacking power.|


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
|`date`|`uint256`|The staking date to compute the power for. Adjusted to the next valid lock date, if necessary.|
|`blockNumber`|`uint256`|The block number to get the vote balance at.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The number of votes the account had as of the given block.|


### _getPriorStakeByDateForDelegatee

Determine the prior number of stake for an account as of a block number.

*Block number must be a finalized block or else this function will
revert to prevent misinformation.*


```solidity
function _getPriorStakeByDateForDelegatee(address account, uint256 date, uint256 blockNumber)
    internal
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

*First check most recent balance.*

*Next check implicit zero balance.*

*ceil, avoiding overflow.
SHARED FUNCTIONS *********************

*Block number must be a finalized block or else this function will
revert to prevent misinformation.*


```solidity
function getPriorTotalStakesForDate(uint256 date, uint256 blockNumber) public view returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`date`|`uint256`|The date to check the stakes for. Adjusted to the next valid lock date, as necessary|
|`blockNumber`|`uint256`|The block number to get the vote balance at.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The total number of votes as of the given block.|


### _getPriorTotalStakesForDate

Determine the prior number of stake for an unlocking date as of a block number.

*Block number must be a finalized block or else this function will
revert to prevent misinformation.*


```solidity
function _getPriorTotalStakesForDate(uint256 date, uint256 blockNumber) internal view returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`date`|`uint256`|The date to check the stakes for.|
|`blockNumber`|`uint256`|The block number to get the vote balance at.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The total number of votes as of the given block.|


### _delegate

Set new delegatee. Move from user's current delegate to a new
delegatee the stake balance.

*Reverts if delegator balance or delegatee is not valid, unless the sender is a vesting contract.*


```solidity
function _delegate(address delegator, address delegatee, uint256 lockedTS) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`delegator`|`address`|The user address to move stake balance from its current delegatee.|
|`delegatee`|`address`|The new delegatee. The address to move stake balance to.|
|`lockedTS`|`uint256`|The lock date.|


### _delegateNext


```solidity
function _delegateNext(address delegator, address delegatee, uint256 lockedTS) internal;
```

### _moveDelegates

Move an amount of delegate stake from a source address to a
destination address.


```solidity
function _moveDelegates(address srcRep, address dstRep, uint96 amount, uint256 lockedTS) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`srcRep`|`address`|The address to get the staked amount from.|
|`dstRep`|`address`|The address to send the staked amount to.|
|`amount`|`uint96`|The staked amount to move.|
|`lockedTS`|`uint256`|The lock date.|


### _getChainId

Retrieve CHAIN_ID of the executing chain.
Chain identifier (chainID) introduced in EIP-155 protects transaction
included into one chain from being included into another chain.
Basically, chain identifier is an integer number being used in the
processes of signing transactions and verifying transaction signatures.

*As of version 0.5.12, Solidity includes an assembly function
chainid() that provides access to the new CHAINID opcode.
TODO: chainId is included in block. So you can get chain id like
block timestamp or block number: block.chainid;*


```solidity
function _getChainId() internal pure returns (uint256);
```

### delegate

Delegate votes from `msg.sender` which are locked until lockDate to `delegatee`.


```solidity
function delegate(address delegatee, uint256 lockDate) external whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`delegatee`|`address`|The address to delegate votes to.|
|`lockDate`|`uint256`|the date if the position to delegate.|


### getFunctionsList


```solidity
function getFunctionsList() external pure returns (bytes4[] memory);
```

