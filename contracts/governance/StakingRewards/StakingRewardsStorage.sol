pragma solidity ^0.5.17;

import "../../interfaces/IERC20.sol";
import "../Staking/IStaking.sol";
import "../../openzeppelin/Ownable.sol";

/**
 * @title Staking Rewards Storage contact.
 * @notice Just the storage part of staking rewards contract, no functions,
 * only constant, variables and required structures (mappings).
 * Used by StackingRewardsProxy.
 *
 * What is SOV staking rewards - SIP-0024?
 * The purpose of the SOV staking rewards - SIP-0024 is to reward,
 * "marginal stakers" (ie, stakers by choice, not currently vesting) with liquid SOV
 * at the beginning of each new staking interval.
 * */
contract StakingRewardsStorage is Ownable {

	/// @notice The SOV token contract.
	IERC20 public SOV;

	///@notice the staking contract address
	IStaking public staking;

	/// @notice 2 weeks in seconds.
	uint256 constant TWO_WEEKS = 1209600;

	/// @notice Represents the time when the contract is deployed
	uint256 public startTime;

	/// @notice Represents the block when the Staking Rewards pogram is stopped
	uint256 public stopBlock;

	/// @notice Annual Base Rate
	uint256 public baseRate;

	/// @notice Divisor
	uint256 public divisor;
}
