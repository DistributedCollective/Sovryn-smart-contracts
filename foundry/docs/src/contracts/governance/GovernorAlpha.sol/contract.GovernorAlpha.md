# GovernorAlpha
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/GovernorAlpha.sol)

**Inherits:**
[SafeMath96](/contracts/governance/Staking/SafeMath96.sol/contract.SafeMath96.md)

This is an adapted clone of compound’s governance model. In general,
the process is the same: Token holders can make (executable) proposals if
they possess enough voting power, vote on proposals during a predefined
voting period and in the end evaluate the outcome. If successful, the
proposal will be scheduled on the timelock contract. Only after sufficient
time passed, it can be executed. A minimum voting power is required for
making a proposal as well as a minimum quorum.
Voting power in the Bitocracy:
Stakers will receive voting power in the Bitocracy in return for their
staking commitment. This voting power is weighted by how much SOV is staked
and for how long the staking period is - staking more SOV over longer staking
periods results in higher voting power. With this voting power, users can
vote for or against any SIP in bitocracy.sovryn.app.


## State Variables
### NAME
The name of this contract.


```solidity
string public constant NAME = "Sovryn Governor Alpha";
```


### timelock
The address of the Sovryn Protocol Timelock.


```solidity
ITimelock public timelock;
```


### staking
The address of the Sovryn staking contract.


```solidity
IStaking public staking;
```


### guardian
The address of the Governor Guardian.


```solidity
address public guardian;
```


### proposalCount
The total number of proposals.


```solidity
uint256 public proposalCount;
```


### quorumPercentageVotes
Percentage of current total voting power require to vote.


```solidity
uint96 public quorumPercentageVotes;
```


### majorityPercentageVotes

```solidity
uint96 public majorityPercentageVotes;
```


### proposals
The official record of all proposals ever proposed.


```solidity
mapping(uint256 => Proposal) public proposals;
```


### latestProposalIds
The latest proposal for each proposer.


```solidity
mapping(address => uint256) public latestProposalIds;
```


### DOMAIN_TYPEHASH
The EIP-712 typehash for the contract's domain.


```solidity
bytes32 public constant DOMAIN_TYPEHASH =
    keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");
```


### BALLOT_TYPEHASH
The EIP-712 typehash for the ballot struct used by the contract.


```solidity
bytes32 public constant BALLOT_TYPEHASH = keccak256("Ballot(uint256 proposalId,bool support)");
```


## Functions
### proposalMaxOperations

The maximum number of actions that can be included in a proposal.


```solidity
function proposalMaxOperations() public pure returns (uint256);
```

### votingDelay

The delay before voting on a proposal may take place, once proposed.


```solidity
function votingDelay() public pure returns (uint256);
```

### votingPeriod

The duration of voting on a proposal, in blocks.


```solidity
function votingPeriod() public pure returns (uint256);
```

### constructor


```solidity
constructor(
    address timelock_,
    address staking_,
    address guardian_,
    uint96 _quorumPercentageVotes,
    uint96 _majorityPercentageVotes
) public;
```

### proposalThreshold

The number of votes required in order for a voter to become a proposer.


```solidity
function proposalThreshold() public view returns (uint96);
```

### quorumVotes

The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed.


```solidity
function quorumVotes() public view returns (uint96);
```

### propose

Create a new proposal.


```solidity
function propose(
    address[] memory targets,
    uint256[] memory values,
    string[] memory signatures,
    bytes[] memory calldatas,
    string memory description
) public returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`targets`|`address[]`|Array of contract addresses to perform proposal execution.|
|`values`|`uint256[]`|Array of rBTC amounts to send on proposal execution.|
|`signatures`|`string[]`|Array of function signatures to call on proposal execution.|
|`calldatas`|`bytes[]`|Array of payloads for the calls on proposal execution.|
|`description`|`string`|Text describing the purpose of the proposal.|


### queue

Enqueue a proposal and everyone of its calls.

*quorum: proposalThreshold is 1% of total votes, we can save gas using this pre calculated value.*

*startTime: Required by the staking contract. not used by the governance contract itself.*


```solidity
function queue(uint256 proposalId) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`proposalId`|`uint256`|Proposal index to access the list proposals[] from storage.|


### _queueOrRevert

Tries to enqueue a proposal, verifying it has not been previously queued.


```solidity
function _queueOrRevert(address target, uint256 value, string memory signature, bytes memory data, uint256 eta)
    internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`target`|`address`|Contract addresses to perform proposal execution.|
|`value`|`uint256`|rBTC amount to send on proposal execution.|
|`signature`|`string`|Function signature to call on proposal execution.|
|`data`|`bytes`|Payload for the call on proposal execution.|
|`eta`|`uint256`|Estimated Time of Accomplishment. The timestamp that the proposal will be available for execution, set once the vote succeeds.|


### execute

Execute a proposal by looping and performing everyone of its calls.


```solidity
function execute(uint256 proposalId) public payable;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`proposalId`|`uint256`|Proposal index to access the list proposals[] from storage.|


### cancel

Cancel a proposal by looping and cancelling everyone of its calls.


```solidity
function cancel(uint256 proposalId) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`proposalId`|`uint256`|Proposal index to access the list proposals[] from storage.|


### getActions

Cancel only if sent by the guardian.

Get a proposal list of its calls.


```solidity
function getActions(uint256 proposalId)
    public
    view
    returns (address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`proposalId`|`uint256`|Proposal index to access the list proposals[] from storage.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`targets`|`address[]`|Arrays of the 4 call parameters: targets, values, signatures, calldatas.|
|`values`|`uint256[]`||
|`signatures`|`string[]`||
|`calldatas`|`bytes[]`||


### getReceipt

Get a proposal receipt.


```solidity
function getReceipt(uint256 proposalId, address voter) public view returns (Receipt memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`proposalId`|`uint256`|Proposal index to access the list proposals[] from storage.|
|`voter`|`address`|A governance stakeholder with voting power.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`Receipt`|The voter receipt of the proposal.|


### castVote

Casts a vote by sender.


```solidity
function castVote(uint256 proposalId, bool support) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`proposalId`|`uint256`|Proposal index to access the list proposals[] from storage.|
|`support`|`bool`|Vote value, yes or no.|


### castVoteBySig

Voting with EIP-712 Signatures.
Voting power can be delegated to any address, and then can be used to
vote on proposals. A key benefit to users of by-signature functionality
is that they can create a signed vote transaction for free, and have a
trusted third-party spend rBTC(or ETH) on gas fees and write it to the
blockchain for them.
The third party in this scenario, submitting the SOV-holder’s signed
transaction holds a voting power that is for only a single proposal.
The signatory still holds the power to vote on their own behalf in
the proposal if the third party has not yet published the signed
transaction that was given to them.

*The signature needs to be broken up into 3 parameters, known as
v, r and s:
const r = '0x' + sig.substring(2).substring(0, 64);
const s = '0x' + sig.substring(2).substring(64, 128);
const v = '0x' + sig.substring(2).substring(128, 130);*


```solidity
function castVoteBySig(uint256 proposalId, bool support, uint8 v, bytes32 r, bytes32 s) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`proposalId`|`uint256`|Proposal index to access the list proposals[] from storage.|
|`support`|`bool`|Vote value, yes or no.|
|`v`|`uint8`|The recovery byte of the signature.|
|`r`|`bytes32`|Half of the ECDSA signature pair.|
|`s`|`bytes32`|Half of the ECDSA signature pair.|


### _castVote

Cast a vote, adding it to the total counting.

*The DOMAIN_SEPARATOR is a hash that uniquely identifies a
smart contract. It is built from a string denoting it as an
EIP712 Domain, the name of the token contract, the version,
the chainId in case it changes, and the address that the
contract is deployed at.*

*GovernorAlpha uses BALLOT_TYPEHASH, while Staking uses DELEGATION_TYPEHASH*

*Verify address is not null and PK is not null either.*


```solidity
function _castVote(address voter, uint256 proposalId, bool support) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`voter`|`address`|A governance stakeholder with voting power that is casting the vote.|
|`proposalId`|`uint256`|Proposal index to access the list proposals[] from storage.|
|`support`|`bool`|Vote value, yes or no.|


### __acceptAdmin

*Timelock wrapper w/ sender check.*


```solidity
function __acceptAdmin() public;
```

### __abdicate

Sets guardian address to zero.


```solidity
function __abdicate() public;
```

### __queueSetTimelockPendingAdmin

*Timelock wrapper w/ sender check.*


```solidity
function __queueSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta) public;
```

### __executeSetTimelockPendingAdmin

*Timelock wrapper w/ sender check.*


```solidity
function __executeSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta) public;
```

### state

Get a proposal state.


```solidity
function state(uint256 proposalId) public view returns (ProposalState);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`proposalId`|`uint256`|Proposal index to access the list proposals[] from storage.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`ProposalState`|The state of the proposal: Canceled, Pending, Active, Defeated, Succeeded, Executed, Expired.|


### add256

*TODO: use OpenZeppelin's SafeMath function instead.*


```solidity
function add256(uint256 a, uint256 b) internal pure returns (uint256);
```

### sub256

*TODO: use OpenZeppelin's SafeMath function instead.*


```solidity
function sub256(uint256 a, uint256 b) internal pure returns (uint256);
```

### getChainId

Retrieve CHAIN_ID of the executing chain.
Chain identifier (chainID) introduced in EIP-155 protects transaction
included into one chain from being included into another chain.
Basically, chain identifier is an integer number being used in the
processes of signing transactions and verifying transaction signatures.

*As of version 0.5.12, Solidity includes an assembly function
chainid() that provides access to the new CHAINID opcode.
TODO: chainId is included in block. So you can get chain id like
block timestamp or block number: block.chainid;*


```solidity
function getChainId() internal pure returns (uint256);
```

## Events
### ProposalCreated
An event emitted when a new proposal is created.


```solidity
event ProposalCreated(
    uint256 id,
    address proposer,
    address[] targets,
    uint256[] values,
    string[] signatures,
    bytes[] calldatas,
    uint256 startBlock,
    uint256 endBlock,
    string description
);
```

### VoteCast
An event emitted when a vote has been cast on a proposal.


```solidity
event VoteCast(address voter, uint256 proposalId, bool support, uint256 votes);
```

### ProposalCanceled
An event emitted when a proposal has been canceled.


```solidity
event ProposalCanceled(uint256 id);
```

### ProposalQueued
An event emitted when a proposal has been queued in the Timelock.


```solidity
event ProposalQueued(uint256 id, uint256 eta);
```

### ProposalExecuted
An event emitted when a proposal has been executed in the Timelock.


```solidity
event ProposalExecuted(uint256 id);
```

## Structs
### Proposal

```solidity
struct Proposal {
    uint256 id;
    uint32 startBlock;
    uint32 endBlock;
    uint96 forVotes;
    uint96 againstVotes;
    uint96 quorum;
    uint96 majorityPercentage;
    uint64 eta;
    uint64 startTime;
    bool canceled;
    bool executed;
    address proposer;
    address[] targets;
    uint256[] values;
    string[] signatures;
    bytes[] calldatas;
    mapping(address => Receipt) receipts;
}
```

### Receipt
Ballot receipt record for a voter


```solidity
struct Receipt {
    bool hasVoted;
    bool support;
    uint96 votes;
}
```

## Enums
### ProposalState
Possible states that a proposal may be in.


```solidity
enum ProposalState {
    Pending,
    Active,
    Canceled,
    Defeated,
    Succeeded,
    Queued,
    Expired,
    Executed
}
```

