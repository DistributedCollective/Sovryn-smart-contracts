/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../../openzeppelin/Ownable.sol";

contract Pausable is Ownable {
	// keccak256("Pausable_FunctionPause")
	bytes32 internal constant Pausable_FunctionPause = 0xa7143c84d793a15503da6f19bf9119a2dac94448ca45d77c8bf08f57b2e91047;

	address public pauser;

	modifier pausable(bytes4 sig) {
		require(!_isPaused(sig), "unauthorized");
		_;
	}

	function _isPaused(bytes4 sig) internal view returns (bool isPaused) {
		bytes32 slot = keccak256(abi.encodePacked(sig, Pausable_FunctionPause));
		assembly {
			isPaused := sload(slot)
		}
	}

	function setPauser(address _pauser) public onlyOwner {
		pauser = _pauser;
	}

	function toggleFunctionPause(
		string memory funcId, // example: "mint(uint256,uint256)"
		bool isPaused
	) public {
		require(msg.sender == pauser, "onlyPauser");
		// keccak256("iToken_FunctionPause")
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
}
