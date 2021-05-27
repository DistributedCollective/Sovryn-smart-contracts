pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;
// "SPDX-License-Identifier: Apache-2.0"

import "../interfaces/IERC20.sol";
import "../openzeppelin/Ownable.sol";
import "../openzeppelin/ReentrancyGuard.sol";
import "./ITokenFlashLoanTest.sol";

/**
 * @title Flash Loan Mockup.
 * @notice This contract simulates a third party loan pool providing FL.
 *   It just does this:
 *   1.- provides a big amount of underlying tokens.
 *   2.- executes a transaction.
 *   3.- expectes the big amount of underlying tokens to be returned, otherwise reverts.
 *
 * @dev Flash Loans are uncolaterized loans that are required to be returned
 *   in the same transaction. There is no real world analogy. the closes you
 *   can compare is with overnight market or Repurchase Agreement but
 *   without collateral.
 * */
contract FlashLoanMockup is Ownable, ReentrancyGuard {
	/* Storage */
	/// @dev Used by flashBorrow to call using an arbitrary address.
	address internal constant arbitraryCaller = 0x000F400e6818158D541C3EBE45FE3AA0d47372FF;

	/// @dev The address of the underlying token.
	address loanTokenAddress;

	/* Events */
	event FlashBorrow(uint256 borrowAmount, address borrower, address target, string signature, bytes data);

	/* Functions */

	/**
	 * @notice Set the parameters of the fake loan pool.
	 * @param _loanTokenAddress The address of the underlying token.
	 * */
	function settings(address _loanTokenAddress) external onlyOwner {
		loanTokenAddress = _loanTokenAddress;
	}

	/**
	 * @notice Execute the FL.
	 * @param borrowAmount The borrowing principal.
	 * @param borrower The address of the borrower to send the tokens to.
	 * @param target The address of the contract to callback.
	 * @param signature The callback function signature.
	 * @param data The callback input data payload.
	 * */
	function flashBorrow(
		uint256 borrowAmount,
		address borrower,
		address target,
		string calldata signature,
		bytes calldata data
	) external payable nonReentrant returns (bytes memory) {
		/// @dev Save the token balance previous to sending the tokens.
		uint256 beforeUnderlyingBalance = IERC20(loanTokenAddress).balanceOf(address(this));

		/// @dev Transfer the tokens to the borrower.
		_safeTransfer(loanTokenAddress, borrower, borrowAmount, "flashBorrow::Cannot send tokens to calling contract.");

		/// @dev Event log.
		emit FlashBorrow(borrowAmount, borrower, target, signature, data);

		/// @dev signature + data => callData
		bytes memory callData;
		if (bytes(signature).length == 0) {
			callData = data;
		} else {
			callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
		}

		/// @dev Execute the callback function.
		(bool success, bytes memory returnData) =
			target.call(
				callData
			);
     
		// require(success, "flashBorrow::Call failed.");
        require(success, string (returnData));

		/// @dev Verify return of flash loan.
		require(
            beforeUnderlyingBalance <= IERC20(loanTokenAddress).balanceOf(address(this)),
            "flashBorrow::Flash loan not returned."
        );

		return returnData;
	}

	/**
	 * @notice Execute the ERC20 token's `transfer` function and reverts
	 * upon failure the main purpose of this function is to prevent a non
	 * standard ERC20 token from failing silently.
	 *
	 * @dev Wrappers around ERC20 operations that throw on failure (when the
	 * token contract returns false). Tokens that return no value (and instead
	 * revert or throw on failure) are also supported, non-reverting calls are
	 * assumed to be successful.
	 *
	 * @param token The ERC20 token address.
	 * @param to The target address.
	 * @param amount The transfer amount.
	 * @param errorMsg The error message on failure.
	 */
	function _safeTransfer(
		address token,
		address to,
		uint256 amount,
		string memory errorMsg
	) internal {
		_callOptionalReturn(token, abi.encodeWithSelector(IERC20(token).transfer.selector, to, amount), errorMsg);
	}

	/**
	 * @notice Imitate a Solidity high-level call (i.e. a regular function
	 * call to a contract), relaxing the requirement on the return value:
	 * the return value is optional (but if data is returned, it must not be
	 * false).
	 *
	 * @param token The token targeted by the call.
	 * @param data The call data (encoded using abi.encode or one of its variants).
	 * @param errorMsg The error message on failure.
	 * */
	function _callOptionalReturn(
		address token,
		bytes memory data,
		string memory errorMsg
	) internal {
		(bool success, bytes memory returndata) = token.call(data);
		require(success, errorMsg);

		if (returndata.length != 0) {
			require(abi.decode(returndata, (bool)), errorMsg);
		}
	}
}
