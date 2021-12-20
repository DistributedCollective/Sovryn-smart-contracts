pragma solidity ^0.5.17;

import "./StakingRewardsStorageTN.sol";
import "../../proxy/UpgradableProxy.sol";

/**
 * @title StakingRewardsTN Proxy contract.
 * @dev StakingRewardsTN contract should be upgradable. Used UpgradableProxy.
 * StakingRewardsStorageTN is deployed with the upgradable functionality
 * by using this contract instead, that inherits from UpgradableProxy with
 * the possibility of being enhanced and re-deployed.
 * */
contract StakingRewardsProxyTN is StakingRewardsStorageTN, UpgradableProxy {

}
