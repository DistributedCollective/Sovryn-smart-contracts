pragma solidity ^0.5.17;

import "./StakingStorage.sol";
import "../../proxy/UpgradableProxy.sol";

/**
 * @dev Staking contract should be upgradable, use UpgradableProxy
 */
contract StakingProxy is StakingStorage, UpgradableProxy {
	/**
	 * @notice Construct a new staking contract
	 * @param SOV The address of the SOV token address
	 */
	constructor(address SOV) public {
		SOVToken = IERC20(SOV);
		kickoffTS = block.timestamp;
	}
}
