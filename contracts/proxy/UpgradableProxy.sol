pragma solidity ^0.5.17;

import "./Proxy.sol";

/**
 * @title Upgradable Proxy contract.
 * @notice A disadvantage of the immutable ledger is that nobody can change the
 * source code of a smart contract after it’s been deployed. In order to fix
 * bugs or introduce new features, smart contracts need to be upgradable somehow.
 *
 * Although it is not possible to upgrade the code of an already deployed smart
 * contract, it is possible to set-up a proxy contract architecture that will
 * allow to use new deployed contracts as if the main logic had been upgraded.
 *
 * A proxy architecture pattern is such that all message calls go through a
 * Proxy contract that will redirect them to the latest deployed contract logic.
 * To upgrade, a new version of the contract is deployed, and the Proxy is
 * updated to reference the new contract address.
 * */
contract UpgradableProxy is Proxy {
	/**
	 * @notice Set address of the implementation.
	 * @dev Wrapper for _setImplementation that exposes the function
	 * as public for owner to be able to set a new version of the
	 * contract as current pointing implementation.
	 * @param _implementation Address of the implementation.
	 * */
	function setImplementation(address _implementation) public onlyProxyOwner {
		_setImplementation(_implementation);
	}

	/**
	 * @notice Set address of the owner.
	 * @param _owner Address of the owner.
	 * */
	function setProxyOwner(address _owner) public onlyProxyOwner {
		_setProxyOwner(_owner);
	}
}
