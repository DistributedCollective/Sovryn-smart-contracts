pragma solidity ^0.5.17;

import "./FeeSharingProxyStorage.sol";
import "../../proxy/UpgradableProxy.sol";

/**
 * @title FeeSharingProxy contract.
 * @dev FeeSharingProxy contract should be upgradable, use UpgradableProxy.
 * FeeSharingProxyStorage is deployed with the upgradable functionality
 * by using this contract instead, that inherits from UpgradableProxy
 * the possibility of being enhanced and re-deployed.
 * */
contract FeeSharingProxy is FeeSharingProxyStorage, UpgradableProxy {
	/**
	 * @notice Construct a new feeSharingProxy contract.
	 * @param _protocol The address of the sovryn protocol.
	 * @param _staking The address of the staking
	 */
	constructor(IProtocol _protocol, IStaking _staking) public {
		protocol = _protocol;
		staking = _staking;
	}
}
