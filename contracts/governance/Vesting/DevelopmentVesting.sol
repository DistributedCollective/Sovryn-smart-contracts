pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../openzeppelin/SafeMath.sol";
import "../../interfaces/IERC20.sol";
import "./IVesting.sol";

contract DevelopmentVesting is Ownable {
	using SafeMath for uint256;

	///@notice the SOV token contract
	IERC20 public SOV;
	///@notice the owner of the vested tokens (timelock contract initially)
	address public tokenOwner;

	///@notice the cliff. after this time period the tokens begin to unlock
	uint256 public cliff;
	///@notice the duration. after this period all tokens will have been unlocked
	uint256 public duration;
	///@notice the frequency. part of tokens will have been unlocked periodically
	uint256 public frequency;

	struct Schedule {
		///@notice the start date of the vesting
		uint256 startDate;
		///@notice amount of vested tokens
		uint256 amount;
		///@notice amount of already withdrawn tokens
		uint256 withdrawnAmount;
	}

	Schedule[] public schedules;

	///@notice amount of tokens, these tokens can be withdrawn any time by an owner
	uint256 public amount;

	event TokensSent(address indexed caller, uint256 amount);
	event TokensWithdrawn(address indexed caller, address receiver, uint256 amount);
	event TokensVested(address indexed caller, uint256 amount);
	event VestedTokensWithdrawn(address indexed caller, address receiver, uint256 amount);

	/**
	 * @dev Throws if called by any account other than the token owner or the contract owner.
	 */
	modifier onlyOwners() {
		require(msg.sender == tokenOwner || isOwner(), "unauthorized");
		_;
	}

	/**
	 * @notice setup the vesting schedule
	 * @param _SOV the SOV token address
	 * @param _tokenOwner the owner of the tokens
	 * @param _cliff the cliff in seconds
	 * @param _duration the total duration in seconds
	 * @param _frequency the withdrawal interval in seconds
	 */
	constructor(
		address _SOV,
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		uint256 _frequency
	) public {
		require(_SOV != address(0), "SOV address invalid");
		require(_tokenOwner != address(0), "token owner address invalid");

		_setSchedule(_cliff, _duration, _frequency);

		SOV = IERC20(_SOV);
		tokenOwner = _tokenOwner;
	}

	/**
	 * @notice set token owner
	 * @param _tokenOwner the owner of the tokens
	 */
	function setTokenOwner(address _tokenOwner) public onlyOwner {
		require(_tokenOwner != address(0), "token owner address invalid");
		tokenOwner = _tokenOwner;
	}

	/**
	 * @notice deposit tokens to this contract, these tokens can be withdrawn any time by an owner
	 * @param _amount the amount of tokens to send
	 */
	function depositTokens(uint256 _amount) public {
		require(_amount > 0, "amount needs to be bigger than 0");

		//retrieve the SOV tokens
		bool success = SOV.transferFrom(msg.sender, address(this), _amount);
		require(success);

		amount += _amount;

		emit TokensSent(msg.sender, _amount);
	}

	//TODO onlyOwners or onlyOwner ?
	/**
	 * @notice withdraws tokens that were not vested by a schedule (tokens were deposited to this contract)
	 * @param _amount the amount of tokens to be withdrawn
	 * @param _receiver the receiving address
	 */
	function withdrawTokens(uint256 _amount, address _receiver) public onlyOwners {
		require(_amount > 0, "amount needs to be bigger than 0");
		require(_amount <= amount, "amount is not available");
		require(_receiver != address(0), "receiver address invalid");

		bool success = SOV.transfer(_receiver, _amount);
		require(success);

		amount -= _amount;

		emit TokensWithdrawn(msg.sender, _receiver, _amount);
	}

	/**
	 * @notice change the vesting schedule
	 * @param _cliff the cliff in seconds
	 * @param _duration the total duration in seconds
	 * @param _frequency the withdrawal interval in seconds
	 */
	function changeSchedule(
		uint256 _cliff,
		uint256 _duration,
		uint256 _frequency
	) public onlyOwner {
		_setSchedule(_cliff, _duration, _frequency);
	}

	function _setSchedule(
		uint256 _cliff,
		uint256 _duration,
		uint256 _frequency
	) internal {
		require(_duration >= _cliff, "duration must be bigger than or equal to the cliff");
		require((_duration - _cliff) >= _frequency, "frequency is bigger than (duration - cliff)");

		cliff = _cliff;
		duration = _duration;
		frequency = _frequency;
	}

	/**
	 * @notice stakes tokens by a schedule
	 * @param _amount the amount of tokens to vest
	 */
	function vestTokens(uint256 _amount) public {
		//TODO should we check for some minimum amount here to avoid spam transactions ?
		require(_amount > 0, "amount needs to be bigger than 0");

		//retrieve the SOV tokens
		bool success = SOV.transferFrom(msg.sender, address(this), _amount);
		require(success);

		Schedule memory schedule = Schedule(block.timestamp, _amount, 0);
		schedules.push(schedule);

		emit TokensVested(msg.sender, _amount);
	}

	/**
	 * @notice withdraws unlocked tokens by all schedules and forwards them to an address specified by the token owner
	 * @param _receiver the receiving address
	 */
	function withdrawByAllSchedules(address _receiver) public onlyOwners {
		_withdrawBySchedules(_receiver, 0, schedules.length);
	}

	/**
	 * @notice withdraws unlocked tokens by given schedules and forwards them to an address specified by the token owner
	 * @param _receiver the receiving address
	 * @param _start the first schedule index to be processed
	 * @param _number the number of schedules to be processed
	 * @dev this operation can be done N times
	 * @dev this function can be used if withdrawByAllSchedules exceeds block gas limit
	 */
	function withdrawByGivenSchedules(
		address _receiver,
		uint256 _start,
		uint256 _number
	) public onlyOwners {
		uint256 length = _start + _number;
		if (length > schedules.length) {
			length = schedules.length;
		}
		_withdrawBySchedules(_receiver, _start, length);
	}

	function _withdrawBySchedules(
		address _receiver,
		uint256 _start,
		uint256 _length
	) internal {
		require(_receiver != address(0), "receiver address invalid");
		uint256 availableAmount = 0;
		for (uint256 i = _start; i < _length; i++) {
			availableAmount += _updateWithdrawnAmount(i);
		}
		require(availableAmount > 0, "no available tokens");

		bool success = SOV.transfer(_receiver, availableAmount);
		require(success);

		emit VestedTokensWithdrawn(msg.sender, _receiver, availableAmount);
	}

	function _updateWithdrawnAmount(uint256 index) internal returns (uint256) {
		Schedule storage schedule = schedules[index];
		uint256 availableAmount = _getUnlockedAmount(index) - schedule.withdrawnAmount;
		if (availableAmount > 0) {
			schedule.withdrawnAmount += availableAmount;
		}
		return availableAmount;
	}

	//amount of SOV tokens never hits 2**256 - 1
	function _getUnlockedAmount(uint256 index) internal view returns (uint256) {
		Schedule storage schedule = schedules[index];
		uint256 start = schedule.startDate + cliff;
		uint256 end = schedule.startDate + duration;
		if (block.timestamp >= start) {
			uint256 numIntervals;
			uint256 intervalNumber;
			if (frequency == 0) {
				numIntervals = 1;
				intervalNumber = 1;
			} else {
				numIntervals = (end - start) / frequency + 1;
				intervalNumber = (block.timestamp - start) / frequency + 1;
			}
			uint256 amountPerInterval = schedule.amount / numIntervals;
			if (intervalNumber > numIntervals) {
				intervalNumber = numIntervals;
			}
			//amountPerInterval might lose some dust on rounding. add it to the first interval
			uint256 unlockedAmount = schedule.amount - amountPerInterval * numIntervals;
			return unlockedAmount + amountPerInterval * intervalNumber;
		} else {
			return 0;
		}
	}
}
