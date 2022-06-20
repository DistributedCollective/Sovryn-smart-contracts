# Loan Maintenance contract.
 * (LoanMaintenance.sol)

View Source: [contracts/modules/LoanMaintenance.sol](../contracts/modules/LoanMaintenance.sol)

**↗ Extends: [LoanOpeningsEvents](LoanOpeningsEvents.md), [LoanMaintenanceEvents](LoanMaintenanceEvents.md), [VaultController](VaultController.md), [InterestUser](InterestUser.md), [SwapsUser](SwapsUser.md), [LiquidationHelper](LiquidationHelper.md), [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)**

**LoanMaintenance**

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
 * This contract contains functions to query loan data and to modify its status
by withdrawing or depositing collateral.

## Structs
### LoanReturnData

```js
struct LoanReturnData {
 bytes32 loanId,
 address loanToken,
 address collateralToken,
 uint256 principal,
 uint256 collateral,
 uint256 interestOwedPerDay,
 uint256 interestDepositRemaining,
 uint256 startRate,
 uint256 startMargin,
 uint256 maintenanceMargin,
 uint256 currentMargin,
 uint256 maxLoanTerm,
 uint256 endTimestamp,
 uint256 maxLiquidatable,
 uint256 maxSeizable
}
```

### LoanReturnDataV2

```js
struct LoanReturnDataV2 {
 bytes32 loanId,
 address loanToken,
 address collateralToken,
 address borrower,
 uint256 principal,
 uint256 collateral,
 uint256 interestOwedPerDay,
 uint256 interestDepositRemaining,
 uint256 startRate,
 uint256 startMargin,
 uint256 maintenanceMargin,
 uint256 currentMargin,
 uint256 maxLoanTerm,
 uint256 endTimestamp,
 uint256 maxLiquidatable,
 uint256 maxSeizable,
 uint256 creationTimestamp
}
```

## Functions

- [constructor()](#constructor)
- [constructor()](#constructor)
- [initialize(address target)](#initialize)
- [depositCollateral(bytes32 loanId, uint256 depositAmount)](#depositcollateral)
- [withdrawCollateral(bytes32 loanId, address receiver, uint256 withdrawAmount)](#withdrawcollateral)
- [withdrawAccruedInterest(address loanToken)](#withdrawaccruedinterest)
- [extendLoanDuration(bytes32 loanId, uint256 depositAmount, bool useCollateral, bytes )](#extendloanduration)
- [reduceLoanDuration(bytes32 loanId, address receiver, uint256 withdrawAmount)](#reduceloanduration)
- [getLenderInterestData(address lender, address loanToken)](#getlenderinterestdata)
- [getLoanInterestData(bytes32 loanId)](#getloaninterestdata)
- [getUserLoans(address user, uint256 start, uint256 count, uint256 loanType, bool isLender, bool unsafeOnly)](#getuserloans)
- [getUserLoansV2(address user, uint256 start, uint256 count, uint256 loanType, bool isLender, bool unsafeOnly)](#getuserloansv2)
- [getLoan(bytes32 loanId)](#getloan)
- [getLoanV2(bytes32 loanId)](#getloanv2)
- [getActiveLoans(uint256 start, uint256 count, bool unsafeOnly)](#getactiveloans)
- [getActiveLoansV2(uint256 start, uint256 count, bool unsafeOnly)](#getactiveloansv2)
- [_getLoan(bytes32 loanId, uint256 loanType, bool unsafeOnly)](#_getloan)
- [_getLoanV2(bytes32 loanId, uint256 loanType, bool unsafeOnly)](#_getloanv2)
- [_doCollateralSwap(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 depositAmount)](#_docollateralswap)

---    

> ### constructor

Empty public constructor.

```solidity
function () public nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor() public {}
```
</details>

---    

> ### constructor

Fallback function is to react to receiving value (rBTC).

```solidity
function () external nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function() external {
        revert("fallback not allowed");
    }
```
</details>

---    

> ### initialize

Set initial values of proxy targets.
     *

```solidity
function initialize(address target) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address | The address of the logic contract instance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function initialize(address target) external onlyOwner {
        address prevModuleContractAddress = logicTargets[this.depositCollateral.selector];
        _setTarget(this.depositCollateral.selector, target);
        _setTarget(this.withdrawCollateral.selector, target);
        _setTarget(this.withdrawAccruedInterest.selector, target);
        _setTarget(this.extendLoanDuration.selector, target);
        _setTarget(this.reduceLoanDuration.selector, target);
        _setTarget(this.getLenderInterestData.selector, target);
        _setTarget(this.getLoanInterestData.selector, target);
        _setTarget(this.getUserLoans.selector, target);
        _setTarget(this.getUserLoansV2.selector, target);
        _setTarget(this.getLoan.selector, target);
        _setTarget(this.getLoanV2.selector, target);
        _setTarget(this.getActiveLoans.selector, target);
        _setTarget(this.getActiveLoansV2.selector, target);
        emit ProtocolModuleContractReplaced(prevModuleContractAddress, target, "LoanMaintenance");
    }
```
</details>

---    

> ### depositCollateral

Increase the margin of a position by depositing additional collateral.
     *

```solidity
function depositCollateral(bytes32 loanId, uint256 depositAmount) external payable nonReentrant whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | A unique ID representing the loan. | 
| depositAmount | uint256 | The amount to be deposited in collateral tokens.      * | 

**Returns**

actualWithdrawAmount The amount withdrawn taking into account drawdowns.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function depositCollateral(
        bytes32 loanId,
        uint256 depositAmount /// must match msg.value if ether is sent
    ) external payable nonReentrant whenNotPaused {
        require(depositAmount != 0, "depositAmount is 0");
        Loan storage loanLocal = loans[loanId];
        LoanParams storage loanParamsLocal = loanParams[loanLocal.loanParamsId];

        require(loanLocal.active, "loan is closed");
        require(
            msg.value == 0 || loanParamsLocal.collateralToken == address(wrbtcToken),
            "wrong asset sent"
        );

        loanLocal.collateral = loanLocal.collateral.add(depositAmount);

        if (msg.value == 0) {
            vaultDeposit(loanParamsLocal.collateralToken, msg.sender, depositAmount);
        } else {
            require(msg.value == depositAmount, "ether deposit mismatch");
            vaultEtherDeposit(msg.sender, msg.value);
        }

        (uint256 collateralToLoanRate, ) =
            IPriceFeeds(priceFeeds).queryRate(
                loanParamsLocal.collateralToken,
                loanParamsLocal.loanToken
            );

        emit DepositCollateral(loanId, depositAmount, collateralToLoanRate);
    }
```
</details>

---    

> ### withdrawCollateral

Withdraw from the collateral. This reduces the margin of a position.
     *

```solidity
function withdrawCollateral(bytes32 loanId, address receiver, uint256 withdrawAmount) external nonpayable nonReentrant whenNotPaused 
returns(actualWithdrawAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | A unique ID representing the loan. | 
| receiver | address | The account getting the withdrawal. | 
| withdrawAmount | uint256 | The amount to be withdrawn in collateral tokens.      * | 

**Returns**

actualWithdrawAmount The amount withdrawn taking into account drawdowns.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawCollateral(
        bytes32 loanId,
        address receiver,
        uint256 withdrawAmount
    ) external nonReentrant whenNotPaused returns (uint256 actualWithdrawAmount) {
        require(withdrawAmount != 0, "withdrawAmount is 0");
        Loan storage loanLocal = loans[loanId];
        LoanParams storage loanParamsLocal = loanParams[loanLocal.loanParamsId];

        require(loanLocal.active, "loan is closed");
        require(
            msg.sender == loanLocal.borrower || delegatedManagers[loanLocal.id][msg.sender],
            "unauthorized"
        );

        uint256 maxDrawdown =
            IPriceFeeds(priceFeeds).getMaxDrawdown(
                loanParamsLocal.loanToken,
                loanParamsLocal.collateralToken,
                loanLocal.principal,
                loanLocal.collateral,
                loanParamsLocal.maintenanceMargin
            );

        if (withdrawAmount > maxDrawdown) {
            actualWithdrawAmount = maxDrawdown;
        } else {
            actualWithdrawAmount = withdrawAmount;
        }

        loanLocal.collateral = loanLocal.collateral.sub(actualWithdrawAmount);

        if (loanParamsLocal.collateralToken == address(wrbtcToken)) {
            vaultEtherWithdraw(receiver, actualWithdrawAmount);
        } else {
            vaultWithdraw(loanParamsLocal.collateralToken, receiver, actualWithdrawAmount);
        }
    }
```
</details>

---    

> ### withdrawAccruedInterest

Withdraw accrued loan interest.
     *

```solidity
function withdrawAccruedInterest(address loanToken) external nonpayable whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The loan token address. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawAccruedInterest(address loanToken) external whenNotPaused {
        /// Pay outstanding interest to lender.
        _payInterest(
            msg.sender, /// Lender.
            loanToken
        );
    }
```
</details>

---    

> ### extendLoanDuration

Extend the loan duration by as much time as depositAmount can buy.
     *

```solidity
function extendLoanDuration(bytes32 loanId, uint256 depositAmount, bool useCollateral, bytes ) external payable nonReentrant whenNotPaused 
returns(secondsExtended uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | A unique ID representing the loan. | 
| depositAmount | uint256 | The amount to be deposited in loan tokens. Used to pay the interest for the new duration. | 
| useCollateral | bool | Whether pay interests w/ the collateral. If true, depositAmount of loan tokens 					will be purchased with the collateral. // param calldata The payload for the call. These loan DataBytes are additional loan data (not in use for token swaps).      * | 
|  | bytes | loanId A unique ID representing the loan. | 

**Returns**

secondsExtended The amount of time in seconds the loan is extended.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function extendLoanDuration(
        bytes32 loanId,
        uint256 depositAmount,
        bool useCollateral,
        bytes calldata /// loanDataBytes, for future use.
    ) external payable nonReentrant whenNotPaused returns (uint256 secondsExtended) {
        require(depositAmount != 0, "depositAmount is 0");
        Loan storage loanLocal = loans[loanId];
        LoanParams storage loanParamsLocal = loanParams[loanLocal.loanParamsId];

        require(loanLocal.active, "loan is closed");
        require(
            !useCollateral ||
                msg.sender == loanLocal.borrower ||
                delegatedManagers[loanLocal.id][msg.sender],
            "unauthorized"
        );
        require(loanParamsLocal.maxLoanTerm == 0, "indefinite-term only");
        require(
            msg.value == 0 || (!useCollateral && loanParamsLocal.loanToken == address(wrbtcToken)),
            "wrong asset sent"
        );

        /// Pay outstanding interest to lender.
        _payInterest(loanLocal.lender, loanParamsLocal.loanToken);

        LoanInterest storage loanInterestLocal = loanInterest[loanLocal.id];

        _settleFeeRewardForInterestExpense(
            loanInterestLocal,
            loanLocal.id,
            loanParamsLocal.loanToken, /// fee token
            loanParamsLocal.collateralToken, /// pairToken (used to check if there is any special rebates or not) -- to pay fee reward
            loanLocal.borrower,
            block.timestamp
        );

        /// Handle back interest: calculates interest owned since the loan
        /// endtime passed but the loan remained open.
        uint256 backInterestOwed;
        if (block.timestamp > loanLocal.endTimestamp) {
            backInterestOwed = block.timestamp.sub(loanLocal.endTimestamp);
            backInterestOwed = backInterestOwed.mul(loanInterestLocal.owedPerDay);
            backInterestOwed = backInterestOwed.div(86400);

            require(depositAmount > backInterestOwed, "deposit cannot cover back interest");
        }

        /// Deposit interest.
        if (useCollateral) {
            /// Used the whole converted loanToken to extend the loan duration
            depositAmount = _doCollateralSwap(loanLocal, loanParamsLocal, depositAmount);
        } else {
            if (msg.value == 0) {
                vaultDeposit(loanParamsLocal.loanToken, msg.sender, depositAmount);
            } else {
                require(msg.value == depositAmount, "ether deposit mismatch");
                vaultEtherDeposit(msg.sender, msg.value);
            }
        }

        if (backInterestOwed != 0) {
            depositAmount = depositAmount.sub(backInterestOwed);

            /// Pay out backInterestOwed
            _payInterestTransfer(loanLocal.lender, loanParamsLocal.loanToken, backInterestOwed);
        }

        secondsExtended = depositAmount.mul(86400).div(loanInterestLocal.owedPerDay);

        loanLocal.endTimestamp = loanLocal.endTimestamp.add(secondsExtended);

        require(loanLocal.endTimestamp > block.timestamp, "loan too short");

        uint256 maxDuration = loanLocal.endTimestamp.sub(block.timestamp);

        /// Loan term has to at least be greater than one hour.
        require(maxDuration > 3600, "loan too short");

        loanInterestLocal.depositTotal = loanInterestLocal.depositTotal.add(depositAmount);

        lenderInterest[loanLocal.lender][loanParamsLocal.loanToken].owedTotal = lenderInterest[
            loanLocal.lender
        ][loanParamsLocal.loanToken]
            .owedTotal
            .add(depositAmount);
    }
```
</details>

---    

> ### reduceLoanDuration

Reduce the loan duration by withdrawing from the deposited interest.
     *

```solidity
function reduceLoanDuration(bytes32 loanId, address receiver, uint256 withdrawAmount) external nonpayable nonReentrant whenNotPaused 
returns(secondsReduced uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | A unique ID representing the loan. | 
| receiver | address | The account getting the withdrawal. | 
| withdrawAmount | uint256 | The amount to be withdrawn in loan tokens.      * | 

**Returns**

secondsReduced The amount of time in seconds the loan is reduced.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function reduceLoanDuration(
        bytes32 loanId,
        address receiver,
        uint256 withdrawAmount
    ) external nonReentrant whenNotPaused returns (uint256 secondsReduced) {
        require(withdrawAmount != 0, "withdrawAmount is 0");
        Loan storage loanLocal = loans[loanId];
        LoanParams storage loanParamsLocal = loanParams[loanLocal.loanParamsId];

        require(loanLocal.active, "loan is closed");
        require(
            msg.sender == loanLocal.borrower || delegatedManagers[loanLocal.id][msg.sender],
            "unauthorized"
        );
        require(loanParamsLocal.maxLoanTerm == 0, "indefinite-term only");
        require(loanLocal.endTimestamp > block.timestamp, "loan term has ended");

        /// Pay outstanding interest to lender.
        _payInterest(loanLocal.lender, loanParamsLocal.loanToken);

        LoanInterest storage loanInterestLocal = loanInterest[loanLocal.id];

        _settleFeeRewardForInterestExpense(
            loanInterestLocal,
            loanLocal.id,
            loanParamsLocal.loanToken, /// fee token
            loanParamsLocal.collateralToken, /// pairToken (used to check if there is any special rebates or not) -- to pay fee reward
            loanLocal.borrower,
            block.timestamp
        );

        uint256 interestDepositRemaining =
            loanLocal.endTimestamp.sub(block.timestamp).mul(loanInterestLocal.owedPerDay).div(
                86400
            );
        require(withdrawAmount < interestDepositRemaining, "withdraw amount too high");

        /// Withdraw interest.
        if (loanParamsLocal.loanToken == address(wrbtcToken)) {
            vaultEtherWithdraw(receiver, withdrawAmount);
        } else {
            vaultWithdraw(loanParamsLocal.loanToken, receiver, withdrawAmount);
        }

        secondsReduced = withdrawAmount.mul(86400).div(loanInterestLocal.owedPerDay);

        require(loanLocal.endTimestamp > secondsReduced, "loan too short");

        loanLocal.endTimestamp = loanLocal.endTimestamp.sub(secondsReduced);

        require(loanLocal.endTimestamp > block.timestamp, "loan too short");

        uint256 maxDuration = loanLocal.endTimestamp.sub(block.timestamp);

        /// Loan term has to at least be greater than one hour.
        require(maxDuration > 3600, "loan too short");

        loanInterestLocal.depositTotal = loanInterestLocal.depositTotal.sub(withdrawAmount);

        lenderInterest[loanLocal.lender][loanParamsLocal.loanToken].owedTotal = lenderInterest[
            loanLocal.lender
        ][loanParamsLocal.loanToken]
            .owedTotal
            .sub(withdrawAmount);
    }
```
</details>

---    

> ### getLenderInterestData

Get current lender interest data totals for all loans
  with a specific oracle and interest token.
     *

```solidity
function getLenderInterestData(address lender, address loanToken) external view
returns(interestPaid uint256, interestPaidDate uint256, interestOwedPerDay uint256, interestUnPaid uint256, interestFeePercent uint256, principalTotal uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lender | address | The lender address. | 
| loanToken | address | The loan token address.      * | 

**Returns**

interestPaid The total amount of interest that has been paid to a lender so far.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
        )
    {
        LenderInterest memory lenderInterestLocal = lenderInterest[lender][loanToken];

        interestUnPaid = block
            .timestamp
            .sub(lenderInterestLocal.updatedTimestamp)
            .mul(lenderInterestLocal.owedPerDay)
            .div(86400);
        if (interestUnPaid > lenderInterestLocal.owedTotal)
            interestUnPaid = lenderInterestLocal.owedTotal;

        return (
            lenderInterestLocal.paidTotal,
            lenderInterestLocal.paidTotal != 0 ? lenderInterestLocal.updatedTimestamp : 0,
            lenderInterestLocal.owedPerDay,
            lenderInterestLocal.updatedTimestamp != 0 ? interestUnPaid : 0,
            lendingFeePercent,
            lenderInterestLocal.principalTotal
        );
    }
```
</details>

---    

> ### getLoanInterestData

Get current interest data for a loan.
     *

```solidity
function getLoanInterestData(bytes32 loanId) external view
returns(loanToken address, interestOwedPerDay uint256, interestDepositTotal uint256, interestDepositRemaining uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | A unique ID representing the loan.      * | 

**Returns**

loanToken The loan token that interest is paid in.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLoanInterestData(bytes32 loanId)
        external
        view
        returns (
            address loanToken,
            uint256 interestOwedPerDay,
            uint256 interestDepositTotal,
            uint256 interestDepositRemaining
        )
    {
        loanToken = loanParams[loans[loanId].loanParamsId].loanToken;
        interestOwedPerDay = loanInterest[loanId].owedPerDay;
        interestDepositTotal = loanInterest[loanId].depositTotal;

        uint256 endTimestamp = loans[loanId].endTimestamp;
        uint256 interestTime = block.timestamp > endTimestamp ? endTimestamp : block.timestamp;
        interestDepositRemaining = endTimestamp > interestTime
            ? endTimestamp.sub(interestTime).mul(interestOwedPerDay).div(86400)
            : 0;
    }
```
</details>

---    

> ### getUserLoans

Get all user loans.
     * Only returns data for loans that are active.
     *

```solidity
function getUserLoans(address user, uint256 start, uint256 count, uint256 loanType, bool isLender, bool unsafeOnly) external view
returns(loansData struct LoanMaintenance.LoanReturnData[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The user address. | 
| start | uint256 | The lower loan ID to start with. | 
| count | uint256 | The maximum number of results. | 
| loanType | uint256 | The type of loan.   loanType 0: all loans.   loanType 1: margin trade loans.   loanType 2: non-margin trade loans. | 
| isLender | bool | Whether the user is lender or borrower. | 
| unsafeOnly | bool | The safe filter (True/False).      * | 

**Returns**

loansData The array of loans as query result.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUserLoans(
        address user,
        uint256 start,
        uint256 count,
        uint256 loanType,
        bool isLender,
        bool unsafeOnly
    ) external view returns (LoanReturnData[] memory loansData) {
        EnumerableBytes32Set.Bytes32Set storage set =
            isLender ? lenderLoanSets[user] : borrowerLoanSets[user];

        uint256 end = start.add(count).min256(set.length());
        if (start >= end) {
            return loansData;
        }

        loansData = new LoanReturnData[](count);
        uint256 itemCount;
        for (uint256 i = end - start; i > 0; i--) {
            if (itemCount == count) {
                break;
            }
            LoanReturnData memory loanData =
                _getLoan(
                    set.get(i + start - 1), /// loanId
                    loanType,
                    unsafeOnly
                );
            if (loanData.loanId == 0) continue;

            loansData[itemCount] = loanData;
            itemCount++;
        }

        if (itemCount < count) {
            assembly {
                mstore(loansData, itemCount)
            }
        }
    }
```
</details>

---    

> ### getUserLoansV2

Get all user loans.
     * Only returns data for loans that are active.
     *

```solidity
function getUserLoansV2(address user, uint256 start, uint256 count, uint256 loanType, bool isLender, bool unsafeOnly) external view
returns(loansDataV2 struct LoanMaintenance.LoanReturnDataV2[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The user address. | 
| start | uint256 | The lower loan ID to start with. | 
| count | uint256 | The maximum number of results. | 
| loanType | uint256 | The type of loan.   loanType 0: all loans.   loanType 1: margin trade loans.   loanType 2: non-margin trade loans. | 
| isLender | bool | Whether the user is lender or borrower. | 
| unsafeOnly | bool | The safe filter (True/False).      * | 

**Returns**

loansData The array of loans as query result.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUserLoansV2(
        address user,
        uint256 start,
        uint256 count,
        uint256 loanType,
        bool isLender,
        bool unsafeOnly
    ) external view returns (LoanReturnDataV2[] memory loansDataV2) {
        EnumerableBytes32Set.Bytes32Set storage set =
            isLender ? lenderLoanSets[user] : borrowerLoanSets[user];

        uint256 end = start.add(count).min256(set.length());
        if (start >= end) {
            return loansDataV2;
        }

        loansDataV2 = new LoanReturnDataV2[](count);
        uint256 itemCount;
        for (uint256 i = end - start; i > 0; i--) {
            if (itemCount == count) {
                break;
            }
            LoanReturnDataV2 memory loanDataV2 =
                _getLoanV2(
                    set.get(i + start - 1), /// loanId
                    loanType,
                    unsafeOnly
                );
            if (loanDataV2.loanId == 0) continue;

            loansDataV2[itemCount] = loanDataV2;
            itemCount++;
        }

        if (itemCount < count) {
            assembly {
                mstore(loansDataV2, itemCount)
            }
        }
    }
```
</details>

---    

> ### getLoan

Get one loan data structure by matching ID.
     * Wrapper to internal _getLoan call.
     *

```solidity
function getLoan(bytes32 loanId) external view
returns(loanData struct LoanMaintenance.LoanReturnData)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | A unique ID representing the loan.      * | 

**Returns**

loansData The data structure w/ loan information.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLoan(bytes32 loanId) external view returns (LoanReturnData memory loanData) {
        return
            _getLoan(
                loanId,
                0, /// loanType
                false /// unsafeOnly
            );
    }
```
</details>

---    

> ### getLoanV2

Get one loan data structure by matching ID.
     * Wrapper to internal _getLoan call.
     *

```solidity
function getLoanV2(bytes32 loanId) external view
returns(loanDataV2 struct LoanMaintenance.LoanReturnDataV2)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | A unique ID representing the loan.      * | 

**Returns**

loansData The data structure w/ loan information.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLoanV2(bytes32 loanId) external view returns (LoanReturnDataV2 memory loanDataV2) {
        return
            _getLoanV2(
                loanId,
                0, /// loanType
                false /// unsafeOnly
            );
    }
```
</details>

---    

> ### getActiveLoans

Get all active loans.
     *

```solidity
function getActiveLoans(uint256 start, uint256 count, bool unsafeOnly) external view
returns(loansData struct LoanMaintenance.LoanReturnData[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| start | uint256 | The lower loan ID to start with. | 
| count | uint256 | The maximum number of results. | 
| unsafeOnly | bool | The safe filter (True/False).      * | 

**Returns**

loansData The data structure w/ loan information.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getActiveLoans(
        uint256 start,
        uint256 count,
        bool unsafeOnly
    ) external view returns (LoanReturnData[] memory loansData) {
        uint256 end = start.add(count).min256(activeLoansSet.length());
        if (start >= end) {
            return loansData;
        }

        loansData = new LoanReturnData[](count);
        uint256 itemCount;
        for (uint256 i = end - start; i > 0; i--) {
            if (itemCount == count) {
                break;
            }
            LoanReturnData memory loanData =
                _getLoan(
                    activeLoansSet.get(i + start - 1), /// loanId
                    0, /// loanType
                    unsafeOnly
                );
            if (loanData.loanId == 0) continue;

            loansData[itemCount] = loanData;
            itemCount++;
        }

        if (itemCount < count) {
            assembly {
                mstore(loansData, itemCount)
            }
        }
    }
```
</details>

---    

> ### getActiveLoansV2

New view function which will return the loan data.

```solidity
function getActiveLoansV2(uint256 start, uint256 count, bool unsafeOnly) external view
returns(loansDataV2 struct LoanMaintenance.LoanReturnDataV2[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| start | uint256 | The lower loan ID to start with. | 
| count | uint256 | The maximum number of results. | 
| unsafeOnly | bool | The safe filter (True/False).      * | 

**Returns**

loanData The data structure

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getActiveLoansV2(
        uint256 start,
        uint256 count,
        bool unsafeOnly
    ) external view returns (LoanReturnDataV2[] memory loansDataV2) {
        uint256 end = start.add(count).min256(activeLoansSet.length());
        if (start >= end) {
            return loansDataV2;
        }

        loansDataV2 = new LoanReturnDataV2[](count);
        uint256 itemCount;
        for (uint256 i = end - start; i > 0; i--) {
            if (itemCount == count) {
                break;
            }
            LoanReturnDataV2 memory loanDataV2 =
                _getLoanV2(
                    activeLoansSet.get(i + start - 1), /// loanId
                    0, /// loanType
                    unsafeOnly
                );
            if (loanDataV2.loanId == 0) continue;

            loansDataV2[itemCount] = loanDataV2;
            itemCount++;
        }

        if (itemCount < count) {
            assembly {
                mstore(loansDataV2, itemCount)
            }
        }
    }
```
</details>

---    

> ### _getLoan

Internal function to get one loan data structure.
     *

```solidity
function _getLoan(bytes32 loanId, uint256 loanType, bool unsafeOnly) internal view
returns(loanData struct LoanMaintenance.LoanReturnData)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | A unique ID representing the loan. | 
| loanType | uint256 | The type of loan.   loanType 0: all loans.   loanType 1: margin trade loans.   loanType 2: non-margin trade loans. | 
| unsafeOnly | bool | The safe filter (True/False).      * | 

**Returns**

loansData The data structure w/ the loan information.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getLoan(
        bytes32 loanId,
        uint256 loanType,
        bool unsafeOnly
    ) internal view returns (LoanReturnData memory loanData) {
        Loan memory loanLocal = loans[loanId];
        LoanParams memory loanParamsLocal = loanParams[loanLocal.loanParamsId];

        if (loanType != 0) {
            if (
                !((loanType == 1 && loanParamsLocal.maxLoanTerm != 0) ||
                    (loanType == 2 && loanParamsLocal.maxLoanTerm == 0))
            ) {
                return loanData;
            }
        }

        LoanInterest memory loanInterestLocal = loanInterest[loanId];

        (uint256 currentMargin, uint256 collateralToLoanRate) =
            IPriceFeeds(priceFeeds).getCurrentMargin(
                loanParamsLocal.loanToken,
                loanParamsLocal.collateralToken,
                loanLocal.principal,
                loanLocal.collateral
            );

        uint256 maxLiquidatable;
        uint256 maxSeizable;
        if (currentMargin <= loanParamsLocal.maintenanceMargin) {
            (maxLiquidatable, maxSeizable, ) = _getLiquidationAmounts(
                loanLocal.principal,
                loanLocal.collateral,
                currentMargin,
                loanParamsLocal.maintenanceMargin,
                collateralToLoanRate
            );
        } else if (unsafeOnly) {
            return loanData;
        }

        return
            LoanReturnData({
                loanId: loanId,
                loanToken: loanParamsLocal.loanToken,
                collateralToken: loanParamsLocal.collateralToken,
                principal: loanLocal.principal,
                collateral: loanLocal.collateral,
                interestOwedPerDay: loanInterestLocal.owedPerDay,
                interestDepositRemaining: loanLocal.endTimestamp >= block.timestamp
                    ? loanLocal
                        .endTimestamp
                        .sub(block.timestamp)
                        .mul(loanInterestLocal.owedPerDay)
                        .div(86400)
                    : 0,
                startRate: loanLocal.startRate,
                startMargin: loanLocal.startMargin,
                maintenanceMargin: loanParamsLocal.maintenanceMargin,
                currentMargin: currentMargin,
                maxLoanTerm: loanParamsLocal.maxLoanTerm,
                endTimestamp: loanLocal.endTimestamp,
                maxLiquidatable: maxLiquidatable,
                maxSeizable: maxSeizable
            });
    }
```
</details>

---    

> ### _getLoanV2

Internal function to get one loan data structure v2.
     *

```solidity
function _getLoanV2(bytes32 loanId, uint256 loanType, bool unsafeOnly) internal view
returns(loanDataV2 struct LoanMaintenance.LoanReturnDataV2)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | A unique ID representing the loan. | 
| loanType | uint256 | The type of loan.   loanType 0: all loans.   loanType 1: margin trade loans.   loanType 2: non-margin trade loans. | 
| unsafeOnly | bool | The safe filter (True/False).      * | 

**Returns**

loansData The data v2 structure w/ the loan information.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getLoanV2(
        bytes32 loanId,
        uint256 loanType,
        bool unsafeOnly
    ) internal view returns (LoanReturnDataV2 memory loanDataV2) {
        Loan memory loanLocal = loans[loanId];
        LoanParams memory loanParamsLocal = loanParams[loanLocal.loanParamsId];

        if (loanType != 0) {
            if (
                !((loanType == 1 && loanParamsLocal.maxLoanTerm != 0) ||
                    (loanType == 2 && loanParamsLocal.maxLoanTerm == 0))
            ) {
                return loanDataV2;
            }
        }

        LoanInterest memory loanInterestLocal = loanInterest[loanId];

        (uint256 currentMargin, uint256 collateralToLoanRate) =
            IPriceFeeds(priceFeeds).getCurrentMargin(
                loanParamsLocal.loanToken,
                loanParamsLocal.collateralToken,
                loanLocal.principal,
                loanLocal.collateral
            );

        uint256 maxLiquidatable;
        uint256 maxSeizable;
        if (currentMargin <= loanParamsLocal.maintenanceMargin) {
            (maxLiquidatable, maxSeizable, ) = _getLiquidationAmounts(
                loanLocal.principal,
                loanLocal.collateral,
                currentMargin,
                loanParamsLocal.maintenanceMargin,
                collateralToLoanRate
            );
        } else if (unsafeOnly) {
            return loanDataV2;
        }

        return
            LoanReturnDataV2({
                loanId: loanId,
                loanToken: loanParamsLocal.loanToken,
                collateralToken: loanParamsLocal.collateralToken,
                borrower: loanLocal.borrower,
                principal: loanLocal.principal,
                collateral: loanLocal.collateral,
                interestOwedPerDay: loanInterestLocal.owedPerDay,
                interestDepositRemaining: loanLocal.endTimestamp >= block.timestamp
                    ? loanLocal
                        .endTimestamp
                        .sub(block.timestamp)
                        .mul(loanInterestLocal.owedPerDay)
                        .div(86400)
                    : 0,
                startRate: loanLocal.startRate,
                startMargin: loanLocal.startMargin,
                maintenanceMargin: loanParamsLocal.maintenanceMargin,
                currentMargin: currentMargin,
                maxLoanTerm: loanParamsLocal.maxLoanTerm,
                endTimestamp: loanLocal.endTimestamp,
                maxLiquidatable: maxLiquidatable,
                maxSeizable: maxSeizable,
                creationTimestamp: loanLocal.startTimestamp
            });
    }
```
</details>

---    

> ### _doCollateralSwap

Internal function to collect interest from the collateral.
     *

```solidity
function _doCollateralSwap(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 depositAmount) internal nonpayable
returns(purchasedLoanToken uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanLocal | struct LoanStruct.Loan | The loan object. | 
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters. | 
| depositAmount | uint256 | The amount of underlying tokens provided on the loan. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _doCollateralSwap(
        Loan storage loanLocal,
        LoanParams memory loanParamsLocal,
        uint256 depositAmount
    ) internal returns (uint256 purchasedLoanToken) {
        /// Reverts in _loanSwap if amountNeeded can't be bought.
        (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed, ) =
            _loanSwap(
                loanLocal.id,
                loanParamsLocal.collateralToken,
                loanParamsLocal.loanToken,
                loanLocal.borrower,
                loanLocal.collateral, /// minSourceTokenAmount
                0, /// maxSourceTokenAmount (0 means minSourceTokenAmount)
                depositAmount, /// requiredDestTokenAmount (partial spend of loanLocal.collateral to fill this amount)
                true, /// bypassFee
                "" /// loanDataBytes
            );
        loanLocal.collateral = loanLocal.collateral.sub(sourceTokenAmountUsed);

        /// Ensure the loan is still healthy.
        (uint256 currentMargin, ) =
            IPriceFeeds(priceFeeds).getCurrentMargin(
                loanParamsLocal.loanToken,
                loanParamsLocal.collateralToken,
                loanLocal.principal,
                loanLocal.collateral
            );
        require(currentMargin > loanParamsLocal.maintenanceMargin, "unhealthy position");

        return destTokenAmountReceived;
    }
```
</details>

## Contracts

* [Address](Address.md)
* [Administered](Administered.md)
* [AdminRole](AdminRole.md)
* [AdvancedToken](AdvancedToken.md)
* [AdvancedTokenStorage](AdvancedTokenStorage.md)
* [Affiliates](Affiliates.md)
* [AffiliatesEvents](AffiliatesEvents.md)
* [ApprovalReceiver](ApprovalReceiver.md)
* [BProPriceFeed](BProPriceFeed.md)
* [Checkpoints](Checkpoints.md)
* [Constants](Constants.md)
* [Context](Context.md)
* [DevelopmentFund](DevelopmentFund.md)
* [DummyContract](DummyContract.md)
* [ECDSA](ECDSA.md)
* [EnumerableAddressSet](EnumerableAddressSet.md)
* [EnumerableBytes32Set](EnumerableBytes32Set.md)
* [EnumerableBytes4Set](EnumerableBytes4Set.md)
* [ERC20](ERC20.md)
* [ERC20Detailed](ERC20Detailed.md)
* [ErrorDecoder](ErrorDecoder.md)
* [Escrow](Escrow.md)
* [EscrowReward](EscrowReward.md)
* [FeedsLike](FeedsLike.md)
* [FeesEvents](FeesEvents.md)
* [FeeSharingLogic](FeeSharingLogic.md)
* [FeeSharingProxy](FeeSharingProxy.md)
* [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
* [FeesHelper](FeesHelper.md)
* [FourYearVesting](FourYearVesting.md)
* [FourYearVestingFactory](FourYearVestingFactory.md)
* [FourYearVestingLogic](FourYearVestingLogic.md)
* [FourYearVestingStorage](FourYearVestingStorage.md)
* [GenericTokenSender](GenericTokenSender.md)
* [GovernorAlpha](GovernorAlpha.md)
* [GovernorVault](GovernorVault.md)
* [IApproveAndCall](IApproveAndCall.md)
* [IChai](IChai.md)
* [IContractRegistry](IContractRegistry.md)
* [IConverterAMM](IConverterAMM.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IFeeSharingProxy](IFeeSharingProxy.md)
* [IFourYearVesting](IFourYearVesting.md)
* [IFourYearVestingFactory](IFourYearVestingFactory.md)
* [ILiquidityMining](ILiquidityMining.md)
* [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
* [ILoanPool](ILoanPool.md)
* [ILoanToken](ILoanToken.md)
* [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
* [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
* [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
* [ILoanTokenModules](ILoanTokenModules.md)
* [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
* [ILockedSOV](ILockedSOV.md)
* [IMoCState](IMoCState.md)
* [Initializable](Initializable.md)
* [InterestUser](InterestUser.md)
* [IPot](IPot.md)
* [IPriceFeeds](IPriceFeeds.md)
* [IPriceFeedsExt](IPriceFeedsExt.md)
* [IProtocol](IProtocol.md)
* [IRSKOracle](IRSKOracle.md)
* [ISovryn](ISovryn.md)
* [ISovrynSwapNetwork](ISovrynSwapNetwork.md)
* [IStaking](IStaking.md)
* [ISwapsImpl](ISwapsImpl.md)
* [ITeamVesting](ITeamVesting.md)
* [ITimelock](ITimelock.md)
* [IV1PoolOracle](IV1PoolOracle.md)
* [IVesting](IVesting.md)
* [IVestingFactory](IVestingFactory.md)
* [IVestingRegistry](IVestingRegistry.md)
* [IWrbtc](IWrbtc.md)
* [IWrbtcERC20](IWrbtcERC20.md)
* [LenderInterestStruct](LenderInterestStruct.md)
* [LiquidationHelper](LiquidationHelper.md)
* [LiquidityMining](LiquidityMining.md)
* [LiquidityMiningConfigToken](LiquidityMiningConfigToken.md)
* [LiquidityMiningProxy](LiquidityMiningProxy.md)
* [LiquidityMiningStorage](LiquidityMiningStorage.md)
* [LoanClosingsEvents](LoanClosingsEvents.md)
* [LoanClosingsLiquidation](LoanClosingsLiquidation.md)
* [LoanClosingsRollover](LoanClosingsRollover.md)
* [LoanClosingsShared](LoanClosingsShared.md)
* [LoanClosingsWith](LoanClosingsWith.md)
* [LoanInterestStruct](LoanInterestStruct.md)
* [LoanMaintenance](LoanMaintenance.md)
* [LoanMaintenanceEvents](LoanMaintenanceEvents.md)
* [LoanOpenings](LoanOpenings.md)
* [LoanOpeningsEvents](LoanOpeningsEvents.md)
* [LoanParamsStruct](LoanParamsStruct.md)
* [LoanSettings](LoanSettings.md)
* [LoanSettingsEvents](LoanSettingsEvents.md)
* [LoanStruct](LoanStruct.md)
* [LoanToken](LoanToken.md)
* [LoanTokenBase](LoanTokenBase.md)
* [LoanTokenLogicBeacon](LoanTokenLogicBeacon.md)
* [LoanTokenLogicLM](LoanTokenLogicLM.md)
* [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
* [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
* [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
* [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
* [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
* [LockedSOV](LockedSOV.md)
* [Medianizer](Medianizer.md)
* [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
* [ModulesCommonEvents](ModulesCommonEvents.md)
* [MultiSigKeyHolders](MultiSigKeyHolders.md)
* [MultiSigWallet](MultiSigWallet.md)
* [Objects](Objects.md)
* [OrderStruct](OrderStruct.md)
* [OrigingVestingCreator](OrigingVestingCreator.md)
* [OriginInvestorsClaim](OriginInvestorsClaim.md)
* [Ownable](Ownable.md)
* [Pausable](Pausable.md)
* [PausableOz](PausableOz.md)
* [PreviousLoanToken](PreviousLoanToken.md)
* [PreviousLoanTokenSettingsLowerAdmin](PreviousLoanTokenSettingsLowerAdmin.md)
* [PriceFeedRSKOracle](PriceFeedRSKOracle.md)
* [PriceFeeds](PriceFeeds.md)
* [PriceFeedsLocal](PriceFeedsLocal.md)
* [PriceFeedsMoC](PriceFeedsMoC.md)
* [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
* [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
* [ProtocolLike](ProtocolLike.md)
* [ProtocolSettings](ProtocolSettings.md)
* [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
* [ProtocolSettingsLike](ProtocolSettingsLike.md)
* [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
* [ProtocolTokenUser](ProtocolTokenUser.md)
* [Proxy](Proxy.md)
* [ReentrancyGuard](ReentrancyGuard.md)
* [RewardHelper](RewardHelper.md)
* [RSKAddrValidator](RSKAddrValidator.md)
* [SafeERC20](SafeERC20.md)
* [SafeMath](SafeMath.md)
* [SafeMath96](SafeMath96.md)
* [setGet](setGet.md)
* [SignedSafeMath](SignedSafeMath.md)
* [SOV](SOV.md)
* [sovrynProtocol](sovrynProtocol.md)
* [Staking](Staking.md)
* [StakingInterface](StakingInterface.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingStorage](StakingStorage.md)
* [State](State.md)
* [SVR](SVR.md)
* [SwapsEvents](SwapsEvents.md)
* [SwapsExternal](SwapsExternal.md)
* [SwapsImplLocal](SwapsImplLocal.md)
* [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
* [SwapsUser](SwapsUser.md)
* [TeamVesting](TeamVesting.md)
* [Timelock](Timelock.md)
* [TimelockHarness](TimelockHarness.md)
* [TimelockInterface](TimelockInterface.md)
* [TokenSender](TokenSender.md)
* [UpgradableProxy](UpgradableProxy.md)
* [USDTPriceFeed](USDTPriceFeed.md)
* [VaultController](VaultController.md)
* [Vesting](Vesting.md)
* [VestingCreator](VestingCreator.md)
* [VestingFactory](VestingFactory.md)
* [VestingLogic](VestingLogic.md)
* [VestingRegistry](VestingRegistry.md)
* [VestingRegistry2](VestingRegistry2.md)
* [VestingRegistry3](VestingRegistry3.md)
* [VestingRegistryLogic](VestingRegistryLogic.md)
* [VestingRegistryProxy](VestingRegistryProxy.md)
* [VestingRegistryStorage](VestingRegistryStorage.md)
* [VestingStorage](VestingStorage.md)
* [WeightedStaking](WeightedStaking.md)
* [WRBTC](WRBTC.md)
