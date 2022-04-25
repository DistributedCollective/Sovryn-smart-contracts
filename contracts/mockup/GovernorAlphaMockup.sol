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
}
