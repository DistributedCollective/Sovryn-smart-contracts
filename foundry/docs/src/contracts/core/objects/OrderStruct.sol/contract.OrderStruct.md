# OrderStruct
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/core/objects/OrderStruct.sol)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains the storage structure of the Loan Order.


## Structs
### Order

```solidity
struct Order {
    uint256 lockedAmount;
    uint256 interestRate;
    uint256 minLoanTerm;
    uint256 maxLoanTerm;
    uint256 createdTimestamp;
    uint256 expirationTimestamp;
}
```

