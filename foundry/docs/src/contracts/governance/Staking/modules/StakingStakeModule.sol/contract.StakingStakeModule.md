# StakingStakeModule
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Staking/modules/StakingStakeModule.sol)

**Inherits:**
[IFunctionsList](/contracts/proxy/modules/interfaces/IFunctionsList.sol/interface.IFunctionsList.md), [StakingShared](/contracts/governance/Staking/modules/shared/StakingShared.sol/contract.StakingShared.md), [CheckpointsShared](/contracts/governance/Staking/modules/shared/CheckpointsShared.sol/contract.CheckpointsShared.md), [ApprovalReceiver](/contracts/governance/ApprovalReceiver.sol/contract.ApprovalReceiver.md)

Implements staking functionality


## Functions
### stake

Stake the given amount for the given duration of time.


```solidity
function stake(uint96 amount, uint256 until, address stakeFor, address delegatee)
    external
    whenNotPaused
    whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint96`|The number of tokens to stake.|
|`until`|`uint256`|Timestamp indicating the date until which to stake.|
|`stakeFor`|`address`|The address to stake the tokens for or 0x0 if staking for oneself.|
|`delegatee`|`address`|The address of the delegatee or 0x0 if there is none.|


### stakeWithApproval

Stake the given amount for the given duration of time.

*This function will be invoked from receiveApproval*

*SOV.approveAndCall -> this.receiveApproval -> this.stakeWithApproval*


```solidity
function stakeWithApproval(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee)
    external
    onlyThisContract
    whenNotPaused
    whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sender`|`address`|The sender of SOV.approveAndCall|
|`amount`|`uint96`|The number of tokens to stake.|
|`until`|`uint256`|Timestamp indicating the date until which to stake.|
|`stakeFor`|`address`|The address to stake the tokens for or 0x0 if staking for oneself.|
|`delegatee`|`address`|The address of the delegatee or 0x0 if there is none.|


### _stake

Send sender's tokens to this contract and update its staked balance.


```solidity
function _stake(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee, bool timeAdjusted)
    internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sender`|`address`|The sender of the tokens.|
|`amount`|`uint96`|The number of tokens to send.|
|`until`|`uint256`|The date until which the tokens will be staked.|
|`stakeFor`|`address`|The beneficiary whose stake will be increased.|
|`delegatee`|`address`|The address of the delegatee or stakeFor if default 0x0.|
|`timeAdjusted`|`bool`|Whether fixing date to stacking periods or not.|


### _stakeOptionalTokenTransfer

Send sender's tokens to this contract and update its staked balance.


```solidity
function _stakeOptionalTokenTransfer(
    address sender,
    uint96 amount,
    uint256 until,
    address stakeFor,
    address delegatee,
    bool timeAdjusted,
    bool transferToken
) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sender`|`address`|The sender of the tokens.|
|`amount`|`uint96`|The number of tokens to send.|
|`until`|`uint256`|The date until which the tokens will be staked.|
|`stakeFor`|`address`|The beneficiary whose stake will be increased.|
|`delegatee`|`address`|The address of the delegatee or stakeFor if default 0x0.|
|`timeAdjusted`|`bool`|Whether fixing date to stacking periods or not.|
|`transferToken`|`bool`|Should transfer SOV - false for multiple iterations like in stakeBySchedule|


### extendStakingDuration

Extend the staking duration until the specified date.

*Stake for the sender if not specified otherwise.*

*Delegate for stakeFor if not specified otherwise.*

*Do not stake longer than the max duration.*

*Increase stake.*

*Update delegatee.*

*Decrease stake on previous balance for previous delegatee.*

*Add previousBalance to amount.*

*Increase stake.*


```solidity
function extendStakingDuration(uint256 previousLock, uint256 until) external whenNotPaused whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`previousLock`|`uint256`|The old unlocking timestamp.|
|`until`|`uint256`|The new unlocking timestamp in seconds.|


### _increaseStake

Send sender's tokens to this contract and update its staked balance.

*Do not exceed the max duration, no overflow possible.*

*Update checkpoints.*

*TODO James: Can reading stake at block.number -1 cause trouble with multiple tx in a block?*

*Delegate might change: if there is already a delegate set for the until date, it will remain the delegate for this position*


```solidity
function _increaseStake(address sender, uint96 amount, address stakeFor, uint256 until, bool transferToken) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sender`|`address`|The sender of the tokens.|
|`amount`|`uint96`|The number of tokens to send.|
|`stakeFor`|`address`|The beneficiary whose stake will be increased.|
|`until`|`uint256`|The date until which the tokens will be staked.|
|`transferToken`|`bool`|if false - token transfer should be handled separately|


### stakesBySchedule

*Retrieve the SOV tokens.*

*Increase staked balance.*

*Update checkpoints.*

*DO NOT USE this misspelled function. Use stakeBySchedule function instead.
This function cannot be deprecated while we have non-upgradeable vesting contracts.*


```solidity
function stakesBySchedule(
    uint256 amount,
    uint256 cliff,
    uint256 duration,
    uint256 intervalLength,
    address stakeFor,
    address delegatee
) external whenNotPaused whenNotFrozen;
```

### stakeBySchedule

Stake tokens according to the vesting schedule.


```solidity
function stakeBySchedule(
    uint256 amount,
    uint256 cliff,
    uint256 duration,
    uint256 intervalLength,
    address stakeFor,
    address delegatee
) external whenNotPaused whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|The amount of tokens to stake.|
|`cliff`|`uint256`|The time interval to the first withdraw.|
|`duration`|`uint256`|The staking duration.|
|`intervalLength`|`uint256`|The length of each staking interval when cliff passed.|
|`stakeFor`|`address`|The address to stake the tokens for or 0x0 if staking for oneself.|
|`delegatee`|`address`|The address of the delegatee or 0x0 if there is none.|


### _stakeBySchedule

Stake tokens according to the vesting schedule.


```solidity
function _stakeBySchedule(
    uint256 amount,
    uint256 cliff,
    uint256 duration,
    uint256 intervalLength,
    address stakeFor,
    address delegatee
) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|The amount of tokens to stake.|
|`cliff`|`uint256`|The time interval to the first withdraw.|
|`duration`|`uint256`|The staking duration.|
|`intervalLength`|`uint256`|The length of each staking interval when cliff passed.|
|`stakeFor`|`address`|The address to stake the tokens for or 0x0 if staking for oneself.|
|`delegatee`|`address`|The address of the delegatee or 0x0 if there is none.|


### balanceOf

Get the number of staked tokens held by the user account.

*Stake them until lock dates according to the vesting schedule.
Note: because staking is only possible in periods of 2 weeks,
the total duration might end up a bit shorter than specified
depending on the date of staking.*

*transferring total SOV amount before staking*

*stakedPerInterval might lose some dust on rounding. Add it to the first staking date.*

*Stake the rest in 4 week intervals.*

*Stakes for itself, delegates to the owner.*

*Iterate checkpoints adding up stakes.*


```solidity
function balanceOf(address account) external view returns (uint96 balance);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|The address of the account to get the balance of.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`balance`|`uint96`|The number of tokens held.|


### getCurrentStakedUntil

Get the current number of tokens staked for a day.


```solidity
function getCurrentStakedUntil(uint256 lockedTS) external view returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lockedTS`|`uint256`|The timestamp to get the staked tokens for.|


### getStakes

Get list of stakes for a user account.


```solidity
function getStakes(address account) external view returns (uint256[] memory dates, uint96[] memory stakes);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|The address to get stakes.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`dates`|`uint256[]`|The arrays of dates and stakes.|
|`stakes`|`uint96[]`||


### _getToken

Overrides default ApprovalReceiver._getToken function to
register SOV token on this contract.

*Calculate stakes.*

*We need to iterate from first possible stake date after deployment to the latest from current time.*

*We need to iterate from first possible stake date after deployment to the latest from current time.*


```solidity
function _getToken() internal view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The address of SOV token.|


### _getSelectors

Overrides default ApprovalReceiver._getSelectors function to
register stakeWithApproval selector on this contract.


```solidity
function _getSelectors() internal pure returns (bytes4[] memory);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes4[]`|The array of registered selectors on this contract.|


### timestampToLockDate

Unstaking is possible every 2 weeks only. This means, to
calculate the key value for the staking checkpoints, we need to
map the intended timestamp to the closest available date.


```solidity
function timestampToLockDate(uint256 timestamp) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`timestamp`|`uint256`|The unlocking timestamp.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The actual unlocking date (might be up to 2 weeks shorter than intended).|


### getFunctionsList


```solidity
function getFunctionsList() external pure returns (bytes4[] memory);
```

## Events
### TokensStaked
An event emitted when tokens get staked.


```solidity
event TokensStaked(address indexed staker, uint256 amount, uint256 lockedUntil, uint256 totalStaked);
```

### ExtendedStakingDuration
An event emitted when a staking period gets extended.


```solidity
event ExtendedStakingDuration(address indexed staker, uint256 previousDate, uint256 newDate, uint256 amountStaked);
```

