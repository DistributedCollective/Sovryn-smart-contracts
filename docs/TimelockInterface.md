# Governance Contract. (TimelockInterface.sol)

View Source: [contracts/governance/GovernorAlpha.sol](../contracts/governance/GovernorAlpha.sol)

**↗ Extends: [SafeMath96](SafeMath96.md)**

**TimelockInterface**

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
- [(address timelock_, address staking_, address guardian_, uint96 _quorumPercentageVotes, uint96 _majorityPercentageVotes)](#)
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

### proposalMaxOperations

The maximum number of actions that can be included in a proposal.

```js
function proposalMaxOperations() public pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### votingDelay

The delay before voting on a proposal may take place, once proposed.

```js
function votingDelay() public pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### votingPeriod

⤿ Overridden Implementation(s): [GovernorAlphaMockup.votingPeriod](GovernorAlphaMockup.md#votingperiod)

The duration of voting on a proposal, in blocks.

```js
function votingPeriod() public pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### 

```js
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

### proposalThreshold

The number of votes required in order for a voter to become a proposer.

```js
function proposalThreshold() public view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### quorumVotes

The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed.

```js
function quorumVotes() public view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### propose

Create a new proposal.

```js
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

### queue

Enqueue a proposal and everyone of its calls.

```js
function queue(uint256 proposalId) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 

### _queueOrRevert

Tries to enqueue a proposal, verifying it has not been previously queued.

```js
function _queueOrRevert(address target, uint256 value, string signature, bytes data, uint256 eta) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address | Contract addresses to perform proposal execution. | 
| value | uint256 | rBTC amount to send on proposal execution. | 
| signature | string | Function signature to call on proposal execution. | 
| data | bytes | Payload for the call on proposal execution. | 
| eta | uint256 | Estimated Time of Accomplishment. The timestamp that the
proposal will be available for execution, set once the vote succeeds. | 

### execute

Execute a proposal by looping and performing everyone of its calls.

```js
function execute(uint256 proposalId) public payable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 

### cancel

Cancel a proposal by looping and cancelling everyone of its calls.

```js
function cancel(uint256 proposalId) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 

### getActions

Get a proposal list of its calls.

```js
function getActions(uint256 proposalId) public view
returns(targets address[], values uint256[], signatures string[], calldatas bytes[])
```

**Returns**

Arrays of the 4 call parameters: targets, values, signatures, calldatas.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 

### getReceipt

Get a proposal receipt.

```js
function getReceipt(uint256 proposalId, address voter) public view
returns(struct GovernorAlpha.Receipt)
```

**Returns**

The voter receipt of the proposal.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 
| voter | address | A governance stakeholder with voting power. | 

### castVote

Casts a vote by sender.

```js
function castVote(uint256 proposalId, bool support) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 
| support | bool | Vote value, yes or no. | 

### castVoteBySig

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

```js
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

### _castVote

Cast a vote, adding it to the total counting.

```js
function _castVote(address voter, uint256 proposalId, bool support) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| voter | address | A governance stakeholder with voting power that is casting the vote. | 
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 
| support | bool | Vote value, yes or no. | 

### __acceptAdmin

Timelock wrapper w/ sender check.

```js
function __acceptAdmin() public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### __abdicate

Sets guardian address to zero.

```js
function __abdicate() public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### __queueSetTimelockPendingAdmin

Timelock wrapper w/ sender check.

```js
function __queueSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newPendingAdmin | address |  | 
| eta | uint256 |  | 

### __executeSetTimelockPendingAdmin

Timelock wrapper w/ sender check.

```js
function __executeSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newPendingAdmin | address |  | 
| eta | uint256 |  | 

### state

Get a proposal state.

```js
function state(uint256 proposalId) public view
returns(enum GovernorAlpha.ProposalState)
```

**Returns**

The state of the proposal: Canceled, Pending, Active, Defeated,
Succeeded, Executed, Expired.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| proposalId | uint256 | Proposal index to access the list proposals[] from storage. | 

### add256

TODO: use OpenZeppelin's SafeMath function instead.

```js
function add256(uint256 a, uint256 b) internal pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| a | uint256 |  | 
| b | uint256 |  | 

### sub256

TODO: use OpenZeppelin's SafeMath function instead.

```js
function sub256(uint256 a, uint256 b) internal pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| a | uint256 |  | 
| b | uint256 |  | 

### getChainId

Retrieve CHAIN_ID of the executing chain.
	 * Chain identifier (chainID) introduced in EIP-155 protects transaction
included into one chain from being included into another chain.
Basically, chain identifier is an integer number being used in the
processes of signing transactions and verifying transaction signatures.
	 *

```js
function getChainId() internal pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### delay

```js
function delay() external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### GRACE_PERIOD

```js
function GRACE_PERIOD() external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### acceptAdmin

```js
function acceptAdmin() external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### queuedTransactions

```js
function queuedTransactions(bytes32 hash) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| hash | bytes32 |  | 

### queueTransaction

```js
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

### cancelTransaction

```js
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

### executeTransaction

```js
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

### getPriorVotes

```js
function getPriorVotes(address account, uint256 blockNumber, uint256 date) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address |  | 
| blockNumber | uint256 |  | 
| date | uint256 |  | 

### getPriorTotalVotingPower

```js
function getPriorTotalVotingPower(uint32 blockNumber, uint256 time) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| blockNumber | uint32 |  | 
| time | uint256 |  | 

## Contracts

* [Address](Address.md)
* [Administered](Administered.md)
* [AdminRole](AdminRole.md)
* [AdvancedToken](AdvancedToken.md)
* [AdvancedTokenStorage](AdvancedTokenStorage.md)
* [Affiliates](Affiliates.md)
* [AffiliatesEvents](AffiliatesEvents.md)
* [ApprovalReceiver](ApprovalReceiver.md)
* [BlockMockUp](BlockMockUp.md)
* [BProPriceFeed](BProPriceFeed.md)
* [BProPriceFeedMockup](BProPriceFeedMockup.md)
* [Checkpoints](Checkpoints.md)
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
* [FeeSharingProxyMockup](FeeSharingProxyMockup.md)
* [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
* [FeesHelper](FeesHelper.md)
* [FlashLoanerTest](FlashLoanerTest.md)
* [GenericTokenSender](GenericTokenSender.md)
* [GovernorAlpha](GovernorAlpha.md)
* [GovernorAlphaMockup](GovernorAlphaMockup.md)
* [GovernorVault](GovernorVault.md)
* [IApproveAndCall](IApproveAndCall.md)
* [IChai](IChai.md)
* [IContractRegistry](IContractRegistry.md)
* [IConverterAMM](IConverterAMM.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IFeeSharingProxy](IFeeSharingProxy.md)
* [ILiquidityMining](ILiquidityMining.md)
* [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
* [ILoanPool](ILoanPool.md)
* [ILoanToken](ILoanToken.md)
* [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
* [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
* [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
* [ILoanTokenModules](ILoanTokenModules.md)
* [ILoanTokenModulesMock](ILoanTokenModulesMock.md)
* [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
* [ILockedSOV](ILockedSOV.md)
* [IMoCState](IMoCState.md)
* [ImplementationMockup](ImplementationMockup.md)
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
* [ITokenFlashLoanTest](ITokenFlashLoanTest.md)
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
* [LiquidityMiningMockup](LiquidityMiningMockup.md)
* [LiquidityMiningProxy](LiquidityMiningProxy.md)
* [LiquidityMiningStorage](LiquidityMiningStorage.md)
* [LiquidityPoolV1ConverterMockup](LiquidityPoolV1ConverterMockup.md)
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
* [LoanTokenLogicLMMockup](LoanTokenLogicLMMockup.md)
* [LoanTokenLogicLMV1Mockup](LoanTokenLogicLMV1Mockup.md)
* [LoanTokenLogicLMV2Mockup](LoanTokenLogicLMV2Mockup.md)
* [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
* [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
* [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
* [LoanTokenLogicTest](LoanTokenLogicTest.md)
* [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
* [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
* [LockedSOV](LockedSOV.md)
* [LockedSOVFailedMockup](LockedSOVFailedMockup.md)
* [LockedSOVMockup](LockedSOVMockup.md)
* [Medianizer](Medianizer.md)
* [MockAffiliates](MockAffiliates.md)
* [MockLoanTokenLogic](MockLoanTokenLogic.md)
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
* [PriceFeedRSKOracleMockup](PriceFeedRSKOracleMockup.md)
* [PriceFeeds](PriceFeeds.md)
* [PriceFeedsConstants](PriceFeedsConstants.md)
* [PriceFeedsMoC](PriceFeedsMoC.md)
* [PriceFeedsMoCMockup](PriceFeedsMoCMockup.md)
* [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
* [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
* [ProtocolLike](ProtocolLike.md)
* [ProtocolSettings](ProtocolSettings.md)
* [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
* [ProtocolSettingsLike](ProtocolSettingsLike.md)
* [ProtocolSettingsMockup](ProtocolSettingsMockup.md)
* [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
* [ProtocolTokenUser](ProtocolTokenUser.md)
* [Proxy](Proxy.md)
* [ProxyMockup](ProxyMockup.md)
* [RBTCWrapperProxyMockup](RBTCWrapperProxyMockup.md)
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
* [StakingMock](StakingMock.md)
* [StakingMockup](StakingMockup.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsMockUp](StakingRewardsMockUp.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingStorage](StakingStorage.md)
* [State](State.md)
* [StorageMockup](StorageMockup.md)
* [SVR](SVR.md)
* [SwapsEvents](SwapsEvents.md)
* [SwapsExternal](SwapsExternal.md)
* [SwapsImplLocal](SwapsImplLocal.md)
* [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
* [SwapsUser](SwapsUser.md)
* [TeamVesting](TeamVesting.md)
* [TestCoverage](TestCoverage.md)
* [TestLibraries](TestLibraries.md)
* [TestSovrynSwap](TestSovrynSwap.md)
* [TestToken](TestToken.md)
* [TestWrbtc](TestWrbtc.md)
* [Timelock](Timelock.md)
* [TimelockHarness](TimelockHarness.md)
* [TimelockInterface](TimelockInterface.md)
* [TimelockTest](TimelockTest.md)
* [TokenSender](TokenSender.md)
* [UpgradableProxy](UpgradableProxy.md)
* [USDTPriceFeed](USDTPriceFeed.md)
* [VaultController](VaultController.md)
* [Vesting](Vesting.md)
* [VestingCreator](VestingCreator.md)
* [VestingFactory](VestingFactory.md)
* [VestingLogic](VestingLogic.md)
* [VestingLogicMockup](VestingLogicMockup.md)
* [VestingRegistry](VestingRegistry.md)
* [VestingRegistry2](VestingRegistry2.md)
* [VestingRegistry3](VestingRegistry3.md)
* [VestingRegistryLogic](VestingRegistryLogic.md)
* [VestingRegistryLogicMockup](VestingRegistryLogicMockup.md)
* [VestingRegistryProxy](VestingRegistryProxy.md)
* [VestingRegistryStorage](VestingRegistryStorage.md)
* [VestingStorage](VestingStorage.md)
* [WeightedStaking](WeightedStaking.md)
* [WRBTC](WRBTC.md)
