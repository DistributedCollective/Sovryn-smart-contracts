pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../mixins/EnumerableBytes32Set.sol";
import "../../mixins/EnumerableBytes4Set.sol";
import "../../openzeppelin/PausableOz.sol";
import "../../openzeppelin/Address.sol";

/**
 * @title Loan Token Logic Beacon contract.
 *
 * @notice This contract stored the target logic implementation of LoanTokens which has the same logic implementation (LoanTokenLogicLM / LoanTokenLogicWrbtc)
 * Apart from storing the target logic implementation, this contract also has a pause functionality.
 * By implementing pause/unpause functionality in this beacon contract, we can pause the loan token that has the same Logic (LoanTokenLogicLM / LoanTokenLogicWrbtc) at one call.
 * Meanwhile the pause/unpause function in the LoanTokenLogicProxy is used to pause/unpause specific LoanToken
 */

contract LoanTokenLogicBeacon is PausableOz {
	using EnumerableBytes32Set for EnumerableBytes32Set.Bytes32Set; // enumerable map of bytes32 or addresses
	using EnumerableBytes4Set for EnumerableBytes4Set.Bytes4Set; // enumerable map of bytes4 or addresses

	struct LogicTarget {
		bytes32 moduleName; // module (logic) name
		address moduleAddress; // module (logic) address
	}

	mapping(bytes4 => LogicTarget) private logicTargets;

	struct LoanTokenLogicModuleUpdate {
		address implementation; // address implementaion of the module
		uint256 updateTimestamp; // time of update
	}

	mapping(bytes32 => LoanTokenLogicModuleUpdate[]) public moduleUpgradeLog; /** the module name as the key */

	mapping(bytes32 => uint256) public activeModuleIndex; /** To store the current active index log for module */

	mapping(bytes32 => EnumerableBytes4Set.Bytes4Set) private activeFuncSignatureList; /** Store the current active function signature  */

	/**
	 * @dev Modifier to make a function callable only when the contract is not paused.
	 * This is the overriden function from the pausable contract, so that we can use custom error message.
	 */
	modifier whenNotPaused() {
		require(!_paused, "LoanTokenLogicBeacon:paused mode");
		_;
	}

	/**
	 * @notice Register the loanTokenModule (LoanTokenSettingsLowerAdmin, LoanTokenLogicLM / LoanTokenLogicWrbtc, etc)
	 *
	 * @dev This function will store the updated protocol module to the storage (For rollback purposes)
	 *
	 * @param loanTokenModuleAddress The module target address
	 */
	function registerLoanTokenModule(address loanTokenModuleAddress) external onlyOwner {
		bytes32 moduleName = _registerLoanTokenModule(loanTokenModuleAddress, false);

		// Store the upgrade to the log
		moduleUpgradeLog[moduleName].push(LoanTokenLogicModuleUpdate(loanTokenModuleAddress, block.timestamp));
		activeModuleIndex[moduleName] = moduleUpgradeLog[moduleName].length - 1;
	}

	/**
	 * @notice Register the loanTokenModule (LoanTokenSettingsLowerAdmin, LoanTokenLogicLM / LoanTokenLogicWrbtc, etc)
	 *
	 * CAUTION! Use this function only(!) if you do need to overwrite functions outside the scope of the module
	 *
	 * @dev This function will store the updated protocol module to the storage (For rollback purposes)
	 *
	 * @param loanTokenModuleAddress The module target address
	 */
	function registerLoanTokenModuleAdvanced(address loanTokenModuleAddress) external onlyOwner {
		bytes32 moduleName = _registerLoanTokenModule(loanTokenModuleAddress, true);

		// Store the upgrade to the log
		moduleUpgradeLog[moduleName].push(LoanTokenLogicModuleUpdate(loanTokenModuleAddress, block.timestamp));
		activeModuleIndex[moduleName] = moduleUpgradeLog[moduleName].length - 1;
	}

	/**
	 * @notice Register the loanTokenModule (LoanTokenSettingsLowerAdmin, LoanTokenLogicLM / LoanTokenLogicWrbtc, etc)
	 *
	 * @dev This registration will require target contract to have the exact function getListFunctionSignatures() which will return functionSignatureList and the moduleName in bytes32
	 *
	 * @param loanTokenModuleAddress the target logic of the loan token module
	 * @param replaceOtherModulesFuncs allows overwriting other modules functions
	 *
	 * @return the module name
	 */
	function _registerLoanTokenModule(address loanTokenModuleAddress, bool replaceOtherModulesFuncs) private returns (bytes32) {
		require(Address.isContract(loanTokenModuleAddress), "LoanTokenModuleAddress is not a contract");

		// Get the list of function signature on this loanTokenModulesAddress
		(bytes4[] memory functionSignatureList, bytes32 moduleName) =
			ILoanTokenLogicModules(loanTokenModuleAddress).getListFunctionSignatures();

		/// register / update the module function signature address implementation
		for (uint256 i; i < functionSignatureList.length; i++) {
			bytes4 funcSig = functionSignatureList[i];
			require(funcSig != bytes4(0x0), "ERR_EMPTY_FUNC_SIGNATURE");

			if (!replaceOtherModulesFuncs) require(logicTargets[funcSig].moduleName == moduleName, "ERR_NO_OTHER_MODULE_FUNC_REPLACEMENTS");
			else if (logicTargets[funcSig].moduleName != bytes32(0x0) && logicTargets[funcSig].moduleName != moduleName) {
				activeFuncSignatureList[logicTargets[funcSig].moduleName].removeBytes4(funcSig);
			}

			logicTargets[funcSig] = LogicTarget(moduleName, loanTokenModuleAddress);

			if (!activeFuncSignatureList[moduleName].contains(funcSig)) activeFuncSignatureList[moduleName].addBytes4(funcSig);
		}

		/// delete the "removed" module function signature in the current implementation
		bytes4[] memory activeSignatureListEnum =
			activeFuncSignatureList[moduleName].enumerate(0, activeFuncSignatureList[moduleName].length());
		for (uint256 i; i < activeSignatureListEnum.length; i++) {
			bytes4 activeSigBytes = activeSignatureListEnum[i];
			if (logicTargets[activeSigBytes].moduleAddress != loanTokenModuleAddress) {
				logicTargets[activeSigBytes].moduleAddress = address(0);
				activeFuncSignatureList[moduleName].removeBytes4(activeSigBytes);
			}
		}

		return moduleName;
	}

	/**
	 * @dev get all active function signature list based on the module name.
	 *
	 * @param moduleName in bytes32.
	 *
	 * @return the array of function signature.
	 */
	function getActiveFuncSignatureList(bytes32 moduleName) public view returns (bytes4[] memory signatureList) {
		signatureList = activeFuncSignatureList[moduleName].enumerate(0, activeFuncSignatureList[moduleName].length());
		return signatureList;
	}

	/**
	 * @dev Get total length of the module upgrade log.
	 *
	 * @param moduleName in bytes32.
	 *
	 * @return length of module upgrade log.
	 */
	function getModuleUpgradeLogLength(bytes32 moduleName) external view returns (uint256) {
		return moduleUpgradeLog[moduleName].length;
	}

	/**
	 * @notice This function will rollback particular module to the spesific index / version of deployment
	 *
	 * @param moduleName Name of module in bytes32 format
	 * @param index index / version of previous deployment
	 */
	function rollback(bytes32 moduleName, uint256 index) external onlyOwner {
		address loanTokenModuleAddress = moduleUpgradeLog[moduleName][index].implementation;
		moduleName = _registerLoanTokenModule(loanTokenModuleAddress, false);
		activeModuleIndex[moduleName] = index;
	}

	/**
	 * @notice External getter for target.
	 * @param sig The signature.
	 * @return The address for a given signature.
	 * */
	function getTarget(bytes4 sig) external view whenNotPaused returns (LogicTarget memory) {
		return logicTargets[sig];
	}

	/**
	 * @notice External getter for target address.
	 * @param sig The signature.
	 * @return The address for a given signature.
	 * */
	function getTargetAddress(bytes4 sig) external view whenNotPaused returns (address) {
		return logicTargets[sig].moduleAddress;
	}
}

interface ILoanTokenLogicModules {
	function getListFunctionSignatures() external pure returns (bytes4[] memory, bytes32 moduleName);
}
