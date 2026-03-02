# StakingProxy
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Staking/StakingProxy.sol)

**Inherits:**
[StakingStorageShared](/contracts/governance/Staking/modules/shared/StakingStorageShared.sol/contract.StakingStorageShared.md), [UpgradableProxy](/contracts/proxy/UpgradableProxy.sol/contract.UpgradableProxy.md)

*Staking contract should be upgradable, use UpgradableProxy.
StakingStorage is deployed with the upgradable functionality
by using this contract instead, that inherits from UpgradableProxy
the possibility of being enhanced and re-deployed.*


## Functions
### constructor

Construct a new staking contract.


```solidity
constructor(address SOV) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`SOV`|`address`|The address of the SOV token address.|


