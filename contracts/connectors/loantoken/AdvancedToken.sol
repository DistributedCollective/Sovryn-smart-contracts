/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "./AdvancedTokenStorage.sol";

/**
 * @title Advanced Token contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized margin
 * trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * AdvancedToken implements standard ERC-20 approval, mint and burn token functionality.
 * Logic (AdvancedToken) is kept aside from storage (AdvancedTokenStorage).
 *
 * For example, LoanTokenLogicDai contract uses AdvancedToken::_mint() to mint
 * its Loan Dai iTokens.
 * */
contract AdvancedToken is AdvancedTokenStorage {
	using SafeMath for uint256;

	/**
	 * @notice Set an amount as the allowance of `spender` over the caller's tokens.
	 *
	 * Returns a boolean value indicating whether the operation succeeded.
	 *
	 * IMPORTANT: Beware that changing an allowance with this method brings the risk
	 * that someone may use both the old and the new allowance by unfortunate
	 * transaction ordering. One possible solution to mitigate this race
	 * condition is to first reduce the spender's allowance to 0 and set the
	 * desired value afterwards:
	 * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
	 *
	 * Emits an {Approval} event.
	 *
	 * @param _spender The account address that will be able to spend the tokens.
	 * @param _value The amount of tokens allowed to spend.
	 * */
	function approve(address _spender, uint256 _value) public returns (bool) {
		allowed[msg.sender][_spender] = _value;
		emit Approval(msg.sender, _spender, _value);
		return true;
	}

	/**
	 * @notice The iToken minting process. Meant to issue Loan iTokens.
	 * Lenders are able to open an iToken position, by minting them.
	 * This function is called by LoanTokenLogicStandard::_mintToken
	 * @param _to The recipient of the minted tTokens.
	 * @param _tokenAmount The amount of iTokens to be minted.
	 * @param _assetAmount The amount of lended tokens (asset to lend).
	 * @param _price The price of the lended tokens.
	 * @return The updated balance of the recipient.
	 * */
	function _mint(
		address _to,
		uint256 _tokenAmount,
		uint256 _assetAmount,
		uint256 _price
	) internal returns (uint256) {
		require(_to != address(0), "15");

		uint256 _balance = balances[_to].add(_tokenAmount);
		balances[_to] = _balance;

		totalSupply_ = totalSupply_.add(_tokenAmount);

		emit Mint(_to, _tokenAmount, _assetAmount, _price);
		emit Transfer(address(0), _to, _tokenAmount);

		return _balance;
	}

	/**
	 * @notice The iToken burning process. Meant to destroy Loan iTokens.
	 * Lenders are able to close an iToken position, by burning them.
	 * This function is called by LoanTokenLogicStandard::_burnToken
	 * @param _who The owner of the iTokens to burn.
	 * @param _tokenAmount The amount of iTokens to burn.
	 * @param _assetAmount The amount of lended tokens.
	 * @param _price The price of the lended tokens.
	 * @return The updated balance of the iTokens owner.
	 * */
	function _burn(
		address _who,
		uint256 _tokenAmount,
		uint256 _assetAmount,
		uint256 _price
	) internal returns (uint256) {
		//bzx compare
		//TODO: Unit test
		uint256 _balance = balances[_who].sub(_tokenAmount, "16");

		// a rounding error may leave dust behind, so we clear this out
		if (_balance <= 10) {
			// We can't leave such small balance quantities.
			_tokenAmount = _tokenAmount.add(_balance);
			_balance = 0;
		}
		balances[_who] = _balance;

		totalSupply_ = totalSupply_.sub(_tokenAmount);

		emit Burn(_who, _tokenAmount, _assetAmount, _price);
		emit Transfer(_who, address(0), _tokenAmount);
		return _balance;
	}
}
