pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

/// SPDX-License-Identifier: MIT

import "../openzeppelin/ERC20.sol";
import "../openzeppelin/SafeERC20.sol";
import "../openzeppelin/SafeMath.sol";
import "../openzeppelin/Ownable.sol";

// MasterChef is the master of RSOV. He can make RSOV and he is a fair guy.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once RSOV is sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract LiquidityMining is Ownable {
	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	uint256 public constant PRECISION = 1e12;
	// Bonus multiplier for early RSOV makers.
	// During bonus period each passed block will be calculated like N passed blocks, where N = BONUS_MULTIPLIER
	uint256 public constant BONUS_BLOCK_MULTIPLIER = 10;

	//TODO check if we can use uint128 instead of uint256 to save 1 storage slot for each user
	// Info of each user.
	struct UserInfo {
		uint256 amount; // How many pool tokens the user has provided.
		uint256 rewardDebt; // Reward debt. See explanation below.
		//
		// We do some fancy math here. Basically, any point in time, the amount of RSOVs
		// entitled to a user but is accumulated to be distributed is:
		//
		//   accumulated reward = (user.amount * pool.accumulatedRSOVPerShare) - user.rewardDebt
		//
		// Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
		//   1. The pool's `accumulatedRSOVPerShare` (and `lastRewardBlock`) gets updated.
		//   2. User receives the accumulated reward sent to his/her address.
		//   3. User's `amount` gets updated.
		//   4. User's `rewardDebt` gets updated.
	}

	//TODO probably, we can save slots here, not sure we will have a lot of pools
	// Info of each pool.
	struct PoolInfo {
		IERC20 poolToken; // Address of LP token contract.
		uint256 allocationPoint; // How many allocation points assigned to this pool. RSOVs to distribute per block.
		uint256 lastRewardBlock; // Last block number that RSOVs distribution occurs.
		uint256 accumulatedRSOVPerShare; // Accumulated RSOVs per share, times 1e12. See below.
	}

	// The RSOV TOKEN!
	ERC20 public RSOV;
	// RSOV tokens created per block.
	uint256 public RSOVPerBlock;
	// The block number when RSOV mining starts.
	uint256 public startBlock;
	// Block number when bonus RSOV period ends.
	uint256 public bonusEndBlock;

	//TODO check of we still need this array
	// Info of each pool.
	PoolInfo[] public poolInfoList;
	// TODO use _lpToken instead of _pid in all functions
	mapping(address => uint256) poolIdList;

	// Info of each user that stakes LP tokens.
	mapping(uint256 => mapping(address => UserInfo)) public userInfoMap;
	// Total allocation points. Must be the sum of all allocation points in all pools.
	uint256 public totalAllocationPoint;

	event PoolTokenAdded(address indexed user, address indexed poolToken, uint256 allocationPoint);
	event PoolTokenUpdated(address indexed user, address indexed poolToken, uint256 newAllocationPoint, uint256 oldAllocationPoint);
	event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
	event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
	event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

	//TODO _startBlock, _bonusEndBlock - start/stop button with updating start and bonus end blocks
	function initialize(
		ERC20 _RSOV,
		uint256 _RSOVPerBlock,
		uint256 _startBlock,
		uint256 _bonusEndBlock
	) public onlyOwner {
		require(address(RSOV) == address(0), "Already initialized");
		require(address(_RSOV) != address(0), "Invalid token address");

		RSOV = _RSOV;
		RSOVPerBlock = _RSOVPerBlock;
		startBlock = _startBlock;
		bonusEndBlock = _bonusEndBlock;
	}

	//TODO what about removing pool tokens?
	//TODO we can use a workaround - update(_allocationPoint = 0)

	// Add a new lp to the pool. Can only be called by the owner.
	function add(address _poolToken, uint256 _allocationPoint, bool _withUpdate) public onlyOwner {
		require(_allocationPoint > 0, "Invalid allocation point");
		require(_poolToken != address(0), "Invalid token address");
		require(poolIdList[_poolToken] == 0, "Token already added");

		if (_withUpdate) {
			updateAllPools();
		}

		uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
		totalAllocationPoint = totalAllocationPoint.add(_allocationPoint);

		poolInfoList.push(PoolInfo({
			poolToken: IERC20(_poolToken),
			allocationPoint: _allocationPoint,
			lastRewardBlock: lastRewardBlock,
			accumulatedRSOVPerShare: 0
		}));
		//indexing starts from 1 in order to check whether token was already added
		poolIdList[_poolToken] = poolInfoList.length;

		emit PoolTokenAdded(msg.sender, _poolToken, _allocationPoint);
	}

	// Update the given pool's RSOV allocation point. Can only be called by the owner.
	function update(address _poolToken, uint256 _allocationPoint, bool _withUpdate) public onlyOwner {
		uint256 poolId = _getPoolId(_poolToken);

		if (_withUpdate) {
			updateAllPools();
		}

		uint256 previousAllocationPoint = poolInfoList[poolId].allocationPoint;
		totalAllocationPoint = totalAllocationPoint.sub(previousAllocationPoint).add(_allocationPoint);
		poolInfoList[poolId].allocationPoint = _allocationPoint;

		emit PoolTokenUpdated(msg.sender, _poolToken, _allocationPoint, previousAllocationPoint);
	}

	// Return reward multiplier over the given _from to _to block.
	function getPassedBlocksWithBonusMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
		if (_to <= bonusEndBlock) {
			return _to.sub(_from).mul(BONUS_BLOCK_MULTIPLIER);
		} else if (_from >= bonusEndBlock) {
			return _to.sub(_from);
		} else {
			return bonusEndBlock.sub(_from).mul(BONUS_BLOCK_MULTIPLIER).add(_to.sub(bonusEndBlock));
		}
	}

	function _getAccumulatedReward(uint256 _poolId, address _user) internal view returns (uint256) {
		PoolInfo storage pool = poolInfoList[_poolId];
		UserInfo storage user = userInfoMap[_poolId][_user];

		uint256 accRSOVPerShare = pool.accumulatedRSOVPerShare;
		uint256 lpSupply = pool.poolToken.balanceOf(address(this));
		if (block.number > pool.lastRewardBlock && lpSupply != 0) {
			uint256 passedBlocks = getPassedBlocksWithBonusMultiplier(pool.lastRewardBlock, block.number);
			uint256 RSOVReward = passedBlocks.mul(RSOVPerBlock).mul(pool.allocationPoint).div(totalAllocationPoint);
			accRSOVPerShare = accRSOVPerShare.add(RSOVReward.mul(PRECISION).div(lpSupply));
		}
		return user.amount.mul(accRSOVPerShare).div(PRECISION).sub(user.rewardDebt);
	}

	// View function to see accumulated reward on frontend.
	function getAccumulatedReward(address _poolToken, address _user) external returns (uint256) {
		uint256 poolId = _getPoolId(_poolToken);
		return _getAccumulatedReward(poolId, _user);
	}

	// Update reward variables for all pools. Be careful of gas spending!
	function updateAllPools() public {
		uint256 length = poolInfoList.length;
		for (uint256 pid = 0; pid < length; ++pid) {
			_updatePool(pid);
		}
	}

	function updatePool(address _poolToken) external {
		uint256 poolId = _getPoolId(_poolToken);
		_updatePool(poolId);
	}

	// Update reward variables of the given pool to be up-to-date.
	function _updatePool(uint256 _poolId) internal {
		PoolInfo storage pool = poolInfoList[_poolId];

		//this pool has been updated recently
		if (block.number <= pool.lastRewardBlock) {
			return;
		}

		uint256 lpSupply = pool.poolToken.balanceOf(address(this));
		if (lpSupply == 0) {
			pool.lastRewardBlock = block.number;
			return;
		}

		uint256 multiplier = getPassedBlocksWithBonusMultiplier(pool.lastRewardBlock, block.number);
		uint256 RSOVReward = multiplier.mul(RSOVPerBlock).mul(pool.allocationPoint).div(totalAllocationPoint);
		//TODO I think we can use RSOV.mint(RSOVReward), but this contract should have an appropriate amount of SOV
		//TODO or as you mentioned this contract should have an appropriate amount of RSOV
		//todo original code minted tokens here, we have to supply tokens to this contract instead
		//RSOV.mint(address(this), RSOVReward);
		pool.accumulatedRSOVPerShare = pool.accumulatedRSOVPerShare.add(RSOVReward.mul(PRECISION).div(lpSupply));
		pool.lastRewardBlock = block.number;
	}

	// Deposit LP tokens to LiquidityMining for RSOV allocation.
	function deposit(address _poolToken, uint256 _amount) public {
		uint256 poolId = _getPoolId(_poolToken);
		PoolInfo storage pool = poolInfoList[poolId];
		UserInfo storage user = userInfoMap[poolId][msg.sender];

		_updatePool(poolId);

		if (user.amount > 0) {
			uint256 accumulatedReward = user.amount.mul(pool.accumulatedRSOVPerShare).div(PRECISION).sub(user.rewardDebt);
			_safeRSOVTransfer(msg.sender, accumulatedReward);
		}
		pool.poolToken.safeTransferFrom(address(msg.sender), address(this), _amount);
		user.amount = user.amount.add(_amount);
		user.rewardDebt = user.amount.mul(pool.accumulatedRSOVPerShare).div(PRECISION);
		emit Deposit(msg.sender, poolId, _amount);
	}

	function claimReward(address _poolToken) public {
		deposit(_poolToken, 0);
	}

	// Withdraw LP tokens from LiquidityMining.
	function withdraw(address _poolToken, uint256 _amount) public {
		uint256 poolId = _getPoolId(_poolToken);
		PoolInfo storage pool = poolInfoList[poolId];
		UserInfo storage user = userInfoMap[poolId][msg.sender];
		require(user.amount >= _amount, "withdraw: not good");

		_updatePool(poolId);

		uint256 accumulatedReward = user.amount.mul(pool.accumulatedRSOVPerShare).div(PRECISION).sub(user.rewardDebt);
		_safeRSOVTransfer(msg.sender, accumulatedReward);
		user.amount = user.amount.sub(_amount);
		user.rewardDebt = user.amount.mul(pool.accumulatedRSOVPerShare).div(PRECISION);

		pool.poolToken.safeTransfer(address(msg.sender), _amount);
		emit Withdraw(msg.sender, poolId, _amount);
	}

	// Withdraw without caring about rewards. EMERGENCY ONLY.
	function emergencyWithdraw(address _poolToken) public {
		uint256 poolId = _getPoolId(_poolToken);
		PoolInfo storage pool = poolInfoList[poolId];
		UserInfo storage user = userInfoMap[poolId][msg.sender];

		pool.poolToken.safeTransfer(address(msg.sender), user.amount);
		emit EmergencyWithdraw(msg.sender, poolId, user.amount);
		user.amount = 0;
		user.rewardDebt = 0;
	}

	// Safe RSOV transfer function, just in case if rounding error causes pool to not have enough RSOVs.
	function _safeRSOVTransfer(address _to, uint256 _amount) internal {
		uint256 RSOVBal = RSOV.balanceOf(address(this));
		if (_amount > RSOVBal) {
			_amount = RSOVBal;
		}
		require(RSOV.transfer(_to, _amount), "transfer failed");
	}

	function getPoolId(address _poolToken) public returns (uint256) {
		return _getPoolId(_poolToken);
	}

	function _getPoolId(address _poolToken) internal returns (uint256) {
		uint256 poolId = poolIdList[_poolToken];
		require(poolId > 0, "Pool token not found");
		return poolId - 1;
	}

	// Custom logic - helpers

	function getPoolLength() external view returns (uint256) {
		return poolInfoList.length;
	}

	function getPoolInfoList() external view returns (PoolInfo[] memory) {
		return poolInfoList;
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
			userBalanceList[i][1] = _getAccumulatedReward(i, _user);
		}
		return userBalanceList;
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
	function getAccumulatedRewardList(address _user) external view returns (uint256[] memory) {
		uint256 length = poolInfoList.length;
		uint256[] memory rewardList = new uint256[](length);
		for (uint256 i = 0; i < length; i++) {
			rewardList[i] = _getAccumulatedReward(i, _user);
		}
		return rewardList;
	}

}
