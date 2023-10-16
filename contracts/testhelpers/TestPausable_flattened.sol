// File: contracts/openzeppelin/Context.sol

pragma solidity >=0.5.0 <0.6.0;

/*
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with GSN meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
contract Context {
    // Empty internal constructor, to prevent people from mistakenly deploying
    // an instance of this contract, which should be used via inheritance.
    constructor() internal {}

    // solhint-disable-previous-line no-empty-blocks

    function _msgSender() internal view returns (address payable) {
        return msg.sender;
    }

    function _msgData() internal view returns (bytes memory) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        return msg.data;
    }
}

// File: contracts/openzeppelin/Ownable.sol

pragma solidity >=0.5.0 <0.6.0;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() internal {
        address msgSender = _msgSender();
        _owner = msgSender;
        emit OwnershipTransferred(address(0), msgSender);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(isOwner(), "unauthorized");
        _;
    }

    /**
     * @dev Returns true if the caller is the current owner.
     */
    function isOwner() public view returns (bool) {
        return _msgSender() == _owner;
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     */
    function _transferOwnership(address newOwner) internal {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

// File: contracts/openzeppelin/PausableOz.sol

pragma solidity 0.5.17;

contract PausableOz is Ownable {
    /**
     * @dev Emitted when the pause is triggered by the owner (`account`).
     */
    event Paused(address account);

    /**
     * @dev Emitted when the pause is lifted by the owner (`account`).
     */
    event Unpaused(address account);

    bool internal _paused;

    constructor() internal {}

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view returns (bool) {
        return _paused;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     */
    modifier whenNotPaused() {
        require(!_paused, "Pausable: paused");
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     */
    modifier whenPaused() {
        require(_paused, "Pausable: not paused");
        _;
    }

    /**
     * @dev Called by the owner to pause, triggers stopped state.
     */
    function pause() public onlyOwner whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    /**
     * @dev Called by the owner to unpause, returns to normal state.
     */
    function unpause() public onlyOwner whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }
}

// File: contracts/utils/PausableRole.sol

pragma solidity 0.5.17;

contract PausableRole is PausableOz {
    address public pauser;

    event SetPauser(address indexed sender, address indexed oldPauser, address indexed newPauser);

    /**
     * @dev Modifier to make a function callable only when the caller is pauser or owner
     */
    modifier onlyPauserOrOwner() {
        require(isOwner() || msg.sender == pauser, "Pausable: unauthorized"); // SS02
        _;
    }

    /**
     * @notice Set the pauser address.
     *
     * only pauser can perform this action.
     *
     * @param newPauser The new address of the pauser.
     * */
    function setPauser(address newPauser) external onlyOwner {
        address oldPauser = pauser;
        pauser = newPauser;

        emit SetPauser(msg.sender, oldPauser, newPauser);
    }

    /**
     * @dev Called by the owner to pause, triggers stopped state.
     */
    function pause() public onlyPauserOrOwner whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    /**
     * @dev Called by the owner to unpause, returns to normal state.
     */
    function unpause() public onlyPauserOrOwner whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }
}

// File: contracts/testhelpers/TestPausable.sol

pragma solidity 0.5.17;

contract TestPausable is PausableRole {
    constructor(address _pauser) public {
        pauser = _pauser;
    }
}
