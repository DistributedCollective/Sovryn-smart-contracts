/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

contract LoanParamsStruct {
	struct LoanParams {
		/// @dev id of loan params object.
		bytes32 id;
		/// @dev If false, this object has been disabled by the owner and can't
		///   be used for future loans.
		bool active;
		/// @dev Owner of this object.
		address owner;
		/// @dev The token being loaned.
		address loanToken;
		/// @dev The required collateral token.
		address collateralToken;
		/// @dev The minimum allowed initial margin.
		uint256 minInitialMargin;
		/// @dev An unhealthy loan when current margin is at or below this value.
		uint256 maintenanceMargin;
		/// @dev The maximum term for new loans (0 means there's no max term).
		uint256 maxLoanTerm;
	}
}
