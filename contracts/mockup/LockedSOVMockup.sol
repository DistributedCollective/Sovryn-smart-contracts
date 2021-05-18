pragma solidity ^0.5.17;

import "../openzeppelin/SafeMath.sol";
import "../interfaces/IERC20.sol";

/**
 *  @title An mockup for the Locked SOV Contract.
 *  @author Franklin Richards - powerhousefrank@protonmail.com
 *  @dev This is not a complete mockup of the Locked SOV Contract.
 */
contract LockedSOVMockup {
	using SafeMath for uint256;

	/* Storage */

	/// @notice The SOV token contract.
	IERC20 public SOV;

	/// @notice The locked user balances.
	mapping(address => uint256) lockedBalances;
	/// @notice The unlocked user balances.
	mapping(address => uint256) unlockedBalances;
	/// @notice The contracts/wallets with admin power.
	mapping(address => bool) isAdmin;

	/* Events */

	/// @notice Emitted when a new Admin is added to the admin list.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _newAdmin The address of the new admin.
	event AdminAdded(address indexed _initiator, address indexed _newAdmin);

	/// @notice Emitted when an admin is removed from the admin list.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _removedAdmin The address of the removed admin.
	event AdminRemoved(address indexed _initiator, address indexed _removedAdmin);

	event Deposited(address indexed _initiator, address indexed _userAddress, uint256 _sovAmount, uint256 _basisPoint);

	event Withdrawn(address indexed _initiator, address indexed _userAddress, uint256 _sovAmount);

	event TokensStaked(address indexed _initiator, address indexed _vesting, uint256 _amount);

	/* Modifiers */

	modifier onlyAdmin {
		require(isAdmin[msg.sender], "Only admin can call this.");
		_;
	}

	/* Functions */

	/**
	 * @notice Setup the required parameters.
	 * @param _SOV The SOV token address.
	 * @param _admins The list of admins to be added.
	 */
	constructor(address _SOV, address[] memory _admins) public {
		require(_SOV != address(0), "Invalid SOV Address.");
		SOV = IERC20(_SOV);
		for (uint256 index = 0; index < _admins.length; index++) {
			isAdmin[_admins[index]] = true;
		}
	}

	/**
	 * @notice The function to add a new admin.
	 * @param _newAdmin The address of the new admin.
	 */
	function addAdmin(address _newAdmin) public onlyAdmin {
		require(_newAdmin != address(0), "Invalid Address");
		require(!isAdmin[_newAdmin], "Address is already admin");
		isAdmin[_newAdmin] = true;

		emit AdminAdded(msg.sender, _newAdmin);
	}

	/**
	 * @notice The function to remove an admin.
	 * @param _adminToRemove The address of the admin which should be removed.
	 */
	function removeAdmin(address _adminToRemove) public onlyAdmin {
		require(isAdmin[_adminToRemove], "Address is not an admin");
		isAdmin[_adminToRemove] = false;

		emit AdminRemoved(msg.sender, _adminToRemove);
	}

	/**
	 * @notice Adds SOV to the user balance (Locked and Unlocked Balance based on `_basisPoint`).
	 * @param _userAddress The user whose locked balance has to be updated with `_sovAmount`.
	 * @param _sovAmount The amount of SOV to be added to the locked and/or unlocked balance.
	 * @param _basisPoint The % (in Basis Point)which determines how much will be unlocked immediately.
	 */
	function deposit(
		address _userAddress,
		uint256 _sovAmount,
		uint256 _basisPoint
	) external {
		_deposit(_userAddress, _sovAmount, _basisPoint);
	}

	/**
	 * @notice Adds SOV to the locked balance of a user.
	 * @param _userAddress The user whose locked balance has to be updated with _sovAmount.
	 * @param _sovAmount The amount of SOV to be added to the locked balance.
	 * @dev This is here because there are dependency with other contracts.
	 */
	function depositSOV(address _userAddress, uint256 _sovAmount) external {
		_deposit(_userAddress, _sovAmount, 0);
	}

	function _deposit(
		address _userAddress,
		uint256 _sovAmount,
		uint256 _basisPoint
	) private {
		// 10000 is not included because if 100% is unlocked, then LockedSOV is not required to be used.
		require(_basisPoint < 10000, "Basis Point has to be less than 10000.");
		bool txStatus = SOV.transferFrom(msg.sender, address(this), _sovAmount);
		require(txStatus, "Token transfer was not successful. Check receiver address.");

		uint256 unlockedBal = _sovAmount.mul(_basisPoint).div(10000);

		unlockedBalances[_userAddress] = unlockedBalances[_userAddress].add(unlockedBal);
		lockedBalances[_userAddress] = lockedBalances[_userAddress].add(_sovAmount).sub(unlockedBal);

		emit Deposited(msg.sender, _userAddress, _sovAmount, _basisPoint);
	}

	/**
	 * @notice Withdraws unlocked tokens and Stakes Locked tokens for a user who already have a vesting created.
	 * @param _userAddress The address of user tokens will be withdrawn.
	 */
	function withdrawAndStakeTokensFrom(address _userAddress) external {
		_withdraw(_userAddress, _userAddress);
		_createVestingAndStake(_userAddress);
	}

	function _withdraw(address _sender, address _receiverAddress) private {
		address userAddr = _receiverAddress;
		if (_receiverAddress == address(0)) {
			userAddr = _sender;
		}

		uint256 amount = unlockedBalances[_sender];
		unlockedBalances[_sender] = 0;

		bool txStatus = SOV.transfer(userAddr, amount);
		require(txStatus, "Token transfer was not successful. Check receiver address.");

		emit Withdrawn(_sender, userAddr, amount);
	}

	function _createVestingAndStake(address _sender) private {
		uint256 amount = lockedBalances[msg.sender];
		lockedBalances[msg.sender] = 0;

		emit TokensStaked(msg.sender, address(0), amount);
	}

	/**
	 * @notice The function to get the locked balance of a user.
	 * @param _addr The address of the user to check the locked balance.
	 * @return _balance The locked balance of the address `_addr`.
	 */
	function getLockedBalance(address _addr) public view returns (uint256 _balance) {
		return lockedBalances[_addr];
	}
}
