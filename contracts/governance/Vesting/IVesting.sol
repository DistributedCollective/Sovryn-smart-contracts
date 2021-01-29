pragma solidity ^0.5.17;

interface IVesting {
	function duration() external returns (uint256);

	function endDate() external returns (uint256);

	function stakeTokens(uint256 amount) external;

	function governanceWithdrawTokens(address receiver) external;
}
