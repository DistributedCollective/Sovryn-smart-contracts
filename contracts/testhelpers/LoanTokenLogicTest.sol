pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../connectors/loantoken/LoanTokenLogicStandard.sol";

contract LoanTokenLogicTest is LoanTokenLogicStandard {
    function getMarginBorrowAmountAndRate(
        uint256 leverageAmount,
        uint256 depositAmount
    ) public view returns (uint256, uint256) {
        return _getMarginBorrowAmountAndRate(leverageAmount, depositAmount);
    }
}
