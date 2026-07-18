# EscrowReward
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/escrow/EscrowReward.sol)

**Inherits:**
[Escrow](/contracts/escrow/Escrow.sol/contract.Escrow.md)

**Author:**
Franklin Richards - powerhousefrank@protonmail.com

Multisig can use this contract for depositing of Reward tokens based on the total token deposit.


## State Variables
### totalRewardDeposit
The total reward tokens deposited.

*Used for calculating the reward % share of users related to total deposit.*


```solidity
uint256 public totalRewardDeposit;
```


### lockedSOV
The Locked SOV contract.


```solidity
ILockedSOV public lockedSOV;
```


## Functions
### constructor

Setup the required parameters.


```solidity
constructor(address _lockedSOV, address _SOV, address _multisig, uint256 _releaseTime, uint256 _depositLimit)
    public
    Escrow(_SOV, _multisig, _releaseTime, _depositLimit);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_lockedSOV`|`address`|The Locked SOV Contract address.|
|`_SOV`|`address`|The SOV token address.|
|`_multisig`|`address`|The owner of the tokens & contract.|
|`_releaseTime`|`uint256`|The token release time, zero if undecided.|
|`_depositLimit`|`uint256`|The amount of tokens we will be accepting.|


### updateLockedSOV

Set the Locked SOV Contract Address if not already done.


```solidity
function updateLockedSOV(address _lockedSOV) external onlyMultisig;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_lockedSOV`|`address`|The Locked SOV Contract address.|


### depositRewardByMultisig

Deposit tokens to this contract by the Multisig.

*The contract has to be approved by the multisig inorder for this function to work.*


```solidity
function depositRewardByMultisig(uint256 _amount) external onlyMultisig;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amount`|`uint256`|the amount of tokens deposited.|


### withdrawTokensAndReward

Withdraws token and reward from the contract by User. Reward is gone to lockedSOV contract for future vesting.

*Only works after the contract state is in Withdraw.*


```solidity
function withdrawTokensAndReward() external checkRelease checkStatus(Status.Withdraw);
```

### getReward

Function to read the reward a particular user can get.


```solidity
function getReward(address _addr) external view returns (uint256 reward);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_addr`|`address`|The address of the user whose reward is to be read.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`reward`|`uint256`|The reward received by the user.|


## Events
### LockedSOVUpdated
Emitted when the Locked SOV Contract address is updated.


```solidity
event LockedSOVUpdated(address indexed _initiator, address indexed _lockedSOV);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_lockedSOV`|`address`|The address of the Locked SOV Contract.|

### RewardDepositByMultisig
Emitted when a new reward token deposit is done by Multisig.


```solidity
event RewardDepositByMultisig(address indexed _initiator, uint256 _amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_amount`|`uint256`|The amount of token deposited.|

### RewardTokenWithdraw
Emitted when a Reward token withdraw is done by User.


```solidity
event RewardTokenWithdraw(address indexed _initiator, uint256 _amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_amount`|`uint256`|The amount of token withdrawed.|

