# LoanStruct
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/core/objects/LoanStruct.sol)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains the storage structure of the Loan Object.


## Structs
### Loan

```solidity
struct Loan {
    bytes32 id;
    bytes32 loanParamsId;
    bytes32 pendingTradesId;
    bool active;
    uint256 principal;
    uint256 collateral;
    uint256 startTimestamp;
    uint256 endTimestamp;
    uint256 startMargin;
    uint256 startRate;
    address borrower;
    address lender;
}
```

