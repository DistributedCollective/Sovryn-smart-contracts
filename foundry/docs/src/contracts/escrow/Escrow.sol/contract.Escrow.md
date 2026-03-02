# Escrow
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/escrow/Escrow.sol)

**Author:**
Franklin Richards - powerhousefrank@protonmail.com

You can use this contract for deposit of SOV tokens for some time and withdraw later.


## State Variables
### totalDeposit
The total tokens deposited.

*Used for calculating the reward % share of users related to total deposit.*


```solidity
uint256 public totalDeposit;
```


### releaseTime
The release timestamp for the tokens deposited.


```solidity
uint256 public releaseTime;
```


### depositLimit
The amount of token we would be accepting as deposit at max.


```solidity
uint256 public depositLimit;
```


### SOV
The SOV token contract.


```solidity
IERC20 public SOV;
```


### multisig
The multisig contract which handles the fund.


```solidity
address public multisig;
```


### userBalances
The user balances.


```solidity
mapping(address => uint256) userBalances;
```


### status

```solidity
Status public status;
```


## Functions
### onlyMultisig


```solidity
modifier onlyMultisig();
```

### checkStatus


```solidity
modifier checkStatus(Status s);
```

### checkRelease


```solidity
modifier checkRelease();
```

### constructor

Setup the required parameters.


```solidity
constructor(address _SOV, address _multisig, uint256 _releaseTime, uint256 _depositLimit) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_SOV`|`address`|The SOV token address.|
|`_multisig`|`address`|The owner of the tokens & contract.|
|`_releaseTime`|`uint256`|The token release time, zero if undecided.|
|`_depositLimit`|`uint256`|The amount of tokens we will be accepting.|


### init

This function is called once after deployment for starting the deposit action.

*Without calling this function, the contract will not start accepting tokens.*


```solidity
function init() external onlyMultisig checkStatus(Status.Deployed);
```

### updateMultisig

Update Multisig.


```solidity
function updateMultisig(address _newMultisig) external onlyMultisig;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newMultisig`|`address`|The new owner of the tokens & contract.|


### updateReleaseTimestamp

Update Release Timestamp.

*Zero is also a valid timestamp, if the release time is not scheduled yet.*


```solidity
function updateReleaseTimestamp(uint256 _newReleaseTime) external onlyMultisig;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newReleaseTime`|`uint256`|The new release timestamp for token release.|


### updateDepositLimit

Update Deposit Limit.

*IMPORTANT: Should not decrease than already deposited.*


```solidity
function updateDepositLimit(uint256 _newDepositLimit) external onlyMultisig;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newDepositLimit`|`uint256`|The new deposit limit.|


### depositTokens

Deposit tokens to this contract by User.

*The contract has to be approved by the user inorder for this function to work.
These tokens can be withdrawn/transferred during Holding State by the Multisig.*


```solidity
function depositTokens(uint256 _amount) external checkStatus(Status.Deposit);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amount`|`uint256`|the amount of tokens deposited.|


### changeStateToHolding

Update contract state to Holding.

*Once called, the contract no longer accepts any more deposits.
The multisig can now withdraw tokens from the contract after the contract is in Holding State.*


```solidity
function changeStateToHolding() external onlyMultisig checkStatus(Status.Deposit);
```

### withdrawTokensByMultisig

Withdraws all token from the contract by Multisig.

*Can only be called after the token state is changed to Holding.*


```solidity
function withdrawTokensByMultisig(address _receiverAddress) external onlyMultisig checkStatus(Status.Holding);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_receiverAddress`|`address`|The address where the tokens has to be transferred. Zero address if the withdraw is to be done in Multisig.|


### depositTokensByMultisig

Sending the amount to multisig.

Deposit tokens to this contract by the Multisig.

*The contract has to be approved by the multisig inorder for this function to work.
Once the token deposit is higher than the total deposits done, the contract state is changed to Withdraw.*


```solidity
function depositTokensByMultisig(uint256 _amount) external onlyMultisig checkStatus(Status.Holding);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amount`|`uint256`|the amount of tokens deposited.|


### withdrawTokens

Withdraws token from the contract by User.

*Only works after the contract state is in Withdraw.*


```solidity
function withdrawTokens() public checkRelease checkStatus(Status.Withdraw);
```

### getUserBalance

Function to read the current token balance of a particular user.


```solidity
function getUserBalance(address _addr) external view returns (uint256 balance);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`balance`|`uint256`|_addr The user address whose balance has to be checked.|


## Events
### EscrowActivated
Emitted when the contract deposit starts.


```solidity
event EscrowActivated();
```

### EscrowInHoldingState
Emitted when the contract is put in holding state. No new token deposit accepted by User.


```solidity
event EscrowInHoldingState();
```

### EscrowInWithdrawState
Emitted when the contract is put in withdraw state. Users can now withdraw tokens.


```solidity
event EscrowInWithdrawState();
```

### EscrowFundExpired
Emitted when the contract is expired after withdraws are made/total token transfer.


```solidity
event EscrowFundExpired();
```

### NewMultisig
Emitted when a new multisig is added to the contract.

*Can only be initiated by the current multisig.*


```solidity
event NewMultisig(address indexed _initiator, address indexed _newMultisig);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_newMultisig`|`address`|The address which is added as the new multisig.|

### TokenReleaseUpdated
Emitted when the release timestamp is updated.


```solidity
event TokenReleaseUpdated(address indexed _initiator, uint256 _releaseTimestamp);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_releaseTimestamp`|`uint256`|The updated release timestamp for the withdraw.|

### TokenDepositLimitUpdated
Emitted when the deposit limit is updated.


```solidity
event TokenDepositLimitUpdated(address indexed _initiator, uint256 _depositLimit);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_depositLimit`|`uint256`|The updated deposit limit.|

### TokenDeposit
Emitted when a new token deposit is done by User.


```solidity
event TokenDeposit(address indexed _initiator, uint256 _amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_amount`|`uint256`|The amount of token deposited.|

### DepositLimitReached
Emitted when we reach the token deposit limit.


```solidity
event DepositLimitReached();
```

### TokenWithdrawByMultisig
Emitted when a token withdraw is done by Multisig.


```solidity
event TokenWithdrawByMultisig(address indexed _initiator, uint256 _amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_amount`|`uint256`|The amount of token withdrawed.|

### TokenDepositByMultisig
Emitted when a new token deposit is done by Multisig.


```solidity
event TokenDepositByMultisig(address indexed _initiator, uint256 _amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_amount`|`uint256`|The amount of token deposited.|

### TokenWithdraw
Emitted when a token withdraw is done by User.


```solidity
event TokenWithdraw(address indexed _initiator, uint256 _amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initiator`|`address`|The address which initiated this event to be emitted.|
|`_amount`|`uint256`|The amount of token withdrawed.|

## Enums
### Status
The current contract status.

Deployed - Deployed the contract.

Deposit - Time to deposit in the contract by the users.

Holding - Deposit is closed and now the holding period starts.

Withdraw - Time to withdraw in the contract by the users.

Expired - The contract is now closed completely.


```solidity
enum Status {
    Deployed,
    Deposit,
    Holding,
    Withdraw,
    Expired
}
```

