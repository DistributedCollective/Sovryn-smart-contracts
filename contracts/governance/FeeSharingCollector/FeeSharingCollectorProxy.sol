pragma solidity ^0.5.17;

import "./FeeSharingCollectorStorage.sol";
import "../../proxy/UpgradableProxy.sol";

/**
 * @title FeeSharingCollectorProxy contract.
 * @dev FeeSharingCollectorProxy contract should be upgradable, use UpgradableProxy.
 * FeeSharingCollectorStorage is deployed with the upgradable functionality
 * by using this contract instead, that inherits from UpgradableProxy
 * the possibility of being enhanced and re-deployed.
 * */
contract FeeSharingCollectorProxy is FeeSharingCollectorStorage, UpgradableProxy {
    /**
     * @notice Construct a new feeSharingCollectorProxy contract.
     * @param _protocol The address of the sovryn protocol.
     * @param _staking The address of the staking
     */
    constructor(IProtocol _protocol, IStaking _staking) public {
        protocol = _protocol;
        staking = _staking;
    }
}
