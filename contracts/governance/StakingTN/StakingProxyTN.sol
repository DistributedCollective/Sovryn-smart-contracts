pragma solidity ^0.5.17;

import "./StakingStorageTN.sol";
import "../../proxy/UpgradableProxy.sol";

/**
 * @title StakingTN Proxy contract.
 * @dev StakingTN contract should be upgradable, use UpgradableProxy.
 * StakingStorageTN is deployed with the upgradable functionality
 * by using this contract instead, that inherits from UpgradableProxy
 * the possibility of being enhanced and re-deployed.
 * */
contract StakingProxyTN is StakingStorageTN, UpgradableProxy {
	/**
	 * @notice Construct a new staking contract.
	 * @param SOV The address of the SOV token address.
	 */
	constructor(address SOV) public {
		SOVToken = IERC20(SOV);
		kickoffTS = block.timestamp;
	}
}
