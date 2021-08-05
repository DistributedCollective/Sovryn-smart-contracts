pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../mixins/EnumerableBytes32Set.sol";
import "../../openzeppelin/Pausable.sol";
import "../../openzeppelin/Address.sol";

/**
 * @title Loan Token Logic Beacon contract.
 *
 * @notice This contract stored the target logic implementation of LoanTokens which has the same logic implementation (LoanTokenLogicLM / LoanTokenLogicWrbtc)
 * Apart from storing the target logic implementation, this contract also has a pause functionality.
 * By implementing pause/unpause functionality in this beacon contract, we can pause the loan token that has implement the same Logic (LoanTokenLogicLM / LoanTokenLogicWrbtc) at one call.
 * Meanwhile the pause/unpause function in the LoanTokenLogicProxy is used to pause/unpause in the LoanToken level (1 by 1)
 */

contract LoanTokenLogicBeacon is Pausable {
	using EnumerableBytes32Set for EnumerableBytes32Set.Bytes32Set; // enumerable map of bytes32 or addresses

	mapping(bytes4 => address) private logicTargets;

	/// logicTargets set.
	EnumerableBytes32Set.Bytes32Set internal logicTargetsSet;

  /**
   * @dev Modifier to make a function callable only when the contract is not paused.
   * This is the overriden function from the pausable contract, so that we can use custom error message.
   */
  modifier whenNotPaused() {
      require(!_paused, "LoanTokenLogicBeacon:paused mode");
      _;
  }

  /**
   */
  function registerLoanTokenModule(address loanTokenModuleAddress) external onlyOwner {
    require(Address.isContract(loanTokenModuleAddress), "LoanTokenModuleAddress is not a contract");

    // Get the list of function signature on this loanTokenModulesAddress
    bytes4[] memory functionSignatureList = ILoanTokenLogicModules(loanTokenModuleAddress).getListFunctionSignatures();

    for(uint i; i < functionSignatureList.length; i++) {
      logicTargets[functionSignatureList[i]] = loanTokenModuleAddress;
      logicTargetsSet.addBytes32(functionSignatureList[i]);
    }
  }

  /**
	 * @notice External getter for target addresses.
	 * @param sig The signature.
	 * @return The address for a given signature.
	 * */
	function getTarget(bytes4 sig) external view whenNotPaused returns (address) {
		return logicTargets[sig];
	}
}

interface ILoanTokenLogicModules {
  function getListFunctionSignatures() external pure returns(bytes4[] memory);
}