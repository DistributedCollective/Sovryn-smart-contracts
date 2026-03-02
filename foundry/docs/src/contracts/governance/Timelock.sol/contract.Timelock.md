# Timelock
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Timelock.sol)

**Inherits:**
[ErrorDecoder](/contracts/governance/ErrorDecoder.sol/contract.ErrorDecoder.md), [ITimelock](/contracts/governance/Timelock.sol/interface.ITimelock.md)

This contract lets Sovryn governance system set up its
own Time Lock instance to execute transactions proposed through the
GovernorAlpha contract instance.
The Timelock contract allows its admin (Sovryn governance on
GovernorAlpha contract) to add arbitrary function calls to a
queue. This contract can only execute a function call if the
function call has been in the queue for at least 3 hours.
Anytime the Timelock contract makes a function call, it must be the
case that the function call was first made public by having been publicly
added to the queue at least 3 hours prior.
The intention is to provide GovernorAlpha contract the functionality to
queue proposal actions. This would mean that any changes made by Sovryn
governance of any contract would necessarily come with at least an
advanced warning. This makes the Sovryn system follow a “time-delayed,
opt-out” upgrade pattern (rather than an “instant, forced” upgrade pattern).
Time-delaying admin actions gives users a chance to exit system if its
admins become malicious or compromised (or make a change that the users
do not like). Downside is that honest admins would be unable
to lock down functionality to protect users if a critical bug was found.
Delayed transactions reduce the amount of trust required by users of Sovryn
and the overall risk for contracts building on top of it, as GovernorAlpha.


## State Variables
### GRACE_PERIOD

```solidity
uint256 public constant GRACE_PERIOD = 14 days;
```


### MINIMUM_DELAY

```solidity
uint256 public constant MINIMUM_DELAY = 3 hours;
```


### MAXIMUM_DELAY

```solidity
uint256 public constant MAXIMUM_DELAY = 30 days;
```


### admin

```solidity
address public admin;
```


### pendingAdmin

```solidity
address public pendingAdmin;
```


### delay

```solidity
uint256 public delay;
```


### queuedTransactions

```solidity
mapping(bytes32 => bool) public queuedTransactions;
```


## Functions
### constructor

Function called on instance deployment of the contract.


```solidity
constructor(address admin_, uint256 delay_) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`admin_`|`address`|Governance contract address.|
|`delay_`|`uint256`|Time to wait for queued transactions to be executed.|


### function

Fallback function is to react to receiving value (rBTC).


```solidity
function() external payable;
```

### setDelay

Set a new delay when executing the contract calls.


```solidity
function setDelay(uint256 delay_) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`delay_`|`uint256`|The amount of time to wait until execution.|


### acceptAdmin

Accept a new admin for the timelock.


```solidity
function acceptAdmin() public;
```

### setPendingAdmin

Set a new pending admin for the timelock.


```solidity
function setPendingAdmin(address pendingAdmin_) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`pendingAdmin_`|`address`|The new pending admin address.|


### queueTransaction

Queue a new transaction from the governance contract.


```solidity
function queueTransaction(address target, uint256 value, string memory signature, bytes memory data, uint256 eta)
    public
    returns (bytes32);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`target`|`address`|The contract to call.|
|`value`|`uint256`|The amount to send in the transaction.|
|`signature`|`string`|The stanndard representation of the function called.|
|`data`|`bytes`|The ethereum transaction input data payload.|
|`eta`|`uint256`|Estimated Time of Accomplishment. The timestamp that the proposal will be available for execution, set once the vote succeeds.|


### cancelTransaction

Cancel a transaction.


```solidity
function cancelTransaction(address target, uint256 value, string memory signature, bytes memory data, uint256 eta)
    public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`target`|`address`|The contract to call.|
|`value`|`uint256`|The amount to send in the transaction.|
|`signature`|`string`|The stanndard representation of the function called.|
|`data`|`bytes`|The ethereum transaction input data payload.|
|`eta`|`uint256`|Estimated Time of Accomplishment. The timestamp that the proposal will be available for execution, set once the vote succeeds.|


### executeTransaction

Executes a previously queued transaction from the governance.


```solidity
function executeTransaction(address target, uint256 value, string memory signature, bytes memory data, uint256 eta)
    public
    payable
    returns (bytes memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`target`|`address`|The contract to call.|
|`value`|`uint256`|The amount to send in the transaction.|
|`signature`|`string`|The stanndard representation of the function called.|
|`data`|`bytes`|The ethereum transaction input data payload.|
|`eta`|`uint256`|Estimated Time of Accomplishment. The timestamp that the proposal will be available for execution, set once the vote succeeds.|


### getBlockTimestamp

A function used to get the current Block Timestamp.

*Timestamp of the current block in seconds since the epoch.
It is a Unix time stamp. So, it has the complete information about
the date, hours, minutes, and seconds (in UTC) when the block was
created.*


```solidity
function getBlockTimestamp() internal view returns (uint256);
```

## Events
### NewAdmin

```solidity
event NewAdmin(address indexed newAdmin);
```

### NewPendingAdmin

```solidity
event NewPendingAdmin(address indexed newPendingAdmin);
```

### NewDelay

```solidity
event NewDelay(uint256 indexed newDelay);
```

### CancelTransaction

```solidity
event CancelTransaction(
    bytes32 indexed txHash, address indexed target, uint256 value, string signature, bytes data, uint256 eta
);
```

### ExecuteTransaction

```solidity
event ExecuteTransaction(
    bytes32 indexed txHash, address indexed target, uint256 value, string signature, bytes data, uint256 eta
);
```

### QueueTransaction

```solidity
event QueueTransaction(
    bytes32 indexed txHash, address indexed target, uint256 value, string signature, bytes data, uint256 eta
);
```

