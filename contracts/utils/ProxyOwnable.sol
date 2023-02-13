// SPDX-License-Identifier: MIT

pragma solidity 0.5.17;

/**
 * Based on OpenZeppelin's Ownable contract:
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol
 *
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
contract ProxyOwnable {
    bytes32 private constant KEY_OWNER = keccak256("key.proxy.owner");

    event ProxyOwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() internal {
        _setProxyOwner(msg.sender);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyProxyOwner() {
        require(msg.sender == getProxyOwner(), "Ownable:: access denied");
        _;
    }

    /**
     * @notice Set address of the owner.
     * @param _owner Address of the owner.
     * */
    function _setProxyOwner(address _owner) internal {
        require(_owner != address(0), "ProxyOwnable::setProxyOwner: invalid address");
        emit ProxyOwnershipTransferred(getProxyOwner(), _owner);

        bytes32 key = KEY_OWNER;
        assembly {
            sstore(key, _owner)
        }
    }

    /**
     * @notice Set address of the owner (only owner can call this function)
     * @param _owner Address of the owner.
     * */
    function setProxyOwner(address _owner) public onlyProxyOwner {
        _setProxyOwner(_owner);
    }

    /**
     * @notice Return address of the owner.
     * @return _owner Address of the owner.
     * */
    function getProxyOwner() public view returns (address _owner) {
        bytes32 key = KEY_OWNER;
        assembly {
            _owner := sload(key)
        }
    }
}
