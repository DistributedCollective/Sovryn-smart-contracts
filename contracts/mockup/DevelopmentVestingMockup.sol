pragma solidity ^0.5.17;

import "../governance/Vesting/DevelopmentVesting.sol";

contract DevelopmentVestingMockup is DevelopmentVesting {

    constructor(
        address _SOV,
        address _tokenOwner,
        uint _cliff,
        uint _duration,
        uint _frequency
    )
        DevelopmentVesting(_SOV, _tokenOwner, _cliff, _duration, _frequency)
        public
    {
    }

    function updateWithdrawnAmount(uint index) public returns (uint) {
        return super._updateWithdrawnAmount(index);
    }

    function getUnlockedAmount(uint index) public view returns (uint) {
        return super._getUnlockedAmount(index);
    }

}