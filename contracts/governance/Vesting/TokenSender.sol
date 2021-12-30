pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";

/**
 * @title SOV Token sender contract.
 *
 * @notice This contract includes functions to transfer SOV tokens
 * to a recipient or to several recipients in a list. There is
 * an ACL control check by modifier.
 *
 */
contract TokenSender is Ownable {
	/* Storage */

	/// @notice The SOV token contract.
	address public SOV;

	/// @dev user => flag whether user has admin role
	mapping(address => bool) public admins;

	/* Events */

	event SOVTransferred(address indexed receiver, uint256 amount);
	event AdminAdded(address admin);
	event AdminRemoved(address admin);

	/* Functions */

	constructor(address _SOV) public {
		require(_SOV != address(0), "SOV address invalid");

		SOV = _SOV;
	}

	/* Modifiers */

	/**
	 * @dev Throws if called by any account other than the owner or admin.
	 * */
	modifier onlyAuthorized() {
		require(isOwner() || admins[msg.sender], "unauthorized");
		_;
	}

	/* Functions */

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

	/**
	 * @notice Transfer given amounts of SOV to the given addresses.
	 * @param _receivers The addresses of the SOV receivers.
	 * @param _amounts The amounts to be transferred.
	 * */
	function transferSOVusingList(address[] memory _receivers, uint256[] memory _amounts) public onlyAuthorized {
		require(_receivers.length == _amounts.length, "arrays mismatch");

		for (uint256 i = 0; i < _receivers.length; i++) {
			_transferSOV(_receivers[i], _amounts[i]);
		}
	}

	/**
	 * @notice Transfer SOV tokens to given address.
	 * @param _receiver The address of the SOV receiver.
	 * @param _amount The amount to be transferred.
	 * */
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
