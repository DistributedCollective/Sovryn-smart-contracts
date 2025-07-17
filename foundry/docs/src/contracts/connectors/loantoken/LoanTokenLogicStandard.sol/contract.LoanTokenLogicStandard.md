# LoanTokenLogicStandard
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/LoanTokenLogicStandard.sol)

**Inherits:**
[LoanTokenLogicShared](/contracts/connectors/loantoken/LoanTokenLogicShared.sol/contract.LoanTokenLogicShared.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.


## Functions
### transfer

Transfer tokens wrapper.
Sets token owner the msg.sender.
Sets maximun allowance uint256(-1) to ensure tokens are always transferred.
If the recipient (_to) is a vesting contract address, transfer the token to the tokenOwner of the vesting contract itself.


```solidity
function transfer(address _to, uint256 _value) external returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_to`|`address`|The recipient of the tokens.|
|`_value`|`uint256`|The amount of tokens sent.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|Success true/false.|


### transferFrom

need additional check  address(0) here to support backward compatibility
in case we don't want to activate this check, just need to set the stakingContractAddress to 0 address

Moves `_value` loan tokens from `_from` to `_to` using the
allowance mechanism. Calls internal _internalTransferFrom function.


```solidity
function transferFrom(address _from, address _to, uint256 _value) external returns (bool);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|A boolean value indicating whether the operation succeeded.|


### borrow

Borrow funds from the pool.
The underlying loan token may not be used as collateral.


```solidity
function borrow(
    bytes32 loanId,
    uint256 withdrawAmount,
    uint256 initialLoanDuration,
    uint256 collateralTokenSent,
    address collateralTokenAddress,
    address borrower,
    address receiver,
    bytes memory
) public payable nonReentrant globallyNonReentrant returns (uint256, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|The ID of the loan, 0 for a new loan.|
|`withdrawAmount`|`uint256`|The amount to be withdrawn (actually borrowed).|
|`initialLoanDuration`|`uint256`|The duration of the loan in seconds. If the loan is not paid back until then, it'll need to be rolled over.|
|`collateralTokenSent`|`uint256`|The amount of collateral tokens provided by the user. (150% of the withdrawn amount worth in collateral tokens).|
|`collateralTokenAddress`|`address`|The address of the token to be used as collateral. Cannot be the loan token address.|
|`borrower`|`address`|The one paying for the collateral.|
|`receiver`|`address`|The one receiving the withdrawn amount.|
|`<none>`|`bytes`||

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|New principal and new collateral added to loan.|
|`<none>`|`uint256`||


### marginTrade

Temporary: limit transaction size.

Borrow and immediately get into a position.
Trading on margin is used to increase an investor's buying power.
Margin is the amount of money required to open a position, while
leverage is the multiple of exposure to account equity.
Leverage allows you to trade positions LARGER than the amount
of money in your trading account. Leverage is expressed as a ratio.
When trading on margin, investors first deposit some token that then
serves as collateral for the loan, and then pay ongoing interest
payments on the money they borrow.
Margin trading = taking a loan and swapping it:
In order to open a margin trade position,
1.- The user calls marginTrade on the loan token contract.
2.- The loan token contract provides the loan and sends it for processing
to the protocol proxy contract.
3.- The protocol proxy contract uses the module LoanOpening to create a
position and swaps the loan tokens to collateral tokens.
4.- The Sovryn Swap network looks up the correct converter and swaps the
tokens.
If successful, the position is being held by the protocol proxy contract,
which is why positions need to be closed at the protocol proxy contract.

*We have an issue regarding contract size code is too big. 1 of the solution is need to keep the error message 32 bytes length*

*Ensure authorized use of existing loan.*

*The condition is never met.
Address zero is not allowed by previous require validation.
This check is unneeded and was lowering the test coverage index.
The lender.
sentAddresses.manager = address(0); /// The manager.
interestRate, interestInitialAmount, borrowAmount (newBorrowAmount).
Interest is settled above.
sentAmounts.loanTokenSent = 0; /// loanTokenSent
loanDataBytes*


```solidity
function marginTrade(
    bytes32 loanId,
    uint256 leverageAmount,
    uint256 loanTokenSent,
    uint256 collateralTokenSent,
    address collateralTokenAddress,
    address trader,
    uint256 minEntryPrice,
    bytes memory loanDataBytes
) public payable nonReentrant globallyNonReentrant returns (uint256, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|The ID of the loan, 0 for a new loan.|
|`leverageAmount`|`uint256`|The multiple of exposure: 2x ... 5x. The leverage with 18 decimals.|
|`loanTokenSent`|`uint256`|The number of loan tokens provided by the user.|
|`collateralTokenSent`|`uint256`|The amount of collateral tokens provided by the user.|
|`collateralTokenAddress`|`address`|The token address of collateral.|
|`trader`|`address`|The account that performs this trade.|
|`minEntryPrice`|`uint256`|Value of loan token in collateral.|
|`loanDataBytes`|`bytes`|Additional loan data (not in use for token swaps).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|New principal and new collateral added to trade.|
|`<none>`|`uint256`||


### marginTradeAffiliate

Wrapper for marginTrade invoking setAffiliatesReferrer to track
referral trade by affiliates program.

*Ensure authorized use of existing loan.
Temporary: limit transaction size.*

*Compute the worth of the total deposit in loan tokens.
(loanTokenSent + convert(collateralTokenSent))
No actual swap happening here.
sentAddresses.manager = address(0); /// The manager.
sentAmounts.interestRate = 0; /// interestRate (found later).
sentAmounts.interestInitialAmount = 0; /// interestInitialAmount (interest is calculated based on fixed-term loan).
borrowAmount, interestRate
depositAmount*

*Converting to initialMargin
withdrawAmount*


```solidity
function marginTradeAffiliate(
    bytes32 loanId,
    uint256 leverageAmount,
    uint256 loanTokenSent,
    uint256 collateralTokenSent,
    address collateralTokenAddress,
    address trader,
    uint256 minEntryPrice,
    address affiliateReferrer,
    bytes calldata loanDataBytes
) external payable returns (uint256, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|The ID of the loan, 0 for a new loan.|
|`leverageAmount`|`uint256`|The multiple of exposure: 2x ... 5x. The leverage with 18 decimals.|
|`loanTokenSent`|`uint256`|The number of loan tokens provided by the user.|
|`collateralTokenSent`|`uint256`|The amount of collateral tokens provided by the user.|
|`collateralTokenAddress`|`address`|The token address of collateral.|
|`trader`|`address`|The account that performs this trade.|
|`minEntryPrice`|`uint256`|Value of loan token in collateral.|
|`affiliateReferrer`|`address`|The address of the referrer from affiliates program.|
|`loanDataBytes`|`bytes`|Additional loan data (not in use for token swaps).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|New principal and new collateral added to trade.|
|`<none>`|`uint256`||


### profitOf

Wrapper for internal _profitOf low level function.


```solidity
function profitOf(address user) external view returns (int256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|The user address.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`int256`|The profit of a user.|


### checkpointPrice

Getter for the price checkpoint mapping.

*keccak256("iToken_ProfitSoFar")*


```solidity
function checkpointPrice(address _user) public view returns (uint256 price);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|The user account as the mapping index.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`price`|`uint256`|The price on the checkpoint for this user.|


### marketLiquidity

Get current liquidity.
A part of total funds supplied are borrowed. Liquidity = supply - borrow


```solidity
function marketLiquidity() public view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The market liquidity.|


### avgBorrowInterestRate

Wrapper for average borrow interest.


```solidity
function avgBorrowInterestRate() public view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The average borrow interest.|


### borrowInterestRate

Get borrow interest rate.
The minimum rate the next base protocol borrower will receive
for variable-rate loans.


```solidity
function borrowInterestRate() public view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The borrow interest rate.|


### nextBorrowInterestRate

Public wrapper for internal call.


```solidity
function nextBorrowInterestRate(uint256 borrowAmount) public view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`borrowAmount`|`uint256`|The amount of tokens to borrow.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The next borrow interest rate.|


### supplyInterestRate

Get interest rate.


```solidity
function supplyInterestRate() public view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Interest that lenders are currently receiving when supplying to the pool.|


### nextSupplyInterestRate

Get interest rate w/ added supply.


```solidity
function nextSupplyInterestRate(uint256 supplyAmount) public view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`supplyAmount`|`uint256`|The amount of tokens supplied.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Interest that lenders are currently receiving when supplying a given amount of tokens to the pool.|


### totalSupplyInterestRate

Get interest rate w/ added supply assets.


```solidity
function totalSupplyInterestRate(uint256 assetSupply) public view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`assetSupply`|`uint256`|The amount of loan tokens supplied.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Interest that lenders are currently receiving when supplying a given amount of loan tokens to the pool.|


### totalAssetSupply

Get the total amount of loan tokens on supply.

*Wrapper for internal _totalAssetSupply function.*


```solidity
function totalAssetSupply() public view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The total amount of loan tokens on supply.|


### getMaxEscrowAmount

Compute the maximum deposit amount under current market conditions.

*maxEscrowAmount = liquidity * (100 - interestForDuration) / 100*


```solidity
function getMaxEscrowAmount(uint256 leverageAmount) public view returns (uint256 maxEscrowAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`leverageAmount`|`uint256`|The chosen multiplier with 18 decimals.|


### assetBalanceOf

Get loan token balance.

*Mathematical imperfection: depending on liquidity we might be able
to borrow more if utilization is below the kink level.*


```solidity
function assetBalanceOf(address _owner) public view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The user's balance of underlying token.|


### getEstimatedMarginDetails

Get margin information on a trade.


```solidity
function getEstimatedMarginDetails(
    uint256 leverageAmount,
    uint256 loanTokenSent,
    uint256 collateralTokenSent,
    address collateralTokenAddress
) public view returns (uint256 principal, uint256 collateral, uint256 interestRate);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`leverageAmount`|`uint256`|The multiple of exposure: 2x ... 5x. The leverage with 18 decimals.|
|`loanTokenSent`|`uint256`|The number of loan tokens provided by the user.|
|`collateralTokenSent`|`uint256`|The amount of collateral tokens provided by the user.|
|`collateralTokenAddress`|`address`|The token address of collateral.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`principal`|`uint256`|The principal, the collateral and the interestRate.|
|`collateral`|`uint256`||
|`interestRate`|`uint256`||


### getDepositAmountForBorrow

Calculate the deposit required to a given borrow.
The function for doing over-collateralized borrows against loan tokens
expects a minimum amount of collateral be sent to satisfy collateral
requirements of the loan, for borrow amount, interest rate, and
initial loan duration. To determine appropriate values to pass to this
function for a given loan, `getDepositAmountForBorrow` and
'getBorrowAmountForDeposit` are required.


```solidity
function getDepositAmountForBorrow(uint256 borrowAmount, uint256 initialLoanDuration, address collateralTokenAddress)
    public
    view
    returns (uint256 depositAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`borrowAmount`|`uint256`|The amount of borrow.|
|`initialLoanDuration`|`uint256`|The duration of the loan.|
|`collateralTokenAddress`|`address`|The token address of collateral.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`depositAmount`|`uint256`|The amount of deposit required.|


### getBorrowAmountForDeposit

initialMargin
isTorqueLoan
Some dust to compensate for rounding errors.

Calculate the borrow allowed for a given deposit.
The function for doing over-collateralized borrows against loan tokens
expects a minimum amount of collateral be sent to satisfy collateral
requirements of the loan, for borrow amount, interest rate, and
initial loan duration. To determine appropriate values to pass to this
function for a given loan, `getDepositAmountForBorrow` and
'getBorrowAmountForDeposit` are required.


```solidity
function getBorrowAmountForDeposit(uint256 depositAmount, uint256 initialLoanDuration, address collateralTokenAddress)
    public
    view
    returns (uint256 borrowAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`depositAmount`|`uint256`|The amount of deposit.|
|`initialLoanDuration`|`uint256`|The duration of the loan.|
|`collateralTokenAddress`|`address`|The token address of collateral.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`borrowAmount`|`uint256`|The amount of borrow allowed.|


### checkPriceDivergence

initialMargin,
isTorqueLoan

Check if entry price lies above a minimum


```solidity
function checkPriceDivergence(uint256 loanTokenSent, address collateralTokenAddress, uint256 minEntryPrice)
    public
    view;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanTokenSent`|`uint256`|The amount of deposit.|
|`collateralTokenAddress`|`address`|The token address of collateral.|
|`minEntryPrice`|`uint256`|Value of loan token in collateral|


### calculateSupplyInterestRate

Compute the next supply interest adjustment.

*See how many collateralTokens we would get if exchanging this amount of loan tokens to collateral tokens.*


```solidity
function calculateSupplyInterestRate(uint256 assetBorrow, uint256 assetSupply) public view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`assetBorrow`|`uint256`|The amount of loan tokens on debt.|
|`assetSupply`|`uint256`|The amount of loan tokens supplied.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The next supply interest adjustment.|


### _totalDeposit

Compute what the deposit is worth in loan tokens using the swap rate
used for loan size computation.


```solidity
function _totalDeposit(address collateralTokenAddress, uint256 collateralTokenSent, uint256 loanTokenSent)
    internal
    view
    returns (uint256 totalDeposit);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`collateralTokenAddress`|`address`|The token address of the collateral.|
|`collateralTokenSent`|`uint256`|The amount of collateral tokens provided by the user.|
|`loanTokenSent`|`uint256`|The number of loan tokens provided by the user.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`totalDeposit`|`uint256`|The value of the deposit in loan tokens.|


### _getAmountInRbtc

*Get the oracle rate from collateral -> loan*

*Compute the loan token amount with the oracle rate.*

*See how many collateralTokens we would get if exchanging this amount of loan tokens to collateral tokens.*

*Probably not the same due to the price difference.*

*returns amount of the asset converted to RBTC*


```solidity
function _getAmountInRbtc(address asset, uint256 amount) internal returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`asset`|`address`|the asset to be transferred|
|`amount`|`uint256`|the amount to be transferred|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|amount in RBTC|


### _getInterestRateAndBorrowAmount


```solidity
function _getInterestRateAndBorrowAmount(uint256 borrowAmount, uint256 assetSupply, uint256 initialLoanDuration)
    internal
    view
    returns (uint256 interestRate, uint256 interestInitialAmount, uint256 newBorrowAmount);
```

### _borrowOrTrade

newBorrowAmount = borrowAmount * 10^18 / (10^18 - interestRate * 7884000 * 10^18 / 31536000 / 10^20)
365 * 86400 * 10**20

Compute principal and collateral.


```solidity
function _borrowOrTrade(
    bytes32 loanId,
    uint256 withdrawAmount,
    uint256 initialMargin,
    address collateralTokenAddress,
    MarginTradeStructHelpers.SentAddresses memory sentAddresses,
    MarginTradeStructHelpers.SentAmounts memory sentAmounts,
    bytes memory loanDataBytes
) internal returns (uint256, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanId`|`bytes32`|The ID of the loan, 0 for a new loan.|
|`withdrawAmount`|`uint256`|The amount to be withdrawn (actually borrowed).|
|`initialMargin`|`uint256`|The initial margin with 18 decimals|
|`collateralTokenAddress`|`address`| The address of the token to be used as collateral. Cannot be the loan token address.|
|`sentAddresses`|`MarginTradeStructHelpers.SentAddresses`|The addresses to send tokens: lender, borrower, receiver and manager.|
|`sentAmounts`|`MarginTradeStructHelpers.SentAmounts`|The amounts to send to each address.|
|`loanDataBytes`|`bytes`|Additional loan data (not in use for token swaps).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The new principal and the new collateral. Principal is the complete borrowed amount (in loan tokens). Collateral is the complete position size (loan + margin) (in collateral tokens).|
|`<none>`|`uint256`||


### _avgBorrowInterestRate

newPrincipal (borrowed amount + fees)
The borrower.
The receiver = the borrower.

Compute the average borrow interest rate.

*Handle transfers prior to adding newPrincipal to loanTokenSent*

*Adding the loan token portion from the lender to loanTokenSent
(add the loan to the loan tokens sent from the user).
newPrincipal*

*withdrawAmount already sent to the borrower, so we aren't sending it to the protocol.
Default is false, but added just as to make sure.
newPrincipal, newCollateral*

*Setting not-first-trade flag to prevent binding to an affiliate existing users post factum.*

*REFACTOR: move to a general interface: ProtocolSettingsLike?*


```solidity
function _avgBorrowInterestRate(uint256 assetBorrow) internal view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`assetBorrow`|`uint256`|The amount of loan tokens on debt.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The average borrow interest rate.|


### _nextBorrowInterestRate

Compute the next borrow interest adjustment.


```solidity
function _nextBorrowInterestRate(uint256 borrowAmount) internal view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`borrowAmount`|`uint256`|The amount of tokens to borrow.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The next borrow interest adjustment.|


### _nextBorrowInterestRate2

Compute the next borrow interest adjustment under target-kink
level analysis.
The "kink" in the cDAI interest rate model reflects the utilization rate
at which the slope of the interest rate goes from "gradual" to "steep".
That is, below this utilization rate, the slope of the interest rate
curve is gradual. Above this utilization rate, it is steep.
Because of this dynamic between the interest rate curves before and
after the "kink", the "kink" can be thought of as the target utilization
rate. Above that rate, it quickly becomes expensive to borrow (and
commensurately lucrative for suppliers).


```solidity
function _nextBorrowInterestRate2(uint256 newBorrowAmount, uint256 assetSupply)
    internal
    view
    returns (uint256 nextRate);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newBorrowAmount`|`uint256`|The new amount of tokens to borrow.|
|`assetSupply`|`uint256`|The amount of loan tokens supplied.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`nextRate`|`uint256`|The next borrow interest adjustment.|


### _getMarginBorrowAmountAndRate

Compute the loan size and interest rate.

*Scale rate proportionally up to 100%
Will not overflow.*


```solidity
function _getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount)
    internal
    view
    returns (uint256 borrowAmount, uint256 interestRate);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`leverageAmount`|`uint256`|The leverage with 18 decimals.|
|`depositAmount`|`uint256`|The amount the user deposited in underlying loan tokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`borrowAmount`|`uint256`|The amount of tokens to borrow.|
|`interestRate`|`uint256`|The interest rate to pay on the position.|


### _checkPause

Make sure call is not paused.

*Mathematical imperfection. we calculate the interest rate based on
the loanSizeBeforeInterest, but the actual borrowed amount will be bigger.*

*Assumes that loan, collateral, and interest token are the same.*

*Used for internal verification if the called function is paused.
It throws an exception in case it's not.*


```solidity
function _checkPause() internal view;
```

### _adjustLoanSize

keccak256("iToken_FunctionPause")

Adjusts the loan size to make sure the expected exposure remains after prepaying the interest.

*loanSizeWithInterest = loanSizeBeforeInterest * 100 / (100 - interestForDuration)*


```solidity
function _adjustLoanSize(uint256 interestRate, uint256 maxDuration, uint256 loanSizeBeforeInterest)
    internal
    pure
    returns (uint256 loanSizeWithInterest);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`interestRate`|`uint256`|The interest rate to pay on the position.|
|`maxDuration`|`uint256`|The maximum duration of the position (until rollover).|
|`loanSizeBeforeInterest`|`uint256`|The loan size before interest is added.|


### _utilizationRate

Calculate the utilization rate.

*Utilization rate = assetBorrow / assetSupply*


```solidity
function _utilizationRate(uint256 assetBorrow, uint256 assetSupply) internal pure returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`assetBorrow`|`uint256`|The amount of loan tokens on debt.|
|`assetSupply`|`uint256`|The amount of loan tokens supplied.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The utilization rate.|


