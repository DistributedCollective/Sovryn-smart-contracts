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
contract SafeOwnable {
    bytes32 private constant KEY_OWNER = keccak256("key.ownable.owner");

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() internal {
        _setOwner(msg.sender);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == getOwner(), "Ownable:: access denied");
        _;
    }

    /**
     * @notice Set address of the owner.
     * @param _owner Address of the owner.
     * */
    function _setOwner(address _owner) internal {
        require(_owner != address(0), "Ownable::setOwner: invalid address");
        emit OwnershipTransferred(getOwner(), _owner);

        bytes32 key = KEY_OWNER;
        assembly {
            sstore(key, _owner)
        }
    }

    /**
     * @notice Set address of the owner (only owner can call this function)
     * @param _owner Address of the owner.
     * */
    function setOwner(address _owner) public onlyOwner {
        _setOwner(_owner);
    }

    /**
     * @notice Return address of the owner.
     * @return _owner Address of the owner.
     * */
    function getOwner() public view returns (address _owner) {
        bytes32 key = KEY_OWNER;
        assembly {
            _owner := sload(key)
        }
    }
}
