/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

contract LoanTokenLogicStandardMockup  {

    /* Public functions */

    function mint(
        address receiver,
        uint256 depositAmount)
        external
        returns (uint256 mintAmount)
    {
        return 10;
    }

    function burn(
        address receiver,
        uint256 burnAmount)
        external
        returns (uint256 loanAmountPaid)
    {
        return 20;
    }

   
    // ***** NOTE: Reentrancy is allowed here to allow flashloan use cases *****
    function borrow(
        bytes32 loanId,                 // 0 if new loan
        uint256 withdrawAmount,
        uint256 initialLoanDuration,    // duration in seconds
        uint256 collateralTokenSent,    // if 0, loanId must be provided; any ETH sent must equal this value
        address collateralTokenAddress, // if address(0), this means ETH and ETH must be sent with the call or loanId must be provided
        address borrower,
        address receiver,
        bytes memory /*loanDataBytes*/) // arbitrary order data (for future use)
        public
        payable
        returns (uint256, uint256) // returns new principal and new collateral added to loan
    {
        require(withdrawAmount != 0, "6");

      
        require(msg.value == 0 || msg.value == collateralTokenSent, "7");
        require(collateralTokenSent != 0 || loanId != 0, "8");
        require(collateralTokenAddress != address(0) || msg.value != 0 || loanId != 0, "9");

        return (30,40);
    }

    // Called to borrow and immediately get into a positions
    // ***** NOTE: Reentrancy is allowed here to allow flashloan use cases *****
    function marginTrade(
        bytes32 loanId,                 // 0 if new loan
        uint256 leverageAmount,
        uint256 loanTokenSent,
        uint256 collateralTokenSent,
        address collateralTokenAddress,
        address trader,
        bytes memory loanDataBytes)     // arbitrary order data
        public
        payable
        returns (uint256, uint256) // returns new principal and new collateral added to trade
    {
        
        return (100,200);
    }
    
    function profitOf(
        address user)
        public
        view
        returns (uint256)
    {
        return 100;
    }
    

}
