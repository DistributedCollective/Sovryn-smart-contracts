pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../mixins/EnumerableBytes32Set.sol";
import "../../openzeppelin/Ownable.sol";

/**
 * @title Loan Token Logic Beacon contract.
 *
 * @notice This contract stored the target logic implementation of LoanTokens which has the same logic implementation (LoanTokenLogicLM / LoanTokenLogicWrbtc)
 * Apart from storing the target logic implementation, this contract also has a pause functionality.
 * By implementing pause/unpause functionality in this beacon contract, we can pause the loan token that has implement the same Logic (LoanTokenLogicLM / LoanTokenLogicWrbtc) at one call.
 * Meanwhile the pause/unpause function in the LoanTokenLogicProxy is used to pause/unpause in the LoanToken level (1 by 1)
 */

contract LoanTokenLogicBeacon is Ownable {
	using EnumerableBytes32Set for EnumerableBytes32Set.Bytes32Set; // enumerable map of bytes32 or addresses

	mapping(bytes4 => address) public logicTargets;

	/// logicTargets set.
	EnumerableBytes32Set.Bytes32Set internal logicTargetsSet;

	/**
	 * @notice External owner setter for loan token logic target address.
	 * @param sig The function signatures.
	 * @param target The loan token logic target address.
	 */
	function _setTarget(bytes4 sig, address target) internal {
		logicTargets[sig] = target;

		if (target != address(0)) {
			logicTargetsSet.addBytes32(bytes32(sig));
		} else {
			logicTargetsSet.removeBytes32(bytes32(sig));
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
}
