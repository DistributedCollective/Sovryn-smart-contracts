pragma solidity ^0.5.17;

import "../governance/Vesting/DevelopmentVesting.sol";

contract DevelopmentVestingMockup is DevelopmentVesting {
	constructor(
		address _SOV,
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		uint256 _frequency
	) public DevelopmentVesting(_SOV, _tokenOwner, _cliff, _duration, _frequency) {}

	function getUnlockedAmount(uint256 index) public view returns (uint256) {
		return super._getUnlockedAmount(index);
	}
}
