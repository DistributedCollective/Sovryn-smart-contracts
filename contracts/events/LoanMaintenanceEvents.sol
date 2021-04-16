pragma solidity 0.5.17;

contract LoanMaintenanceEvents {
	event DepositCollateral(bytes32 loanId, uint256 depositAmount, uint256 rate);
}
