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
- [marginTrade(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minEntryPrice, bytes loanDataBytes)](#margintrade)
- [marginTradeAffiliate(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minEntryPrice, address affiliateReferrer, bytes loanDataBytes)](#margintradeaffiliate)
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
- [checkPriceDivergence(uint256 loanTokenSent, address collateralTokenAddress, uint256 minEntryPrice)](#checkpricedivergence)
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

---    

> ### mint

Mint loan token wrapper.
Adds a check before calling low level _mintToken function.
The function retrieves the tokens from the message sender, so make sure
to first approve the loan token contract to access your funds. This is
done by calling approve(address spender, uint amount) on the ERC20
token contract, where spender is the loan token contract address and
amount is the amount to be deposited.
     *

```solidity
function mint(address receiver, uint256 depositAmount) external nonpayable nonReentrant 
returns(mintAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address | The account getting the minted tokens. | 
| depositAmount | uint256 | The amount of underlying tokens provided on the   loan. (Not the number of loan tokens to mint).      * | 

**Returns**

The amount of loan tokens minted.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function mint(address receiver, uint256 depositAmount)
        external
        nonReentrant
        returns (uint256 mintAmount)
    {
        return _mintToken(receiver, depositAmount);
    }
```
</details>

---    

> ### burn

Burn loan token wrapper.
Adds a pay-out transfer after calling low level _burnToken function.
In order to withdraw funds to the pool, call burn on the respective
loan token contract. This will burn your loan tokens and send you the
underlying token in exchange.
     *

```solidity
function burn(address receiver, uint256 burnAmount) external nonpayable nonReentrant 
returns(loanAmountPaid uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address | The account getting the minted tokens. | 
| burnAmount | uint256 | The amount of loan tokens to redeem.      * | 

**Returns**

The amount of underlying tokens payed to lender.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function burn(address receiver, uint256 burnAmount)
        external
        nonReentrant
        returns (uint256 loanAmountPaid)
    {
        loanAmountPaid = _burnToken(burnAmount);

        //this needs to be here and not in _burnTokens because of the WRBTC implementation
        if (loanAmountPaid != 0) {
            _safeTransfer(loanTokenAddress, receiver, loanAmountPaid, "5");
        }
    }
```
</details>

---    

> ### borrow

Borrow funds from the pool.
The underlying loan token may not be used as collateral.
     *

```solidity
function borrow(bytes32 loanId, uint256 withdrawAmount, uint256 initialLoanDuration, uint256 collateralTokenSent, address collateralTokenAddress, address borrower, address receiver, bytes ) public payable nonReentrant 
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan, 0 for a new loan. | 
| withdrawAmount | uint256 | The amount to be withdrawn (actually borrowed). | 
| initialLoanDuration | uint256 | The duration of the loan in seconds.   If the loan is not paid back until then, it'll need to be rolled over. | 
| collateralTokenSent | uint256 | The amount of collateral tokens provided by the user.   (150% of the withdrawn amount worth in collateral tokens). | 
| collateralTokenAddress | address | The address of the token to be used as   collateral. Cannot be the loan token address. | 
| borrower | address | The one paying for the collateral. | 
| receiver | address | The one receiving the withdrawn amount.      * | 
|  | bytes | loanId The ID of the loan, 0 for a new loan. | 

**Returns**

New principal and new collateral added to loan.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function borrow(
        bytes32 loanId, /// 0 if new loan.
        uint256 withdrawAmount,
        uint256 initialLoanDuration, /// Duration in seconds.
        uint256 collateralTokenSent, /// If 0, loanId must be provided; any rBTC sent must equal this value.
        address collateralTokenAddress, /// If address(0), this means rBTC and rBTC must be sent with the call or loanId must be provided.
        address borrower,
        address receiver,
        bytes memory /// loanDataBytes: arbitrary order data (for future use).
    )
        public
        payable
        nonReentrant /// Note: needs to be removed to allow flashloan use cases.
        returns (
            uint256,
            uint256 /// Returns new principal and new collateral added to loan.
        )
    {
        require(withdrawAmount != 0, "6");

        _checkPause();

        /// Temporary: limit transaction size.
        if (transactionLimit[collateralTokenAddress] > 0)
            require(collateralTokenSent <= transactionLimit[collateralTokenAddress]);

        require(
            (msg.value == 0 || msg.value == collateralTokenSent) &&
                (collateralTokenSent != 0 || loanId != 0) &&
                (collateralTokenAddress != address(0) || msg.value != 0 || loanId != 0) &&
                (loanId == 0 || msg.sender == borrower),
            "7"
        );

        /// @dev We have an issue regarding contract size code is too big. 1 of the solution is need to keep the error message 32 bytes length
        // Temporarily, we combine this require to the above, so can save the contract size code
        // require(collateralTokenSent != 0 || loanId != 0, "8");
        // require(collateralTokenAddress != address(0) || msg.value != 0 || loanId != 0, "9");

        /// @dev Ensure authorized use of existing loan.
        // require(loanId == 0 || msg.sender == borrower, "401 use of existing loan");

        /// @dev The condition is never met.
        ///   Address zero is not allowed by previous require validation.
        ///   This check is unneeded and was lowering the test coverage index.
        // if (collateralTokenAddress == address(0)) {
        // 	collateralTokenAddress = wrbtcTokenAddress;
        // }

        require(collateralTokenAddress != loanTokenAddress, "10");

        _settleInterest();

        address[4] memory sentAddresses;
        uint256[5] memory sentAmounts;

        sentAddresses[0] = address(this); /// The lender.
        sentAddresses[1] = borrower;
        sentAddresses[2] = receiver;
        /// sentAddresses[3] = address(0); /// The manager.

        sentAmounts[1] = withdrawAmount;

        /// interestRate, interestInitialAmount, borrowAmount (newBorrowAmount).
        (sentAmounts[0], sentAmounts[2], sentAmounts[1]) = _getInterestRateAndBorrowAmount(
            sentAmounts[1],
            _totalAssetSupply(0), /// Interest is settled above.
            initialLoanDuration
        );

        /// sentAmounts[3] = 0; /// loanTokenSent
        sentAmounts[4] = collateralTokenSent;

        return
            _borrowOrTrade(
                loanId,
                withdrawAmount,
                ProtocolSettingsLike(sovrynContractAddress).minInitialMargin(
                    loanParamsIds[
                        uint256(keccak256(abi.encodePacked(collateralTokenAddress, true)))
                    ]
                ),
                collateralTokenAddress,
                sentAddresses,
                sentAmounts,
                "" /// loanDataBytes
            );
    }
```
</details>

---    

> ### marginTrade

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

```solidity
function marginTrade(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minEntryPrice, bytes loanDataBytes) public payable nonReentrant 
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan, 0 for a new loan. | 
| leverageAmount | uint256 | The multiple of exposure: 2x ... 5x. The leverage with 18 decimals. | 
| loanTokenSent | uint256 | The number of loan tokens provided by the user. | 
| collateralTokenSent | uint256 | The amount of collateral tokens provided by the user. | 
| collateralTokenAddress | address | The token address of collateral. | 
| trader | address | The account that performs this trade. | 
| minEntryPrice | uint256 | Value of loan token in collateral. | 
| loanDataBytes | bytes | Additional loan data (not in use for token swaps).      * | 

**Returns**

New principal and new collateral added to trade.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function marginTrade(
        bytes32 loanId, /// 0 if new loan
        uint256 leverageAmount, /// Expected in x * 10**18 where x is the actual leverage (2, 3, 4, or 5).
        uint256 loanTokenSent,
        uint256 collateralTokenSent,
        address collateralTokenAddress,
        address trader,
        uint256 minEntryPrice, // value of loan token in collateral
        bytes memory loanDataBytes /// Arbitrary order data.
    )
        public
        payable
        nonReentrant /// Note: needs to be removed to allow flashloan use cases.
        returns (
            uint256,
            uint256 /// Returns new principal and new collateral added to trade.
        )
    {
        _checkPause();

        if (collateralTokenAddress == address(0)) {
            collateralTokenAddress = wrbtcTokenAddress;
        }

        require(collateralTokenAddress != loanTokenAddress, "11");

        /// @dev Ensure authorized use of existing loan.
        require(loanId == 0 || msg.sender == trader, "401 use of existing loan");

        /// Temporary: limit transaction size.
        if (transactionLimit[collateralTokenAddress] > 0)
            require(collateralTokenSent <= transactionLimit[collateralTokenAddress]);
        if (transactionLimit[loanTokenAddress] > 0)
            require(loanTokenSent <= transactionLimit[loanTokenAddress]);

        /// @dev Compute the worth of the total deposit in loan tokens.
        /// (loanTokenSent + convert(collateralTokenSent))
        /// No actual swap happening here.
        uint256 totalDeposit =
            _totalDeposit(collateralTokenAddress, collateralTokenSent, loanTokenSent);
        require(totalDeposit != 0, "12");

        address[4] memory sentAddresses;
        uint256[5] memory sentAmounts;

        sentAddresses[0] = address(this); /// The lender.
        sentAddresses[1] = trader;
        sentAddresses[2] = trader;
        /// sentAddresses[3] = address(0); /// The manager.

        /// sentAmounts[0] = 0; /// interestRate (found later).
        sentAmounts[1] = totalDeposit; /// Total amount of deposit.
        /// sentAmounts[2] = 0; /// interestInitialAmount (interest is calculated based on fixed-term loan).
        sentAmounts[3] = loanTokenSent;
        sentAmounts[4] = collateralTokenSent;

        _settleInterest();

        (sentAmounts[1], sentAmounts[0]) = _getMarginBorrowAmountAndRate( /// borrowAmount, interestRate
            leverageAmount,
            sentAmounts[1] /// depositAmount
        );

        checkPriceDivergence(
            loanTokenSent.add(sentAmounts[1]),
            collateralTokenAddress,
            minEntryPrice
        );
        require(
            _getAmountInRbtc(loanTokenAddress, sentAmounts[1]) > TINY_AMOUNT,
            "principal too small"
        );

        /// @dev Converting to initialMargin
        leverageAmount = SafeMath.div(10**38, leverageAmount);
        return
            _borrowOrTrade(
                loanId,
                0, /// withdrawAmount
                leverageAmount, //initial margin
                collateralTokenAddress,
                sentAddresses,
                sentAmounts,
                loanDataBytes
            );
    }
```
</details>

---    

> ### marginTradeAffiliate

Wrapper for marginTrade invoking setAffiliatesReferrer to track
  referral trade by affiliates program.
     *

```solidity
function marginTradeAffiliate(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minEntryPrice, address affiliateReferrer, bytes loanDataBytes) external payable
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan, 0 for a new loan. | 
| leverageAmount | uint256 | The multiple of exposure: 2x ... 5x. The leverage with 18 decimals. | 
| loanTokenSent | uint256 | The number of loan tokens provided by the user. | 
| collateralTokenSent | uint256 | The amount of collateral tokens provided by the user. | 
| collateralTokenAddress | address | The token address of collateral. | 
| trader | address | The account that performs this trade. | 
| minEntryPrice | uint256 | Value of loan token in collateral. | 
| affiliateReferrer | address | The address of the referrer from affiliates program. | 
| loanDataBytes | bytes | Additional loan data (not in use for token swaps).      * | 

**Returns**

New principal and new collateral added to trade.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function marginTradeAffiliate(
        bytes32 loanId, // 0 if new loan
        uint256 leverageAmount, // expected in x * 10**18 where x is the actual leverage (2, 3, 4, or 5)
        uint256 loanTokenSent,
        uint256 collateralTokenSent,
        address collateralTokenAddress,
        address trader,
        uint256 minEntryPrice, /// Value of loan token in collateral
        address affiliateReferrer, /// The user was brought by the affiliate (referrer).
        bytes calldata loanDataBytes /// Arbitrary order data.
    )
        external
        payable
        returns (
            uint256,
            uint256 /// Returns new principal and new collateral added to trade.
        )
    {
        if (affiliateReferrer != address(0))
            ProtocolAffiliatesInterface(sovrynContractAddress).setAffiliatesReferrer(
                trader,
                affiliateReferrer
            );
        return
            marginTrade(
                loanId,
                leverageAmount,
                loanTokenSent,
                collateralTokenSent,
                collateralTokenAddress,
                trader,
                minEntryPrice,
                loanDataBytes
            );
    }
```
</details>

---    

> ### withdrawRBTCTo

Withdraws RBTC from the contract by Multisig.

```solidity
function withdrawRBTCTo(address payable _receiverAddress, uint256 _amount) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiverAddress | address payable | The address where the rBTC has to be transferred. | 
| _amount | uint256 | The amount of rBTC to be transferred. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawRBTCTo(address payable _receiverAddress, uint256 _amount) external onlyOwner {
        require(_receiverAddress != address(0), "receiver address invalid");
        require(_amount > 0, "non-zero withdraw amount expected");
        require(_amount <= address(this).balance, "withdraw amount cannot exceed balance");
        _receiverAddress.transfer(_amount);
        emit WithdrawRBTCTo(_receiverAddress, _amount);
    }
```
</details>

---    

> ### transfer

Transfer tokens wrapper.
Sets token owner the msg.sender.
Sets maximun allowance uint256(-1) to ensure tokens are always transferred.
     *

```solidity
function transfer(address _to, uint256 _value) external nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _to | address | The recipient of the tokens. | 
| _value | uint256 | The amount of tokens sent. | 

**Returns**

Success true/false.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function transfer(address _to, uint256 _value) external returns (bool) {
        return _internalTransferFrom(msg.sender, _to, _value, uint256(-1));
    }
```
</details>

---    

> ### transferFrom

Moves `_value` loan tokens from `_from` to `_to` using the
allowance mechanism. Calls internal _internalTransferFrom function.
     *

```solidity
function transferFrom(address _from, address _to, uint256 _value) external nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _from | address |  | 
| _to | address |  | 
| _value | uint256 |  | 

**Returns**

A boolean value indicating whether the operation succeeded.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool) {
        return
            _internalTransferFrom(
                _from,
                _to,
                _value,
                //allowed[_from][msg.sender]
                ProtocolLike(sovrynContractAddress).isLoanPool(msg.sender)
                    ? uint256(-1)
                    : allowed[_from][msg.sender]
            );
    }
```
</details>

---    

> ### _internalTransferFrom

Transfer tokens, low level.
Checks allowance, updates sender and recipient balances
and updates checkpoints too.
     *

```solidity
function _internalTransferFrom(address _from, address _to, uint256 _value, uint256 _allowanceAmount) internal nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _from | address | The tokens' owner. | 
| _to | address | The recipient of the tokens. | 
| _value | uint256 | The amount of tokens sent. | 
| _allowanceAmount | uint256 | The amount of tokens allowed to transfer.      * | 

**Returns**

Success true/false.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _internalTransferFrom(
        address _from,
        address _to,
        uint256 _value,
        uint256 _allowanceAmount
    ) internal returns (bool) {
        if (_allowanceAmount != uint256(-1)) {
            allowed[_from][msg.sender] = _allowanceAmount.sub(_value, "14");
            /// @dev Allowance mapping update requires an event log
            emit AllowanceUpdate(_from, msg.sender, _allowanceAmount, allowed[_from][msg.sender]);
        }

        require(_to != address(0), "15");

        uint256 _balancesFrom = balances[_from];
        uint256 _balancesFromNew = _balancesFrom.sub(_value, "16");
        balances[_from] = _balancesFromNew;

        uint256 _balancesTo = balances[_to];
        uint256 _balancesToNew = _balancesTo.add(_value);
        balances[_to] = _balancesToNew;

        /// @dev Handle checkpoint update.
        uint256 _currentPrice = tokenPrice();

        //checkpoints are not being used by the smart contract logic itself, but just for external use (query the profit)
        //only update the checkpoints of a user if he's not depositing to / withdrawing from the lending pool
        if (_from != liquidityMiningAddress && _to != liquidityMiningAddress) {
            _updateCheckpoints(_from, _balancesFrom, _balancesFromNew, _currentPrice);
            _updateCheckpoints(_to, _balancesTo, _balancesToNew, _currentPrice);
        }

        emit Transfer(_from, _to, _value);
        return true;
    }
```
</details>

---    

> ### _updateCheckpoints

Update the user's checkpoint price and profit so far.
In this loan token contract, whenever some tokens are minted or burned,
the _updateCheckpoints() function is invoked to update the stats to
reflect the balance changes.
     *

```solidity
function _updateCheckpoints(address _user, uint256 _oldBalance, uint256 _newBalance, uint256 _currentPrice) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | The user address. | 
| _oldBalance | uint256 | The user's previous balance. | 
| _newBalance | uint256 | The user's updated balance. | 
| _currentPrice | uint256 | The current loan token price. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _updateCheckpoints(
        address _user,
        uint256 _oldBalance,
        uint256 _newBalance,
        uint256 _currentPrice
    ) internal {
        /// @dev keccak256("iToken_ProfitSoFar")
        bytes32 slot = keccak256(abi.encodePacked(_user, iToken_ProfitSoFar));

        int256 _currentProfit;
        if (_newBalance == 0) {
            _currentPrice = 0;
        } else if (_oldBalance != 0) {
            _currentProfit = _profitOf(slot, _oldBalance, _currentPrice, checkpointPrices_[_user]);
        }

        assembly {
            sstore(slot, _currentProfit)
        }

        checkpointPrices_[_user] = _currentPrice;
    }
```
</details>

---    

> ### profitOf

Wrapper for internal _profitOf low level function.

```solidity
function profitOf(address user) external view
returns(int256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The user address. | 

**Returns**

The profit of a user.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function profitOf(address user) external view returns (int256) {
        /// @dev keccak256("iToken_ProfitSoFar")
        bytes32 slot = keccak256(abi.encodePacked(user, iToken_ProfitSoFar));
        //TODO + LM balance
        return _profitOf(slot, balances[user], tokenPrice(), checkpointPrices_[user]);
    }
```
</details>

---    

> ### _profitOf

Profit calculation based on checkpoints of price.

```solidity
function _profitOf(bytes32 slot, uint256 _balance, uint256 _currentPrice, uint256 _checkpointPrice) internal view
returns(profitSoFar int256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| slot | bytes32 | The user slot. | 
| _balance | uint256 | The user balance. | 
| _currentPrice | uint256 | The current price of the loan token. | 
| _checkpointPrice | uint256 | The price of the loan token on checkpoint. | 

**Returns**

The profit of a user.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _profitOf(
        bytes32 slot,
        uint256 _balance,
        uint256 _currentPrice,
        uint256 _checkpointPrice
    ) internal view returns (int256 profitSoFar) {
        if (_checkpointPrice == 0) {
            return 0;
        }

        assembly {
            profitSoFar := sload(slot)
        }

        profitSoFar = int256(_currentPrice)
            .sub(int256(_checkpointPrice))
            .mul(int256(_balance))
            .div(sWEI_PRECISION)
            .add(profitSoFar);
    }
```
</details>

---    

> ### tokenPrice

Loan token price calculation considering unpaid interests.

```solidity
function tokenPrice() public view
returns(price uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function tokenPrice() public view returns (uint256 price) {
        uint256 interestUnPaid;
        if (lastSettleTime_ != uint88(block.timestamp)) {
            (, interestUnPaid) = _getAllInterest();
        }

        return _tokenPrice(_totalAssetSupply(interestUnPaid));
    }
```
</details>

---    

> ### checkpointPrice

Getter for the price checkpoint mapping.

```solidity
function checkpointPrice(address _user) public view
returns(price uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | The user account as the mapping index. | 

**Returns**

The price on the checkpoint for this user.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function checkpointPrice(address _user) public view returns (uint256 price) {
        return checkpointPrices_[_user];
    }
```
</details>

---    

> ### marketLiquidity

Get current liquidity.
A part of total funds supplied are borrowed. Liquidity = supply - borrow

```solidity
function marketLiquidity() public view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function marketLiquidity() public view returns (uint256) {
        uint256 totalSupply = _totalAssetSupply(0);
        uint256 totalBorrow = totalAssetBorrow();
        if (totalSupply > totalBorrow) {
            return totalSupply - totalBorrow;
        }
    }
```
</details>

---    

> ### avgBorrowInterestRate

Wrapper for average borrow interest.

```solidity
function avgBorrowInterestRate() public view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function avgBorrowInterestRate() public view returns (uint256) {
        return _avgBorrowInterestRate(totalAssetBorrow());
    }
```
</details>

---    

> ### borrowInterestRate

Get borrow interest rate.
The minimum rate the next base protocol borrower will receive
for variable-rate loans.

```solidity
function borrowInterestRate() public view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function borrowInterestRate() public view returns (uint256) {
        return _nextBorrowInterestRate(0);
    }
```
</details>

---    

> ### nextBorrowInterestRate

Public wrapper for internal call.

```solidity
function nextBorrowInterestRate(uint256 borrowAmount) public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| borrowAmount | uint256 | The amount of tokens to borrow. | 

**Returns**

The next borrow interest rate.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function nextBorrowInterestRate(uint256 borrowAmount) public view returns (uint256) {
        return _nextBorrowInterestRate(borrowAmount);
    }
```
</details>

---    

> ### supplyInterestRate

Get interest rate.
     *

```solidity
function supplyInterestRate() public view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function supplyInterestRate() public view returns (uint256) {
        return totalSupplyInterestRate(_totalAssetSupply(0));
    }
```
</details>

---    

> ### nextSupplyInterestRate

Get interest rate w/ added supply.

```solidity
function nextSupplyInterestRate(uint256 supplyAmount) public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| supplyAmount | uint256 | The amount of tokens supplied. | 

**Returns**

Interest that lenders are currently receiving when supplying
a given amount of tokens to the pool.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function nextSupplyInterestRate(uint256 supplyAmount) public view returns (uint256) {
        return totalSupplyInterestRate(_totalAssetSupply(0).add(supplyAmount));
    }
```
</details>

---    

> ### totalSupplyInterestRate

Get interest rate w/ added supply assets.

```solidity
function totalSupplyInterestRate(uint256 assetSupply) public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| assetSupply | uint256 | The amount of loan tokens supplied. | 

**Returns**

Interest that lenders are currently receiving when supplying
a given amount of loan tokens to the pool.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function totalSupplyInterestRate(uint256 assetSupply) public view returns (uint256) {
        uint256 assetBorrow = totalAssetBorrow();
        if (assetBorrow != 0) {
            return calculateSupplyInterestRate(assetBorrow, assetSupply);
        }
    }
```
</details>

---    

> ### totalAssetBorrow

Get the total amount of loan tokens on debt.
Calls protocol getTotalPrincipal function.
In the context of borrowing, principal is the initial size of a loan.
It can also be the amount still owed on a loan. If you take out a
$50,000 mortgage, for example, the principal is $50,000. If you pay off
$30,000, the principal balance now consists of the remaining $20,000.
     *

```solidity
function totalAssetBorrow() public view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function totalAssetBorrow() public view returns (uint256) {
        return
            ProtocolLike(sovrynContractAddress).getTotalPrincipal(address(this), loanTokenAddress);
    }
```
</details>

---    

> ### totalAssetSupply

Get the total amount of loan tokens on supply.

```solidity
function totalAssetSupply() public view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function totalAssetSupply() public view returns (uint256) {
        uint256 interestUnPaid;
        if (lastSettleTime_ != uint88(block.timestamp)) {
            (, interestUnPaid) = _getAllInterest();
        }

        return _totalAssetSupply(interestUnPaid);
    }
```
</details>

---    

> ### getMaxEscrowAmount

Compute the maximum deposit amount under current market conditions.

```solidity
function getMaxEscrowAmount(uint256 leverageAmount) public view
returns(maxEscrowAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| leverageAmount | uint256 | The chosen multiplier with 18 decimals. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getMaxEscrowAmount(uint256 leverageAmount)
        public
        view
        returns (uint256 maxEscrowAmount)
    {
        /**
         * @dev Mathematical imperfection: depending on liquidity we might be able
         * to borrow more if utilization is below the kink level.
         * */
        uint256 interestForDuration = maxScaleRate.mul(28).div(365);
        uint256 factor = uint256(10**20).sub(interestForDuration);
        uint256 maxLoanSize = marketLiquidity().mul(factor).div(10**20);
        maxEscrowAmount = maxLoanSize.mul(10**18).div(leverageAmount);
    }
```
</details>

---    

> ### assetBalanceOf

Get loan token balance.

```solidity
function assetBalanceOf(address _owner) public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _owner | address |  | 

**Returns**

The user's balance of underlying token.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function assetBalanceOf(address _owner) public view returns (uint256) {
        uint256 balanceOnLM = 0;
        if (liquidityMiningAddress != address(0)) {
            balanceOnLM = ILiquidityMining(liquidityMiningAddress).getUserPoolTokenBalance(
                address(this),
                _owner
            );
        }
        return balanceOf(_owner).add(balanceOnLM).mul(tokenPrice()).div(10**18);
    }
```
</details>

---    

> ### getEstimatedMarginDetails

Get margin information on a trade.
     *

```solidity
function getEstimatedMarginDetails(uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress) public view
returns(principal uint256, collateral uint256, interestRate uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| leverageAmount | uint256 | The multiple of exposure: 2x ... 5x. The leverage with 18 decimals. | 
| loanTokenSent | uint256 | The number of loan tokens provided by the user. | 
| collateralTokenSent | uint256 | The amount of collateral tokens provided by the user. | 
| collateralTokenAddress | address | The token address of collateral.      * | 

**Returns**

The principal, the collateral and the interestRate.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getEstimatedMarginDetails(
        uint256 leverageAmount,
        uint256 loanTokenSent,
        uint256 collateralTokenSent,
        address collateralTokenAddress // address(0) means ETH
    )
        public
        view
        returns (
            uint256 principal,
            uint256 collateral,
            uint256 interestRate
        )
    {
        if (collateralTokenAddress == address(0)) {
            collateralTokenAddress = wrbtcTokenAddress;
        }

        uint256 totalDeposit =
            _totalDeposit(collateralTokenAddress, collateralTokenSent, loanTokenSent);

        (principal, interestRate) = _getMarginBorrowAmountAndRate(leverageAmount, totalDeposit);
        if (principal > _underlyingBalance()) {
            return (0, 0, 0);
        }

        loanTokenSent = loanTokenSent.add(principal);

        collateral = ProtocolLike(sovrynContractAddress).getEstimatedMarginExposure(
            loanTokenAddress,
            collateralTokenAddress,
            loanTokenSent,
            collateralTokenSent,
            interestRate,
            principal
        );
    }
```
</details>

---    

> ### getDepositAmountForBorrow

Calculate the deposit required to a given borrow.
     * The function for doing over-collateralized borrows against loan tokens
expects a minimum amount of collateral be sent to satisfy collateral
requirements of the loan, for borrow amount, interest rate, and
initial loan duration. To determine appropriate values to pass to this
function for a given loan, `getDepositAmountForBorrow` and
'getBorrowAmountForDeposit` are required.
     *

```solidity
function getDepositAmountForBorrow(uint256 borrowAmount, uint256 initialLoanDuration, address collateralTokenAddress) public view
returns(depositAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| borrowAmount | uint256 | The amount of borrow. | 
| initialLoanDuration | uint256 | The duration of the loan. | 
| collateralTokenAddress | address | The token address of collateral.      * | 

**Returns**

The amount of deposit required.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getDepositAmountForBorrow(
        uint256 borrowAmount,
        uint256 initialLoanDuration, /// Duration in seconds.
        address collateralTokenAddress /// address(0) means rBTC
    ) public view returns (uint256 depositAmount) {
        if (borrowAmount != 0) {
            (, , uint256 newBorrowAmount) =
                _getInterestRateAndBorrowAmount(
                    borrowAmount,
                    totalAssetSupply(),
                    initialLoanDuration
                );

            if (newBorrowAmount <= _underlyingBalance()) {
                if (collateralTokenAddress == address(0))
                    collateralTokenAddress = wrbtcTokenAddress;
                bytes32 loanParamsId =
                    loanParamsIds[
                        uint256(keccak256(abi.encodePacked(collateralTokenAddress, true)))
                    ];
                return
                    ProtocolLike(sovrynContractAddress)
                        .getRequiredCollateral(
                        loanTokenAddress,
                        collateralTokenAddress,
                        newBorrowAmount,
                        ProtocolSettingsLike(sovrynContractAddress).minInitialMargin(loanParamsId), /// initialMargin
                        true /// isTorqueLoan
                    )
                        .add(10); /// Some dust to compensate for rounding errors.
            }
        }
    }
```
</details>

---    

> ### getBorrowAmountForDeposit

Calculate the borrow allowed for a given deposit.
     * The function for doing over-collateralized borrows against loan tokens
expects a minimum amount of collateral be sent to satisfy collateral
requirements of the loan, for borrow amount, interest rate, and
initial loan duration. To determine appropriate values to pass to this
function for a given loan, `getDepositAmountForBorrow` and
'getBorrowAmountForDeposit` are required.
     *

```solidity
function getBorrowAmountForDeposit(uint256 depositAmount, uint256 initialLoanDuration, address collateralTokenAddress) public view
returns(borrowAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| depositAmount | uint256 | The amount of deposit. | 
| initialLoanDuration | uint256 | The duration of the loan. | 
| collateralTokenAddress | address | The token address of collateral.      * | 

**Returns**

The amount of borrow allowed.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getBorrowAmountForDeposit(
        uint256 depositAmount,
        uint256 initialLoanDuration, /// Duration in seconds.
        address collateralTokenAddress /// address(0) means rBTC
    ) public view returns (uint256 borrowAmount) {
        if (depositAmount != 0) {
            if (collateralTokenAddress == address(0)) collateralTokenAddress = wrbtcTokenAddress;
            bytes32 loanParamsId =
                loanParamsIds[uint256(keccak256(abi.encodePacked(collateralTokenAddress, true)))];
            borrowAmount = ProtocolLike(sovrynContractAddress).getBorrowAmount(
                loanTokenAddress,
                collateralTokenAddress,
                depositAmount,
                ProtocolSettingsLike(sovrynContractAddress).minInitialMargin(loanParamsId), /// initialMargin,
                true /// isTorqueLoan
            );

            (, , borrowAmount) = _getInterestRateAndBorrowAmount(
                borrowAmount,
                totalAssetSupply(),
                initialLoanDuration
            );

            if (borrowAmount > _underlyingBalance()) {
                borrowAmount = 0;
            }
        }
    }
```
</details>

---    

> ### checkPriceDivergence

Check if entry price lies above a minimum
     *

```solidity
function checkPriceDivergence(uint256 loanTokenSent, address collateralTokenAddress, uint256 minEntryPrice) public view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanTokenSent | uint256 | The amount of deposit. | 
| collateralTokenAddress | address | The token address of collateral. | 
| minEntryPrice | uint256 | Value of loan token in collateral | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function checkPriceDivergence(
        uint256 loanTokenSent,
        address collateralTokenAddress,
        uint256 minEntryPrice
    ) public view {
        /// @dev See how many collateralTokens we would get if exchanging this amount of loan tokens to collateral tokens.
        uint256 collateralTokensReceived =
            ProtocolLike(sovrynContractAddress).getSwapExpectedReturn(
                loanTokenAddress,
                collateralTokenAddress,
                loanTokenSent
            );
        uint256 collateralTokenPrice =
            (collateralTokensReceived.mul(WEI_PRECISION)).div(loanTokenSent);
        require(collateralTokenPrice >= minEntryPrice, "entry price above the minimum");
    }
```
</details>

---    

> ### _mintToken

transfers the underlying asset from the msg.sender and mints tokens for the receiver

```solidity
function _mintToken(address receiver, uint256 depositAmount) internal nonpayable
returns(mintAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address | the address of the iToken receiver | 
| depositAmount | uint256 | the amount of underlying assets to be deposited | 

**Returns**

the amount of iTokens issued

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _mintToken(address receiver, uint256 depositAmount)
        internal
        returns (uint256 mintAmount)
    {
        uint256 currentPrice;

        //calculate amount to mint and transfer the underlying asset
        (mintAmount, currentPrice) = _prepareMinting(depositAmount);

        //compute balances needed for checkpoint update, considering that the user might have a pool token balance
        //on the liquidity mining contract
        uint256 balanceOnLM = 0;
        if (liquidityMiningAddress != address(0))
            balanceOnLM = ILiquidityMining(liquidityMiningAddress).getUserPoolTokenBalance(
                address(this),
                receiver
            );
        uint256 oldBalance = balances[receiver].add(balanceOnLM);
        uint256 newBalance = oldBalance.add(mintAmount);

        //mint the tokens to the receiver
        _mint(receiver, mintAmount, depositAmount, currentPrice);

        //update the checkpoint of the receiver
        _updateCheckpoints(receiver, oldBalance, newBalance, currentPrice);
    }
```
</details>

---    

> ### _prepareMinting

```solidity
function _prepareMinting(uint256 depositAmount) internal nonpayable
returns(mintAmount uint256, currentPrice uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| depositAmount | uint256 | the amount of the underyling asset deposited | 

**Returns**

the amount to be minted

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _prepareMinting(uint256 depositAmount)
        internal
        returns (uint256 mintAmount, uint256 currentPrice)
    {
        require(depositAmount != 0, "17");

        _settleInterest();

        currentPrice = _tokenPrice(_totalAssetSupply(0));
        mintAmount = depositAmount.mul(10**18).div(currentPrice);

        if (msg.value == 0) {
            _safeTransferFrom(loanTokenAddress, msg.sender, address(this), depositAmount, "18");
        } else {
            IWrbtc(wrbtcTokenAddress).deposit.value(depositAmount)();
        }
    }
```
</details>

---    

> ### _burnToken

A wrapper for AdvancedToken::_burn
     *

```solidity
function _burnToken(uint256 burnAmount) internal nonpayable
returns(loanAmountPaid uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| burnAmount | uint256 | The amount of loan tokens to redeem.      * | 

**Returns**

The amount of underlying tokens payed to lender.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _burnToken(uint256 burnAmount) internal returns (uint256 loanAmountPaid) {
        require(burnAmount != 0, "19");

        if (burnAmount > balanceOf(msg.sender)) {
            require(burnAmount == uint256(-1), "32");
            burnAmount = balanceOf(msg.sender);
        }

        _settleInterest();

        uint256 currentPrice = _tokenPrice(_totalAssetSupply(0));

        uint256 loanAmountOwed = burnAmount.mul(currentPrice).div(10**18);
        uint256 loanAmountAvailableInContract = _underlyingBalance();

        loanAmountPaid = loanAmountOwed;
        require(loanAmountPaid <= loanAmountAvailableInContract, "37");

        //compute balances needed for checkpoint update, considering that the user might have a pool token balance
        //on the liquidity mining contract
        uint256 balanceOnLM = 0;
        if (liquidityMiningAddress != address(0))
            balanceOnLM = ILiquidityMining(liquidityMiningAddress).getUserPoolTokenBalance(
                address(this),
                msg.sender
            );
        uint256 oldBalance = balances[msg.sender].add(balanceOnLM);
        uint256 newBalance = oldBalance.sub(burnAmount);

        _burn(msg.sender, burnAmount, loanAmountPaid, currentPrice);

        //this function does not only update the checkpoints but also the current profit of the user
        //all for external use only
        _updateCheckpoints(msg.sender, oldBalance, newBalance, currentPrice);
    }
```
</details>

---    

> ### _settleInterest

Withdraw loan token interests from protocol.
This function only operates once per block.
It asks protocol to withdraw accrued interests for the loan token.
     *

```solidity
function _settleInterest() internal nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _settleInterest() internal {
        uint88 ts = uint88(block.timestamp);
        if (lastSettleTime_ != ts) {
            ProtocolLike(sovrynContractAddress).withdrawAccruedInterest(loanTokenAddress);

            lastSettleTime_ = ts;
        }
    }
```
</details>

---    

> ### _totalDeposit

Compute what the deposit is worth in loan tokens using the swap rate
     used for loan size computation.
     *

```solidity
function _totalDeposit(address collateralTokenAddress, uint256 collateralTokenSent, uint256 loanTokenSent) internal view
returns(totalDeposit uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| collateralTokenAddress | address | The token address of the collateral. | 
| collateralTokenSent | uint256 | The amount of collateral tokens provided by the user. | 
| loanTokenSent | uint256 | The number of loan tokens provided by the user.      * | 

**Returns**

The value of the deposit in loan tokens.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _totalDeposit(
        address collateralTokenAddress,
        uint256 collateralTokenSent,
        uint256 loanTokenSent
    ) internal view returns (uint256 totalDeposit) {
        totalDeposit = loanTokenSent;

        if (collateralTokenSent != 0) {
            /// @dev Get the oracle rate from collateral -> loan
            (uint256 collateralToLoanRate, uint256 collateralToLoanPrecision) =
                FeedsLike(ProtocolLike(sovrynContractAddress).priceFeeds()).queryRate(
                    collateralTokenAddress,
                    loanTokenAddress
                );
            require(
                (collateralToLoanRate != 0) && (collateralToLoanPrecision != 0),
                "invalid rate collateral token"
            );

            /// @dev Compute the loan token amount with the oracle rate.
            uint256 loanTokenAmount =
                collateralTokenSent.mul(collateralToLoanRate).div(collateralToLoanPrecision);

            /// @dev See how many collateralTokens we would get if exchanging this amount of loan tokens to collateral tokens.
            uint256 collateralTokenAmount =
                ProtocolLike(sovrynContractAddress).getSwapExpectedReturn(
                    loanTokenAddress,
                    collateralTokenAddress,
                    loanTokenAmount
                );

            /// @dev Probably not the same due to the price difference.
            if (collateralTokenAmount != collateralTokenSent) {
                //scale the loan token amount accordingly, so we'll get the expected position size in the end
                loanTokenAmount = loanTokenAmount.mul(collateralTokenAmount).div(
                    collateralTokenSent
                );
            }

            totalDeposit = loanTokenAmount.add(totalDeposit);
        }
    }
```
</details>

---    

> ### _getAmountInRbtc

returns amount of the asset converted to RBTC

```solidity
function _getAmountInRbtc(address asset, uint256 amount) internal nonpayable
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
function _getAmountInRbtc(address asset, uint256 amount) internal returns (uint256) {
        (uint256 rbtcRate, uint256 rbtcPrecision) =
            FeedsLike(ProtocolLike(sovrynContractAddress).priceFeeds()).queryRate(
                asset,
                wrbtcTokenAddress
            );
        return amount.mul(rbtcRate).div(rbtcPrecision);
    }
```
</details>

---    

> ### _getInterestRateAndBorrowAmount

```solidity
function _getInterestRateAndBorrowAmount(uint256 borrowAmount, uint256 assetSupply, uint256 initialLoanDuration) internal view
returns(interestRate uint256, interestInitialAmount uint256, newBorrowAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| borrowAmount | uint256 |  | 
| assetSupply | uint256 |  | 
| initialLoanDuration | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getInterestRateAndBorrowAmount(
        uint256 borrowAmount,
        uint256 assetSupply,
        uint256 initialLoanDuration /// Duration in seconds.
    )
        internal
        view
        returns (
            uint256 interestRate,
            uint256 interestInitialAmount,
            uint256 newBorrowAmount
        )
    {
        interestRate = _nextBorrowInterestRate2(borrowAmount, assetSupply);

        /// newBorrowAmount = borrowAmount * 10^18 / (10^18 - interestRate * 7884000 * 10^18 / 31536000 / 10^20)
        newBorrowAmount = borrowAmount.mul(10**18).div(
            SafeMath.sub(
                10**18,
                interestRate.mul(initialLoanDuration).mul(10**18).div(31536000 * 10**20) /// 365 * 86400 * 10**20
            )
        );

        interestInitialAmount = newBorrowAmount.sub(borrowAmount);
    }
```
</details>

---    

> ### _borrowOrTrade

Compute principal and collateral.
     *

```solidity
function _borrowOrTrade(bytes32 loanId, uint256 withdrawAmount, uint256 initialMargin, address collateralTokenAddress, address[4] sentAddresses, uint256[5] sentAmounts, bytes loanDataBytes) internal nonpayable
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 | The ID of the loan, 0 for a new loan. | 
| withdrawAmount | uint256 | The amount to be withdrawn (actually borrowed). | 
| initialMargin | uint256 | The initial margin with 18 decimals | 
| collateralTokenAddress | address | The address of the token to be used as   collateral. Cannot be the loan token address. | 
| sentAddresses | address[4] | The addresses to send tokens: lender, borrower,   receiver and manager. | 
| sentAmounts | uint256[5] | The amounts to send to each address. | 
| loanDataBytes | bytes | Additional loan data (not in use for token swaps).      * | 

**Returns**

The new principal and the new collateral. Principal is the
  complete borrowed amount (in loan tokens). Collateral is the complete
  position size (loan + margin) (in collateral tokens).

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _borrowOrTrade(
        bytes32 loanId,
        uint256 withdrawAmount,
        uint256 initialMargin,
        address collateralTokenAddress,
        address[4] memory sentAddresses,
        uint256[5] memory sentAmounts,
        bytes memory loanDataBytes
    ) internal returns (uint256, uint256) {
        _checkPause();
        require(
            sentAmounts[1] <= _underlyingBalance() && /// newPrincipal (borrowed amount + fees)
                sentAddresses[1] != address(0), /// The borrower.
            "24"
        );

        if (sentAddresses[2] == address(0)) {
            sentAddresses[2] = sentAddresses[1]; /// The receiver = the borrower.
        }

        /// @dev Handle transfers prior to adding newPrincipal to loanTokenSent
        uint256 msgValue =
            _verifyTransfers(collateralTokenAddress, sentAddresses, sentAmounts, withdrawAmount);

        /**
         * @dev Adding the loan token portion from the lender to loanTokenSent
         * (add the loan to the loan tokens sent from the user).
         * */
        sentAmounts[3] = sentAmounts[3].add(sentAmounts[1]); /// newPrincipal

        if (withdrawAmount != 0) {
            /// @dev withdrawAmount already sent to the borrower, so we aren't sending it to the protocol.
            sentAmounts[3] = sentAmounts[3].sub(withdrawAmount);
        }

        bool withdrawAmountExist = false; /// Default is false, but added just as to make sure.

        if (withdrawAmount != 0) {
            withdrawAmountExist = true;
        }

        bytes32 loanParamsId =
            loanParamsIds[
                uint256(keccak256(abi.encodePacked(collateralTokenAddress, withdrawAmountExist)))
            ];

        (sentAmounts[1], sentAmounts[4]) = ProtocolLike(sovrynContractAddress)
            .borrowOrTradeFromPool
            .value(msgValue)( /// newPrincipal, newCollateral
            loanParamsId,
            loanId,
            withdrawAmountExist,
            initialMargin,
            sentAddresses,
            sentAmounts,
            loanDataBytes
        );
        require(sentAmounts[1] != 0, "25");

        /// @dev Setting not-first-trade flag to prevent binding to an affiliate existing users post factum.
        /// @dev REFACTOR: move to a general interface: ProtocolSettingsLike?
        ProtocolAffiliatesInterface(sovrynContractAddress).setUserNotFirstTradeFlag(
            sentAddresses[1]
        );

        return (sentAmounts[1], sentAmounts[4]); // newPrincipal, newCollateral
    }
```
</details>

---    

> ### _verifyTransfers

⤿ Overridden Implementation(s): [LoanTokenLogicWrbtc._verifyTransfers](LoanTokenLogicWrbtc.md#_verifytransfers)

.
     *

```solidity
function _verifyTransfers(address collateralTokenAddress, address[4] sentAddresses, uint256[5] sentAmounts, uint256 withdrawalAmount) internal nonpayable
returns(msgValue uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| collateralTokenAddress | address | The address of the token to be used as   collateral. Cannot be the loan token address. | 
| sentAddresses | address[4] | The addresses to send tokens: lender, borrower,   receiver and manager. | 
| sentAmounts | uint256[5] | The amounts to send to each address. | 
| withdrawalAmount | uint256 | The amount of tokens to withdraw.      * | 

**Returns**

msgValue The amount of rBTC sent minus the collateral on tokens.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _verifyTransfers(
        address collateralTokenAddress,
        address[4] memory sentAddresses,
        uint256[5] memory sentAmounts,
        uint256 withdrawalAmount
    ) internal returns (uint256 msgValue) {
        address _wrbtcToken = wrbtcTokenAddress;
        address _loanTokenAddress = loanTokenAddress;
        address receiver = sentAddresses[2];
        uint256 newPrincipal = sentAmounts[1];
        uint256 loanTokenSent = sentAmounts[3];
        uint256 collateralTokenSent = sentAmounts[4];

        require(_loanTokenAddress != collateralTokenAddress, "26");

        msgValue = msg.value;

        if (withdrawalAmount != 0) {
            /// withdrawOnOpen == true
            _safeTransfer(_loanTokenAddress, receiver, withdrawalAmount, "");
            if (newPrincipal > withdrawalAmount) {
                _safeTransfer(
                    _loanTokenAddress,
                    sovrynContractAddress,
                    newPrincipal - withdrawalAmount,
                    ""
                );
            }
        } else {
            _safeTransfer(_loanTokenAddress, sovrynContractAddress, newPrincipal, "27");
        }
        /**
         * This is a critical piece of code!
         * rBTC are supposed to be held by the contract itself, while other tokens are being transfered from the sender directly.
         * */
        if (collateralTokenSent != 0) {
            if (
                collateralTokenAddress == _wrbtcToken &&
                msgValue != 0 &&
                msgValue >= collateralTokenSent
            ) {
                IWrbtc(_wrbtcToken).deposit.value(collateralTokenSent)();
                _safeTransfer(
                    collateralTokenAddress,
                    sovrynContractAddress,
                    collateralTokenSent,
                    "28-a"
                );
                msgValue -= collateralTokenSent;
            } else {
                _safeTransferFrom(
                    collateralTokenAddress,
                    msg.sender,
                    sovrynContractAddress,
                    collateralTokenSent,
                    "28-b"
                );
            }
        }

        if (loanTokenSent != 0) {
            _safeTransferFrom(
                _loanTokenAddress,
                msg.sender,
                sovrynContractAddress,
                loanTokenSent,
                "29"
            );
        }
    }
```
</details>

---    

> ### _safeTransfer

Execute the ERC20 token's `transfer` function and reverts
upon failure the main purpose of this function is to prevent a non
standard ERC20 token from failing silently.
     *

```solidity
function _safeTransfer(address token, address to, uint256 amount, string errorMsg) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address | The ERC20 token address. | 
| to | address | ken The ERC20 token address. | 
| amount | uint256 | The transfer amount. | 
| errorMsg | string | The error message on failure. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _safeTransfer(
        address token,
        address to,
        uint256 amount,
        string memory errorMsg
    ) internal {
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(IERC20(token).transfer.selector, to, amount),
            errorMsg
        );
    }
```
</details>

---    

> ### _safeTransferFrom

Execute the ERC20 token's `transferFrom` function and reverts
upon failure the main purpose of this function is to prevent a non
standard ERC20 token from failing silently.
     *

```solidity
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

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount,
        string memory errorMsg
    ) internal {
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(IERC20(token).transferFrom.selector, from, to, amount),
            errorMsg
        );
    }
```
</details>

---    

> ### _callOptionalReturn

Imitate a Solidity high-level call (i.e. a regular function
call to a contract), relaxing the requirement on the return value:
the return value is optional (but if data is returned, it must not be
false).
     *

```solidity
function _callOptionalReturn(address token, bytes data, string errorMsg) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address | The token targeted by the call. | 
| data | bytes | The call data (encoded using abi.encode or one of its variants). | 
| errorMsg | string | The error message on failure. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _callOptionalReturn(
        address token,
        bytes memory data,
        string memory errorMsg
    ) internal {
        require(Address.isContract(token), "call to a non-contract address");
        (bool success, bytes memory returndata) = token.call(data);
        require(success, errorMsg);

        if (returndata.length != 0) {
            require(abi.decode(returndata, (bool)), errorMsg);
        }
    }
```
</details>

---    

> ### _underlyingBalance

Get the loan contract balance.

```solidity
function _underlyingBalance() internal view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _underlyingBalance() internal view returns (uint256) {
        return IERC20(loanTokenAddress).balanceOf(address(this));
    }
```
</details>

---    

> ### _tokenPrice

Compute the token price.

```solidity
function _tokenPrice(uint256 assetSupply) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| assetSupply | uint256 | The amount of loan tokens supplied. | 

**Returns**

The token price.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _tokenPrice(uint256 assetSupply) internal view returns (uint256) {
        uint256 totalTokenSupply = totalSupply_;

        return
            totalTokenSupply != 0 ? assetSupply.mul(10**18).div(totalTokenSupply) : initialPrice;
    }
```
</details>

---    

> ### _avgBorrowInterestRate

Compute the average borrow interest rate.

```solidity
function _avgBorrowInterestRate(uint256 assetBorrow) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| assetBorrow | uint256 | The amount of loan tokens on debt. | 

**Returns**

The average borrow interest rate.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _avgBorrowInterestRate(uint256 assetBorrow) internal view returns (uint256) {
        if (assetBorrow != 0) {
            (uint256 interestOwedPerDay, ) = _getAllInterest();
            return interestOwedPerDay.mul(10**20).mul(365).div(assetBorrow);
        }
    }
```
</details>

---    

> ### calculateSupplyInterestRate

Compute the next supply interest adjustment.

```solidity
function calculateSupplyInterestRate(uint256 assetBorrow, uint256 assetSupply) public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| assetBorrow | uint256 | The amount of loan tokens on debt. | 
| assetSupply | uint256 | The amount of loan tokens supplied. | 

**Returns**

The next supply interest adjustment.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function calculateSupplyInterestRate(uint256 assetBorrow, uint256 assetSupply)
        public
        view
        returns (uint256)
    {
        if (assetBorrow != 0 && assetSupply >= assetBorrow) {
            return
                _avgBorrowInterestRate(assetBorrow)
                    .mul(_utilizationRate(assetBorrow, assetSupply))
                    .mul(
                    SafeMath.sub(10**20, ProtocolLike(sovrynContractAddress).lendingFeePercent())
                )
                    .div(10**40);
        }
    }
```
</details>

---    

> ### _nextBorrowInterestRate

Compute the next borrow interest adjustment.

```solidity
function _nextBorrowInterestRate(uint256 borrowAmount) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| borrowAmount | uint256 | The amount of tokens to borrow. | 

**Returns**

The next borrow interest adjustment.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _nextBorrowInterestRate(uint256 borrowAmount) internal view returns (uint256) {
        uint256 interestUnPaid;
        if (borrowAmount != 0) {
            if (lastSettleTime_ != uint88(block.timestamp)) {
                (, interestUnPaid) = _getAllInterest();
            }

            uint256 balance = _underlyingBalance().add(interestUnPaid);
            if (borrowAmount > balance) {
                borrowAmount = balance;
            }
        }

        return _nextBorrowInterestRate2(borrowAmount, _totalAssetSupply(interestUnPaid));
    }
```
</details>

---    

> ### _nextBorrowInterestRate2

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

```solidity
function _nextBorrowInterestRate2(uint256 newBorrowAmount, uint256 assetSupply) internal view
returns(nextRate uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newBorrowAmount | uint256 | The new amount of tokens to borrow. | 
| assetSupply | uint256 | The amount of loan tokens supplied. | 

**Returns**

The next borrow interest adjustment.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _nextBorrowInterestRate2(uint256 newBorrowAmount, uint256 assetSupply)
        internal
        view
        returns (uint256 nextRate)
    {
        uint256 utilRate = _utilizationRate(totalAssetBorrow().add(newBorrowAmount), assetSupply);

        uint256 thisMinRate;
        uint256 thisRateAtKink;
        uint256 thisBaseRate = baseRate;
        uint256 thisRateMultiplier = rateMultiplier;
        uint256 thisTargetLevel = targetLevel;
        uint256 thisKinkLevel = kinkLevel;
        uint256 thisMaxScaleRate = maxScaleRate;

        if (utilRate < thisTargetLevel) {
            // target targetLevel utilization when utilization is under targetLevel
            utilRate = thisTargetLevel;
        }

        if (utilRate > thisKinkLevel) {
            /// @dev Scale rate proportionally up to 100%
            uint256 thisMaxRange = WEI_PERCENT_PRECISION - thisKinkLevel; /// Will not overflow.

            utilRate -= thisKinkLevel;
            if (utilRate > thisMaxRange) utilRate = thisMaxRange;

            // Modified the rate calculation as it is slightly exaggerated around kink level
            // thisRateAtKink = thisRateMultiplier.add(thisBaseRate).mul(thisKinkLevel).div(WEI_PERCENT_PRECISION);
            thisRateAtKink = thisKinkLevel.mul(thisRateMultiplier).div(WEI_PERCENT_PRECISION).add(
                thisBaseRate
            );

            nextRate = utilRate
                .mul(SafeMath.sub(thisMaxScaleRate, thisRateAtKink))
                .div(thisMaxRange)
                .add(thisRateAtKink);
        } else {
            nextRate = utilRate.mul(thisRateMultiplier).div(WEI_PERCENT_PRECISION).add(
                thisBaseRate
            );

            thisMinRate = thisBaseRate;
            thisRateAtKink = thisRateMultiplier.add(thisBaseRate);

            if (nextRate < thisMinRate) nextRate = thisMinRate;
            else if (nextRate > thisRateAtKink) nextRate = thisRateAtKink;
        }
    }
```
</details>

---    

> ### _getAllInterest

Get two kind of interests: owed per day and yet to be paid.

```solidity
function _getAllInterest() internal view
returns(interestOwedPerDay uint256, interestUnPaid uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getAllInterest()
        internal
        view
        returns (uint256 interestOwedPerDay, uint256 interestUnPaid)
    {
        /// interestPaid, interestPaidDate, interestOwedPerDay, interestUnPaid, interestFeePercent, principalTotal
        uint256 interestFeePercent;
        (, , interestOwedPerDay, interestUnPaid, interestFeePercent, ) = ProtocolLike(
            sovrynContractAddress
        )
            .getLenderInterestData(address(this), loanTokenAddress);

        interestUnPaid = interestUnPaid.mul(SafeMath.sub(10**20, interestFeePercent)).div(10**20);
    }
```
</details>

---    

> ### _getMarginBorrowAmountAndRate

Compute the loan size and interest rate.

```solidity
function _getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount) internal view
returns(borrowAmount uint256, interestRate uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| leverageAmount | uint256 | The leverage with 18 decimals. | 
| depositAmount | uint256 | The amount the user deposited in underlying loan tokens. | 

**Returns**

borrowAmount The amount of tokens to borrow.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount)
        internal
        view
        returns (uint256 borrowAmount, uint256 interestRate)
    {
        uint256 loanSizeBeforeInterest = depositAmount.mul(leverageAmount).div(10**18);
        /**
         * @dev Mathematical imperfection. we calculate the interest rate based on
         * the loanSizeBeforeInterest, but the actual borrowed amount will be bigger.
         * */
        interestRate = _nextBorrowInterestRate2(loanSizeBeforeInterest, _totalAssetSupply(0));
        /// @dev Assumes that loan, collateral, and interest token are the same.
        borrowAmount = _adjustLoanSize(interestRate, 28 days, loanSizeBeforeInterest);
    }
```
</details>

---    

> ### _totalAssetSupply

Compute the total amount of loan tokens on supply.

```solidity
function _totalAssetSupply(uint256 interestUnPaid) internal view
returns(assetSupply uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| interestUnPaid | uint256 | The interest not yet paid. | 

**Returns**

assetSupply The total amount of loan tokens on supply.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _totalAssetSupply(uint256 interestUnPaid)
        internal
        view
        returns (uint256 assetSupply)
    {
        if (totalSupply_ != 0) {
            uint256 assetsBalance = _flTotalAssetSupply; /// Temporary locked totalAssetSupply during a flash loan transaction.
            if (assetsBalance == 0) {
                assetsBalance = _underlyingBalance().add(totalAssetBorrow());
            }

            return assetsBalance.add(interestUnPaid);
        }
    }
```
</details>

---    

> ### checkPause

Check whether a function is paused.
     *

```solidity
function checkPause(string funcId) public view
returns(isPaused bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| funcId | string | The function ID, the selector.      * | 

**Returns**

isPaused Whether the function is paused: true or false.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function checkPause(string memory funcId) public view returns (bool isPaused) {
        bytes4 sig = bytes4(keccak256(abi.encodePacked(funcId)));
        bytes32 slot =
            keccak256(
                abi.encodePacked(
                    sig,
                    uint256(0xd46a704bc285dbd6ff5ad3863506260b1df02812f4f857c8cc852317a6ac64f2)
                )
            );
        assembly {
            isPaused := sload(slot)
        }
        return isPaused;
    }
```
</details>

---    

> ### _checkPause

Make sure call is not paused.

```solidity
function _checkPause() internal view
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _checkPause() internal view {
        /// keccak256("iToken_FunctionPause")
        bytes32 slot =
            keccak256(
                abi.encodePacked(
                    msg.sig,
                    uint256(0xd46a704bc285dbd6ff5ad3863506260b1df02812f4f857c8cc852317a6ac64f2)
                )
            );
        bool isPaused;
        assembly {
            isPaused := sload(slot)
        }
        require(!isPaused, "unauthorized");
    }
```
</details>

---    

> ### _adjustLoanSize

Adjusts the loan size to make sure the expected exposure remains after prepaying the interest.

```solidity
function _adjustLoanSize(uint256 interestRate, uint256 maxDuration, uint256 loanSizeBeforeInterest) internal pure
returns(loanSizeWithInterest uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| interestRate | uint256 | The interest rate to pay on the position. | 
| maxDuration | uint256 | The maximum duration of the position (until rollover). | 
| loanSizeBeforeInterest | uint256 | The loan size before interest is added. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _adjustLoanSize(
        uint256 interestRate,
        uint256 maxDuration,
        uint256 loanSizeBeforeInterest
    ) internal pure returns (uint256 loanSizeWithInterest) {
        uint256 interestForDuration = interestRate.mul(maxDuration).div(365 days);
        uint256 divisor = uint256(10**20).sub(interestForDuration);
        loanSizeWithInterest = loanSizeBeforeInterest.mul(10**20).div(divisor);
    }
```
</details>

---    

> ### _utilizationRate

Calculate the utilization rate.

```solidity
function _utilizationRate(uint256 assetBorrow, uint256 assetSupply) internal pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| assetBorrow | uint256 | The amount of loan tokens on debt. | 
| assetSupply | uint256 | The amount of loan tokens supplied. | 

**Returns**

The utilization rate.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _utilizationRate(uint256 assetBorrow, uint256 assetSupply)
        internal
        pure
        returns (uint256)
    {
        if (assetBorrow != 0 && assetSupply != 0) {
            /// U = total_borrow / total_supply
            return assetBorrow.mul(10**20).div(assetSupply);
        }
    }
```
</details>

---    

> ### setLiquidityMiningAddress

sets the liquidity mining contract address

```solidity
function setLiquidityMiningAddress(address LMAddress) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| LMAddress | address | the address of the liquidity mining contract | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setLiquidityMiningAddress(address LMAddress) external onlyOwner {
        liquidityMiningAddress = LMAddress;
    }
```
</details>

---    

> ### getLiquidityMiningAddress

We need separate getter for newly added storage variable

```solidity
function getLiquidityMiningAddress() public view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLiquidityMiningAddress() public view returns (address) {
        return liquidityMiningAddress;
    }
```
</details>

---    

> ### _mintWithLM

```solidity
function _mintWithLM(address receiver, uint256 depositAmount) internal nonpayable
returns(minted uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| depositAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _mintWithLM(address receiver, uint256 depositAmount)
        internal
        returns (uint256 minted)
    {
        //mint the tokens for the receiver
        minted = _mintToken(receiver, depositAmount);

        //transfer the tokens from the receiver to the LM address
        _internalTransferFrom(receiver, liquidityMiningAddress, minted, minted);

        //inform the LM mining contract
        ILiquidityMining(liquidityMiningAddress).onTokensDeposited(receiver, minted);
    }
```
</details>

---    

> ### _burnFromLM

```solidity
function _burnFromLM(uint256 burnAmount) internal nonpayable
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| burnAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _burnFromLM(uint256 burnAmount) internal returns (uint256) {
        uint256 balanceOnLM =
            ILiquidityMining(liquidityMiningAddress).getUserPoolTokenBalance(
                address(this),
                msg.sender
            );
        require(balanceOnLM.add(balanceOf(msg.sender)) >= burnAmount, "not enough balance");

        if (balanceOnLM > 0) {
            //withdraw pool tokens and LM rewards to the passed address
            if (balanceOnLM < burnAmount) {
                ILiquidityMining(liquidityMiningAddress).withdraw(
                    address(this),
                    balanceOnLM,
                    msg.sender
                );
            } else {
                ILiquidityMining(liquidityMiningAddress).withdraw(
                    address(this),
                    burnAmount,
                    msg.sender
                );
            }
        }
        //burn the tokens of the msg.sender
        return _burnToken(burnAmount);
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
