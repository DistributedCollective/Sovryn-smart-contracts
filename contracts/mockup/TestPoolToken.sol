pragma solidity ^0.5.17;

import "../farm/LiquidityMiningV2.sol";
import "../testhelpers/TestToken.sol";

contract TestPoolToken is TestToken {
	LiquidityMiningV2 private liquidityMining;

	constructor(
		string memory _name,
		string memory _symbol,
		uint8 _decimals,
		uint256 _initialAmount,
		address _liquidityMining
	) public TestToken(_name, _symbol, _decimals, _initialAmount) {
		setLiquidityMining(_liquidityMining);
	}

	function setLiquidityMining(address liquidityMining_) public {
		liquidityMining = LiquidityMiningV2(liquidityMining_);
	}

	function depositFor(address _user, uint256 _amount) external {
		liquidityMining.onTokensDeposited(_user, _amount);
	}
}
