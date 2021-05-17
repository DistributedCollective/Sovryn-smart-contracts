pragma solidity ^0.5.17;

/**
 * @title Base Proxy Contract
 */
contract Proxy {
	/// @dev The storage slot 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
	/// (obtained as bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1))
	/// should hold the address of the logic contract that the proxy delegates to.
	/// According to EIP-1967 standard.
	bytes32 private constant KEY_IMPLEMENTATION = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

	/// @dev The storage slot 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103
	/// (obtained as bytes32(uint256(keccak256('eip1967.proxy.admin')) - 1))
	/// should hold the address that is allowed to upgrade the logic contract address.
	/// According to EIP-1967 standard.
	bytes32 private constant KEY_OWNER = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

	event AdminChanged(address previousAdmin, address newAdmin);
	event Upgraded(address indexed implementation);

	/**
	 * @notice Sets sender as an owner
	 */
	constructor() public {
		_setProxyOwner(msg.sender);
	}

	/**
	 * @notice Throws error if called not by an owner
	 */
	modifier onlyProxyOwner() {
		require(msg.sender == getProxyOwner(), "Proxy:: access denied");
		_;
	}

	function _setImplementation(address _implementation) internal {
		require(_implementation != address(0), "Proxy::setImplementation: invalid address");

		/// @dev EIP-1967 standard event log.
		emit Upgraded(_implementation);

		bytes32 key = KEY_IMPLEMENTATION;
		assembly {
			sstore(key, _implementation)
		}
	}

	/**
	 * @notice Returns address of the implementation
	 * @return address of the implementation
	 */
	function getImplementation() public view returns (address _implementation) {
		bytes32 key = KEY_IMPLEMENTATION;
		assembly {
			_implementation := sload(key)
		}
	}

	function _setProxyOwner(address _owner) internal {
		require(_owner != address(0), "Proxy::setProxyOwner: invalid address");

		/// @dev EIP-1967 standard event log.
		emit AdminChanged(getProxyOwner(), _owner);

		bytes32 key = KEY_OWNER;
		assembly {
			sstore(key, _owner)
		}
	}

	/**
	 * @notice Returns address of the owner
	 * @return address of the owner
	 */
	function getProxyOwner() public view returns (address _owner) {
		bytes32 key = KEY_OWNER;
		assembly {
			_owner := sload(key)
		}
	}

	/**
	 * @notice Fallback function performs a delegate call
	 * Returns whatever the implementation call returns
	 */
	function() external payable {
		address implementation = getImplementation();
		require(implementation != address(0), "Proxy::(): implementation not found");

		assembly {
			let pointer := mload(0x40)
			calldatacopy(pointer, 0, calldatasize)
			let result := delegatecall(gas, implementation, pointer, calldatasize, 0, 0)
			let size := returndatasize
			returndatacopy(pointer, 0, size)

			switch result
				case 0 {
					revert(pointer, size)
				}
				default {
					return(pointer, size)
				}
		}
	}
}
