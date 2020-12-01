pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../governance/GovernorAlpha.sol";

contract GovernorAlphaMockup is GovernorAlpha {

    constructor(address timelock_, address staking_, address guardian_, uint96 quorumVotes_) GovernorAlpha(timelock_, staking_, guardian_, quorumVotes_) public {
    }

    function votingPeriod() public pure returns (uint) { return 10; }

}