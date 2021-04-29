/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./LoanTokenLogicStandard.sol";

/**
 * @title Loan Token Logic for wrBTC contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized margin
 * trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * Wrapped RSK BTC (wrBTC) is the ERC-20 token pegged to Bitcoin. This contract
 * manages loan functionalities deployed as un upgradable logic instance.
 * */
contract LoanTokenLogicWrbtc is LoanTokenLogicStandard {
	/**
	* @notice Mint wrBTC tokens.
	* @dev External wrapper that calls _mintToken internal function.
	* @param receiver The address to get the minted tokens.
	* @return mintAmount The amount of tokens minted.
	* */
	function mintWithBTC(address receiver) external payable nonReentrant returns (uint256 mintAmount) {
		return _mintToken(receiver, msg.value);
	}

	/**
	* @notice Burn wrBTC tokens.
	* @dev External wrapper that calls _burnToken internal function
	*   and withdraws rBTC value.
	* @param receiver The address to get the rBTC value.
	* @return mintAmount The amount of tokens minted.
	* */
	function burnToBTC(address receiver, uint256 burnAmount) external nonReentrant returns (uint256 loanAmountPaid) {
		loanAmountPaid = _burnToken(burnAmount);

		if (loanAmountPaid != 0) {
			IWrbtcERC20(wrbtcTokenAddress).withdraw(loanAmountPaid);
			Address.sendValue(receiver, loanAmountPaid);
		}
	}

	/* Internal functions */

	/**
	* @notice Handle transfers prior to adding newPrincipal to loanTokenSent.
	*
	* @param collateralTokenAddress The address of the collateral token.
	* @param sentAddresses The array of addresses:
	*   sentAddresses[0]: lender
	*   sentAddresses[1]: borrower
	*   sentAddresses[2]: receiver
	*   sentAddresses[3]: manager
    *
	* @param sentAmounts The array of amounts:
	*   sentAmounts[0]: interestRate
	*   sentAmounts[1]: newPrincipal
	*   sentAmounts[2]: interestInitialAmount
	*   sentAmounts[3]: loanTokenSent
	*   sentAmounts[4]: collateralTokenSent
	*
	* @param withdrawalAmount The amount to withdraw.
	*
	* @return msgValue The amount of value sent.
	* */
	function _verifyTransfers(
		address collateralTokenAddress,
		address[4] memory sentAddresses,
		uint256[5] memory sentAmounts,
		uint256 withdrawalAmount
	) internal returns (uint256 msgValue) {
		address _wrbtcToken = wrbtcTokenAddress;
		address _loanTokenAddress = _wrbtcToken;
		address receiver = sentAddresses[2];
		uint256 newPrincipal = sentAmounts[1];
		uint256 loanTokenSent = sentAmounts[3];
		uint256 collateralTokenSent = sentAmounts[4];

		require(_loanTokenAddress != collateralTokenAddress, "26");

		msgValue = msg.value;

		if (withdrawalAmount != 0) {
			/// withdrawOnOpen == true
			IWrbtcERC20(_wrbtcToken).withdraw(withdrawalAmount);
			Address.sendValue(receiver, withdrawalAmount);
			if (newPrincipal > withdrawalAmount) {
				_safeTransfer(_loanTokenAddress, sovrynContractAddress, newPrincipal - withdrawalAmount, "");
			}
		} else {
			_safeTransfer(_loanTokenAddress, sovrynContractAddress, newPrincipal, "27");
		}

		if (collateralTokenSent != 0) {
			_safeTransferFrom(collateralTokenAddress, msg.sender, sovrynContractAddress, collateralTokenSent, "28");
		}

		if (loanTokenSent != 0) {
			if (msgValue != 0 && msgValue >= loanTokenSent) {
				IWrbtc(_wrbtcToken).deposit.value(loanTokenSent)();
				_safeTransfer(_loanTokenAddress, sovrynContractAddress, loanTokenSent, "29");
				msgValue -= loanTokenSent;
			} else {
				_safeTransferFrom(_loanTokenAddress, msg.sender, sovrynContractAddress, loanTokenSent, "29");
			}
		}
	}
}
