pragma solidity ^0.5.17;

import "../openzeppelin/SafeMath.sol";
import "../interfaces/IERC20.sol";
import "../governance/Vesting/VestingRegistry.sol";
import "../governance/Vesting/VestingLogic.sol";
import "./ILockedSOV.sol";

/**
 * @title The Locked SOV Migration Contract.
 * @notice This contract is a migration replacement for LockedSOV that prevents
 * new vesting creation and withdrawals during the Sovryn Layer migration.
 * @dev All vesting creation and withdrawal functions are disabled (do nothing).
 * This contract maintains the same interface as LockedSOV to prevent breaking
 * integrations, but all state-changing operations are muted.
 */
contract LockedSOVMigration is ILockedSOV {
    using SafeMath for uint256;

    uint256 public constant MAX_BASIS_POINT = 10000;
    uint256 public constant MAX_DURATION = 37;

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

    /// @notice The locked user balances.
    mapping(address => uint256) private lockedBalances;
    /// @notice The unlocked user balances.
    mapping(address => uint256) private unlockedBalances;
    /// @notice The contracts/wallets with admin power.
    mapping(address => bool) private isAdmin;

    /* Events */

    event AdminAdded(address indexed _initiator, address indexed _newAdmin);
    event AdminRemoved(address indexed _initiator, address indexed _removedAdmin);
    event RegistryCliffAndDurationUpdated(
        address indexed _initiator,
        address indexed _vestingRegistry,
        uint256 _cliff,
        uint256 _duration
    );
    event Deposited(
        address indexed _initiator,
        address indexed _userAddress,
        uint256 _sovAmount,
        uint256 _basisPoint
    );
    event Withdrawn(address indexed _initiator, address indexed _userAddress, uint256 _sovAmount);
    event VestingCreated(
        address indexed _initiator,
        address indexed _userAddress,
        address indexed _vesting
    );
    event TokenStaked(address indexed _initiator, address indexed _vesting, uint256 _amount);
    event MigrationStarted(address indexed _initiator, address indexed _newLockedSOV);
    event UserTransfered(address indexed _initiator, uint256 _amount);

    /* Modifiers */

    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "Only admin can call this.");
        _;
    }

    modifier migrationAllowed() {
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
        require(_duration < MAX_DURATION, "Duration is too long.");

        SOV = IERC20(_SOV);
        vestingRegistry = VestingRegistry(_vestingRegistry);
        cliff = _cliff * 4 weeks;
        duration = _duration * 4 weeks;

        for (uint256 index = 0; index < _admins.length; index++) {
            isAdmin[_admins[index]] = true;
        }
    }

    /* Public or External Functions */

    function addAdmin(address _newAdmin) public onlyAdmin {
        require(_newAdmin != address(0), "Invalid Address.");
        require(!isAdmin[_newAdmin], "Address is already admin.");
        isAdmin[_newAdmin] = true;

        emit AdminAdded(msg.sender, _newAdmin);
    }

    function removeAdmin(address _adminToRemove) public onlyAdmin {
        require(isAdmin[_adminToRemove], "Address is not an admin.");
        isAdmin[_adminToRemove] = false;

        emit AdminRemoved(msg.sender, _adminToRemove);
    }

    function changeRegistryCliffAndDuration(
        address _vestingRegistry,
        uint256 _cliff,
        uint256 _duration
    ) external onlyAdmin {
        require(
            address(vestingRegistry) != _vestingRegistry,
            "Vesting Registry has to be different for changing duration and cliff."
        );
        require(_duration != 0, "Duration cannot be zero.");
        require(_duration < MAX_DURATION, "Duration is too long.");

        vestingRegistry = VestingRegistry(_vestingRegistry);

        cliff = _cliff * 4 weeks;
        duration = _duration * 4 weeks;

        emit RegistryCliffAndDurationUpdated(msg.sender, _vestingRegistry, _cliff, _duration);
    }

    /**
     * @notice MUTED: Deposit function does nothing during migration.
     * @dev This function is muted to prevent new deposits during Sovryn Layer migration.
     */
    function deposit(address _userAddress, uint256 _sovAmount, uint256 _basisPoint) external {
        // MUTED: Do nothing
        // Emit event for tracking but don't process deposit
        emit Deposited(msg.sender, _userAddress, _sovAmount, _basisPoint);
    }

    /**
     * @notice MUTED: DepositSOV function does nothing during migration.
     * @dev This function is muted to prevent new deposits during Sovryn Layer migration.
     */
    function depositSOV(address _userAddress, uint256 _sovAmount) external {
        // MUTED: Do nothing
        // Emit event for tracking but don't process deposit
        emit Deposited(msg.sender, _userAddress, _sovAmount, 0);
    }

    /**
     * @notice MUTED: Withdraw function does nothing during migration.
     * @dev This function is muted to prevent withdrawals during Sovryn Layer migration.
     * Users should wait for migration to Sovryn Layer to access their funds.
     */
    function withdraw(address _receiverAddress) public {
        // MUTED: Do nothing
        // Emit event for tracking but don't process withdrawal
        emit Withdrawn(msg.sender, _receiverAddress, 0);
    }

    /**
     * @notice MUTED: CreateVestingAndStake function does nothing during migration.
     * @dev This function is muted to prevent new vesting creation during Sovryn Layer migration.
     */
    function createVestingAndStake() public {
        // MUTED: Do nothing
    }

    /**
     * @notice MUTED: CreateVesting function does nothing during migration.
     * @dev This function is muted to prevent new vesting creation during Sovryn Layer migration.
     */
    function createVesting() public returns (address _vestingAddress) {
        // MUTED: Do nothing, return zero address
        return address(0);
    }

    /**
     * @notice MUTED: StakeTokens function does nothing during migration.
     * @dev This function is muted to prevent staking during Sovryn Layer migration.
     */
    function stakeTokens() public {
        // MUTED: Do nothing
    }

    /**
     * @notice MUTED: WithdrawAndStakeTokens function does nothing during migration.
     * @dev This function is muted to prevent withdrawals and staking during Sovryn Layer migration.
     */
    function withdrawAndStakeTokens(address _receiverAddress) external {
        // MUTED: Do nothing
    }

    /**
     * @notice MUTED: WithdrawAndStakeTokensFrom function does nothing during migration.
     * @dev This function is muted to prevent withdrawals and staking during Sovryn Layer migration.
     */
    function withdrawAndStakeTokensFrom(address _userAddress) external {
        // MUTED: Do nothing
    }

    function startMigration(address _newLockedSOV) external onlyAdmin {
        require(_newLockedSOV != address(0), "New Locked SOV Address is Invalid.");
        newLockedSOV = ILockedSOV(_newLockedSOV);
        SOV.approve(_newLockedSOV, uint256(-1));
        migration = true;

        emit MigrationStarted(msg.sender, _newLockedSOV);
    }

    function transfer() external migrationAllowed {
        // MUTED: Do nothing during migration
        emit UserTransfered(msg.sender, 0);
    }

    /* Getter or Read Functions */

    function getLockedBalance(address _addr) external view returns (uint256 _balance) {
        return lockedBalances[_addr];
    }

    function getUnlockedBalance(address _addr) external view returns (uint256 _balance) {
        return unlockedBalances[_addr];
    }

    function adminStatus(address _addr) external view returns (bool _status) {
        return isAdmin[_addr];
    }
}
