# PriceFeeds
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/feeds/PriceFeeds.sol)

**Inherits:**
[Constants](/contracts/feeds/PriceFeedsConstants.sol/contract.Constants.md), [Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract queries the price feeds contracts where
oracles updates token prices computing relative token prices.
And besides it includes some calculations about loans such as
drawdown, margin and collateral.


## State Variables
### pricesFeeds
Mapping of PriceFeedsExt instances.
token => pricefeed


```solidity
mapping(address => IPriceFeedsExt) public pricesFeeds;
```


### decimals
Decimals of supported tokens.


```solidity
mapping(address => uint256) public decimals;
```


### protocolTokenEthPrice
Value on rBTC weis for the protocol token.


```solidity
uint256 public protocolTokenEthPrice = 0.0002 ether;
```


### globalPricingPaused
Flag to pause pricings.


```solidity
bool public globalPricingPaused = false;
```


## Functions
### constructor

Contract deployment requires 3 parameters.


```solidity
constructor(address _wrbtcTokenAddress, address _protocolTokenAddress, address _baseTokenAddress) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_wrbtcTokenAddress`|`address`|The address of the wrapped wrBTC token.|
|`_protocolTokenAddress`|`address`|The address of the protocol token.|
|`_baseTokenAddress`|`address`|The address of the base token.|


### queryRate

Set decimals for this token.

Calculate the price ratio between two tokens.

*Public wrapper for _queryRate internal function.*


```solidity
function queryRate(address sourceToken, address destToken) public view returns (uint256 rate, uint256 precision);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceToken`|`address`|The address of the source tokens.|
|`destToken`|`address`|The address of the destiny tokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`rate`|`uint256`|The price ratio source/dest.|
|`precision`|`uint256`|The ratio precision.|


### queryPrecision

Calculate the relative precision between two tokens.

*Public wrapper for _getDecimalPrecision internal function.*


```solidity
function queryPrecision(address sourceToken, address destToken) public view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceToken`|`address`|The address of the source tokens.|
|`destToken`|`address`|The address of the destiny tokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The precision ratio source/dest.|


### queryReturn

Price conversor: Calculate the price of an amount of source
tokens in destiny token units.

*NOTE: This function returns 0 during a pause, rather than a revert.
Ensure calling contracts handle correctly.*


```solidity
function queryReturn(address sourceToken, address destToken, uint256 sourceAmount)
    public
    view
    returns (uint256 destAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceToken`|`address`|The address of the source tokens.|
|`destToken`|`address`|The address of the destiny tokens.|
|`sourceAmount`|`uint256`|The amount of the source tokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`destAmount`|`uint256`|The amount of destiny tokens equivalent in price to the amount of source tokens.|


### checkPriceDisagreement

Calculate the swap rate between two tokens.
Regarding slippage, there is a hardcoded slippage limit of 5%, enforced
by this function for all borrowing, lending and margin trading
originated swaps performed in the Sovryn exchange.
This means all operations in the Sovryn exchange are subject to losing
up to 5% from the internal swap performed.


```solidity
function checkPriceDisagreement(
    address sourceToken,
    address destToken,
    uint256 sourceAmount,
    uint256 destAmount,
    uint256 maxSlippage
) public view returns (uint256 sourceToDestSwapRate);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceToken`|`address`|The address of the source tokens.|
|`destToken`|`address`|The address of the destiny tokens.|
|`sourceAmount`|`uint256`|The amount of source tokens.|
|`destAmount`|`uint256`|The amount of destiny tokens.|
|`maxSlippage`|`uint256`|The maximum slippage limit.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`sourceToDestSwapRate`|`uint256`|The swap rate between tokens.|


### amountInEth

Calculate the rBTC amount equivalent to a given token amount.
Native coin on RSK is rBTC. This code comes from Ethereum applications,
so Eth refers to 10**18 weis of native coin, i.e.: 1 rBTC.


```solidity
function amountInEth(address tokenAddress, uint256 amount) public view returns (uint256 ethAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenAddress`|`address`|The address of the token to calculate price.|
|`amount`|`uint256`|The amount of tokens to calculate price.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`ethAmount`|`uint256`|The amount of rBTC equivalent.|


### getMaxDrawdown

Token is wrBTC, amount in rBTC is the same.

Calculate the maximum drawdown of a loan.
A drawdown is commonly defined as the decline from a high peak to a
pullback low of a specific investment or equity in an account.
Drawdown magnitude refers to the amount of value that a user loses
during the drawdown period.


```solidity
function getMaxDrawdown(
    address loanToken,
    address collateralToken,
    uint256 loanAmount,
    uint256 collateralAmount,
    uint256 margin
) public view returns (uint256 maxDrawdown);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanToken`|`address`|The address of the loan token.|
|`collateralToken`|`address`|The address of the collateral token.|
|`loanAmount`|`uint256`|The amount of the loan.|
|`collateralAmount`|`uint256`|The amount of the collateral.|
|`margin`|`uint256`|The relation between the position size and the loan. margin = (total position size - loan) / loan|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`maxDrawdown`|`uint256`|The maximum drawdown.|


### getCurrentMarginAndCollateralSize

Calculate the margin and the collateral on rBTC.


```solidity
function getCurrentMarginAndCollateralSize(
    address loanToken,
    address collateralToken,
    uint256 loanAmount,
    uint256 collateralAmount
) public view returns (uint256 currentMargin, uint256 collateralInEthAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanToken`|`address`|The address of the loan token.|
|`collateralToken`|`address`|The address of the collateral token.|
|`loanAmount`|`uint256`|The amount of the loan.|
|`collateralAmount`|`uint256`|The amount of the collateral.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`currentMargin`|`uint256`|The margin of the loan.|
|`collateralInEthAmount`|`uint256`|The amount of collateral on rBTC.|


### getCurrentMargin

Calculate the margin of a loan.

*current margin = (total position size - loan) / loan
The collateral amount passed as parameter equals the total position size.*


```solidity
function getCurrentMargin(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount)
    public
    view
    returns (uint256 currentMargin, uint256 collateralToLoanRate);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanToken`|`address`|The address of the loan token.|
|`collateralToken`|`address`|The address of the collateral token.|
|`loanAmount`|`uint256`|The amount of the loan.|
|`collateralAmount`|`uint256`|The amount of the collateral.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`currentMargin`|`uint256`|The margin of the loan.|
|`collateralToLoanRate`|`uint256`|The price ratio between collateral and loan tokens.|


### shouldLiquidate

Get assessment about liquidating a loan.


```solidity
function shouldLiquidate(
    address loanToken,
    address collateralToken,
    uint256 loanAmount,
    uint256 collateralAmount,
    uint256 maintenanceMargin
) public view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanToken`|`address`|The address of the loan token.|
|`collateralToken`|`address`|The address of the collateral token.|
|`loanAmount`|`uint256`|The amount of the loan.|
|`collateralAmount`|`uint256`|The amount of the collateral.|
|`maintenanceMargin`|`uint256`|The minimum margin before liquidation.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|True/false to liquidate the loan.|


### setProtocolTokenEthPrice

Set new value for protocolTokenEthPrice


```solidity
function setProtocolTokenEthPrice(uint256 newPrice) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newPrice`|`uint256`|The new value for protocolTokenEthPrice|


### setPriceFeed

Populate pricesFeeds mapping w/ values from feeds[]


```solidity
function setPriceFeed(address[] calldata tokens, IPriceFeedsExt[] calldata feeds) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokens`|`address[]`|The array of tokens to loop and get addresses.|
|`feeds`|`IPriceFeedsExt[]`|The array of contract instances for every token.|


### setDecimals

Populate decimals mapping w/ values from tokens[].decimals


```solidity
function setDecimals(IERC20[] calldata tokens) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokens`|`IERC20[]`|The array of tokens to loop and get values from.|


### setGlobalPricingPaused

Set flag globalPricingPaused


```solidity
function setGlobalPricingPaused(bool isPaused) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`isPaused`|`bool`|The new status of pause (true/false).|


### _queryRate

Calculate the price ratio between two tokens.


```solidity
function _queryRate(address sourceToken, address destToken) internal view returns (uint256 rate, uint256 precision);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceToken`|`address`|The address of the source tokens.|
|`destToken`|`address`|The address of the destiny tokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`rate`|`uint256`|The price ratio source/dest.|
|`precision`|`uint256`|The ratio precision.|


### _getDecimalPrecision

Different tokens, query prices and perform division.
Query token price on priceFeedsExt instance.
Query token price on priceFeedsExt instance.
Same tokens, return 1 with decimals.

Calculate the relative precision between two tokens.


```solidity
function _getDecimalPrecision(address sourceToken, address destToken) internal view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceToken`|`address`|The address of the source tokens.|
|`destToken`|`address`|The address of the destiny tokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The precision ratio source/dest.|


## Events
### GlobalPricingPaused

```solidity
event GlobalPricingPaused(address indexed sender, bool indexed isPaused);
```

