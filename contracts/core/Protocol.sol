/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./State.sol";

/**
 * @title Sovryn Protocol contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract contains the proxy functionality to deploy Protocol anchor
 * and logic apart, turning it upgradable.
 *
 * @dev TODO: can I change this proxy to EIP-1822 proxy standard, please.
 *   https://eips.ethereum.org/EIPS/eip-1822
 * */
contract sovrynProtocol is State {
	/**
	 * @notice Fallback function performs a delegate call
	 * to the actual implementation address is pointing this proxy.
	 * Returns whatever the implementation call returns.
	 * */
	function() external payable {
		if (gasleft() <= 2300) {
			return;
		}

		address target = logicTargets[msg.sig];
		require(target != address(0), "target not active");

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
	 * @notice External owner target initializer.
	 * @param target The target addresses.
	 * */
	function replaceContract(address target) external onlyOwner {
		(bool success, ) = target.delegatecall(abi.encodeWithSignature("initialize(address)", target));
		require(success, "setup failed");
	}

	/**
	 * @notice External owner setter for target addresses.
	 * @param sigsArr The array of signatures.
	 * @param targetsArr The array of addresses.
	 * */
	function setTargets(string[] calldata sigsArr, address[] calldata targetsArr) external onlyOwner {
		require(sigsArr.length == targetsArr.length, "count mismatch");

		for (uint256 i = 0; i < sigsArr.length; i++) {
			_setTarget(bytes4(keccak256(abi.encodePacked(sigsArr[i]))), targetsArr[i]);
		}
	}

	/**
	 * @notice External getter for target addresses.
	 * @param sig The signature.
	 * @return The address for a given signature.
	 * */
	function getTarget(string calldata sig) external view returns (address) {
		return logicTargets[bytes4(keccak256(abi.encodePacked(sig)))];
	}
}
