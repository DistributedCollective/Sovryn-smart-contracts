# FourYearVesting
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/fouryear/FourYearVesting.sol)

**Inherits:**
[FourYearVestingStorage](/contracts/governance/Vesting/fouryear/FourYearVestingStorage.sol/contract.FourYearVestingStorage.md), [UpgradableProxy](/contracts/proxy/UpgradableProxy.sol/contract.UpgradableProxy.md)

A four year vesting contract.

*Vesting contract is upgradable,
Make sure the vesting owner is multisig otherwise it will be
catastrophic.*


## Functions
### constructor

Setup the vesting schedule.


```solidity
constructor(
    address _logic,
    address _SOV,
    address _stakingAddress,
    address _tokenOwner,
    address _feeSharingCollector,
    uint256 _extendDurationFor
) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_logic`|`address`|The address of logic contract.|
|`_SOV`|`address`|The SOV token address.|
|`_stakingAddress`|`address`||
|`_tokenOwner`|`address`|The owner of the tokens.|
|`_feeSharingCollector`|`address`|Fee sharing proxy address.|
|`_extendDurationFor`|`uint256`|Duration till the unlocked tokens are extended.|


### setImplementation

Set address of the implementation - vesting owner.

*Overriding setImplementation function of UpgradableProxy. The logic can only be
modified when both token owner and veting owner approve. Since
setImplementation can only be called by vesting owner, we also need to check
if the new logic is already approved by the token owner.*


```solidity
function setImplementation(address _implementation) public onlyProxyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_implementation`|`address`|Address of the implementation. Must match with what is set by token owner.|


