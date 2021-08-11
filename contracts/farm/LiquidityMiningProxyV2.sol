pragma solidity ^0.5.17;

import "./LiquidityMiningStorageV2.sol";
import "../proxy/UpgradableProxy.sol";

/**
 * @dev LiquidityMining contract should be upgradable, use UpgradableProxy
 */
contract LiquidityMiningProxyV2 is LiquidityMiningStorageV2, UpgradableProxy {

}
