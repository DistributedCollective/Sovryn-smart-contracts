# PriceFeeds.sol

View Source: [contracts/feeds/PriceFeeds.sol](../contracts/feeds/PriceFeeds.sol)

**↗ Extends: [Constants](Constants.md), [Ownable](Ownable.md)**
**↘ Derived Contracts: [PriceFeedsLocal](PriceFeedsLocal.md)**

**PriceFeeds**

## Contract Members
**Constants & Variables**

```js
mapping(address => contract IPriceFeedsExt) public pricesFeeds;
mapping(address => uint256) public decimals;
uint256 public protocolTokenEthPrice;
bool public globalPricingPaused;

```

**Events**

```js
event GlobalPricingPaused(address indexed sender, bool indexed isPaused);
```

## Functions

- [latestAnswer()](#latestanswer)
- [constructor(address _wrbtcTokenAddress, address _protocolTokenAddress, address _baseTokenAddress)](#constructor)
- [queryRate(address sourceToken, address destToken)](#queryrate)
- [queryPrecision(address sourceToken, address destToken)](#queryprecision)
- [queryReturn(address sourceToken, address destToken, uint256 sourceAmount)](#queryreturn)
- [checkPriceDisagreement(address sourceToken, address destToken, uint256 sourceAmount, uint256 destAmount, uint256 maxSlippage)](#checkpricedisagreement)
- [amountInEth(address tokenAddress, uint256 amount)](#amountineth)
- [getMaxDrawdown(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount, uint256 margin)](#getmaxdrawdown)
- [getCurrentMarginAndCollateralSize(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount)](#getcurrentmarginandcollateralsize)
- [getCurrentMargin(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount)](#getcurrentmargin)
- [shouldLiquidate(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount, uint256 maintenanceMargin)](#shouldliquidate)
- [setProtocolTokenEthPrice(uint256 newPrice)](#setprotocoltokenethprice)
- [setPriceFeed(address[] tokens, IPriceFeedsExt[] feeds)](#setpricefeed)
- [setDecimals(IERC20[] tokens)](#setdecimals)
- [setGlobalPricingPaused(bool isPaused)](#setglobalpricingpaused)
- [_queryRate(address sourceToken, address destToken)](#_queryrate)
- [_getDecimalPrecision(address sourceToken, address destToken)](#_getdecimalprecision)

---    

> ### latestAnswer

⤿ Overridden Implementation(s): [BProPriceFeed.latestAnswer](BProPriceFeed.md#latestanswer),[Medianizer.latestAnswer](Medianizer.md#latestanswer),[PriceFeedRSKOracle.latestAnswer](PriceFeedRSKOracle.md#latestanswer),[PriceFeedsMoC.latestAnswer](PriceFeedsMoC.md#latestanswer),[PriceFeedV1PoolOracle.latestAnswer](PriceFeedV1PoolOracle.md#latestanswer),[USDTPriceFeed.latestAnswer](USDTPriceFeed.md#latestanswer)

```solidity
function latestAnswer() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function latestAnswer() external view returns (uint256);
```
</details>

---    

> ### constructor

Contract deployment requires 3 parameters.
     *

```solidity
function (address _wrbtcTokenAddress, address _protocolTokenAddress, address _baseTokenAddress) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _wrbtcTokenAddress | address | The address of the wrapped wrBTC token. | 
| _protocolTokenAddress | address | The address of the protocol token. | 
| _baseTokenAddress | address | The address of the base token. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor(
        address _wrbtcTokenAddress,
        address _protocolTokenAddress,
        address _baseTokenAddress
    ) public {
        /// Set decimals for this token.
        decimals[address(0)] = 18;
        decimals[_wrbtcTokenAddress] = 18;
        _setWrbtcToken(_wrbtcTokenAddress);
        _setProtocolTokenAddress(_protocolTokenAddress);
        _setBaseToken(_baseTokenAddress);
    }
```
</details>

---    

> ### queryRate

Calculate the price ratio between two tokens.
     *

```solidity
function queryRate(address sourceToken, address destToken) public view
returns(rate uint256, precision uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source tokens. | 
| destToken | address | The address of the destiny tokens.      * | 

**Returns**

rate The price ratio source/dest.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function queryRate(address sourceToken, address destToken)
        public
        view
        returns (uint256 rate, uint256 precision)
    {
        return _queryRate(sourceToken, destToken);
    }
```
</details>

---    

> ### queryPrecision

Calculate the relative precision between two tokens.
     *

```solidity
function queryPrecision(address sourceToken, address destToken) public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source tokens. | 
| destToken | address | The address of the destiny tokens.      * | 

**Returns**

The precision ratio source/dest.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function queryPrecision(address sourceToken, address destToken) public view returns (uint256) {
        return sourceToken != destToken ? _getDecimalPrecision(sourceToken, destToken) : 10**18;
    }
```
</details>

---    

> ### queryReturn

Price conversor: Calculate the price of an amount of source
tokens in destiny token units.
     *

```solidity
function queryReturn(address sourceToken, address destToken, uint256 sourceAmount) public view
returns(destAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source tokens. | 
| destToken | address | The address of the destiny tokens. | 
| sourceAmount | uint256 | The amount of the source tokens.      * | 

**Returns**

destAmount The amount of destiny tokens equivalent in price
  to the amount of source tokens.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function queryReturn(
        address sourceToken,
        address destToken,
        uint256 sourceAmount
    ) public view returns (uint256 destAmount) {
        if (globalPricingPaused) {
            return 0;
        }

        (uint256 rate, uint256 precision) = _queryRate(sourceToken, destToken);

        destAmount = sourceAmount.mul(rate).div(precision);
    }
```
</details>

---    

> ### checkPriceDisagreement

Calculate the swap rate between two tokens.
     * Regarding slippage, there is a hardcoded slippage limit of 5%, enforced
by this function for all borrowing, lending and margin trading
originated swaps performed in the Sovryn exchange.
     * This means all operations in the Sovryn exchange are subject to losing
up to 5% from the internal swap performed.
     *

```solidity
function checkPriceDisagreement(address sourceToken, address destToken, uint256 sourceAmount, uint256 destAmount, uint256 maxSlippage) public view
returns(sourceToDestSwapRate uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source tokens. | 
| destToken | address | The address of the destiny tokens. | 
| sourceAmount | uint256 | The amount of source tokens. | 
| destAmount | uint256 | The amount of destiny tokens. | 
| maxSlippage | uint256 | The maximum slippage limit.      * | 

**Returns**

sourceToDestSwapRate The swap rate between tokens.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function checkPriceDisagreement(
        address sourceToken,
        address destToken,
        uint256 sourceAmount,
        uint256 destAmount,
        uint256 maxSlippage
    ) public view returns (uint256 sourceToDestSwapRate) {
        require(!globalPricingPaused, "pricing is paused");
        (uint256 rate, uint256 precision) = _queryRate(sourceToken, destToken);

        sourceToDestSwapRate = destAmount.mul(precision).div(sourceAmount);

        if (rate > sourceToDestSwapRate) {
            uint256 spreadValue = rate - sourceToDestSwapRate;
            spreadValue = spreadValue.mul(10**20).div(sourceToDestSwapRate);
            require(spreadValue <= maxSlippage, "price disagreement");
        }
    }
```
</details>

---    

> ### amountInEth

Calculate the rBTC amount equivalent to a given token amount.
Native coin on RSK is rBTC. This code comes from Ethereum applications,
so Eth refers to 10**18 weis of native coin, i.e.: 1 rBTC.
     *

```solidity
function amountInEth(address tokenAddress, uint256 amount) public view
returns(ethAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| tokenAddress | address | The address of the token to calculate price. | 
| amount | uint256 | The amount of tokens to calculate price.      * | 

**Returns**

ethAmount The amount of rBTC equivalent.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function amountInEth(address tokenAddress, uint256 amount)
        public
        view
        returns (uint256 ethAmount)
    {
        /// Token is wrBTC, amount in rBTC is the same.
        if (tokenAddress == address(wrbtcToken)) {
            ethAmount = amount;
        } else {
            (uint256 toEthRate, uint256 toEthPrecision) =
                queryRate(tokenAddress, address(wrbtcToken));
            ethAmount = amount.mul(toEthRate).div(toEthPrecision);
        }
    }
```
</details>

---    

> ### getMaxDrawdown

Calculate the maximum drawdown of a loan.
     * A drawdown is commonly defined as the decline from a high peak to a
pullback low of a specific investment or equity in an account.
     * Drawdown magnitude refers to the amount of value that a user loses
during the drawdown period.
     *

```solidity
function getMaxDrawdown(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount, uint256 margin) public view
returns(maxDrawdown uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The address of the loan token. | 
| collateralToken | address | The address of the collateral token. | 
| loanAmount | uint256 | The amount of the loan. | 
| collateralAmount | uint256 | The amount of the collateral. | 
| margin | uint256 | The relation between the position size and the loan.   margin = (total position size - loan) / loan      * | 

**Returns**

maxDrawdown The maximum drawdown.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getMaxDrawdown(
        address loanToken,
        address collateralToken,
        uint256 loanAmount,
        uint256 collateralAmount,
        uint256 margin
    ) public view returns (uint256 maxDrawdown) {
        uint256 loanToCollateralAmount;
        if (collateralToken == loanToken) {
            loanToCollateralAmount = loanAmount;
        } else {
            (uint256 rate, uint256 precision) = queryRate(loanToken, collateralToken);
            loanToCollateralAmount = loanAmount.mul(rate).div(precision);
        }

        uint256 combined =
            loanToCollateralAmount.add(loanToCollateralAmount.mul(margin).div(10**20));

        maxDrawdown = collateralAmount > combined ? collateralAmount - combined : 0;
    }
```
</details>

---    

> ### getCurrentMarginAndCollateralSize

Calculate the margin and the collateral on rBTC.
     *

```solidity
function getCurrentMarginAndCollateralSize(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount) public view
returns(currentMargin uint256, collateralInEthAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The address of the loan token. | 
| collateralToken | address | The address of the collateral token. | 
| loanAmount | uint256 | The amount of the loan. | 
| collateralAmount | uint256 | The amount of the collateral.      * | 

**Returns**

currentMargin The margin of the loan.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getCurrentMarginAndCollateralSize(
        address loanToken,
        address collateralToken,
        uint256 loanAmount,
        uint256 collateralAmount
    ) public view returns (uint256 currentMargin, uint256 collateralInEthAmount) {
        (currentMargin, ) = getCurrentMargin(
            loanToken,
            collateralToken,
            loanAmount,
            collateralAmount
        );

        collateralInEthAmount = amountInEth(collateralToken, collateralAmount);
    }
```
</details>

---    

> ### getCurrentMargin

Calculate the margin of a loan.
     *

```solidity
function getCurrentMargin(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount) public view
returns(currentMargin uint256, collateralToLoanRate uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The address of the loan token. | 
| collateralToken | address | The address of the collateral token. | 
| loanAmount | uint256 | The amount of the loan. | 
| collateralAmount | uint256 | The amount of the collateral.      * | 

**Returns**

currentMargin The margin of the loan.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getCurrentMargin(
        address loanToken,
        address collateralToken,
        uint256 loanAmount,
        uint256 collateralAmount
    ) public view returns (uint256 currentMargin, uint256 collateralToLoanRate) {
        uint256 collateralToLoanAmount;
        if (collateralToken == loanToken) {
            collateralToLoanAmount = collateralAmount;
            collateralToLoanRate = 10**18;
        } else {
            uint256 collateralToLoanPrecision;
            (collateralToLoanRate, collateralToLoanPrecision) = queryRate(
                collateralToken,
                loanToken
            );

            collateralToLoanRate = collateralToLoanRate.mul(10**18).div(collateralToLoanPrecision);

            collateralToLoanAmount = collateralAmount.mul(collateralToLoanRate).div(10**18);
        }

        if (loanAmount != 0 && collateralToLoanAmount >= loanAmount) {
            return (
                collateralToLoanAmount.sub(loanAmount).mul(10**20).div(loanAmount),
                collateralToLoanRate
            );
        } else {
            return (0, collateralToLoanRate);
        }
    }
```
</details>

---    

> ### shouldLiquidate

Get assessment about liquidating a loan.
     *

```solidity
function shouldLiquidate(address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount, uint256 maintenanceMargin) public view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanToken | address | The address of the loan token. | 
| collateralToken | address | The address of the collateral token. | 
| loanAmount | uint256 | The amount of the loan. | 
| collateralAmount | uint256 | The amount of the collateral. | 
| maintenanceMargin | uint256 | The minimum margin before liquidation.      * | 

**Returns**

True/false to liquidate the loan.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function shouldLiquidate(
        address loanToken,
        address collateralToken,
        uint256 loanAmount,
        uint256 collateralAmount,
        uint256 maintenanceMargin
    ) public view returns (bool) {
        (uint256 currentMargin, ) =
            getCurrentMargin(loanToken, collateralToken, loanAmount, collateralAmount);

        return currentMargin <= maintenanceMargin;
    }
```
</details>

---    

> ### setProtocolTokenEthPrice

Set new value for protocolTokenEthPrice
     *

```solidity
function setProtocolTokenEthPrice(uint256 newPrice) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newPrice | uint256 | The new value for protocolTokenEthPrice | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setProtocolTokenEthPrice(uint256 newPrice) external onlyOwner {
        require(newPrice != 0, "invalid price");
        protocolTokenEthPrice = newPrice;
    }
```
</details>

---    

> ### setPriceFeed

Populate pricesFeeds mapping w/ values from feeds[]
     *

```solidity
function setPriceFeed(address[] tokens, IPriceFeedsExt[] feeds) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| tokens | address[] | The array of tokens to loop and get addresses. | 
| feeds | IPriceFeedsExt[] | The array of contract instances for every token. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setPriceFeed(address[] calldata tokens, IPriceFeedsExt[] calldata feeds)
        external
        onlyOwner
    {
        require(tokens.length == feeds.length, "count mismatch");

        for (uint256 i = 0; i < tokens.length; i++) {
            pricesFeeds[tokens[i]] = feeds[i];
        }
    }
```
</details>

---    

> ### setDecimals

Populate decimals mapping w/ values from tokens[].decimals
     *

```solidity
function setDecimals(IERC20[] tokens) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| tokens | IERC20[] | The array of tokens to loop and get values from. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setDecimals(IERC20[] calldata tokens) external onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            decimals[address(tokens[i])] = tokens[i].decimals();
        }
    }
```
</details>

---    

> ### setGlobalPricingPaused

Set flag globalPricingPaused
     *

```solidity
function setGlobalPricingPaused(bool isPaused) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| isPaused | bool | The new status of pause (true/false). | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setGlobalPricingPaused(bool isPaused) external onlyOwner {
        if (globalPricingPaused != isPaused) {
            globalPricingPaused = isPaused;

            emit GlobalPricingPaused(msg.sender, isPaused);
        }
    }
```
</details>

---    

> ### _queryRate

⤿ Overridden Implementation(s): [PriceFeedsLocal._queryRate](PriceFeedsLocal.md#_queryrate)

Calculate the price ratio between two tokens.
     *

```solidity
function _queryRate(address sourceToken, address destToken) internal view
returns(rate uint256, precision uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source tokens. | 
| destToken | address | The address of the destiny tokens.      * | 

**Returns**

rate The price ratio source/dest.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _queryRate(address sourceToken, address destToken)
        internal
        view
        returns (uint256 rate, uint256 precision)
    {
        require(!globalPricingPaused, "pricing is paused");

        /// Different tokens, query prices and perform division.
        if (sourceToken != destToken) {
            uint256 sourceRate;
            if (sourceToken != address(baseToken) && sourceToken != protocolTokenAddress) {
                IPriceFeedsExt _sourceFeed = pricesFeeds[sourceToken];
                require(address(_sourceFeed) != address(0), "unsupported src feed");

                /// Query token price on priceFeedsExt instance.
                sourceRate = _sourceFeed.latestAnswer();
                require(sourceRate != 0 && (sourceRate >> 128) == 0, "price error");
            } else {
                sourceRate = sourceToken == protocolTokenAddress ? protocolTokenEthPrice : 10**18;
            }

            uint256 destRate;
            if (destToken != address(baseToken) && destToken != protocolTokenAddress) {
                IPriceFeedsExt _destFeed = pricesFeeds[destToken];
                require(address(_destFeed) != address(0), "unsupported dst feed");

                /// Query token price on priceFeedsExt instance.
                destRate = _destFeed.latestAnswer();
                require(destRate != 0 && (destRate >> 128) == 0, "price error");
            } else {
                destRate = destToken == protocolTokenAddress ? protocolTokenEthPrice : 10**18;
            }

            rate = sourceRate.mul(10**18).div(destRate);

            precision = _getDecimalPrecision(sourceToken, destToken);

            /// Same tokens, return 1 with decimals.
        } else {
            rate = 10**18;
            precision = 10**18;
        }
    }
```
</details>

---    

> ### _getDecimalPrecision

Calculate the relative precision between two tokens.
     *

```solidity
function _getDecimalPrecision(address sourceToken, address destToken) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source tokens. | 
| destToken | address | The address of the destiny tokens.      * | 

**Returns**

The precision ratio source/dest.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getDecimalPrecision(address sourceToken, address destToken)
        internal
        view
        returns (uint256)
    {
        /// Same tokens, return 1 with decimals.
        if (sourceToken == destToken) {
            return 10**18;

            /// Different tokens, query ERC20 precisions and return 18 +- diff.
        } else {
            uint256 sourceTokenDecimals = decimals[sourceToken];
            if (sourceTokenDecimals == 0) sourceTokenDecimals = IERC20(sourceToken).decimals();

            uint256 destTokenDecimals = decimals[destToken];
            if (destTokenDecimals == 0) destTokenDecimals = IERC20(destToken).decimals();

            if (destTokenDecimals >= sourceTokenDecimals)
                return 10**(SafeMath.sub(18, destTokenDecimals - sourceTokenDecimals));
            else return 10**(SafeMath.add(18, sourceTokenDecimals - destTokenDecimals));
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
