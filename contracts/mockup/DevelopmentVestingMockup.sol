pragma solidity ^0.5.17;

import "../governance/Vesting/DevelopmentVesting.sol";

contract DevelopmentVestingMockup is DevelopmentVesting {

    function getAvailableAmount() public view returns (uint) {
        return super._getAvailableAmount();
    }

    function getUnlockedAmount() public view returns (uint) {
        return super._getUnlockedAmount();
    }

}