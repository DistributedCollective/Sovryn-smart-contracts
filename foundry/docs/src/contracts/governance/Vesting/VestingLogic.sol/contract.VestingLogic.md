# VestingLogic
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/VestingLogic.sol)

**Inherits:**
[IVesting](/contracts/governance/Vesting/IVesting.sol/interface.IVesting.md), [VestingStorage](/contracts/governance/Vesting/VestingStorage.sol/contract.VestingStorage.md), [ApprovalReceiver](/contracts/governance/ApprovalReceiver.sol/contract.ApprovalReceiver.md)

Staking, delegating and withdrawal functionality.

*Deployed by a VestingFactory contract.*


## Functions
### onlyOwners

*Throws if called by any account other than the token owner or the contract owner.*


```solidity
modifier onlyOwners();
```

### onlyTokenOwner

*Throws if called by any account other than the token owner.*


```solidity
modifier onlyTokenOwner();
```

### stakeTokens

Stakes tokens according to the vesting schedule.


```solidity
function stakeTokens(uint256 _amount) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amount`|`uint256`|The amount of tokens to stake.|


### stakeTokensWithApproval

Stakes tokens according to the vesting schedule.

*This function will be invoked from receiveApproval.*

*SOV.approveAndCall -> this.receiveApproval -> this.stakeTokensWithApproval*


```solidity
function stakeTokensWithApproval(address _sender, uint256 _amount) public onlyThisContract;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_sender`|`address`|The sender of SOV.approveAndCall|
|`_amount`|`uint256`|The amount of tokens to stake.|


### _stakeTokens

Stakes tokens according to the vesting schedule. Low level function.

*Once here the allowance of tokens is taken for granted.*


```solidity
function _stakeTokens(address _sender, uint256 _amount) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_sender`|`address`|The sender of tokens to stake.|
|`_amount`|`uint256`|The amount of tokens to stake.|


### delegate

Delegate votes from `msg.sender` which are locked until lockDate
to `delegatee`.

*Maybe better to allow staking unil the cliff was reached.*

*Transfer the tokens to this contract.*

*Allow the staking contract to access them.*


```solidity
function delegate(address _delegatee) public onlyTokenOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_delegatee`|`address`|The address to delegate votes to.|


### withdrawTokens

Withdraws unlocked tokens from the staking contract and
forwards them to an address specified by the token owner.

*Withdraw for each unlocked position.*

*Don't change FOUR_WEEKS to TWO_WEEKS, a lot of vestings already deployed with FOUR_WEEKS
workaround found, but it doesn't work with TWO_WEEKS*


```solidity
function withdrawTokens(address receiver) public onlyOwners;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|The receiving address.|


### withdrawTokensStartingFrom

Withdraws unlocked tokens partially (based on the max withdraw iteration that has been set) from the staking contract and
forwards them to an address specified by the token owner.


```solidity
function withdrawTokensStartingFrom(address receiver, uint256 startFrom, uint256 maxWithdrawIterations)
    public
    onlyOwners;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|The receiving address.|
|`startFrom`|`uint256`|The start value for the iterations.|
|`maxWithdrawIterations`|`uint256`|max withdrawal iteration to work around block gas limit issue.|


### _withdrawTokens

Withdraws tokens from the staking contract and forwards them
to an address specified by the token owner. Low level function.

*Once here the caller permission is taken for granted.*


```solidity
function _withdrawTokens(address receiver, uint256 startFrom, uint256 endAt) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|The receiving address.|
|`startFrom`|`uint256`|start withdrawal from date.|
|`endAt`|`uint256`|end time for regular withdrawal or just unlocked tokens (false).|


### collectDividends

Collect dividends from fee sharing proxy.

*Usually we just need to iterate over the possible dates until now.*

*Withdraw for each unlocked position.*

*Don't change FOUR_WEEKS to TWO_WEEKS, a lot of vestings already deployed with FOUR_WEEKS
workaround found, but it doesn't work with TWO_WEEKS*

*Read amount to withdraw.*

*Withdraw if > 0*


```solidity
function collectDividends(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver) public onlyOwners;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_loanPoolToken`|`address`|The loan pool token address.|
|`_maxCheckpoints`|`uint32`|Maximum number of checkpoints to be processed.|
|`_receiver`|`address`|The receiver of tokens or msg.sender|


### migrateToNewStakingContract

Allows the owners to migrate the positions
to a new staking contract.

*Invokes the fee sharing proxy.*


```solidity
function migrateToNewStakingContract() public onlyOwners;
```

### _getToken

Overrides default ApprovalReceiver._getToken function to
register SOV token on this contract.


```solidity
function _getToken() internal view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The address of SOV token.|


### _getSelectors

Overrides default ApprovalReceiver._getSelectors function to
register stakeTokensWithApproval selector on this contract.


```solidity
function _getSelectors() internal pure returns (bytes4[] memory);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes4[]`|The array of registered selectors on this contract.|


### _timestampToLockDate


```solidity
function _timestampToLockDate(uint256 timestamp) internal view returns (uint256 lockDate);
```

## Events
### TokensStaked

```solidity
event TokensStaked(address indexed caller, uint256 amount);
```

### VotesDelegated

```solidity
event VotesDelegated(address indexed caller, address delegatee);
```

### TokensWithdrawn

```solidity
event TokensWithdrawn(address indexed caller, address receiver, uint256 startFrom, uint256 end);
```

### DividendsCollected

```solidity
event DividendsCollected(address indexed caller, address loanPoolToken, address receiver, uint32 maxCheckpoints);
```

### MigratedToNewStakingContract

```solidity
event MigratedToNewStakingContract(address indexed caller, address newStakingContract);
```

