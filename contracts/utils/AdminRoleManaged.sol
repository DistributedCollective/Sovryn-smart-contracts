pragma solidity 0.5.17;

import "../openzeppelin/Ownable.sol";
import "./AdminManagerRole.sol";

contract AdminRoleManaged is Ownable, AdminManagerRole {
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
     * @notice Add account to ACL (by owner only).
     * @dev this function is kept here to support backward compatibility with the existing vestingRegistryProxy deployment in rsk network.
     * @param _admin The addresses of the account to grant permissions.
     * */
    function addAdmin(address _admin) public onlyOwner {
        _addAdmin(_admin);
    }

    /**
     * @notice Remove account from ACL (by owner only).
     * @dev this function is kept here to support backward compatibility with the existing vestingRegistryProxy deployment in rsk network.
     * @param _admin The addresses of the account to revoke permissions.
     * */
    function removeAdmin(address _admin) public onlyOwner {
        _removeAdmin(_admin);
    }

    /**
     * @notice Add account to ACL (by owner & manager).
     * @param _admin The addresses of the account to grant permissions.
     * */
    function addAdminByManager(address _admin) public onlyOwnerOrAdminManager {
        _addAdmin(_admin);
    }

    /**
     * @notice Remove account from ACL (by owner & manager).
     * @param _admin The addresses of the account to revoke permissions.
     * */
    function removeAdminByManager(address _admin) public onlyOwnerOrAdminManager {
        _removeAdmin(_admin);
    }

    /**
     * @notice Add account to ACL.
     * @param _admin The addresses of the account to grant permissions.
     * */
    function _addAdmin(address _admin) internal {
        admins[_admin] = true;
        emit AdminAdded(_admin);
    }

    /**
     * @notice Remove account from ACL.
     * @param _admin The addresses of the account to revoke permissions.
     * */
    function _removeAdmin(address _admin) internal {
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }
}
