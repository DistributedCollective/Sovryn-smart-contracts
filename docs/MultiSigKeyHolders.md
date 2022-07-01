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

---    

> ### addEthereumAddress

Add rBTC address to the key holders.

```solidity
function addEthereumAddress(address _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | address | The address to be added. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addEthereumAddress(address _address) public onlyOwner {
        _addEthereumAddress(_address);
    }
```
</details>

---    

> ### addEthereumAddresses

Add rBTC addresses to the key holders.

```solidity
function addEthereumAddresses(address[] _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | address[] | The addresses to be added. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addEthereumAddresses(address[] memory _address) public onlyOwner {
        for (uint256 i = 0; i < _address.length; i++) {
            _addEthereumAddress(_address[i]);
        }
    }
```
</details>

---    

> ### _addEthereumAddress

Internal function to add rBTC address to the key holders.

```solidity
function _addEthereumAddress(address _address) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | address | The address to be added. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _addEthereumAddress(address _address) internal {
        require(_address != address(0), ERROR_INVALID_ADDRESS);

        if (!isEthereumAddressAdded[_address].added) {
            isEthereumAddressAdded[_address] = Data({
                added: true,
                index: uint248(ethereumAddresses.length)
            });
            ethereumAddresses.push(_address);
        }

        emit EthereumAddressAdded(_address);
    }
```
</details>

---    

> ### removeEthereumAddress

Remove rBTC address to the key holders.

```solidity
function removeEthereumAddress(address _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | address | The address to be removed. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeEthereumAddress(address _address) public onlyOwner {
        _removeEthereumAddress(_address);
    }
```
</details>

---    

> ### removeEthereumAddresses

Remove rBTC addresses to the key holders.

```solidity
function removeEthereumAddresses(address[] _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | address[] | The addresses to be removed. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeEthereumAddresses(address[] memory _address) public onlyOwner {
        for (uint256 i = 0; i < _address.length; i++) {
            _removeEthereumAddress(_address[i]);
        }
    }
```
</details>

---    

> ### _removeEthereumAddress

Internal function to remove rBTC address to the key holders.

```solidity
function _removeEthereumAddress(address _address) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | address | The address to be removed. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _removeEthereumAddress(address _address) internal {
        require(_address != address(0), ERROR_INVALID_ADDRESS);

        if (isEthereumAddressAdded[_address].added) {
            uint248 index = isEthereumAddressAdded[_address].index;
            if (index != ethereumAddresses.length - 1) {
                ethereumAddresses[index] = ethereumAddresses[ethereumAddresses.length - 1];
                isEthereumAddressAdded[ethereumAddresses[index]].index = index;
            }
            ethereumAddresses.length--;
            delete isEthereumAddressAdded[_address];
        }

        emit EthereumAddressRemoved(_address);
    }
```
</details>

---    

> ### isEthereumAddressOwner

Get whether rBTC address is a key holder.

```solidity
function isEthereumAddressOwner(address _address) public view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | address | The rBTC address to be checked. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function isEthereumAddressOwner(address _address) public view returns (bool) {
        return isEthereumAddressAdded[_address].added;
    }
```
</details>

---    

> ### getEthereumAddresses

Get array of rBTC key holders.

```solidity
function getEthereumAddresses() public view
returns(address[])
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getEthereumAddresses() public view returns (address[] memory) {
        return ethereumAddresses;
    }
```
</details>

---    

> ### changeEthereumRequirement

Set flag ethereumRequired to true/false.

```solidity
function changeEthereumRequirement(uint256 _required) public nonpayable onlyOwner validRequirement 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _required | uint256 | The new value of the ethereumRequired flag. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function changeEthereumRequirement(uint256 _required)
        public
        onlyOwner
        validRequirement(ethereumAddresses.length, _required)
    {
        ethereumRequired = _required;
        emit EthereumRequirementChanged(_required);
    }
```
</details>

---    

> ### addBitcoinAddress

Add bitcoin address to the key holders.

```solidity
function addBitcoinAddress(string _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | string | The address to be added. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addBitcoinAddress(string memory _address) public onlyOwner {
        _addBitcoinAddress(_address);
    }
```
</details>

---    

> ### addBitcoinAddresses

Add bitcoin addresses to the key holders.

```solidity
function addBitcoinAddresses(string[] _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | string[] | The addresses to be added. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addBitcoinAddresses(string[] memory _address) public onlyOwner {
        for (uint256 i = 0; i < _address.length; i++) {
            _addBitcoinAddress(_address[i]);
        }
    }
```
</details>

---    

> ### _addBitcoinAddress

Internal function to add bitcoin address to the key holders.

```solidity
function _addBitcoinAddress(string _address) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | string | The address to be added. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _addBitcoinAddress(string memory _address) internal {
        require(bytes(_address).length != 0, ERROR_INVALID_ADDRESS);

        if (!isBitcoinAddressAdded[_address].added) {
            isBitcoinAddressAdded[_address] = Data({
                added: true,
                index: uint248(bitcoinAddresses.length)
            });
            bitcoinAddresses.push(_address);
        }

        emit BitcoinAddressAdded(_address);
    }
```
</details>

---    

> ### removeBitcoinAddress

Remove bitcoin address to the key holders.

```solidity
function removeBitcoinAddress(string _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | string | The address to be removed. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeBitcoinAddress(string memory _address) public onlyOwner {
        _removeBitcoinAddress(_address);
    }
```
</details>

---    

> ### removeBitcoinAddresses

Remove bitcoin addresses to the key holders.

```solidity
function removeBitcoinAddresses(string[] _address) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | string[] | The addresses to be removed. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeBitcoinAddresses(string[] memory _address) public onlyOwner {
        for (uint256 i = 0; i < _address.length; i++) {
            _removeBitcoinAddress(_address[i]);
        }
    }
```
</details>

---    

> ### _removeBitcoinAddress

Internal function to remove bitcoin address to the key holders.

```solidity
function _removeBitcoinAddress(string _address) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | string | The address to be removed. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _removeBitcoinAddress(string memory _address) internal {
        require(bytes(_address).length != 0, ERROR_INVALID_ADDRESS);

        if (isBitcoinAddressAdded[_address].added) {
            uint248 index = isBitcoinAddressAdded[_address].index;
            if (index != bitcoinAddresses.length - 1) {
                bitcoinAddresses[index] = bitcoinAddresses[bitcoinAddresses.length - 1];
                isBitcoinAddressAdded[bitcoinAddresses[index]].index = index;
            }
            bitcoinAddresses.length--;
            delete isBitcoinAddressAdded[_address];
        }

        emit BitcoinAddressRemoved(_address);
    }
```
</details>

---    

> ### isBitcoinAddressOwner

Get whether bitcoin address is a key holder.

```solidity
function isBitcoinAddressOwner(string _address) public view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _address | string | The bitcoin address to be checked. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function isBitcoinAddressOwner(string memory _address) public view returns (bool) {
        return isBitcoinAddressAdded[_address].added;
    }
```
</details>

---    

> ### getBitcoinAddresses

Get array of bitcoin key holders.

```solidity
function getBitcoinAddresses() public view
returns(string[])
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getBitcoinAddresses() public view returns (string[] memory) {
        return bitcoinAddresses;
    }
```
</details>

---    

> ### changeBitcoinRequirement

Set flag bitcoinRequired to true/false.

```solidity
function changeBitcoinRequirement(uint256 _required) public nonpayable onlyOwner validRequirement 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _required | uint256 | The new value of the bitcoinRequired flag. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function changeBitcoinRequirement(uint256 _required)
        public
        onlyOwner
        validRequirement(bitcoinAddresses.length, _required)
    {
        bitcoinRequired = _required;
        emit BitcoinRequirementChanged(_required);
    }
```
</details>

---    

> ### addEthereumAndBitcoinAddresses

Add rBTC and bitcoin addresses to the key holders.

```solidity
function addEthereumAndBitcoinAddresses(address[] _ethereumAddress, string[] _bitcoinAddress) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _ethereumAddress | address[] | the rBTC addresses to be added. | 
| _bitcoinAddress | string[] | the bitcoin addresses to be added. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addEthereumAndBitcoinAddresses(
        address[] memory _ethereumAddress,
        string[] memory _bitcoinAddress
    ) public onlyOwner {
        for (uint256 i = 0; i < _ethereumAddress.length; i++) {
            _addEthereumAddress(_ethereumAddress[i]);
        }
        for (uint256 i = 0; i < _bitcoinAddress.length; i++) {
            _addBitcoinAddress(_bitcoinAddress[i]);
        }
    }
```
</details>

---    

> ### removeEthereumAndBitcoinAddresses

Remove rBTC and bitcoin addresses to the key holders.

```solidity
function removeEthereumAndBitcoinAddresses(address[] _ethereumAddress, string[] _bitcoinAddress) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _ethereumAddress | address[] | The rBTC addresses to be removed. | 
| _bitcoinAddress | string[] | The bitcoin addresses to be removed. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeEthereumAndBitcoinAddresses(
        address[] memory _ethereumAddress,
        string[] memory _bitcoinAddress
    ) public onlyOwner {
        for (uint256 i = 0; i < _ethereumAddress.length; i++) {
            _removeEthereumAddress(_ethereumAddress[i]);
        }
        for (uint256 i = 0; i < _bitcoinAddress.length; i++) {
            _removeBitcoinAddress(_bitcoinAddress[i]);
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
