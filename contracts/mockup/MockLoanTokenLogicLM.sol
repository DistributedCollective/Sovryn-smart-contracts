pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../modules/Affiliates.sol";
import "../connectors/loantoken/modules/beaconLogicLM/LoanTokenLogicLM.sol";
import "../modules/interfaces/ProtocolAffiliatesInterface.sol";
import "../interfaces/ILoanTokenModules.sol";

contract MockLoanTokenLogicLM is LoanTokenLogicLM {
    /*function getAffiliatesUserReferrer(address user) public view returns (address) {
		return affiliatesUserReferrer[user]; // REFACTOR: will be useful if affiliatesUserReferrer visibillity is not public
	}*/

    function getListFunctionSignatures()
        external
        pure
        returns (bytes4[] memory functionSignatures, bytes32 moduleName)
    {
        bytes4[] memory res = new bytes4[](4);

        /** LoanTokenLogicLM function signature */
        res[0] = bytes4(keccak256("mint(address,uint256)"));
        res[1] = bytes4(keccak256("mint(address,uint256,bool)"));
        res[2] = bytes4(keccak256("burn(address,uint256)"));
        res[3] = bytes4(keccak256("burn(address,uint256,bool)"));

        return (res, stringToBytes32("MockLoanTokenLogicLM"));
    }
}
