pragma solidity ^0.5.17;

/**
 * @title Base Proxy Contract
 */
contract Proxy {
	bytes32 private constant KEY_IMPLEMENTATION = keccak256("key.implementation");
	bytes32 private constant KEY_OWNER = keccak256("key.proxy.owner");

	event OwnershipTransferred(address indexed _oldOwner, address indexed _newOwner);
	event ImplementationChanged(address indexed _oldImplementation, address indexed _newImplementation);

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
		emit ImplementationChanged(getImplementation(), _implementation);

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
		emit OwnershipTransferred(getProxyOwner(), _owner);

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
