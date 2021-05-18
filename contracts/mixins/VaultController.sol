/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../openzeppelin/SafeERC20.sol";
import "../core/State.sol";

/**
 * @title The Vault Controller contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized margin
 * trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract implements functionality to deposit and withdraw wrBTC and
 * other tokens from the vault.
 * */
contract VaultController is State {
	using SafeERC20 for IERC20;

	event VaultDeposit(address indexed asset, address indexed from, uint256 amount);
	event VaultWithdraw(address indexed asset, address indexed to, uint256 amount);

	/**
	 * @notice Deposit wrBTC into the vault.
	 *
	 * @param from The address of the account paying the deposit.
	 * @param value The amount of wrBTC tokens to transfer.
	 */
	function vaultEtherDeposit(address from, uint256 value) internal {
		IWrbtcERC20 _wrbtcToken = wrbtcToken;
		_wrbtcToken.deposit.value(value)();

		emit VaultDeposit(address(_wrbtcToken), from, value);
	}

	/**
	 * @notice Withdraw wrBTC from the vault.
	 *
	 * @param to The address of the recipient.
	 * @param value The amount of wrBTC tokens to transfer.
	 */
	function vaultEtherWithdraw(address to, uint256 value) internal {
		if (value != 0) {
			IWrbtcERC20 _wrbtcToken = wrbtcToken;
			uint256 balance = address(this).balance;
			if (value > balance) {
				_wrbtcToken.withdraw(value - balance);
			}
			Address.sendValue(to, value);

			emit VaultWithdraw(address(_wrbtcToken), to, value);
		}
	}

	/**
	 * @notice Deposit tokens into the vault.
	 *
	 * @param token The address of the token instance.
	 * @param from The address of the account paying the deposit.
	 * @param value The amount of tokens to transfer.
	 */
	function vaultDeposit(
		address token,
		address from,
		uint256 value
	) internal {
		if (value != 0) {
			IERC20(token).safeTransferFrom(from, address(this), value);

			emit VaultDeposit(token, from, value);
		}
	}

	/**
	 * @notice Withdraw tokens from the vault.
	 *
	 * @param token The address of the token instance.
	 * @param to The address of the recipient.
	 * @param value The amount of tokens to transfer.
	 */
	function vaultWithdraw(
		address token,
		address to,
		uint256 value
	) internal {
		if (value != 0) {
			IERC20(token).safeTransfer(to, value);

			emit VaultWithdraw(token, to, value);
		}
	}

	/**
	 * @notice Transfer tokens from an account into another one.
	 *
	 * @param token The address of the token instance.
	 * @param from The address of the account paying.
	 * @param to The address of the recipient.
	 * @param value The amount of tokens to transfer.
	 */
	function vaultTransfer(
		address token,
		address from,
		address to,
		uint256 value
	) internal {
		if (value != 0) {
			if (from == address(this)) {
				IERC20(token).safeTransfer(to, value);
			} else {
				IERC20(token).safeTransferFrom(from, to, value);
			}
		}
	}

	/**
	 * @notice Approve an allowance of tokens to be spent by an account.
	 *
	 * @param token The address of the token instance.
	 * @param to The address of the spender.
	 * @param value The amount of tokens to allow.
	 */
	function vaultApprove(
		address token,
		address to,
		uint256 value
	) internal {
		if (value != 0 && IERC20(token).allowance(address(this), to) != 0) {
			IERC20(token).safeApprove(to, 0);
		}
		IERC20(token).safeApprove(to, value);
	}
}
