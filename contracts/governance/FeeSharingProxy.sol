pragma solidity ^0.5.17;

import "./Staking/SafeMath96.sol";
import "../openzeppelin/SafeMath.sol";
import "../openzeppelin/SafeERC20.sol";
import "./IFeeSharingProxy.sol";
import "./Staking/IStaking.sol";

contract FeeSharingProxy is SafeMath96, IFeeSharingProxy {
	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	//TODO FEE_WITHDRAWAL_INTERVAL, MAX_CHECKPOINTS
	uint256 constant FEE_WITHDRAWAL_INTERVAL = 86400;

	uint32 constant MAX_CHECKPOINTS = 100;

	IProtocol public protocol;
	IStaking public staking;

	/// checkpoints by index per pool token address
	mapping(address => mapping(uint256 => Checkpoint)) public tokenCheckpoints;
	/// @notice The number of checkpoints for each pool token address
	mapping(address => uint32) public numTokenCheckpoints;

	/// user => token => processed checkpoint
	mapping(address => mapping(address => uint32)) public processedCheckpoints;

	//token => time
	mapping(address => uint256) public lastFeeWithdrawalTime;

	//token => amount
	//amount of tokens that were transferred, but were not saved in checkpoints
	mapping(address => uint96) public unprocessedAmount;

	struct Checkpoint {
		uint32 blockNumber;
		uint32 timestamp;
		uint96 totalWeightedStake;
		uint96 numTokens;
	}

	/// @notice An event that emitted when fee get withdrawn
	event FeeWithdrawn(address indexed sender, address indexed token, uint256 amount);

	/// @notice An event that emitted when tokens transferred
	event TokensTransferred(address indexed sender, address indexed token, uint256 amount);

	/// @notice An event that emitted when checkpoint added
	event CheckpointAdded(address indexed sender, address indexed token, uint256 amount);

	/// @notice An event that emitted when user fee get withdrawn
	event UserFeeWithdrawn(address indexed sender, address indexed receiver, address indexed token, uint256 amount);

	constructor(IProtocol _protocol, IStaking _staking) public {
		protocol = _protocol;
		staking = _staking;
	}

	/**
	 * @notice withdraw fees for the given token: lendingFee + tradingFee + borrowingFee
	 * @param _token address of the token
	 * */
	function withdrawFees(address _token) public {
		require(_token != address(0), "FeeSharingProxy::withdrawFees: invalid address");

		address loanPoolToken = protocol.underlyingToLoanPool(_token);
		require(loanPoolToken != address(0), "FeeSharingProxy::withdrawFees: loan token not found");

		uint256 amount = protocol.withdrawFees(_token, address(this));
		require(amount > 0, "FeeSharingProxy::withdrawFees: no tokens to withdraw");

		//TODO can be also used - function addLiquidity(IERC20Token _reserveToken, uint256 _amount, uint256 _minReturn)
		IERC20(_token).approve(loanPoolToken, amount);
		uint256 poolTokenAmount = ILoanToken(loanPoolToken).mint(address(this), amount);

		//update unprocessed amount of tokens
		uint96 amount96 = safe96(poolTokenAmount, "FeeSharingProxy::withdrawFees: pool token amount exceeds 96 bits");
		unprocessedAmount[loanPoolToken] = add96(
			unprocessedAmount[loanPoolToken],
			amount96,
			"FeeSharingProxy::withdrawFees: unprocessedAmount exceeds 96 bits"
		);

		_addCheckpoint(loanPoolToken);

		emit FeeWithdrawn(msg.sender, loanPoolToken, poolTokenAmount);
	}

	/**
	 * @notice transfer tokens to this contract
	 * @dev we just update amount of tokens here and write checkpoint in a separate methods
	 * in order to prevent adding checkpoints too often
	 * @param _token address of the token
	 * @param _amount amount to be transferred
	 * */
	function transferTokens(address _token, uint96 _amount) public {
		require(_token != address(0), "FeeSharingProxy::transferTokens: invalid address");
		require(_amount > 0, "FeeSharingProxy::transferTokens: invalid amount");

		//transfer tokens from msg.sender
		bool success = IERC20(_token).transferFrom(address(msg.sender), address(this), _amount);
		require(success, "Staking::transferTokens: token transfer failed");

		//update unprocessed amount of tokens
		unprocessedAmount[_token] = add96(unprocessedAmount[_token], _amount, "FeeSharingProxy::transferTokens: amount exceeds 96 bits");

		_addCheckpoint(_token);

		emit TokensTransferred(msg.sender, _token, _amount);
	}

	/**
	 * @notice adds checkpoint with accumulated amount by function invocation
	 * @param _token address of the token
	 * */
	function _addCheckpoint(address _token) internal {
		if (block.timestamp - lastFeeWithdrawalTime[_token] >= FEE_WITHDRAWAL_INTERVAL) {
			lastFeeWithdrawalTime[_token] = block.timestamp;
			uint96 amount = unprocessedAmount[_token];
			unprocessedAmount[_token] = 0;
			//write a regular checkpoint
			_writeTokenCheckpoint(_token, amount);
		}
	}

	/**
	 * @notice withdraw accumulated fee the message sender
	 * @param _loanPoolToken address of the pool token
	 * @param _maxCheckpoints maximum number of checkpoints to be processed
	 * @param _receiver the receiver of tokens or msg.sender
	 * */
	function withdraw(
		address _loanPoolToken,
		uint32 _maxCheckpoints,
		address _receiver
	) public {
		//prevents processing all checkpoints because of block gas limit
		require(_maxCheckpoints > 0, "FeeSharingProxy::withdraw: _maxCheckpoints should be positive");

		address user = msg.sender;
		if (_receiver == address(0)) {
			_receiver = msg.sender;
		}

		uint256 amount;
		uint32 end;
		(amount, end) = _getAccumulatedFees(user, _loanPoolToken, _maxCheckpoints);

		processedCheckpoints[user][_loanPoolToken] = end;

		require(IERC20(_loanPoolToken).transfer(user, amount), "FeeSharingProxy::withdraw: withdrawal failed");

		emit UserFeeWithdrawn(msg.sender, _receiver, _loanPoolToken, amount);
	}

	/**
	 * @notice returns accumulated fee for the message sender
	 * @param _user the address of the user or contract
	 * @param _loanPoolToken address of the pool token
	 * */
	function getAccumulatedFees(address _user, address _loanPoolToken) public view returns (uint256) {
		uint256 amount;
		(amount, ) = _getAccumulatedFees(_user, _loanPoolToken, 0);
		return amount;
	}

	function _getAccumulatedFees(
		address _user,
		address _loanPoolToken,
		uint32 _maxCheckpoints
	) internal view returns (uint256, uint32) {
		uint32 start = processedCheckpoints[_user][_loanPoolToken];
		uint32 end;
		//additional bool param can't be used because of stack too deep error
		if (_maxCheckpoints > 0) {
			//withdraw -> _getAccumulatedFees
			require(start < numTokenCheckpoints[_loanPoolToken], "FeeSharingProxy::withdrawFees: no tokens for a withdrawal");
			end = _getEndOfRange(start, _loanPoolToken, _maxCheckpoints);
		} else {
			//getAccumulatedFees -> _getAccumulatedFees
			//don't throw error for getter invocation outside of transaction
			if (start >= numTokenCheckpoints[_loanPoolToken]) {
				return (0, numTokenCheckpoints[_loanPoolToken]);
			}
			end = numTokenCheckpoints[_loanPoolToken];
		}

		uint256 amount = 0;
		uint256 cachedLockDate = 0;
		uint96 cachedWeightedStake = 0;
		for (uint32 i = start; i < end; i++) {
			Checkpoint storage checkpoint = tokenCheckpoints[_loanPoolToken][i];
			uint256 lockDate = staking.timestampToLockDate(checkpoint.timestamp);
			uint96 weightedStake;
			if (lockDate == cachedLockDate) {
				weightedStake = cachedWeightedStake;
			} else {
				//We need to use "checkpoint.blockNumber - 1" here to calculate weighted stake
				//for the same block like we did for total voting power in _writeTokenCheckpoint
				weightedStake = staking.getPriorWeightedStake(_user, checkpoint.blockNumber - 1, checkpoint.timestamp);
				cachedWeightedStake = weightedStake;
				cachedLockDate = lockDate;
			}
			uint256 share = uint256(checkpoint.numTokens).mul(weightedStake).div(uint256(checkpoint.totalWeightedStake));
			amount = amount.add(share);
		}
		return (amount, end);
	}

	function _getEndOfRange(
		uint32 start,
		address _loanPoolToken,
		uint32 _maxCheckpoints
	) internal view returns (uint32) {
		uint32 nCheckpoints = numTokenCheckpoints[_loanPoolToken];
		uint32 end;
		if (_maxCheckpoints == 0) {
			//all checkpoints will be processed (only for getter outside of a transaction)
			end = nCheckpoints;
		} else {
			if (_maxCheckpoints > MAX_CHECKPOINTS) {
				_maxCheckpoints = MAX_CHECKPOINTS;
			}
			end = safe32(start + _maxCheckpoints, "FeeSharingProxy::withdraw: checkpoint index exceeds 32 bits");
			if (end > nCheckpoints) {
				end = nCheckpoints;
			}
		}
		//Withdrawal should only be possible for blocks which were already mined.
		uint32 lastBlockNumber = tokenCheckpoints[_loanPoolToken][end - 1].blockNumber;
		if (block.number == lastBlockNumber) {
			end--;
		}
		return end;
	}

	function _writeTokenCheckpoint(address _token, uint96 _numTokens) internal {
		uint32 blockNumber = safe32(block.number, "FeeSharingProxy::_writeCheckpoint: block number exceeds 32 bits");
		uint32 blockTimestamp = safe32(block.timestamp, "FeeSharingProxy::_writeCheckpoint: block timestamp exceeds 32 bits");
		uint32 nCheckpoints = numTokenCheckpoints[_token];

		uint96 totalWeightedStake = staking.getPriorTotalVotingPower(blockNumber - 1, block.timestamp);
		if (nCheckpoints > 0 && tokenCheckpoints[_token][nCheckpoints - 1].blockNumber == blockNumber) {
			tokenCheckpoints[_token][nCheckpoints - 1].totalWeightedStake = totalWeightedStake;
			tokenCheckpoints[_token][nCheckpoints - 1].numTokens = _numTokens;
		} else {
			tokenCheckpoints[_token][nCheckpoints] = Checkpoint(blockNumber, blockTimestamp, totalWeightedStake, _numTokens);
			numTokenCheckpoints[_token] = nCheckpoints + 1;
		}
		emit CheckpointAdded(msg.sender, _token, _numTokens);
	}
}

interface IProtocol {
	function withdrawFees(address token, address receiver) external returns (uint256);

	function underlyingToLoanPool(address token) external returns (address);
}

interface ILoanToken {
	function mint(address receiver, uint256 depositAmount) external returns (uint256 mintAmount);
}
