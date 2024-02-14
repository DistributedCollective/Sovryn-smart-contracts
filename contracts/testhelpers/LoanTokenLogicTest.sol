pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../connectors/loantoken/modules/beaconLogicLM/LoanTokenLogic.sol";

contract LoanTokenLogicTest is LoanTokenLogic {
    function getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount)
        public
        view
        returns (uint256, uint256)
    {
        return _getMarginBorrowAmountAndRate(leverageAmount, depositAmount);
    }
}
