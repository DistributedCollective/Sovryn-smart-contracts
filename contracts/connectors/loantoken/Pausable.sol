/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../core/State.sol";

/**
 * @title bZx Pausable contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized margin
 * trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * The contract implements pausable functionality by reading on slots the
 * pause state of contract functions.
 *
 * @dev Only applicable to delegated calls through proxy.
 * */
contract Pausable is Ownable {
	/// keccak256("Pausable_FunctionPause")
	bytes32 internal constant Pausable_FunctionPause = 0xa7143c84d793a15503da6f19bf9119a2dac94448ca45d77c8bf08f57b2e91047;

	address public pauser;

	/// @notice Pause state flag for module granurality.
	mapping(address => bool) public moduleIsPaused;

	/// @notice Pause global state flag. It pauses the whole protocol.
	bool public protocolPaused;

	modifier pausable() {
		_checkPause();
		_;
	}

	/*
	modifier pausable(bytes4 sig) {
		require(!_isPaused(sig), "unauthorized");
		_;
	}
*/
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
	/*	function _isPaused(bytes4 sig) internal view returns (bool isPaused) {
		bytes32 slot = keccak256(abi.encodePacked(sig, Pausable_FunctionPause));
		assembly {
			isPaused := sload(slot)
		}
	}*/

	/**
	 * @notice Public verification if the called function is paused.
	 * @return isPaused The current pause status.
	 * */
	function checkPause(string memory signature) public view returns (bool isPaused) {
		///keccak256("iToken_FunctionPause")
		bytes32 slot =
			keccak256(
				abi.encodePacked(
					bytes4(keccak256(bytes(signature))),
					uint256(0xd46a704bc285dbd6ff5ad3863506260b1df02812f4f857c8cc852317a6ac64f2)
				)
			);
		assembly {
			isPaused := sload(slot)
		}
	}

	/**
	 * @notice Used for internal verification if the called function is paused.
	 *   Throws an exception in case it's not.
	 * */
	function _checkPause() internal view {
		///keccak256("iToken_FunctionPause")
		bytes32 slot = keccak256(abi.encodePacked(msg.sig, uint256(0xd46a704bc285dbd6ff5ad3863506260b1df02812f4f857c8cc852317a6ac64f2)));
		bool isPaused;
		assembly {
			isPaused := sload(slot)
		}
		require(!isPaused, "Function paused. It cannot be executed.");
	}

	/**
	 * @notice Set the pauser account allowed to toggle on and off the pause state.
	 *
	 * @param _pauser The address of the pauser to give clearance.
	 * */
	function setPauser(address _pauser) public onlyOwner {
		pauser = _pauser;
	}

	/**
	 * @notice Toggle on and off the pause state.
	 *
	 * @param funcId The function selector to pause.
	 * @param isPaused The pause state (true or false).
	 * */
	function toggleFunctionPause(
		string memory funcId, /// Example: "mint(uint256,uint256)"
		bool isPaused
	) public {
		require(msg.sender == pauser, "onlyPauser");
		/// keccak256("iToken_FunctionPause")
		bytes32 slot =
			keccak256(
				abi.encodePacked(
					bytes4(keccak256(abi.encodePacked(funcId))),
					uint256(0xd46a704bc285dbd6ff5ad3863506260b1df02812f4f857c8cc852317a6ac64f2)
				)
			);
		assembly {
			sstore(slot, isPaused)
		}
	}

	function _debug_toggleFunctionPause(
		string memory funcId
	) public view returns (bytes32) {
		/// keccak256("iToken_FunctionPause")
		bytes32 slot =
			keccak256(
				abi.encodePacked(
					bytes4(keccak256(abi.encodePacked(funcId))),
					uint256(0xd46a704bc285dbd6ff5ad3863506260b1df02812f4f857c8cc852317a6ac64f2)
				)
			);
		return slot;
	}

	function toggleProtocolPause(bool isPaused) public {
		// require(msg.sender == pauser, "onlyPauser");
		protocolPaused = isPaused;
	}

	function toggleModulePause(address module, bool isPaused) public {
		// require(msg.sender == pauser, "onlyPauser");
		moduleIsPaused[module] = isPaused;
	}
}
