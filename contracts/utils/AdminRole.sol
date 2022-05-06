pragma solidity 0.5.17;

import "../openzeppelin/Ownable.sol";

contract AdminRole is Ownable {
    /// @dev user => flag whether user has admin role.
    mapping(address => bool) public admins;

    event AdminAdded(address admin);
    event AdminRemoved(address admin);

    /**
     * @dev Throws if called by any account other than the owner or admin.
     * or on our own overriding sovrynOwnable.
     */
    modifier onlyAuthorized() {
        require(isOwner() || admins[msg.sender], "unauthorized");
        _;
    }

    /**
     * @notice Add account to ACL.
     * @param _admin The addresses of the account to grant permissions.
     * */
    function addAdmin(address _admin) public onlyOwner {
        admins[_admin] = true;
        emit AdminAdded(_admin);
    }

    /**
     * @notice Remove account from ACL.
     * @param _admin The addresses of the account to revoke permissions.
     * */
    function removeAdmin(address _admin) public onlyOwner {
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }
}
