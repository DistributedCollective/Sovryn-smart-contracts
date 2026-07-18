# StakingAdminModule
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Staking/modules/StakingAdminModule.sol)

**Inherits:**
[IFunctionsList](/contracts/proxy/modules/interfaces/IFunctionsList.sol/interface.IFunctionsList.md), [StakingShared](/contracts/governance/Staking/modules/shared/StakingShared.sol/contract.StakingShared.md)

Implements administrative functionality pause, freeze and setting addresses and parameters
related to staking


## Functions
### addAdmin

Add account to Admins ACL.


```solidity
function addAdmin(address _admin) external onlyOwner whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_admin`|`address`|The addresses of the account to grant permissions.|


### removeAdmin

Remove account from Admins ACL.


```solidity
function removeAdmin(address _admin) external onlyOwner whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_admin`|`address`|The addresses of the account to revoke permissions.|


### addPauser

Add account to pausers ACL.


```solidity
function addPauser(address _pauser) external onlyOwner whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_pauser`|`address`|The address to grant pauser permissions.|


### removePauser

Remove account from pausers ACL.


```solidity
function removePauser(address _pauser) external onlyOwner whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_pauser`|`address`|The address to grant pauser permissions.|


### pauseUnpause

Pause/unpause contract


```solidity
function pauseUnpause(bool _pause) public onlyPauserOrOwner whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_pause`|`bool`|true when pausing, false when unpausing|


### freezeUnfreeze

Freeze contract - disable all functions

*When freezing, pause is always applied too. When unfreezing, the contract is left in paused stated.*


```solidity
function freezeUnfreeze(bool _freeze) external onlyPauserOrOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_freeze`|`bool`|true when freezing, false when unfreezing|


### setFeeSharing

Allow the owner to set a fee sharing proxy contract.
We need it for unstaking with slashing.


```solidity
function setFeeSharing(address _feeSharing) external onlyOwner whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_feeSharing`|`address`|The address of FeeSharingCollectorProxy contract.|


### setWeightScaling

Allow the owner to set weight scaling.
We need it for unstaking with slashing.


```solidity
function setWeightScaling(uint96 _weightScaling) external onlyOwner whenNotFrozen;
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
function setNewStakingContract(address _newStakingContract) external onlyOwner whenNotFrozen;
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
function migrateToNewStakingContract() external whenNotFrozen;
```

### getFunctionsList

*implementation:*

*Iterate over all possible lock dates from now until now + MAX_DURATION.*

*Read the stake & delegate of the msg.sender*

*If stake > 0, stake it at the new contract until the lock date with the current delegate.*


```solidity
function getFunctionsList() external pure returns (bytes4[] memory);
```

## Events
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

