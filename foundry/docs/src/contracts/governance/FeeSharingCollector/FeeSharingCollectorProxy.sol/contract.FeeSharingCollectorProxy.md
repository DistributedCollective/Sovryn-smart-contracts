# FeeSharingCollectorProxy
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/FeeSharingCollector/FeeSharingCollectorProxy.sol)

**Inherits:**
[FeeSharingCollectorStorage](/contracts/governance/FeeSharingCollector/FeeSharingCollectorStorage.sol/contract.FeeSharingCollectorStorage.md), [UpgradableProxy](/contracts/proxy/UpgradableProxy.sol/contract.UpgradableProxy.md)

*FeeSharingCollectorProxy contract should be upgradable, use UpgradableProxy.
FeeSharingCollectorStorage is deployed with the upgradable functionality
by using this contract instead, that inherits from UpgradableProxy
the possibility of being enhanced and re-deployed.*


## Functions
### constructor

Construct a new feeSharingCollectorProxy contract.


```solidity
constructor(IProtocol _protocol, IStaking _staking) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_protocol`|`IProtocol`|The address of the sovryn protocol.|
|`_staking`|`IStaking`|The address of the staking|


