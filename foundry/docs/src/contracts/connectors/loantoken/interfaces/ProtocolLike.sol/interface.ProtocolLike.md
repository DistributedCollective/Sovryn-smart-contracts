# ProtocolLike
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/interfaces/ProtocolLike.sol)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.


## Functions
### borrowOrTradeFromPool


```solidity
function borrowOrTradeFromPool(
    bytes32 loanParamsId,
    bytes32 loanId,
    bool isTorqueLoan,
    uint256 initialMargin,
    MarginTradeStructHelpers.SentAddresses calldata sentAddresses,
    MarginTradeStructHelpers.SentAmounts calldata sentValues,
    bytes calldata loanDataBytes
) external payable returns (uint256 newPrincipal, uint256 newCollateral);
```

### getTotalPrincipal


```solidity
function getTotalPrincipal(address lender, address loanToken) external view returns (uint256);
```

### withdrawAccruedInterest


```solidity
function withdrawAccruedInterest(address loanToken) external;
```

### getLenderInterestData


```solidity
function getLenderInterestData(address lender, address loanToken)
    external
    view
    returns (
        uint256 interestPaid,
        uint256 interestPaidDate,
        uint256 interestOwedPerDay,
        uint256 interestUnPaid,
        uint256 interestFeePercent,
        uint256 principalTotal
    );
```

### priceFeeds


```solidity
function priceFeeds() external view returns (address);
```

### getEstimatedMarginExposure


```solidity
function getEstimatedMarginExposure(
    address loanToken,
    address collateralToken,
    uint256 loanTokenSent,
    uint256 collateralTokenSent,
    uint256 interestRate,
    uint256 newPrincipal
) external view returns (uint256);
```

### getRequiredCollateral


```solidity
function getRequiredCollateral(
    address loanToken,
    address collateralToken,
    uint256 newPrincipal,
    uint256 marginAmount,
    bool isTorqueLoan
) external view returns (uint256 collateralAmountRequired);
```

### getBorrowAmount


```solidity
function getBorrowAmount(
    address loanToken,
    address collateralToken,
    uint256 collateralTokenAmount,
    uint256 marginAmount,
    bool isTorqueLoan
) external view returns (uint256 borrowAmount);
```

### isLoanPool


```solidity
function isLoanPool(address loanPool) external view returns (bool);
```

### lendingFeePercent


```solidity
function lendingFeePercent() external view returns (uint256);
```

### getSwapExpectedReturn


```solidity
function getSwapExpectedReturn(address sourceToken, address destToken, uint256 sourceTokenAmount)
    external
    view
    returns (uint256);
```

### borrowerNonce


```solidity
function borrowerNonce(address) external view returns (uint256);
```

### closeWithSwap


```solidity
function closeWithSwap(
    bytes32 loanId,
    address receiver,
    uint256 swapAmount,
    bool returnTokenIsCollateral,
    bytes calldata
) external returns (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken);
```

### closeWithDeposit


```solidity
function closeWithDeposit(bytes32 loanId, address receiver, uint256 depositAmount)
    external
    payable
    returns (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken);
```

