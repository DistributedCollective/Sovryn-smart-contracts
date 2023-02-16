# Library for managing loan sets.
 * (EnumerableBytes4Set.sol)

View Source: [contracts/mixins/EnumerableBytes4Set.sol](../contracts/mixins/EnumerableBytes4Set.sol)

**EnumerableBytes4Set**

Sets have the following properties:
 * - Elements are added, removed, and checked for existence in constant time
(O(1)).
- Elements are enumerated in O(n). No guarantees are made on the ordering.
 * Include with `using EnumerableBytes4Set for EnumerableBytes4Set.Bytes4Set;`.

## Structs
### Bytes4Set

```js
struct Bytes4Set {
 mapping(bytes4 => uint256) index,
 bytes4[] values
}
```

## Functions

- [addAddress(struct EnumerableBytes4Set.Bytes4Set set, address addrvalue)](#addaddress)
- [addBytes4(struct EnumerableBytes4Set.Bytes4Set set, bytes4 value)](#addbytes4)
- [removeAddress(struct EnumerableBytes4Set.Bytes4Set set, address addrvalue)](#removeaddress)
- [removeBytes4(struct EnumerableBytes4Set.Bytes4Set set, bytes4 value)](#removebytes4)
- [contains(struct EnumerableBytes4Set.Bytes4Set set, bytes4 value)](#contains)
- [containsAddress(struct EnumerableBytes4Set.Bytes4Set set, address addrvalue)](#containsaddress)
- [enumerate(struct EnumerableBytes4Set.Bytes4Set set, uint256 start, uint256 count)](#enumerate)
- [length(struct EnumerableBytes4Set.Bytes4Set set)](#length)
- [get(struct EnumerableBytes4Set.Bytes4Set set, uint256 index)](#get)

---    

> ### addAddress

Add an address value to a set. O(1).
     *

```solidity
function addAddress(struct EnumerableBytes4Set.Bytes4Set set, address addrvalue) internal nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values. | 
| addrvalue | address | The address to add.      * | 

**Returns**

False if the value was already in the set.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addAddress(Bytes4Set storage set, address addrvalue) internal returns (bool) {
        bytes4 value;
        assembly {
            value := addrvalue
        }
        return addBytes4(set, value);
    }
```
</details>

---    

> ### addBytes4

Add a value to a set. O(1).
     *

```solidity
function addBytes4(struct EnumerableBytes4Set.Bytes4Set set, bytes4 value) internal nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values. | 
| value | bytes4 | The new value to add.      * | 

**Returns**

False if the value was already in the set.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addBytes4(Bytes4Set storage set, bytes4 value) internal returns (bool) {
        if (!contains(set, value)) {
            set.index[value] = set.values.push(value);
            return true;
        } else {
            return false;
        }
    }
```
</details>

---    

> ### removeAddress

Remove an address value from a set. O(1).
     *

```solidity
function removeAddress(struct EnumerableBytes4Set.Bytes4Set set, address addrvalue) internal nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values. | 
| addrvalue | address | The address to remove.      * | 

**Returns**

False if the address was not present in the set.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeAddress(Bytes4Set storage set, address addrvalue) internal returns (bool) {
        bytes4 value;
        assembly {
            value := addrvalue
        }
        return removeBytes4(set, value);
    }
```
</details>

---    

> ### removeBytes4

Remove a value from a set. O(1).
     *

```solidity
function removeBytes4(struct EnumerableBytes4Set.Bytes4Set set, bytes4 value) internal nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values. | 
| value | bytes4 | The value to remove.      * | 

**Returns**

False if the value was not present in the set.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeBytes4(Bytes4Set storage set, bytes4 value) internal returns (bool) {
        if (contains(set, value)) {
            uint256 toDeleteIndex = set.index[value] - 1;
            uint256 lastIndex = set.values.length - 1;

            /// If the element we're deleting is the last one,
            /// we can just remove it without doing a swap.
            if (lastIndex != toDeleteIndex) {
                bytes4 lastValue = set.values[lastIndex];

                /// Move the last value to the index where the deleted value is.
                set.values[toDeleteIndex] = lastValue;

                /// Update the index for the moved value.
                set.index[lastValue] = toDeleteIndex + 1; // All indexes are 1-based
            }

            /// Delete the index entry for the deleted value.
            delete set.index[value];

            /// Delete the old entry for the moved value.
            set.values.pop();

            return true;
        } else {
            return false;
        }
    }
```
</details>

---    

> ### contains

Find out whether a value exists in the set.
     *

```solidity
function contains(struct EnumerableBytes4Set.Bytes4Set set, bytes4 value) internal view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values. | 
| value | bytes4 | The value to find.      * | 

**Returns**

True if the value is in the set. O(1).

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function contains(Bytes4Set storage set, bytes4 value) internal view returns (bool) {
        return set.index[value] != 0;
    }
```
</details>

---    

> ### containsAddress

Returns true if the value is in the set. O(1).

```solidity
function containsAddress(struct EnumerableBytes4Set.Bytes4Set set, address addrvalue) internal view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set |  | 
| addrvalue | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function containsAddress(Bytes4Set storage set, address addrvalue)
        internal
        view
        returns (bool)
    {
        bytes4 value;
        assembly {
            value := addrvalue
        }
        return set.index[value] != 0;
    }
```
</details>

---    

> ### enumerate

Get all set values.
     *

```solidity
function enumerate(struct EnumerableBytes4Set.Bytes4Set set, uint256 start, uint256 count) internal view
returns(output bytes4[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values. | 
| start | uint256 | The offset of the returning set. | 
| count | uint256 | The limit of number of values to return.      * | 

**Returns**

An array with all values in the set. O(N).
     *

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function enumerate(
        Bytes4Set storage set,
        uint256 start,
        uint256 count
    ) internal view returns (bytes4[] memory output) {
        uint256 end = start + count;
        require(end >= start, "addition overflow");
        end = set.values.length < end ? set.values.length : end;
        if (end == 0 || start >= end) {
            return output;
        }

        output = new bytes4[](end - start);
        for (uint256 i; i < end - start; i++) {
            output[i] = set.values[i + start];
        }
        return output;
    }
```
</details>

---    

> ### length

Get the legth of the set.
     *

```solidity
function length(struct EnumerableBytes4Set.Bytes4Set set) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values.      * | 

**Returns**

the number of elements on the set. O(1).

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function length(Bytes4Set storage set) internal view returns (uint256) {
        return set.values.length;
    }
```
</details>

---    

> ### get

Get an item from the set by its index.
     *

```solidity
function get(struct EnumerableBytes4Set.Bytes4Set set, uint256 index) internal view
returns(bytes4)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableBytes4Set.Bytes4Set | The set of values. | 
| index | uint256 | The index of the value to return.      * | 

**Returns**

the element stored at position `index` in the set. O(1).

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function get(Bytes4Set storage set, uint256 index) internal view returns (bytes4) {
        return set.values[index];
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
