/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

/**
 * @title The Loan Order.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract contains the storage structure of the Loan Order.
 * */
contract OrderStruct {
	struct Order {
		uint256 lockedAmount; /// Escrowed amount waiting for a counterparty.
		uint256 interestRate; /// Interest rate defined by the creator of this order.
		uint256 minLoanTerm; /// Minimum loan term allowed.
		uint256 maxLoanTerm; /// Maximum loan term allowed.
		uint256 createdTimestamp; /// Timestamp when this order was created.
		uint256 expirationTimestamp; /// Timestamp when this order expires.
	}
}
