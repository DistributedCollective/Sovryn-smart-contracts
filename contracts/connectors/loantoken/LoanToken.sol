/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "./AdvancedTokenStorage.sol";

/**
 * @title Loan Token contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * A loan token (iToken) is created as a proxy to an upgradable token contract.
 *
 * Examples of loan tokens on Sovryn are iRBTC, iDOC, iUSDT, iBPro,
 * iSOV (near future).
 *
 * Lenders receive iTokens that collect interest from the lending pool
 * which they can redeem by withdrawing them. The i in iToken stands for interest.
 *
 * Do not confuse iTokens with underlying tokens. iDOC is an iToken (loan token)
 * whilest DOC is the underlying token (currency).
 *
 * @dev TODO: can I change this proxy to EIP-1822 proxy standard, please.
 *   https://eips.ethereum.org/EIPS/eip-1822. It's really hard to work with this.
 * */
contract LoanToken is AdvancedTokenStorage {
	/// @dev It is important to maintain the variables order so the delegate
	/// calls can access sovrynContractAddress and wrbtcTokenAddress
	address public sovrynContractAddress;
	address public wrbtcTokenAddress;
	address internal target_;
	address public admin;

	/**
	 * @notice Deploy loan token proxy.
	 *   Sets ERC20 parameters of the token.
	 *
	 * @param _newOwner The address of the new owner.
	 * @param _newTarget The address of the new target contract instance.
	 * @param _sovrynContractAddress The address of the new sovrynContract instance.
	 * @param _wrbtcTokenAddress The address of the new wrBTC instance.
	 * */
	constructor(
		address _newOwner,
		address _newTarget,
		address _sovrynContractAddress,
		address _wrbtcTokenAddress
	) public {
		transferOwnership(_newOwner);
		_setTarget(_newTarget);
		_setSovrynContractAddress(_sovrynContractAddress);
		_setWrbtcTokenAddress(_wrbtcTokenAddress);
	}

	/**
	 * @notice Fallback function performs a delegate call
	 * to the actual implementation address is pointing this proxy.
	 * Returns whatever the implementation call returns.
	 * */
	function() external payable {
		if (gasleft() <= 2300) {
			return;
		}

		address target = target_;
		bytes memory data = msg.data;
		assembly {
			let result := delegatecall(gas, target, add(data, 0x20), mload(data), 0, 0)
			let size := returndatasize
			let ptr := mload(0x40)
			returndatacopy(ptr, 0, size)
			switch result
				case 0 {
					revert(ptr, size)
				}
				default {
					return(ptr, size)
				}
		}
	}

	/**
	 * @notice Public owner setter for target address.
	 * @dev Calls internal setter.
	 * @param _newTarget The address of the new target contract instance.
	 * */
	function setTarget(address _newTarget) public onlyOwner {
		_setTarget(_newTarget);
	}

	/**
	 * @notice Internal setter for target address.
	 * @param _newTarget The address of the new target contract instance.
	 * */
	function _setTarget(address _newTarget) internal {
		require(Address.isContract(_newTarget), "target not a contract");
		target_ = _newTarget;
	}

	/**
	 * @notice Internal setter for sovrynContract address.
	 * @param _sovrynContractAddress The address of the new sovrynContract instance.
	 * */
	function _setSovrynContractAddress(address _sovrynContractAddress) internal {
		require(Address.isContract(_sovrynContractAddress), "sovryn not a contract");
		sovrynContractAddress = _sovrynContractAddress;
	}

	/**
	 * @notice Internal setter for wrBTC address.
	 * @param _wrbtcTokenAddress The address of the new wrBTC instance.
	 * */
	function _setWrbtcTokenAddress(address _wrbtcTokenAddress) internal {
		require(Address.isContract(_wrbtcTokenAddress), "wrbtc not a contract");
		wrbtcTokenAddress = _wrbtcTokenAddress;
	}

	/**
	 * @notice Public owner cloner for pointed loan token.
	 *   Sets ERC20 parameters of the token.
	 *
	 * @dev TODO: add check for double init.
	 *   idk but init usually can be called only once.
	 *
	 * @param _loanTokenAddress The address of the pointed loan token instance.
	 * @param _name The ERC20 token name.
	 * @param _symbol The ERC20 token symbol.
	 * */
	function initialize(
		address _loanTokenAddress,
		string memory _name,
		string memory _symbol
	) public onlyOwner {
		loanTokenAddress = _loanTokenAddress;

		name = _name;
		symbol = _symbol;
		decimals = IERC20(loanTokenAddress).decimals();

		initialPrice = 10**18; /// starting price of 1
	}
}
