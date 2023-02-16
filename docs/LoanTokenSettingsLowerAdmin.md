# LoanTokenSettingsLowerAdmin.sol

View Source: [contracts/connectors/loantoken/modules/shared/LoanTokenSettingsLowerAdmin.sol](../contracts/connectors/loantoken/modules/shared/LoanTokenSettingsLowerAdmin.sol)

**↗ Extends: [LoanTokenLogicStorage](LoanTokenLogicStorage.md)**

**LoanTokenSettingsLowerAdmin**

**Events**

```js
event SetTransactionLimits(address[]  addresses, uint256[]  limits);
event ToggledFunctionPaused(string  functionId, bool  prevFlag, bool  newFlag);
```

## Modifiers

- [onlyAdmin](#onlyadmin)

### onlyAdmin

TODO: Check for restrictions in this contract.

```js
modifier onlyAdmin() internal
```

## Functions

- [getListFunctionSignatures()](#getlistfunctionsignatures)
- [setAdmin(address _admin)](#setadmin)
- [setPauser(address _pauser)](#setpauser)
- [constructor()](#constructor)
- [setupLoanParams(struct LoanParamsStruct.LoanParams[] loanParamsList, bool areTorqueLoans)](#setuploanparams)
- [disableLoanParams(address[] collateralTokens, bool[] isTorqueLoans)](#disableloanparams)
- [setDemandCurve(uint256 _baseRate, uint256 _rateMultiplier, uint256 _lowUtilBaseRate, uint256 _lowUtilRateMultiplier, uint256 _targetLevel, uint256 _kinkLevel, uint256 _maxScaleRate)](#setdemandcurve)
- [toggleFunctionPause(string funcId, bool isPaused)](#togglefunctionpause)
- [setTransactionLimits(address[] addresses, uint256[] limits)](#settransactionlimits)
- [changeLoanTokenNameAndSymbol(string _name, string _symbol)](#changeloantokennameandsymbol)

---    

> ### getListFunctionSignatures

This function is MANDATORY, which will be called by LoanTokenLogicBeacon and be registered.
Every new public function, the sginature needs to be included in this function.
     *

```solidity
function getListFunctionSignatures() external pure
returns(functionSignatures bytes4[], moduleName bytes32)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getListFunctionSignatures()
        external
        pure
        returns (bytes4[] memory functionSignatures, bytes32 moduleName)
    {
        bytes4[] memory res = new bytes4[](9);
        res[0] = this.setAdmin.selector;
        res[1] = this.setPauser.selector;
        res[2] = this.setupLoanParams.selector;
        res[3] = this.disableLoanParams.selector;
        res[4] = this.setDemandCurve.selector;
        res[5] = this.toggleFunctionPause.selector;
        res[6] = this.setTransactionLimits.selector;
        res[7] = this.changeLoanTokenNameAndSymbol.selector;
        res[8] = this.pauser.selector;
        return (res, stringToBytes32("LoanTokenSettingsLowerAdmin"));
    }
```
</details>

---    

> ### setAdmin

Set admin account.

```solidity
function setAdmin(address _admin) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _admin | address | The address of the account to grant admin permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setAdmin(address _admin) public onlyOwner {
        admin = _admin;
    }
```
</details>

---    

> ### setPauser

Set pauser account.

```solidity
function setPauser(address _pauser) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _pauser | address | The address of the account to grant pause permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setPauser(address _pauser) public onlyOwner {
        pauser = _pauser;
    }
```
</details>

---    

> ### constructor

Fallback function not allowed

```solidity
function () external nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function() external {
        revert("LoanTokenSettingsLowerAdmin - fallback not allowed");
    }
```
</details>

---    

> ### setupLoanParams

Set loan token parameters.
     *

```solidity
function setupLoanParams(struct LoanParamsStruct.LoanParams[] loanParamsList, bool areTorqueLoans) public nonpayable onlyAdmin 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsList | struct LoanParamsStruct.LoanParams[] | The array of loan parameters. | 
| areTorqueLoans | bool | Whether the loan is a torque loan. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setupLoanParams(
        LoanParamsStruct.LoanParams[] memory loanParamsList,
        bool areTorqueLoans
    ) public onlyAdmin {
        bytes32[] memory loanParamsIdList;
        address _loanTokenAddress = loanTokenAddress;

        for (uint256 i = 0; i < loanParamsList.length; i++) {
            loanParamsList[i].loanToken = _loanTokenAddress;
            loanParamsList[i].maxLoanTerm = areTorqueLoans ? 0 : 28 days;
        }

        loanParamsIdList = ProtocolSettingsLike(sovrynContractAddress).setupLoanParams(
            loanParamsList
        );
        for (uint256 i = 0; i < loanParamsIdList.length; i++) {
            loanParamsIds[
                uint256(
                    keccak256(
                        abi.encodePacked(
                            loanParamsList[i].collateralToken,
                            areTorqueLoans /// isTorqueLoan
                        )
                    )
                )
            ] = loanParamsIdList[i];
        }
    }
```
</details>

---    

> ### disableLoanParams

Disable loan token parameters.
     *

```solidity
function disableLoanParams(address[] collateralTokens, bool[] isTorqueLoans) external nonpayable onlyAdmin 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| collateralTokens | address[] | The array of collateral tokens. | 
| isTorqueLoans | bool[] | Whether the loan is a torque loan. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function disableLoanParams(address[] calldata collateralTokens, bool[] calldata isTorqueLoans)
        external
        onlyAdmin
    {
        require(collateralTokens.length == isTorqueLoans.length, "count mismatch");

        bytes32[] memory loanParamsIdList = new bytes32[](collateralTokens.length);
        for (uint256 i = 0; i < collateralTokens.length; i++) {
            uint256 id =
                uint256(keccak256(abi.encodePacked(collateralTokens[i], isTorqueLoans[i])));
            loanParamsIdList[i] = loanParamsIds[id];
            delete loanParamsIds[id];
        }

        ProtocolSettingsLike(sovrynContractAddress).disableLoanParams(loanParamsIdList);
    }
```
</details>

---    

> ### setDemandCurve

Set loan token parameters about the demand curve.
     *

```solidity
function setDemandCurve(uint256 _baseRate, uint256 _rateMultiplier, uint256 _lowUtilBaseRate, uint256 _lowUtilRateMultiplier, uint256 _targetLevel, uint256 _kinkLevel, uint256 _maxScaleRate) public nonpayable onlyAdmin 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _baseRate | uint256 | The interest rate. | 
| _rateMultiplier | uint256 | The precision multiplier for base rate. | 
| _lowUtilBaseRate | uint256 | The credit utilization rate (CUR) low value. | 
| _lowUtilRateMultiplier | uint256 | The precision multiplier for low util base rate. | 
| _targetLevel | uint256 | The target level. | 
| _kinkLevel | uint256 | The level that interest rates cluster on kinked model. | 
| _maxScaleRate | uint256 | The maximum rate of the scale. | 

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
    ) public onlyAdmin {
        require(_rateMultiplier.add(_baseRate) <= WEI_PERCENT_PRECISION, "curve params too high");
        require(
            _lowUtilRateMultiplier.add(_lowUtilBaseRate) <= WEI_PERCENT_PRECISION,
            "curve params too high"
        );

        require(
            _targetLevel <= WEI_PERCENT_PRECISION && _kinkLevel <= WEI_PERCENT_PRECISION,
            "levels too high"
        );

        baseRate = _baseRate;
        rateMultiplier = _rateMultiplier;
        lowUtilBaseRate = _lowUtilBaseRate;
        lowUtilRateMultiplier = _lowUtilRateMultiplier;

        targetLevel = _targetLevel; /// 80 ether
        kinkLevel = _kinkLevel; /// 90 ether
        maxScaleRate = _maxScaleRate; /// 100 ether
    }
```
</details>

---    

> ### toggleFunctionPause

Set the pause flag for a function to true or false.
     *

```solidity
function toggleFunctionPause(string funcId, bool isPaused) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| funcId | string | The ID of a function, the selector. | 
| isPaused | bool | true/false value of the flag. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function toggleFunctionPause(
        string memory funcId, /// example: "mint(uint256,uint256)"
        bool isPaused
    ) public {
        bool paused;
        require(msg.sender == pauser, "onlyPauser");
        /// keccak256("iToken_FunctionPause")
        bytes32 slot =
            keccak256(
                abi.encodePacked(
                    bytes4(keccak256(abi.encodePacked(funcId))),
                    uint256(0xd46a704bc285dbd6ff5ad3863506260b1df02812f4f857c8cc852317a6ac64f2)
                )
            );
        assembly {
            paused := sload(slot)
        }
        require(paused != isPaused, "isPaused is already set to that value");
        assembly {
            sstore(slot, isPaused)
        }
        emit ToggledFunctionPaused(funcId, !isPaused, isPaused);
    }
```
</details>

---    

> ### setTransactionLimits

```solidity
function setTransactionLimits(address[] addresses, uint256[] limits) public nonpayable onlyAdmin 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| addresses | address[] | The token addresses. | 
| limits | uint256[] | The limit denominated in the currency of the token address. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setTransactionLimits(address[] memory addresses, uint256[] memory limits)
        public
        onlyAdmin
    {
        require(addresses.length == limits.length, "mismatched array lengths");
        for (uint256 i = 0; i < addresses.length; i++) {
            transactionLimit[addresses[i]] = limits[i];
        }
        emit SetTransactionLimits(addresses, limits);
    }
```
</details>

---    

> ### changeLoanTokenNameAndSymbol

Update the loan token parameters.

```solidity
function changeLoanTokenNameAndSymbol(string _name, string _symbol) public nonpayable onlyAdmin 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _name | string | The new name of the loan token. | 
| _symbol | string | The new symbol of the loan token. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function changeLoanTokenNameAndSymbol(string memory _name, string memory _symbol)
        public
        onlyAdmin
    {
        name = _name;
        symbol = _symbol;
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
