pragma solidity ^0.5.17;

import "./StakingStorage.sol";
import "../../proxy/UpgradableProxy.sol";

/**
 * @title Staking Proxy contract.
 * @dev Staking contract should be upgradable, use UpgradableProxy.
 * StakingStorage is deployed with the upgradable functionality
 * by using this contract instead, that inherits from UpgradableProxy
 * the possibility of being enhanced and re-deployed.
 * */
contract StakingProxy is StakingStorage, UpgradableProxy {
    /**
     * @notice Construct a new staking contract.
     * @param SOV The address of the SOV token address.
     */
    constructor(address SOV) public {
        SOVToken = IERC20(SOV);
        kickoffTS = block.timestamp;
    }
}
