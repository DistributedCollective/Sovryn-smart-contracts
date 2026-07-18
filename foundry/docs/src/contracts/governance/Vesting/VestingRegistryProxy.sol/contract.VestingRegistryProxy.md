# VestingRegistryProxy
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/VestingRegistryProxy.sol)

**Inherits:**
[VestingRegistryStorage](/contracts/governance/Vesting/VestingRegistryStorage.sol/contract.VestingRegistryStorage.md), [UpgradableProxy](/contracts/proxy/UpgradableProxy.sol/contract.UpgradableProxy.md)

*Vesting Registry contract should be upgradable, use UpgradableProxy.
VestingRegistryStorage is deployed with the upgradable functionality
by using this contract instead, that inherits from UpgradableProxy
the possibility of being enhanced and re-deployed.*


