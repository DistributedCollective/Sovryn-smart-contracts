# LenderInterestStruct
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/core/objects/LenderInterestStruct.sol)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains the storage structure of the Lender Interest.


## Structs
### LenderInterest

```solidity
struct LenderInterest {
    uint256 principalTotal;
    uint256 owedPerDay;
    uint256 owedTotal;
    uint256 paidTotal;
    uint256 updatedTimestamp;
}
```

