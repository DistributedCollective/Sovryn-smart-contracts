# FourYearVestingLogic
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/fouryear/FourYearVestingLogic.sol)

**Inherits:**
[IFourYearVesting](/contracts/governance/Vesting/fouryear/IFourYearVesting.sol/interface.IFourYearVesting.md), [FourYearVestingStorage](/contracts/governance/Vesting/fouryear/FourYearVestingStorage.sol/contract.FourYearVestingStorage.md), [ApprovalReceiver](/contracts/governance/ApprovalReceiver.sol/contract.ApprovalReceiver.md)

Staking, delegating and withdrawal functionality.

*Deployed by FourYearVestingFactory contract.*


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

### setMaxInterval

Sets the max interval.


```solidity
function setMaxInterval(uint256 _interval) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_interval`|`uint256`|Max interval for which tokens scheduled shall be staked.|


### stakeTokens

Stakes tokens according to the vesting schedule.


```solidity
function stakeTokens(uint256 _amount, uint256 _restartStakeSchedule)
    external
    returns (uint256 lastSchedule, uint256 remainingAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amount`|`uint256`|The amount of tokens to stake.|
|`_restartStakeSchedule`|`uint256`|The time from which staking schedule restarts. The issue is that we can only stake tokens for a max duration. Thus, we need to restart from the lastSchedule.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`lastSchedule`|`uint256`|The max duration for which tokens were staked.|
|`remainingAmount`|`uint256`|The amount outstanding - to be staked.|


### stakeTokensWithApproval

Stakes tokens according to the vesting schedule.

*This function will be invoked from receiveApproval.*

*SOV.approveAndCall -> this.receiveApproval -> this.stakeTokensWithApproval*


```solidity
function stakeTokensWithApproval(address _sender, uint256 _amount, uint256 _restartStakeSchedule)
    external
    onlyThisContract
    returns (uint256 lastSchedule, uint256 remainingAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_sender`|`address`|The sender of SOV.approveAndCall|
|`_amount`|`uint256`|The amount of tokens to stake.|
|`_restartStakeSchedule`|`uint256`|The time from which staking schedule restarts. The issue is that we can only stake tokens for a max duration. Thus, we need to restart from the lastSchedule.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`lastSchedule`|`uint256`|The max duration for which tokens were staked.|
|`remainingAmount`|`uint256`|The amount outstanding - to be staked.|


### delegate

Delegate votes from `msg.sender` which are locked until lockDate
to `delegatee`.


```solidity
function delegate(address _delegatee) external onlyTokenOwner;
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
function withdrawTokens(address receiver) external onlyTokenOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|The receiving address.|


### collectDividends

Collect dividends from fee sharing proxy.


```solidity
function collectDividends(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver) external onlyTokenOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_loanPoolToken`|`address`|The loan pool token address.|
|`_maxCheckpoints`|`uint32`|Maximum number of checkpoints to be processed.|
|`_receiver`|`address`|The receiver of tokens or msg.sender|


### changeTokenOwner

Change token owner - only vesting owner is allowed to change.

*Invokes the fee sharing proxy.*

*Modifies token owner. This must be followed by approval
from token owner.*


```solidity
function changeTokenOwner(address _newTokenOwner) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newTokenOwner`|`address`|Address of new token owner.|


### approveOwnershipTransfer

Approve token owner change - only token Owner.

*Token owner can only be modified
when both vesting owner and token owner have approved. This
function ascertains the approval of token owner.*


```solidity
function approveOwnershipTransfer() public onlyTokenOwner;
```

### setImpl

Set address of the implementation - only Token Owner.

*This function sets the new implementation address.
It must also be approved by the Vesting owner.*


```solidity
function setImpl(address _newImplementation) public onlyTokenOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newImplementation`|`address`|Address of the new implementation.|


### migrateToNewStakingContract

Allows the owners to migrate the positions
to a new staking contract.


```solidity
function migrateToNewStakingContract() external onlyOwners;
```

### extendStaking

Extends stakes(unlocked till timeDuration) for four year vesting contracts.

*Tokens are vested for 4 years. Since the max staking
period is 3 years and the tokens are unlocked only after the first year(timeDuration) is
passed, hence, we usually extend the duration of staking for all unlocked tokens for the first
year by 3 years. In some cases, the timeDuration can differ.*


```solidity
function extendStaking() external;
```

### _stakeTokens

Stakes tokens according to the vesting schedule. Low level function.

*Once here the allowance of tokens is taken for granted.*


```solidity
function _stakeTokens(address _sender, uint256 _amount, uint256 _restartStakeSchedule)
    internal
    returns (uint256 lastSchedule, uint256 remainingAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_sender`|`address`|The sender of tokens to stake.|
|`_amount`|`uint256`|The amount of tokens to stake.|
|`_restartStakeSchedule`|`uint256`|The time from which staking schedule restarts. The issue is that we can only stake tokens for a max duration. Thus, we need to restart from the lastSchedule.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`lastSchedule`|`uint256`|The max duration for which tokens were staked.|
|`remainingAmount`|`uint256`|The amount outstanding - to be staked.|


### _withdrawTokens

Withdraws tokens from the staking contract and forwards them
to an address specified by the token owner. Low level function.

*Transfer the tokens to this contract.*

*Allow the staking contract to access them.*

*Once here the caller permission is taken for granted.*


```solidity
function _withdrawTokens(address receiver, bool isGovernance) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|The receiving address.|
|`isGovernance`|`bool`|Whether all tokens (true) or just unlocked tokens (false).|


### _getToken

Overrides default ApprovalReceiver._getToken function to
register SOV token on this contract.

*Usually we just need to iterate over the possible dates until now.*

*In the unlikely case that all tokens have been unlocked early,
allow to withdraw all of them.*

*Withdraw for each unlocked position.*

*Don't change FOUR_WEEKS to TWO_WEEKS, a lot of vestings already deployed with FOUR_WEEKS
workaround found, but it doesn't work with TWO_WEEKS*

*For four year vesting, withdrawal of stakes for the first year is not allowed. These
stakes are extended for three years. In some cases the withdrawal may be allowed at a different
time and hence we use extendDurationFor.*

*Read amount to withdraw.*

*Withdraw if > 0*


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
event TokensWithdrawn(address indexed caller, address receiver);
```

### DividendsCollected

```solidity
event DividendsCollected(address indexed caller, address loanPoolToken, address receiver, uint32 maxCheckpoints);
```

### MigratedToNewStakingContract

```solidity
event MigratedToNewStakingContract(address indexed caller, address newStakingContract);
```

### TokenOwnerChanged

```solidity
event TokenOwnerChanged(address indexed newOwner, address indexed oldOwner);
```

