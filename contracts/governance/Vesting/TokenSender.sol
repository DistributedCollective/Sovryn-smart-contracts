pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";

contract TokenSender is Ownable {

    ///@notice the SOV token contract
    address public SOV;

    //user => flag whether user has admin role
    mapping(address => bool) public admins;

    event SOVTransferred(address indexed receiver, uint256 amount);
    event AdminAdded(address admin);
    event AdminRemoved(address admin);

    constructor(
        address _SOV
    ) public {
        require(_SOV != address(0), "SOV address invalid");

        SOV = _SOV;
    }

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

    /**
     * @notice transfers given amounts of SOV to the given addresses
     * @param _receivers the addresses of the SOV receivers
     * @param _amounts the amounts to be transferred
     */
    function transferSOVusingList(address[] memory _receivers, uint256[] memory _amounts) public onlyAuthorized {
        require(_receivers.length == _amounts.length, "arrays mismatch");

        for (uint256 i = 0; i < _receivers.length; i++) {
            _transferSOV(_receivers[i], _amounts[i]);
        }
    }

    /**
     * @notice transfers SOV tokens to given address
     * @param _receiver the address of the SOV receiver
     * @param _amount the amount to be transferred
     */
    function transferSOV(address _receiver, uint256 _amount) public onlyAuthorized {
        _transferSOV(_receiver, _amount);
    }

    function _transferSOV(address _receiver, uint256 _amount) internal {
        require(_receiver != address(0), "receiver address invalid");
        require(_amount != 0, "amount invalid");

        require(IERC20(SOV).transfer(_receiver, _amount), "transfer failed");
        emit SOVTransferred(_receiver, _amount);
    }

}