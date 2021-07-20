pragma solidity ^0.5.17;

import "./StakingRewardsStorage.sol";
import "../../proxy/UpgradableProxy.sol";

/**
 * @title StakingRewards Proxy contract.
 * @dev StakingRewards contract should be upgradable, use UpgradableProxy.
 * StakingRewardsStorage is deployed with the upgradable functionality
 * by using this contract instead, that inherits from UpgradableProxy with
 * the possibility of being enhanced and re-deployed.
 * */
contract StakingRewardsProxy is StakingRewardsStorage, UpgradableProxy {
}
