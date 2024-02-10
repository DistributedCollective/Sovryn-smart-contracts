pragma solidity 0.5.17;

import "../openzeppelin/PausableOz.sol";

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
