/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

/**
 * @title The Lender Interest.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract contains the storage structure of the Lender Interest.
 * */
contract LenderInterestStruct {
	struct LenderInterest {
		uint256 principalTotal; /// Total borrowed amount outstanding of asset.
		uint256 owedPerDay; /// Interest owed per day for all loans of asset.
		uint256 owedTotal; /// Total interest owed for all loans of asset (assuming they go to full term).
		uint256 paidTotal; /// Total interest paid so far for asset.
		uint256 updatedTimestamp; /// Last update.
	}
}
