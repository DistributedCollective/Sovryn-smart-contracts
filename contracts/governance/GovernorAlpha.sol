pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./Staking/SafeMath96.sol";
import "./Timelock.sol";
import "./Staking/Staking.sol";
import "../rsk/RSKAddrValidator.sol";

contract GovernorAlpha is SafeMath96 {
	/// @notice The name of this contract
	string public constant NAME = "Sovryn Governor Alpha";

	/// @notice The maximum number of actions that can be included in a proposal
	function proposalMaxOperations() public pure returns (uint256) {
		return 10;
	} // 10 actions

	/// @notice The delay before voting on a proposal may take place, once proposed
	function votingDelay() public pure returns (uint256) {
		return 1;
	} // 1 block

	/// @notice The duration of voting on a proposal, in blocks
	function votingPeriod() public pure returns (uint256) {
		return 8640;
	} // ~3 days in blocks (assuming 30s blocks)

	/// @notice The address of the Sovryn Protocol Timelock
	ITimelock public timelock;

	/// @notice The address of the Sovryn staking contract
	IStaking public staking;

	/// @notice The address of the Governor Guardian
	address public guardian;

	/// @notice The total number of proposals
	uint256 public proposalCount;

	/// @notice Percentage of current total voting power require to vote.
	uint96 public quorumPercentageVotes;

	// @notice Minimum  percentage
	uint96 public minPercentageVotes;

	struct Proposal {
		/// @notice Unique id for looking up a proposal
		uint256 id;
		/// @notice The block at which voting begins: holders must delegate their votes prior to this block
		uint32 startBlock;
		/// @notice The block at which voting ends: votes must be cast prior to this block
		uint32 endBlock;
		/// @notice Current number of votes in favor of this proposal
		uint96 forVotes;
		/// @notice Current number of votes in opposition to this proposal
		uint96 againstVotes;
		///@notice the quorum required for this proposal
		uint96 quorum;
		///@notice the minimum percentage required for this proposal
		uint96 minPercentage;
		/// @notice The timestamp that the proposal will be available for execution, set once the vote succeeds
		uint64 eta;
		/// @notice the start time is required for the staking contract
		uint64 startTime;
		/// @notice Flag marking whether the proposal has been canceled
		bool canceled;
		/// @notice Flag marking whether the proposal has been executed
		bool executed;
		/// @notice Creator of the proposal
		address proposer;
		/// @notice the ordered list of target addresses for calls to be made
		address[] targets;
		/// @notice The ordered list of values (i.e. msg.value) to be passed to the calls to be made
		uint256[] values;
		/// @notice The ordered list of function signatures to be called
		string[] signatures;
		/// @notice The ordered list of calldata to be passed to each call
		bytes[] calldatas;
		/// @notice Receipts of ballots for the entire set of voters
		mapping(address => Receipt) receipts;
	}

	/// @notice Ballot receipt record for a voter
	struct Receipt {
		/// @notice Whether or not a vote has been cast
		bool hasVoted;
		/// @notice Whether or not the voter supports the proposal
		bool support;
		/// @notice The number of votes the voter had, which were cast
		uint96 votes;
	}

	/// @notice Possible states that a proposal may be in
	enum ProposalState { Pending, Active, Canceled, Defeated, Succeeded, Queued, Expired, Executed }

	/// @notice The official record of all proposals ever proposed
	mapping(uint256 => Proposal) public proposals;

	/// @notice The latest proposal for each proposer
	mapping(address => uint256) public latestProposalIds;

	/// @notice The EIP-712 typehash for the contract's domain
	bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

	/// @notice The EIP-712 typehash for the ballot struct used by the contract
	bytes32 public constant BALLOT_TYPEHASH = keccak256("Ballot(uint256 proposalId,bool support)");

	/// @notice An event emitted when a new proposal is created
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

	/// @notice An event emitted when a vote has been cast on a proposal
	event VoteCast(address voter, uint256 proposalId, bool support, uint256 votes);

	/// @notice An event emitted when a proposal has been canceled
	event ProposalCanceled(uint256 id);

	/// @notice An event emitted when a proposal has been queued in the Timelock
	event ProposalQueued(uint256 id, uint256 eta);

	/// @notice An event emitted when a proposal has been executed in the Timelock
	event ProposalExecuted(uint256 id);

	constructor(
		address timelock_,
		address staking_,
		address guardian_,
		uint96 _quorumPercentageVotes,
		uint96 _minPercentageVotes
	) public {
		timelock = ITimelock(timelock_);
		staking = IStaking(staking_);
		guardian = guardian_;
		quorumPercentageVotes = _quorumPercentageVotes;
		minPercentageVotes = _minPercentageVotes;
	}

	/// @notice The number of votes required in order for a voter to become a proposer
	function proposalThreshold() public view returns (uint96) {
		uint96 totalVotingPower =
			staking.getPriorTotalVotingPower(
				safe32(block.number - 1, "GovernorAlpha::proposalThreshold: block number overflow"),
				block.timestamp
			);
		//1% of current total voting power
		return totalVotingPower / 100;
	}

	/// @notice The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed
	function quorumVotes() public view returns (uint96) {
		uint96 totalVotingPower =
			staking.getPriorTotalVotingPower(
				safe32(block.number - 1, "GovernorAlpha::quorumVotes: block number overflow"),
				block.timestamp
			);
		//4% of current total voting power
		return mul96(quorumPercentageVotes, totalVotingPower, "GovernorAlpha::quorumVotes:multiplication overflow") / 100;
	}

	function propose(
		address[] memory targets,
		uint256[] memory values,
		string[] memory signatures,
		bytes[] memory calldatas,
		string memory description
	) public returns (uint256) {
		//note: passing this block's timestamp, but the number of the previous block
		//todo: think if it would be better to pass block.timestamp - 30 (average block time) (probably not because proposal starts in 1 block from now)
		uint96 threshold = proposalThreshold();
		require(
			staking.getPriorVotes(msg.sender, sub256(block.number, 1), block.timestamp) > threshold,
			"GovernorAlpha::propose: proposer votes below proposal threshold"
		);
		require(
			targets.length == values.length && targets.length == signatures.length && targets.length == calldatas.length,
			"GovernorAlpha::propose: proposal function information arity mismatch"
		);
		require(targets.length != 0, "GovernorAlpha::propose: must provide actions");
		require(targets.length <= proposalMaxOperations(), "GovernorAlpha::propose: too many actions");

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
		Proposal memory newProposal =
			Proposal({
				id: proposalCount,
				startBlock: safe32(startBlock, "GovernorAlpha::propose: start block number overflow"),
				endBlock: safe32(endBlock, "GovernorAlpha::propose: end block number overflow"),
				forVotes: 0,
				againstVotes: 0,
				quorum: mul96(quorumPercentageVotes, threshold, "GovernorAlpha::propose: overflow on quorum computation"), //proposalThreshold is 1% of total votes, we can save gas using this pre calculated value
				minPercentage: mul96(minPercentageVotes, threshold, "GovernorAlpha::propose: overflow on minPercentage computation"),
				eta: 0,
				startTime: safe64(block.timestamp, "GovernorAlpha::propose: startTime overflow"), //required by the staking contract. not used by the governance contract itself.
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

		emit ProposalCreated(newProposal.id, msg.sender, targets, values, signatures, calldatas, startBlock, endBlock, description);
		return newProposal.id;
	}

	function queue(uint256 proposalId) public {
		require(state(proposalId) == ProposalState.Succeeded, "GovernorAlpha::queue: proposal can only be queued if it is succeeded");
		Proposal storage proposal = proposals[proposalId];
		uint256 eta = add256(block.timestamp, timelock.delay());

		for (uint256 i = 0; i < proposal.targets.length; i++) {
			_queueOrRevert(proposal.targets[i], proposal.values[i], proposal.signatures[i], proposal.calldatas[i], eta);
		}
		proposal.eta = safe64(eta, "GovernorAlpha::queue: ETA overflow");
		emit ProposalQueued(proposalId, eta);
	}

	function _queueOrRevert(
		address target,
		uint256 value,
		string memory signature,
		bytes memory data,
		uint256 eta
	) internal {
		require(
			!timelock.queuedTransactions(keccak256(abi.encode(target, value, signature, data, eta))),
			"GovernorAlpha::_queueOrRevert: proposal action already queued at eta"
		);
		timelock.queueTransaction(target, value, signature, data, eta);
	}

	function execute(uint256 proposalId) public payable {
		require(state(proposalId) == ProposalState.Queued, "GovernorAlpha::execute: proposal can only be executed if it is queued");
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

	function cancel(uint256 proposalId) public {
		ProposalState state = state(proposalId);
		require(state != ProposalState.Executed, "GovernorAlpha::cancel: cannot cancel executed proposal");

		Proposal storage proposal = proposals[proposalId];
		//cancel only if sent by the guardian
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

	function getActions(uint256 proposalId)
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

	function getReceipt(uint256 proposalId, address voter) public view returns (Receipt memory) {
		return proposals[proposalId].receipts[voter];
	}

	function castVote(uint256 proposalId, bool support) public {
		return _castVote(msg.sender, proposalId, support);
	}

	function castVoteBySig(
		uint256 proposalId,
		bool support,
		uint8 v,
		bytes32 r,
		bytes32 s
	) public {
		bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(NAME)), getChainId(), address(this)));
		bytes32 structHash = keccak256(abi.encode(BALLOT_TYPEHASH, proposalId, support));
		bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
		address signatory = ecrecover(digest, v, r, s);
		require(RSKAddrValidator.checkPKNotZero(signatory), "GovernorAlpha::castVoteBySig: invalid signature");
		return _castVote(signatory, proposalId, support);
	}

	function _castVote(
		address voter,
		uint256 proposalId,
		bool support
	) internal {
		require(state(proposalId) == ProposalState.Active, "GovernorAlpha::_castVote: voting is closed");
		Proposal storage proposal = proposals[proposalId];
		Receipt storage receipt = proposal.receipts[voter];
		require(receipt.hasVoted == false, "GovernorAlpha::_castVote: voter already voted");
		uint96 votes = staking.getPriorVotes(voter, proposal.startBlock, proposal.startTime);

		if (support) {
			proposal.forVotes = add96(proposal.forVotes, votes, "GovernorAlpha::_castVote: vote overflow");
		} else {
			proposal.againstVotes = add96(proposal.againstVotes, votes, "GovernorAlpha::_castVote: vote overflow");
		}

		receipt.hasVoted = true;
		receipt.support = support;
		receipt.votes = votes;

		emit VoteCast(voter, proposalId, support, votes);
	}

	function __acceptAdmin() public {
		require(msg.sender == guardian, "GovernorAlpha::__acceptAdmin: sender must be gov guardian");
		timelock.acceptAdmin();
	}

	function __abdicate() public {
		require(msg.sender == guardian, "GovernorAlpha::__abdicate: sender must be gov guardian");
		guardian = address(0);
	}

	function __queueSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta) public {
		require(msg.sender == guardian, "GovernorAlpha::__queueSetTimelockPendingAdmin: sender must be gov guardian");
		timelock.queueTransaction(address(timelock), 0, "setPendingAdmin(address)", abi.encode(newPendingAdmin), eta);
	}

	function __executeSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta) public {
		require(msg.sender == guardian, "GovernorAlpha::__executeSetTimelockPendingAdmin: sender must be gov guardian");
		timelock.executeTransaction(address(timelock), 0, "setPendingAdmin(address)", abi.encode(newPendingAdmin), eta);
	}

	function state(uint256 proposalId) public view returns (ProposalState) {
		require(proposalCount >= proposalId && proposalId > 0, "GovernorAlpha::state: invalid proposal id");
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

		if (
			proposal.forVotes <= proposal.againstVotes ||
			proposal.forVotes < proposal.quorum ||
			add96(proposal.forVotes, proposal.againstVotes, "GovernorAlpha:: state: forVotes + againstVotes > uint96") <
			proposal.minPercentage
		) {
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

	function add256(uint256 a, uint256 b) internal pure returns (uint256) {
		uint256 c = a + b;
		require(c >= a, "addition overflow");
		return c;
	}

	function sub256(uint256 a, uint256 b) internal pure returns (uint256) {
		require(b <= a, "subtraction underflow");
		return a - b;
	}

	function getChainId() internal pure returns (uint256) {
		uint256 chainId;
		assembly {
			chainId := chainid()
		}
		return chainId;
	}
}

interface TimelockInterface {
	function delay() external view returns (uint256);

	function GRACE_PERIOD() external view returns (uint256);

	function acceptAdmin() external;

	function queuedTransactions(bytes32 hash) external view returns (bool);

	function queueTransaction(
		address target,
		uint256 value,
		string calldata signature,
		bytes calldata data,
		uint256 eta
	) external returns (bytes32);

	function cancelTransaction(
		address target,
		uint256 value,
		string calldata signature,
		bytes calldata data,
		uint256 eta
	) external;

	function executeTransaction(
		address target,
		uint256 value,
		string calldata signature,
		bytes calldata data,
		uint256 eta
	) external payable returns (bytes memory);
}

interface StakingInterface {
	function getPriorVotes(
		address account,
		uint256 blockNumber,
		uint256 date
	) external view returns (uint96);

	function getPriorTotalVotingPower(uint32 blockNumber, uint256 time) external view returns (uint96);
}
