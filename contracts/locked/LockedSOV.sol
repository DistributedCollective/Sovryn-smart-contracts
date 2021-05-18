pragma solidity ^0.5.17;

import "../openzeppelin/SafeMath.sol";
import "../interfaces/IERC20.sol";
import "../governance/Vesting/VestingRegistry.sol";
import "../governance/Vesting/VestingLogic.sol";
import "./ILockedSOV.sol";

/**
 *  @title The Locked SOV Contract.
 *  @author Franklin Richards - powerhousefrank@protonmail.com
 *  @notice This contract is used to receive reward from other contracts, Create Vesting and Stake Tokens.
 */
contract LockedSOV is ILockedSOV {
	using SafeMath for uint256;

	/* Storage */

	/// @notice True if the migration to a new Locked SOV Contract has started.
	bool public migration;

	/// @notice The cliff is the time period after which the tokens begin to unlock.
	uint256 public cliff;
	/// @notice The duration is the time period after all tokens will have been unlocked.
	uint256 public duration;

	/// @notice The SOV token contract.
	IERC20 public SOV;
	/// @notice The Vesting registry contract.
	VestingRegistry public vestingRegistry;
	/// @notice The New (Future) Locked SOV.
	ILockedSOV public newLockedSOV;
	/// @notice The Liquidity Mining contract address.
	address public liquidityMining;

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

	/// @notice Emitted when Vesting Registry, Duration and/or Cliff is updated.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _vestingRegistry The Vesting Registry Contract.
	/// @param _cliff The time period after which the tokens begin to unlock.
	/// @param _duration The time period after all tokens will have been unlocked.
	event RegistryCliffAndDurationUpdated(address indexed _initiator, address indexed _vestingRegistry, uint256 _cliff, uint256 _duration);

	/// @notice Emitted when a new deposit is made.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _userAddress The user to whose un/locked balance a new deposit was made.
	/// @param _sovAmount The amount of SOV to be added to the un/locked balance.
	/// @param _basisPoint The % (in Basis Point) which determines how much will be unlocked immediately.
	event Deposited(address indexed _initiator, address indexed _userAddress, uint256 _sovAmount, uint256 _basisPoint);

	/// @notice Emitted when a user withdraws the fund.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _userAddress The user whose unlocked balance has to be withdrawn.
	/// @param _sovAmount The amount of SOV withdrawn from the unlocked balance.
	event Withdrawn(address indexed _initiator, address indexed _userAddress, uint256 _sovAmount);

	/// @notice Emitted when a user creates a vesting for himself.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _vesting The Vesting Contract.
	event VestingCreated(address indexed _initiator, address indexed _vesting);

	/// @notice Emitted when a user stakes tokens.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _vesting The Vesting Contract.
	/// @param _amount The amount of locked tokens staked by the user.
	event TokensStaked(address indexed _initiator, address indexed _vesting, uint256 _amount);

	/// @notice Emitted when an admin initiates a migration to new Locked SOV Contract.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _newLockedSOV The address of the new Locked SOV Contract.
	event MigrationStarted(address indexed _initiator, address indexed _newLockedSOV);

	/// @notice Emitted when a user initiates the transfer to a new Locked SOV Contract.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _amount The amount of locked tokens to transfer from this contract to the new one.
	event UserTransfered(address indexed _initiator, uint256 _amount);

	/* Modifiers */

	modifier onlyAdmin {
		require(isAdmin[msg.sender], "Only admin can call this.");
		_;
	}

	modifier migrationAllowed {
		require(migration, "Migration has not yet started.");
		_;
	}

	/* Constructor */

	/**
	 * @notice Setup the required parameters.
	 * @param _SOV The SOV Token Address.
	 * @param _vestingRegistry The Vesting Registry Address.
	 * @param _cliff The time period after which the tokens begin to unlock.
	 * @param _duration The time period after all tokens will have been unlocked.
	 * @param _admins The list of Admins to be added.
	 */
	constructor(
		address _SOV,
		address _vestingRegistry,
		uint256 _cliff,
		uint256 _duration,
		address[] memory _admins
	) public {
		require(_SOV != address(0), "Invalid SOV Address.");
		require(_vestingRegistry != address(0), "Vesting registry address is invalid.");
		require(_duration < 37, "Duration is too long.");

		SOV = IERC20(_SOV);
		vestingRegistry = VestingRegistry(_vestingRegistry);
		cliff = _cliff * 4 weeks;
		duration = _duration * 4 weeks;

		for (uint256 index = 0; index < _admins.length; index++) {
			isAdmin[_admins[index]] = true;
		}
	}

	/* Public or External Functions */

	//TODO who should have an access ?
	function setLiquidityMining(address _liquidityMining) public onlyAdmin {
		require(_liquidityMining != address(0), "Liquidity mining address is invalid.");
		liquidityMining = _liquidityMining;
	}

	/**
	 * @notice The function to add a new admin.
	 * @param _newAdmin The address of the new admin.
	 * @dev Only callable by an Admin.
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
	 * @dev Only callable by an Admin.
	 */
	function removeAdmin(address _adminToRemove) public onlyAdmin {
		require(isAdmin[_adminToRemove], "Address is not an admin");
		isAdmin[_adminToRemove] = false;

		emit AdminRemoved(msg.sender, _adminToRemove);
	}

	/**
	 * @notice The function to update the Vesting Registry, Duration and Cliff.
	 * @param _vestingRegistry The Vesting Registry Address.
	 * @param _cliff The time period after which the tokens begin to unlock.
	 * @param _duration The time period after all tokens will have been unlocked.
	 * @dev IMPORTANT 1: You have to change Vesting Registry if you want to change Duration and/or Cliff.
	 * IMPORTANT 2: `_cliff` and `_duration` is multiplied by 4 weeks in this function.
	 */
	function changeRegistryCliffAndDuration(
		address _vestingRegistry,
		uint256 _cliff,
		uint256 _duration
	) external onlyAdmin {
		require(address(vestingRegistry) != _vestingRegistry, "Vesting Registry has to be different for changing duration and cliff.");
		/// If duration is also zero, then it is similar to Unlocked SOV.
		require(_duration != 0, "Duration cannot be zero.");
		require(_duration < 37, "Duration is too long.");

		vestingRegistry = VestingRegistry(_vestingRegistry);

		cliff = _cliff * 4 weeks;
		duration = _duration * 4 weeks;

		emit RegistryCliffAndDurationUpdated(msg.sender, _vestingRegistry, _cliff, _duration);
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
	 * @notice A function to withdraw the unlocked balance.
	 * @param _receiverAddress If specified, the unlocked balance will go to this address, else to msg.sender.
	 */
	function withdraw(address _receiverAddress) public {
		_withdraw(msg.sender, _receiverAddress);
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

	/**
	 * @notice Creates vesting if not already created and Stakes tokens for a user.
	 * @dev Only use this function if the `duration` is small.
	 */
	function createVestingAndStake() public {
		_createVestingAndStake(msg.sender);
	}

	function _createVestingAndStake(address _sender) private {
		address vestingAddr = _getVesting(_sender);

		if (vestingAddr == address(0)) {
			vestingAddr = _createVesting(_sender);
		}

		_stakeTokens(_sender, vestingAddr);
	}

	/**
	 * @notice Creates vesting contract (if it hasn't been created yet) for the calling user.
	 * @return _vestingAddress The New Vesting Contract Created.
	 */
	function createVesting() public returns (address _vestingAddress) {
		_vestingAddress = _createVesting(msg.sender);
	}

	/**
	 * @notice Stakes tokens for a user who already have a vesting created.
	 * @dev The user should already have a vesting created, else this function will throw error.
	 */
	function stakeTokens() public {
		VestingLogic vesting = VestingLogic(_getVesting(msg.sender));

		require(cliff == vesting.cliff() && duration == vesting.duration(), "Wrong Vesting Schedule.");

		_stakeTokens(msg.sender, address(vesting));
	}

	/**
	 * @notice Withdraws unlocked tokens and Stakes Locked tokens for a user who already have a vesting created.
	 * @param _receiverAddress If specified, the unlocked balance will go to this address, else to msg.sender.
	 */
	function withdrawAndStakeTokens(address _receiverAddress) external {
		withdraw(_receiverAddress);
		createVestingAndStake();
	}

	/**
	 * @notice Withdraws unlocked tokens and Stakes Locked tokens for a user who already have a vesting created.
	 * @param _userAddress The address of user tokens will be withdrawn.
	 */
	function withdrawAndStakeTokensFrom(address _userAddress) external {
		_withdraw(_userAddress, _userAddress);
		_createVestingAndStake(_userAddress);
	}

	/**
	 * @notice Function to start the process of migration to new contract.
	 * @param _newLockedSOV The new locked sov contract address.
	 */
	function startMigration(address _newLockedSOV) external onlyAdmin {
		require(_newLockedSOV != address(0), "New Locked SOV Address is Invalid.");
		newLockedSOV = ILockedSOV(_newLockedSOV);
		SOV.approve(_newLockedSOV, SOV.balanceOf(address(this)));
		migration = true;

		emit MigrationStarted(msg.sender, _newLockedSOV);
	}

	/**
	 * @notice Function to transfer the locked balance from this contract to new LockedSOV Contract.
	 * @dev Address is not specified to discourage selling lockedSOV to other address.
	 */
	function transfer() external migrationAllowed {
		uint256 amount = lockedBalances[msg.sender];
		lockedBalances[msg.sender] = 0;

		newLockedSOV.depositSOV(msg.sender, amount);

		emit UserTransfered(msg.sender, amount);
	}

	/* Internal Functions */

	/**
	 * @notice Creates a Vesting Contract for a user.
	 * @param _tokenOwner The owner of the vesting contract.
	 * @return _vestingAddress The Vesting Contract Address.
	 * @dev Does not do anything if Vesting Contract was already created.
	 */
	function _createVesting(address _tokenOwner) internal returns (address _vestingAddress) {
		/// Here zero is given in place of amount, as amount is not really used in `vestingRegistry.createVesting()`.
		vestingRegistry.createVesting(_tokenOwner, 0, cliff, duration);
		_vestingAddress = _getVesting(_tokenOwner);
		emit VestingCreated(msg.sender, _vestingAddress);
	}

	/**
	 * @notice Returns the Vesting Contract Address.
	 * @param _tokenOwner The owner of the vesting contract.
	 * @return _vestingAddress The Vesting Contract Address.
	 */
	function _getVesting(address _tokenOwner) internal view returns (address _vestingAddress) {
		return vestingRegistry.getVesting(_tokenOwner);
	}

	/**
	 * @notice Stakes the tokens in a particular vesting contract.
	 * @param _vesting The Vesting Contract Address.
	 */
	function _stakeTokens(address _sender, address _vesting) internal {
		uint256 amount = lockedBalances[_sender];
		lockedBalances[_sender] = 0;

		SOV.approve(_vesting, amount);
		VestingLogic(_vesting).stakeTokens(amount);

		emit TokensStaked(_sender, _vesting, amount);
	}

	/* Getter or Read Functions */

	/**
	 * @notice The function to get the locked balance of a user.
	 * @param _addr The address of the user to check the locked balance.
	 * @return _balance The locked balance of the address `_addr`.
	 */
	function getLockedBalance(address _addr) external view returns (uint256 _balance) {
		return lockedBalances[_addr];
	}

	/**
	 * @notice The function to get the unlocked balance of a user.
	 * @param _addr The address of the user to check the unlocked balance.
	 * @return _balance The unlocked balance of the address `_addr`.
	 */
	function getUnlockedBalance(address _addr) external view returns (uint256 _balance) {
		return unlockedBalances[_addr];
	}
}
