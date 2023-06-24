# IModulesProxyRegistry.sol

View Source: [contracts/proxy/modules/interfaces/IModulesProxyRegistry.sol](../contracts/proxy/modules/interfaces/IModulesProxyRegistry.sol)

**↘ Derived Contracts: [ModulesProxyRegistry](ModulesProxyRegistry.md)**

**IModulesProxyRegistry**

**Events**

```js
event AddModule(address indexed moduleAddress);
event ReplaceModule(address indexed oldAddress, address indexed newAddress);
event RemoveModule(address indexed moduleAddress);
event SetModuleFuncImplementation(bytes4 indexed _funcSig, address indexed _oldImplementation, address indexed _newImplementation);
```

## Functions

- [addModule(address _impl)](#addmodule)
- [addModules(address[] _implementations)](#addmodules)
- [replaceModule(address _oldModuleImpl, address _newModuleImpl)](#replacemodule)
- [replaceModules(address[] _implementationsFrom, address[] _implementationsTo)](#replacemodules)
- [removeModule(address _impl)](#removemodule)
- [removeModules(address[] _implementations)](#removemodules)
- [getFuncImplementation(bytes4 _sig)](#getfuncimplementation)
- [canAddModule(address _impl)](#canaddmodule)
- [canNotAddModules(address[] _implementations)](#cannotaddmodules)
- [checkClashingFuncSelectors(address _newModule)](#checkclashingfuncselectors)

---    

> ### addModule

⤿ Overridden Implementation(s): [ModulesProxyRegistry.addModule](ModulesProxyRegistry.md#addmodule)

Add module functions.
 Overriding functions is not allowed. To replace modules use ReplaceModule function.

```solidity
function addModule(address _impl) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _impl | address | Module implementation address | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addModule(address _impl) external;
```
</details>

---    

> ### addModules

⤿ Overridden Implementation(s): [ModulesProxyRegistry.addModules](ModulesProxyRegistry.md#addmodules)

Add modules functions.

```solidity
function addModules(address[] _implementations) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _implementations | address[] | Modules implementation addresses | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addModules(address[] calldata _implementations) external;
```
</details>

---    

> ### replaceModule

⤿ Overridden Implementation(s): [ModulesProxyRegistry.replaceModule](ModulesProxyRegistry.md#replacemodule)

Replace module - remove the previous, add the new one

```solidity
function replaceModule(address _oldModuleImpl, address _newModuleImpl) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _oldModuleImpl | address | Module implementation address to remove | 
| _newModuleImpl | address | Module implementation address to add | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function replaceModule(address _oldModuleImpl, address _newModuleImpl) external;
```
</details>

---    

> ### replaceModules

⤿ Overridden Implementation(s): [ModulesProxyRegistry.replaceModules](ModulesProxyRegistry.md#replacemodules)

Add modules functions.

```solidity
function replaceModules(address[] _implementationsFrom, address[] _implementationsTo) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _implementationsFrom | address[] | Modules to replace | 
| _implementationsTo | address[] | Replacing modules | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function replaceModules(
        address[] calldata _implementationsFrom,
        address[] calldata _implementationsTo
    ) external;
```
</details>

---    

> ### removeModule

⤿ Overridden Implementation(s): [ModulesProxyRegistry.removeModule](ModulesProxyRegistry.md#removemodule)

to disable module - set all its functions implementation to address(0)

```solidity
function removeModule(address _impl) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _impl | address | implementation address | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeModule(address _impl) external;
```
</details>

---    

> ### removeModules

⤿ Overridden Implementation(s): [ModulesProxyRegistry.removeModules](ModulesProxyRegistry.md#removemodules)

Add modules functions.

```solidity
function removeModules(address[] _implementations) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _implementations | address[] | Modules implementation addresses | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeModules(address[] calldata _implementations) external;
```
</details>

---    

> ### getFuncImplementation

⤿ Overridden Implementation(s): [ModulesProxyRegistry.getFuncImplementation](ModulesProxyRegistry.md#getfuncimplementation)

```solidity
function getFuncImplementation(bytes4 _sig) external view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sig | bytes4 | function signature to get impmementation address for | 

**Returns**

function's contract implelementation address

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getFuncImplementation(bytes4 _sig) external view returns (address);
```
</details>

---    

> ### canAddModule

⤿ Overridden Implementation(s): [ModulesProxyRegistry.canAddModule](ModulesProxyRegistry.md#canaddmodule)

verifies if no functions from the module deployed already registered

```solidity
function canAddModule(address _impl) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _impl | address | module implementation address to verify | 

**Returns**

true if module can be added

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function canAddModule(address _impl) external view returns (bool);
```
</details>

---    

> ### canNotAddModules

⤿ Overridden Implementation(s): [ModulesProxyRegistry.canNotAddModules](ModulesProxyRegistry.md#cannotaddmodules)

Multiple modules verification if no functions from the modules already registered

```solidity
function canNotAddModules(address[] _implementations) external view
returns(modules address[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _implementations | address[] | modules implementation addresses to verify | 

**Returns**

True if all modules can be added, false otherwise

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function canNotAddModules(address[] calldata _implementations)
        external
        view
        returns (address[] memory modules);
```
</details>

---    

> ### checkClashingFuncSelectors

⤿ Overridden Implementation(s): [ModulesProxyRegistry.checkClashingFuncSelectors](ModulesProxyRegistry.md#checkclashingfuncselectors)

used externally to verify module being added for clashing

```solidity
function checkClashingFuncSelectors(address _newModule) external view
returns(clashingModules address[], clashingModulesFuncSelectors bytes4[], clashingProxyRegistryFuncSelectors bytes4[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newModule | address | module implementation which functions to verify | 

**Returns**

clashing functions signatures and corresponding modules (contracts) addresses

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function checkClashingFuncSelectors(address _newModule)
        external
        view
        returns (
            address[] memory clashingModules,
            bytes4[] memory clashingModulesFuncSelectors,
            bytes4[] memory clashingProxyRegistryFuncSelectors
        );
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
* [CheckpointsShared](CheckpointsShared.md)
* [Constants](Constants.md)
* [Context](Context.md)
* [DevelopmentFund](DevelopmentFund.md)
* [DummyContract](DummyContract.md)
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
* [FeeSharingCollector](FeeSharingCollector.md)
* [FeeSharingCollectorProxy](FeeSharingCollectorProxy.md)
* [FeeSharingCollectorStorage](FeeSharingCollectorStorage.md)
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
* [IERC1820Registry](IERC1820Registry.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IERC777](IERC777.md)
* [IERC777Recipient](IERC777Recipient.md)
* [IERC777Sender](IERC777Sender.md)
* [IFeeSharingCollector](IFeeSharingCollector.md)
* [IFourYearVesting](IFourYearVesting.md)
* [IFourYearVestingFactory](IFourYearVestingFactory.md)
* [IFunctionsList](IFunctionsList.md)
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
* [IModulesProxyRegistry](IModulesProxyRegistry.md)
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
* [LoanClosingsWithoutInvariantCheck](LoanClosingsWithoutInvariantCheck.md)
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
* [MarginTradeStructHelpers](MarginTradeStructHelpers.md)
* [Medianizer](Medianizer.md)
* [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
* [ModulesCommonEvents](ModulesCommonEvents.md)
* [ModulesProxy](ModulesProxy.md)
* [ModulesProxyRegistry](ModulesProxyRegistry.md)
* [MultiSigKeyHolders](MultiSigKeyHolders.md)
* [MultiSigWallet](MultiSigWallet.md)
* [Mutex](Mutex.md)
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
* [ProxyOwnable](ProxyOwnable.md)
* [ReentrancyGuard](ReentrancyGuard.md)
* [RewardHelper](RewardHelper.md)
* [RSKAddrValidator](RSKAddrValidator.md)
* [SafeERC20](SafeERC20.md)
* [SafeMath](SafeMath.md)
* [SafeMath96](SafeMath96.md)
* [setGet](setGet.md)
* [SharedReentrancyGuard](SharedReentrancyGuard.md)
* [SignedSafeMath](SignedSafeMath.md)
* [SOV](SOV.md)
* [sovrynProtocol](sovrynProtocol.md)
* [StakingAdminModule](StakingAdminModule.md)
* [StakingGovernanceModule](StakingGovernanceModule.md)
* [StakingInterface](StakingInterface.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingShared](StakingShared.md)
* [StakingStakeModule](StakingStakeModule.md)
* [StakingStorageModule](StakingStorageModule.md)
* [StakingStorageShared](StakingStorageShared.md)
* [StakingVestingModule](StakingVestingModule.md)
* [StakingWithdrawModule](StakingWithdrawModule.md)
* [State](State.md)
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
* [Utils](Utils.md)
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
* [WeightedStakingModule](WeightedStakingModule.md)
* [WRBTC](WRBTC.md)
