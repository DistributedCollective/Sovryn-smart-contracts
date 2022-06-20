# Loan Token Logic Beacon contract.
 * (ILoanTokenLogicModules.sol)

View Source: [contracts/connectors/loantoken/LoanTokenLogicBeacon.sol](../contracts/connectors/loantoken/LoanTokenLogicBeacon.sol)

**↗ Extends: [PausableOz](PausableOz.md)**

**ILoanTokenLogicModules**

This contract stored the target logic implementation of LoanTokens which has the same logic implementation (LoanTokenLogicLM / LoanTokenLogicWrbtc)
Apart from storing the target logic implementation, this contract also has a pause functionality.
By implementing pause/unpause functionality in this beacon contract, we can pause the loan token that has the same Logic (LoanTokenLogicLM / LoanTokenLogicWrbtc) at one call.
Meanwhile the pause/unpause function in the LoanTokenLogicProxy is used to pause/unpause specific LoanToken

## Structs
### LoanTokenLogicModuleUpdate

```js
struct LoanTokenLogicModuleUpdate {
 address implementation,
 uint256 updateTimestamp
}
```

## Contract Members
**Constants & Variables**

```js
//private members
mapping(bytes4 => address) private logicTargets;
mapping(bytes32 => struct EnumerableBytes4Set.Bytes4Set) private activeFuncSignatureList;

//public members
mapping(bytes32 => struct LoanTokenLogicBeacon.LoanTokenLogicModuleUpdate[]) public moduleUpgradeLog;
mapping(bytes32 => uint256) public activeModuleIndex;

```

## Modifiers

- [whenNotPaused](#whennotpaused)

### whenNotPaused

Modifier to make a function callable only when the contract is not paused.
This is the overriden function from the pausable contract, so that we can use custom error message.

```js
modifier whenNotPaused() internal
```

## Functions

- [registerLoanTokenModule(address loanTokenModuleAddress)](#registerloantokenmodule)
- [_registerLoanTokenModule(address loanTokenModuleAddress)](#_registerloantokenmodule)
- [getActiveFuncSignatureList(bytes32 moduleName)](#getactivefuncsignaturelist)
- [getModuleUpgradeLogLength(bytes32 moduleName)](#getmoduleupgradeloglength)
- [rollback(bytes32 moduleName, uint256 index)](#rollback)
- [getTarget(bytes4 sig)](#gettarget)
- [getListFunctionSignatures()](#getlistfunctionsignatures)

---    

> ### registerLoanTokenModule

Register the loanTokenModule (LoanTokenSettingsLowerAdmin, LoanTokenLogicLM / LoanTokenLogicWrbtc, etc)
     *

```solidity
function registerLoanTokenModule(address loanTokenModuleAddress) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanTokenModuleAddress | address | The module target address | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function registerLoanTokenModule(address loanTokenModuleAddress) external onlyOwner {
        bytes32 moduleName = _registerLoanTokenModule(loanTokenModuleAddress);

        // Store the upgrade to the log
        moduleUpgradeLog[moduleName].push(
            LoanTokenLogicModuleUpdate(loanTokenModuleAddress, block.timestamp)
        );
        activeModuleIndex[moduleName] = moduleUpgradeLog[moduleName].length - 1;
    }
```
</details>

---    

> ### _registerLoanTokenModule

Register the loanTokenModule (LoanTokenSettingsLowerAdmin, LoanTokenLogicLM / LoanTokenLogicWrbtc, etc)
     *

```solidity
function _registerLoanTokenModule(address loanTokenModuleAddress) private nonpayable
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanTokenModuleAddress | address | the target logic of the loan token module      * | 

**Returns**

the module name

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _registerLoanTokenModule(address loanTokenModuleAddress) private returns (bytes32) {
        require(
            Address.isContract(loanTokenModuleAddress),
            "LoanTokenModuleAddress is not a contract"
        );

        // Get the list of function signature on this loanTokenModulesAddress
        (bytes4[] memory functionSignatureList, bytes32 moduleName) =
            ILoanTokenLogicModules(loanTokenModuleAddress).getListFunctionSignatures();

        /// register / update the module function signature address implementation
        for (uint256 i; i < functionSignatureList.length; i++) {
            require(functionSignatureList[i] != bytes4(0x0), "ERR_EMPTY_FUNC_SIGNATURE");
            logicTargets[functionSignatureList[i]] = loanTokenModuleAddress;
            if (!activeFuncSignatureList[moduleName].contains(functionSignatureList[i]))
                activeFuncSignatureList[moduleName].addBytes4(functionSignatureList[i]);
        }

        /// delete the "removed" module function signature in the current implementation
        bytes4[] memory activeSignatureListEnum =
            activeFuncSignatureList[moduleName].enumerate(
                0,
                activeFuncSignatureList[moduleName].length()
            );
        for (uint256 i; i < activeSignatureListEnum.length; i++) {
            bytes4 activeSigBytes = activeSignatureListEnum[i];
            if (logicTargets[activeSigBytes] != loanTokenModuleAddress) {
                logicTargets[activeSigBytes] = address(0);
                activeFuncSignatureList[moduleName].removeBytes4(activeSigBytes);
            }
        }

        return moduleName;
    }
```
</details>

---    

> ### getActiveFuncSignatureList

get all active function signature list based on the module name.
     *

```solidity
function getActiveFuncSignatureList(bytes32 moduleName) public view
returns(signatureList bytes4[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| moduleName | bytes32 | in bytes32.      * | 

**Returns**

the array of function signature.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getActiveFuncSignatureList(bytes32 moduleName)
        public
        view
        returns (bytes4[] memory signatureList)
    {
        signatureList = activeFuncSignatureList[moduleName].enumerate(
            0,
            activeFuncSignatureList[moduleName].length()
        );
        return signatureList;
    }
```
</details>

---    

> ### getModuleUpgradeLogLength

Get total length of the module upgrade log.
     *

```solidity
function getModuleUpgradeLogLength(bytes32 moduleName) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| moduleName | bytes32 | in bytes32.      * | 

**Returns**

length of module upgrade log.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getModuleUpgradeLogLength(bytes32 moduleName) external view returns (uint256) {
        return moduleUpgradeLog[moduleName].length;
    }
```
</details>

---    

> ### rollback

This function will rollback particular module to the spesific index / version of deployment
     *

```solidity
function rollback(bytes32 moduleName, uint256 index) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| moduleName | bytes32 | Name of module in bytes32 format | 
| index | uint256 | index / version of previous deployment | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function rollback(bytes32 moduleName, uint256 index) external onlyOwner {
        address loanTokenModuleAddress = moduleUpgradeLog[moduleName][index].implementation;
        moduleName = _registerLoanTokenModule(loanTokenModuleAddress);
        activeModuleIndex[moduleName] = index;
    }
```
</details>

---    

> ### getTarget

External getter for target addresses.

```solidity
function getTarget(bytes4 sig) external view whenNotPaused 
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sig | bytes4 | The signature. | 

**Returns**

The address for a given signature.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getTarget(bytes4 sig) external view whenNotPaused returns (address) {
        return logicTargets[sig];
    }
```
</details>

---    

> ### getListFunctionSignatures

```solidity
function getListFunctionSignatures() external pure
returns(bytes4[], moduleName bytes32)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getListFunctionSignatures()
        external
        pure
        returns (bytes4[] memory, bytes32 moduleName);
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
