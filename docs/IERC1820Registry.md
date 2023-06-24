# IERC1820Registry.sol

View Source: [contracts/testhelpers/interfaces/IERC1820Registry.sol](../contracts/testhelpers/interfaces/IERC1820Registry.sol)

**IERC1820Registry**

Interface of the global ERC1820 Registry, as defined in the
https://eips.ethereum.org/EIPS/eip-1820[EIP]. Accounts may register
implementers for interfaces in this registry, as well as query support.
 * Implementers may be shared by multiple accounts, and can also implement more
than a single interface for each account. Contracts can implement interfaces
for themselves, but externally-owned accounts (EOA) must delegate this to a
contract.
 * {IERC165} interfaces can also be queried via the registry.
 * For an in-depth explanation and source code analysis, see the EIP text.

**Events**

```js
event InterfaceImplementerSet(address indexed account, bytes32 indexed interfaceHash, address indexed implementer);
event ManagerChanged(address indexed account, address indexed newManager);
```

## Functions

- [setManager(address account, address newManager)](#setmanager)
- [getManager(address account)](#getmanager)
- [setInterfaceImplementer(address account, bytes32 interfaceHash, address implementer)](#setinterfaceimplementer)
- [getInterfaceImplementer(address account, bytes32 interfaceHash)](#getinterfaceimplementer)
- [interfaceHash(string interfaceName)](#interfacehash)
- [updateERC165Cache(address account, bytes4 interfaceId)](#updateerc165cache)
- [implementsERC165Interface(address account, bytes4 interfaceId)](#implementserc165interface)
- [implementsERC165InterfaceNoCache(address account, bytes4 interfaceId)](#implementserc165interfacenocache)

---    

> ### setManager

Sets `newManager` as the manager for `account`. A manager of an
account is able to set interface implementers for it.
     * By default, each account is its own manager. Passing a value of `0x0` in
`newManager` will reset the manager to this initial state.
     * Emits a {ManagerChanged} event.
     * Requirements:
     * - the caller must be the current manager for `account`.

```solidity
function setManager(address account, address newManager) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address |  | 
| newManager | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setManager(address account, address newManager) external;
```
</details>

---    

> ### getManager

Returns the manager for `account`.
     * See {setManager}.

```solidity
function getManager(address account) external view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getManager(address account) external view returns (address);
```
</details>

---    

> ### setInterfaceImplementer

Sets the `implementer` contract as `account`'s implementer for
`interfaceHash`.
     * `account` being the zero address is an alias for the caller's address.
The zero address can also be used in `implementer` to remove an old one.
     * See {interfaceHash} to learn how these are created.
     * Emits an {InterfaceImplementerSet} event.
     * Requirements:
     * - the caller must be the current manager for `account`.
- `interfaceHash` must not be an {IERC165} interface id (i.e. it must not
end in 28 zeroes).
- `implementer` must implement {IERC1820Implementer} and return true when
queried for support, unless `implementer` is the caller. See
{IERC1820Implementer-canImplementInterfaceForAddress}.

```solidity
function setInterfaceImplementer(address account, bytes32 interfaceHash, address implementer) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address |  | 
| interfaceHash | bytes32 |  | 
| implementer | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setInterfaceImplementer(
        address account,
        bytes32 interfaceHash,
        address implementer
    ) external;
```
</details>

---    

> ### getInterfaceImplementer

Returns the implementer of `interfaceHash` for `account`. If no such
implementer is registered, returns the zero address.
     * If `interfaceHash` is an {IERC165} interface id (i.e. it ends with 28
zeroes), `account` will be queried for support of it.
     * `account` being the zero address is an alias for the caller's address.

```solidity
function getInterfaceImplementer(address account, bytes32 interfaceHash) external view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address |  | 
| interfaceHash | bytes32 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getInterfaceImplementer(address account, bytes32 interfaceHash)
        external
        view
        returns (address);
```
</details>

---    

> ### interfaceHash

Returns the interface hash for an `interfaceName`, as defined in the
corresponding
https://eips.ethereum.org/EIPS/eip-1820#interface-name[section of the EIP].

```solidity
function interfaceHash(string interfaceName) external pure
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| interfaceName | string |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function interfaceHash(string calldata interfaceName) external pure returns (bytes32);
```
</details>

---    

> ### updateERC165Cache

Updates the cache with whether the contract implements an ERC165 interface or not.

```solidity
function updateERC165Cache(address account, bytes4 interfaceId) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | Address of the contract for which to update the cache. | 
| interfaceId | bytes4 | ERC165 interface for which to update the cache. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function updateERC165Cache(address account, bytes4 interfaceId) external;
```
</details>

---    

> ### implementsERC165Interface

Checks whether a contract implements an ERC165 interface or not.
 If the result is not cached a direct lookup on the contract address is performed.
 If the result is not cached or the cached value is out-of-date, the cache MUST be updated manually by calling
 {updateERC165Cache} with the contract address.

```solidity
function implementsERC165Interface(address account, bytes4 interfaceId) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | Address of the contract to check. | 
| interfaceId | bytes4 | ERC165 interface to check. | 

**Returns**

True if `account` implements `interfaceId`, false otherwise.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function implementsERC165Interface(address account, bytes4 interfaceId)
        external
        view
        returns (bool);
```
</details>

---    

> ### implementsERC165InterfaceNoCache

Checks whether a contract implements an ERC165 interface or not without using nor updating the cache.

```solidity
function implementsERC165InterfaceNoCache(address account, bytes4 interfaceId) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | Address of the contract to check. | 
| interfaceId | bytes4 | ERC165 interface to check. | 

**Returns**

True if `account` implements `interfaceId`, false otherwise.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function implementsERC165InterfaceNoCache(address account, bytes4 interfaceId)
        external
        view
        returns (bool);
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
