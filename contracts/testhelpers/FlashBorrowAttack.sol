pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import { SafeERC20, IERC20 } from "../openzeppelin/SafeERC20.sol";

/**
 * @title FlashBorrowAttack
 * @notice Attack contract that attempts to borrow and close a loan in a single transaction
 *
 * This contract demonstrates the vulnerability that LoanIdGuard is designed to prevent:
 * 1. Borrow a large amount to manipulate interest rates
 * 2. Immediately close the loan to avoid paying interest
 * 3. Use the manipulated state to exploit other users
 *
 * With LoanIdGuard: The closeWithDeposit call will REVERT because the loan
 * was created in the same transaction.
 */
contract FlashBorrowAttack {
    using SafeERC20 for IERC20;

    IProtocol public protocol;
    ILoanToken public loanTokenPool; // The loan pool (iToken)
    address public underlyingToken; // The underlying ERC20 (e.g., SUSD)
    address public collateralToken;
    bytes32 public loanId;
    uint256 public borrowAmount;

    event AttackAttempted(bytes32 loanId, bool success);
    event LoanBorrowed(bytes32 loanId, uint256 principal);
    event LoanClosed(bytes32 loanId);

    constructor(address _protocol, address _loanTokenPool, address _collateralToken) public {
        protocol = IProtocol(_protocol);
        loanTokenPool = ILoanToken(_loanTokenPool);
        underlyingToken = ILoanToken(_loanTokenPool).loanTokenAddress(); // Get underlying token
        collateralToken = _collateralToken;
        borrowAmount = 1000 ether;
    }

    /**
     * @notice Attempts to execute a flash borrow attack
     * @dev This function should REVERT with "loan ID already used in this block"
     *
     * Attack flow:
     * 1. Borrow large amount (creates new loan, locks it)
     * 2. Try to close immediately (should fail due to LoanIdGuard)
     */
    function executeAttack(uint256 collateralAmount) external returns (bool) {
        // Approve collateral for borrowing
        IERC20(collateralToken).safeApprove(address(loanTokenPool), collateralAmount);

        // Step 1: Borrow through loan token pool (creates and locks the loan ID)
        (uint256 principal, ) = loanTokenPool.borrow(
            0, // loanId = 0 means new loan
            borrowAmount,
            7884000, // initialLoanDuration ~3 months in seconds
            collateralAmount,
            collateralToken,
            address(this),
            address(this),
            ""
        );

        // Get the created loan ID
        loanId = _getMyLatestLoanId();
        emit LoanBorrowed(loanId, principal);

        // Step 2: Try to close immediately in the same transaction
        // THIS SHOULD REVERT with "loan ID already used in this block"
        IERC20(underlyingToken).safeApprove(address(protocol), borrowAmount);

        protocol.closeWithDeposit(loanId, address(this), borrowAmount);

        emit LoanClosed(loanId);

        // If we reach here, the attack succeeded (which should NOT happen with the fix)
        emit AttackAttempted(loanId, true);
        return true;
    }

    /**
     * @notice Borrows without attempting to close (for testing separate transactions)
     */
    function justBorrow(uint256 collateralAmount, uint256 _borrowAmount) external {
        borrowAmount = _borrowAmount;

        IERC20(collateralToken).safeApprove(address(loanTokenPool), collateralAmount);

        (uint256 principal, ) = loanTokenPool.borrow(
            0,
            borrowAmount,
            7884000, // initialLoanDuration ~3 months in seconds
            collateralAmount,
            collateralToken,
            address(this),
            address(this),
            ""
        );

        loanId = _getMyLatestLoanId();
        emit LoanBorrowed(loanId, principal);
    }

    /**
     * @notice Closes an existing loan (for testing separate transactions)
     */
    function justClose() external {
        require(loanId != 0, "No loan to close");

        // Get loan details
        IProtocol.LoanReturnData memory loan = protocol.getLoan(loanId);
        uint256 principal = loan.principal;

        IERC20(underlyingToken).safeApprove(address(protocol), principal);

        protocol.closeWithDeposit(loanId, address(this), principal);

        emit LoanClosed(loanId);
    }

    /**
     * @notice Gets the most recent loan ID for this contract
     */
    function _getMyLatestLoanId() internal view returns (bytes32) {
        IProtocol.LoanReturnData[] memory loans = protocol.getUserLoans(
            address(this),
            0, // start
            1, // count (we want the latest)
            0, // loanType (all)
            false, // isLender
            false // unsafeOnly
        );

        require(loans.length > 0, "No loans found");
        return loans[0].loanId;
    }

    /**
     * @notice Fallback to receive tokens
     */
    function() external payable {}
}

/**
 * @title IProtocol
 * @notice Minimal interface for Sovryn protocol functions used in the attack
 */
interface IProtocol {
    struct LoanReturnData {
        bytes32 loanId;
        address loanToken;
        address collateralToken;
        uint256 principal;
        uint256 collateral;
        uint256 interestOwedPerDay;
        uint256 interestDepositRemaining;
        uint256 startRate;
        uint256 startMargin;
        uint256 maintenanceMargin;
        uint256 currentMargin;
        uint256 maxLoanTerm;
        uint256 endTimestamp;
        uint256 maxLiquidatable;
        uint256 maxSeizable;
    }

    function closeWithDeposit(
        bytes32 loanId,
        address receiver,
        uint256 depositAmount
    ) external returns (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken);

    function getLoan(bytes32 loanId) external view returns (LoanReturnData memory);

    function getUserLoans(
        address user,
        uint256 start,
        uint256 count,
        uint256 loanType,
        bool isLender,
        bool unsafeOnly
    ) external view returns (LoanReturnData[] memory);
}

/**
 * @title ILoanToken
 * @notice Interface for LoanToken borrow function
 */
interface ILoanToken {
    function loanTokenAddress() external view returns (address);

    function borrow(
        bytes32 loanId,
        uint256 withdrawAmount,
        uint256 initialLoanDuration,
        uint256 collateralTokenSent,
        address collateralTokenAddress,
        address borrower,
        address receiver,
        bytes calldata loanDataBytes
    ) external payable returns (uint256, uint256);
}
