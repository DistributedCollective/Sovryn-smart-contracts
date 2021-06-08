pragma solidity >=0.5.0 <0.6.0;

interface ILiquidityMining {
	function withdraw(
		address _poolToken,
		uint256 _amount,
		address _user
	) external;

	function onTokensDeposited(address _user, uint256 _amount) external;

	function getUserPoolTokenBalance(address _poolToken, address _user) external view returns (uint256);
}
