# StakingWithdrawModule
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Staking/modules/StakingWithdrawModule.sol)

**Inherits:**
[IFunctionsList](/contracts/proxy/modules/interfaces/IFunctionsList.sol/interface.IFunctionsList.md), [StakingShared](/contracts/governance/Staking/modules/shared/StakingShared.sol/contract.StakingShared.md), [CheckpointsShared](/contracts/governance/Staking/modules/shared/CheckpointsShared.sol/contract.CheckpointsShared.md)


## Functions
### withdraw

Withdraw the given amount of tokens if they are unlocked.

*If until is not a valid lock date, the next lock date after until is used.*


```solidity
function withdraw(uint96 amount, uint256 until, address receiver) external whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint96`|The number of tokens to withdraw.|
|`until`|`uint256`|The date until which the tokens were staked.|
|`receiver`|`address`|The receiver of the tokens. If not specified, send to the msg.sender|


### cancelTeamVesting

Governance withdraw vesting directly through staking contract.
This direct withdraw vesting solves the out of gas issue when there are too many iterations when withdrawing.
This function only allows cancelling vesting contract of the TeamVesting type.


```solidity
function cancelTeamVesting(address vesting, address receiver, uint256 startFrom)
    external
    onlyAuthorized
    whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vesting`|`address`|The vesting address.|
|`receiver`|`address`|The receiving address.|
|`startFrom`|`uint256`|The start value for the iterations.|


### _cancelTeamVesting

require the caller only for team vesting contract.

Withdraws tokens from the staking contract and forwards them
to an address specified by the token owner. Low level function.

*Once here the caller permission is taken for granted.*


```solidity
function _cancelTeamVesting(address _vesting, address _receiver, uint256 _startFrom)
    private
    returns (uint256 nextStartFrom, bool notCompleted);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vesting`|`address`|The vesting address.|
|`_receiver`|`address`|The receiving address.|
|`_startFrom`|`uint256`|The start value for the iterations. or just unlocked tokens (false).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`nextStartFrom`|`uint256`|is a timestamp to be used for next withdrawal.|
|`notCompleted`|`bool`|flag that indicates that the cancel team vesting is not completely done.|


### _withdraw

Send user' staked tokens to a receiver taking into account punishments.
Sovryn encourages long-term commitment and thinking. When/if you unstake before
the end of the staking period, a percentage of the original staking amount will
be slashed. This amount is also added to the reward pool and is distributed
between all other stakers.

*In the unlikely case that all tokens have been unlocked early,
allow to withdraw all of them, as long as the itrations less than maxVestingWithdrawIterations.*

*max iterations need to be decreased by 1, otherwise the iteration will always be surplus by 1*

*Withdraw for each unlocked position.*

*Read amount to withdraw.*

*do governance direct withdraw for team vesting*


```solidity
function _withdraw(uint96 amount, uint256 until, address receiver, bool isGovernance) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint96`|The number of tokens to withdraw.|
|`until`|`uint256`|The date until which the tokens were staked. Needs to be adjusted to the next valid lock date before calling this function.|
|`receiver`|`address`|The receiver of the tokens. If not specified, send to the msg.sender|
|`isGovernance`|`bool`|Whether all tokens (true) or just unlocked tokens (false).|


### _withdrawFromTeamVesting

Send user' staked tokens to a receiver.
This function is dedicated only for direct withdrawal from staking contract.
Currently only being used by cancelTeamVesting()

*Determine the receiver.*

*Update the checkpoints.*

*Early unstaking should be punished.*

*punishedAmount can be 0 if block.timestamp are very close to 'until'*

*Move punished amount to fee sharing.*

*Approve transfer here and let feeSharing do transfer and write checkpoint.*

*transferFrom*

*VestingConfig struct intended to avoid stack too deep issue, and it contains this properties:
address vestingAddress; // vesting contract address
uint256 startDate; //start date of vesting
uint256 endDate; // end date of vesting
uint256 cliff; // after this time period the tokens begin to unlock
uint256 duration; // after this period all the tokens will be unlocked
address tokenOwner; // owner of the vested tokens*


```solidity
function _withdrawFromTeamVesting(uint96 amount, uint256 until, address receiver, VestingConfig memory vestingConfig)
    internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint96`|The number of tokens to withdraw.|
|`until`|`uint256`|The date until which the tokens were staked.|
|`receiver`|`address`|The receiver of the tokens. If not specified, send to the msg.sender.|
|`vestingConfig`|`VestingConfig`|The vesting config.|


### _withdrawNext

*Update the checkpoints.*

*transferFrom*


```solidity
function _withdrawNext(uint256 until, address receiver, bool isGovernance) internal;
```

### getWithdrawAmounts

Get available and punished amount for withdrawing.


```solidity
function getWithdrawAmounts(uint96 amount, uint256 until) external view returns (uint96, uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint96`|The number of tokens to withdraw.|
|`until`|`uint256`|The date until which the tokens were staked. Adjusted to the next valid lock date, if necessary.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|Amount to withraw and penalty amount|
|`<none>`|`uint96`||


### _getPunishedAmount

Get punished amount for withdrawing.


```solidity
function _getPunishedAmount(uint96 amount, uint256 until) internal view returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint96`|The number of tokens to withdraw.|
|`until`|`uint256`|The date until which the tokens were staked.|


### _validateWithdrawParams

Validate withdraw parameters.

*(10 - 1) * WEIGHT_FACTOR*


```solidity
function _validateWithdrawParams(address account, uint96 amount, uint256 until) internal view;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|Address to be validated.|
|`amount`|`uint96`|The number of tokens to withdraw.|
|`until`|`uint256`|The date until which the tokens were staked.|


### unlockAllTokens

Allow the owner to unlock all tokens in case the staking contract
is going to be replaced
Note: Not reversible on purpose. once unlocked, everything is unlocked.
The owner should not be able to just quickly unlock to withdraw his own
tokens and lock again.

*Last resort.*


```solidity
function unlockAllTokens() external onlyOwner whenNotFrozen;
```

### setMaxVestingWithdrawIterations

*set max withdraw iterations.*


```solidity
function setMaxVestingWithdrawIterations(uint256 newMaxIterations) external onlyAuthorized whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newMaxIterations`|`uint256`|new max iterations value.|


### governanceWithdrawVesting

Withdraw tokens for vesting contract.

*This function is dedicated only to support backward compatibility for sovryn ecosystem that has been implementing this staking contract.*

*Sovryn protocol will use the cancelTeamVesting function for the withdrawal moving forward.
https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/4bbfe5bd0311ca71e4ef0e3af810d3791d8e4061/contracts/governance/Staking/modules/StakingWithdrawModule.sol#L78*


```solidity
function governanceWithdrawVesting(address vesting, address receiver) public onlyAuthorized whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vesting`|`address`|The address of Vesting contract.|
|`receiver`|`address`|The receiver of the tokens. If not specified, send to the msg.sender|


### governanceWithdraw

The withdrawal is limited to certain iterations (set in maxVestingWithdrawIterations), so in order to withdraw all, we need to iterate until it is fully withdrawn.
notCompleted is the flag whether the withdrawal is fully withdrawn or not.
As long as the notCompleted is true, we will keep the iteration using the nextStartFrom.

Withdraw the given amount of tokens.

*Can be invoked only by whitelisted contract passed to governanceWithdrawVesting*


```solidity
function governanceWithdraw(uint96 amount, uint256 until, address receiver) external whenNotFrozen;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint96`|The number of tokens to withdraw.|
|`until`|`uint256`|The date until which the tokens were staked.|
|`receiver`|`address`|The receiver of the tokens. If not specified, send to the msg.sender|


### getFunctionsList


```solidity
function getFunctionsList() external pure returns (bytes4[] memory);
```

## Events
### MaxVestingWithdrawIterationsUpdated

```solidity
event MaxVestingWithdrawIterationsUpdated(uint256 oldMaxIterations, uint256 newMaxIterations);
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

## Structs
### VestingConfig
*Struct for direct withdraw function -- to avoid stack too deep issue*


```solidity
struct VestingConfig {
    address vestingAddress;
    uint256 startDate;
    uint256 endDate;
    uint256 cliff;
    uint256 duration;
    address tokenOwner;
}
```

