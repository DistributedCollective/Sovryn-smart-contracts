# MultiSigWallet
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/multisig/MultiSigWallet.sol)

**Author:**
Stefan George - <stefan.george@consensys.net>


## State Variables
### MAX_OWNER_COUNT

```solidity
uint256 public constant MAX_OWNER_COUNT = 50;
```


### transactions

```solidity
mapping(uint256 => Transaction) public transactions;
```


### confirmations

```solidity
mapping(uint256 => mapping(address => bool)) public confirmations;
```


### isOwner

```solidity
mapping(address => bool) public isOwner;
```


### owners

```solidity
address[] public owners;
```


### required

```solidity
uint256 public required;
```


### transactionCount

```solidity
uint256 public transactionCount;
```


## Functions
### onlyWallet


```solidity
modifier onlyWallet();
```

### ownerDoesNotExist


```solidity
modifier ownerDoesNotExist(address owner);
```

### ownerExists


```solidity
modifier ownerExists(address owner);
```

### transactionExists


```solidity
modifier transactionExists(uint256 transactionId);
```

### confirmed


```solidity
modifier confirmed(uint256 transactionId, address owner);
```

### notConfirmed


```solidity
modifier notConfirmed(uint256 transactionId, address owner);
```

### notExecuted


```solidity
modifier notExecuted(uint256 transactionId);
```

### notNull


```solidity
modifier notNull(address _address);
```

### validRequirement


```solidity
modifier validRequirement(uint256 ownerCount, uint256 _required);
```

### function

Fallback function allows to deposit ether.


```solidity
function() external payable;
```

### constructor

Contract constructor sets initial owners and required number
of confirmations.


```solidity
constructor(address[] memory _owners, uint256 _required) public validRequirement(_owners.length, _required);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_owners`|`address[]`|List of initial owners.|
|`_required`|`uint256`|Number of required confirmations.|


### addOwner

Allows to add a new owner. Transaction has to be sent by wallet.


```solidity
function addOwner(address owner)
    public
    onlyWallet
    ownerDoesNotExist(owner)
    notNull(owner)
    validRequirement(owners.length + 1, required);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`owner`|`address`|Address of new owner.|


### removeOwner

Allows to remove an owner. Transaction has to be sent by wallet.


```solidity
function removeOwner(address owner) public onlyWallet ownerExists(owner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`owner`|`address`|Address of owner.|


### replaceOwner

Allows to replace an owner with a new owner. Transaction has
to be sent by wallet.


```solidity
function replaceOwner(address owner, address newOwner)
    public
    onlyWallet
    ownerExists(owner)
    ownerDoesNotExist(newOwner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`owner`|`address`|Address of owner to be replaced.|
|`newOwner`|`address`|Address of new owner.|


### changeRequirement

Allows to change the number of required confirmations.
Transaction has to be sent by wallet.


```solidity
function changeRequirement(uint256 _required) public onlyWallet validRequirement(owners.length, _required);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_required`|`uint256`|Number of required confirmations.|


### submitTransaction

Allows an owner to submit and confirm a transaction.


```solidity
function submitTransaction(address destination, uint256 value, bytes memory data)
    public
    returns (uint256 transactionId);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`destination`|`address`|Transaction target address.|
|`value`|`uint256`|Transaction ether value.|
|`data`|`bytes`|Transaction data payload.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`transactionId`|`uint256`|Returns transaction ID.|


### confirmTransaction

Allows an owner to confirm a transaction.


```solidity
function confirmTransaction(uint256 transactionId)
    public
    ownerExists(msg.sender)
    transactionExists(transactionId)
    notConfirmed(transactionId, msg.sender);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`transactionId`|`uint256`|Transaction ID.|


### revokeConfirmation

Allows an owner to revoke a confirmation for a transaction.


```solidity
function revokeConfirmation(uint256 transactionId)
    public
    ownerExists(msg.sender)
    confirmed(transactionId, msg.sender)
    notExecuted(transactionId);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`transactionId`|`uint256`|Transaction ID.|


### executeTransaction

Allows anyone to execute a confirmed transaction.


```solidity
function executeTransaction(uint256 transactionId)
    public
    ownerExists(msg.sender)
    confirmed(transactionId, msg.sender)
    notExecuted(transactionId);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`transactionId`|`uint256`|Transaction ID.|


### external_call

Low level transaction execution.

*Call has been separated into its own function in order to
take advantage of the Solidity's code generator to produce a
loop that copies tx.data into memory.*


```solidity
function external_call(address destination, uint256 value, uint256 dataLength, bytes memory data)
    internal
    returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`destination`|`address`|The address of the Smart Contract to call.|
|`value`|`uint256`|The amout of rBTC to send w/ the transaction.|
|`dataLength`|`uint256`|The size of the payload.|
|`data`|`bytes`|The payload.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|Success or failure.|


### isConfirmed

"Allocate" memory for output (0x40 is where "free memory" pointer is stored by convention)
First 32 bytes are the padded length of data, so exclude that
34710 is the value that solidity is currently emitting
It includes callGas (700) + callVeryLow (3, to pay for SUB) + callValueTransferGas (9000) +
callNewAccountGas (25000, in case the destination address does not exist and needs creating)
Size of the input (in bytes) - this is what fixes the padding problem
Output is ignored, therefore the output size is zero

Returns the confirmation status of a transaction.


```solidity
function isConfirmed(uint256 transactionId) public view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`transactionId`|`uint256`|Transaction ID.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|Confirmation status.|


### addTransaction

Adds a new transaction to the transaction mapping,
if transaction does not exist yet.


```solidity
function addTransaction(address destination, uint256 value, bytes memory data)
    internal
    notNull(destination)
    returns (uint256 transactionId);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`destination`|`address`|Transaction target address.|
|`value`|`uint256`|Transaction ether value.|
|`data`|`bytes`|Transaction data payload.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`transactionId`|`uint256`|Returns transaction ID.|


### getConfirmationCount

Get the number of confirmations of a transaction.


```solidity
function getConfirmationCount(uint256 transactionId) public view returns (uint256 count);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`transactionId`|`uint256`|Transaction ID.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`count`|`uint256`|Number of confirmations.|


### getTransactionCount

Get the total number of transactions after filers are applied.


```solidity
function getTransactionCount(bool pending, bool executed) public view returns (uint256 count);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`pending`|`bool`|Include pending transactions.|
|`executed`|`bool`|Include executed transactions.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`count`|`uint256`|Total number of transactions after filters are applied.|


### getOwners

Get the list of owners.


```solidity
function getOwners() public view returns (address[] memory);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address[]`|List of owner addresses.|


### getConfirmations

Get the array with owner addresses, which confirmed transaction.


```solidity
function getConfirmations(uint256 transactionId) public view returns (address[] memory _confirmations);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`transactionId`|`uint256`|Transaction ID.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_confirmations`|`address[]`|Returns array of owner addresses.|


### getTransactionIds

Get the list of transaction IDs in defined range.


```solidity
function getTransactionIds(uint256 from, uint256 to, bool pending, bool executed)
    public
    view
    returns (uint256[] memory _transactionIds);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`from`|`uint256`|Index start position of transaction array.|
|`to`|`uint256`|Index end position of transaction array.|
|`pending`|`bool`|Include pending transactions.|
|`executed`|`bool`|Include executed transactions.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_transactionIds`|`uint256[]`|Returns array of transaction IDs.|


## Events
### Confirmation

```solidity
event Confirmation(address indexed sender, uint256 indexed transactionId);
```

### Revocation

```solidity
event Revocation(address indexed sender, uint256 indexed transactionId);
```

### Submission

```solidity
event Submission(uint256 indexed transactionId);
```

### Execution

```solidity
event Execution(uint256 indexed transactionId);
```

### ExecutionFailure

```solidity
event ExecutionFailure(uint256 indexed transactionId);
```

### Deposit

```solidity
event Deposit(address indexed sender, uint256 value);
```

### OwnerAddition

```solidity
event OwnerAddition(address indexed owner);
```

### OwnerRemoval

```solidity
event OwnerRemoval(address indexed owner);
```

### RequirementChange

```solidity
event RequirementChange(uint256 required);
```

## Structs
### Transaction

```solidity
struct Transaction {
    address destination;
    uint256 value;
    bytes data;
    bool executed;
}
```

