pragma solidity ^0.5.17;

import "../../../openzeppelin/Ownable.sol";
import "../../../interfaces/IERC20.sol";
import "../../Staking/Staking.sol";
import "../../IFeeSharingProxy.sol";
import "../../../openzeppelin/Address.sol";

/**
 * @title Four Year Vesting Storage Contract.
 *
 * @notice This contract is just the storage required for four year vesting.
 * It is parent of FourYearVestingLogic and FourYearVesting.
 *
 * @dev Use Ownable as a parent to align storage structure for Logic and Proxy contracts.
 * */
contract FourYearVestingStorage is Ownable {
	/// @notice The SOV token contract.
	IERC20 public SOV;

	/// @notice The staking contract address.
	Staking public staking;

	/// @notice The owner of the vested tokens.
	address public tokenOwner;

	/// @notice Fee sharing Proxy.
	IFeeSharingProxy public feeSharingProxy;

	/// @notice The cliff. After this time period the tokens begin to unlock.
	uint256 public constant CLIFF = 4 weeks;

	/// @notice The duration. After this period all tokens will have been unlocked.
	uint256 public constant DURATION = 156 weeks;

	/// @notice The start date of the vesting.
	uint256 public startDate;

	/// @notice The end date of the vesting.
	uint256 public endDate;

	/// @notice Constant used for computing the vesting dates.
	uint256 public constant FOUR_WEEKS = 4 weeks;

	/// @notice Maximum interval to stake tokens at one go
	uint256 public maxInterval;

	/// @notice End of previous staking schedule
	uint256 public lastStakingSchedule;

	/// @notice Amount of shares left to be staked
	uint256 public remainingStakeAmount;

	/// @notice Durations left
	uint256 public durationLeft;

	/// @notice Cliffs added
	uint256 public cliffAdded;
}
