/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "./LoanTokenBase.sol";

/**
 * @title Advanced Token Storage contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * AdvancedTokenStorage implements standard ERC-20 getters functionality:
 * totalSupply, balanceOf, allowance and some events.
 * iToken logic is divided into several contracts AdvancedToken,
 * AdvancedTokenStorage and LoanTokenBase.
 * */
contract AdvancedTokenStorage is LoanTokenBase {
	using SafeMath for uint256;

	/* Events */

	/// topic: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
	event Transfer(address indexed from, address indexed to, uint256 value);

	/// topic: 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925
	event Approval(address indexed owner, address indexed spender, uint256 value);

	/// topic: 0xb4c03061fb5b7fed76389d5af8f2e0ddb09f8c70d1333abbb62582835e10accb
	event Mint(address indexed minter, uint256 tokenAmount, uint256 assetAmount, uint256 price);

	/// topic: 0x743033787f4738ff4d6a7225ce2bd0977ee5f86b91a902a58f5e4d0b297b4644
	event Burn(address indexed burner, uint256 tokenAmount, uint256 assetAmount, uint256 price);

	/* Storage */

	mapping(address => uint256) internal balances;
	mapping(address => mapping(address => uint256)) internal allowed;
	uint256 internal totalSupply_;

	/* Functions */

	/**
	 * @notice Get the total supply of iTokens.
	 * @return The total number of iTokens in existence as of now.
	 * */
	function totalSupply() public view returns (uint256) {
		return totalSupply_;
	}

	/**
	 * @notice Get the amount of iTokens owned by an account.
	 * @param _owner The account owner of the iTokens.
	 * @return The number of iTokens an account owns.
	 * */
	function balanceOf(address _owner) public view returns (uint256) {
		return balances[_owner];
	}

	/**
	 * @notice Get the amount of iTokens allowed to be spent by a
	 *   given account on behalf of the owner.
	 * @param _owner The account owner of the iTokens.
	 * @param _spender The account allowed to send the iTokens.
	 * @return The number of iTokens an account is allowing the spender
	 *   to send on its behalf.
	 * */
	function allowance(address _owner, address _spender) public view returns (uint256) {
		return allowed[_owner][_spender];
	}
}
