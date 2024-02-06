pragma solidity ^0.5.17;

import { IERC20Mintable } from "../../interfaces/IERC20Mintable.sol";
import { IStaking } from "../Staking/interfaces/IStaking.sol";
import { Ownable } from "../../openzeppelin/Ownable.sol";

/**
 * @title Staking Rewards Storage Contract.
 * @notice Just the storage part of staking rewards contract, no functions,
 * only constant, variables and required structures (mappings).
 * Used by StackingRewardsProxy.
 *
 * What is SOV staking rewards - SIP-0024?
 * The purpose of the SOV staking rewards - SIP-0024 is to reward,
 * "marginal stakers" (ie, stakers by choice, not currently vesting) with liquid SOV
 * at the beginning of each new staking interval.
 * */
contract StakingRewardsOsStorage is Ownable {
    /// @notice The SOV token contract.
    IERC20Mintable public osSOV;

    ///@notice the staking proxy contract address
    IStaking public staking;

    /// @notice 2 weeks in seconds.
    uint256 public constant TWO_WEEKS = 1209600;

    /// @notice Annual Base Rate - it is the maximum interest rate(APY)
    uint256 public constant BASE_RATE = 900;

    /// @notice DIVISOR is set as 2600000 = 26 (num periods per year) * 10 (max voting weight) * 10000 (900 -> 0.09)
    uint256 public constant DIVISOR = 2600000;

    /// @notice Maximum duration to collect rewards at one go
    uint256 public maxDuration;

    /// @notice Represents the time when the contract is deployed
    uint256 public rewardsProgramStartTime;

    /// @notice Represents the block when the Staking Rewards pogram is stopped
    uint256 public stopBlock;
    /// @notice Timestamp of the stopBlock adjusted to the staking lock timestamp
    uint256 public stopRewardsTimestamp;

    /// @notice User Address -> Last Withdrawn Timestamp
    mapping(address => uint256) public userLastWithdrawTimestamp;

    /// @notice User Address -> Claimed Balance
    mapping(address => uint256) public claimedBalances;

    /// @notice Represents the block when the StakingRwards Program is started
    uint256 public deploymentBlock;

    /// Moved the variables from Initializable contract to resolve issue caused by incorrect Inheritance Order
    /**
     * @dev Indicates that the contract has been initialized.
     */
    bool private _initialized;

    /**
     * @dev Indicates that the contract is in the process of being initialized.
     */
    bool private _initializing;

    /// @notice BlockTime -> BlockNumber for a Staking Checkpoint
    mapping(uint256 => uint256) public checkpointBlockDetails;

    /// @notice Average Block Time - making it flexible
    uint256 public averageBlockTime;
}
