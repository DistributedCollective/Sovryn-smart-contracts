pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../Staking/Staking.sol";
import "../IFeeSharingProxy.sol";

/**
 * @title Vesting Storage Contract.
 *
 * @notice This contract is just the storage required for vesting.
 * It is parent of VestingLogic and TeamVesting.
 *
 * @dev Use Ownable as a parent to align storage structure for Logic and Proxy contracts.
 */
contract VestingStorage is Ownable {
	/// @notice The SOV token contract.
	IERC20 public SOV;

	/// @notice The staking contract address.
	Staking public staking;

	/// @notice The owner of the vested tokens.
	address public tokenOwner;

	/// @notice Fee sharing Proxy.
	IFeeSharingProxy public feeSharingProxy;

	/// @notice The cliff. After this time period the tokens begin to unlock.
	uint256 public cliff;

	/// @notice The duration. After this period all tokens will have been unlocked.
	uint256 public duration;

	/// @notice The start date of the vesting.
	uint256 public startDate;

	/// @notice The end date of the vesting.
	uint256 public endDate;

	/// @notice Constant used for computing the vesting dates.
	uint256 constant FOUR_WEEKS = 4 weeks;
}
