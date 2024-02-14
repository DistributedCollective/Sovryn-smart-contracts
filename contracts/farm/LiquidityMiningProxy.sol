pragma solidity ^0.5.17;

import "./LiquidityMiningStorage.sol";
import "../proxy/UpgradableProxy.sol";

/**
 * @dev LiquidityMining contract should be upgradable, use UpgradableProxy
 */
contract LiquidityMiningProxy is LiquidityMiningStorage, UpgradableProxy {

}
