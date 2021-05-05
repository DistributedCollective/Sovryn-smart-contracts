/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

/**
 * @title The Loan Interest.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract contains the storage structure of the Loan Interest.
 * */
contract LoanInterestStruct {
	struct LoanInterest {
		uint256 owedPerDay; /// Interest owed per day for loan.
		uint256 depositTotal; /// Total escrowed interest for loan.
		uint256 updatedTimestamp; /// Last update.
	}
}
