pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../IFeeSharingProxy.sol";
import "../Staking/IStaking.sol";

/**
 * @title FeeSharingProxy Storage contact.
 * @notice Just the storage part of feeSharingProxy contract, no functions,
 * only constant, variables and required structures (mappings).
 * Used by FeeSharingProxy, and the implementation logic of FeeSharingProxy (FeeSharingLogic)
 *
 * */
contract FeeSharingProxyStorage is Ownable {
	/// @dev TODO FEE_WITHDRAWAL_INTERVAL, MAX_CHECKPOINTS
	uint256 constant FEE_WITHDRAWAL_INTERVAL = 86400;

	uint32 constant MAX_CHECKPOINTS = 100;

	IProtocol public protocol;
	IStaking public staking;

	/// @notice Checkpoints by index per pool token address
	mapping(address => mapping(uint256 => Checkpoint)) public tokenCheckpoints;

	/// @notice The number of checkpoints for each pool token address.
	mapping(address => uint32) public numTokenCheckpoints;

	/// @notice
	/// user => token => processed checkpoint
	mapping(address => mapping(address => uint32)) public processedCheckpoints;

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
	function withdrawFees(address[] calldata tokens, address receiver) external returns (uint256);

	function underlyingToLoanPool(address token) external returns (address);

	function wrbtcToken() external returns (address);
}