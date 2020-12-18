pragma solidity ^0.5.17;

import "../governance/Vesting/DevelopmentVesting.sol";

contract DevelopmentVestingMockup is DevelopmentVesting {

    function updateWithdrawnAmount(uint index) public returns (uint) {
        return super._updateWithdrawnAmount(index);
    }

    function getUnlockedAmount(uint index) public view returns (uint) {
        return super._getUnlockedAmount(index);
    }

}