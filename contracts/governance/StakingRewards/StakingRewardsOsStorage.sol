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
 * What is SOV staking rewards ?
 * The purpose of the SOV staking rewards program is to reward,
 * "marginal stakers" (ie, stakers by choice, not currently vesting) with liquid SOV
 * at the beginning of each new staking interval.
 * */
contract StakingRewardsOsStorage is Ownable {
    /// @notice 2 weeks in seconds.
    uint256 public constant TWO_WEEKS = 1209600;

    /// @notice Annual Base Rate - it is the maximum interest rate(APY)
    uint256 public constant BASE_RATE = 900;

    /// @notice DIVISOR is set as 2600000 = 26 (num periods per year) * 10 (max voting weight) * 10000 (900 -> 0.09)
    uint256 public constant DIVISOR = 2600000;

    /// @notice The SOV token contract.
    // solhint-disable private-vars-leading-underscore
    IERC20Mintable internal osSOV;

    /// @notice the staking proxy contract address
    IStaking internal staking;

    /// @notice Maximum duration to collect rewards at one go
    uint256 internal maxDuration;

    /// @notice Represents the time when the contract is deployed
    uint256 internal rewardsProgramStartTime;

    /// @notice Represents the block when the Staking Rewards pogram is stopped
    uint256 internal stopBlock;

    /// @notice Timestamp of the stopBlock adjusted to the staking lock timestamp
    uint256 internal stopRewardsTimestamp;

    /// @notice User Address -> Next Withdrawn Timestamp
    mapping(address => uint256) internal stakerNextWithdrawTimestamp;

    /// @notice User Address -> Claimed Balance
    mapping(address => uint256) internal claimedBalances;

    /// @notice Represents the block when the StakingRwards Program is started
    uint256 internal deploymentBlock;

    /// @notice BlockTime -> BlockNumber for a Staking Checkpoint
    mapping(uint256 => uint256) internal checkpointBlockNumber;

    /// @notice Average Block Time - making it flexible
    uint256 internal averageBlockTime;

    /// GETTERS
    /// @param _checkpointTimestamp Checkpoint timestamp
    function getCheckpointBlockNumber(
        uint256 _checkpointTimestamp
    ) external view returns (uint256) {
        return checkpointBlockNumber[_checkpointTimestamp];
    }

    function getOsSOV() external view returns (IERC20Mintable) {
        return osSOV;
    }

    function getStaking() external view returns (IStaking) {
        return staking;
    }

    function getMaxDuration() external view returns (uint256) {
        return maxDuration;
    }

    function getRewardsProgramStartTime() external view returns (uint256) {
        return rewardsProgramStartTime;
    }

    function getStopBlock() external view returns (uint256) {
        return stopBlock;
    }

    function getStopRewardsTimestamp() external view returns (uint256) {
        return stopRewardsTimestamp;
    }

    function getStakerNextWithdrawTimestamp(address _staker) external view returns (uint256) {
        return stakerNextWithdrawTimestamp[_staker];
    }

    function getDeploymentBlock() external view returns (uint256) {
        return deploymentBlock;
    }

    function getAverageBlockTime() external view returns (uint256) {
        return averageBlockTime;
    }

    function getClaimedBalances(address _staker) external view returns (uint256) {
        return claimedBalances[_staker];
    }
}
