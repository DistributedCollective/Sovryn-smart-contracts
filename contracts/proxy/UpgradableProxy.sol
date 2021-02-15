pragma solidity ^0.5.17;

import "./Proxy.sol";

/**
 * @title Upgradable Proxy Contract
 */
contract UpgradableProxy is Proxy {
	/**
	 * @notice Sets address of the implementation
	 * @param _implementation Address of the implementation
	 */
	function setImplementation(address _implementation) public onlyProxyOwner {
		_setImplementation(_implementation);
	}

	/**
	 * @notice Sets address of the owner
	 * @param _owner Address of the owner
	 */
	function setProxyOwner(address _owner) public onlyProxyOwner {
		_setProxyOwner(_owner);
	}
}
