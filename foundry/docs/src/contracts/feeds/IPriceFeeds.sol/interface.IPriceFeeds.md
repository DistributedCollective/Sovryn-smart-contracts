# IPriceFeeds
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/feeds/IPriceFeeds.sol)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.


## Functions
### queryRate


```solidity
function queryRate(address sourceToken, address destToken) external view returns (uint256 rate, uint256 precision);
```

### queryPrecision


```solidity
function queryPrecision(address sourceToken, address destToken) external view returns (uint256 precision);
```

### queryReturn


```solidity
function queryReturn(address sourceToken, address destToken, uint256 sourceAmount)
    external
    view
    returns (uint256 destAmount);
```

### checkPriceDisagreement


```solidity
function checkPriceDisagreement(
    address sourceToken,
    address destToken,
    uint256 sourceAmount,
    uint256 destAmount,
    uint256 maxSlippage
) external view returns (uint256 sourceToDestSwapRate);
```

### amountInEth


```solidity
function amountInEth(address Token, uint256 amount) external view returns (uint256 ethAmount);
```

### getMaxDrawdown


```solidity
function getMaxDrawdown(
    address loanToken,
    address collateralToken,
    uint256 loanAmount,
    uint256 collateralAmount,
    uint256 maintenanceMargin
) external view returns (uint256);
```

### getCurrentMarginAndCollateralSize


```solidity
function getCurrentMarginAndCollateralSize(
    address loanToken,
    address collateralToken,
    uint256 loanAmount,
    uint256 collateralAmount
) external view returns (uint256 currentMargin, uint256 collateralInEthAmount);
```

### getCurrentMargin


```solidity
function getCurrentMargin(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount)
    external
    view
    returns (uint256 currentMargin, uint256 collateralToLoanRate);
```

### shouldLiquidate


```solidity
function shouldLiquidate(
    address loanToken,
    address collateralToken,
    uint256 loanAmount,
    uint256 collateralAmount,
    uint256 maintenanceMargin
) external view returns (bool);
```

### getFastGasPrice


```solidity
function getFastGasPrice(address payToken) external view returns (uint256);
```

