pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../IFeeSharingProxy.sol";
import "../Staking/IStaking.sol";
import "../../mixins/EnumerableAddressSet.sol";

/**
 * @title FeeSharingProxy Storage contact.
 * @notice Just the storage part of feeSharingProxy contract, no functions,
 * only constant, variables and required structures (mappings).
 * Used by FeeSharingProxy, and the implementation logic of FeeSharingProxy (FeeSharingLogic)
 *
 * */
contract FeeSharingProxyStorage is Ownable {
    using EnumerableAddressSet for EnumerableAddressSet.AddressSet;
    /// @dev TODO FEE_WITHDRAWAL_INTERVAL, MAX_CHECKPOINTS
    uint256 constant FEE_WITHDRAWAL_INTERVAL = 86400;

    uint32 constant MAX_CHECKPOINTS = 100;

    IProtocol public protocol;
    IStaking public staking;

    /// @notice Checkpoints by index per pool token address
    mapping(address => mapping(uint256 => Checkpoint)) public tokenCheckpoints;

    /// @notice The number of checkpoints for each pool token address.
    mapping(address => uint256) public numTokenCheckpoints;

    /// @notice
    /// user => token => processed checkpoint
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

    function underlyingToLoanPool(address token) external returns (address);

    function wrbtcToken() external returns (address);

    function getSovTokenAddress() external view returns (address);
}
