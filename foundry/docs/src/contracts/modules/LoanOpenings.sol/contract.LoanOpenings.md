# LoanOpenings
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/modules/LoanOpenings.sol)

**Inherits:**
[LoanOpeningsEvents](/contracts/events/LoanOpeningsEvents.sol/contract.LoanOpeningsEvents.md), [VaultController](/contracts/mixins/VaultController.sol/contract.VaultController.md), [InterestUser](/contracts/mixins/InterestUser.sol/contract.InterestUser.md), [SwapsUser](/contracts/swaps/SwapsUser.sol/contract.SwapsUser.md), [ModuleCommonFunctionalities](/contracts/mixins/ModuleCommonFunctionalities.sol/contract.ModuleCommonFunctionalities.md)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains functions to borrow and trade.


## Functions
### constructor


```solidity
constructor() public;
```

### function

Fallback function is to react to receiving value (rBTC).


```solidity
function() external;
```

### initialize

Set function selectors on target contract.


```solidity
function initialize(address target) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`target`|`address`|The address of the target contract.|


### borrowOrTradeFromPool

Borrow or trade from pool.

*Note: Only callable by loan pools (iTokens).
Wrapper to _borrowOrTrade internal function.*


```solidity
function borrowOrTradeFromPool(
    bytes32 loanParamsId,
    bytes32 loanId,
    bool isTorqueLoan,
    uint256 initialMargin,
    MarginTradeStructHelpers.SentAddresses calldata sentAddresses,
    MarginTradeStructHelpers.SentAmounts calldata sentValues,
    bytes calldata loanDataBytes
) external payable nonReentrant whenNotPaused returns (uint256 newPrincipal, uint256 newCollateral);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanParamsId`|`bytes32`|The ID of the loan parameters.|
|`loanId`|`bytes32`|The ID of the loan. If 0, start a new loan.|
|`isTorqueLoan`|`bool`|Whether the loan is a Torque loan.|
|`initialMargin`|`uint256`|The initial amount of margin.|
|`sentAddresses`|`MarginTradeStructHelpers.SentAddresses`|The addresses to send tokens: lender, borrower, receiver and manager: lender: must match loan if loanId provided. borrower: must match loan if loanId provided. receiver: receiver of funds (address(0) assumes borrower address). manager: delegated manager of loan unless address(0).|
|`sentValues`|`MarginTradeStructHelpers.SentAmounts`|The values to send: interestRate: New loan interest rate. newPrincipal: New loan size (borrowAmount + any borrowed interest). interestInitialAmount: New amount of interest to escrow for Torque loan (determines initial loan length). loanTokenReceived: Total loanToken deposit (amount not sent to borrower in the case of Torque loans). collateralTokenSent: Total collateralToken deposit. minEntryPrice: Minimum entry price for checking price divergence (Value of loan token in collateral).|
|`loanDataBytes`|`bytes`|The payload for the call. These loan DataBytes are additional loan data (not in use for token swaps).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`newPrincipal`|`uint256`|The new loan size.|
|`newCollateral`|`uint256`|The new collateral amount.|


### setDelegatedManager

Only callable by loan pools.
Get required collateral.

Set the delegated manager.

*Wrapper for _setDelegatedManager internal function.*


```solidity
function setDelegatedManager(bytes32 loanId, address delegated, bool toggle) external whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|The ID of the loan. If 0, start a new loan.|
|`delegated`|`address`|The address of the delegated manager.|
|`toggle`|`bool`|The flag true/false for the delegated manager.|


### getEstimatedMarginExposure

Get the estimated margin exposure.
Margin is the money borrowed from a broker to purchase an investment
and is the difference between the total value of investment and the
loan amount. Margin trading refers to the practice of using borrowed
funds from a broker to trade a financial asset, which forms the
collateral for the loan from the broker.


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
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanToken`|`address`|The loan token instance address.|
|`collateralToken`|`address`|The collateral token instance address.|
|`loanTokenSent`|`uint256`|The amount of loan tokens sent.|
|`collateralTokenSent`|`uint256`|The amount of collateral tokens sent.|
|`interestRate`|`uint256`|The interest rate. Percentage w/ 18 decimals.|
|`newPrincipal`|`uint256`|The updated amount of principal (current debt).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The margin exposure.|


### getRequiredCollateral

Get the required collateral.

*Calls internal _getRequiredCollateral and add fees.*


```solidity
function getRequiredCollateral(
    address loanToken,
    address collateralToken,
    uint256 newPrincipal,
    uint256 marginAmount,
    bool isTorqueLoan
) public view returns (uint256 collateralAmountRequired);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanToken`|`address`|The loan token instance address.|
|`collateralToken`|`address`|The collateral token instance address.|
|`newPrincipal`|`uint256`|The updated amount of principal (current debt).|
|`marginAmount`|`uint256`|The amount of margin of the trade.|
|`isTorqueLoan`|`bool`|Whether the loan is a Torque loan.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`collateralAmountRequired`|`uint256`|The required collateral.|


### getBorrowAmount

Get the borrow amount of a trade loan.

*Basically borrowAmount = collateral / marginAmount
Collateral is something that helps secure a loan. When you borrow money,
you agree that your lender can take something and sell it to get their
money back if you fail to repay the loan. That's the collateral.*


```solidity
function getBorrowAmount(
    address loanToken,
    address collateralToken,
    uint256 collateralTokenAmount,
    uint256 marginAmount,
    bool isTorqueLoan
) public view returns (uint256 borrowAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanToken`|`address`|The loan token instance address.|
|`collateralToken`|`address`|The collateral token instance address.|
|`collateralTokenAmount`|`uint256`|The amount of collateral.|
|`marginAmount`|`uint256`|The amount of margin of the trade.|
|`isTorqueLoan`|`bool`|Whether the loan is a Torque loan.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`borrowAmount`|`uint256`|The borrow amount.|


### _borrowOrTrade

Adjust for over-collateralized loan.

Borrow or trade.


```solidity
function _borrowOrTrade(
    LoanParams memory loanParamsLocal,
    bytes32 loanId,
    bool isTorqueLoan,
    uint256 collateralAmountRequired,
    uint256 initialMargin,
    MarginTradeStructHelpers.SentAddresses memory sentAddresses,
    MarginTradeStructHelpers.SentAmounts memory sentValues,
    bytes memory loanDataBytes
) internal returns (uint256, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanParamsLocal`|`LoanParams`|The loan parameters.|
|`loanId`|`bytes32`|The ID of the loan. If 0, start a new loan.|
|`isTorqueLoan`|`bool`|Whether the loan is a Torque loan.|
|`collateralAmountRequired`|`uint256`|The required amount of collateral.|
|`initialMargin`|`uint256`|The initial amount of margin.|
|`sentAddresses`|`MarginTradeStructHelpers.SentAddresses`|The addresses to send tokens: lender, borrower, receiver and manager: lender: must match loan if loanId provided. borrower: must match loan if loanId provided. receiver: receiver of funds (address(0) assumes borrower address). manager: delegated manager of loan unless address(0).|
|`sentValues`|`MarginTradeStructHelpers.SentAmounts`|The values to send: interestRate: New loan interest rate. newPrincipal: New loan size (borrowAmount + any borrowed interest). interestInitialAmount: New amount of interest to escrow for Torque loan (determines initial loan length). loanTokenReceived: Total loanToken deposit (amount not sent to borrower in the case of Torque loans). collateralTokenSent: Total collateralToken deposit. minEntryPrice: Minimum entry price for checking price divergence (Value of loan token in collateral).|
|`loanDataBytes`|`bytes`|The payload for the call. These loan DataBytes are additional loan data (not in use for token swaps).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The new loan size.|
|`<none>`|`uint256`|The new collateral amount.|


### _updateCollateralAfterTrade

maxLoanTerm == 0 indicates a Torque loan and requires that torqueInterest != 0
torqueInterest
Initialize loan.
newRate
newPrincipal,
torqueInterest
substract out interest from usable loanToken sent.
borrower
fee token
pairToken (used to check if there is any special rebates or not) -- to pay fee reward
Update collateral after trade.
Settle collateral.
reclaiming variable -> interestDuration
reclaiming variable -> entryLeverage = 100 / initialMargin
newPrincipal, newCollateral


```solidity
function _updateCollateralAfterTrade(
    bytes32 loanId,
    LoanParams memory loanParamsLocal,
    MarginTradeStructHelpers.SentAddresses memory sentAddresses,
    MarginTradeStructHelpers.SentAmounts memory sentValues,
    bytes memory loanDataBytes
) internal returns (MarginTradeStructHelpers.SentAmounts memory);
```

### _finalizeOpen

borrower
loanTokenUsable (minSourceTokenAmount)
maxSourceTokenAmount (0 means minSourceTokenAmount)
requiredDestTokenAmount (enforces that all of loanTokenUsable is swapped)
bypassFee
Check the minEntryPrice with the rate

Finalize an open loan.

*Finalize it by updating local parameters of the loan.*


```solidity
function _finalizeOpen(
    LoanParams memory loanParamsLocal,
    Loan storage loanLocal,
    MarginTradeStructHelpers.SentAddresses memory sentAddresses,
    MarginTradeStructHelpers.SentAmounts memory sentValues,
    bool isTorqueLoan
) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanParamsLocal`|`LoanParams`|The loan parameters.|
|`loanLocal`|`Loan`|The loan object.|
|`sentAddresses`|`MarginTradeStructHelpers.SentAddresses`|The addresses to send tokens: lender, borrower, receiver and manager: lender: must match loan if loanId provided. borrower: must match loan if loanId provided. receiver: receiver of funds (address(0) assumes borrower address). manager: delegated manager of loan unless address(0).|
|`sentValues`|`MarginTradeStructHelpers.SentAmounts`|The values to send: interestRate: New loan interest rate. newPrincipal: New loan size (borrowAmount + any borrowed interest). interestInitialAmount: New amount of interest to escrow for Torque loan (determines initial loan length). loanTokenReceived: Total loanToken deposit (amount not sent to borrower in the case of Torque loans). collateralTokenSent: Total collateralToken deposit. minEntryPrice: Minimum entry price for checking price divergence (Value of loan token in collateral).|
|`isTorqueLoan`|`bool`|Whether the loan is a Torque loan.|


### _emitOpeningEvents

Emit the opening events.

*TODO: here the actual used rate and margin should go.*


```solidity
function _emitOpeningEvents(
    LoanParams memory loanParamsLocal,
    Loan memory loanLocal,
    MarginTradeStructHelpers.SentAddresses memory sentAddresses,
    MarginTradeStructHelpers.SentAmounts memory sentValues,
    uint256 collateralToLoanRate,
    uint256 margin,
    bool isTorqueLoan
) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanParamsLocal`|`LoanParams`|The loan parameters.|
|`loanLocal`|`Loan`|The loan object.|
|`sentAddresses`|`MarginTradeStructHelpers.SentAddresses`|The addresses to send tokens: lender, borrower, receiver and manager: lender: must match loan if loanId provided. borrower: must match loan if loanId provided. receiver: receiver of funds (address(0) assumes borrower address). manager: delegated manager of loan unless address(0).|
|`sentValues`|`MarginTradeStructHelpers.SentAmounts`|The values to send: interestRate: New loan interest rate. newPrincipal: New loan size (borrowAmount + any borrowed interest). interestInitialAmount: New amount of interest to escrow for Torque loan (determines initial loan length). loanTokenReceived: Total loanToken deposit (amount not sent to borrower in the case of Torque loans). collateralTokenSent: Total collateralToken deposit. minEntryPrice: Minimum entry price for checking price divergence (Value of loan token in collateral).|
|`collateralToLoanRate`|`uint256`|The exchange rate from collateral to loan tokens.|
|`margin`|`uint256`|The amount of margin of the trade.|
|`isTorqueLoan`|`bool`|Whether the loan is a Torque loan.|


### _setDelegatedManager

user (borrower)
lender
loanId
loanToken
collateralToken
newPrincipal
newCollateral
interestRate
interestDuration
collateralToLoanRate,
currentMargin
currentLeverage = 100 / currentMargin
user (trader)
lender
loanId
collateralToken
loanToken
positionSize
borrowedAmount
interestRate,
settlementDate
entryPrice (loanToCollateralSwapRate)
entryLeverage
currentLeverage

Set the delegated manager.


```solidity
function _setDelegatedManager(bytes32 loanId, address delegator, address delegated, bool toggle) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|The ID of the loan. If 0, start a new loan.|
|`delegator`|`address`|The address of previous manager.|
|`delegated`|`address`|The address of the delegated manager.|
|`toggle`|`bool`|The flag true/false for the delegated manager.|


### _isCollateralSatisfied

Calculate whether the collateral is satisfied.

*Basically check collateral + drawdown >= 98% of required.*


```solidity
function _isCollateralSatisfied(
    LoanParams memory loanParamsLocal,
    Loan memory loanLocal,
    uint256 initialMargin,
    uint256 newCollateral,
    uint256 collateralAmountRequired,
    uint256 newPrincipal
) internal view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanParamsLocal`|`LoanParams`|The loan parameters.|
|`loanLocal`|`Loan`|The loan object.|
|`initialMargin`|`uint256`|The initial amount of margin.|
|`newCollateral`|`uint256`|The amount of new collateral.|
|`collateralAmountRequired`|`uint256`|The amount of required collateral.|
|`newPrincipal`|`uint256`|The amount to borrow.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|Whether the collateral is satisfied.|


### _initializeLoan

Allow at most 2% under-collateralized.
Check that existing collateral is sufficient coverage.

Initialize a loan.


```solidity
function _initializeLoan(
    LoanParams memory loanParamsLocal,
    bytes32 loanId,
    uint256 initialMargin,
    MarginTradeStructHelpers.SentAddresses memory sentAddresses,
    uint256 newPrincipal
) internal returns (bytes32);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanParamsLocal`|`LoanParams`|The loan parameters.|
|`loanId`|`bytes32`|The ID of the loan.|
|`initialMargin`|`uint256`|The amount of margin of the trade.|
|`sentAddresses`|`MarginTradeStructHelpers.SentAddresses`|The addresses to send tokens: lender, borrower, receiver and manager: lender: must match loan if loanId provided. borrower: must match loan if loanId provided. receiver: receiver of funds (address(0) assumes borrower address). manager: delegated manager of loan unless address(0).|
|`newPrincipal`|`uint256`|New loan size (borrowAmount + any borrowed interest).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes32`|The loanId.|


### _initializeInterest

calculated later
calculated later
queried later

Initialize a loan interest.

*A Torque loan is an indefinite-term loan.*


```solidity
function _initializeInterest(
    LoanParams memory loanParamsLocal,
    Loan storage loanLocal,
    uint256 newRate,
    uint256 newPrincipal,
    uint256 torqueInterest
) internal returns (uint256 interestAmountRequired);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanParamsLocal`|`LoanParams`|The loan parameters.|
|`loanLocal`|`Loan`|The loan object.|
|`newRate`|`uint256`|The new interest rate of the loan.|
|`newPrincipal`|`uint256`|The new principal amount of the loan.|
|`torqueInterest`|`uint256`|The interest rate of the Torque loan.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`interestAmountRequired`|`uint256`|The interest amount required.|


### _getRequiredCollateral

Pay outstanding interest to lender.
fee token
pairToken (used to check if there is any special rebates or not) -- to pay fee reward
block.timestamp < endTimestamp was confirmed earlier.
Update stored owedPerDay
Indefinite-term (Torque) loan.
torqueInterest != 0 was confirmed earlier.
Loan term has to at least be greater than one hour.
Fixed-term loan.
Update remaining lender interest values.

Get the required collateral.

*Basically collateral = newPrincipal * marginAmount*


```solidity
function _getRequiredCollateral(
    address loanToken,
    address collateralToken,
    uint256 newPrincipal,
    uint256 marginAmount,
    bool isTorqueLoan
) internal view returns (uint256 collateralTokenAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanToken`|`address`|The loan token instance address.|
|`collateralToken`|`address`|The collateral token instance address.|
|`newPrincipal`|`uint256`|The updated amount of principal (current debt).|
|`marginAmount`|`uint256`|The amount of margin of the trade.|
|`isTorqueLoan`|`bool`|Whether the loan is a Torque loan.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`collateralTokenAmount`|`uint256`|The required collateral.|


