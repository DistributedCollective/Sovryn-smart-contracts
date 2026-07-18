# LoanTokenLogicShared
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/LoanTokenLogicShared.sol)

**Inherits:**
[LoanTokenLogicStorage](/contracts/connectors/loantoken/LoanTokenLogicStorage.sol/contract.LoanTokenLogicStorage.md)

*This contract shares functions used by both LoanTokenLogicSplit and LoanTokenLogicStandard*


## Functions
### _updateCheckpoints

DON'T ADD VARIABLES HERE, PLEASE

Update the user's checkpoint price and profit so far.
In this loan token contract, whenever some tokens are minted or burned,
the _updateCheckpoints() function is invoked to update the stats to
reflect the balance changes.


```solidity
function _updateCheckpoints(address _user, uint256 _oldBalance, uint256 _newBalance, uint256 _currentPrice) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|The user address.|
|`_oldBalance`|`uint256`|The user's previous balance.|
|`_newBalance`|`uint256`|The user's updated balance.|
|`_currentPrice`|`uint256`|The current loan token price.|


### _internalTransferFrom

Transfer tokens, low level.
Checks allowance, updates sender and recipient balances
and updates checkpoints too.

*keccak256("iToken_ProfitSoFar")
INTERNAL FUNCTION*


```solidity
function _internalTransferFrom(address _from, address _to, uint256 _value, uint256 _allowanceAmount)
    internal
    returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_from`|`address`|The tokens' owner.|
|`_to`|`address`|The recipient of the tokens.|
|`_value`|`uint256`|The amount of tokens sent.|
|`_allowanceAmount`|`uint256`|The amount of tokens allowed to transfer.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|Success true/false.|


### _profitOf

Profit calculation based on checkpoints of price.

*Allowance mapping update requires an event log*

*Handle checkpoint update.*


```solidity
function _profitOf(bytes32 slot, uint256 _balance, uint256 _currentPrice, uint256 _checkpointPrice)
    internal
    view
    returns (int256 profitSoFar);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`slot`|`bytes32`|The user slot.|
|`_balance`|`uint256`|The user balance.|
|`_currentPrice`|`uint256`|The current price of the loan token.|
|`_checkpointPrice`|`uint256`|The price of the loan token on checkpoint.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`profitSoFar`|`int256`|The profit of a user.|


### tokenPrice

Loan token price calculation considering unpaid interests.


```solidity
function tokenPrice() public view returns (uint256 price);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`price`|`uint256`|The loan token price.|


### totalAssetBorrow

Get the total amount of loan tokens on debt.
Calls protocol getTotalPrincipal function.
In the context of borrowing, principal is the initial size of a loan.
It can also be the amount still owed on a loan. If you take out a
$50,000 mortgage, for example, the principal is $50,000. If you pay off
$30,000, the principal balance now consists of the remaining $20,000.


```solidity
function totalAssetBorrow() public view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The total amount of loan tokens on debt.|


### _verifyTransfers

INTERNAL FUNCTION

.


```solidity
function _verifyTransfers(
    address collateralTokenAddress,
    MarginTradeStructHelpers.SentAddresses memory sentAddresses,
    MarginTradeStructHelpers.SentAmounts memory sentAmounts,
    uint256 withdrawalAmount
) internal returns (uint256 msgValue);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`collateralTokenAddress`|`address`|The address of the token to be used as collateral. Cannot be the loan token address.|
|`sentAddresses`|`MarginTradeStructHelpers.SentAddresses`|The addresses to send tokens: lender, borrower, receiver and manager.|
|`sentAmounts`|`MarginTradeStructHelpers.SentAmounts`|The amounts to send to each address.|
|`withdrawalAmount`|`uint256`|The amount of tokens to withdraw.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`msgValue`|`uint256`|The amount of rBTC sent minus the collateral on tokens.|


### _settleInterest

withdrawOnOpen == true
This is a critical piece of code!
rBTC are supposed to be held by the contract itself, while other tokens are being transfered from the sender directly.

Withdraw loan token interests from protocol.
This function only operates once per block.
It asks protocol to withdraw accrued interests for the loan token.

*Internal sync required on every loan trade before starting.*


```solidity
function _settleInterest() internal;
```

### _callOptionalReturn

Imitate a Solidity high-level call (i.e. a regular function
call to a contract), relaxing the requirement on the return value:
the return value is optional (but if data is returned, it must not be
false).


```solidity
function _callOptionalReturn(address token, bytes memory data, string memory errorMsg) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|The token targeted by the call.|
|`data`|`bytes`|The call data (encoded using abi.encode or one of its variants).|
|`errorMsg`|`string`|The error message on failure.|


### _safeTransfer

Execute the ERC20 token's `transfer` function and reverts
upon failure the main purpose of this function is to prevent a non
standard ERC20 token from failing silently.

*Wrappers around ERC20 operations that throw on failure (when the
token contract returns false). Tokens that return no value (and instead
revert or throw on failure) are also supported, non-reverting calls are
assumed to be successful.*


```solidity
function _safeTransfer(address token, address to, uint256 amount, string memory errorMsg) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|The ERC20 token address.|
|`to`|`address`|The target address.|
|`amount`|`uint256`|The transfer amount.|
|`errorMsg`|`string`|The error message on failure.|


### _safeTransferFrom

Execute the ERC20 token's `transferFrom` function and reverts
upon failure the main purpose of this function is to prevent a non
standard ERC20 token from failing silently.

*Wrappers around ERC20 operations that throw on failure (when the
token contract returns false). Tokens that return no value (and instead
revert or throw on failure) are also supported, non-reverting calls are
assumed to be successful.*


```solidity
function _safeTransferFrom(address token, address from, address to, uint256 amount, string memory errorMsg) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|The ERC20 token address.|
|`from`|`address`|The source address.|
|`to`|`address`|The target address.|
|`amount`|`uint256`|The transfer amount.|
|`errorMsg`|`string`|The error message on failure.|


### _tokenPrice

Internal view function

Compute the token price.


```solidity
function _tokenPrice(uint256 assetSupply) internal view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`assetSupply`|`uint256`|The amount of loan tokens supplied.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The token price.|


### _getAllInterest

Get two kind of interests: owed per day and yet to be paid.


```solidity
function _getAllInterest() internal view returns (uint256 interestOwedPerDay, uint256 interestUnPaid);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`interestOwedPerDay`|`uint256`|The interest per day.|
|`interestUnPaid`|`uint256`|The interest not yet paid.|


### _totalAssetSupply

interestPaid, interestPaidDate, interestOwedPerDay, interestUnPaid, interestFeePercent, principalTotal

Compute the total amount of loan tokens on supply.


```solidity
function _totalAssetSupply(uint256 interestUnPaid) internal view returns (uint256 assetSupply);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`interestUnPaid`|`uint256`|The interest not yet paid.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`assetSupply`|`uint256`|The total amount of loan tokens on supply.|


### _underlyingBalance

Temporary locked totalAssetSupply during a flash loan transaction.

Get the loan contract balance.


```solidity
function _underlyingBalance() internal view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The balance of the loan token for this contract.|


