# PriceFeedV1PoolOracle.sol

View Source: [contracts/feeds/PriceFeedV1PoolOracle.sol](../contracts/feeds/PriceFeedV1PoolOracle.sol)

**↗ Extends: [IPriceFeedsExt](IPriceFeedsExt.md), [Ownable](Ownable.md)**

**PriceFeedV1PoolOracle**

The Price Feed V1 Pool Oracle contract.
 * This contract implements V1 Pool Oracle query functionality,
getting the price from v1 pool oracle.

## Contract Members
**Constants & Variables**

```js
address public v1PoolOracleAddress;
address public wRBTCAddress;
address public docAddress;
address public baseCurrency;

```

**Events**

```js
event SetV1PoolOracleAddress(address indexed v1PoolOracleAddress, address  changerAddress);
event SetWRBTCAddress(address indexed wRBTCAddress, address  changerAddress);
event SetDOCAddress(address indexed docAddress, address  changerAddress);
event SetBaseCurrency(address indexed baseCurrency, address  changerAddress);
```

## Functions

- [constructor(address _v1PoolOracleAddress, address _wRBTCAddress, address _docAddress, address _baseCurrency)](#constructor)
- [latestAnswer()](#latestanswer)
- [_convertAnswerToUsd(uint256 _valueInBTC)](#_convertanswertousd)
- [setV1PoolOracleAddress(address _v1PoolOracleAddress)](#setv1pooloracleaddress)
- [setRBTCAddress(address _wRBTCAddress)](#setrbtcaddress)
- [setDOCAddress(address _docAddress)](#setdocaddress)
- [setBaseCurrency(address _baseCurrency)](#setbasecurrency)

---    

> ### constructor

Initialize a new V1 Pool Oracle.
     *

```solidity
function (address _v1PoolOracleAddress, address _wRBTCAddress, address _docAddress, address _baseCurrency) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _v1PoolOracleAddress | address | The V1 Pool Oracle address. | 
| _wRBTCAddress | address | The wrbtc token address. | 
| _docAddress | address | The doc token address. | 
| _baseCurrency | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor(
        address _v1PoolOracleAddress,
        address _wRBTCAddress,
        address _docAddress,
        address _baseCurrency
    ) public {
        setRBTCAddress(_wRBTCAddress);
        setDOCAddress(_docAddress);
        setV1PoolOracleAddress(_v1PoolOracleAddress);
        setBaseCurrency(_baseCurrency);
    }
```
</details>

---    

> ### latestAnswer

⤾ overrides [IPriceFeedsExt.latestAnswer](IPriceFeedsExt.md#latestanswer)

Get the oracle price.

```solidity
function latestAnswer() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function latestAnswer() external view returns (uint256) {
        IV1PoolOracle _v1PoolOracle = IV1PoolOracle(v1PoolOracleAddress);

        uint256 _price = _v1PoolOracle.latestPrice(baseCurrency);

        // Need to convert to USD, since the V1 pool return value is based on BTC
        uint256 priceInUSD = _convertAnswerToUsd(_price);
        require(priceInUSD != 0, "price error");

        return priceInUSD;
    }
```
</details>

---    

> ### _convertAnswerToUsd

```solidity
function _convertAnswerToUsd(uint256 _valueInBTC) private view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _valueInBTC | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _convertAnswerToUsd(uint256 _valueInBTC) private view returns (uint256) {
        address _priceFeeds = msg.sender;

        uint256 precision = IPriceFeeds(_priceFeeds).queryPrecision(wRBTCAddress, docAddress);
        uint256 valueInUSD =
            IPriceFeeds(_priceFeeds).queryReturn(wRBTCAddress, docAddress, _valueInBTC);

        /// Need to multiply by query precision (doc's precision) and divide by 1*10^18 (Because the based price in v1 pool is using 18 decimals)
        return valueInUSD.mul(precision).div(1e18);
    }
```
</details>

---    

> ### setV1PoolOracleAddress

Set the V1 Pool Oracle address.
     *

```solidity
function setV1PoolOracleAddress(address _v1PoolOracleAddress) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _v1PoolOracleAddress | address | The V1 Pool Oracle address. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setV1PoolOracleAddress(address _v1PoolOracleAddress) public onlyOwner {
        require(Address.isContract(_v1PoolOracleAddress), "_v1PoolOracleAddress not a contract");
        IV1PoolOracle _v1PoolOracle = IV1PoolOracle(_v1PoolOracleAddress);
        address liquidityPool = _v1PoolOracle.liquidityPool();
        require(
            ILiquidityPoolV1Converter(liquidityPool).reserveTokens(0) == wRBTCAddress ||
                ILiquidityPoolV1Converter(liquidityPool).reserveTokens(1) == wRBTCAddress,
            "one of the two reserves needs to be wrbtc"
        );
        v1PoolOracleAddress = _v1PoolOracleAddress;
        emit SetV1PoolOracleAddress(v1PoolOracleAddress, msg.sender);
    }
```
</details>

---    

> ### setRBTCAddress

Set the rBtc address. V1 pool based price is BTC, so need to convert the value from v1 pool to USD. That's why we need to get the price of the rBtc
     *

```solidity
function setRBTCAddress(address _wRBTCAddress) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _wRBTCAddress | address | The rBTC address | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setRBTCAddress(address _wRBTCAddress) public onlyOwner {
        require(_wRBTCAddress != address(0), "wRBTC address cannot be zero address");
        wRBTCAddress = _wRBTCAddress;
        emit SetWRBTCAddress(wRBTCAddress, msg.sender);
    }
```
</details>

---    

> ### setDOCAddress

Set the DoC address. V1 pool based price is BTC, so need to convert the value from v1 pool to USD. That's why we need to get the price of the DoC
     *

```solidity
function setDOCAddress(address _docAddress) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _docAddress | address | The DoC address | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setDOCAddress(address _docAddress) public onlyOwner {
        require(_docAddress != address(0), "DOC address cannot be zero address");
        docAddress = _docAddress;
        emit SetDOCAddress(_docAddress, msg.sender);
    }
```
</details>

---    

> ### setBaseCurrency

Set the base currency address. That's the reserve address which is not WRBTC
     *

```solidity
function setBaseCurrency(address _baseCurrency) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _baseCurrency | address | The base currency address | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setBaseCurrency(address _baseCurrency) public onlyOwner {
        require(_baseCurrency != address(0), "Base currency address cannot be zero address");
        baseCurrency = _baseCurrency;
        emit SetBaseCurrency(_baseCurrency, msg.sender);
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
