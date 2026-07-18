# LoanClosingsWith
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/modules/LoanClosingsWith.sol)

**Inherits:**
[LoanClosingsShared](/contracts/modules/LoanClosingsShared.sol/contract.LoanClosingsShared.md)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

Close a loan w/deposit, close w/swap. There are 2 functions for ending a loan on the
protocol contract: closeWithSwap and closeWithDeposit. Margin trade
positions are always closed with a swap.
Loans are liquidated if the position goes below margin maintenance.


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

### closeWithDeposit

Closes a loan by doing a deposit.

*Public wrapper for _closeWithDeposit internal function.*


```solidity
function closeWithDeposit(bytes32 loanId, address receiver, uint256 depositAmount)
    public
    payable
    nonReentrant
    globallyNonReentrant
    iTokenSupplyUnchanged(loanId)
    whenNotPaused
    returns (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|The id of the loan.|
|`receiver`|`address`|The receiver of the remainder.|
|`depositAmount`|`uint256`|Defines how much of the position should be closed. It is denominated in loan tokens. (e.g. rBTC on a iSUSD contract). If depositAmount > principal, the complete loan will be closed else deposit amount (partial closure).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loanCloseAmount`|`uint256`|The amount of the collateral token of the loan.|
|`withdrawAmount`|`uint256`|The withdraw amount in the collateral token.|
|`withdrawToken`|`address`|The loan token address.|


### closeWithSwap

Close a position by swapping the collateral back to loan tokens
paying the lender and withdrawing the remainder.

*Public wrapper for _closeWithSwap internal function.*


```solidity
function closeWithSwap(bytes32 loanId, address receiver, uint256 swapAmount, bool returnTokenIsCollateral, bytes memory)
    public
    nonReentrant
    globallyNonReentrant
    iTokenSupplyUnchanged(loanId)
    whenNotPaused
    returns (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|The id of the loan.|
|`receiver`|`address`|The receiver of the remainder (unused collateral + profit).|
|`swapAmount`|`uint256`|Defines how much of the position should be closed and is denominated in collateral tokens. If swapAmount >= collateral, the complete position will be closed. Else if returnTokenIsCollateral, (swapAmount/collateral) * principal will be swapped (partial closure). Else coveredPrincipal|
|`returnTokenIsCollateral`|`bool`|Defines if the remainder should be paid out in collateral tokens or underlying loan tokens.|
|`<none>`|`bytes`||

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loanCloseAmount`|`uint256`|The amount of the collateral token of the loan.|
|`withdrawAmount`|`uint256`|The withdraw amount in the collateral token.|
|`withdrawToken`|`address`|The loan token address.|


### _closeWithDeposit

loanDataBytes

Internal function for closing a loan by doing a deposit.


```solidity
function _closeWithDeposit(bytes32 loanId, address receiver, uint256 depositAmount)
    internal
    returns (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|The id of the loan.|
|`receiver`|`address`|The receiver of the remainder.|
|`depositAmount`|`uint256`|Defines how much of the position should be closed. It is denominated in loan tokens. If depositAmount > principal, the complete loan will be closed else deposit amount (partial closure).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loanCloseAmount`|`uint256`|The amount of the collateral token of the loan.|
|`withdrawAmount`|`uint256`|The withdraw amount in the collateral token.|
|`withdrawToken`|`address`|The loan token address.|


### checkCloseWithDepositIsTinyPosition

Can't close more than the full principal.
collateralCloseAmount
collateralToLoanSwapRate

Function to check whether the given loanId & deposit amount when closing with deposit will cause the tiny position


```solidity
function checkCloseWithDepositIsTinyPosition(bytes32 loanId, uint256 depositAmount)
    external
    view
    returns (bool isTinyPosition, uint256 tinyPositionAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|The id of the loan.|
|`depositAmount`|`uint256`|Defines how much the deposit amount to close the position.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`isTinyPosition`|`bool`|true is indicating tiny position, false otherwise.|
|`tinyPositionAmount`|`uint256`|will return 0 for non tiny position, and will return the amount of tiny position if true|


