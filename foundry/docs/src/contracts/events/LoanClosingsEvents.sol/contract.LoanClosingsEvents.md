# LoanClosingsEvents
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/events/LoanClosingsEvents.sol)

**Inherits:**
[ModulesCommonEvents](/contracts/events/ModulesCommonEvents.sol/contract.ModulesCommonEvents.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains the events for loan closing operations.


## Events
### CloseWithDeposit
topic0: 0x6349c1a02ec126f7f4fc6e6837e1859006e90e9901635c442d29271e77b96fb6


```solidity
event CloseWithDeposit(
    address indexed user,
    address indexed lender,
    bytes32 indexed loanId,
    address closer,
    address loanToken,
    address collateralToken,
    uint256 repayAmount,
    uint256 collateralWithdrawAmount,
    uint256 collateralToLoanRate,
    uint256 currentMargin
);
```

### CloseWithSwap
topic0: 0x2ed7b29b4ca95cf3bb9a44f703872a66e6aa5e8f07b675fa9a5c124a1e5d7352


```solidity
event CloseWithSwap(
    address indexed user,
    address indexed lender,
    bytes32 indexed loanId,
    address collateralToken,
    address loanToken,
    address closer,
    uint256 positionCloseSize,
    uint256 loanCloseAmount,
    uint256 exitPrice,
    uint256 currentLeverage
);
```

### Liquidate
topic0: 0x46fa03303782eb2f686515f6c0100f9a62dabe587b0d3f5a4fc0c822d6e532d3


```solidity
event Liquidate(
    address indexed user,
    address indexed liquidator,
    bytes32 indexed loanId,
    address lender,
    address loanToken,
    address collateralToken,
    uint256 repayAmount,
    uint256 collateralWithdrawAmount,
    uint256 collateralToLoanRate,
    uint256 currentMargin
);
```

### Rollover

```solidity
event Rollover(
    address indexed user,
    address indexed lender,
    bytes32 indexed loanId,
    uint256 principal,
    uint256 collateral,
    uint256 endTimestamp,
    address rewardReceiver,
    uint256 reward
);
```

### swapExcess

```solidity
event swapExcess(bool shouldRefund, uint256 amount, uint256 amountInRbtc, uint256 threshold);
```

