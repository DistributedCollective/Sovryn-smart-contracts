/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

/**
 * @title Pausable contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized margin
 * trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * The contract implements pausable functionality by reading on slots the
 * pause state of contract functions.
 * */
contract Pausable {
	/// keccak256("Pausable_FunctionPause")
	bytes32 internal constant Pausable_FunctionPause = 0xa7143c84d793a15503da6f19bf9119a2dac94448ca45d77c8bf08f57b2e91047;

	modifier pausable(bytes4 sig) {
		require(!_isPaused(sig), "unauthorized");
		_;
	}

	/**
	 * @notice Check whether a function is paused.
	 *
	 * @dev Used to read externally from the smart contract to see if a
	 *   function is paused.
	 *
	 * @param sig The function ID, the selector on bytes4.
	 *
	 * @return isPaused Whether the function is paused: true or false.
	 * */
	function _isPaused(bytes4 sig) internal view returns (bool isPaused) {
		bytes32 slot = keccak256(abi.encodePacked(sig, Pausable_FunctionPause));
		assembly {
			isPaused := sload(slot)
		}
	}
}
