# ILoanTokenModules.sol

View Source: [contracts/interfaces/ILoanTokenModules.sol](../contracts/interfaces/ILoanTokenModules.sol)

**ILoanTokenModules**

## Structs
### LoanParams

```js
struct LoanParams {
 bytes32 id,
 bool active,
 address owner,
 address loanToken,
 address collateralToken,
 uint256 minInitialMargin,
 uint256 maintenanceMargin,
 uint256 maxLoanTerm
}
```

**Events**

```js
event Transfer(address indexed from, address indexed to, uint256  value);
event Approval(address indexed owner, address indexed spender, uint256  value);
event AllowanceUpdate(address indexed owner, address indexed spender, uint256  valueBefore, uint256  valueAfter);
event Mint(address indexed minter, uint256  tokenAmount, uint256  assetAmount, uint256  price);
event Burn(address indexed burner, uint256  tokenAmount, uint256  assetAmount, uint256  price);
event FlashBorrow(address  borrower, address  target, address  loanToken, uint256  loanAmount);
event SetTransactionLimits(address[]  addresses, uint256[]  limits);
event WithdrawRBTCTo(address indexed to, uint256  amount);
event ToggledFunctionPaused(string  functionId, bool  prevFlag, bool  newFlag);
```

## Functions

- [setAdmin(address _admin)](#setadmin)
- [setPauser(address _pauser)](#setpauser)
- [setupLoanParams(struct ILoanTokenModules.LoanParams[] loanParamsList, bool areTorqueLoans)](#setuploanparams)
- [disableLoanParams(address[] collateralTokens, bool[] isTorqueLoans)](#disableloanparams)
- [setDemandCurve(uint256 _baseRate, uint256 _rateMultiplier, uint256 _lowUtilBaseRate, uint256 _lowUtilRateMultiplier, uint256 _targetLevel, uint256 _kinkLevel, uint256 _maxScaleRate)](#setdemandcurve)
- [toggleFunctionPause(string funcId, bool isPaused)](#togglefunctionpause)
- [setTransactionLimits(address[] addresses, uint256[] limits)](#settransactionlimits)
- [changeLoanTokenNameAndSymbol(string _name, string _symbol)](#changeloantokennameandsymbol)
- [marginTrade(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minEntryPrice, bytes loanDataBytes)](#margintrade)
- [marginTradeAffiliate(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minEntryPrice, address affiliateReferrer, bytes loanDataBytes)](#margintradeaffiliate)
- [borrowInterestRate()](#borrowinterestrate)
- [mint(address receiver, uint256 depositAmount)](#mint)
- [burn(address receiver, uint256 burnAmount)](#burn)
- [checkPause(string funcId)](#checkpause)
- [nextBorrowInterestRate(uint256 borrowAmount)](#nextborrowinterestrate)
- [totalAssetBorrow()](#totalassetborrow)
- [totalAssetSupply()](#totalassetsupply)
- [borrow(bytes32 loanId, uint256 withdrawAmount, uint256 initialLoanDuration, uint256 collateralTokenSent, address collateralTokenAddress, address borrower, address receiver, bytes )](#borrow)
- [transfer(address _to, uint256 _value)](#transfer)
- [transferFrom(address _from, address _to, uint256 _value)](#transferfrom)
- [setLiquidityMiningAddress(address LMAddress)](#setliquidityminingaddress)
- [getLiquidityMiningAddress()](#getliquidityminingaddress)
- [getEstimatedMarginDetails(uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress)](#getestimatedmargindetails)
- [getDepositAmountForBorrow(uint256 borrowAmount, uint256 initialLoanDuration, address collateralTokenAddress)](#getdepositamountforborrow)
- [getBorrowAmountForDeposit(uint256 depositAmount, uint256 initialLoanDuration, address collateralTokenAddress)](#getborrowamountfordeposit)
- [checkPriceDivergence(uint256 loanTokenSent, address collateralTokenAddress, uint256 minEntryPrice)](#checkpricedivergence)
- [getMaxEscrowAmount(uint256 leverageAmount)](#getmaxescrowamount)
- [checkpointPrice(address _user)](#checkpointprice)
- [assetBalanceOf(address _owner)](#assetbalanceof)
- [profitOf(address user)](#profitof)
- [tokenPrice()](#tokenprice)
- [avgBorrowInterestRate()](#avgborrowinterestrate)
- [supplyInterestRate()](#supplyinterestrate)
- [nextSupplyInterestRate(uint256 supplyAmount)](#nextsupplyinterestrate)
- [totalSupplyInterestRate(uint256 assetSupply)](#totalsupplyinterestrate)
- [loanTokenAddress()](#loantokenaddress)
- [getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount)](#getmarginborrowamountandrate)
- [withdrawRBTCTo(address payable _receiverAddress, uint256 _amount)](#withdrawrbtcto)
- [initialPrice()](#initialprice)
- [mint(address receiver, uint256 depositAmount, bool useLM)](#mint)
- [burn(address receiver, uint256 burnAmount, bool useLM)](#burn)
- [mintWithBTC(address receiver, bool useLM)](#mintwithbtc)
- [burnToBTC(address receiver, uint256 burnAmount, bool useLM)](#burntobtc)
- [pauser()](#pauser)
- [liquidityMiningAddress()](#liquidityminingaddress)
- [name()](#name)
- [symbol()](#symbol)
- [approve(address _spender, uint256 _value)](#approve)
- [allowance(address _owner, address _spender)](#allowance)
- [balanceOf(address _owner)](#balanceof)
- [totalSupply()](#totalsupply)

---    

> ### setAdmin

```solidity
function setAdmin(address _admin) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _admin | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setAdmin(address _admin) external;
```
</details>

---    

> ### setPauser

```solidity
function setPauser(address _pauser) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _pauser | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setPauser(address _pauser) external;
```
</details>

---    

> ### setupLoanParams

```solidity
function setupLoanParams(struct ILoanTokenModules.LoanParams[] loanParamsList, bool areTorqueLoans) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsList | struct ILoanTokenModules.LoanParams[] |  | 
| areTorqueLoans | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setupLoanParams(LoanParams[] calldata loanParamsList, bool areTorqueLoans) external;
```
</details>

---    

> ### disableLoanParams

```solidity
function disableLoanParams(address[] collateralTokens, bool[] isTorqueLoans) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| collateralTokens | address[] |  | 
| isTorqueLoans | bool[] |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function disableLoanParams(address[] calldata collateralTokens, bool[] calldata isTorqueLoans)
        external;
```
</details>

---    

> ### setDemandCurve

```solidity
function setDemandCurve(uint256 _baseRate, uint256 _rateMultiplier, uint256 _lowUtilBaseRate, uint256 _lowUtilRateMultiplier, uint256 _targetLevel, uint256 _kinkLevel, uint256 _maxScaleRate) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _baseRate | uint256 |  | 
| _rateMultiplier | uint256 |  | 
| _lowUtilBaseRate | uint256 |  | 
| _lowUtilRateMultiplier | uint256 |  | 
| _targetLevel | uint256 |  | 
| _kinkLevel | uint256 |  | 
| _maxScaleRate | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setDemandCurve(
        uint256 _baseRate,
        uint256 _rateMultiplier,
        uint256 _lowUtilBaseRate,
        uint256 _lowUtilRateMultiplier,
        uint256 _targetLevel,
        uint256 _kinkLevel,
        uint256 _maxScaleRate
    ) external;
```
</details>

---    

> ### toggleFunctionPause

```solidity
function toggleFunctionPause(string funcId, bool isPaused) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| funcId | string |  | 
| isPaused | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function toggleFunctionPause(
        string calldata funcId, /// example: "mint(uint256,uint256)"
        bool isPaused
    ) external;
```
</details>

---    

> ### setTransactionLimits

```solidity
function setTransactionLimits(address[] addresses, uint256[] limits) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| addresses | address[] |  | 
| limits | uint256[] |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setTransactionLimits(address[] calldata addresses, uint256[] calldata limits)
        external;
```
</details>

---    

> ### changeLoanTokenNameAndSymbol

```solidity
function changeLoanTokenNameAndSymbol(string _name, string _symbol) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _name | string |  | 
| _symbol | string |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function changeLoanTokenNameAndSymbol(string calldata _name, string calldata _symbol) external;
```
</details>

---    

> ### marginTrade

```solidity
function marginTrade(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minEntryPrice, bytes loanDataBytes) external payable
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| leverageAmount | uint256 |  | 
| loanTokenSent | uint256 |  | 
| collateralTokenSent | uint256 |  | 
| collateralTokenAddress | address |  | 
| trader | address |  | 
| minEntryPrice | uint256 |  | 
| loanDataBytes | bytes |  | 

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
        uint256 minEntryPrice, // Value of loan token in collateral.
        bytes calldata loanDataBytes /// Arbitrary order data.
    )
        external
        payable
        returns (
            uint256,
            uint256 /// Returns new principal and new collateral added to trade.
        );
```
</details>

---    

> ### marginTradeAffiliate

```solidity
function marginTradeAffiliate(bytes32 loanId, uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress, address trader, uint256 minEntryPrice, address affiliateReferrer, bytes loanDataBytes) external payable
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| leverageAmount | uint256 |  | 
| loanTokenSent | uint256 |  | 
| collateralTokenSent | uint256 |  | 
| collateralTokenAddress | address |  | 
| trader | address |  | 
| minEntryPrice | uint256 |  | 
| affiliateReferrer | address |  | 
| loanDataBytes | bytes |  | 

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
        uint256 minEntryPrice, // Value of loan token in collateral.
        address affiliateReferrer, // The user was brought by the affiliate (referrer).
        bytes calldata loanDataBytes // Arbitrary order data.
    )
        external
        payable
        returns (
            uint256,
            uint256 /// Returns new principal and new collateral added to trade.
        );
```
</details>

---    

> ### borrowInterestRate

```solidity
function borrowInterestRate() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function borrowInterestRate() external view returns (uint256);
```
</details>

---    

> ### mint

```solidity
function mint(address receiver, uint256 depositAmount) external nonpayable
returns(mintAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| depositAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function mint(address receiver, uint256 depositAmount) external returns (uint256 mintAmount);
```
</details>

---    

> ### burn

```solidity
function burn(address receiver, uint256 burnAmount) external nonpayable
returns(loanAmountPaid uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| burnAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function burn(address receiver, uint256 burnAmount) external returns (uint256 loanAmountPaid);
```
</details>

---    

> ### checkPause

```solidity
function checkPause(string funcId) external view
returns(isPaused bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| funcId | string |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function checkPause(string calldata funcId) external view returns (bool isPaused);
```
</details>

---    

> ### nextBorrowInterestRate

```solidity
function nextBorrowInterestRate(uint256 borrowAmount) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| borrowAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function nextBorrowInterestRate(uint256 borrowAmount) external view returns (uint256);
```
</details>

---    

> ### totalAssetBorrow

```solidity
function totalAssetBorrow() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function totalAssetBorrow() external view returns (uint256);
```
</details>

---    

> ### totalAssetSupply

```solidity
function totalAssetSupply() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function totalAssetSupply() external view returns (uint256);
```
</details>

---    

> ### borrow

```solidity
function borrow(bytes32 loanId, uint256 withdrawAmount, uint256 initialLoanDuration, uint256 collateralTokenSent, address collateralTokenAddress, address borrower, address receiver, bytes ) external payable
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanId | bytes32 |  | 
| withdrawAmount | uint256 |  | 
| initialLoanDuration | uint256 |  | 
| collateralTokenSent | uint256 |  | 
| collateralTokenAddress | address |  | 
| borrower | address |  | 
| receiver | address |  | 
|  | bytes |  | 

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
        bytes calldata /// loanDataBytes: arbitrary order data (for future use).
    )
        external
        payable
        returns (
            uint256,
            uint256 /// Returns new principal and new collateral added to loan.
        );
```
</details>

---    

> ### transfer

```solidity
function transfer(address _to, uint256 _value) external nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _to | address |  | 
| _value | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function transfer(address _to, uint256 _value) external returns (bool);
```
</details>

---    

> ### transferFrom

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

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool);
```
</details>

---    

> ### setLiquidityMiningAddress

```solidity
function setLiquidityMiningAddress(address LMAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| LMAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setLiquidityMiningAddress(address LMAddress) external;
```
</details>

---    

> ### getLiquidityMiningAddress

```solidity
function getLiquidityMiningAddress() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLiquidityMiningAddress() external view returns (address);
```
</details>

---    

> ### getEstimatedMarginDetails

```solidity
function getEstimatedMarginDetails(uint256 leverageAmount, uint256 loanTokenSent, uint256 collateralTokenSent, address collateralTokenAddress) external view
returns(principal uint256, collateral uint256, interestRate uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| leverageAmount | uint256 |  | 
| loanTokenSent | uint256 |  | 
| collateralTokenSent | uint256 |  | 
| collateralTokenAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getEstimatedMarginDetails(
        uint256 leverageAmount,
        uint256 loanTokenSent,
        uint256 collateralTokenSent,
        address collateralTokenAddress // address(0) means ETH
    )
        external
        view
        returns (
            uint256 principal,
            uint256 collateral,
            uint256 interestRate
        );
```
</details>

---    

> ### getDepositAmountForBorrow

```solidity
function getDepositAmountForBorrow(uint256 borrowAmount, uint256 initialLoanDuration, address collateralTokenAddress) external view
returns(depositAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| borrowAmount | uint256 |  | 
| initialLoanDuration | uint256 |  | 
| collateralTokenAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getDepositAmountForBorrow(
        uint256 borrowAmount,
        uint256 initialLoanDuration, /// Duration in seconds.
        address collateralTokenAddress /// address(0) means rBTC
    ) external view returns (uint256 depositAmount);
```
</details>

---    

> ### getBorrowAmountForDeposit

```solidity
function getBorrowAmountForDeposit(uint256 depositAmount, uint256 initialLoanDuration, address collateralTokenAddress) external view
returns(borrowAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| depositAmount | uint256 |  | 
| initialLoanDuration | uint256 |  | 
| collateralTokenAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getBorrowAmountForDeposit(
        uint256 depositAmount,
        uint256 initialLoanDuration, /// Duration in seconds.
        address collateralTokenAddress /// address(0) means rBTC
    ) external view returns (uint256 borrowAmount);
```
</details>

---    

> ### checkPriceDivergence

```solidity
function checkPriceDivergence(uint256 loanTokenSent, address collateralTokenAddress, uint256 minEntryPrice) external view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanTokenSent | uint256 |  | 
| collateralTokenAddress | address |  | 
| minEntryPrice | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function checkPriceDivergence(
        uint256 loanTokenSent,
        address collateralTokenAddress,
        uint256 minEntryPrice
    ) external view;
```
</details>

---    

> ### getMaxEscrowAmount

```solidity
function getMaxEscrowAmount(uint256 leverageAmount) external view
returns(maxEscrowAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| leverageAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getMaxEscrowAmount(uint256 leverageAmount)
        external
        view
        returns (uint256 maxEscrowAmount);
```
</details>

---    

> ### checkpointPrice

```solidity
function checkpointPrice(address _user) external view
returns(price uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function checkpointPrice(address _user) external view returns (uint256 price);
```
</details>

---    

> ### assetBalanceOf

```solidity
function assetBalanceOf(address _owner) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _owner | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function assetBalanceOf(address _owner) external view returns (uint256);
```
</details>

---    

> ### profitOf

```solidity
function profitOf(address user) external view
returns(int256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function profitOf(address user) external view returns (int256);
```
</details>

---    

> ### tokenPrice

```solidity
function tokenPrice() external view
returns(price uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function tokenPrice() external view returns (uint256 price);
```
</details>

---    

> ### avgBorrowInterestRate

```solidity
function avgBorrowInterestRate() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function avgBorrowInterestRate() external view returns (uint256);
```
</details>

---    

> ### supplyInterestRate

```solidity
function supplyInterestRate() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function supplyInterestRate() external view returns (uint256);
```
</details>

---    

> ### nextSupplyInterestRate

```solidity
function nextSupplyInterestRate(uint256 supplyAmount) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| supplyAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function nextSupplyInterestRate(uint256 supplyAmount) external view returns (uint256);
```
</details>

---    

> ### totalSupplyInterestRate

```solidity
function totalSupplyInterestRate(uint256 assetSupply) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| assetSupply | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function totalSupplyInterestRate(uint256 assetSupply) external view returns (uint256);
```
</details>

---    

> ### loanTokenAddress

```solidity
function loanTokenAddress() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function loanTokenAddress() external view returns (address);
```
</details>

---    

> ### getMarginBorrowAmountAndRate

```solidity
function getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount) external view
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| leverageAmount | uint256 |  | 
| depositAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount)
        external
        view
        returns (uint256, uint256);
```
</details>

---    

> ### withdrawRBTCTo

```solidity
function withdrawRBTCTo(address payable _receiverAddress, uint256 _amount) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiverAddress | address payable |  | 
| _amount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawRBTCTo(address payable _receiverAddress, uint256 _amount) external;
```
</details>

---    

> ### initialPrice

```solidity
function initialPrice() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function initialPrice() external view returns (uint256);
```
</details>

---    

> ### mint

```solidity
function mint(address receiver, uint256 depositAmount, bool useLM) external nonpayable
returns(minted uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| depositAmount | uint256 |  | 
| useLM | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function mint(
        address receiver,
        uint256 depositAmount,
        bool useLM
    ) external returns (uint256 minted);
```
</details>

---    

> ### burn

```solidity
function burn(address receiver, uint256 burnAmount, bool useLM) external nonpayable
returns(redeemed uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| burnAmount | uint256 |  | 
| useLM | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function burn(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external returns (uint256 redeemed);
```
</details>

---    

> ### mintWithBTC

```solidity
function mintWithBTC(address receiver, bool useLM) external payable
returns(mintAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| useLM | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function mintWithBTC(address receiver, bool useLM)
        external
        payable
        returns (uint256 mintAmount);
```
</details>

---    

> ### burnToBTC

```solidity
function burnToBTC(address receiver, uint256 burnAmount, bool useLM) external nonpayable
returns(loanAmountPaid uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| burnAmount | uint256 |  | 
| useLM | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function burnToBTC(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external returns (uint256 loanAmountPaid);
```
</details>

---    

> ### pauser

```solidity
function pauser() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function pauser() external view returns (address);
```
</details>

---    

> ### liquidityMiningAddress

```solidity
function liquidityMiningAddress() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function liquidityMiningAddress() external view returns (address);
```
</details>

---    

> ### name

```solidity
function name() external view
returns(string)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function name() external view returns (string memory);
```
</details>

---    

> ### symbol

```solidity
function symbol() external view
returns(string)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function symbol() external view returns (string memory);
```
</details>

---    

> ### approve

```solidity
function approve(address _spender, uint256 _value) external nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _spender | address |  | 
| _value | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function approve(address _spender, uint256 _value) external returns (bool);
```
</details>

---    

> ### allowance

```solidity
function allowance(address _owner, address _spender) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _owner | address |  | 
| _spender | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function allowance(address _owner, address _spender) external view returns (uint256);
```
</details>

---    

> ### balanceOf

```solidity
function balanceOf(address _owner) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _owner | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function balanceOf(address _owner) external view returns (uint256);
```
</details>

---    

> ### totalSupply

```solidity
function totalSupply() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function totalSupply() external view returns (uint256);
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
