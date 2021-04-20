pragma solidity ^0.5.17;

import "../openzeppelin/Ownable.sol";

contract AdminRole is Ownable {
    //user => flag whether user has admin role
    mapping(address => bool) public admins;

    event AdminAdded(address admin);
    event AdminRemoved(address admin);

    /**
     * @dev Throws if called by any account other than the owner or admin.
     */
    modifier onlyAuthorized() {
        require(isOwner() || admins[msg.sender], "unauthorized");
        _;
    }

    function addAdmin(address _admin) public onlyOwner {
        admins[_admin] = true;
        emit AdminAdded(_admin);
    }

    function removeAdmin(address _admin) public onlyOwner {
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }

}
