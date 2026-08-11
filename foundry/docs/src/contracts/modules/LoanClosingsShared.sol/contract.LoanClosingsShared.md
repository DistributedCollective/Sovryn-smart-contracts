# LoanClosingsShared
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/modules/LoanClosingsShared.sol)

**Inherits:**
[LoanClosingsEvents](/contracts/events/LoanClosingsEvents.sol/contract.LoanClosingsEvents.md), [VaultController](/contracts/mixins/VaultController.sol/contract.VaultController.md), [InterestUser](/contracts/mixins/InterestUser.sol/contract.InterestUser.md), [SwapsUser](/contracts/swaps/SwapsUser.sol/contract.SwapsUser.md), [RewardHelper](/contracts/mixins/RewardHelper.sol/contract.RewardHelper.md), [ModuleCommonFunctionalities](/contracts/mixins/ModuleCommonFunctionalities.sol/contract.ModuleCommonFunctionalities.md)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract should only contains the internal function that is being used / utilized by
LoanClosingsLiquidation, LoanClosingsRollover & LoanClosingsWith contract


## State Variables
### MONTH

```solidity
uint256 internal constant MONTH = 365 days / 12;
```


### paySwapExcessToBorrowerThreshold

```solidity
uint256 public constant paySwapExcessToBorrowerThreshold = 10000000000000;
```


### TINY_AMOUNT

```solidity
uint256 public constant TINY_AMOUNT = 25e13;
```


## Functions
### iTokenSupplyUnchanged

modifier for invariant check


```solidity
modifier iTokenSupplyUnchanged(bytes32 loanId);
```

### _settleInterestToPrincipal

Validate iToken total supply

*computes the interest which needs to be refunded to the borrower based on the amount he's closing and either
subtracts it from the amount which still needs to be paid back (in case outstanding amount > interest) or withdraws the
excess to the borrower (in case interest > outstanding).*


```solidity
function _settleInterestToPrincipal(
    Loan memory loanLocal,
    LoanParams memory loanParamsLocal,
    uint256 loanCloseAmount,
    address receiver
) internal returns (uint256);
```
**Parameters**

| Name              | Type         | Description                                        |
| ----------------- | ------------ | -------------------------------------------------- |
| `loanLocal`       | `Loan`       | the loan                                           |
| `loanParamsLocal` | `LoanParams` | the loan params                                    |
| `loanCloseAmount` | `uint256`    | the amount to be closed (base for the computation) |
| `receiver`        | `address`    | the address of the receiver (usually the borrower) |


### _returnPrincipalWithDeposit


```solidity
function _returnPrincipalWithDeposit(address loanToken, address receiver, uint256 principalNeeded) internal;
```

### _worthTheTransfer

*checks if the amount of the asset to be transfered is worth the transfer fee*


```solidity
function _worthTheTransfer(address asset, uint256 amount) internal returns (bool);
```
**Parameters**

| Name     | Type      | Description                 |
| -------- | --------- | --------------------------- |
| `asset`  | `address` | the asset to be transfered  |
| `amount` | `uint256` | the amount to be transfered |

**Returns**

| Name     | Type   | Description                                     |
| -------- | ------ | ----------------------------------------------- |
| `<none>` | `bool` | True if the amount is bigger than the threshold |


### _doCollateralSwap

swaps collateral tokens for loan tokens


```solidity
function _doCollateralSwap(
    Loan memory loanLocal,
    LoanParams memory loanParamsLocal,
    uint256 swapAmount,
    uint256 principalNeeded,
    bool returnTokenIsCollateral,
    bytes memory loanDataBytes
) internal returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed, uint256 collateralToLoanSwapRate);
```
**Parameters**

| Name                      | Type         | Description                                                                                                       |
| ------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------- |
| `loanLocal`               | `Loan`       | the loan object                                                                                                   |
| `loanParamsLocal`         | `LoanParams` | the loan parameters                                                                                               |
| `swapAmount`              | `uint256`    | the amount to be swapped                                                                                          |
| `principalNeeded`         | `uint256`    | the required destination token amount                                                                             |
| `returnTokenIsCollateral` | `bool`       | if true -> required destination token amount will be passed on, else not note: quite dirty. should be refactored. |
| `loanDataBytes`           | `bytes`      | additional loan data (not in use for token swaps)                                                                 |


### _withdrawAsset

Withdraw asset to receiver.


```solidity
function _withdrawAsset(address assetToken, address receiver, uint256 assetAmount) internal;
```
**Parameters**

| Name          | Type      | Description                  |
| ------------- | --------- | ---------------------------- |
| `assetToken`  | `address` | The loan token.              |
| `receiver`    | `address` | The address of the receiver. |
| `assetAmount` | `uint256` | The loan token amount.       |


### _closeLoan

Internal function to close a loan.


```solidity
function _closeLoan(Loan storage loanLocal, uint256 loanCloseAmount) internal;
```
**Parameters**

| Name              | Type      | Description                              |
| ----------------- | --------- | ---------------------------------------- |
| `loanLocal`       | `Loan`    | The loan object.                         |
| `loanCloseAmount` | `uint256` | The amount to close: principal or lower. |


### _settleInterest


```solidity
function _settleInterest(LoanParams memory loanParamsLocal, Loan memory loanLocal, uint256 closePrincipal)
    internal
    returns (uint256);
```

### _checkAuthorized

fee token
pairToken (used to check if there is any special rebates or not) -- to pay fee reward

Check sender is borrower or delegatee and loan id exists.


```solidity
function _checkAuthorized(bytes32 loanId) internal view;
```
**Parameters**

| Name     | Type      | Description            |
| -------- | --------- | ---------------------- |
| `loanId` | `bytes32` | byte32 of the loan id. |


### _closeWithSwap

Internal function for closing a position by swapping the
collateral back to loan tokens, paying the lender and withdrawing
the remainder.


```solidity
function _closeWithSwap(
    bytes32 loanId,
    address receiver,
    uint256 swapAmount,
    bool returnTokenIsCollateral,
    bytes memory loanDataBytes
) internal returns (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken);
```
**Parameters**

| Name                      | Type      | Description                                                                                                                                                                                                                                                                                 |
| ------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loanId`                  | `bytes32` | The id of the loan.                                                                                                                                                                                                                                                                         |
| `receiver`                | `address` | The receiver of the remainder (unused collatral + profit).                                                                                                                                                                                                                                  |
| `swapAmount`              | `uint256` | Defines how much of the position should be closed and is denominated in collateral tokens. If swapAmount >= collateral, the complete position will be closed. Else if returnTokenIsCollateral, (swapAmount/collateral) * principal will be swapped (partial closure). Else coveredPrincipal |
| `returnTokenIsCollateral` | `bool`    | Defines if the remainder should be paid out in collateral tokens or underlying loan tokens.                                                                                                                                                                                                 |
| `loanDataBytes`           | `bytes`   |                                                                                                                                                                                                                                                                                             |

**Returns**

| Name              | Type      | Description                                     |
| ----------------- | --------- | ----------------------------------------------- |
| `loanCloseAmount` | `uint256` | The amount of the collateral token of the loan. |
| `withdrawAmount`  | `uint256` | The withdraw amount in the collateral token.    |
| `withdrawToken`   | `address` | The loan token address.                         |


### _finalizeClose

Can't swap more than collateral.
loanCloseAmountLessInterest will be passed as required amount amount of destination tokens.
this means, the actual swapAmount passed to the swap contract does not matter at all.
the source token amount will be computed depending on the required amount amount of destination tokens.
Computes the interest refund for the borrower and sends it to the lender to cover part of the principal.
loanCloseAmount is calculated after swap; for this case we want to swap the entire source amount
and determine the loanCloseAmount and withdraw amount based on that.
swapAmount repurposed for collateralToLoanSwapRate to avoid stack too deep error.
The amount of source tokens to swap (only matters if !returnTokenIsCollateral or loanCloseAmountLessInterest = 0)
This is the amount of destination tokens we want to receive (only matters if returnTokenIsCollateral)
Condition prior to swap: swapAmount != loanLocal.collateral && !returnTokenIsCollateral
Amounts that is closed.
Amount that is returned to the lender.
Remaining amount withdrawn to the receiver.
Pay back the amount which was covered by the swap.
Reduce the collateral by the amount which was swapped for the closure.
Repays principal to lender.
The lender always gets back an ERC20 (even wrbtc), so we call
withdraw directly rather than use the _withdrawAsset helper function.
collateralToLoanSwapRate

Close a loan.

*Wrapper for _closeLoan internal function.*


```solidity
function _finalizeClose(
    Loan storage loanLocal,
    LoanParams storage loanParamsLocal,
    uint256 loanCloseAmount,
    uint256 collateralCloseAmount,
    uint256 collateralToLoanSwapRate,
    CloseTypes closeType
) internal;
```
**Parameters**

| Name                       | Type         | Description                              |
| -------------------------- | ------------ | ---------------------------------------- |
| `loanLocal`                | `Loan`       | The loan object.                         |
| `loanParamsLocal`          | `LoanParams` | The loan params.                         |
| `loanCloseAmount`          | `uint256`    | The amount to close: principal or lower. |
| `collateralCloseAmount`    | `uint256`    | The amount of collateral to close.       |
| `collateralToLoanSwapRate` | `uint256`    | The price rate collateral/loan token.    |
| `closeType`                | `CloseTypes` | The type of loan close.                  |


### _coverPrincipalWithSwap

This is still called even with full loan close to return collateralToLoanRate
Note: We can safely skip the margin check if closing
via closeWithDeposit or if closing the loan in full by any method.
loan fully closed
swaps a share of a loan's collateral or the complete collateral in order to cover the principle.

Swaps a share of a loan's collateral or the complete collateral
in order to cover the principle.


```solidity
function _coverPrincipalWithSwap(
    Loan memory loanLocal,
    LoanParams memory loanParamsLocal,
    uint256 swapAmount,
    uint256 principalNeeded,
    bool returnTokenIsCollateral,
    bytes memory loanDataBytes
)
    internal
    returns (uint256 coveredPrincipal, uint256 usedCollateral, uint256 withdrawAmount, uint256 collateralToLoanSwapRate);
```
**Parameters**

| Name                      | Type         | Description                                                                                                                                                                                                                        |
| ------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loanLocal`               | `Loan`       | the loan                                                                                                                                                                                                                           |
| `loanParamsLocal`         | `LoanParams` | the loan parameters                                                                                                                                                                                                                |
| `swapAmount`              | `uint256`    | in case principalNeeded == 0 or !returnTokenIsCollateral, this is the amount which is going to be swapped. Else, swapAmount doesn't matter, because the amount of source tokens needed for the swap is estimated by the connector. |
| `principalNeeded`         | `uint256`    | the required amount of destination tokens in order to cover the principle (only used if returnTokenIsCollateral)                                                                                                                   |
| `returnTokenIsCollateral` | `bool`       | tells if the user wants to withdraw his remaining collateral + profit in collateral tokens                                                                                                                                         |
| `loanDataBytes`           | `bytes`      |                                                                                                                                                                                                                                    |

**Returns**

| Name                       | Type      | Description                                  |
| -------------------------- | --------- | -------------------------------------------- |
| `coveredPrincipal`         | `uint256` | The amount of principal that is covered.     |
| `usedCollateral`           | `uint256` | The amount of collateral used.               |
| `withdrawAmount`           | `uint256` | The withdraw amount in the collateral token. |
| `collateralToLoanSwapRate` | `uint256` | The swap rate of collateral.                 |


### _emitClosingEvents

Better fill than expected.
Send excess to borrower if the amount is big enough to be
worth the gas fees.
Else, give the excess to the lender (if it goes to the
borrower, they're very confused. causes more trouble than it's worth)
sourceTokenAmountUsed == swapAmount == loanLocal.collateral
sourceTokenAmountUsed == swapAmount < loanLocal.collateral
Edge case where swap covers full principal.
Excess collateral refunds to the borrower.


```solidity
function _emitClosingEvents(
    LoanParams memory loanParamsLocal,
    Loan memory loanLocal,
    uint256 loanCloseAmount,
    uint256 collateralCloseAmount,
    uint256 collateralToLoanRate,
    uint256 collateralToLoanSwapRate,
    uint256 currentMargin,
    CloseTypes closeType
) internal;
```

### _getAmountInRbtc

user (borrower)
lender
loanId
closer
loanToken
collateralToken
loanCloseAmount
collateralCloseAmount
collateralToLoanRate
currentMargin
exitPrice = 1 / collateralToLoanSwapRate
currentLeverage = 100 / currentMargin
user (trader)
lender
loanId
collateralToken
loanToken
closer
positionCloseSize
loanCloseAmount
exitPrice (1 / collateralToLoanSwapRate)
currentLeverage

*returns amount of the asset converted to RBTC*


```solidity
function _getAmountInRbtc(address asset, uint256 amount) internal view returns (uint256);
```
**Parameters**

| Name     | Type      | Description                  |
| -------- | --------- | ---------------------------- |
| `asset`  | `address` | the asset to be transferred  |
| `amount` | `uint256` | the amount to be transferred |

**Returns**

| Name     | Type      | Description    |
| -------- | --------- | -------------- |
| `<none>` | `uint256` | amount in RBTC |


### _checkLoan

*private function which check the loanLocal & loanParamsLocal does exist*


```solidity
function _checkLoan(bytes32 loanId) internal view returns (Loan storage, LoanParams storage);
```
**Parameters**

| Name     | Type      | Description       |
| -------- | --------- | ----------------- |
| `loanId` | `bytes32` | bytes32 of loanId |

**Returns**

| Name     | Type         | Description        |
| -------- | ------------ | ------------------ |
| `<none>` | `Loan`       | Loan storage       |
| `<none>` | `LoanParams` | LoanParams storage |


## Enums
### CloseTypes

```solidity
enum CloseTypes {
    Deposit,
    Swap,
    Liquidation
}
```

