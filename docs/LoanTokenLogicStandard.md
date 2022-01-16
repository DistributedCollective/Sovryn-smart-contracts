# Loan Token Logic Standard contract. (LoanTokenLogicStandard.sol)

View Source: [contracts/connectors/loantoken/LoanTokenLogicStandard.sol](../contracts/connectors/loantoken/LoanTokenLogicStandard.sol)

**↗ Extends: [LoanTokenLogicStorage](LoanTokenLogicStorage.md)**
**↘ Derived Contracts: [LoanTokenLogicLM](LoanTokenLogicLM.md), [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)**

**LoanTokenLogicStandard**

This contract code comes from bZx. bZx is a protocol for tokenized margin
trading and lending https://bzx.network similar to the dYdX protocol.
 * Logic around loan tokens (iTokens) required to operate borrowing,
and margin trading financial processes.
 * The user provides funds to the lending pool using the mint function and
withdraws funds from the lending pool using the burn function. Mint and
burn refer to minting and burning loan tokens. Loan tokens represent a
share of the pool and gather interest over time.
 * Interest rates are determined by supply and demand. When a lender deposits
funds, the interest rates go down. When a trader borrows funds, the
interest rates go up. Fulcrum uses a simple linear interest rate formula
of the form y = mx + b. The interest rate starts at 1% when loans aren't
being utilized and scales up to 40% when all the funds in the loan pool
are being borrowed.
 * The borrow rate is determined at the time of the loan and represents the
net contribution of each borrower. Each borrower's interest contribution
is determined by the utilization rate of the pool and is netted against
all prior borrows. This means that the total amount of interest flowing
into the lending pool is not directly changed by lenders entering or
exiting the pool. The entrance or exit of lenders only impacts how the
interest payments are split up.
 * For example, if there are 2 lenders with equal holdings each earning
5% APR, but one of the lenders leave, then the remaining lender will earn
10% APR since the interest payments don't have to be split between two
individuals.

**Events**

```js
event WithdrawRBTCTo(address indexed to, uint256  amount);
```

## Functions

- [mint(address receiver, uint256 depositAmount)](#mint)
- [burn(address receiver, uint256 burnAmount)](#burn)
- [borrow(bytes32 loanId, uint256 withdrawAmount, uint256 initialLoanDuration, uint256 collateralTokenSent, address collateralTokenAddress, address borrower, address receiver, bytes )](#borrow)
- [marginTrade(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minReturn, bytes loanDataBytes)](#margintrade)
- [marginTradeAffiliate(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minReturn, address affiliateReferrer, bytes loanDataBytes)](#margintradeaffiliate)
- [withdrawRBTCTo(address payable _receiverAddress, uint256 _amount)](#withdrawrbtcto)
- [transfer(address _to, uint256 _value)](#transfer)
- [transferFrom(address _from, address _to, uint256 _value)](#transferfrom)
- [_internalTransferFrom(address _from, address _to, uint256 _value, uint256 _allowanceAmount)](#_internaltransferfrom)
- [_updateCheckpoints(address _user, uint256 _oldBalance, uint256 _newBalance, uint256 _currentPrice)](#_updatecheckpoints)
- [profitOf(address user)](#profitof)
- [_profitOf(bytes32 slot, uint256 _balance, uint256 _currentPrice, uint256 _checkpointPrice)](#_profitof)
- [tokenPrice()](#tokenprice)
- [checkpointPrice(address _user)](#checkpointprice)
- [marketLiquidity()](#marketliquidity)
- [avgBorrowInterestRate()](#avgborrowinterestrate)
- [borrowInterestRate()](#borrowinterestrate)
- [nextBorrowInterestRate(uint256 borrowAmount)](#nextborrowinterestrate)
- [supplyInterestRate()](#supplyinterestrate)
- [nextSupplyInterestRate(uint256 supplyAmount)](#nextsupplyinterestrate)
- [totalSupplyInterestRate(uint256 assetSupply)](#totalsupplyinterestrate)
- [totalAssetBorrow()](#totalassetborrow)
- [totalAssetSupply()](#totalassetsupply)
- [getMaxEscrowAmount(uint256 leverageAmount)](#getmaxescrowamount)
- [assetBalanceOf(address _owner)](#assetbalanceof)
- [getEstimatedMarginDetails(uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress)](#getestimatedmargindetails)
- [getDepositAmountForBorrow(uint256 borrowAmount, uint256 initialLoanDuration, address collateralTokenAddress)](#getdepositamountforborrow)
- [getBorrowAmountForDeposit(uint256 depositAmount, uint256 initialLoanDuration, address collateralTokenAddress)](#getborrowamountfordeposit)
- [checkPriceDivergence(uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, uint256 minReturn)](#checkpricedivergence)
- [_mintToken(address receiver, uint256 depositAmount)](#_minttoken)
- [_prepareMinting(uint256 depositAmount)](#_prepareminting)
- [_burnToken(uint256 burnAmount)](#_burntoken)
- [_settleInterest()](#_settleinterest)
- [_totalDeposit(address collateralTokenAddress, uint256 collateralTokenSent, uint256 loanTokenSent)](#_totaldeposit)
- [_getAmountInRbtc(address asset, uint256 amount)](#_getamountinrbtc)
- [_getInterestRateAndBorrowAmount(uint256 borrowAmount, uint256 assetSupply, uint256 initialLoanDuration)](#_getinterestrateandborrowamount)
- [_borrowOrTrade(bytes32 loanId, uint256 withdrawAmount, uint256 initialMargin, address collateralTokenAddress, address[4] sentAddresses, uint256[5] sentAmounts, bytes loanDataBytes)](#_borrowortrade)
- [_verifyTransfers(address collateralTokenAddress, address[4] sentAddresses, uint256[5] sentAmounts, uint256 withdrawalAmount)](#_verifytransfers)
- [_safeTransfer(address token, address to, uint256 amount, string errorMsg)](#_safetransfer)
- [_safeTransferFrom(address token, address from, address to, uint256 amount, string errorMsg)](#_safetransferfrom)
- [_callOptionalReturn(address token, bytes data, string errorMsg)](#_calloptionalreturn)
- [_underlyingBalance()](#_underlyingbalance)
- [_tokenPrice(uint256 assetSupply)](#_tokenprice)
- [_avgBorrowInterestRate(uint256 assetBorrow)](#_avgborrowinterestrate)
- [calculateSupplyInterestRate(uint256 assetBorrow, uint256 assetSupply)](#calculatesupplyinterestrate)
- [_nextBorrowInterestRate(uint256 borrowAmount)](#_nextborrowinterestrate)
- [_nextBorrowInterestRate2(uint256 newBorrowAmount, uint256 assetSupply)](#_nextborrowinterestrate2)
- [_getAllInterest()](#_getallinterest)
- [_getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount)](#_getmarginborrowamountandrate)
- [_totalAssetSupply(uint256 interestUnPaid)](#_totalassetsupply)
- [checkPause(string funcId)](#checkpause)
- [_checkPause()](#_checkpause)
- [_adjustLoanSize(uint256 interestRate, uint256 maxDuration, uint256 loanSizeBeforeInterest)](#_adjustloansize)
- [_utilizationRate(uint256 assetBorrow, uint256 assetSupply)](#_utilizationrate)
- [setLiquidityMiningAddress(address LMAddress)](#setliquidityminingaddress)
- [getLiquidityMiningAddress()](#getliquidityminingaddress)
- [_mintWithLM(address receiver, uint256 depositAmount)](#_mintwithlm)
- [_burnFromLM(uint256 burnAmount)](#_burnfromlm)

### mint

Mint loan token wrapper.
Adds a check before calling low level _mintToken function.
The function retrieves the tokens from the message sender, so make sure
to first approve the loan token contract to access your funds. This is
done by calling approve(address spender, uint amount) on the ERC20
token contract, where spender is the loan token contract address and
amount is the amount to be deposited.
	 *

```js
function mint(address receiver, uint256 depositAmount) external nonpayable nonReentrant 
returns(mintAmount uint256)
```

**Returns**

The amount of loan tokens minted.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address | The account getting the minted tokens. | 
| depositAmount | uint256 | The amount of underlying tokens provided on the
  loan. (Not the number of loan tokens to mint).
	 * | 

### burn

⤿ Overridden Implementation(s): [LoanTokenLogicLMMockup.burn](LoanTokenLogicLMMockup.md#burn)

Burn loan token wrapper.
Adds a pay-out transfer after calling low level _burnToken function.
In order to withdraw funds to the pool, call burn on the respective
loan token contract. This will burn your loan tokens and send you the
underlying token in exchange.
	 *

```js
function burn(address receiver, uint256 burnAmount) external nonpayable nonReentrant 
returns(loanAmountPaid uint256)
```

**Returns**

The amount of underlying tokens payed to lender.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address | The account getting the minted tokens. | 
| burnAmount | uint256 | The amount of loan tokens to redeem.
	 * | 

### borrow

Borrow funds from the pool.
The underlying loan token may not be used as collateral.
	 *

```js
function borrow(bytes32 loanId, uint256 withdrawAmount, uint256 initialLoanDuration, uint256 collateralTokenSent, address collateralTokenAddress, address borrower, address receiver, bytes ) public payable nonReentrant 
returns(uint256, uint256)
```

**Returns**

New principal and new collateral added to loan.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan, 0 for a new loan. | 
| withdrawAmount | uint256 | The amount to be withdrawn (actually borrowed). | 
| initialLoanDuration | uint256 | The duration of the loan in seconds.
  If the loan is not paid back until then, it'll need to be rolled over. | 
| collateralTokenSent | uint256 | The amount of collateral tokens provided by the user.
  (150% of the withdrawn amount worth in collateral tokens). | 
| collateralTokenAddress | address | The address of the token to be used as
  collateral. Cannot be the loan token address. | 
| borrower | address | The one paying for the collateral. | 
| receiver | address | The one receiving the withdrawn amount.
	 * | 
|  | bytes | loanId The ID of the loan, 0 for a new loan. | 

### marginTrade

Borrow and immediately get into a position.
	 * Trading on margin is used to increase an investor's buying power.
Margin is the amount of money required to open a position, while
leverage is the multiple of exposure to account equity.
	 * Leverage allows you to trade positions LARGER than the amount
of money in your trading account. Leverage is expressed as a ratio.
	 * When trading on margin, investors first deposit some token that then
serves as collateral for the loan, and then pay ongoing interest
payments on the money they borrow.
	 * Margin trading = taking a loan and swapping it:
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
	 *

```js
function marginTrade(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minReturn, bytes loanDataBytes) public payable nonReentrant 
returns(uint256, uint256)
```

**Returns**

New principal and new collateral added to trade.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan, 0 for a new loan. | 
| leverageAmount | uint256 | The multiple of exposure: 2x ... 5x. The leverage with 18 decimals. | 
| loanTokenSent | uint256 | The number of loan tokens provided by the user. | 
| collateralTokenSent | uint256 | The amount of collateral tokens provided by the user. | 
| collateralTokenAddress | address | The token address of collateral. | 
| trader | address | The account that performs this trade. | 
| minReturn | uint256 | Minimum amount (position size) in the collateral tokens | 
| loanDataBytes | bytes | Additional loan data (not in use for token swaps).
	 * | 

### marginTradeAffiliate

Wrapper for marginTrade invoking setAffiliatesReferrer to track
  referral trade by affiliates program.
	 *

```js
function marginTradeAffiliate(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minReturn, address affiliateReferrer, bytes loanDataBytes) external payable
returns(uint256, uint256)
```

**Returns**

New principal and new collateral added to trade.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan, 0 for a new loan. | 
| leverageAmount | uint256 | The multiple of exposure: 2x ... 5x. The leverage with 18 decimals. | 
| loanTokenSent | uint256 | The number of loan tokens provided by the user. | 
| collateralTokenSent | uint256 | The amount of collateral tokens provided by the user. | 
| collateralTokenAddress | address | The token address of collateral. | 
| trader | address | The account that performs this trade. | 
| minReturn | uint256 | Minimum position size in the collateral tokens | 
| affiliateReferrer | address | The address of the referrer from affiliates program. | 
| loanDataBytes | bytes | Additional loan data (not in use for token swaps).
	 * | 

### withdrawRBTCTo

Withdraws RBTC from the contract by Multisig.

```js
function withdrawRBTCTo(address payable _receiverAddress, uint256 _amount) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiverAddress | address payable | The address where the rBTC has to be transferred. | 
| _amount | uint256 | The amount of rBTC to be transferred. | 

### transfer

Transfer tokens wrapper.
Sets token owner the msg.sender.
Sets maximun allowance uint256(-1) to ensure tokens are always transferred.
	 *

```js
function transfer(address _to, uint256 _value) external nonpayable
returns(bool)
```

**Returns**

Success true/false.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _to | address | The recipient of the tokens. | 
| _value | uint256 | The amount of tokens sent. | 

### transferFrom

Moves `_value` loan tokens from `_from` to `_to` using the
allowance mechanism. Calls internal _internalTransferFrom function.
	 *

```js
function transferFrom(address _from, address _to, uint256 _value) external nonpayable
returns(bool)
```

**Returns**

A boolean value indicating whether the operation succeeded.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _from | address |  | 
| _to | address |  | 
| _value | uint256 |  | 

### _internalTransferFrom

Transfer tokens, low level.
Checks allowance, updates sender and recipient balances
and updates checkpoints too.
	 *

```js
function _internalTransferFrom(address _from, address _to, uint256 _value, uint256 _allowanceAmount) internal nonpayable
returns(bool)
```

**Returns**

Success true/false.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _from | address | The tokens' owner. | 
| _to | address | The recipient of the tokens. | 
| _value | uint256 | The amount of tokens sent. | 
| _allowanceAmount | uint256 | The amount of tokens allowed to transfer.
	 * | 

### _updateCheckpoints

Update the user's checkpoint price and profit so far.
In this loan token contract, whenever some tokens are minted or burned,
the _updateCheckpoints() function is invoked to update the stats to
reflect the balance changes.
	 *

```js
function _updateCheckpoints(address _user, uint256 _oldBalance, uint256 _newBalance, uint256 _currentPrice) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | The user address. | 
| _oldBalance | uint256 | The user's previous balance. | 
| _newBalance | uint256 | The user's updated balance. | 
| _currentPrice | uint256 | The current loan token price. | 

### profitOf

Wrapper for internal _profitOf low level function.

```js
function profitOf(address user) external view
returns(int256)
```

**Returns**

The profit of a user.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The user address. | 

### _profitOf

Profit calculation based on checkpoints of price.

```js
function _profitOf(bytes32 slot, uint256 _balance, uint256 _currentPrice, uint256 _checkpointPrice) internal view
returns(profitSoFar int256)
```

**Returns**

The profit of a user.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| slot | bytes32 | The user slot. | 
| _balance | uint256 | The user balance. | 
| _currentPrice | uint256 | The current price of the loan token. | 
| _checkpointPrice | uint256 | The price of the loan token on checkpoint. | 

### tokenPrice

Loan token price calculation considering unpaid interests.

```js
function tokenPrice() public view
returns(price uint256)
```

**Returns**

The loan token price.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### checkpointPrice

Getter for the price checkpoint mapping.

```js
function checkpointPrice(address _user) public view
returns(price uint256)
```

**Returns**

The price on the checkpoint for this user.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | The user account as the mapping index. | 

### marketLiquidity

Get current liquidity.
A part of total funds supplied are borrowed. Liquidity = supply - borrow

```js
function marketLiquidity() public view
returns(uint256)
```

**Returns**

The market liquidity.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### avgBorrowInterestRate

Wrapper for average borrow interest.

```js
function avgBorrowInterestRate() public view
returns(uint256)
```

**Returns**

The average borrow interest.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### borrowInterestRate

Get borrow interest rate.
The minimum rate the next base protocol borrower will receive
for variable-rate loans.

```js
function borrowInterestRate() public view
returns(uint256)
```

**Returns**

The borrow interest rate.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### nextBorrowInterestRate

Public wrapper for internal call.

```js
function nextBorrowInterestRate(uint256 borrowAmount) public view
returns(uint256)
```

**Returns**

The next borrow interest rate.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| borrowAmount | uint256 | The amount of tokens to borrow. | 

### supplyInterestRate

Get interest rate.
	 *

```js
function supplyInterestRate() public view
returns(uint256)
```

**Returns**

Interest that lenders are currently receiving when supplying to
the pool.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### nextSupplyInterestRate

Get interest rate w/ added supply.

```js
function nextSupplyInterestRate(uint256 supplyAmount) public view
returns(uint256)
```

**Returns**

Interest that lenders are currently receiving when supplying
a given amount of tokens to the pool.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| supplyAmount | uint256 | The amount of tokens supplied. | 

### totalSupplyInterestRate

Get interest rate w/ added supply assets.

```js
function totalSupplyInterestRate(uint256 assetSupply) public view
returns(uint256)
```

**Returns**

Interest that lenders are currently receiving when supplying
a given amount of loan tokens to the pool.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| assetSupply | uint256 | The amount of loan tokens supplied. | 

### totalAssetBorrow

Get the total amount of loan tokens on debt.
Calls protocol getTotalPrincipal function.
In the context of borrowing, principal is the initial size of a loan.
It can also be the amount still owed on a loan. If you take out a
$50,000 mortgage, for example, the principal is $50,000. If you pay off
$30,000, the principal balance now consists of the remaining $20,000.
	 *

```js
function totalAssetBorrow() public view
returns(uint256)
```

**Returns**

The total amount of loan tokens on debt.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### totalAssetSupply

Get the total amount of loan tokens on supply.

```js
function totalAssetSupply() public view
returns(uint256)
```

**Returns**

The total amount of loan tokens on supply.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### getMaxEscrowAmount

Compute the maximum deposit amount under current market conditions.

```js
function getMaxEscrowAmount(uint256 leverageAmount) public view
returns(maxEscrowAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| leverageAmount | uint256 | The chosen multiplier with 18 decimals. | 

### assetBalanceOf

Get loan token balance.

```js
function assetBalanceOf(address _owner) public view
returns(uint256)
```

**Returns**

The user's balance of underlying token.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _owner | address |  | 

### getEstimatedMarginDetails

Get margin information on a trade.
	 *

```js
function getEstimatedMarginDetails(uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress) public view
returns(principal uint256, collateral uint256, interestRate uint256)
```

**Returns**

The principal, the collateral and the interestRate.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| leverageAmount | uint256 | The multiple of exposure: 2x ... 5x. The leverage with 18 decimals. | 
| loanTokenSent | uint256 | The number of loan tokens provided by the user. | 
| collateralTokenSent | uint256 | The amount of collateral tokens provided by the user. | 
| collateralTokenAddress | address | The token address of collateral.
	 * | 

### getDepositAmountForBorrow

Calculate the deposit required to a given borrow.
	 * The function for doing over-collateralized borrows against loan tokens
expects a minimum amount of collateral be sent to satisfy collateral
requirements of the loan, for borrow amount, interest rate, and
initial loan duration. To determine appropriate values to pass to this
function for a given loan, `getDepositAmountForBorrow` and
'getBorrowAmountForDeposit` are required.
	 *

```js
function getDepositAmountForBorrow(uint256 borrowAmount, uint256 initialLoanDuration, address collateralTokenAddress) public view
returns(depositAmount uint256)
```

**Returns**

The amount of deposit required.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| borrowAmount | uint256 | The amount of borrow. | 
| initialLoanDuration | uint256 | The duration of the loan. | 
| collateralTokenAddress | address | The token address of collateral.
	 * | 

### getBorrowAmountForDeposit

Calculate the borrow allowed for a given deposit.
	 * The function for doing over-collateralized borrows against loan tokens
expects a minimum amount of collateral be sent to satisfy collateral
requirements of the loan, for borrow amount, interest rate, and
initial loan duration. To determine appropriate values to pass to this
function for a given loan, `getDepositAmountForBorrow` and
'getBorrowAmountForDeposit` are required.
	 *

```js
function getBorrowAmountForDeposit(uint256 depositAmount, uint256 initialLoanDuration, address collateralTokenAddress) public view
returns(borrowAmount uint256)
```

**Returns**

The amount of borrow allowed.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| depositAmount | uint256 | The amount of deposit. | 
| initialLoanDuration | uint256 | The duration of the loan. | 
| collateralTokenAddress | address | The token address of collateral.
	 * | 

### checkPriceDivergence

```js
function checkPriceDivergence(uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, uint256 minReturn) public view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| leverageAmount | uint256 |  | 
| loanTokenSent | uint256 |  | 
| collateralTokenSent | uint256 |  | 
| collateralTokenAddress | address |  | 
| minReturn | uint256 |  | 

### _mintToken

transfers the underlying asset from the msg.sender and mints tokens for the receiver

```js
function _mintToken(address receiver, uint256 depositAmount) internal nonpayable
returns(mintAmount uint256)
```

**Returns**

the amount of iTokens issued

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address | the address of the iToken receiver | 
| depositAmount | uint256 | the amount of underlying assets to be deposited | 

### _prepareMinting

```js
function _prepareMinting(uint256 depositAmount) internal nonpayable
returns(mintAmount uint256, currentPrice uint256)
```

**Returns**

the amount to be minted

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| depositAmount | uint256 | the amount of the underyling asset deposited | 

### _burnToken

A wrapper for AdvancedToken::_burn
	 *

```js
function _burnToken(uint256 burnAmount) internal nonpayable
returns(loanAmountPaid uint256)
```

**Returns**

The amount of underlying tokens payed to lender.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| burnAmount | uint256 | The amount of loan tokens to redeem.
	 * | 

### _settleInterest

Withdraw loan token interests from protocol.
This function only operates once per block.
It asks protocol to withdraw accrued interests for the loan token.
	 *

```js
function _settleInterest() internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### _totalDeposit

Compute what the deposit is worth in loan tokens using the swap rate
     used for loan size computation.
	 *

```js
function _totalDeposit(address collateralTokenAddress, uint256 collateralTokenSent, uint256 loanTokenSent) internal view
returns(totalDeposit uint256)
```

**Returns**

The value of the deposit in loan tokens.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| collateralTokenAddress | address | The token address of the collateral. | 
| collateralTokenSent | uint256 | The amount of collateral tokens provided by the user. | 
| loanTokenSent | uint256 | The number of loan tokens provided by the user.
	 * | 

### _getAmountInRbtc

returns amount of the asset converted to RBTC

```js
function _getAmountInRbtc(address asset, uint256 amount) internal nonpayable
returns(uint256)
```

**Returns**

amount in RBTC

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| asset | address | the asset to be transferred | 
| amount | uint256 | the amount to be transferred | 

### _getInterestRateAndBorrowAmount

```js
function _getInterestRateAndBorrowAmount(uint256 borrowAmount, uint256 assetSupply, uint256 initialLoanDuration) internal view
returns(interestRate uint256, interestInitialAmount uint256, newBorrowAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| borrowAmount | uint256 |  | 
| assetSupply | uint256 |  | 
| initialLoanDuration | uint256 |  | 

### _borrowOrTrade

Compute principal and collateral.
	 *

```js
function _borrowOrTrade(bytes32 loanId, uint256 withdrawAmount, uint256 initialMargin, address collateralTokenAddress, address[4] sentAddresses, uint256[5] sentAmounts, bytes loanDataBytes) internal nonpayable
returns(uint256, uint256)
```

**Returns**

The new principal and the new collateral. Principal is the
  complete borrowed amount (in loan tokens). Collateral is the complete
  position size (loan + margin) (in collateral tokens).

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan, 0 for a new loan. | 
| withdrawAmount | uint256 | The amount to be withdrawn (actually borrowed). | 
| initialMargin | uint256 | The initial margin with 18 decimals | 
| collateralTokenAddress | address | The address of the token to be used as
  collateral. Cannot be the loan token address. | 
| sentAddresses | address[4] | The addresses to send tokens: lender, borrower,
  receiver and manager. | 
| sentAmounts | uint256[5] | The amounts to send to each address. | 
| loanDataBytes | bytes | Additional loan data (not in use for token swaps).
	 * | 

### _verifyTransfers

⤿ Overridden Implementation(s): [LoanTokenLogicWrbtc._verifyTransfers](LoanTokenLogicWrbtc.md#_verifytransfers)

.
	 *

```js
function _verifyTransfers(address collateralTokenAddress, address[4] sentAddresses, uint256[5] sentAmounts, uint256 withdrawalAmount) internal nonpayable
returns(msgValue uint256)
```

**Returns**

msgValue The amount of rBTC sent minus the collateral on tokens.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| collateralTokenAddress | address | The address of the token to be used as
  collateral. Cannot be the loan token address. | 
| sentAddresses | address[4] | The addresses to send tokens: lender, borrower,
  receiver and manager. | 
| sentAmounts | uint256[5] | The amounts to send to each address. | 
| withdrawalAmount | uint256 | The amount of tokens to withdraw.
	 * | 

### _safeTransfer

Execute the ERC20 token's `transfer` function and reverts
upon failure the main purpose of this function is to prevent a non
standard ERC20 token from failing silently.
	 *

```js
function _safeTransfer(address token, address to, uint256 amount, string errorMsg) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address | The ERC20 token address. | 
| to | address | ken The ERC20 token address. | 
| amount | uint256 | The transfer amount. | 
| errorMsg | string | The error message on failure. | 

### _safeTransferFrom

Execute the ERC20 token's `transferFrom` function and reverts
upon failure the main purpose of this function is to prevent a non
standard ERC20 token from failing silently.
	 *

```js
function _safeTransferFrom(address token, address from, address to, uint256 amount, string errorMsg) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address | The ERC20 token address. | 
| from | address | The source address. | 
| to | address | ken The ERC20 token address. | 
| amount | uint256 | The transfer amount. | 
| errorMsg | string | The error message on failure. | 

### _callOptionalReturn

Imitate a Solidity high-level call (i.e. a regular function
call to a contract), relaxing the requirement on the return value:
the return value is optional (but if data is returned, it must not be
false).
	 *

```js
function _callOptionalReturn(address token, bytes data, string errorMsg) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address | The token targeted by the call. | 
| data | bytes | The call data (encoded using abi.encode or one of its variants). | 
| errorMsg | string | The error message on failure. | 

### _underlyingBalance

Get the loan contract balance.

```js
function _underlyingBalance() internal view
returns(uint256)
```

**Returns**

The balance of the loan token for this contract.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### _tokenPrice

Compute the token price.

```js
function _tokenPrice(uint256 assetSupply) internal view
returns(uint256)
```

**Returns**

The token price.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| assetSupply | uint256 | The amount of loan tokens supplied. | 

### _avgBorrowInterestRate

Compute the average borrow interest rate.

```js
function _avgBorrowInterestRate(uint256 assetBorrow) internal view
returns(uint256)
```

**Returns**

The average borrow interest rate.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| assetBorrow | uint256 | The amount of loan tokens on debt. | 

### calculateSupplyInterestRate

Compute the next supply interest adjustment.

```js
function calculateSupplyInterestRate(uint256 assetBorrow, uint256 assetSupply) public view
returns(uint256)
```

**Returns**

The next supply interest adjustment.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| assetBorrow | uint256 | The amount of loan tokens on debt. | 
| assetSupply | uint256 | The amount of loan tokens supplied. | 

### _nextBorrowInterestRate

Compute the next borrow interest adjustment.

```js
function _nextBorrowInterestRate(uint256 borrowAmount) internal view
returns(uint256)
```

**Returns**

The next borrow interest adjustment.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| borrowAmount | uint256 | The amount of tokens to borrow. | 

### _nextBorrowInterestRate2

Compute the next borrow interest adjustment under target-kink
level analysis.
	 * The "kink" in the cDAI interest rate model reflects the utilization rate
at which the slope of the interest rate goes from "gradual" to "steep".
That is, below this utilization rate, the slope of the interest rate
curve is gradual. Above this utilization rate, it is steep.
	 * Because of this dynamic between the interest rate curves before and
after the "kink", the "kink" can be thought of as the target utilization
rate. Above that rate, it quickly becomes expensive to borrow (and
commensurately lucrative for suppliers).
	 *

```js
function _nextBorrowInterestRate2(uint256 newBorrowAmount, uint256 assetSupply) internal view
returns(nextRate uint256)
```

**Returns**

The next borrow interest adjustment.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newBorrowAmount | uint256 | The new amount of tokens to borrow. | 
| assetSupply | uint256 | The amount of loan tokens supplied. | 

### _getAllInterest

Get two kind of interests: owed per day and yet to be paid.

```js
function _getAllInterest() internal view
returns(interestOwedPerDay uint256, interestUnPaid uint256)
```

**Returns**

interestOwedPerDay The interest per day.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### _getMarginBorrowAmountAndRate

Compute the loan size and interest rate.

```js
function _getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount) internal view
returns(borrowAmount uint256, interestRate uint256)
```

**Returns**

borrowAmount The amount of tokens to borrow.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| leverageAmount | uint256 | The leverage with 18 decimals. | 
| depositAmount | uint256 | The amount the user deposited in underlying loan tokens. | 

### _totalAssetSupply

Compute the total amount of loan tokens on supply.

```js
function _totalAssetSupply(uint256 interestUnPaid) internal view
returns(assetSupply uint256)
```

**Returns**

assetSupply The total amount of loan tokens on supply.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| interestUnPaid | uint256 | The interest not yet paid. | 

### checkPause

Check whether a function is paused.
	 *

```js
function checkPause(string funcId) public view
returns(isPaused bool)
```

**Returns**

isPaused Whether the function is paused: true or false.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| funcId | string | The function ID, the selector.
	 * | 

### _checkPause

Make sure call is not paused.

```js
function _checkPause() internal view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### _adjustLoanSize

Adjusts the loan size to make sure the expected exposure remains after prepaying the interest.

```js
function _adjustLoanSize(uint256 interestRate, uint256 maxDuration, uint256 loanSizeBeforeInterest) internal pure
returns(loanSizeWithInterest uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| interestRate | uint256 | The interest rate to pay on the position. | 
| maxDuration | uint256 | The maximum duration of the position (until rollover). | 
| loanSizeBeforeInterest | uint256 | The loan size before interest is added. | 

### _utilizationRate

Calculate the utilization rate.

```js
function _utilizationRate(uint256 assetBorrow, uint256 assetSupply) internal pure
returns(uint256)
```

**Returns**

The utilization rate.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| assetBorrow | uint256 | The amount of loan tokens on debt. | 
| assetSupply | uint256 | The amount of loan tokens supplied. | 

### setLiquidityMiningAddress

sets the liquidity mining contract address

```js
function setLiquidityMiningAddress(address LMAddress) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| LMAddress | address | the address of the liquidity mining contract | 

### getLiquidityMiningAddress

We need separate getter for newly added storage variable

```js
function getLiquidityMiningAddress() public view
returns(address)
```

**Returns**

liquidityMiningAddress

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### _mintWithLM

```js
function _mintWithLM(address receiver, uint256 depositAmount) internal nonpayable
returns(minted uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| depositAmount | uint256 |  | 

### _burnFromLM

```js
function _burnFromLM(uint256 burnAmount) internal nonpayable
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| burnAmount | uint256 |  | 

## Contracts

* [Address](Address.md)
* [Administered](Administered.md)
* [AdminRole](AdminRole.md)
* [AdvancedToken](AdvancedToken.md)
* [AdvancedTokenStorage](AdvancedTokenStorage.md)
* [Affiliates](Affiliates.md)
* [AffiliatesEvents](AffiliatesEvents.md)
* [ApprovalReceiver](ApprovalReceiver.md)
* [BlockMockUp](BlockMockUp.md)
* [BProPriceFeed](BProPriceFeed.md)
* [BProPriceFeedMockup](BProPriceFeedMockup.md)
* [Checkpoints](Checkpoints.md)
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
* [FeeSharingProxyMockup](FeeSharingProxyMockup.md)
* [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
* [FeesHelper](FeesHelper.md)
* [FlashLoanerTest](FlashLoanerTest.md)
* [GenericTokenSender](GenericTokenSender.md)
* [GovernorAlpha](GovernorAlpha.md)
* [GovernorAlphaMockup](GovernorAlphaMockup.md)
* [GovernorVault](GovernorVault.md)
* [IApproveAndCall](IApproveAndCall.md)
* [IChai](IChai.md)
* [IContractRegistry](IContractRegistry.md)
* [IConverterAMM](IConverterAMM.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IFeeSharingProxy](IFeeSharingProxy.md)
* [ILiquidityMining](ILiquidityMining.md)
* [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
* [ILoanPool](ILoanPool.md)
* [ILoanToken](ILoanToken.md)
* [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
* [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
* [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
* [ILoanTokenModules](ILoanTokenModules.md)
* [ILoanTokenModulesMock](ILoanTokenModulesMock.md)
* [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
* [ILockedSOV](ILockedSOV.md)
* [IMoCState](IMoCState.md)
* [ImplementationMockup](ImplementationMockup.md)
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
* [ITokenFlashLoanTest](ITokenFlashLoanTest.md)
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
* [LiquidityMiningMockup](LiquidityMiningMockup.md)
* [LiquidityMiningProxy](LiquidityMiningProxy.md)
* [LiquidityMiningStorage](LiquidityMiningStorage.md)
* [LiquidityPoolV1ConverterMockup](LiquidityPoolV1ConverterMockup.md)
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
* [LoanTokenLogicLMMockup](LoanTokenLogicLMMockup.md)
* [LoanTokenLogicLMV1Mockup](LoanTokenLogicLMV1Mockup.md)
* [LoanTokenLogicLMV2Mockup](LoanTokenLogicLMV2Mockup.md)
* [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
* [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
* [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
* [LoanTokenLogicTest](LoanTokenLogicTest.md)
* [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
* [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
* [LockedSOV](LockedSOV.md)
* [LockedSOVFailedMockup](LockedSOVFailedMockup.md)
* [LockedSOVMockup](LockedSOVMockup.md)
* [Medianizer](Medianizer.md)
* [MockAffiliates](MockAffiliates.md)
* [MockLoanTokenLogic](MockLoanTokenLogic.md)
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
* [PriceFeedRSKOracleMockup](PriceFeedRSKOracleMockup.md)
* [PriceFeeds](PriceFeeds.md)
* [PriceFeedsConstants](PriceFeedsConstants.md)
* [PriceFeedsMoC](PriceFeedsMoC.md)
* [PriceFeedsMoCMockup](PriceFeedsMoCMockup.md)
* [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
* [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
* [ProtocolLike](ProtocolLike.md)
* [ProtocolSettings](ProtocolSettings.md)
* [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
* [ProtocolSettingsLike](ProtocolSettingsLike.md)
* [ProtocolSettingsMockup](ProtocolSettingsMockup.md)
* [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
* [ProtocolTokenUser](ProtocolTokenUser.md)
* [Proxy](Proxy.md)
* [ProxyMockup](ProxyMockup.md)
* [RBTCWrapperProxyMockup](RBTCWrapperProxyMockup.md)
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
* [StakingMock](StakingMock.md)
* [StakingMockup](StakingMockup.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsMockUp](StakingRewardsMockUp.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingStorage](StakingStorage.md)
* [State](State.md)
* [StorageMockup](StorageMockup.md)
* [SVR](SVR.md)
* [SwapsEvents](SwapsEvents.md)
* [SwapsExternal](SwapsExternal.md)
* [SwapsImplLocal](SwapsImplLocal.md)
* [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
* [SwapsUser](SwapsUser.md)
* [TeamVesting](TeamVesting.md)
* [TestCoverage](TestCoverage.md)
* [TestLibraries](TestLibraries.md)
* [TestSovrynSwap](TestSovrynSwap.md)
* [TestToken](TestToken.md)
* [TestWrbtc](TestWrbtc.md)
* [Timelock](Timelock.md)
* [TimelockHarness](TimelockHarness.md)
* [TimelockInterface](TimelockInterface.md)
* [TimelockTest](TimelockTest.md)
* [TokenSender](TokenSender.md)
* [UpgradableProxy](UpgradableProxy.md)
* [USDTPriceFeed](USDTPriceFeed.md)
* [VaultController](VaultController.md)
* [Vesting](Vesting.md)
* [VestingCreator](VestingCreator.md)
* [VestingFactory](VestingFactory.md)
* [VestingLogic](VestingLogic.md)
* [VestingLogicMockup](VestingLogicMockup.md)
* [VestingRegistry](VestingRegistry.md)
* [VestingRegistry2](VestingRegistry2.md)
* [VestingRegistry3](VestingRegistry3.md)
* [VestingRegistryLogic](VestingRegistryLogic.md)
* [VestingRegistryLogicMockup](VestingRegistryLogicMockup.md)
* [VestingRegistryProxy](VestingRegistryProxy.md)
* [VestingRegistryStorage](VestingRegistryStorage.md)
* [VestingStorage](VestingStorage.md)
* [WeightedStaking](WeightedStaking.md)
* [WRBTC](WRBTC.md)
