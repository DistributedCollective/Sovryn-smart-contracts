# StakingRewardsOsProxy
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/StakingRewards/StakingRewardsOsProxy.sol)

**Inherits:**
[StakingRewardsOsStorage](/contracts/governance/StakingRewards/StakingRewardsOsStorage.sol/contract.StakingRewardsOsStorage.md), [UpgradableProxy](/contracts/proxy/UpgradableProxy.sol/contract.UpgradableProxy.md)

*StakingRewardsOs contract should be upgradable. Used UpgradableProxy.
StakingRewardsOsStorage is deployed with the upgradable functionality
by using this contract instead, that inherits from UpgradableProxy with
the possibility of being enhanced and re-deployed.*


