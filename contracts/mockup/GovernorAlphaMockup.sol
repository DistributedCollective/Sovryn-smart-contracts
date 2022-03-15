pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../governance/GovernorAlpha.sol";

contract GovernorAlphaMockup is GovernorAlpha {
	constructor(
		address timelock_,
		address staking_,
		address guardian_,
		uint96 quorumVotes_,
		uint96 _minPercentageVotes
	) public GovernorAlpha(timelock_, staking_, guardian_, quorumVotes_, _minPercentageVotes) {}

	function votingPeriod() public pure returns (uint256) {
		return 10;
	}

	function queueProposals(uint256[] calldata proposalIds) external {
		for (uint256 i = 0; i < proposalIds.length; i++) {
			queue(proposalIds[i]);
		}
	}

	/// @notice Threshold for total votes proposal to be able to cancelled by guardian.
	function totalVotesForCancellationThreshold() public pure returns (uint256) {
		return 9000000;
	}

	/// @notice Threshold for total participant of the proposal to be able to cancelled by guardian.
	function participantForCancellationThreshold() public pure returns(uint256) {
		return 20000000;
	}
}
