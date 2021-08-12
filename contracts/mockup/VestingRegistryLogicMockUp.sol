pragma solidity ^0.5.17;

import "../governance/Vesting/VestingRegistryLogic.sol";

contract VestingRegistryLogicMockup is VestingRegistryLogic {

	function isVestingAdress(address _vestingAddress) external view returns (bool isVestingAddr) {
		return true;
	}
}
