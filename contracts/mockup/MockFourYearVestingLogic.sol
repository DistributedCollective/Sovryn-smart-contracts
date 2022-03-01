pragma solidity ^0.5.17;

import "../governance/Vesting/fouryear/FourYearVestingLogic.sol";

contract MockFourYearVestingLogic is FourYearVestingLogic {
	/**
	 * @notice gets duration left
	 */
	function getDurationLeft() external view returns (uint256) {
		return durationLeft;
	}
}
