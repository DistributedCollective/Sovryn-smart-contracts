# LockedSOV
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/locked/LockedSOV.sol)

**Inherits:**
[ILockedSOV](/contracts/locked/ILockedSOV.sol/interface.ILockedSOV.md)

**Author:**
Franklin Richards - powerhousefrank@protonmail.com

This contract is used to receive reward from other contracts, Create Vesting and Stake Tokens.


## State Variables
### MAX_BASIS_POINT

```solidity
uint256 public constant MAX_BASIS_POINT = 10000;
```


### MAX_DURATION

```solidity
uint256 public constant MAX_DURATION = 37;
```


### migration
True if the migration to a new Locked SOV Contract has started.


```solidity
bool public migration;
```


### cliff
The cliff is the time period after which the tokens begin to unlock.


```solidity
uint256 public cliff;
```


### duration
The duration is the time period after all tokens will have been unlocked.


```solidity
uint256 public duration;
```


### SOV
The SOV token contract.


```solidity
IERC20 public SOV;
```


### vestingRegistry
The Vesting registry contract.


```solidity
VestingRegistry public vestingRegistry;
```


### newLockedSOV
The New (Future) Locked SOV.


```solidity
ILockedSOV public newLockedSOV;
```


### lockedBalances
The locked user balances.


```solidity
mapping(address => uint256) private lockedBalances;
```


### unlockedBalances
The unlocked user balances.


```solidity
mapping(address => uint256) private unlockedBalances;
```


### isAdmin
The contracts/wallets with admin power.


```solidity
mapping(address => bool) private isAdmin;
```


## Functions
### onlyAdmin


```solidity
modifier onlyAdmin();
```

### migrationAllowed


```solidity
modifier migrationAllowed();
```

### constructor

Setup the required parameters.


```solidity
constructor(address _SOV, address _vestingRegistry, uint256 _cliff, uint256 _duration, address[] memory _admins)
    public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_SOV`|`address`|The SOV Token Address.|
|`_vestingRegistry`|`address`|The Vesting Registry Address.|
|`_cliff`|`uint256`|The time period after which the tokens begin to unlock.|
|`_duration`|`uint256`|The time period after all tokens will have been unlocked.|
|`_admins`|`address[]`|The list of Admins to be added.|


### addAdmin

The function to add a new admin.

*Only callable by an Admin.*


```solidity
function addAdmin(address _newAdmin) public onlyAdmin;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newAdmin`|`address`|The address of the new admin.|


### removeAdmin

The function to remove an admin.

*Only callable by an Admin.*


```solidity
function removeAdmin(address _adminToRemove) public onlyAdmin;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_adminToRemove`|`address`|The address of the admin which should be removed.|


### changeRegistryCliffAndDuration

The function to update the Vesting Registry, Duration and Cliff.

*IMPORTANT 1: You have to change Vesting Registry if you want to change Duration and/or Cliff.
IMPORTANT 2: `_cliff` and `_duration` is multiplied by 4 weeks in this function.*


```solidity
function changeRegistryCliffAndDuration(address _vestingRegistry, uint256 _cliff, uint256 _duration)
    external
    onlyAdmin;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vestingRegistry`|`address`|The Vesting Registry Address.|
|`_cliff`|`uint256`|The time period after which the tokens begin to unlock.|
|`_duration`|`uint256`|The time period after all tokens will have been unlocked.|


### deposit

If duration is also zero, then it is similar to Unlocked SOV.

Adds SOV to the user balance (Locked and Unlocked Balance based on `_basisPoint`).


```solidity
function deposit(address _userAddress, uint256 _sovAmount, uint256 _basisPoint) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_userAddress`|`address`|The user whose locked balance has to be updated with `_sovAmount`.|
|`_sovAmount`|`uint256`|The amount of SOV to be added to the locked and/or unlocked balance.|
|`_basisPoint`|`uint256`|The % (in Basis Point)which determines how much will be unlocked immediately.|


### depositSOV

Adds SOV to the locked balance of a user.

*This is here because there are dependency with other contracts.*


```solidity
function depositSOV(address _userAddress, uint256 _sovAmount) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_userAddress`|`address`|The user whose locked balance has to be updated with _sovAmount.|
|`_sovAmount`|`uint256`|The amount of SOV to be added to the locked balance.|


### _deposit


```solidity
function _deposit(address _userAddress, uint256 _sovAmount, uint256 _basisPoint) private;
```

### withdraw

A function to withdraw the unlocked balance.


```solidity
function withdraw(address _receiverAddress) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_receiverAddress`|`address`|If specified, the unlocked balance will go to this address, else to msg.sender.|


### _withdraw


```solidity
function _withdraw(address _sender, address _receiverAddress) private;
```

### createVestingAndStake

Creates vesting if not already created and Stakes tokens for a user.

*Only use this function if the `duration` is small.*


```solidity
function createVestingAndStake() public;
```

### _createVestingAndStake


```solidity
function _createVestingAndStake(address _sender) private;
```

### createVesting

Creates vesting contract (if it hasn't been created yet) for the calling user.


```solidity
function createVesting() public returns (address _vestingAddress);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_vestingAddress`|`address`|The New Vesting Contract Created.|


### stakeTokens

Stakes tokens for a user who already have a vesting created.

*The user should already have a vesting created, else this function will throw error.*


```solidity
function stakeTokens() public;
```

### withdrawAndStakeTokens

Withdraws unlocked tokens and Stakes Locked tokens for a user who already have a vesting created.


```solidity
function withdrawAndStakeTokens(address _receiverAddress) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_receiverAddress`|`address`|If specified, the unlocked balance will go to this address, else to msg.sender.|


### withdrawAndStakeTokensFrom

Withdraws unlocked tokens and Stakes Locked tokens for a user who already have a vesting created.


```solidity
function withdrawAndStakeTokensFrom(address _userAddress) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_userAddress`|`address`|The address of user tokens will be withdrawn.|


### startMigration

Function to start the process of migration to new contract.


```solidity
function startMigration(address _newLockedSOV) external onlyAdmin;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newLockedSOV`|`address`|The new locked sov contract address.|


### transfer

Function to transfer the locked balance from this contract to new LockedSOV Contract.

*Address is not specified to discourage selling lockedSOV to other address.*


```solidity
function transfer() external migrationAllowed;
```

### _createVesting

Creates a Vesting Contract for a user.

*Does not do anything if Vesting Contract was already created.*


```solidity
function _createVesting(address _tokenOwner) internal returns (address _vestingAddress);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|The owner of the vesting contract.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_vestingAddress`|`address`|The Vesting Contract Address.|


### _getVesting

Here zero is given in place of amount, as amount is not really used in `vestingRegistry.createVesting()`.

Returns the Vesting Contract Address.


```solidity
function _getVesting(address _tokenOwner) internal view returns (address _vestingAddress);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|The owner of the vesting contract.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_vestingAddress`|`address`|The Vesting Contract Address.|


### _stakeTokens

Stakes the tokens in a particular vesting contract.


```solidity
function _stakeTokens(address _sender, address _vesting) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_sender`|`address`||
|`_vesting`|`address`|The Vesting Contract Address.|


### getLockedBalance

The function to get the locked balance of a user.


```solidity
function getLockedBalance(address _addr) external view returns (uint256 _balance);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_addr`|`address`|The address of the user to check the locked balance.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_balance`|`uint256`|The locked balance of the address `_addr`.|


### getUnlockedBalance

The function to get the unlocked balance of a user.


```solidity
function getUnlockedBalance(address _addr) external view returns (uint256 _balance);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_addr`|`address`|The address of the user to check the unlocked balance.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_balance`|`uint256`|The unlocked balance of the address `_addr`.|


### adminStatus

The function to check is an address is admin or not.


```solidity
function adminStatus(address _addr) external view returns (bool _status);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_addr`|`address`|The address of the user to check the admin status.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_status`|`bool`|True if admin, False otherwise.|


## Events
### AdminAdded
Emitted when a new Admin is added to the admin list.


```solidity
event AdminAdded(address indexed _initiator, address indexed _newAdmin);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_newAdmin`|`address`|The address of the new admin.|

### AdminRemoved
Emitted when an admin is removed from the admin list.


```solidity
event AdminRemoved(address indexed _initiator, address indexed _removedAdmin);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_removedAdmin`|`address`|The address of the removed admin.|

### RegistryCliffAndDurationUpdated
Emitted when Vesting Registry, Duration and/or Cliff is updated.


```solidity
event RegistryCliffAndDurationUpdated(
    address indexed _initiator, address indexed _vestingRegistry, uint256 _cliff, uint256 _duration
);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_vestingRegistry`|`address`|The Vesting Registry Contract.|
|`_cliff`|`uint256`|The time period after which the tokens begin to unlock.|
|`_duration`|`uint256`|The time period after all tokens will have been unlocked.|

### Deposited
Emitted when a new deposit is made.


```solidity
event Deposited(address indexed _initiator, address indexed _userAddress, uint256 _sovAmount, uint256 _basisPoint);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_userAddress`|`address`|The user to whose un/locked balance a new deposit was made.|
|`_sovAmount`|`uint256`|The amount of SOV to be added to the un/locked balance.|
|`_basisPoint`|`uint256`|The % (in Basis Point) which determines how much will be unlocked immediately.|

### Withdrawn
Emitted when a user withdraws the fund.


```solidity
event Withdrawn(address indexed _initiator, address indexed _userAddress, uint256 _sovAmount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_userAddress`|`address`|The user whose unlocked balance has to be withdrawn.|
|`_sovAmount`|`uint256`|The amount of SOV withdrawn from the unlocked balance.|

### VestingCreated
Emitted when a user creates a vesting for himself.


```solidity
event VestingCreated(address indexed _initiator, address indexed _userAddress, address indexed _vesting);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_userAddress`|`address`|The user whose unlocked balance has to be withdrawn.|
|`_vesting`|`address`|The Vesting Contract.|

### TokenStaked
Emitted when a user stakes tokens.


```solidity
event TokenStaked(address indexed _initiator, address indexed _vesting, uint256 _amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_vesting`|`address`|The Vesting Contract.|
|`_amount`|`uint256`|The amount of locked tokens staked by the user.|

### MigrationStarted
Emitted when an admin initiates a migration to new Locked SOV Contract.


```solidity
event MigrationStarted(address indexed _initiator, address indexed _newLockedSOV);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_newLockedSOV`|`address`|The address of the new Locked SOV Contract.|

### UserTransfered
Emitted when a user initiates the transfer to a new Locked SOV Contract.


```solidity
event UserTransfered(address indexed _initiator, uint256 _amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_amount`|`uint256`|The amount of locked tokens to transfer from this contract to the new one.|

