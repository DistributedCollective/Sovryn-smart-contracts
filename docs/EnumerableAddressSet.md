# EnumerableAddressSet.sol

View Source: [contracts/mixins/EnumerableAddressSet.sol](../contracts/mixins/EnumerableAddressSet.sol)

**EnumerableAddressSet**

Based on Library for managing
https://en.wikipedia.org/wiki/Set_(abstract_data_type)[sets] of primitive
types.
 * Sets have the following properties:
 * - Elements are added, removed, and checked for existence in constant time
(O(1)).
- Elements are enumerated in O(n). No guarantees are made on the ordering.
 * As of v2.5.0, only `address` sets are supported.
 * Include with `using EnumerableSet for EnumerableSet.AddressSet;`.
 * _Available since v2.5.0._

## Structs
### AddressSet

```js
struct AddressSet {
 mapping(address => uint256) index,
 address[] values
}
```

## Functions

- [add(struct EnumerableAddressSet.AddressSet set, address value)](#add)
- [remove(struct EnumerableAddressSet.AddressSet set, address value)](#remove)
- [contains(struct EnumerableAddressSet.AddressSet set, address value)](#contains)
- [enumerate(struct EnumerableAddressSet.AddressSet set)](#enumerate)
- [enumerateChunk(struct EnumerableAddressSet.AddressSet set, uint256 start, uint256 count)](#enumeratechunk)
- [length(struct EnumerableAddressSet.AddressSet set)](#length)
- [get(struct EnumerableAddressSet.AddressSet set, uint256 index)](#get)

---    

> ### add

Add a value to a set. O(1).
Returns false if the value was already in the set.

```solidity
function add(struct EnumerableAddressSet.AddressSet set, address value) internal nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableAddressSet.AddressSet |  | 
| value | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function add(AddressSet storage set, address value) internal returns (bool) {
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

> ### remove

Removes a value from a set. O(1).
Returns false if the value was not present in the set.

```solidity
function remove(struct EnumerableAddressSet.AddressSet set, address value) internal nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableAddressSet.AddressSet |  | 
| value | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function remove(AddressSet storage set, address value) internal returns (bool) {
        if (contains(set, value)) {
            uint256 toDeleteIndex = set.index[value] - 1;
            uint256 lastIndex = set.values.length - 1;

            // If the element we're deleting is the last one, we can just remove it without doing a swap
            if (lastIndex != toDeleteIndex) {
                address lastValue = set.values[lastIndex];

                // Move the last value to the index where the deleted value is
                set.values[toDeleteIndex] = lastValue;
                // Update the index for the moved value
                set.index[lastValue] = toDeleteIndex + 1; // All indexes are 1-based
            }

            // Delete the index entry for the deleted value
            delete set.index[value];

            // Delete the old entry for the moved value
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

Returns true if the value is in the set. O(1).

```solidity
function contains(struct EnumerableAddressSet.AddressSet set, address value) internal view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableAddressSet.AddressSet |  | 
| value | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function contains(AddressSet storage set, address value) internal view returns (bool) {
        return set.index[value] != 0;
    }
```
</details>

---    

> ### enumerate

Returns an array with all values in the set. O(N).
Note that there are no guarantees on the ordering of values inside the
array, and it may change when more values are added or removed.
WARNING: This function may run out of gas on large sets: use {length} and
{get} instead in these cases.

```solidity
function enumerate(struct EnumerableAddressSet.AddressSet set) internal view
returns(address[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableAddressSet.AddressSet |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function enumerate(AddressSet storage set) internal view returns (address[] memory) {
        address[] memory output = new address[](set.values.length);
        for (uint256 i; i < set.values.length; i++) {
            output[i] = set.values[i];
        }
        return output;
    }
```
</details>

---    

> ### enumerateChunk

Returns a chunk of array as recommended in enumerate() to avoid running of gas.
Note that there are no guarantees on the ordering of values inside the
array, and it may change when more values are added or removed.
WARNING: This function may run out of gas on large sets: use {length} and
{get} instead in these cases.

```solidity
function enumerateChunk(struct EnumerableAddressSet.AddressSet set, uint256 start, uint256 count) internal view
returns(output address[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableAddressSet.AddressSet |  | 
| start | uint256 | start index of chunk | 
| count | uint256 | num of element to return; if count == 0 then returns all the elements from the | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function enumerateChunk(
        AddressSet storage set,
        uint256 start,
        uint256 count
    ) internal view returns (address[] memory output) {
        uint256 end = start + count;
        require(end >= start, "addition overflow");
        end = (set.values.length < end || count == 0) ? set.values.length : end;
        if (end == 0 || start >= end) {
            return output;
        }

        output = new address[](end - start);
        for (uint256 i; i < end - start; i++) {
            output[i] = set.values[i + start];
        }
        return output;
    }
```
</details>

---    

> ### length

Returns the number of elements on the set. O(1).

```solidity
function length(struct EnumerableAddressSet.AddressSet set) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableAddressSet.AddressSet |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function length(AddressSet storage set) internal view returns (uint256) {
        return set.values.length;
    }
```
</details>

---    

> ### get

Returns the element stored at position `index` in the set. O(1).
Note that there are no guarantees on the ordering of values inside the
array, and it may change when more values are added or removed.
     * Requirements:
     * - `index` must be strictly less than {length}.

```solidity
function get(struct EnumerableAddressSet.AddressSet set, uint256 index) internal view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| set | struct EnumerableAddressSet.AddressSet |  | 
| index | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function get(AddressSet storage set, uint256 index) internal view returns (address) {
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
