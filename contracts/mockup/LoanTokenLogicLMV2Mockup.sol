pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../connectors/loantoken/modules/beaconLogicLM/LoanTokenLogicLM.sol";

contract LoanTokenLogicLMV1Mockup is LoanTokenLogicLM {
    function getListFunctionSignatures()
        external
        pure
        returns (bytes4[] memory functionSignatures, bytes32 moduleName)
    {
        bytes4[] memory res = new bytes4[](4);

        // Loan Token LM & OVERLOADING function
        /**
         * @notice BE CAREFUL,
         * LoanTokenLogicStandard also has mint & burn function (overloading).
         * You need to compute the function signature manually --> bytes4(keccak256("mint(address,uint256,bool)"))
         */
        res[0] = bytes4(keccak256("mint(address,uint256)")); /// LoanTokenLogicStandard
        res[1] = bytes4(keccak256("mint(address,uint256,bool)")); /// LoanTokenLogicLM
        res[2] = bytes4(keccak256("burn(address,uint256)")); /// LoanTokenLogicStandard
        res[3] = bytes4(keccak256("burn(address,uint256,bool)")); /// LoanTokenLogicLM

        return (res, stringToBytes32("LoanTokenLogicLM"));
    }
}
