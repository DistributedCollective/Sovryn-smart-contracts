pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;
// "SPDX-License-Identifier: Apache-2.0"

import "../interfaces/IERC20.sol";

interface IToken {
    function burn(address receiver, uint256 burnAmount) external returns (uint256 loanAmountPaid);
    function mint(address receiver, uint256 depositAmount) external returns (uint256 mintAmount);
	function borrow(
		bytes32 loanId, /// 0 if new loan.
		uint256 withdrawAmount,
		uint256 initialLoanDuration, /// Duration in seconds.
		uint256 collateralTokenSent, /// If 0, loanId must be provided; any rBTC sent must equal this value.
		address collateralTokenAddress, /// If address(0), this means rBTC and rBTC must be sent with the call or loanId must be provided.
		address borrower,
		address receiver,
		bytes calldata /// loanDataBytes: arbitrary order data (for future use).
	)
		external
		payable
		returns (
			uint256,
			uint256 /// Returns new principal and new collateral added to loan.
		);
}

contract MintLoanAndBorrowTest {
	function callMintAndBorrowAndBurn(
		address loanToken,
		address iToken,
		uint256 flashLoanAmount
	) public {
		IToken iTokenContract = IToken(iToken);
        IERC20(iToken).approve(address(this), flashLoanAmount);
		iTokenContract.mint(address(this), flashLoanAmount);
        iTokenContract.borrow("0x0", flashLoanAmount, 86400, 1000, loanToken, address(this), address(this), "0x0");
        iTokenContract.burn(address(this), flashLoanAmount);
	}
}
