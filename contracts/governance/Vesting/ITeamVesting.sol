pragma solidity ^0.5.17;

interface ITeamVesting {
	function governanceWithdrawTokens(address receiver) external;
}
