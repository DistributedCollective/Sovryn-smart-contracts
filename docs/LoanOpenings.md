# Loan Openings contract.
 * (LoanOpenings.sol)

View Source: [contracts/modules/LoanOpenings.sol](../contracts/modules/LoanOpenings.sol)

**↗ Extends: [LoanOpeningsEvents](LoanOpeningsEvents.md), [VaultController](VaultController.md), [InterestUser](InterestUser.md), [SwapsUser](SwapsUser.md), [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)**

**LoanOpenings**

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
 * This contract contains functions to borrow and trade.

## Functions

- [constructor()](#constructor)
- [constructor()](#constructor)
- [initialize(address target)](#initialize)
- [borrowOrTradeFromPool(bytes32 loanParamsId, bytes32 loanId, bool isTorqueLoan, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues, bytes loanDataBytes)](#borrowortradefrompool)
- [setDelegatedManager(bytes32 loanId, address delegated, bool toggle)](#setdelegatedmanager)
- [getEstimatedMarginExposure(address loanToken, address collateralToken, uint256 loanTokenSent, uint256 collateralTokenSent, uint256 interestRate, uint256 newPrincipal)](#getestimatedmarginexposure)
- [getRequiredCollateral(address loanToken, address collateralToken, uint256 newPrincipal, uint256 marginAmount, bool isTorqueLoan)](#getrequiredcollateral)
- [getBorrowAmount(address loanToken, address collateralToken, uint256 collateralTokenAmount, uint256 marginAmount, bool isTorqueLoan)](#getborrowamount)
- [_borrowOrTrade(struct LoanParamsStruct.LoanParams loanParamsLocal, bytes32 loanId, bool isTorqueLoan, uint256 collateralAmountRequired, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues, bytes loanDataBytes)](#_borrowortrade)
- [_finalizeOpen(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, address[4] sentAddresses, uint256[5] sentValues, bool isTorqueLoan)](#_finalizeopen)
- [_emitOpeningEvents(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, address[4] sentAddresses, uint256[5] sentValues, uint256 collateralToLoanRate, uint256 margin, bool isTorqueLoan)](#_emitopeningevents)
- [_setDelegatedManager(bytes32 loanId, address delegator, address delegated, bool toggle)](#_setdelegatedmanager)
- [_isCollateralSatisfied(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 initialMargin, uint256 newCollateral, uint256 collateralAmountRequired)](#_iscollateralsatisfied)
- [_initializeLoan(struct LoanParamsStruct.LoanParams loanParamsLocal, bytes32 loanId, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues)](#_initializeloan)
- [_initializeInterest(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 newRate, uint256 newPrincipal, uint256 torqueInterest)](#_initializeinterest)
- [_getRequiredCollateral(address loanToken, address collateralToken, uint256 newPrincipal, uint256 marginAmount, bool isTorqueLoan)](#_getrequiredcollateral)

---    

> ### constructor

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

Set function selectors on target contract.
     *

```solidity
function initialize(address target) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address | The address of the target contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function initialize(address target) external onlyOwner {
        address prevModuleContractAddress = logicTargets[this.borrowOrTradeFromPool.selector];
        _setTarget(this.borrowOrTradeFromPool.selector, target);
        _setTarget(this.setDelegatedManager.selector, target);
        _setTarget(this.getEstimatedMarginExposure.selector, target);
        _setTarget(this.getRequiredCollateral.selector, target);
        _setTarget(this.getBorrowAmount.selector, target);
        emit ProtocolModuleContractReplaced(prevModuleContractAddress, target, "LoanOpenings");
    }
```
</details>

---    

> ### borrowOrTradeFromPool

Borrow or trade from pool.
     *

```solidity
function borrowOrTradeFromPool(bytes32 loanParamsId, bytes32 loanId, bool isTorqueLoan, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues, bytes loanDataBytes) external payable nonReentrant whenNotPaused 
returns(newPrincipal uint256, newCollateral uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsId | bytes32 | The ID of the loan parameters. | 
| loanId | bytes32 | The ID of the loan. If 0, start a new loan. | 
| isTorqueLoan | bool | Whether the loan is a Torque loan. | 
| initialMargin | uint256 | The initial amount of margin. | 
| sentAddresses | address[4] | The addresses to send tokens: lender, borrower,   receiver and manager:     lender: must match loan if loanId provided.     borrower: must match loan if loanId provided.     receiver: receiver of funds (address(0) assumes borrower address).     manager: delegated manager of loan unless address(0). | 
| sentValues | uint256[5] | The values to send:     newRate: New loan interest rate.     newPrincipal: New loan size (borrowAmount + any borrowed interest).     torqueInterest: New amount of interest to escrow for Torque loan (determines initial loan length).     loanTokenReceived: Total loanToken deposit (amount not sent to borrower in the case of Torque loans).     collateralTokenReceived: Total collateralToken deposit. | 
| loanDataBytes | bytes | The payload for the call. These loan DataBytes are   additional loan data (not in use for token swaps).      * | 

**Returns**

newPrincipal The new loan size.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function borrowOrTradeFromPool(
        bytes32 loanParamsId,
        bytes32 loanId,
        bool isTorqueLoan,
        uint256 initialMargin,
        address[4] calldata sentAddresses,
        uint256[5] calldata sentValues,
        bytes calldata loanDataBytes
    )
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 newPrincipal, uint256 newCollateral)
    {
        require(msg.value == 0 || loanDataBytes.length != 0, "loanDataBytes required with ether");

        /// Only callable by loan pools.
        require(loanPoolToUnderlying[msg.sender] != address(0), "not authorized");

        LoanParams memory loanParamsLocal = loanParams[loanParamsId];
        require(loanParamsLocal.id != 0, "loanParams not exists");

        /// Get required collateral.
        uint256 collateralAmountRequired =
            _getRequiredCollateral(
                loanParamsLocal.loanToken,
                loanParamsLocal.collateralToken,
                sentValues[1],
                initialMargin,
                isTorqueLoan
            );
        require(collateralAmountRequired != 0, "collateral is 0");

        return
            _borrowOrTrade(
                loanParamsLocal,
                loanId,
                isTorqueLoan,
                collateralAmountRequired,
                initialMargin,
                sentAddresses,
                sentValues,
                loanDataBytes
            );
    }
```
</details>

---    

> ### setDelegatedManager

Set the delegated manager.
     *

```solidity
function setDelegatedManager(bytes32 loanId, address delegated, bool toggle) external nonpayable whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan. If 0, start a new loan. | 
| delegated | address | The address of the delegated manager. | 
| toggle | bool | The flag true/false for the delegated manager. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setDelegatedManager(
        bytes32 loanId,
        address delegated,
        bool toggle
    ) external whenNotPaused {
        require(loans[loanId].borrower == msg.sender, "unauthorized");

        _setDelegatedManager(loanId, msg.sender, delegated, toggle);
    }
```
</details>

---    

> ### getEstimatedMarginExposure

Get the estimated margin exposure.
     * Margin is the money borrowed from a broker to purchase an investment
and is the difference between the total value of investment and the
loan amount. Margin trading refers to the practice of using borrowed
funds from a broker to trade a financial asset, which forms the
collateral for the loan from the broker.
     *

```solidity
function getEstimatedMarginExposure(address loanToken, address collateralToken, uint256 loanTokenSent, uint256 collateralTokenSent, uint256 interestRate, uint256 newPrincipal) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The loan token instance address. | 
| collateralToken | address | The collateral token instance address. | 
| loanTokenSent | uint256 | The amount of loan tokens sent. | 
| collateralTokenSent | uint256 | The amount of collateral tokens sent. | 
| interestRate | uint256 | The interest rate. Percentage w/ 18 decimals. | 
| newPrincipal | uint256 | The updated amount of principal (current debt).      * | 

**Returns**

The margin exposure.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getEstimatedMarginExposure(
        address loanToken,
        address collateralToken,
        uint256 loanTokenSent,
        uint256 collateralTokenSent,
        uint256 interestRate,
        uint256 newPrincipal
    ) external view returns (uint256) {
        uint256 maxLoanTerm = 2419200; // 28 days

        uint256 owedPerDay = newPrincipal.mul(interestRate).div(365 * 10**20);

        uint256 interestAmountRequired = maxLoanTerm.mul(owedPerDay).div(86400);

        uint256 swapAmount = loanTokenSent.sub(interestAmountRequired);
        uint256 tradingFee = _getTradingFee(swapAmount);
        if (tradingFee != 0) {
            swapAmount = swapAmount.sub(tradingFee);
        }

        uint256 receivedAmount = _swapsExpectedReturn(loanToken, collateralToken, swapAmount);
        if (receivedAmount == 0) {
            return 0;
        } else {
            return collateralTokenSent.add(receivedAmount);
        }
    }
```
</details>

---    

> ### getRequiredCollateral

Get the required collateral.
     *

```solidity
function getRequiredCollateral(address loanToken, address collateralToken, uint256 newPrincipal, uint256 marginAmount, bool isTorqueLoan) public view
returns(collateralAmountRequired uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The loan token instance address. | 
| collateralToken | address | The collateral token instance address. | 
| newPrincipal | uint256 | The updated amount of principal (current debt). | 
| marginAmount | uint256 | The amount of margin of the trade. | 
| isTorqueLoan | bool | Whether the loan is a Torque loan.      * | 

**Returns**

collateralAmountRequired The required collateral.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getRequiredCollateral(
        address loanToken,
        address collateralToken,
        uint256 newPrincipal,
        uint256 marginAmount,
        bool isTorqueLoan
    ) public view returns (uint256 collateralAmountRequired) {
        if (marginAmount != 0) {
            collateralAmountRequired = _getRequiredCollateral(
                loanToken,
                collateralToken,
                newPrincipal,
                marginAmount,
                isTorqueLoan
            );

            // p3.9 from bzx peckshield-audit-report-bZxV2-v1.0rc1.pdf
            // cannot be applied solely as it drives to some other tests failure
            /*
			uint256 feePercent = isTorqueLoan ? borrowingFeePercent : tradingFeePercent;
			if (collateralAmountRequired != 0 && feePercent != 0) {
				collateralAmountRequired = collateralAmountRequired.mul(10**20).divCeil(
					10**20 - feePercent // never will overflow
				);
			}*/

            uint256 fee =
                isTorqueLoan
                    ? _getBorrowingFee(collateralAmountRequired)
                    : _getTradingFee(collateralAmountRequired);
            if (fee != 0) {
                collateralAmountRequired = collateralAmountRequired.add(fee);
            }
        }
    }
```
</details>

---    

> ### getBorrowAmount

Get the borrow amount of a trade loan.
     *

```solidity
function getBorrowAmount(address loanToken, address collateralToken, uint256 collateralTokenAmount, uint256 marginAmount, bool isTorqueLoan) public view
returns(borrowAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The loan token instance address. | 
| collateralToken | address | The collateral token instance address. | 
| collateralTokenAmount | uint256 | The amount of collateral. | 
| marginAmount | uint256 | The amount of margin of the trade. | 
| isTorqueLoan | bool | Whether the loan is a Torque loan.      * | 

**Returns**

borrowAmount The borrow amount.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getBorrowAmount(
        address loanToken,
        address collateralToken,
        uint256 collateralTokenAmount,
        uint256 marginAmount,
        bool isTorqueLoan
    ) public view returns (uint256 borrowAmount) {
        if (marginAmount != 0) {
            if (isTorqueLoan) {
                marginAmount = marginAmount.add(10**20); /// Adjust for over-collateralized loan.
            }
            uint256 collateral = collateralTokenAmount;
            uint256 fee = isTorqueLoan ? _getBorrowingFee(collateral) : _getTradingFee(collateral);
            if (fee != 0) {
                collateral = collateral.sub(fee);
            }
            if (loanToken == collateralToken) {
                borrowAmount = collateral.mul(10**20).div(marginAmount);
            } else {
                (uint256 sourceToDestRate, uint256 sourceToDestPrecision) =
                    IPriceFeeds(priceFeeds).queryRate(collateralToken, loanToken);
                if (sourceToDestPrecision != 0) {
                    borrowAmount = collateral
                        .mul(10**20)
                        .mul(sourceToDestRate)
                        .div(marginAmount)
                        .div(sourceToDestPrecision);
                }
            }
            /*
			// p3.9 from bzx peckshield-audit-report-bZxV2-v1.0rc1.pdf
			// cannot be applied solely as it drives to some other tests failure
			uint256 feePercent = isTorqueLoan ? borrowingFeePercent : tradingFeePercent;
			if (borrowAmount != 0 && feePercent != 0) {
				borrowAmount = borrowAmount
					.mul(
					10**20 - feePercent // never will overflow
				)
					.divCeil(10**20);
			}*/
        }
    }
```
</details>

---    

> ### _borrowOrTrade

Borrow or trade.
     *

```solidity
function _borrowOrTrade(struct LoanParamsStruct.LoanParams loanParamsLocal, bytes32 loanId, bool isTorqueLoan, uint256 collateralAmountRequired, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues, bytes loanDataBytes) internal nonpayable
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters. | 
| loanId | bytes32 | The ID of the loan. If 0, start a new loan. | 
| isTorqueLoan | bool | Whether the loan is a Torque loan. | 
| collateralAmountRequired | uint256 | The required amount of collateral. | 
| initialMargin | uint256 | The initial amount of margin. | 
| sentAddresses | address[4] | The addresses to send tokens: lender, borrower,   receiver and manager:     lender: must match loan if loanId provided.     borrower: must match loan if loanId provided.     receiver: receiver of funds (address(0) assumes borrower address).     manager: delegated manager of loan unless address(0). | 
| sentValues | uint256[5] | The values to send:     newRate: New loan interest rate.     newPrincipal: New loan size (borrowAmount + any borrowed interest).     torqueInterest: New amount of interest to escrow for Torque loan (determines initial loan length).     loanTokenReceived: Total loanToken deposit (amount not sent to borrower in the case of Torque loans).     collateralTokenReceived: Total collateralToken deposit. | 
| loanDataBytes | bytes | The payload for the call. These loan DataBytes are   additional loan data (not in use for token swaps).      * | 

**Returns**

The new loan size.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _borrowOrTrade(
        LoanParams memory loanParamsLocal,
        bytes32 loanId,
        bool isTorqueLoan,
        uint256 collateralAmountRequired,
        uint256 initialMargin,
        address[4] memory sentAddresses,
        uint256[5] memory sentValues,
        bytes memory loanDataBytes
    ) internal returns (uint256, uint256) {
        require(
            loanParamsLocal.collateralToken != loanParamsLocal.loanToken,
            "collateral/loan match"
        );
        require(initialMargin >= loanParamsLocal.minInitialMargin, "initialMargin too low");

        /// maxLoanTerm == 0 indicates a Torque loan and requires that torqueInterest != 0
        require(
            loanParamsLocal.maxLoanTerm != 0 || sentValues[2] != 0, /// torqueInterest
            "invalid interest"
        );

        /// Initialize loan.
        Loan storage loanLocal =
            loans[
                _initializeLoan(loanParamsLocal, loanId, initialMargin, sentAddresses, sentValues)
            ];

        // Get required interest.
        uint256 amount =
            _initializeInterest(
                loanParamsLocal,
                loanLocal,
                sentValues[0], /// newRate
                sentValues[1], /// newPrincipal,
                sentValues[2] /// torqueInterest
            );

        /// substract out interest from usable loanToken sent.
        sentValues[3] = sentValues[3].sub(amount);

        if (isTorqueLoan) {
            require(sentValues[3] == 0, "surplus loan token");

            uint256 borrowingFee = _getBorrowingFee(sentValues[4]);
            // need to temp into local state to avoid
            address _collateralToken = loanParamsLocal.collateralToken;
            address _loanToken = loanParamsLocal.loanToken;
            if (borrowingFee != 0) {
                _payBorrowingFee(
                    sentAddresses[1], /// borrower
                    loanLocal.id,
                    _collateralToken, /// fee token
                    _loanToken, /// pairToken (used to check if there is any special rebates or not) -- to pay fee reward
                    borrowingFee
                );

                sentValues[4] = sentValues[4] /// collateralTokenReceived
                    .sub(borrowingFee);
            }
        } else {
            /// Update collateral after trade.
            /// sentValues[3] is repurposed to hold loanToCollateralSwapRate to avoid stack too deep error.
            uint256 receivedAmount;
            (receivedAmount, , sentValues[3]) = _loanSwap(
                loanId,
                loanParamsLocal.loanToken,
                loanParamsLocal.collateralToken,
                sentAddresses[1], /// borrower
                sentValues[3], /// loanTokenUsable (minSourceTokenAmount)
                0, /// maxSourceTokenAmount (0 means minSourceTokenAmount)
                0, /// requiredDestTokenAmount (enforces that all of loanTokenUsable is swapped)
                false, /// bypassFee
                loanDataBytes
            );
            sentValues[4] = sentValues[4] /// collateralTokenReceived
                .add(receivedAmount);
        }

        /// Settle collateral.
        require(
            _isCollateralSatisfied(
                loanParamsLocal,
                loanLocal,
                initialMargin,
                sentValues[4],
                collateralAmountRequired
            ),
            "collateral insufficient"
        );

        loanLocal.collateral = loanLocal.collateral.add(sentValues[4]);

        if (isTorqueLoan) {
            /// reclaiming varaible -> interestDuration
            sentValues[2] = loanLocal.endTimestamp.sub(block.timestamp);
        } else {
            /// reclaiming varaible -> entryLeverage = 100 / initialMargin
            sentValues[2] = SafeMath.div(10**38, initialMargin);
        }

        _finalizeOpen(loanParamsLocal, loanLocal, sentAddresses, sentValues, isTorqueLoan);

        return (sentValues[1], sentValues[4]); /// newPrincipal, newCollateral
    }
```
</details>

---    

> ### _finalizeOpen

Finalize an open loan.
     *

```solidity
function _finalizeOpen(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, address[4] sentAddresses, uint256[5] sentValues, bool isTorqueLoan) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters. | 
| loanLocal | struct LoanStruct.Loan | The loan object. | 
| sentAddresses | address[4] | The addresses to send tokens: lender, borrower,   receiver and manager:     lender: must match loan if loanId provided.     borrower: must match loan if loanId provided.     receiver: receiver of funds (address(0) assumes borrower address).     manager: delegated manager of loan unless address(0). | 
| sentValues | uint256[5] | The values to send:     newRate: New loan interest rate.     newPrincipal: New loan size (borrowAmount + any borrowed interest).     torqueInterest: New amount of interest to escrow for Torque loan (determines initial loan length).     loanTokenReceived: Total loanToken deposit (amount not sent to borrower in the case of Torque loans).     collateralTokenReceived: Total collateralToken deposit. | 
| isTorqueLoan | bool | Whether the loan is a Torque loan. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _finalizeOpen(
        LoanParams memory loanParamsLocal,
        Loan storage loanLocal,
        address[4] memory sentAddresses,
        uint256[5] memory sentValues,
        bool isTorqueLoan
    ) internal {
        /// @dev TODO: here the actual used rate and margin should go.
        (uint256 initialMargin, uint256 collateralToLoanRate) =
            IPriceFeeds(priceFeeds).getCurrentMargin(
                loanParamsLocal.loanToken,
                loanParamsLocal.collateralToken,
                loanLocal.principal,
                loanLocal.collateral
            );
        require(initialMargin > loanParamsLocal.maintenanceMargin, "unhealthy position");

        if (loanLocal.startTimestamp == block.timestamp) {
            uint256 loanToCollateralPrecision =
                IPriceFeeds(priceFeeds).queryPrecision(
                    loanParamsLocal.loanToken,
                    loanParamsLocal.collateralToken
                );
            uint256 collateralToLoanPrecision =
                IPriceFeeds(priceFeeds).queryPrecision(
                    loanParamsLocal.collateralToken,
                    loanParamsLocal.loanToken
                );
            uint256 totalSwapRate = loanToCollateralPrecision.mul(collateralToLoanPrecision);
            loanLocal.startRate = isTorqueLoan
                ? collateralToLoanRate
                : totalSwapRate.div(sentValues[3]);
        }

        _emitOpeningEvents(
            loanParamsLocal,
            loanLocal,
            sentAddresses,
            sentValues,
            collateralToLoanRate,
            initialMargin,
            isTorqueLoan
        );
    }
```
</details>

---    

> ### _emitOpeningEvents

Emit the opening events.
     *

```solidity
function _emitOpeningEvents(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, address[4] sentAddresses, uint256[5] sentValues, uint256 collateralToLoanRate, uint256 margin, bool isTorqueLoan) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters. | 
| loanLocal | struct LoanStruct.Loan | The loan object. | 
| sentAddresses | address[4] | The addresses to send tokens: lender, borrower,   receiver and manager:     lender: must match loan if loanId provided.     borrower: must match loan if loanId provided.     receiver: receiver of funds (address(0) assumes borrower address).     manager: delegated manager of loan unless address(0). | 
| sentValues | uint256[5] | The values to send:     newRate: New loan interest rate.     newPrincipal: New loan size (borrowAmount + any borrowed interest).     torqueInterest: New amount of interest to escrow for Torque loan (determines initial loan length).     loanTokenReceived: Total loanToken deposit (amount not sent to borrower in the case of Torque loans).     collateralTokenReceived: Total collateralToken deposit. | 
| collateralToLoanRate | uint256 | The exchange rate from collateral to loan   tokens. | 
| margin | uint256 | The amount of margin of the trade. | 
| isTorqueLoan | bool | Whether the loan is a Torque loan. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _emitOpeningEvents(
        LoanParams memory loanParamsLocal,
        Loan memory loanLocal,
        address[4] memory sentAddresses,
        uint256[5] memory sentValues,
        uint256 collateralToLoanRate,
        uint256 margin,
        bool isTorqueLoan
    ) internal {
        if (isTorqueLoan) {
            emit Borrow(
                sentAddresses[1], /// user (borrower)
                sentAddresses[0], /// lender
                loanLocal.id, /// loanId
                loanParamsLocal.loanToken, /// loanToken
                loanParamsLocal.collateralToken, /// collateralToken
                sentValues[1], /// newPrincipal
                sentValues[4], /// newCollateral
                sentValues[0], /// interestRate
                sentValues[2], /// interestDuration
                collateralToLoanRate, /// collateralToLoanRate,
                margin /// currentMargin
            );
        } else {
            /// currentLeverage = 100 / currentMargin
            margin = SafeMath.div(10**38, margin);

            emit Trade(
                sentAddresses[1], /// user (trader)
                sentAddresses[0], /// lender
                loanLocal.id, /// loanId
                loanParamsLocal.collateralToken, /// collateralToken
                loanParamsLocal.loanToken, /// loanToken
                sentValues[4], /// positionSize
                sentValues[1], /// borrowedAmount
                sentValues[0], /// interestRate,
                loanLocal.endTimestamp, /// settlementDate
                sentValues[3], /// entryPrice (loanToCollateralSwapRate)
                sentValues[2], /// entryLeverage
                margin /// currentLeverage
            );
        }
    }
```
</details>

---    

> ### _setDelegatedManager

Set the delegated manager.
     *

```solidity
function _setDelegatedManager(bytes32 loanId, address delegator, address delegated, bool toggle) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan. If 0, start a new loan. | 
| delegator | address | The address of previous manager. | 
| delegated | address | The address of the delegated manager. | 
| toggle | bool | The flag true/false for the delegated manager. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _setDelegatedManager(
        bytes32 loanId,
        address delegator,
        address delegated,
        bool toggle
    ) internal {
        delegatedManagers[loanId][delegated] = toggle;

        emit DelegatedManagerSet(loanId, delegator, delegated, toggle);
    }
```
</details>

---    

> ### _isCollateralSatisfied

Calculate whether the collateral is satisfied.
     *

```solidity
function _isCollateralSatisfied(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 initialMargin, uint256 newCollateral, uint256 collateralAmountRequired) internal view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters. | 
| loanLocal | struct LoanStruct.Loan | The loan object. | 
| initialMargin | uint256 | The initial amount of margin. | 
| newCollateral | uint256 | The amount of new collateral. | 
| collateralAmountRequired | uint256 | The amount of required collateral.      * | 

**Returns**

Whether the collateral is satisfied.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _isCollateralSatisfied(
        LoanParams memory loanParamsLocal,
        Loan memory loanLocal,
        uint256 initialMargin,
        uint256 newCollateral,
        uint256 collateralAmountRequired
    ) internal view returns (bool) {
        /// Allow at most 2% under-collateralized.
        collateralAmountRequired = collateralAmountRequired.mul(98 ether).div(100 ether);

        if (newCollateral < collateralAmountRequired) {
            /// Check that existing collateral is sufficient coverage.
            if (loanLocal.collateral != 0) {
                uint256 maxDrawdown =
                    IPriceFeeds(priceFeeds).getMaxDrawdown(
                        loanParamsLocal.loanToken,
                        loanParamsLocal.collateralToken,
                        loanLocal.principal,
                        loanLocal.collateral,
                        initialMargin
                    );
                return newCollateral.add(maxDrawdown) >= collateralAmountRequired;
            } else {
                return false;
            }
        }
        return true;
    }
```
</details>

---    

> ### _initializeLoan

Initialize a loan.
     *

```solidity
function _initializeLoan(struct LoanParamsStruct.LoanParams loanParamsLocal, bytes32 loanId, uint256 initialMargin, address[4] sentAddresses, uint256[5] sentValues) internal nonpayable
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters. | 
| loanId | bytes32 | The ID of the loan. | 
| initialMargin | uint256 | The amount of margin of the trade. | 
| sentAddresses | address[4] | The addresses to send tokens: lender, borrower,   receiver and manager:     lender: must match loan if loanId provided.     borrower: must match loan if loanId provided.     receiver: receiver of funds (address(0) assumes borrower address).     manager: delegated manager of loan unless address(0). | 
| sentValues | uint256[5] | The values to send:     newRate: New loan interest rate.     newPrincipal: New loan size (borrowAmount + any borrowed interest).     torqueInterest: New amount of interest to escrow for Torque loan (determines initial loan length).     loanTokenReceived: Total loanToken deposit (amount not sent to borrower in the case of Torque loans).     collateralTokenReceived: Total collateralToken deposit. | 

**Returns**

The loanId.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _initializeLoan(
        LoanParams memory loanParamsLocal,
        bytes32 loanId,
        uint256 initialMargin,
        address[4] memory sentAddresses,
        uint256[5] memory sentValues
    ) internal returns (bytes32) {
        require(loanParamsLocal.active, "loanParams disabled");

        address lender = sentAddresses[0];
        address borrower = sentAddresses[1];
        address manager = sentAddresses[3];
        uint256 newPrincipal = sentValues[1];

        Loan memory loanLocal;

        if (loanId == 0) {
            borrowerNonce[borrower]++;
            loanId = keccak256(
                abi.encodePacked(loanParamsLocal.id, lender, borrower, borrowerNonce[borrower])
            );
            require(loans[loanId].id == 0, "loan exists");

            loanLocal = Loan({
                id: loanId,
                loanParamsId: loanParamsLocal.id,
                pendingTradesId: 0,
                active: true,
                principal: newPrincipal,
                collateral: 0, /// calculated later
                startTimestamp: block.timestamp,
                endTimestamp: 0, /// calculated later
                startMargin: initialMargin,
                startRate: 0, /// queried later
                borrower: borrower,
                lender: lender
            });

            activeLoansSet.addBytes32(loanId);
            lenderLoanSets[lender].addBytes32(loanId);
            borrowerLoanSets[borrower].addBytes32(loanId);
        } else {
            loanLocal = loans[loanId];
            require(
                loanLocal.active && block.timestamp < loanLocal.endTimestamp,
                "loan has ended"
            );
            require(loanLocal.borrower == borrower, "borrower mismatch");
            require(loanLocal.lender == lender, "lender mismatch");
            require(loanLocal.loanParamsId == loanParamsLocal.id, "loanParams mismatch");

            loanLocal.principal = loanLocal.principal.add(newPrincipal);
        }

        if (manager != address(0)) {
            _setDelegatedManager(loanId, borrower, manager, true);
        }

        loans[loanId] = loanLocal;

        return loanId;
    }
```
</details>

---    

> ### _initializeInterest

Initialize a loan interest.
     *

```solidity
function _initializeInterest(struct LoanParamsStruct.LoanParams loanParamsLocal, struct LoanStruct.Loan loanLocal, uint256 newRate, uint256 newPrincipal, uint256 torqueInterest) internal nonpayable
returns(interestAmountRequired uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters. | 
| loanLocal | struct LoanStruct.Loan | The loan object. | 
| newRate | uint256 | The new interest rate of the loan. | 
| newPrincipal | uint256 | The new principal amount of the loan. | 
| torqueInterest | uint256 | The interest rate of the Torque loan.      * | 

**Returns**

interestAmountRequired The interest amount required.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _initializeInterest(
        LoanParams memory loanParamsLocal,
        Loan storage loanLocal,
        uint256 newRate,
        uint256 newPrincipal,
        uint256 torqueInterest /// ignored for fixed-term loans
    ) internal returns (uint256 interestAmountRequired) {
        /// Pay outstanding interest to lender.
        _payInterest(loanLocal.lender, loanParamsLocal.loanToken);

        LoanInterest storage loanInterestLocal = loanInterest[loanLocal.id];
        LenderInterest storage lenderInterestLocal =
            lenderInterest[loanLocal.lender][loanParamsLocal.loanToken];

        uint256 maxLoanTerm = loanParamsLocal.maxLoanTerm;

        _settleFeeRewardForInterestExpense(
            loanInterestLocal,
            loanLocal.id,
            loanParamsLocal.loanToken, /// fee token
            loanParamsLocal.collateralToken, /// pairToken (used to check if there is any special rebates or not) -- to pay fee reward
            loanLocal.borrower,
            block.timestamp
        );

        uint256 previousDepositRemaining;
        if (maxLoanTerm == 0 && loanLocal.endTimestamp != 0) {
            previousDepositRemaining = loanLocal
                .endTimestamp
                .sub(block.timestamp) /// block.timestamp < endTimestamp was confirmed earlier.
                .mul(loanInterestLocal.owedPerDay)
                .div(86400);
        }

        uint256 owedPerDay = newPrincipal.mul(newRate).div(365 * 10**20);

        /// Update stored owedPerDay
        loanInterestLocal.owedPerDay = loanInterestLocal.owedPerDay.add(owedPerDay);
        lenderInterestLocal.owedPerDay = lenderInterestLocal.owedPerDay.add(owedPerDay);

        if (maxLoanTerm == 0) {
            /// Indefinite-term (Torque) loan.

            /// torqueInterest != 0 was confirmed earlier.
            loanLocal.endTimestamp = torqueInterest
                .add(previousDepositRemaining)
                .mul(86400)
                .div(loanInterestLocal.owedPerDay)
                .add(block.timestamp);

            maxLoanTerm = loanLocal.endTimestamp.sub(block.timestamp);

            /// Loan term has to at least be greater than one hour.
            require(maxLoanTerm > 3600, "loan too short");

            interestAmountRequired = torqueInterest;
        } else {
            /// Fixed-term loan.

            if (loanLocal.endTimestamp == 0) {
                loanLocal.endTimestamp = block.timestamp.add(maxLoanTerm);
            }

            interestAmountRequired = loanLocal
                .endTimestamp
                .sub(block.timestamp)
                .mul(owedPerDay)
                .div(86400);
        }

        loanInterestLocal.depositTotal = loanInterestLocal.depositTotal.add(
            interestAmountRequired
        );

        /// Update remaining lender interest values.
        lenderInterestLocal.principalTotal = lenderInterestLocal.principalTotal.add(newPrincipal);
        lenderInterestLocal.owedTotal = lenderInterestLocal.owedTotal.add(interestAmountRequired);
    }
```
</details>

---    

> ### _getRequiredCollateral

Get the required collateral.
     *

```solidity
function _getRequiredCollateral(address loanToken, address collateralToken, uint256 newPrincipal, uint256 marginAmount, bool isTorqueLoan) internal view
returns(collateralTokenAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The loan token instance address. | 
| collateralToken | address | The collateral token instance address. | 
| newPrincipal | uint256 | The updated amount of principal (current debt). | 
| marginAmount | uint256 | The amount of margin of the trade. | 
| isTorqueLoan | bool | Whether the loan is a Torque loan.      * | 

**Returns**

collateralTokenAmount The required collateral.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getRequiredCollateral(
        address loanToken,
        address collateralToken,
        uint256 newPrincipal,
        uint256 marginAmount,
        bool isTorqueLoan
    ) internal view returns (uint256 collateralTokenAmount) {
        if (loanToken == collateralToken) {
            collateralTokenAmount = newPrincipal.mul(marginAmount).div(10**20);
        } else {
            /// Using the price feed instead of the swap expected return
            /// because we need the rate in the inverse direction
            /// so the swap is probably farther off than the price feed.
            (uint256 sourceToDestRate, uint256 sourceToDestPrecision) =
                IPriceFeeds(priceFeeds).queryRate(collateralToken, loanToken);
            if (sourceToDestRate != 0) {
                collateralTokenAmount = newPrincipal
                    .mul(sourceToDestPrecision)
                    .div(sourceToDestRate)
                    .mul(marginAmount)
                    .div(10**20);
                /*TODO: review
				collateralTokenAmount = newPrincipal.mul(sourceToDestPrecision).mul(marginAmount).div(sourceToDestRate).div(10**20);*/
            }
        }
        // ./tests/loan-token/TradingTestToken.test.js
        if (isTorqueLoan && collateralTokenAmount != 0) {
            collateralTokenAmount = collateralTokenAmount.mul(10**20).div(marginAmount).add(
                collateralTokenAmount
            );
        }
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
