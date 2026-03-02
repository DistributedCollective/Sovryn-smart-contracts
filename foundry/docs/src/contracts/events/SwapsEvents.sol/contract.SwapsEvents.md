# SwapsEvents
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/events/SwapsEvents.sol)

**Inherits:**
[ModulesCommonEvents](/contracts/events/ModulesCommonEvents.sol/contract.ModulesCommonEvents.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains the events for swap operations.


## Events
### LoanSwap

```solidity
event LoanSwap(
    bytes32 indexed loanId,
    address indexed sourceToken,
    address indexed destToken,
    address borrower,
    uint256 sourceAmount,
    uint256 destAmount
);
```

### ExternalSwap

```solidity
event ExternalSwap(
    address indexed user,
    address indexed sourceToken,
    address indexed destToken,
    uint256 sourceAmount,
    uint256 destAmount
);
```

