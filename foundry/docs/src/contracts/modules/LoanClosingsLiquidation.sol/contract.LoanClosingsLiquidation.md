# LoanClosingsLiquidation
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/modules/LoanClosingsLiquidation.sol)

**Inherits:**
[LoanClosingsShared](/contracts/modules/LoanClosingsShared.sol/contract.LoanClosingsShared.md), [LiquidationHelper](/contracts/mixins/LiquidationHelper.sol/contract.LiquidationHelper.md)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

Ways to close a loan: liquidation. Margin trade
positions are always closed with a swap.
Loans are liquidated if the position goes below margin maintenance.


## State Variables
### MONTH

```solidity
uint256 internal constant MONTH = 365 days / 12;
```


## Functions
### constructor


```solidity
constructor() public;
```

### function


```solidity
function() external;
```

### initialize


```solidity
function initialize(address target) external onlyOwner;
```

### liquidate

Liquidate an unhealty loan.

*Public wrapper for _liquidate internal function.
The caller needs to approve the closeAmount prior to calling. Will
not liquidate more than is needed to restore the desired margin
(maintenance +5%).
Whenever the current margin of a loan falls below maintenance margin,
it needs to be liquidated. Anybody can initiate a liquidation and buy
the collateral tokens at a discounted rate (5%).*


```solidity
function liquidate(bytes32 loanId, address receiver, uint256 closeAmount)
    external
    payable
    nonReentrant
    globallyNonReentrant
    iTokenSupplyUnchanged(loanId)
    whenNotPaused
    returns (uint256 loanCloseAmount, uint256 seizedAmount, address seizedToken);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|The ID of the loan to liquidate. loanId is the ID of the loan, which is created on loan opening. It can be obtained either by parsing the Trade event or by reading the open loans from the contract by calling getActiveLoans or getUserLoans.|
|`receiver`|`address`|The receiver of the seized amount.|
|`closeAmount`|`uint256`|The amount to close in loanTokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loanCloseAmount`|`uint256`|The amount of the collateral token of the loan.|
|`seizedAmount`|`uint256`|The seized amount in the collateral token.|
|`seizedToken`|`address`|The loan token address.|


### _liquidate

Internal function for liquidating an unhealthy loan.
The caller needs to approve the closeAmount prior to calling. Will
not liquidate more than is needed to restore the desired margin
(maintenance +5%).
Whenever the current margin of a loan falls below maintenance margin,
it needs to be liquidated. Anybody can initiate a liquidation and buy
the collateral tokens at a discounted rate (5%).


```solidity
function _liquidate(bytes32 loanId, address receiver, uint256 closeAmount)
    internal
    returns (uint256 loanCloseAmount, uint256 seizedAmount, address seizedToken);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|The ID of the loan to liquidate.|
|`receiver`|`address`|The receiver of the seized amount.|
|`closeAmount`|`uint256`|The amount to close in loanTokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loanCloseAmount`|`uint256`|The amount of the collateral token of the loan.|
|`seizedAmount`|`uint256`|The seized amount in the collateral token.|
|`seizedToken`|`address`|The loan token address.|


### _swapBackExcess

Swap back excessive loan tokens to collateral tokens.


```solidity
function _swapBackExcess(
    Loan memory loanLocal,
    LoanParams memory loanParamsLocal,
    uint256 swapAmount,
    bytes memory loanDataBytes
) internal returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed, uint256 collateralToLoanSwapRate);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanLocal`|`Loan`|The loan object.|
|`loanParamsLocal`|`LoanParams`|The loan parameters.|
|`swapAmount`|`uint256`|The amount to be swapped.|
|`loanDataBytes`|`bytes`|Additional loan data (not in use for token swaps).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`destTokenAmountReceived`|`uint256`|The amount of destiny tokens received.|
|`sourceTokenAmountUsed`|`uint256`|The amount of source tokens used.|
|`collateralToLoanSwapRate`|`uint256`|The swap rate of collateral.|


