pragma solidity ^0.5.17;

import "./StakingRewardsOsStorage.sol";
import "../../proxy/UpgradableProxy.sol";

/**
 * @title StakingRewardsOs Proxy contract.
 * @dev StakingRewardsOs contract should be upgradable. Used UpgradableProxy.
 * StakingRewardsOsStorage is deployed with the upgradable functionality
 * by using this contract instead, that inherits from UpgradableProxy with
 * the possibility of being enhanced and re-deployed.
 * */
contract StakingRewardsOsProxy is StakingRewardsOsStorage, UpgradableProxy {}
