# Governance Contract. (StakingInterface.sol)

View Source: [contracts/governance/GovernorAlpha.sol](../contracts/governance/GovernorAlpha.sol)

**↗ Extends: [SafeMath96](SafeMath96.md)**

**StakingInterface**

This is an adapted clone of compound’s governance model. In general,
the process is the same: Token holders can make (executable) proposals if
they possess enough voting power, vote on proposals during a predefined
voting period and in the end evaluate the outcome. If successful, the
proposal will be scheduled on the timelock contract. Only after sufficient
time passed, it can be executed. A minimum voting power is required for
making a proposal as well as a minimum quorum.
 * Voting power in the Bitocracy:
Stakers will receive voting power in the Bitocracy in return for their
staking commitment. This voting power is weighted by how much SOV is staked
and for how long the staking period is - staking more SOV over longer staking
periods results in higher voting power. With this voting power, users can
vote for or against any SIP in bitocracy.sovryn.app.

**Enums**
### ProposalState

```js
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

## Structs
### Proposal

```js
struct Proposal {
 uint256 id,
 uint32 startBlock,
 uint32 endBlock,
 uint96 forVotes,
 uint96 againstVotes,
 uint96 quorum,
 uint96 majorityPercentage,
 uint64 eta,
 uint64 startTime,
 bool canceled,
 bool executed,
 address proposer,
 address[] targets,
 uint256[] values,
 string[] signatures,
 bytes[] calldatas,
 mapping(address => struct GovernorAlpha.Receipt) receipts
}
```

### Receipt

```js
struct Receipt {
 bool hasVoted,
 bool support,
 uint96 votes
}
```

## Contract Members
**Constants & Variables**

```js
string public constant NAME;
contract ITimelock public timelock;
contract IStaking public staking;
address public guardian;
uint256 public proposalCount;
uint96 public quorumPercentageVotes;
uint96 public majorityPercentageVotes;
mapping(uint256 => struct GovernorAlpha.Proposal) public proposals;
mapping(address => uint256) public latestProposalIds;
bytes32 public constant DOMAIN_TYPEHASH;
bytes32 public constant BALLOT_TYPEHASH;

```

**Events**

```js
event ProposalCreated(uint256  id, address  proposer, address[]  targets, uint256[]  values, string[]  signatures, bytes[]  calldatas, uint256  startBlock, uint256  endBlock, string  description);
event VoteCast(address  voter, uint256  proposalId, bool  support, uint256  votes);
event ProposalCanceled(uint256  id);
event ProposalQueued(uint256  id, uint256  eta);
event ProposalExecuted(uint256  id);
```

## Functions

- [proposalMaxOperations()](#proposalmaxoperations)
- [votingDelay()](#votingdelay)
- [votingPeriod()](#votingperiod)
- [constructor(address timelock_, address staking_, address guardian_, uint96 _quorumPercentageVotes, uint96 _majorityPercentageVotes)](#constructor)
- [proposalThreshold()](#proposalthreshold)
- [quorumVotes()](#quorumvotes)
- [propose(address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, string description)](#propose)
- [queue(uint256 proposalId)](#queue)
- [_queueOrRevert(address target, uint256 value, string signature, bytes data, uint256 eta)](#_queueorrevert)
- [execute(uint256 proposalId)](#execute)
- [cancel(uint256 proposalId)](#cancel)
- [getActions(uint256 proposalId)](#getactions)
- [getReceipt(uint256 proposalId, address voter)](#getreceipt)
- [castVote(uint256 proposalId, bool support)](#castvote)
- [castVoteBySig(uint256 proposalId, bool support, uint8 v, bytes32 r, bytes32 s)](#castvotebysig)
- [_castVote(address voter, uint256 proposalId, bool support)](#_castvote)
- [__acceptAdmin()](#__acceptadmin)
- [__abdicate()](#__abdicate)
- [__queueSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta)](#__queuesettimelockpendingadmin)
- [__executeSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta)](#__executesettimelockpendingadmin)
- [state(uint256 proposalId)](#state)
- [add256(uint256 a, uint256 b)](#add256)
- [sub256(uint256 a, uint256 b)](#sub256)
- [getChainId()](#getchainid)
- [delay()](#delay)
- [GRACE_PERIOD()](#grace_period)
- [acceptAdmin()](#acceptadmin)
- [queuedTransactions(bytes32 hash)](#queuedtransactions)
- [queueTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)](#queuetransaction)
- [cancelTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)](#canceltransaction)
- [executeTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)](#executetransaction)
- [getPriorVotes(address account, uint256 blockNumber, uint256 date)](#getpriorvotes)
- [getPriorTotalVotingPower(uint32 blockNumber, uint256 time)](#getpriortotalvotingpower)

---    

> ### proposalMaxOperations

The maximum number of actions that can be included in a proposal.

```solidity
function proposalMaxOperations() public pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction proposalMaxOperations() public pure returns (uint256) {
        return 10;
    } /
```
</details>

---    

> ### votingDelay

The delay before voting on a proposal may take place, once proposed.

```solidity
function votingDelay() public pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction votingDelay() public pure returns (uint256) {
        return 1;
    } /
```
</details>

---    

> ### votingPeriod

The duration of voting on a proposal, in blocks.

```solidity
function votingPeriod() public pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction votingPeriod() public pure returns (uint256) {
        return 2880;
    } /
```
</details>

---    

> ### constructor

```solidity
function (address timelock_, address staking_, address guardian_, uint96 _quorumPercentageVotes, uint96 _majorityPercentageVotes) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| timelock_ | address |  | 
| staking_ | address |  | 
| guardian_ | address |  | 
| _quorumPercentageVotes | uint96 |  | 
| _majorityPercentageVotes | uint96 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nstructor(
        address timelock_,
        address staking_,
        address guardian_,
        uint96 _quorumPercentageVotes,
        uint96 _majorityPercentageVotes
    ) public {
        timelock = ITimelock(timelock_);
        staking = IStaking(staking_);
        guardian = guardian_;
        quorumPercentageVotes = _quorumPercentageVotes;
        majorityPercentageVotes = _majorityPercentageVotes;
    }

```
</details>

---    

> ### proposalThreshold

The number of votes required in order for a voter to become a proposer.

```solidity
function proposalThreshold() public view
returns(uint96)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction proposalThreshold() public view returns (uint96) {
        uint96 totalVotingPower =
            staking.getPriorTotalVotingPower(
                safe32(
                    block.number - 1,
                    "GovernorAlpha::proposalThreshold: block number overflow"
                ),
                block.timestamp
            );
        // 1% of current total voting power.
        return totalVotingPower / 100;
    }

```
</details>

---    

> ### quorumVotes

The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed.

```solidity
function quorumVotes() public view
returns(uint96)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction quorumVotes() public view returns (uint96) {
        uint96 totalVotingPower =
            staking.getPriorTotalVotingPower(
                safe32(block.number - 1, "GovernorAlpha::quorumVotes: block number overflow"),
                block.timestamp
            );
        // 4% of current total voting power.
        return
            mul96(
                quorumPercentageVotes,
                totalVotingPower,
                "GovernorAlpha::quorumVotes:multiplication overflow"
            ) / 100;
    }

```
</details>

---    

> ### propose

Create a new proposal.

```solidity
function propose(address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, string description) public nonpayable
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| targets | address[] | Array of contract addresses to perform proposal execution. | 
| values | uint256[] | Array of rBTC amounts to send on proposal execution. | 
| signatures | string[] | Array of function signatures to call on proposal execution. | 
| calldatas | bytes[] | Array of payloads for the calls on proposal execution. | 
| description | string | Text describing the purpose of the proposal. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction propose(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    ) public returns (uint256) {
        // note: passing this block's timestamp, but the number of the previous block.
        // todo: think if it would be better to pass block.timestamp - 30 (average block time)
        // (probably not because proposal starts in 1 block from now).
        uint96 threshold = proposalThreshold();
        require(
            staking.getPriorVotes(msg.sender, sub256(block.number, 1), block.timestamp) >
                threshold,
            "GovernorAlpha::propose: proposer votes below proposal threshold"
        );
        require(
            targets.length == values.length &&
                targets.length == signatures.length &&
                targets.length == calldatas.length,
            "GovernorAlpha::propose: proposal function information arity mismatch"
        );
        require(targets.length != 0, "GovernorAlpha::propose: must provide actions");
        require(
            targets.length <= proposalMaxOperations(),
            "GovernorAlpha::propose: too many actions"
        );

        uint256 latestProposalId = latestProposalIds[msg.sender];
        if (latestProposalId != 0) {
            ProposalState proposersLatestProposalState = state(latestProposalId);
            require(
                proposersLatestProposalState != ProposalState.Active,
                "GovernorAlpha::propose: one live proposal per proposer, found an already active proposal"
            );
            require(
                proposersLatestProposalState != ProposalState.Pending,
                "GovernorAlpha::propose: one live proposal per proposer, found an already pending proposal"
            );
        }

        uint256 startBlock = add256(block.number, votingDelay());
        uint256 endBlock = add256(startBlock, votingPeriod());

        proposalCount++;

        /// @dev quorum: proposalThreshold is 1% of total votes, we can save gas using this pre calculated value.
        /// @dev startTime: Required by the staking contract. not used by the governance contract itself.
        Proposal memory newProposal =
            Proposal({
                id: proposalCount,
                startBlock: safe32(
                    startBlock,
                    "GovernorAlpha::propose: start block number overflow"
                ),
                endBlock: safe32(endBlock, "GovernorAlpha::propose: end block number overflow"),
                forVotes: 0,
                againstVotes: 0,
                quorum: mul96(
                    quorumPercentageVotes,
                    threshold,
                    "GovernorAlpha::propose: overflow on quorum computation"
                ),
                majorityPercentage: mul96(
                    majorityPercentageVotes,
                    threshold,
                    "GovernorAlpha::propose: overflow on majorityPercentage computation"
                ),
                eta: 0,
                startTime: safe64(block.timestamp, "GovernorAlpha::propose: startTime overflow"),
                canceled: false,
                executed: false,
                proposer: msg.sender,
                targets: targets,
                values: values,
                signatures: signatures,
                calldatas: calldatas
            });

        proposals[newProposal.id] = newProposal;
        latestProposalIds[newProposal.proposer] = newProposal.id;

        emit ProposalCreated(
            newProposal.id,
            msg.sender,
            targets,
            values,
            signatures,
            calldatas,
            startBlock,
            endBlock,
            description
        );
        return newProposal.id;
    }

```
</details>

---    

> ### queue

Enqueue a proposal and everyone of its calls.

```solidity
function queue(uint256 proposalId) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction queue(uint256 proposalId) public {
        require(
            state(proposalId) == ProposalState.Succeeded,
            "GovernorAlpha::queue: proposal can only be queued if it is succeeded"
        );
        Proposal storage proposal = proposals[proposalId];
        uint256 eta = add256(block.timestamp, timelock.delay());

        for (uint256 i = 0; i < proposal.targets.length; i++) {
            _queueOrRevert(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                eta
            );
        }
        proposal.eta = safe64(eta, "GovernorAlpha::queue: ETA overflow");
        emit ProposalQueued(proposalId, eta);
    }

```
</details>

---    

> ### _queueOrRevert

Tries to enqueue a proposal, verifying it has not been previously queued.

```solidity
function _queueOrRevert(address target, uint256 value, string signature, bytes data, uint256 eta) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address | Contract addresses to perform proposal execution. | 
| value | uint256 | rBTC amount to send on proposal execution. | 
| signature | string | Function signature to call on proposal execution. | 
| data | bytes | Payload for the call on proposal execution. | 
| eta | uint256 | Estimated Time of Accomplishment. The timestamp that the proposal will be available for execution, set once the vote succeeds. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction _queueOrRevert(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) internal {
        require(
            !timelock.queuedTransactions(
                keccak256(abi.encode(target, value, signature, data, eta))
            ),
            "GovernorAlpha::_queueOrRevert: proposal action already queued at eta"
        );
        timelock.queueTransaction(target, value, signature, data, eta);
    }

```
</details>

---    

> ### execute

Execute a proposal by looping and performing everyone of its calls.

```solidity
function execute(uint256 proposalId) public payable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction execute(uint256 proposalId) public payable {
        require(
            state(proposalId) == ProposalState.Queued,
            "GovernorAlpha::execute: proposal can only be executed if it is queued"
        );
        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;

        for (uint256 i = 0; i < proposal.targets.length; i++) {
            timelock.executeTransaction.value(proposal.values[i])(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                proposal.eta
            );
        }
        emit ProposalExecuted(proposalId);
    }

```
</details>

---    

> ### cancel

Cancel a proposal by looping and cancelling everyone of its calls.

```solidity
function cancel(uint256 proposalId) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction cancel(uint256 proposalId) public {
        ProposalState state = state(proposalId);
        require(
            state != ProposalState.Executed,
            "GovernorAlpha::cancel: cannot cancel executed proposal"
        );

        Proposal storage proposal = proposals[proposalId];
        /// @notice Cancel only if sent by the guardian.
        require(msg.sender == guardian, "GovernorAlpha::cancel: sender isn't a guardian");

        proposal.canceled = true;

        for (uint256 i = 0; i < proposal.targets.length; i++) {
            timelock.cancelTransaction(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                proposal.eta
            );
        }

        emit ProposalCanceled(proposalId);
    }

```
</details>

---    

> ### getActions

Get a proposal list of its calls.

```solidity
function getActions(uint256 proposalId) public view
returns(targets address[], values uint256[], signatures string[], calldatas bytes[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 

**Returns**

Arrays of the 4 call parameters: targets, values, signatures, calldatas.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getActions(uint256 proposalId)
        public
        view
        returns (
            address[] memory targets,
            uint256[] memory values,
            string[] memory signatures,
            bytes[] memory calldatas
        )
    {
        Proposal storage p = proposals[proposalId];
        return (p.targets, p.values, p.signatures, p.calldatas);
    }

```
</details>

---    

> ### getReceipt

Get a proposal receipt.

```solidity
function getReceipt(uint256 proposalId, address voter) public view
returns(struct GovernorAlpha.Receipt)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 
| voter | address | A governance stakeholder with voting power. | 

**Returns**

The voter receipt of the proposal.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getReceipt(uint256 proposalId, address voter) public view returns (Receipt memory) {
        return proposals[proposalId].receipts[voter];
    }

```
</details>

---    

> ### castVote

Casts a vote by sender.

```solidity
function castVote(uint256 proposalId, bool support) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 
| support | bool | Vote value, yes or no. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction castVote(uint256 proposalId, bool support) public {
        return _castVote(msg.sender, proposalId, support);
    }

```
</details>

---    

> ### castVoteBySig

Voting with EIP-712 Signatures.
     * Voting power can be delegated to any address, and then can be used to
vote on proposals. A key benefit to users of by-signature functionality
is that they can create a signed vote transaction for free, and have a
trusted third-party spend rBTC(or ETH) on gas fees and write it to the
blockchain for them.
     * The third party in this scenario, submitting the SOV-holder’s signed
transaction holds a voting power that is for only a single proposal.
The signatory still holds the power to vote on their own behalf in
the proposal if the third party has not yet published the signed
transaction that was given to them.
     *

```solidity
function castVoteBySig(uint256 proposalId, bool support, uint8 v, bytes32 r, bytes32 s) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 
| support | bool | Vote value, yes or no. | 
| v | uint8 | The recovery byte of the signature. | 
| r | bytes32 | Half of the ECDSA signature pair. | 
| s | bytes32 | upport Vote value, yes or no. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion castVoteBySig(
        uint256 proposalId,
        bool support,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        /**
         * @dev The DOMAIN_SEPARATOR is a hash that uniquely identifies a
         * smart contract. It is built from a string denoting it as an
         * EIP712 Domain, the name of the token contract, the version,
         * the chainId in case it changes, and the address that the
         * contract is deployed at.
         * */
        bytes32 domainSeparator =
            keccak256(
                abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(NAME)), getChainId(), address(this))
            );

        /// @dev GovernorAlpha uses BALLOT_TYPEHASH, while Staking uses DELEGATION_TYPEHASH
        bytes32 structHash = keccak256(abi.encode(BALLOT_TYPEHASH, proposalId, support));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signatory = ecrecover(digest, v, r, s);

        /// @dev Verify address is not null and PK is not null either.
        require(
            RSKAddrValidator.checkPKNotZero(signatory),
            "GovernorAlpha::castVoteBySig: invalid signature"
        );
        return _castVote(signatory, proposalId, support);
    }

```
</details>

---    

> ### _castVote

Cast a vote, adding it to the total counting.

```solidity
function _castVote(address voter, uint256 proposalId, bool support) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| voter | address | A governance stakeholder with voting power that is casting the vote. | 
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 
| support | bool | Vote value, yes or no. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion _castVote(
        address voter,
        uint256 proposalId,
        bool support
    ) internal {
        require(
            state(proposalId) == ProposalState.Active,
            "GovernorAlpha::_castVote: voting is closed"
        );
        Proposal storage proposal = proposals[proposalId];
        Receipt storage receipt = proposal.receipts[voter];
        require(receipt.hasVoted == false, "GovernorAlpha::_castVote: voter already voted");
        uint96 votes = staking.getPriorVotes(voter, proposal.startBlock, proposal.startTime);

        if (support) {
            proposal.forVotes = add96(
                proposal.forVotes,
                votes,
                "GovernorAlpha::_castVote: vote overflow"
            );
        } else {
            proposal.againstVotes = add96(
                proposal.againstVotes,
                votes,
                "GovernorAlpha::_castVote: vote overflow"
            );
        }

        receipt.hasVoted = true;
        receipt.support = support;
        receipt.votes = votes;

        emit VoteCast(voter, proposalId, support, votes);
    }

```
</details>

---    

> ### __acceptAdmin

Timelock wrapper w/ sender check.

```solidity
function __acceptAdmin() public nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion __acceptAdmin() public {
        require(
            msg.sender == guardian,
            "GovernorAlpha::__acceptAdmin: sender must be gov guardian"
        );
        timelock.acceptAdmin();
    }

```
</details>

---    

> ### __abdicate

Sets guardian address to zero.

```solidity
function __abdicate() public nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion __abdicate() public {
        require(msg.sender == guardian, "GovernorAlpha::__abdicate: sender must be gov guardian");
        guardian = address(0);
    }

```
</details>

---    

> ### __queueSetTimelockPendingAdmin

Timelock wrapper w/ sender check.

```solidity
function __queueSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newPendingAdmin | address |  | 
| eta | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion __queueSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta) public {
        require(
            msg.sender == guardian,
            "GovernorAlpha::__queueSetTimelockPendingAdmin: sender must be gov guardian"
        );
        timelock.queueTransaction(
            address(timelock),
            0,
            "setPendingAdmin(address)",
            abi.encode(newPendingAdmin),
            eta
        );
    }

```
</details>

---    

> ### __executeSetTimelockPendingAdmin

Timelock wrapper w/ sender check.

```solidity
function __executeSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newPendingAdmin | address |  | 
| eta | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion __executeSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta) public {
        require(
            msg.sender == guardian,
            "GovernorAlpha::__executeSetTimelockPendingAdmin: sender must be gov guardian"
        );
        timelock.executeTransaction(
            address(timelock),
            0,
            "setPendingAdmin(address)",
            abi.encode(newPendingAdmin),
            eta
        );
    }

```
</details>

---    

> ### state

Get a proposal state.

```solidity
function state(uint256 proposalId) public view
returns(enum GovernorAlpha.ProposalState)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 

**Returns**

The state of the proposal: Canceled, Pending, Active, Defeated,
Succeeded, Executed, Expired.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion state(uint256 proposalId) public view returns (ProposalState) {
        require(
            proposalCount >= proposalId && proposalId > 0,
            "GovernorAlpha::state: invalid proposal id"
        );
        Proposal storage proposal = proposals[proposalId];

        if (proposal.canceled) {
            return ProposalState.Canceled;
        }

        if (block.number <= proposal.startBlock) {
            return ProposalState.Pending;
        }

        if (block.number <= proposal.endBlock) {
            return ProposalState.Active;
        }

        uint96 totalVotes =
            add96(
                proposal.forVotes,
                proposal.againstVotes,
                "GovernorAlpha:: state: forVotes + againstVotes > uint96"
            );
        uint96 totalVotesMajorityPercentage =
            div96(totalVotes, 100, "GovernorAlpha:: state: division error");
        totalVotesMajorityPercentage = mul96(
            totalVotesMajorityPercentage,
            majorityPercentageVotes,
            "GovernorAlpha:: state: totalVotes * majorityPercentage > uint96"
        );
        if (proposal.forVotes <= totalVotesMajorityPercentage || totalVotes < proposal.quorum) {
            return ProposalState.Defeated;
        }

        if (proposal.eta == 0) {
            return ProposalState.Succeeded;
        }

        if (proposal.executed) {
            return ProposalState.Executed;
        }

        if (block.timestamp >= add256(proposal.eta, timelock.GRACE_PERIOD())) {
            return ProposalState.Expired;
        }

        return ProposalState.Queued;
    }

```
</details>

---    

> ### add256

TODO: use OpenZeppelin's SafeMath function instead.

```solidity
function add256(uint256 a, uint256 b) internal pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| a | uint256 |  | 
| b | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion add256(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "addition overflow");
        return c;
    }

```
</details>

---    

> ### sub256

TODO: use OpenZeppelin's SafeMath function instead.

```solidity
function sub256(uint256 a, uint256 b) internal pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| a | uint256 |  | 
| b | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion sub256(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "subtraction underflow");
        return a - b;
    }

```
</details>

---    

> ### getChainId

Retrieve CHAIN_ID of the executing chain.
     * Chain identifier (chainID) introduced in EIP-155 protects transaction
included into one chain from being included into another chain.
Basically, chain identifier is an integer number being used in the
processes of signing transactions and verifying transaction signatures.
     *

```solidity
function getChainId() internal pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion getChainId() internal pure returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }
}

```
</details>

---    

> ### delay

```solidity
function delay() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion delay() external view returns (uint256);

```
</details>

---    

> ### GRACE_PERIOD

```solidity
function GRACE_PERIOD() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion GRACE_PERIOD() external view returns (uint256);

```
</details>

---    

> ### acceptAdmin

```solidity
function acceptAdmin() external nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion acceptAdmin() external;

```
</details>

---    

> ### queuedTransactions

```solidity
function queuedTransactions(bytes32 hash) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| hash | bytes32 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion queuedTransactions(bytes32 hash) external view returns (bool);

```
</details>

---    

> ### queueTransaction

```solidity
function queueTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) external nonpayable
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address |  | 
| value | uint256 |  | 
| signature | string |  | 
| data | bytes |  | 
| eta | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion queueTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external returns (bytes32);

```
</details>

---    

> ### cancelTransaction

```solidity
function cancelTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address |  | 
| value | uint256 |  | 
| signature | string |  | 
| data | bytes |  | 
| eta | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion cancelTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external;

```
</details>

---    

> ### executeTransaction

```solidity
function executeTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) external payable
returns(bytes)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address |  | 
| value | uint256 |  | 
| signature | string |  | 
| data | bytes |  | 
| eta | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion executeTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external payable returns (bytes memory);
}

```
</details>

---    

> ### getPriorVotes

```solidity
function getPriorVotes(address account, uint256 blockNumber, uint256 date) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address |  | 
| blockNumber | uint256 |  | 
| date | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion getPriorVotes(
        address account,
        uint256 blockNumber,
        uint256 date
    ) external view returns (uint96);

```
</details>

---    

> ### getPriorTotalVotingPower

```solidity
function getPriorTotalVotingPower(uint32 blockNumber, uint256 time) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| blockNumber | uint32 |  | 
| time | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tion getPriorTotalVotingPower(uint32 blockNumber, uint256 time)
        external
        view
        returns (uint96);
}

```
</details>

## Contracts

* [Address](Address.md)
* [Administered](Administered.md)
* [AdminRole](AdminRole.md)
* [AdvancedToken](AdvancedToken.md)
* [AdvancedTokenStorage](AdvancedTokenStorage.md)
* [Affiliates](Affiliates.md)
* [AffiliatesEvents](AffiliatesEvents.md)
* [ApprovalReceiver](ApprovalReceiver.md)
* [BProPriceFeed](BProPriceFeed.md)
* [Checkpoints](Checkpoints.md)
* [Constants](Constants.md)
* [Context](Context.md)
* [DevelopmentFund](DevelopmentFund.md)
* [DummyContract](DummyContract.md)
* [ECDSA](ECDSA.md)
* [EnumerableAddressSet](EnumerableAddressSet.md)
* [EnumerableBytes32Set](EnumerableBytes32Set.md)
* [EnumerableBytes4Set](EnumerableBytes4Set.md)
* [ERC20](ERC20.md)
* [ERC20Detailed](ERC20Detailed.md)
* [ErrorDecoder](ErrorDecoder.md)
* [Escrow](Escrow.md)
* [EscrowReward](EscrowReward.md)
* [FeedsLike](FeedsLike.md)
* [FeesEvents](FeesEvents.md)
* [FeeSharingLogic](FeeSharingLogic.md)
* [FeeSharingProxy](FeeSharingProxy.md)
* [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
* [FeesHelper](FeesHelper.md)
* [FourYearVesting](FourYearVesting.md)
* [FourYearVestingFactory](FourYearVestingFactory.md)
* [FourYearVestingLogic](FourYearVestingLogic.md)
* [FourYearVestingStorage](FourYearVestingStorage.md)
* [GenericTokenSender](GenericTokenSender.md)
* [GovernorAlpha](GovernorAlpha.md)
* [GovernorVault](GovernorVault.md)
* [IApproveAndCall](IApproveAndCall.md)
* [IChai](IChai.md)
* [IContractRegistry](IContractRegistry.md)
* [IConverterAMM](IConverterAMM.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IFeeSharingProxy](IFeeSharingProxy.md)
* [IFourYearVesting](IFourYearVesting.md)
* [IFourYearVestingFactory](IFourYearVestingFactory.md)
* [ILiquidityMining](ILiquidityMining.md)
* [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
* [ILoanPool](ILoanPool.md)
* [ILoanToken](ILoanToken.md)
* [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
* [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
* [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
* [ILoanTokenModules](ILoanTokenModules.md)
* [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
* [ILockedSOV](ILockedSOV.md)
* [IMoCState](IMoCState.md)
* [Initializable](Initializable.md)
* [InterestUser](InterestUser.md)
* [IPot](IPot.md)
* [IPriceFeeds](IPriceFeeds.md)
* [IPriceFeedsExt](IPriceFeedsExt.md)
* [IProtocol](IProtocol.md)
* [IRSKOracle](IRSKOracle.md)
* [ISovryn](ISovryn.md)
* [ISovrynSwapNetwork](ISovrynSwapNetwork.md)
* [IStaking](IStaking.md)
* [ISwapsImpl](ISwapsImpl.md)
* [ITeamVesting](ITeamVesting.md)
* [ITimelock](ITimelock.md)
* [IV1PoolOracle](IV1PoolOracle.md)
* [IVesting](IVesting.md)
* [IVestingFactory](IVestingFactory.md)
* [IVestingRegistry](IVestingRegistry.md)
* [IWrbtc](IWrbtc.md)
* [IWrbtcERC20](IWrbtcERC20.md)
* [LenderInterestStruct](LenderInterestStruct.md)
* [LiquidationHelper](LiquidationHelper.md)
* [LiquidityMining](LiquidityMining.md)
* [LiquidityMiningConfigToken](LiquidityMiningConfigToken.md)
* [LiquidityMiningProxy](LiquidityMiningProxy.md)
* [LiquidityMiningStorage](LiquidityMiningStorage.md)
* [LoanClosingsEvents](LoanClosingsEvents.md)
* [LoanClosingsLiquidation](LoanClosingsLiquidation.md)
* [LoanClosingsRollover](LoanClosingsRollover.md)
* [LoanClosingsShared](LoanClosingsShared.md)
* [LoanClosingsWith](LoanClosingsWith.md)
* [LoanInterestStruct](LoanInterestStruct.md)
* [LoanMaintenance](LoanMaintenance.md)
* [LoanMaintenanceEvents](LoanMaintenanceEvents.md)
* [LoanOpenings](LoanOpenings.md)
* [LoanOpeningsEvents](LoanOpeningsEvents.md)
* [LoanParamsStruct](LoanParamsStruct.md)
* [LoanSettings](LoanSettings.md)
* [LoanSettingsEvents](LoanSettingsEvents.md)
* [LoanStruct](LoanStruct.md)
* [LoanToken](LoanToken.md)
* [LoanTokenBase](LoanTokenBase.md)
* [LoanTokenLogicBeacon](LoanTokenLogicBeacon.md)
* [LoanTokenLogicLM](LoanTokenLogicLM.md)
* [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
* [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
* [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
* [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
* [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
* [LockedSOV](LockedSOV.md)
* [Medianizer](Medianizer.md)
* [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
* [ModulesCommonEvents](ModulesCommonEvents.md)
* [MultiSigKeyHolders](MultiSigKeyHolders.md)
* [MultiSigWallet](MultiSigWallet.md)
* [Objects](Objects.md)
* [OrderStruct](OrderStruct.md)
* [OrigingVestingCreator](OrigingVestingCreator.md)
* [OriginInvestorsClaim](OriginInvestorsClaim.md)
* [Ownable](Ownable.md)
* [Pausable](Pausable.md)
* [PausableOz](PausableOz.md)
* [PreviousLoanToken](PreviousLoanToken.md)
* [PreviousLoanTokenSettingsLowerAdmin](PreviousLoanTokenSettingsLowerAdmin.md)
* [PriceFeedRSKOracle](PriceFeedRSKOracle.md)
* [PriceFeeds](PriceFeeds.md)
* [PriceFeedsLocal](PriceFeedsLocal.md)
* [PriceFeedsMoC](PriceFeedsMoC.md)
* [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
* [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
* [ProtocolLike](ProtocolLike.md)
* [ProtocolSettings](ProtocolSettings.md)
* [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
* [ProtocolSettingsLike](ProtocolSettingsLike.md)
* [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
* [ProtocolTokenUser](ProtocolTokenUser.md)
* [Proxy](Proxy.md)
* [ReentrancyGuard](ReentrancyGuard.md)
* [RewardHelper](RewardHelper.md)
* [RSKAddrValidator](RSKAddrValidator.md)
* [SafeERC20](SafeERC20.md)
* [SafeMath](SafeMath.md)
* [SafeMath96](SafeMath96.md)
* [setGet](setGet.md)
* [SignedSafeMath](SignedSafeMath.md)
* [SOV](SOV.md)
* [sovrynProtocol](sovrynProtocol.md)
* [Staking](Staking.md)
* [StakingInterface](StakingInterface.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingStorage](StakingStorage.md)
* [State](State.md)
* [SVR](SVR.md)
* [SwapsEvents](SwapsEvents.md)
* [SwapsExternal](SwapsExternal.md)
* [SwapsImplLocal](SwapsImplLocal.md)
* [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
* [SwapsUser](SwapsUser.md)
* [TeamVesting](TeamVesting.md)
* [Timelock](Timelock.md)
* [TimelockHarness](TimelockHarness.md)
* [TimelockInterface](TimelockInterface.md)
* [TokenSender](TokenSender.md)
* [UpgradableProxy](UpgradableProxy.md)
* [USDTPriceFeed](USDTPriceFeed.md)
* [VaultController](VaultController.md)
* [Vesting](Vesting.md)
* [VestingCreator](VestingCreator.md)
* [VestingFactory](VestingFactory.md)
* [VestingLogic](VestingLogic.md)
* [VestingRegistry](VestingRegistry.md)
* [VestingRegistry2](VestingRegistry2.md)
* [VestingRegistry3](VestingRegistry3.md)
* [VestingRegistryLogic](VestingRegistryLogic.md)
* [VestingRegistryProxy](VestingRegistryProxy.md)
* [VestingRegistryStorage](VestingRegistryStorage.md)
* [VestingStorage](VestingStorage.md)
* [WeightedStaking](WeightedStaking.md)
* [WRBTC](WRBTC.md)
