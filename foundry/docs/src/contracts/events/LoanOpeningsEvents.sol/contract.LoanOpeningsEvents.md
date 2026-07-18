# LoanOpeningsEvents
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/events/LoanOpeningsEvents.sol)

**Inherits:**
[ModulesCommonEvents](/contracts/events/ModulesCommonEvents.sol/contract.ModulesCommonEvents.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains the events for loan openings operations.


## Events
### Borrow
topic0: 0x7bd8cbb7ba34b33004f3deda0fd36c92fc0360acbd97843360037b467a538f90


```solidity
event Borrow(
    address indexed user,
    address indexed lender,
    bytes32 indexed loanId,
    address loanToken,
    address collateralToken,
    uint256 newPrincipal,
    uint256 newCollateral,
    uint256 interestRate,
    uint256 interestDuration,
    uint256 collateralToLoanRate,
    uint256 currentMargin
);
```

### Trade
topic0: 0xf640c1cfe1a912a0b0152b5a542e5c2403142eed75b06cde526cee54b1580e5c


```solidity
event Trade(
    address indexed user,
    address indexed lender,
    bytes32 indexed loanId,
    address collateralToken,
    address loanToken,
    uint256 positionSize,
    uint256 borrowedAmount,
    uint256 interestRate,
    uint256 settlementDate,
    uint256 entryPrice,
    uint256 entryLeverage,
    uint256 currentLeverage
);
```

### DelegatedManagerSet
topic0: 0x0eef4f90457a741c97d76fcf13fa231fefdcc7649bdb3cb49157c37111c98433


```solidity
event DelegatedManagerSet(bytes32 indexed loanId, address indexed delegator, address indexed delegated, bool isActive);
```

