# FeesEvents
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/events/FeesEvents.sol)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains the events for fee payments.


## Events
### PayLendingFee

```solidity
event PayLendingFee(address indexed payer, address indexed token, uint256 amount);
```

### PayTradingFee

```solidity
event PayTradingFee(address indexed payer, address indexed token, bytes32 indexed loanId, uint256 amount);
```

### PayBorrowingFee

```solidity
event PayBorrowingFee(address indexed payer, address indexed token, bytes32 indexed loanId, uint256 amount);
```

### EarnReward

```solidity
event EarnReward(
    address indexed receiver,
    address indexed token,
    bytes32 indexed loanId,
    uint256 feeRebatePercent,
    uint256 amount,
    uint256 basisPoint
);
```

### EarnRewardFail

```solidity
event EarnRewardFail(
    address indexed receiver,
    address indexed token,
    bytes32 indexed loanId,
    uint256 feeRebatePercent,
    uint256 amount,
    uint256 basisPoint
);
```

