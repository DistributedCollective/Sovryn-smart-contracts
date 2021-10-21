/**
 * In order to test some functionalities like Pausable::pausable() modifier,
 * it is required to add a contract to invoke them and get a full coverage on tests.
 */

pragma solidity 0.5.17;

import "../connectors/loantoken/Pausable.sol";
import "../governance/Staking/SafeMath96.sol";

contract TestCoverage is Pausable, SafeMath96 {
	/// @dev Pausable is currently an unused contract that still is operative
	///   because margin trade flashloan functionality has been commented out.
	///   In case it were restored, contract would become used again, so for a
	///   complete test coverage it is required to test it.

	function dummyPausableFunction() external pausable(msg.sig) {
		/// @dev do nothing, just to check if modifier is working
	}

	/// @dev This function should be located on Pausable contract in the case
	///   it has to be used again by flashloan restoration.
	function togglePause(
		string memory funcId, // example: "mint(uint256,uint256)"
		bool isPaused
	) public {
		/// keccak256("Pausable_FunctionPause")
		bytes32 slot =
			keccak256(
				abi.encodePacked(
					bytes4(keccak256(abi.encodePacked(funcId))),
					uint256(0xa7143c84d793a15503da6f19bf9119a2dac94448ca45d77c8bf08f57b2e91047)
				)
			);

		// solhint-disable-next-line no-inline-assembly
		assembly {
			sstore(slot, isPaused)
		}
	}

	/// @dev Testing internal functions of governance/Staking/SafeMath96.sol
	function testSafeMath96_safe32_Ok(uint256 n) public pure returns (uint32) {
		// Shouldn't overflow
		return safe32(n, "overflow");
	}

	function testSafeMath96_safe32_Overflow() public pure {
		// Should overflow, revert error
		safe32(2**32, "overflow");
	}
}
