# LoanClosingsShared contract. (LoanClosingsShared.sol)

View Source: [contracts/modules/LoanClosingsShared.sol](../contracts/modules/LoanClosingsShared.sol)

**↗ Extends: [LoanClosingsEvents](LoanClosingsEvents.md), [VaultController](VaultController.md), [InterestUser](InterestUser.md), [SwapsUser](SwapsUser.md), [RewardHelper](RewardHelper.md), [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)**
**↘ Derived Contracts: [LoanClosingsLiquidation](LoanClosingsLiquidation.md), [LoanClosingsRollover](LoanClosingsRollover.md), [LoanClosingsWith](LoanClosingsWith.md)**

**LoanClosingsShared**

This contract should only contains the internal function that is being used / utilized by
  LoanClosingsLiquidation, LoanClosingsRollover & LoanClosingsWith contract
 *

**Enums**
### CloseTypes

```js
enum CloseTypes {
 Deposit,
 Swap,
 Liquidation
}
```

## Contract Members
**Constants & Variables**

```js
//internal members
uint256 internal constant MONTH;

//public members
uint256 public constant paySwapExcessToBorrowerThreshold;
uint256 public constant TINY_AMOUNT;

```

## Functions

- [_settleInterestToPrincipal(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 loanCloseAmount, address receiver)](#_settleinteresttoprincipal)
- [_returnPrincipalWithDeposit(address loanToken, address receiver, uint256 principalNeeded)](#_returnprincipalwithdeposit)
- [worthTheTransfer(address asset, uint256 amount)](#worththetransfer)
- [_doCollateralSwap(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 swapAmount, uint256 principalNeeded, bool returnTokenIsCollateral, bytes loanDataBytes)](#_docollateralswap)
- [_withdrawAsset(address assetToken, address receiver, uint256 assetAmount)](#_withdrawasset)
- [_closeLoan(struct LoanStruct.Loan loanLocal, uint256 loanCloseAmount)](#_closeloan)
- [_settleInterest(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 closePrincipal)](#_settleinterest)
- [_checkAuthorized(bytes32 loanId)](#_checkauthorized)
- [_closeWithSwap(bytes32 loanId, address receiver, uint256 swapAmount, bool returnTokenIsCollateral, bytes loanDataBytes)](#_closewithswap)
- [_finalizeClose(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 loanCloseAmount, uint256 collateralCloseAmount, uint256 collateralToLoanSwapRate, enum LoanClosingsShared.CloseTypes closeType)](#_finalizeclose)
- [_coverPrincipalWithSwap(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 swapAmount, uint256 principalNeeded, bool returnTokenIsCollateral, bytes loanDataBytes)](#_coverprincipalwithswap)
- [_emitClosingEvents(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 loanCloseAmount, uint256 collateralCloseAmount, uint256 collateralToLoanRate, uint256 collateralToLoanSwapRate, uint256 currentMargin, enum LoanClosingsShared.CloseTypes closeType)](#_emitclosingevents)
- [_getAmountInRbtc(address asset, uint256 amount)](#_getamountinrbtc)
- [_checkLoan(bytes32 loanId)](#_checkloan)

---    

> ### _settleInterestToPrincipal

computes the interest which needs to be refunded to the borrower based on the amount he's closing and either
subtracts it from the amount which still needs to be paid back (in case outstanding amount > interest) or withdraws the
excess to the borrower (in case interest > outstanding).

```solidity
function _settleInterestToPrincipal(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 loanCloseAmount, address receiver) internal nonpayable
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanLocal | struct LoanStruct.Loan | the loan | 
| loanParamsLocal | struct LoanParamsStruct.LoanParams | the loan params | 
| loanCloseAmount | uint256 | the amount to be closed (base for the computation) | 
| receiver | address | the address of the receiver (usually the borrower) | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _settleInterestToPrincipal(
        Loan memory loanLocal,
        LoanParams memory loanParamsLocal,
        uint256 loanCloseAmount,
        address receiver
    ) internal returns (uint256) {
        uint256 loanCloseAmountLessInterest = loanCloseAmount;

        //compute the interest which neeeds to be refunded to the borrower (because full interest is paid on loan )
        uint256 interestRefundToBorrower =
            _settleInterest(loanParamsLocal, loanLocal, loanCloseAmountLessInterest);

        uint256 interestAppliedToPrincipal;
        //if the outstanding loan is bigger than the interest to be refunded, reduce the amount to be paid back / closed by the interest
        if (loanCloseAmountLessInterest >= interestRefundToBorrower) {
            // apply all of borrower interest refund torwards principal
            interestAppliedToPrincipal = interestRefundToBorrower;

            // principal needed is reduced by this amount
            loanCloseAmountLessInterest -= interestRefundToBorrower;

            // no interest refund remaining
            interestRefundToBorrower = 0;
        } else {
            //if the interest refund is bigger than the outstanding loan, the user needs to get back the interest
            // principal fully covered by excess interest
            interestAppliedToPrincipal = loanCloseAmountLessInterest;

            // amount refunded is reduced by this amount
            interestRefundToBorrower -= loanCloseAmountLessInterest;

            // principal fully covered by excess interest
            loanCloseAmountLessInterest = 0;

            if (interestRefundToBorrower != 0) {
                // refund overage
                _withdrawAsset(loanParamsLocal.loanToken, receiver, interestRefundToBorrower);
            }
        }

        //pay the interest to the lender
        //note: this is a waste of gas, because the loanCloseAmountLessInterest is withdrawn to the lender, too. It could be done at once.
        if (interestAppliedToPrincipal != 0) {
            // The lender always gets back an ERC20 (even wrbtc), so we call withdraw directly rather than
            // use the _withdrawAsset helper function
            vaultWithdraw(loanParamsLocal.loanToken, loanLocal.lender, interestAppliedToPrincipal);
        }

        return loanCloseAmountLessInterest;
    }
```
</details>

---    

> ### _returnPrincipalWithDeposit

```solidity
function _returnPrincipalWithDeposit(address loanToken, address receiver, uint256 principalNeeded) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address |  | 
| receiver | address |  | 
| principalNeeded | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _returnPrincipalWithDeposit(
        address loanToken,
        address receiver,
        uint256 principalNeeded
    ) internal {
        if (principalNeeded != 0) {
            if (msg.value == 0) {
                vaultTransfer(loanToken, msg.sender, receiver, principalNeeded);
            } else {
                require(loanToken == address(wrbtcToken), "wrong asset sent");
                require(msg.value >= principalNeeded, "not enough ether");
                wrbtcToken.deposit.value(principalNeeded)();
                if (receiver != address(this)) {
                    vaultTransfer(loanToken, address(this), receiver, principalNeeded);
                }
                if (msg.value > principalNeeded) {
                    // refund overage
                    Address.sendValue(msg.sender, msg.value - principalNeeded);
                }
            }
        } else {
            require(msg.value == 0, "wrong asset sent");
        }
    }
```
</details>

---    

> ### worthTheTransfer

checks if the amount of the asset to be transfered is worth the transfer fee

```solidity
function worthTheTransfer(address asset, uint256 amount) internal nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| asset | address | the asset to be transfered | 
| amount | uint256 | the amount to be transfered | 

**Returns**

True if the amount is bigger than the threshold

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function worthTheTransfer(address asset, uint256 amount) internal returns (bool) {
        uint256 amountInRbtc = _getAmountInRbtc(asset, amount);
        emit swapExcess(
            amountInRbtc > paySwapExcessToBorrowerThreshold,
            amount,
            amountInRbtc,
            paySwapExcessToBorrowerThreshold
        );
        return amountInRbtc > paySwapExcessToBorrowerThreshold;
    }
```
</details>

---    

> ### _doCollateralSwap

```solidity
function _doCollateralSwap(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 swapAmount, uint256 principalNeeded, bool returnTokenIsCollateral, bytes loanDataBytes) internal nonpayable
returns(destTokenAmountReceived uint256, sourceTokenAmountUsed uint256, collateralToLoanSwapRate uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanLocal | struct LoanStruct.Loan | the loan object | 
| loanParamsLocal | struct LoanParamsStruct.LoanParams | the loan parameters | 
| swapAmount | uint256 | the amount to be swapped | 
| principalNeeded | uint256 | the required destination token amount | 
| returnTokenIsCollateral | bool | if true -> required destination token amount will be passed on, else not          note: quite dirty. should be refactored. | 
| loanDataBytes | bytes | additional loan data (not in use for token swaps) | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _doCollateralSwap(
        Loan memory loanLocal,
        LoanParams memory loanParamsLocal,
        uint256 swapAmount,
        uint256 principalNeeded,
        bool returnTokenIsCollateral,
        bytes memory loanDataBytes
    )
        internal
        returns (
            uint256 destTokenAmountReceived,
            uint256 sourceTokenAmountUsed,
            uint256 collateralToLoanSwapRate
        )
    {
        (destTokenAmountReceived, sourceTokenAmountUsed, collateralToLoanSwapRate) = _loanSwap(
            loanLocal.id,
            loanParamsLocal.collateralToken,
            loanParamsLocal.loanToken,
            loanLocal.borrower,
            swapAmount, // minSourceTokenAmount
            loanLocal.collateral, // maxSourceTokenAmount
            returnTokenIsCollateral
                ? principalNeeded // requiredDestTokenAmount
                : 0,
            false, // bypassFee
            loanDataBytes
        );
        require(destTokenAmountReceived >= principalNeeded, "insufficient dest amount");
        require(sourceTokenAmountUsed <= loanLocal.collateral, "excessive source amount");
    }
```
</details>

---    

> ### _withdrawAsset

Withdraw asset to receiver.
     *

```solidity
function _withdrawAsset(address assetToken, address receiver, uint256 assetAmount) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| assetToken | address | The loan token. | 
| receiver | address | The address of the receiver. | 
| assetAmount | uint256 | The loan token amount. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _withdrawAsset(
        address assetToken,
        address receiver,
        uint256 assetAmount
    ) internal {
        if (assetAmount != 0) {
            if (assetToken == address(wrbtcToken)) {
                vaultEtherWithdraw(receiver, assetAmount);
            } else {
                vaultWithdraw(assetToken, receiver, assetAmount);
            }
        }
    }
```
</details>

---    

> ### _closeLoan

Internal function to close a loan.
     *

```solidity
function _closeLoan(struct LoanStruct.Loan loanLocal, uint256 loanCloseAmount) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanLocal | struct LoanStruct.Loan | The loan object. | 
| loanCloseAmount | uint256 | The amount to close: principal or lower.      * | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _closeLoan(Loan storage loanLocal, uint256 loanCloseAmount) internal {
        require(loanCloseAmount != 0, "nothing to close");

        if (loanCloseAmount == loanLocal.principal) {
            loanLocal.principal = 0;
            loanLocal.active = false;
            loanLocal.endTimestamp = block.timestamp;
            loanLocal.pendingTradesId = 0;
            activeLoansSet.removeBytes32(loanLocal.id);
            lenderLoanSets[loanLocal.lender].removeBytes32(loanLocal.id);
            borrowerLoanSets[loanLocal.borrower].removeBytes32(loanLocal.id);
        } else {
            loanLocal.principal = loanLocal.principal.sub(loanCloseAmount);
        }
    }
```
</details>

---    

> ### _settleInterest

```solidity
function _settleInterest(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 closePrincipal) internal nonpayable
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams |  | 
| loanLocal | struct LoanStruct.Loan |  | 
| closePrincipal | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _settleInterest(
        LoanParams memory loanParamsLocal,
        Loan memory loanLocal,
        uint256 closePrincipal
    ) internal returns (uint256) {
        // pay outstanding interest to lender
        _payInterest(loanLocal.lender, loanParamsLocal.loanToken);

        LoanInterest storage loanInterestLocal = loanInterest[loanLocal.id];
        LenderInterest storage lenderInterestLocal =
            lenderInterest[loanLocal.lender][loanParamsLocal.loanToken];

        uint256 interestTime = block.timestamp;
        if (interestTime > loanLocal.endTimestamp) {
            interestTime = loanLocal.endTimestamp;
        }

        _settleFeeRewardForInterestExpense(
            loanInterestLocal,
            loanLocal.id,
            loanParamsLocal.loanToken, /// fee token
            loanParamsLocal.collateralToken, /// pairToken (used to check if there is any special rebates or not) -- to pay fee reward
            loanLocal.borrower,
            interestTime
        );

        uint256 owedPerDayRefund;
        if (closePrincipal < loanLocal.principal) {
            owedPerDayRefund = loanInterestLocal.owedPerDay.mul(closePrincipal).div(
                loanLocal.principal
            );
        } else {
            owedPerDayRefund = loanInterestLocal.owedPerDay;
        }

        // update stored owedPerDay
        loanInterestLocal.owedPerDay = loanInterestLocal.owedPerDay.sub(owedPerDayRefund);
        lenderInterestLocal.owedPerDay = lenderInterestLocal.owedPerDay.sub(owedPerDayRefund);

        // update borrower interest
        uint256 interestRefundToBorrower = loanLocal.endTimestamp.sub(interestTime);
        interestRefundToBorrower = interestRefundToBorrower.mul(owedPerDayRefund);
        interestRefundToBorrower = interestRefundToBorrower.div(1 days);

        if (closePrincipal < loanLocal.principal) {
            loanInterestLocal.depositTotal = loanInterestLocal.depositTotal.sub(
                interestRefundToBorrower
            );
        } else {
            loanInterestLocal.depositTotal = 0;
        }

        // update remaining lender interest values
        lenderInterestLocal.principalTotal = lenderInterestLocal.principalTotal.sub(
            closePrincipal
        );

        uint256 owedTotal = lenderInterestLocal.owedTotal;
        lenderInterestLocal.owedTotal = owedTotal > interestRefundToBorrower
            ? owedTotal - interestRefundToBorrower
            : 0;

        return interestRefundToBorrower;
    }
```
</details>

---    

> ### _checkAuthorized

Check sender is borrower or delegatee and loan id exists.
     *

```solidity
function _checkAuthorized(bytes32 loanId) internal view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | byte32 of the loan id. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _checkAuthorized(bytes32 loanId) internal view {
        Loan storage loanLocal = loans[loanId];
        require(
            msg.sender == loanLocal.borrower || delegatedManagers[loanLocal.id][msg.sender],
            "unauthorized"
        );
    }
```
</details>

---    

> ### _closeWithSwap

Internal function for closing a position by swapping the
collateral back to loan tokens, paying the lender and withdrawing
the remainder.
     *

```solidity
function _closeWithSwap(bytes32 loanId, address receiver, uint256 swapAmount, bool returnTokenIsCollateral, bytes loanDataBytes) internal nonpayable
returns(loanCloseAmount uint256, withdrawAmount uint256, withdrawToken address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The id of the loan. | 
| receiver | address | The receiver of the remainder (unused collatral + profit). | 
| swapAmount | uint256 | Defines how much of the position should be closed and   is denominated in collateral tokens.     If swapAmount >= collateral, the complete position will be closed.     Else if returnTokenIsCollateral, (swapAmount/collateral) * principal will be swapped (partial closure).     Else coveredPrincipal | 
| returnTokenIsCollateral | bool | Defines if the remainder should be paid   out in collateral tokens or underlying loan tokens.      * | 
| loanDataBytes | bytes |  | 

**Returns**

loanCloseAmount The amount of the collateral token of the loan.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _closeWithSwap(
        bytes32 loanId,
        address receiver,
        uint256 swapAmount,
        bool returnTokenIsCollateral,
        bytes memory loanDataBytes
    )
        internal
        returns (
            uint256 loanCloseAmount,
            uint256 withdrawAmount,
            address withdrawToken
        )
    {
        require(swapAmount != 0, "swapAmount == 0");

        (Loan storage loanLocal, LoanParams storage loanParamsLocal) = _checkLoan(loanId);

        /// Can't swap more than collateral.
        swapAmount = swapAmount > loanLocal.collateral ? loanLocal.collateral : swapAmount;

        //close whole loan if tiny position will remain
        if (loanLocal.collateral - swapAmount > 0) {
            if (
                _getAmountInRbtc(
                    loanParamsLocal.collateralToken,
                    loanLocal.collateral - swapAmount
                ) <= TINY_AMOUNT
            ) {
                swapAmount = loanLocal.collateral;
            }
        }

        uint256 loanCloseAmountLessInterest;
        if (swapAmount == loanLocal.collateral || returnTokenIsCollateral) {
            /// loanCloseAmountLessInterest will be passed as required amount amount of destination tokens.
            /// this means, the actual swapAmount passed to the swap contract does not matter at all.
            /// the source token amount will be computed depending on the required amount amount of destination tokens.
            loanCloseAmount = swapAmount == loanLocal.collateral
                ? loanLocal.principal
                : loanLocal.principal.mul(swapAmount).div(loanLocal.collateral);
            require(loanCloseAmount != 0, "loanCloseAmount == 0");

            /// Computes the interest refund for the borrower and sends it to the lender to cover part of the principal.
            loanCloseAmountLessInterest = _settleInterestToPrincipal(
                loanLocal,
                loanParamsLocal,
                loanCloseAmount,
                receiver
            );
        } else {
            /// loanCloseAmount is calculated after swap; for this case we want to swap the entire source amount
            /// and determine the loanCloseAmount and withdraw amount based on that.
            loanCloseAmountLessInterest = 0;
        }

        uint256 coveredPrincipal;
        uint256 usedCollateral;
        /// swapAmount repurposed for collateralToLoanSwapRate to avoid stack too deep error.
        (coveredPrincipal, usedCollateral, withdrawAmount, swapAmount) = _coverPrincipalWithSwap(
            loanLocal,
            loanParamsLocal,
            swapAmount, /// The amount of source tokens to swap (only matters if !returnTokenIsCollateral or loanCloseAmountLessInterest = 0)
            loanCloseAmountLessInterest, /// This is the amount of destination tokens we want to receive (only matters if returnTokenIsCollateral)
            returnTokenIsCollateral,
            loanDataBytes
        );

        if (loanCloseAmountLessInterest == 0) {
            /// Condition prior to swap: swapAmount != loanLocal.collateral && !returnTokenIsCollateral

            /// Amounts that is closed.
            loanCloseAmount = coveredPrincipal;
            if (coveredPrincipal != loanLocal.principal) {
                loanCloseAmount = loanCloseAmount.mul(usedCollateral).div(loanLocal.collateral);
            }
            require(loanCloseAmount != 0, "loanCloseAmount == 0");

            /// Amount that is returned to the lender.
            loanCloseAmountLessInterest = _settleInterestToPrincipal(
                loanLocal,
                loanParamsLocal,
                loanCloseAmount,
                receiver
            );

            /// Remaining amount withdrawn to the receiver.
            withdrawAmount = withdrawAmount.add(coveredPrincipal).sub(loanCloseAmountLessInterest);
        } else {
            /// Pay back the amount which was covered by the swap.
            loanCloseAmountLessInterest = coveredPrincipal;
        }

        require(loanCloseAmountLessInterest != 0, "closeAmount is 0 after swap");

        /// Reduce the collateral by the amount which was swapped for the closure.
        if (usedCollateral != 0) {
            loanLocal.collateral = loanLocal.collateral.sub(usedCollateral);
        }

        /// Repays principal to lender.
        /// The lender always gets back an ERC20 (even wrbtc), so we call
        /// withdraw directly rather than use the _withdrawAsset helper function.
        vaultWithdraw(loanParamsLocal.loanToken, loanLocal.lender, loanCloseAmountLessInterest);

        withdrawToken = returnTokenIsCollateral
            ? loanParamsLocal.collateralToken
            : loanParamsLocal.loanToken;

        if (withdrawAmount != 0) {
            _withdrawAsset(withdrawToken, receiver, withdrawAmount);
        }

        _finalizeClose(
            loanLocal,
            loanParamsLocal,
            loanCloseAmount,
            usedCollateral,
            swapAmount, /// collateralToLoanSwapRate
            CloseTypes.Swap
        );
    }
```
</details>

---    

> ### _finalizeClose

Close a loan.
     *

```solidity
function _finalizeClose(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 loanCloseAmount, uint256 collateralCloseAmount, uint256 collateralToLoanSwapRate, enum LoanClosingsShared.CloseTypes closeType) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanLocal | struct LoanStruct.Loan | The loan object. | 
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan params. | 
| loanCloseAmount | uint256 | The amount to close: principal or lower. | 
| collateralCloseAmount | uint256 | The amount of collateral to close. | 
| collateralToLoanSwapRate | uint256 | The price rate collateral/loan token. | 
| closeType | enum LoanClosingsShared.CloseTypes | The type of loan close. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _finalizeClose(
        Loan storage loanLocal,
        LoanParams storage loanParamsLocal,
        uint256 loanCloseAmount,
        uint256 collateralCloseAmount,
        uint256 collateralToLoanSwapRate,
        CloseTypes closeType
    ) internal {
        _closeLoan(loanLocal, loanCloseAmount);

        address _priceFeeds = priceFeeds;
        uint256 currentMargin;
        uint256 collateralToLoanRate;

        /// This is still called even with full loan close to return collateralToLoanRate
        (bool success, bytes memory data) =
            _priceFeeds.staticcall(
                abi.encodeWithSelector(
                    IPriceFeeds(_priceFeeds).getCurrentMargin.selector,
                    loanParamsLocal.loanToken,
                    loanParamsLocal.collateralToken,
                    loanLocal.principal,
                    loanLocal.collateral
                )
            );
        assembly {
            if eq(success, 1) {
                currentMargin := mload(add(data, 32))
                collateralToLoanRate := mload(add(data, 64))
            }
        }
        /// Note: We can safely skip the margin check if closing
        /// via closeWithDeposit or if closing the loan in full by any method.
        require(
            closeType == CloseTypes.Deposit ||
                loanLocal.principal == 0 || /// loan fully closed
                currentMargin > loanParamsLocal.maintenanceMargin,
            "unhealthy position"
        );

        _emitClosingEvents(
            loanParamsLocal,
            loanLocal,
            loanCloseAmount,
            collateralCloseAmount,
            collateralToLoanRate,
            collateralToLoanSwapRate,
            currentMargin,
            closeType
        );
    }
```
</details>

---    

> ### _coverPrincipalWithSwap

Swaps a share of a loan's collateral or the complete collateral
  in order to cover the principle.
     *

```solidity
function _coverPrincipalWithSwap(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 swapAmount, uint256 principalNeeded, bool returnTokenIsCollateral, bytes loanDataBytes) internal nonpayable
returns(coveredPrincipal uint256, usedCollateral uint256, withdrawAmount uint256, collateralToLoanSwapRate uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanLocal | struct LoanStruct.Loan | the loan | 
| loanParamsLocal | struct LoanParamsStruct.LoanParams | the loan parameters | 
| swapAmount | uint256 | in case principalNeeded == 0 or !returnTokenIsCollateral, this is the amount which is going to be swapped.  Else, swapAmount doesn't matter, because the amount of source tokens needed for the swap is estimated by the connector. | 
| principalNeeded | uint256 | the required amount of destination tokens in order to cover the principle (only used if returnTokenIsCollateral) | 
| returnTokenIsCollateral | bool | tells if the user wants to withdraw his remaining collateral + profit in collateral tokens | 
| loanDataBytes | bytes |  | 

**Returns**

coveredPrincipal The amount of principal that is covered.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _coverPrincipalWithSwap(
        Loan memory loanLocal,
        LoanParams memory loanParamsLocal,
        uint256 swapAmount,
        uint256 principalNeeded,
        bool returnTokenIsCollateral,
        bytes memory loanDataBytes
    )
        internal
        returns (
            uint256 coveredPrincipal,
            uint256 usedCollateral,
            uint256 withdrawAmount,
            uint256 collateralToLoanSwapRate
        )
    {
        uint256 destTokenAmountReceived;
        uint256 sourceTokenAmountUsed;
        (
            destTokenAmountReceived,
            sourceTokenAmountUsed,
            collateralToLoanSwapRate
        ) = _doCollateralSwap(
            loanLocal,
            loanParamsLocal,
            swapAmount,
            principalNeeded,
            returnTokenIsCollateral,
            loanDataBytes
        );

        if (returnTokenIsCollateral) {
            coveredPrincipal = principalNeeded;

            /// Better fill than expected.
            if (destTokenAmountReceived > coveredPrincipal) {
                /// Send excess to borrower if the amount is big enough to be
                /// worth the gas fees.
                if (
                    worthTheTransfer(
                        loanParamsLocal.loanToken,
                        destTokenAmountReceived - coveredPrincipal
                    )
                ) {
                    _withdrawAsset(
                        loanParamsLocal.loanToken,
                        loanLocal.borrower,
                        destTokenAmountReceived - coveredPrincipal
                    );
                }
                /// Else, give the excess to the lender (if it goes to the
                /// borrower, they're very confused. causes more trouble than it's worth)
                else {
                    coveredPrincipal = destTokenAmountReceived;
                }
            }
            withdrawAmount = swapAmount > sourceTokenAmountUsed
                ? swapAmount - sourceTokenAmountUsed
                : 0;
        } else {
            require(sourceTokenAmountUsed == swapAmount, "swap error");

            if (swapAmount == loanLocal.collateral) {
                /// sourceTokenAmountUsed == swapAmount == loanLocal.collateral

                coveredPrincipal = principalNeeded;
                withdrawAmount = destTokenAmountReceived - principalNeeded;
            } else {
                /// sourceTokenAmountUsed == swapAmount < loanLocal.collateral

                if (destTokenAmountReceived >= loanLocal.principal) {
                    /// Edge case where swap covers full principal.

                    coveredPrincipal = loanLocal.principal;
                    withdrawAmount = destTokenAmountReceived - loanLocal.principal;

                    /// Excess collateral refunds to the borrower.
                    _withdrawAsset(
                        loanParamsLocal.collateralToken,
                        loanLocal.borrower,
                        loanLocal.collateral - sourceTokenAmountUsed
                    );
                    sourceTokenAmountUsed = loanLocal.collateral;
                } else {
                    coveredPrincipal = destTokenAmountReceived;
                    withdrawAmount = 0;
                }
            }
        }

        usedCollateral = sourceTokenAmountUsed > swapAmount ? sourceTokenAmountUsed : swapAmount;
    }
```
</details>

---    

> ### _emitClosingEvents

```solidity
function _emitClosingEvents(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 loanCloseAmount, uint256 collateralCloseAmount, uint256 collateralToLoanRate, uint256 collateralToLoanSwapRate, uint256 currentMargin, enum LoanClosingsShared.CloseTypes closeType) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams |  | 
| loanLocal | struct LoanStruct.Loan |  | 
| loanCloseAmount | uint256 |  | 
| collateralCloseAmount | uint256 |  | 
| collateralToLoanRate | uint256 |  | 
| collateralToLoanSwapRate | uint256 |  | 
| currentMargin | uint256 |  | 
| closeType | enum LoanClosingsShared.CloseTypes |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _emitClosingEvents(
        LoanParams memory loanParamsLocal,
        Loan memory loanLocal,
        uint256 loanCloseAmount,
        uint256 collateralCloseAmount,
        uint256 collateralToLoanRate,
        uint256 collateralToLoanSwapRate,
        uint256 currentMargin,
        CloseTypes closeType
    ) internal {
        if (closeType == CloseTypes.Deposit) {
            emit CloseWithDeposit(
                loanLocal.borrower, /// user (borrower)
                loanLocal.lender, /// lender
                loanLocal.id, /// loanId
                msg.sender, /// closer
                loanParamsLocal.loanToken, /// loanToken
                loanParamsLocal.collateralToken, /// collateralToken
                loanCloseAmount, /// loanCloseAmount
                collateralCloseAmount, /// collateralCloseAmount
                collateralToLoanRate, /// collateralToLoanRate
                currentMargin /// currentMargin
            );
        } else if (closeType == CloseTypes.Swap) {
            /// exitPrice = 1 / collateralToLoanSwapRate
            if (collateralToLoanSwapRate != 0) {
                collateralToLoanSwapRate = SafeMath.div(10**36, collateralToLoanSwapRate);
            }

            /// currentLeverage = 100 / currentMargin
            if (currentMargin != 0) {
                currentMargin = SafeMath.div(10**38, currentMargin);
            }

            emit CloseWithSwap(
                loanLocal.borrower, /// user (trader)
                loanLocal.lender, /// lender
                loanLocal.id, /// loanId
                loanParamsLocal.collateralToken, /// collateralToken
                loanParamsLocal.loanToken, /// loanToken
                msg.sender, /// closer
                collateralCloseAmount, /// positionCloseSize
                loanCloseAmount, /// loanCloseAmount
                collateralToLoanSwapRate, /// exitPrice (1 / collateralToLoanSwapRate)
                currentMargin /// currentLeverage
            );
        } else if (closeType == CloseTypes.Liquidation) {
            emit Liquidate(
                loanLocal.borrower, // user (borrower)
                msg.sender, // liquidator
                loanLocal.id, // loanId
                loanLocal.lender, // lender
                loanParamsLocal.loanToken, // loanToken
                loanParamsLocal.collateralToken, // collateralToken
                loanCloseAmount, // loanCloseAmount
                collateralCloseAmount, // collateralCloseAmount
                collateralToLoanRate, // collateralToLoanRate
                currentMargin // currentMargin
            );
        }
    }
```
</details>

---    

> ### _getAmountInRbtc

returns amount of the asset converted to RBTC

```solidity
function _getAmountInRbtc(address asset, uint256 amount) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| asset | address | the asset to be transferred | 
| amount | uint256 | the amount to be transferred | 

**Returns**

amount in RBTC

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getAmountInRbtc(address asset, uint256 amount) internal view returns (uint256) {
        (uint256 rbtcRate, uint256 rbtcPrecision) =
            IPriceFeeds(priceFeeds).queryRate(asset, address(wrbtcToken));
        return amount.mul(rbtcRate).div(rbtcPrecision);
    }
```
</details>

---    

> ### _checkLoan

private function which check the loanLocal & loanParamsLocal does exist
     *

```solidity
function _checkLoan(bytes32 loanId) internal view
returns(struct LoanStruct.Loan, struct LoanParamsStruct.LoanParams)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | bytes32 of loanId      * | 

**Returns**

Loan storage

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _checkLoan(bytes32 loanId) internal view returns (Loan storage, LoanParams storage) {
        Loan storage loanLocal = loans[loanId];
        LoanParams storage loanParamsLocal = loanParams[loanLocal.loanParamsId];

        require(loanLocal.active, "loan is closed");
        require(loanParamsLocal.id != 0, "loanParams not exists");

        return (loanLocal, loanParamsLocal);
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
