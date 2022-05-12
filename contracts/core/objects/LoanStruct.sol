/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

/**
 * @title The Loan Object.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract contains the storage structure of the Loan Object.
 * */
contract LoanStruct {
    struct Loan {
        bytes32 id; /// ID of the loan.
        bytes32 loanParamsId; /// The linked loan params ID.
        bytes32 pendingTradesId; /// The linked pending trades ID.
        bool active; /// If false, the loan has been fully closed.
        uint256 principal; /// Total borrowed amount outstanding.
        uint256 collateral; /// Total collateral escrowed for the loan.
        uint256 startTimestamp; /// Loan start time.
        uint256 endTimestamp; /// For active loans, this is the expected loan end time, for in-active loans, is the actual (past) end time.
        uint256 startMargin; /// Initial margin when the loan opened.
        uint256 startRate; /// Reference rate when the loan opened for converting collateralToken to loanToken.
        address borrower; /// Borrower of this loan.
        address lender; /// Lender of this loan.
    }
}
