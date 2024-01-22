pragma solidity 0.5.17;

import "../openzeppelin/Ownable.sol";

contract AdminManagerRole is Ownable {
    /// @dev user => flag whether user has adminManager role.
    bytes32 private constant KEY_ADMIN_MANAGER_ROLE = keccak256("key.admin.manager.role");

    event AdminManagerChanged(
        address indexed sender,
        address indexed oldAdminManager,
        address indexed newAdminManager
    );
    event AdminManagerRemoved(address indexed sender, address indexed removedAdminManager);

    /**
     * @dev Throws if called by any account other than the owner or adminManager.
     * or on our own overriding sovrynOwnable.
     */
    modifier onlyOwnerOrAdminManager() {
        require(isOwner() || msg.sender == getAdminManager(), "unauthorized");
        _;
    }

    /**
     * @notice Set new admin manager.
     * @param _newAdminManager The addresses of the account to grant permissions.
     * */
    function setAdminManager(address _newAdminManager) public onlyOwner {
        require(_newAdminManager != address(0), "invalid admin manager");
        emit AdminManagerChanged(msg.sender, getAdminManager(), _newAdminManager);

        bytes32 key = KEY_ADMIN_MANAGER_ROLE;
        assembly {
            sstore(key, _newAdminManager)
        }
    }

    /**
     * @notice Set admin manager to 0 address.
     * */
    function removeAdminManager() public onlyOwner {
        require(getAdminManager() != address(0), "Admin manager is not set");
        emit AdminManagerRemoved(msg.sender, getAdminManager());
        address _newAdminManager = address(0);
        bytes32 key = KEY_ADMIN_MANAGER_ROLE;
        assembly {
            sstore(key, _newAdminManager)
        }
    }

    /**
     * @notice Return address of the admin manager.
     * @return Address of admin manager.
     * */
    function getAdminManager() public view returns (address _adminManager) {
        bytes32 key = KEY_ADMIN_MANAGER_ROLE;
        assembly {
            _adminManager := sload(key)
        }
    }
}
