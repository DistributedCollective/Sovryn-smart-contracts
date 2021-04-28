pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../openzeppelin/ERC20.sol";
import "../openzeppelin/SafeERC20.sol";
import "../openzeppelin/SafeMath.sol";
import "./LiquidityMiningStorage.sol";

contract LiquidityMining is LiquidityMiningStorage {
	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	uint256 public constant PRECISION = 1e12;
	// Bonus multiplier for early liquidity providers.
	// During bonus period each passed block will be calculated like N passed blocks, where N = BONUS_MULTIPLIER
	uint256 public constant BONUS_BLOCK_MULTIPLIER = 10;

	event SRVTransferred(address indexed receiver, uint256 amount);
	event PoolTokenAdded(address indexed user, address indexed poolToken, uint256 allocationPoint);
	event PoolTokenUpdated(address indexed user, address indexed poolToken, uint256 newAllocationPoint, uint256 oldAllocationPoint);
	event Deposit(address indexed user, address indexed poolToken, uint256 amount);
	event RewardClaimed(address indexed user, uint256 amount);
	event Withdraw(address indexed user, address indexed poolToken, uint256 amount);
	event EmergencyWithdraw(address indexed user, address indexed poolToken, uint256 amount);

	/**
	 * @notice initialize mining
	 * @param _SRV reward token
	 * @param _rewardTokensPerBlock number of reward tokens per block
	 * @param _startDelayBlocks the number of blocks should be passed to start mining
	 * @param _numberOfBonusBlocks the number of blocks when each block will be calculated as N blocks (BONUS_BLOCK_MULTIPLIER)
	 */
	function initialize(
		IERC20 _SRV,
		uint256 _rewardTokensPerBlock,
		uint256 _startDelayBlocks,
		uint256 _numberOfBonusBlocks,
		address _wrapper
	) public onlyOwner {
		require(address(SRV) == address(0), "Already initialized");
		require(address(_SRV) != address(0), "Invalid token address");
		require(_startDelayBlocks > 0, "Invalid start block");

		SRV = _SRV;
		rewardTokensPerBlock = _rewardTokensPerBlock;
		startBlock = block.number + _startDelayBlocks;
		bonusEndBlock = startBlock + _numberOfBonusBlocks;
		wrapper = _wrapper;
	}

	/**
	 * @notice sets wrapper proxy contract
	 * @dev can be set to zero address to remove wrapper
	 */
	function setWrapper(address _wrapper) public onlyOwner {
		wrapper = _wrapper;
	}

	/**
	 * @notice stops mining by setting end block
	 */
	function stopMining() public onlyOwner {
		require(endBlock == 0, "Already stopped");

		endBlock = block.number;
	}

	/**
	 * @notice transfers SRV tokens to given address
	 * @param _receiver the address of the SRV receiver
	 * @param _amount the amount to be transferred
	 */
	function transferSRV(address _receiver, uint256 _amount) public onlyOwner {
		require(_receiver != address(0), "receiver address invalid");
		require(_amount != 0, "amount invalid");

		uint256 SRVBal = SRV.balanceOf(address(this));
		if (_amount > SRVBal) {
			_amount = SRVBal;
		}
		require(SRV.transfer(_receiver, _amount), "transfer failed");
		emit SRVTransferred(_receiver, _amount);
	}

	function getMissedBalance() public view returns (uint256) {
		uint256 balance = SRV.balanceOf(address(this));
		return balance >= totalUsersBalance ? 0 : totalUsersBalance.sub(balance);
	}

	/**
	 * @notice adds a new lp to the pool. Can only be called by the owner
	 * @param _poolToken the address of pool token
	 * @param _allocationPoint the allocation point (weight) for the given pool
	 * @param _withUpdate the flag whether we need to update all pools
	 */
	function add(
		address _poolToken,
		uint96 _allocationPoint,
		bool _withUpdate
	) public onlyOwner {
		require(_allocationPoint > 0, "Invalid allocation point");
		require(_poolToken != address(0), "Invalid token address");
		require(poolIdList[_poolToken] == 0, "Token already added");

		if (_withUpdate) {
			updateAllPools();
		}

		uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
		totalAllocationPoint = totalAllocationPoint.add(_allocationPoint);

		poolInfoList.push(
			PoolInfo({
				poolToken: IERC20(_poolToken),
				allocationPoint: _allocationPoint,
				lastRewardBlock: lastRewardBlock,
				accumulatedRewardPerShare: 0
			})
		);
		//indexing starts from 1 in order to check whether token was already added
		poolIdList[_poolToken] = poolInfoList.length;

		emit PoolTokenAdded(msg.sender, _poolToken, _allocationPoint);
	}

	/**
	 * @notice updates the given pool's reward tokens allocation point
	 * @param _poolToken the address of pool token
	 * @param _allocationPoint the allocation point (weight) for the given pool
	 * @param _withUpdate the flag whether we need to update all pools
	 */
	function update(
		address _poolToken,
		uint96 _allocationPoint,
		bool _withUpdate
	) public onlyOwner {
		uint256 poolId = _getPoolId(_poolToken);

		if (_withUpdate) {
			updateAllPools();
		} else {
			updatePool(_poolToken);
		}

		uint256 previousAllocationPoint = poolInfoList[poolId].allocationPoint;
		totalAllocationPoint = totalAllocationPoint.sub(previousAllocationPoint).add(_allocationPoint);
		poolInfoList[poolId].allocationPoint = _allocationPoint;

		emit PoolTokenUpdated(msg.sender, _poolToken, _allocationPoint, previousAllocationPoint);
	}

	/**
	 * @notice returns reward multiplier over the given _from to _to block
	 * @param _from the first block for a calculation
	 * @param _to the last block for a calculation
	 */
	function _getPassedBlocksWithBonusMultiplier(uint256 _from, uint256 _to) internal view returns (uint256) {
		if (_from < startBlock) {
			_from = startBlock;
		}
		if (endBlock > 0 && _to > endBlock) {
			_to = endBlock;
		}
		if (_to <= bonusEndBlock) {
			return _to.sub(_from).mul(BONUS_BLOCK_MULTIPLIER);
		} else if (_from >= bonusEndBlock) {
			return _to.sub(_from);
		} else {
			return bonusEndBlock.sub(_from).mul(BONUS_BLOCK_MULTIPLIER).add(_to.sub(bonusEndBlock));
		}
	}

	function _getUserAccumulatedReward(uint256 _poolId, address _user) internal view returns (uint256) {
		PoolInfo storage pool = poolInfoList[_poolId];
		UserInfo storage user = userInfoMap[_poolId][_user];

		uint256 accumulatedRewardPerShare = pool.accumulatedRewardPerShare;
		uint256 poolTokenBalance = pool.poolToken.balanceOf(address(this));
		if (block.number > pool.lastRewardBlock && poolTokenBalance != 0) {
			(, uint256 accumulatedRewardPerShare_) = _getPoolAccumulatedReward(pool);
			accumulatedRewardPerShare = accumulatedRewardPerShare.add(accumulatedRewardPerShare_);
		}
		return user.amount.mul(accumulatedRewardPerShare).div(PRECISION).sub(user.rewardDebt);
	}

	/**
	 * @notice returns accumulated reward
	 * @param _poolToken the address of pool token
	 * @param _user the user address
	 */
	function getUserAccumulatedReward(address _poolToken, address _user) external view returns (uint256) {
		uint256 poolId = _getPoolId(_poolToken);
		return _getUserAccumulatedReward(poolId, _user);
	}

	/**
	 * @notice Updates reward variables for all pools.
	 * @dev Be careful of gas spending!
	 */
	function updateAllPools() public {
		uint256 length = poolInfoList.length;
		for (uint256 i = 0; i < length; i++) {
			_updatePool(i);
		}
	}

	/**
	 * @notice Updates reward variables of the given pool to be up-to-date
	 * @param _poolToken the address of pool token
	 */
	function updatePool(address _poolToken) public {
		uint256 poolId = _getPoolId(_poolToken);
		_updatePool(poolId);
	}

	function _updatePool(uint256 _poolId) internal {
		PoolInfo storage pool = poolInfoList[_poolId];

		//this pool has been updated recently
		if (block.number <= pool.lastRewardBlock) {
			return;
		}

		uint256 poolTokenBalance = pool.poolToken.balanceOf(address(this));
		if (poolTokenBalance == 0) {
			pool.lastRewardBlock = block.number;
			return;
		}

		(uint256 accumulatedReward_, uint256 accumulatedRewardPerShare_) = _getPoolAccumulatedReward(pool);
		pool.accumulatedRewardPerShare = pool.accumulatedRewardPerShare.add(accumulatedRewardPerShare_);
		pool.lastRewardBlock = block.number;

		totalUsersBalance = totalUsersBalance.add(accumulatedReward_);
	}

	function _getPoolAccumulatedReward(PoolInfo storage pool) internal view returns (uint256, uint256) {
		uint256 passedBlocks = _getPassedBlocksWithBonusMultiplier(pool.lastRewardBlock, block.number);
		uint256 accumulatedReward = passedBlocks.mul(rewardTokensPerBlock).mul(pool.allocationPoint).div(totalAllocationPoint);

		uint256 poolTokenBalance = pool.poolToken.balanceOf(address(this));
		uint256 accumulatedRewardPerShare = accumulatedReward.mul(PRECISION).div(poolTokenBalance);
		return (accumulatedReward, accumulatedRewardPerShare);
	}

	/**
	 * @notice deposits pool tokens
	 * @param _poolToken the address of pool token
	 * @param _amount the amount of pool tokens
	 * @param _user the address of user, tokens will be deposited to it or to msg.sender
	 */
	function deposit(address _poolToken, uint256 _amount, address _user) public {
		require(poolIdList[_poolToken] != 0, "Pool token not found");
		address userAddress = _user != address(0) ? _user : msg.sender;

		uint256 poolId = _getPoolId(_poolToken);
		PoolInfo storage pool = poolInfoList[poolId];
		UserInfo storage user = userInfoMap[poolId][userAddress];

		_updatePool(poolId);
		_updateReward(pool, user);

		if (_amount > 0) {
			user.amount = user.amount.add(_amount);
			pool.poolToken.safeTransferFrom(address(msg.sender), address(this), _amount);
		}
		_updateRewardDebt(pool, user);
		emit Deposit(userAddress, _poolToken, _amount);
	}

	/**
	 * @notice transfers reward tokens
	 * @param _poolToken the address of pool token
	 * @param _user the address of user to claim reward from (can be passed only by wrapper contract)
	 */
	function claimReward(address _poolToken, address _user) public {
		require(poolIdList[_poolToken] != 0, "Pool token not found");
		address userAddress = _getUserAddress(_user);

		uint256 poolId = _getPoolId(_poolToken);
		PoolInfo storage pool = poolInfoList[poolId];
		UserInfo storage user = userInfoMap[poolId][userAddress];

		_updatePool(poolId);
		_updateReward(pool, user);
		_transferReward(user, userAddress); //send to user directly
		_updateRewardDebt(pool, user);
	}

	/**
	 * @notice withdraws pool tokens and transfers reward tokens
	 * @param _poolToken the address of pool token
	 * @param _amount the amount of pool tokens
	 * @param _user the user address will be used to process a withdrawal (can be passed only by wrapper contract)
	 */
	function withdraw(address _poolToken, uint256 _amount, address _user) public {
		require(poolIdList[_poolToken] != 0, "Pool token not found");
		address userAddress = _getUserAddress(_user);

		uint256 poolId = _getPoolId(_poolToken);
		PoolInfo storage pool = poolInfoList[poolId];
		UserInfo storage user = userInfoMap[poolId][userAddress];
		require(user.amount >= _amount, "Not enough balance");

		_updatePool(poolId);
		_updateReward(pool, user);
		_transferReward(user, userAddress); //send to user directly

		user.amount = user.amount.sub(_amount);
		pool.poolToken.safeTransfer(address(msg.sender), _amount); //sent to the user or wrapper
		_updateRewardDebt(pool, user);
		emit Withdraw(userAddress, _poolToken, _amount);
	}

	function _getUserAddress(address _user) internal view returns (address) {
		address userAddress = msg.sender;
		if (_user != address(0)) {
			//only wrapper can pass _user parameter
			require(msg.sender == wrapper && _user == tx.origin, "unauthorized");
			userAddress = _user;
		}
		return userAddress;
	}

	function _updateReward(PoolInfo storage pool, UserInfo storage user) internal {
		//update user accumulated reward
		if (user.amount > 0) {
			//add reward for the previous amount of deposited tokens
			uint256 accumulatedReward = user.amount.mul(pool.accumulatedRewardPerShare).div(PRECISION).sub(user.rewardDebt);
			user.accumulatedReward = user.accumulatedReward.add(accumulatedReward);
		}
	}

	function _updateRewardDebt(PoolInfo storage pool, UserInfo storage user) internal {
		//reward accumulated before amount update (should be subtracted during next reward calculation)
		user.rewardDebt = user.amount.mul(pool.accumulatedRewardPerShare).div(PRECISION);
	}

	function _transferReward(UserInfo storage _user, address _userAddress) internal {
		uint256 userAccumulatedReward = _user.accumulatedReward;
		uint256 balance = SRV.balanceOf(address(this));
		if (balance >= userAccumulatedReward) {
			totalUsersBalance = totalUsersBalance.sub(userAccumulatedReward);
			_user.accumulatedReward = 0;
			require(SRV.transfer(_userAddress, userAccumulatedReward), "transfer failed");
			emit RewardClaimed(_userAddress, userAccumulatedReward);
		}
	}

	/**
	 * @notice withdraws pool tokens without transferring reward tokens
	 * @param _poolToken the address of pool token
	 * @dev EMERGENCY ONLY
	 */
	function emergencyWithdraw(address _poolToken) public {
		uint256 poolId = _getPoolId(_poolToken);
		PoolInfo storage pool = poolInfoList[poolId];
		UserInfo storage user = userInfoMap[poolId][msg.sender];

		uint256 userAmount = user.amount;
		user.amount = 0;
		user.rewardDebt = 0;
		user.accumulatedReward = 0;
		pool.poolToken.safeTransfer(address(msg.sender), userAmount);
		emit EmergencyWithdraw(msg.sender, _poolToken, userAmount);
	}

	/**
	 * @notice returns pool id
	 * @param _poolToken the address of pool token
	 */
	function getPoolId(address _poolToken) public view returns (uint256) {
		return _getPoolId(_poolToken);
	}

	function _getPoolId(address _poolToken) internal view returns (uint256) {
		uint256 poolId = poolIdList[_poolToken];
		require(poolId > 0, "Pool token not found");
		return poolId - 1;
	}

	/**
	 * @notice returns count of pool tokens
	 */
	function getPoolLength() external view returns (uint256) {
		return poolInfoList.length;
	}

	/**
	 * @notice returns list of pool token's info
	 */
	function getPoolInfoList() external view returns (PoolInfo[] memory) {
		return poolInfoList;
	}

	/**
	 * @notice returns pool info for the given token
	 * @param _poolToken the address of pool token
	 */
	function getPoolInfo(address _poolToken) external view returns (PoolInfo memory) {
		uint256 poolId = _getPoolId(_poolToken);
		return poolInfoList[poolId];
	}

	/**
	 * @notice returns list of [amount, accumulatedReward] for the given user for each pool token
	 * @param _user the address of the user
	 */
	function getUserBalanceList(address _user) external view returns (uint256[2][] memory) {
		uint256 length = poolInfoList.length;
		uint256[2][] memory userBalanceList = new uint256[2][](length);
		for (uint256 i = 0; i < length; i++) {
			userBalanceList[i][0] = userInfoMap[i][_user].amount;
			userBalanceList[i][1] = _getUserAccumulatedReward(i, _user);
		}
		return userBalanceList;
	}

	/**
	 * @notice returns UserInfo for the given pool and user
	 * @param _poolToken the address of pool token
	 * @param _user the address of the user
	 */
	function getUserInfo(address _poolToken, address _user) external view returns (UserInfo memory) {
		uint256 poolId = _getPoolId(_poolToken);
		return userInfoMap[poolId][_user];
	}

	/**
	 * @notice returns list of UserInfo for the given user for each pool token
	 * @param _user the address of the user
	 */
	function getUserInfoList(address _user) external view returns (UserInfo[] memory) {
		uint256 length = poolInfoList.length;
		UserInfo[] memory userInfoList = new UserInfo[](length);
		for (uint256 i = 0; i < length; i++) {
			userInfoList[i] = userInfoMap[i][_user];
		}
		return userInfoList;
	}

	/**
	 * @notice returns accumulated reward for the given user for each pool token
	 * @param _user the address of the user
	 */
	function getUserAccumulatedRewardList(address _user) external view returns (uint256[] memory) {
		uint256 length = poolInfoList.length;
		uint256[] memory rewardList = new uint256[](length);
		for (uint256 i = 0; i < length; i++) {
			rewardList[i] = _getUserAccumulatedReward(i, _user);
		}
		return rewardList;
	}
}
