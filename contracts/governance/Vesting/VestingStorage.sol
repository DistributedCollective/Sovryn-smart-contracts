pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../Staking/Staking.sol";
import "../IFeeSharingProxy.sol";

/**
 * Vesting Storage Contract
 * @dev use Ownable as a parent to align storage structure for Logic and Proxy contracts
 */
contract VestingStorage is Ownable {
	///@notice the SOV token contract
	IERC20 public SOV;
	///@notice the staking contract address
	Staking public staking;
	///@notice the owner of the vested tokens
	address public tokenOwner;
	//@notice fee sharing Proxy
	IFeeSharingProxy public feeSharingProxy;
	///@notice the cliff. after this time period the tokens begin to unlock
	uint256 public cliff;
	///@notice the duration. after this period all tokens will have been unlocked
	uint256 public duration;
	///@notice the start date of the vesting
	uint256 public startDate;
	///@notice the end date of the vesting
	uint256 public endDate;
	///@notice constant used for computing the vesting dates
	uint256 constant FOUR_WEEKS = 4 weeks;
}
