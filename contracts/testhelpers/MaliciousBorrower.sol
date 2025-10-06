/**
 * @title MaliciousBorrower contract for testing liquidation blocking vulnerability
 * @notice This contract simulates a malicious borrower that reverts in receive() function
 * to test the liquidation blocking fix
 */
pragma solidity 0.5.17;

import "../interfaces/ILoanTokenModules.sol";
import "../interfaces/IERC20.sol";

contract MaliciousBorrower {
    /**
     * @notice Fallback function that always reverts to simulate malicious behavior
     * This prevents the liquidation process from sending RBTC refunds to this contract
     */
    function() external payable {
        revert("MaliciousBorrower: fallback() always reverts");
    }

    /**
     * @notice Approve token spending for loan operations
     * @param token The token address to approve
     * @param spender The address to approve spending for
     * @param amount The amount to approve
     */
    function approveToken(address token, address spender, uint256 amount) external {
        IERC20(token).approve(spender, amount);
    }

    /**
     * @notice Perform a margin trade using this contract as the borrower
     * @param loanToken The loan token contract address
     * @param loanId The loan ID (0 for new loan)
     * @param leverageAmount The leverage amount
     * @param loanTokenSent The amount of loan tokens sent
     * @param collateralTokenSent The amount of collateral tokens sent
     * @param collateralTokenAddress The collateral token address
     * @param minEntryPrice The minimum entry price
     * @param loanDataBytes Additional loan data
     */
    function performMarginTrade(
        address loanToken,
        bytes32 loanId,
        uint256 leverageAmount,
        uint256 loanTokenSent,
        uint256 collateralTokenSent,
        address collateralTokenAddress,
        uint256 minEntryPrice,
        bytes calldata loanDataBytes
    ) external payable returns (uint256, uint256) {
        return
            ILoanTokenModules(loanToken).marginTrade(
                loanId,
                leverageAmount,
                loanTokenSent,
                collateralTokenSent,
                collateralTokenAddress,
                address(this), // This contract is the borrower
                minEntryPrice,
                loanDataBytes
            );
    }

    /**
     * @notice Perform a borrow operation using this contract as the borrower
     * @param loanToken The loan token contract address
     * @param loanId The loan ID (0 for new loan)
     * @param withdrawAmount The amount to withdraw
     * @param initialLoanDuration The initial loan duration
     * @param collateralTokenSent The amount of collateral tokens sent
     * @param collateralTokenAddress The collateral token address
     * @param receiver The receiver address
     * @param loanDataBytes Additional loan data
     */
    function performBorrow(
        address loanToken,
        bytes32 loanId,
        uint256 withdrawAmount,
        uint256 initialLoanDuration,
        uint256 collateralTokenSent,
        address collateralTokenAddress,
        address receiver,
        bytes calldata loanDataBytes
    ) external payable returns (uint256, uint256) {
        return
            ILoanTokenModules(loanToken).borrow(
                loanId,
                withdrawAmount,
                initialLoanDuration,
                collateralTokenSent,
                collateralTokenAddress,
                address(this), // This contract is the borrower
                receiver,
                loanDataBytes
            );
    }

    /**
     * @notice Close a loan with swap using this contract as the borrower
     * @param protocolAddress The protocol contract address
     * @param loanId The loan ID to close
     * @param receiver The receiver address
     * @param swapAmount The amount to swap
     * @param returnTokenIsCollateral Whether return token is collateral
     * @param loanDataBytes Additional loan data
     */
    function closeWithSwap(
        address protocolAddress,
        bytes32 loanId,
        address receiver,
        uint256 swapAmount,
        bool returnTokenIsCollateral,
        bytes calldata loanDataBytes
    ) external returns (uint256, uint256, address) {
        // Import the protocol interface
        (bool success, bytes memory data) = protocolAddress.call(
            abi.encodeWithSignature(
                "closeWithSwap(bytes32,address,uint256,bool,bytes)",
                loanId,
                receiver,
                swapAmount,
                returnTokenIsCollateral,
                loanDataBytes
            )
        );
        require(success, "closeWithSwap failed");

        // Decode the return values
        (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken) = abi.decode(
            data,
            (uint256, uint256, address)
        );
        return (loanCloseAmount, withdrawAmount, withdrawToken);
    }

    /**
     * @notice Close a loan with deposit using this contract as the borrower
     * @param protocolAddress The protocol contract address
     * @param loanId The loan ID to close
     * @param receiver The receiver address
     * @param depositAmount The amount to deposit
     */
    function closeWithDeposit(
        address protocolAddress,
        bytes32 loanId,
        address receiver,
        uint256 depositAmount
    ) external payable returns (uint256, uint256, address) {
        // Import the protocol interface
        (bool success, bytes memory data) = protocolAddress.call.value(msg.value)(
            abi.encodeWithSignature(
                "closeWithDeposit(bytes32,address,uint256)",
                loanId,
                receiver,
                depositAmount
            )
        );
        require(success, "closeWithDeposit failed");

        // Decode the return values
        (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken) = abi.decode(
            data,
            (uint256, uint256, address)
        );
        return (loanCloseAmount, withdrawAmount, withdrawToken);
    }
}
