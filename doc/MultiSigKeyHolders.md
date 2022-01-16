# Multi Signature Key Holders contract.
 * This contract contains the implementation of functions to add and remove
key holders w/ rBTC and BTC addresses. (MultiSigKeyHolders.sol)

View Source: [contracts/multisig/MultiSigKeyHolders.sol](../contracts/multisig/MultiSigKeyHolders.sol)

**↗ Extends: [Ownable](Ownable.md)**

**MultiSigKeyHolders**

## Structs
### Data

```js
struct Data {
 bool added,
 uint248 index
}
```

## Contract Members
**Constants & Variables**

```js
//public members
uint256 public constant MAX_OWNER_COUNT;
uint256 public ethereumRequired;
uint256 public bitcoinRequired;

//private members
string private constant ERROR_INVALID_ADDRESS;
string private constant ERROR_INVALID_REQUIRED;
mapping(address => struct MultiSigKeyHolders.Data) private isEthereumAddressAdded;
address[] private ethereumAddresses;
mapping(string => struct MultiSigKeyHolders.Data) private isBitcoinAddressAdded;
string[] private bitcoinAddresses;

```

**Events**

```js
event EthereumAddressAdded(address indexed account);
event EthereumAddressRemoved(address indexed account);
event EthereumRequirementChanged(uint256  required);
event BitcoinAddressAdded(string  account);
event BitcoinAddressRemoved(string  account);
event BitcoinRequirementChanged(uint256  required);
```

## Modifiers

- [validRequirement](#validrequirement)

### validRequirement

```js
modifier validRequirement(uint256 ownerCount, uint256 _required) internal
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ownerCount | uint256 |  | 
| _required | uint256 |  | 

## Functions

- [addEthereumAddress(address _address)](#addethereumaddress)
- [addEthereumAddresses(address[] _address)](#addethereumaddresses)
- [_addEthereumAddress(address _address)](#_addethereumaddress)
- [removeEthereumAddress(address _address)](#removeethereumaddress)
- [removeEthereumAddresses(address[] _address)](#removeethereumaddresses)
- [_removeEthereumAddress(address _address)](#_removeethereumaddress)
- [isEthereumAddressOwner(address _address)](#isethereumaddressowner)
- [getEthereumAddresses()](#getethereumaddresses)
- [changeEthereumRequirement(uint256 _required)](#changeethereumrequirement)
- [addBitcoinAddress(string _address)](#addbitcoinaddress)
- [addBitcoinAddresses(string[] _address)](#addbitcoinaddresses)
- [_addBitcoinAddress(string _address)](#_addbitcoinaddress)
- [removeBitcoinAddress(string _address)](#removebitcoinaddress)
- [removeBitcoinAddresses(string[] _address)](#removebitcoinaddresses)
- [_removeBitcoinAddress(string _address)](#_removebitcoinaddress)
- [isBitcoinAddressOwner(string _address)](#isbitcoinaddressowner)
- [getBitcoinAddresses()](#getbitcoinaddresses)
- [changeBitcoinRequirement(uint256 _required)](#changebitcoinrequirement)
- [addEthereumAndBitcoinAddresses(address[] _ethereumAddress, string[] _bitcoinAddress)](#addethereumandbitcoinaddresses)
- [removeEthereumAndBitcoinAddresses(address[] _ethereumAddress, string[] _bitcoinAddress)](#removeethereumandbitcoinaddresses)

### addEthereumAddress

Add rBTC address to the key holders.

```js
function addEthereumAddress(address _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | address | The address to be added. | 

### addEthereumAddresses

Add rBTC addresses to the key holders.

```js
function addEthereumAddresses(address[] _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | address[] | The addresses to be added. | 

### _addEthereumAddress

Internal function to add rBTC address to the key holders.

```js
function _addEthereumAddress(address _address) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | address | The address to be added. | 

### removeEthereumAddress

Remove rBTC address to the key holders.

```js
function removeEthereumAddress(address _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | address | The address to be removed. | 

### removeEthereumAddresses

Remove rBTC addresses to the key holders.

```js
function removeEthereumAddresses(address[] _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | address[] | The addresses to be removed. | 

### _removeEthereumAddress

Internal function to remove rBTC address to the key holders.

```js
function _removeEthereumAddress(address _address) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | address | The address to be removed. | 

### isEthereumAddressOwner

Get whether rBTC address is a key holder.

```js
function isEthereumAddressOwner(address _address) public view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | address | The rBTC address to be checked. | 

### getEthereumAddresses

Get array of rBTC key holders.

```js
function getEthereumAddresses() public view
returns(address[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### changeEthereumRequirement

Set flag ethereumRequired to true/false.

```js
function changeEthereumRequirement(uint256 _required) public nonpayable onlyOwner validRequirement 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _required | uint256 | The new value of the ethereumRequired flag. | 

### addBitcoinAddress

Add bitcoin address to the key holders.

```js
function addBitcoinAddress(string _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | string | The address to be added. | 

### addBitcoinAddresses

Add bitcoin addresses to the key holders.

```js
function addBitcoinAddresses(string[] _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | string[] | The addresses to be added. | 

### _addBitcoinAddress

Internal function to add bitcoin address to the key holders.

```js
function _addBitcoinAddress(string _address) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | string | The address to be added. | 

### removeBitcoinAddress

Remove bitcoin address to the key holders.

```js
function removeBitcoinAddress(string _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | string | The address to be removed. | 

### removeBitcoinAddresses

Remove bitcoin addresses to the key holders.

```js
function removeBitcoinAddresses(string[] _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | string[] | The addresses to be removed. | 

### _removeBitcoinAddress

Internal function to remove bitcoin address to the key holders.

```js
function _removeBitcoinAddress(string _address) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | string | The address to be removed. | 

### isBitcoinAddressOwner

Get whether bitcoin address is a key holder.

```js
function isBitcoinAddressOwner(string _address) public view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | string | The bitcoin address to be checked. | 

### getBitcoinAddresses

Get array of bitcoin key holders.

```js
function getBitcoinAddresses() public view
returns(string[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### changeBitcoinRequirement

Set flag bitcoinRequired to true/false.

```js
function changeBitcoinRequirement(uint256 _required) public nonpayable onlyOwner validRequirement 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _required | uint256 | The new value of the bitcoinRequired flag. | 

### addEthereumAndBitcoinAddresses

Add rBTC and bitcoin addresses to the key holders.

```js
function addEthereumAndBitcoinAddresses(address[] _ethereumAddress, string[] _bitcoinAddress) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _ethereumAddress | address[] | the rBTC addresses to be added. | 
| _bitcoinAddress | string[] | the bitcoin addresses to be added. | 

### removeEthereumAndBitcoinAddresses

Remove rBTC and bitcoin addresses to the key holders.

```js
function removeEthereumAndBitcoinAddresses(address[] _ethereumAddress, string[] _bitcoinAddress) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _ethereumAddress | address[] | The rBTC addresses to be removed. | 
| _bitcoinAddress | string[] | The bitcoin addresses to be removed. | 

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
