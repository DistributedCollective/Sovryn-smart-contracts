# LoanMaintenance
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/modules/LoanMaintenance.sol)

**Inherits:**
[LoanOpeningsEvents](/contracts/events/LoanOpeningsEvents.sol/contract.LoanOpeningsEvents.md), [LoanMaintenanceEvents](/contracts/events/LoanMaintenanceEvents.sol/contract.LoanMaintenanceEvents.md), [VaultController](/contracts/mixins/VaultController.sol/contract.VaultController.md), [InterestUser](/contracts/mixins/InterestUser.sol/contract.InterestUser.md), [SwapsUser](/contracts/swaps/SwapsUser.sol/contract.SwapsUser.md), [LiquidationHelper](/contracts/mixins/LiquidationHelper.sol/contract.LiquidationHelper.md), [ModuleCommonFunctionalities](/contracts/mixins/ModuleCommonFunctionalities.sol/contract.ModuleCommonFunctionalities.md)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains functions to query loan data and to modify its status
by withdrawing or depositing collateral.


## Functions
### constructor

Empty public constructor.


```solidity
constructor() public;
```

### function

Fallback function is to react to receiving value (rBTC).


```solidity
function() external;
```

### initialize

Set initial values of proxy targets.


```solidity
function initialize(address target) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`target`|`address`|The address of the logic contract instance.|


### depositCollateral

Increase the margin of a position by depositing additional collateral.


```solidity
function depositCollateral(bytes32 loanId, uint256 depositAmount) external payable nonReentrant whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|A unique ID representing the loan.|
|`depositAmount`|`uint256`|The amount to be deposited in collateral tokens.|


### withdrawCollateral

Withdraw from the collateral. This reduces the margin of a position.


```solidity
function withdrawCollateral(bytes32 loanId, address receiver, uint256 withdrawAmount)
    external
    nonReentrant
    whenNotPaused
    returns (uint256 actualWithdrawAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|A unique ID representing the loan.|
|`receiver`|`address`|The account getting the withdrawal.|
|`withdrawAmount`|`uint256`|The amount to be withdrawn in collateral tokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`actualWithdrawAmount`|`uint256`|The amount withdrawn taking into account drawdowns.|


### withdrawAccruedInterest

Withdraw accrued loan interest.

*Wrapper for _payInterest internal function.*


```solidity
function withdrawAccruedInterest(address loanToken) external whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanToken`|`address`|The loan token address.|


### extendLoanDuration

Pay outstanding interest to lender.
Lender.

Extend the loan duration by as much time as depositAmount can buy.


```solidity
function extendLoanDuration(bytes32 loanId, uint256 depositAmount, bool useCollateral, bytes calldata)
    external
    payable
    nonReentrant
    whenNotPaused
    returns (uint256 secondsExtended);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|A unique ID representing the loan.|
|`depositAmount`|`uint256`|The amount to be deposited in loan tokens. Used to pay the interest for the new duration.|
|`useCollateral`|`bool`|Whether pay interests w/ the collateral. If true, depositAmount of loan tokens will be purchased with the collateral. // param calldata The payload for the call. These loan DataBytes are additional loan data (not in use for token swaps).|
|`<none>`|`bytes`||

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`secondsExtended`|`uint256`|The amount of time in seconds the loan is extended.|


### reduceLoanDuration

Pay outstanding interest to lender.
fee token
pairToken (used to check if there is any special rebates or not) -- to pay fee reward
Handle back interest: calculates interest owned since the loan
endtime passed but the loan remained open.
Deposit interest.
Used the whole converted loanToken to extend the loan duration
Pay out backInterestOwed
Loan term has to at least be greater than one hour.

Reduce the loan duration by withdrawing from the deposited interest.


```solidity
function reduceLoanDuration(bytes32 loanId, address receiver, uint256 withdrawAmount)
    external
    nonReentrant
    whenNotPaused
    returns (uint256 secondsReduced);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|A unique ID representing the loan.|
|`receiver`|`address`|The account getting the withdrawal.|
|`withdrawAmount`|`uint256`|The amount to be withdrawn in loan tokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`secondsReduced`|`uint256`|The amount of time in seconds the loan is reduced.|


### getLenderInterestData

Pay outstanding interest to lender.
fee token
pairToken (used to check if there is any special rebates or not) -- to pay fee reward
Withdraw interest.
Loan term has to at least be greater than one hour.

Get current lender interest data totals for all loans
with a specific oracle and interest token.


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
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lender`|`address`|The lender address.|
|`loanToken`|`address`|The loan token address.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`interestPaid`|`uint256`|The total amount of interest that has been paid to a lender so far.|
|`interestPaidDate`|`uint256`|The date of the last interest pay out, or 0 if no interest has been withdrawn yet.|
|`interestOwedPerDay`|`uint256`|The amount of interest the lender is earning per day.|
|`interestUnPaid`|`uint256`|The total amount of interest the lender is owned and not yet withdrawn.|
|`interestFeePercent`|`uint256`|The fee retained by the protocol before interest is paid to the lender.|
|`principalTotal`|`uint256`|The total amount of outstanding principal the lender has loaned.|


### getLoanInterestData

Get current interest data for a loan.


```solidity
function getLoanInterestData(bytes32 loanId)
    external
    view
    returns (
        address loanToken,
        uint256 interestOwedPerDay,
        uint256 interestDepositTotal,
        uint256 interestDepositRemaining
    );
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|A unique ID representing the loan.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loanToken`|`address`|The loan token that interest is paid in.|
|`interestOwedPerDay`|`uint256`|The amount of interest the borrower is paying per day.|
|`interestDepositTotal`|`uint256`|The total amount of interest the borrower has deposited.|
|`interestDepositRemaining`|`uint256`|The amount of deposited interest that is not yet owed to a lender.|


### getUserLoans

Get all user loans.
Only returns data for loans that are active.


```solidity
function getUserLoans(address user, uint256 start, uint256 count, uint256 loanType, bool isLender, bool unsafeOnly)
    external
    view
    returns (LoanReturnData[] memory loansData);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|The user address.|
|`start`|`uint256`|The lower loan ID to start with.|
|`count`|`uint256`|The maximum number of results.|
|`loanType`|`uint256`|The type of loan. loanType 0: all loans. loanType 1: margin trade loans. loanType 2: non-margin trade loans.|
|`isLender`|`bool`|Whether the user is lender or borrower.|
|`unsafeOnly`|`bool`|The safe filter (True/False).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loansData`|`LoanReturnData[]`|The array of loans as query result.|


### getUserLoansV2

loanId

Get all user loans.
Only returns data for loans that are active.


```solidity
function getUserLoansV2(address user, uint256 start, uint256 count, uint256 loanType, bool isLender, bool unsafeOnly)
    external
    view
    returns (LoanReturnDataV2[] memory loansDataV2);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|The user address.|
|`start`|`uint256`|The lower loan ID to start with.|
|`count`|`uint256`|The maximum number of results.|
|`loanType`|`uint256`|The type of loan. loanType 0: all loans. loanType 1: margin trade loans. loanType 2: non-margin trade loans.|
|`isLender`|`bool`|Whether the user is lender or borrower.|
|`unsafeOnly`|`bool`|The safe filter (True/False).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loansDataV2`|`LoanReturnDataV2[]`|loansData The array of loans as query result.|


### getLoan

loanId

Get one loan data structure by matching ID.
Wrapper to internal _getLoan call.


```solidity
function getLoan(bytes32 loanId) external view returns (LoanReturnData memory loanData);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|A unique ID representing the loan.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loanData`|`LoanReturnData`|loansData The data structure w/ loan information.|


### getLoanV2

loanType
unsafeOnly

Get one loan data structure by matching ID.
Wrapper to internal _getLoan call.


```solidity
function getLoanV2(bytes32 loanId) external view returns (LoanReturnDataV2 memory loanDataV2);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|A unique ID representing the loan.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loanDataV2`|`LoanReturnDataV2`|loansData The data structure w/ loan information.|


### getActiveLoans

loanType
unsafeOnly

Get all active loans.


```solidity
function getActiveLoans(uint256 start, uint256 count, bool unsafeOnly)
    external
    view
    returns (LoanReturnData[] memory loansData);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`start`|`uint256`|The lower loan ID to start with.|
|`count`|`uint256`|The maximum number of results.|
|`unsafeOnly`|`bool`|The safe filter (True/False).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loansData`|`LoanReturnData[]`|The data structure w/ loan information.|


### getActiveLoansV2

loanId
loanType

*New view function which will return the loan data.*

*This function was created to support backward compatibility*

*As in we the old getActiveLoans function is not expected to be changed by the wathcers.*


```solidity
function getActiveLoansV2(uint256 start, uint256 count, bool unsafeOnly)
    external
    view
    returns (LoanReturnDataV2[] memory loansDataV2);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`start`|`uint256`|The lower loan ID to start with.|
|`count`|`uint256`|The maximum number of results.|
|`unsafeOnly`|`bool`|The safe filter (True/False).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loansDataV2`|`LoanReturnDataV2[]`|loanData The data structure|


### _getLoan

loanId
loanType

Internal function to get one loan data structure.


```solidity
function _getLoan(bytes32 loanId, uint256 loanType, bool unsafeOnly)
    internal
    view
    returns (LoanReturnData memory loanData);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|A unique ID representing the loan.|
|`loanType`|`uint256`|The type of loan. loanType 0: all loans. loanType 1: margin trade loans. loanType 2: non-margin trade loans.|
|`unsafeOnly`|`bool`|The safe filter (True/False).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loanData`|`LoanReturnData`|loansData The data structure w/ the loan information.|


### _getLoanV2

Internal function to get one loan data structure v2.


```solidity
function _getLoanV2(bytes32 loanId, uint256 loanType, bool unsafeOnly)
    internal
    view
    returns (LoanReturnDataV2 memory loanDataV2);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|A unique ID representing the loan.|
|`loanType`|`uint256`|The type of loan. loanType 0: all loans. loanType 1: margin trade loans. loanType 2: non-margin trade loans.|
|`unsafeOnly`|`bool`|The safe filter (True/False).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loanDataV2`|`LoanReturnDataV2`|loansData The data v2 structure w/ the loan information.|


### _doCollateralSwap

Internal function to collect interest from the collateral.


```solidity
function _doCollateralSwap(Loan storage loanLocal, LoanParams memory loanParamsLocal, uint256 depositAmount)
    internal
    returns (uint256 purchasedLoanToken);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanLocal`|`Loan`|The loan object.|
|`loanParamsLocal`|`LoanParams`|The loan parameters.|
|`depositAmount`|`uint256`|The amount of underlying tokens provided on the loan.|


## Structs
### LoanReturnData

```solidity
struct LoanReturnData {
    bytes32 loanId;
    address loanToken;
    address collateralToken;
    uint256 principal;
    uint256 collateral;
    uint256 interestOwedPerDay;
    uint256 interestDepositRemaining;
    uint256 startRate;
    uint256 startMargin;
    uint256 maintenanceMargin;
    uint256 currentMargin;
    uint256 maxLoanTerm;
    uint256 endTimestamp;
    uint256 maxLiquidatable;
    uint256 maxSeizable;
}
```

### LoanReturnDataV2

```solidity
struct LoanReturnDataV2 {
    bytes32 loanId;
    address loanToken;
    address collateralToken;
    address borrower;
    uint256 principal;
    uint256 collateral;
    uint256 interestOwedPerDay;
    uint256 interestDepositRemaining;
    uint256 startRate;
    uint256 startMargin;
    uint256 maintenanceMargin;
    uint256 currentMargin;
    uint256 maxLoanTerm;
    uint256 endTimestamp;
    uint256 maxLiquidatable;
    uint256 maxSeizable;
    uint256 creationTimestamp;
}
```

