# LoanClosingsRollover
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/modules/LoanClosingsRollover.sol)

**Inherits:**
[LoanClosingsShared](/contracts/modules/LoanClosingsShared.sol/contract.LoanClosingsShared.md), [LiquidationHelper](/contracts/mixins/LiquidationHelper.sol/contract.LiquidationHelper.md)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

Ways to close a loan: rollover. Margin trade
positions are always closed with a swap.


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

### rollover

Roll over a loan.

*Public wrapper for _rollover internal function.
Each loan has a duration. In case of a margin trade it is set to 28
days, in case of borrowing, it can be set by the user. On loan
openning, the user pays the interest for this duration in advance.
If closing early, he gets the excess refunded. If it is not closed
before the end date, it needs to be rolled over. On rollover the
interest is paid for the next period. In case of margin trading
it's 28 days, in case of borrowing it's a month.
The function rollover on the protocol contract extends the loan
duration by the maximum term (28 days for margin trades at the moment
of writing), pays the interest to the lender and refunds the caller
for the gas cost by sending 2 * the gas cost using the fast gas price
as base for the calculation.*


```solidity
function rollover(bytes32 loanId, bytes calldata)
    external
    nonReentrant
    globallyNonReentrant
    iTokenSupplyUnchanged(loanId)
    whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|The ID of the loan to roll over. // param calldata The payload for the call. These loan DataBytes are additional loan data (not in use for token swaps).|
|`<none>`|`bytes`||


### _rollover

Internal function for roll over a loan.
Each loan has a duration. In case of a margin trade it is set to 28
days, in case of borrowing, it can be set by the user. On loan
openning, the user pays the interest for this duration in advance.
If closing early, he gets the excess refunded. If it is not closed
before the end date, it needs to be rolled over. On rollover the
interest is paid for the next period. In case of margin trading
it's 28 days, in case of borrowing it's a month.


```solidity
function _rollover(bytes32 loanId, bytes memory loanDataBytes) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|The ID of the loan to roll over.|
|`loanDataBytes`|`bytes`|The payload for the call. These loan DataBytes are additional loan data (not in use for token swaps).|


### _swapBackExcess

fee token
pairToken (used to check if there is any special rebates or not) -- to pay fee reward
loanDataBytes

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


