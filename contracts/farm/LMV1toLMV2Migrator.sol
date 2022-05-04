pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../openzeppelin/ERC20.sol";
import "../openzeppelin/SafeERC20.sol";
import "../openzeppelin/SafeMath.sol";
import "../utils/AdminRole.sol";
import "./ILiquidityMiningV1.sol";
import "./ILiquidityMiningV2.sol";

contract LMV1toLMV2Migrator is AdminRole {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    enum MigrationStates { MigratingPools, MigratingUsers, MigratingFunds, MigrationFinished }

    //represents de migration state from LiquidityMiningV1 to LiquidityMiningV2
    MigrationStates public migrationState;

    //LiquidityMiningV1 contract address
    ILiquidityMiningV1 public liquidityMiningV1;

    //LiquidityMiningV2 contract address
    ILiquidityMiningV2 public liquidityMiningV2;

    /// @dev it is true if the user has been already migrated
    mapping(address => bool) public userMigrated;

    /// @dev The SOV token
    IERC20 public SOV;

    event UserMigrated(address indexed user);

    /* Modifiers */
    modifier onlyPoolsMigrationState() {
        require(
            migrationState == MigrationStates.MigratingPools,
            "Wrong state: should be MigratingPools"
        );
        _;
    }

    modifier onlyUsersMigrationState() {
        require(
            migrationState == MigrationStates.MigratingUsers,
            "Wrong state: should be MigratingUsers"
        );
        _;
    }

    modifier onlyFundsMigrationState() {
        require(
            migrationState == MigrationStates.MigratingFunds,
            "Wrong state: should be MigratingFunds"
        );
        _;
    }

    /**
     * @notice Initialize migrator
     *
     * @param _SOV The SOV token address
     * @param _liquidityMiningV1 The LiquidityMiningV1 contract address
     * @param _liquidityMiningV2 The LiquidityMiningV2 contract address
     */
    function initialize(
        IERC20 _SOV,
        ILiquidityMiningV1 _liquidityMiningV1,
        ILiquidityMiningV2 _liquidityMiningV2
    ) external onlyAuthorized {
        require(address(_SOV) != address(0), "invalid token address");
        require(address(_liquidityMiningV1) != address(0), "invalid contract address");
        require(address(_liquidityMiningV2) != address(0), "invalid contract address");
        require(address(SOV) == address(0), "Already initialized");
        liquidityMiningV1 = _liquidityMiningV1;
        liquidityMiningV2 = _liquidityMiningV2;
        SOV = _SOV;
        migrationState = MigrationStates.MigratingPools;
    }

    function _finishPoolsMigration() internal onlyPoolsMigrationState {
        migrationState = MigrationStates.MigratingUsers;
    }

    function finishUsersMigration() external onlyAuthorized onlyUsersMigrationState {
        migrationState = MigrationStates.MigratingFunds;
    }

    function _finishFundsMigration() internal onlyFundsMigrationState {
        migrationState = MigrationStates.MigrationFinished;
    }

    /**
     * @notice read all pools from liquidity mining V1 contract and add them
     */
    function migratePools() external onlyAuthorized onlyPoolsMigrationState {
        (
            address[] memory _poolToken,
            uint96[] memory _allocationPoints,
            uint256[] memory _lastRewardBlock,
            uint256[] memory _accumulatedRewardPerShare
        ) = liquidityMiningV1.getPoolInfoListArray();

        require(_poolToken.length == _allocationPoints.length, "Arrays mismatch");
        require(_poolToken.length == _lastRewardBlock.length, "Arrays mismatch");

        _finishPoolsMigration();
        liquidityMiningV1.finishMigrationGracePeriod();
        for (uint256 i = 0; i < _poolToken.length; i++) {
            address poolToken = _poolToken[i];
            uint96[] memory allocationPoints = new uint96[](1);
            allocationPoints[0] = _allocationPoints[i];
            uint256 lastRewardBlock = _lastRewardBlock[i];
            uint256 accumulatedRewardPerShare = _accumulatedRewardPerShare[i];
            address[] memory SOVAddress = new address[](1);
            SOVAddress[0] = address(SOV);
            //add will revert if poolToken is invalid or if it was already added
            liquidityMiningV2.add(poolToken, SOVAddress, allocationPoints, false);
            //add pool function put lastRewardBlock with current block number value, so we need to retrieve the original
            liquidityMiningV2.setPoolInfoRewardToken(
                poolToken,
                address(SOV),
                lastRewardBlock,
                accumulatedRewardPerShare
            );
        }
        uint256 _startblock = liquidityMiningV1.getStartBlock();
        uint256 _totalUsersBalance = liquidityMiningV1.getTotalUsersBalance();
        liquidityMiningV2.setRewardToken(address(SOV), _startblock, _totalUsersBalance);
    }

    /**
     * @notice read all users of all the pools from liquidity mining V1 contract and copy their info
     * @param _users a list of users to be copied
     */

    function migrateUsers(address[] calldata _users)
        external
        onlyAuthorized
        onlyUsersMigrationState
    {
        for (uint256 i = 0; i < _users.length; i++) {
            (
                uint256[] memory _amount,
                uint256[] memory _rewardDebt,
                uint256[] memory _accumulatedReward
            ) = liquidityMiningV1.getUserInfoListArray(_users[i]);

            require(_amount.length == _rewardDebt.length, "Arrays mismatch");
            require(_amount.length == _accumulatedReward.length, "Arrays mismatch");

            address user = _users[i];

            if (!userMigrated[user]) {
                userMigrated[user] = true;
                for (uint256 j = 0; j < _amount.length; j++) {
                    uint256 poolId = j;
                    uint256 _userAmount = _amount[j];
                    uint256 _userRewardDebt = _rewardDebt[j];
                    uint256 _userAccumulatedReward = _accumulatedReward[j];
                    liquidityMiningV2.setUserInfo(
                        poolId,
                        user,
                        address(SOV),
                        _userAmount,
                        _userRewardDebt,
                        _userAccumulatedReward
                    );
                }
                emit UserMigrated(user);
            }
        }
    }

    /**
     * @notice transfer all funds from liquidity mining V1
     */
    function migrateFunds() external onlyAuthorized onlyFundsMigrationState {
        _finishFundsMigration();
        liquidityMiningV1.migrateFunds();
        liquidityMiningV2.finishMigration();
    }
}
