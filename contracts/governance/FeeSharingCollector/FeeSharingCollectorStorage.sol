pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../IFeeSharingCollector.sol";
import "../Staking/interfaces/IStaking.sol";
import "../../mixins/EnumerableAddressSet.sol";
import "../../interfaces/IWrbtcERC20.sol";

/**
 * @title FeeSharingCollectorStorage contact
 * @notice Just the storage part of FeeSharingCollector contract, and FeeSharingCollectorProxy. No functions,
 * only constant, variables and required structures (mappings)
 * */
contract FeeSharingCollectorStorage is Ownable {
    using EnumerableAddressSet for EnumerableAddressSet.AddressSet;
    uint256 constant FEE_WITHDRAWAL_INTERVAL = 172800;

    IProtocol public protocol;
    IStaking public staking;

    /// @notice Checkpoints by index per pool token address
    mapping(address => mapping(uint256 => Checkpoint)) public tokenCheckpoints;

    /// @notice The number of checkpoints for each token address.
    mapping(address => uint256) public totalTokenCheckpoints;

    /// @notice
    /// user => token => processed checkpoints
    mapping(address => mapping(address => uint256)) public processedCheckpoints;

    /// @notice Last time fees were withdrawn per pool token address:
    /// token => time
    mapping(address => uint256) public lastFeeWithdrawalTime;

    /// @notice Amount of tokens that were transferred, but not saved in checkpoints.
    /// token => amount
    mapping(address => uint96) public unprocessedAmount;

    struct Checkpoint {
        uint32 blockNumber;
        uint32 timestamp;
        uint96 totalWeightedStake;
        uint96 numTokens;
    }

    struct TokenWithdraw {
        address tokenAddress;
        bool hasSkippedCheckpoints;
        uint256 fromCheckpoint;
    }

    /**
     * @dev Add extra modifier (Reentrancy) below.
     * Because we cannot add any additional storage slot before this storage contract after initial deployment
     */

    /// @dev Constant for unlocked guard state - non-zero to prevent extra gas costs.
    /// See: https://github.com/OpenZeppelin/openzeppelin-solidity/issues/1056
    uint256 internal constant REENTRANCY_GUARD_FREE = 1;

    /// @dev Constant for locked guard state
    uint256 internal constant REENTRANCY_GUARD_LOCKED = 2;

    /**
     * @dev We use a single lock for the whole contract.
     */
    uint256 internal reentrancyLock = REENTRANCY_GUARD_FREE;

    /**
     * @dev Additional storage for converter whitelist mechanism.
     * @dev Initialization here does not works. We need to create a separate setter & getter.
     * @dev Just set the visibility to internal should be fine.
     */
    EnumerableAddressSet.AddressSet internal whitelistedConverterList;

    mapping(bytes4 => bool) public isFunctionExecuted;

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * If you mark a function `nonReentrant`, you should also
     * mark it `external`. Calling one `nonReentrant` function from
     * another is not supported. Instead, you can implement a
     * `private` function doing the actual work, and an `external`
     * wrapper marked as `nonReentrant`.
     */
    modifier nonReentrant() {
        require(reentrancyLock == REENTRANCY_GUARD_FREE, "nonReentrant");
        reentrancyLock = REENTRANCY_GUARD_LOCKED;
        _;
        reentrancyLock = REENTRANCY_GUARD_FREE;
    }
}

/* Interfaces */

interface IProtocol {
    /**
     *
     * @param tokens The array address of the token instance.
     * @param receiver The address of the withdrawal recipient.
     *
     * @return The withdrawn total amount in wRBTC
     * */
    function withdrawFees(address[] calldata tokens, address receiver)
        external
        returns (uint256 totalWRBTCWithdrawn);

    function underlyingToLoanPool(address token) external view returns (address);

    function wrbtcToken() external view returns (IWrbtcERC20);

    function getSovTokenAddress() external view returns (address);
}
