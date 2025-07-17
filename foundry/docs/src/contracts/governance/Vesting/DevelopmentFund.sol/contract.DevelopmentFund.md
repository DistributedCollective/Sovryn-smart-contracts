# DevelopmentFund
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/DevelopmentFund.sol)

**Author:**
Franklin Richards

You can use this contract for timed token release from Dev Fund.


## State Variables
### SOV
The SOV token contract.


```solidity
IERC20 public SOV;
```


### status

```solidity
Status public status;
```


### lockedTokenOwner
The owner of the locked tokens (usually Governance).


```solidity
address public lockedTokenOwner;
```


### unlockedTokenOwner
The owner of the unlocked tokens (usually MultiSig).


```solidity
address public unlockedTokenOwner;
```


### safeVault
The emergency transfer wallet/contract.


```solidity
address public safeVault;
```


### newLockedTokenOwner
The new locked token owner waiting to be approved.


```solidity
address public newLockedTokenOwner;
```


### lastReleaseTime
The last token release timestamp or the time of contract creation.


```solidity
uint256 public lastReleaseTime;
```


### releaseDuration
The release duration array in seconds.


```solidity
uint256[] public releaseDuration;
```


### releaseTokenAmount
The release token amount.


```solidity
uint256[] public releaseTokenAmount;
```


## Functions
### onlyLockedTokenOwner


```solidity
modifier onlyLockedTokenOwner();
```

### onlyUnlockedTokenOwner


```solidity
modifier onlyUnlockedTokenOwner();
```

### checkStatus


```solidity
modifier checkStatus(Status s);
```

### constructor

Setup the required parameters.

*Initial release schedule should be verified, error will result in either redeployment or calling changeTokenReleaseSchedule() after init() along with token transfer.*


```solidity
constructor(
    address _SOV,
    address _lockedTokenOwner,
    address _safeVault,
    address _unlockedTokenOwner,
    uint256 _lastReleaseTime,
    uint256[] memory _releaseDuration,
    uint256[] memory _releaseTokenAmount
) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_SOV`|`address`|The SOV token address.|
|`_lockedTokenOwner`|`address`|The owner of the locked tokens & contract.|
|`_safeVault`|`address`|The emergency wallet/contract to transfer token.|
|`_unlockedTokenOwner`|`address`|The owner of the unlocked tokens.|
|`_lastReleaseTime`|`uint256`|If the last release time is to be changed, zero if no change required.|
|`_releaseDuration`|`uint256[]`|The time duration between each release calculated from `lastReleaseTime` in seconds.|
|`_releaseTokenAmount`|`uint256[]`|The amount of token to be released in each duration/interval.|


### init

If last release time passed is zero, then current time stamp will be used as the last release time.
Checking if the schedule duration and token allocation length matches.
Finally we update the token release schedule.

This function is called once after deployment for token transfer based on schedule.

*Without calling this function, the contract will not work.*


```solidity
function init() public checkStatus(Status.Deployed);
```

### updateLockedTokenOwner

Getting the current release schedule total token amount.

Update Locked Token Owner.


```solidity
function updateLockedTokenOwner(address _newLockedTokenOwner) public onlyLockedTokenOwner checkStatus(Status.Active);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newLockedTokenOwner`|`address`|The owner of the locked tokens & contract.|


### approveLockedTokenOwner

Approve Locked Token Owner.

*This approval is an added security to avoid development fund takeover by a compromised locked token owner.*


```solidity
function approveLockedTokenOwner() public onlyUnlockedTokenOwner checkStatus(Status.Active);
```

### updateUnlockedTokenOwner

Update Unlocked Token Owner.


```solidity
function updateUnlockedTokenOwner(address _newUnlockedTokenOwner)
    public
    onlyLockedTokenOwner
    checkStatus(Status.Active);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newUnlockedTokenOwner`|`address`|The new unlocked token owner.|


### depositTokens

Deposit tokens to this contract.

*These tokens can be withdrawn/transferred any time by the lockedTokenOwner.*


```solidity
function depositTokens(uint256 _amount) public checkStatus(Status.Active);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amount`|`uint256`|the amount of tokens deposited.|


### changeTokenReleaseSchedule

Change the Token release schedule. It creates a completely new schedule, and does not append on the previous one.

*_releaseDuration and _releaseTokenAmount should be specified in reverse order of release.*


```solidity
function changeTokenReleaseSchedule(
    uint256 _newLastReleaseTime,
    uint256[] memory _releaseDuration,
    uint256[] memory _releaseTokenAmount
) public onlyLockedTokenOwner checkStatus(Status.Active);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newLastReleaseTime`|`uint256`|If the last release time is to be changed, zero if no change required.|
|`_releaseDuration`|`uint256[]`|The time duration between each release calculated from `lastReleaseTime` in seconds.|
|`_releaseTokenAmount`|`uint256[]`|The amount of token to be released in each duration/interval.|


### transferTokensByUnlockedTokenOwner

Checking if the schedule duration and token allocation length matches.
If the last release time has to be changed, then you can pass a new one here.
Or else, the duration of release will be calculated based on this timestamp.
Even a future timestamp can be mentioned here.
Checking if the contract have enough token balance for the release.
Getting the current token balance of the contract.
If the token balance is not sufficient, then we transfer the change to contract.
If there are more tokens than required, send the extra tokens back.
Finally we update the token release schedule.

Transfers all of the remaining tokens in an emergency situation.

*This could be called when governance or development fund might be compromised.*


```solidity
function transferTokensByUnlockedTokenOwner() public onlyUnlockedTokenOwner checkStatus(Status.Active);
```

### withdrawTokensByUnlockedTokenOwner

Withdraws all unlocked/released token.


```solidity
function withdrawTokensByUnlockedTokenOwner(uint256 _amount) public onlyUnlockedTokenOwner checkStatus(Status.Active);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amount`|`uint256`|The amount to be withdrawn.|


### transferTokensByLockedTokenOwner

To know how many elements to be removed from the release schedule.
To know the total amount to be transferred.
Better to use memory than storage.
Also checks if there are any elements in the release schedule.
Getting the amount of tokens, the number of releases and calculating the total duration.
This will be the last case, if correct amount is passed.
Checking to see if atleast a single schedule was reached or not.
If locked token owner tries to send a higher amount that schedule
Now clearing up the release schedule.
Updating the last release time.
Sending the amount to unlocked token owner.

Transfers all of the remaining tokens by the owner maybe for an upgrade.

*This could be called when the current development fund has to be upgraded.*


```solidity
function transferTokensByLockedTokenOwner(address _receiver) public onlyLockedTokenOwner checkStatus(Status.Active);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_receiver`|`address`|The address which receives this token transfer.|


### getReleaseDuration

Function to read the current token release duration.


```solidity
function getReleaseDuration() public view returns (uint256[] memory _releaseTokenDuration);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_releaseTokenDuration`|`uint256[]`|_currentReleaseDuration The current release duration.|


### getReleaseTokenAmount

Function to read the current token release amount.


```solidity
function getReleaseTokenAmount() public view returns (uint256[] memory _currentReleaseTokenAmount);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_currentReleaseTokenAmount`|`uint256[]`|The current release token amount.|


## Events
### DevelopmentFundActivated
Emitted when the contract is activated.


```solidity
event DevelopmentFundActivated();
```

### DevelopmentFundExpired
Emitted when the contract is expired due to total token transfer.


```solidity
event DevelopmentFundExpired();
```

### NewLockedOwnerAdded
Emitted when a new locked owner is added to the contract.

*Can only be initiated by the current locked owner.*


```solidity
event NewLockedOwnerAdded(address indexed _initiator, address indexed _newLockedOwner);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_newLockedOwner`|`address`|The address which is added as the new locked owner.|

### NewLockedOwnerApproved
Emitted when a new locked owner is approved to the contract.

*Can only be initiated by the current unlocked owner.*


```solidity
event NewLockedOwnerApproved(
    address indexed _initiator, address indexed _oldLockedOwner, address indexed _newLockedOwner
);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_oldLockedOwner`|`address`|The address of the previous locked owner.|
|`_newLockedOwner`|`address`|The address which is added as the new locked owner.|

### UnlockedOwnerUpdated
Emitted when a new unlocked owner is updated in the contract.

*Can only be initiated by the current locked owner.*


```solidity
event UnlockedOwnerUpdated(address indexed _initiator, address indexed _newUnlockedOwner);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_newUnlockedOwner`|`address`|The address which is updated as the new unlocked owner.|

### TokenDeposit
Emitted when a new token deposit is done.


```solidity
event TokenDeposit(address indexed _initiator, uint256 _amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_amount`|`uint256`|The total amount of token deposited.|

### TokenReleaseChanged
Emitted when a new release schedule is created.


```solidity
event TokenReleaseChanged(address indexed _initiator, uint256 _releaseCount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_releaseCount`|`uint256`|The number of releases planned in the schedule.|

### LockedTokenTransferByUnlockedOwner
Emitted when a unlocked owner transfers all the tokens to a safe vault.

*This is done in an emergency situation only to a predetermined wallet by locked token owner.*


```solidity
event LockedTokenTransferByUnlockedOwner(address indexed _initiator, address indexed _receiver, uint256 _amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_receiver`|`address`|The address which receives this token withdrawn.|
|`_amount`|`uint256`|The total amount of token transferred.|

### UnlockedTokenWithdrawalByUnlockedOwner
Emitted when a unlocked owner withdraws the released tokens.


```solidity
event UnlockedTokenWithdrawalByUnlockedOwner(address indexed _initiator, uint256 _amount, uint256 _releaseCount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_amount`|`uint256`|The total amount of token withdrawn.|
|`_releaseCount`|`uint256`|The total number of releases done based on duration.|

### LockedTokenTransferByLockedOwner
Emitted when a locked owner transfers all the tokens to a receiver.

*This is done only by locked token owner.*


```solidity
event LockedTokenTransferByLockedOwner(address indexed _initiator, address indexed _receiver, uint256 _amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_receiver`|`address`|The address which receives this token transfer.|
|`_amount`|`uint256`|The total amount of token transferred.|

## Enums
### Status
The current contract status.


```solidity
enum Status {
    Deployed,
    Active,
    Expired
}
```

