pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../openzeppelin/ERC20.sol";
import "../openzeppelin/SafeERC20.sol";
import "../openzeppelin/SafeMath.sol";
import "./LiquidityMiningStorageV2.sol";
import "./IRewardTransferLogic.sol";
import "./ILiquidityMiningV2.sol";

/// @notice This contract is a new liquidity mining version that let's the user
///         to earn multiple reward tokens by staking LP tokens as opposed to the
/// 				previous one that only rewarded SOV
contract LiquidityMiningV2 is ILiquidityMiningV2, LiquidityMiningStorageV2 {
	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	/* Constants */

	uint256 public constant PRECISION = 1e12;

	uint256 public constant SECONDS_PER_BLOCK = 30;

	/* Events */

	event RewardTransferred(address indexed rewardToken, address indexed receiver, uint256 amount);
	event PoolTokenAdded(address indexed user, address indexed poolToken, address[] rewardTokens, uint96[] allocationPoints);
	event PoolTokenUpdated(
		address indexed user,
		address indexed poolToken,
		address indexed rewardToken,
		uint96 newAllocationPoint,
		uint96 oldAllocationPoint
	);
	event PoolTokenAssociation(address indexed user, uint256 indexed poolId, address indexed rewardToken, uint96 allocationPoint);
	event Deposit(address indexed user, address indexed poolToken, uint256 amount);
	event RewardClaimed(address indexed user, address indexed rewardToken, uint256 amount);
	event Withdraw(address indexed user, address indexed poolToken, uint256 amount);
	event EmergencyWithdraw(
		address indexed user,
		address indexed poolToken,
		address indexed rewardToken,
		uint256 amount,
		uint256 accumulatedReward
	);

	/* Modifiers */
	modifier onlyMigrator() {
		require(msg.sender == migrator, "only allowed to migrator contract");
		_;
	}

	modifier onlyAfterMigrationFinished() {
		require(migrationFinished, "Migration is not over yet");
		_;
	}

	/* Functions */

	/**
	 * @notice Initialize mining.
	 */
	function initialize(
		address _wrapper,
		address _migrator,
		IERC20 _SOV
	) external onlyAuthorized {
		/// @dev Non-idempotent function. Must be called just once.
		require(_migrator != address(0), "invalid contract address");
		require(address(_SOV) != address(0), "invalid token address");
		wrapper = _wrapper;
		migrator = _migrator;
	}

	/**
	 * @notice Add a new reward token
	 *
	 * @param _rewardToken The token to be rewarded to LP stakers.
	 * @param _rewardTokensPerBlock The number of reward tokens per block.
	 * @param _startDelayBlocks The number of blocks should be passed to start
	 *   mining.
	 */
	function addRewardToken(
		address _rewardToken,
		uint256 _rewardTokensPerBlock,
		uint256 _startDelayBlocks,
		address _rewardTransferLogic
	) external onlyAuthorized {
		/// @dev Non-idempotent function. Must be called just once.
		RewardToken storage rewardToken = rewardTokensMap[_rewardToken];
		require(rewardToken.startBlock == 0, "Already added");
		require(address(_rewardToken) != address(0), "Invalid token address");
		require(_startDelayBlocks > 0, "Invalid start block");

		IRewardTransferLogic rewardTransferLogic = IRewardTransferLogic(_rewardTransferLogic);
		require(_rewardToken == rewardTransferLogic.getRewardTokenAddress(), "Reward token and transfer logic mismatch");
		rewardTokensMap[_rewardToken] = RewardToken({
			rewardTokensPerBlock: _rewardTokensPerBlock,
			startBlock: block.number + _startDelayBlocks,
			endBlock: 0,
			totalAllocationPoint: 0,
			totalUsersBalance: 0,
			rewardTransferLogic: rewardTransferLogic
		});
	}

	/**
	 * @notice sets wrapper proxy contract
	 * @dev can be set to zero address to remove wrapper
	 */
	function setWrapper(address _wrapper) external onlyAuthorized {
		wrapper = _wrapper;
	}

	/**
	 * @notice stops mining by setting end block
	 */
	function stopMining(address _rewardToken) external onlyAuthorized {
		RewardToken storage rewardToken = rewardTokensMap[_rewardToken];
		require(rewardToken.startBlock != 0, "Not initialized");
		require(rewardToken.endBlock == 0, "Already stopped");

		rewardToken.endBlock = block.number;
	}

	/**
	 * @notice Transfers reward tokens to given address.
	 *   Owner use this function to withdraw reward tokens from LM contract
	 *   into another account.
	 * @param _rewardToken The address of the rewardToken
	 * @param _receiver The address of the tokens receiver.
	 * @param _amount The amount to be transferred.
	 * */
	function transferRewardTokens(
		address _rewardToken,
		address _receiver,
		uint256 _amount
	) external onlyAuthorized {
		require(_rewardToken != address(0), "Reward address invalid");
		require(_receiver != address(0), "Receiver address invalid");
		require(_amount != 0, "Amount invalid");

		IERC20 rewardToken = IERC20(_rewardToken);

		/// @dev Do not transfer more SOV than available.
		uint256 balance = rewardToken.balanceOf(address(this));
		if (_amount > balance) {
			_amount = balance;
		}

		/// @dev Event log.
		emit RewardTransferred(_rewardToken, _receiver, _amount);
		/// @dev The actual transfer.
		require(rewardToken.transfer(_receiver, _amount), "Transfer failed");
	}

	/**
	 * @notice Get the missed rewardTokens balance of LM contract.
	 *
	 * @return The amount of reward tokens according to totalUsersBalance
	 *   in excess of actual balance of the LM contract.
	 * */
	function getMissedBalance(address _rewardToken) external view returns (uint256) {
		IERC20 rewardToken = IERC20(_rewardToken);
		uint256 totalUsersBalance = rewardTokensMap[_rewardToken].totalUsersBalance;
		uint256 balance = rewardToken.balanceOf(address(this));
		return balance >= totalUsersBalance ? 0 : totalUsersBalance.sub(balance);
	}

	/**
	 * @notice adds a new lp to the pool. Can only be called by the owner or an admin
	 * @param _poolToken the address of pool token
	 * @param _rewardTokens the addresses of reward tokens for given pool
	 * @param _allocationPoints the allocation points (weight) for the given pool and each reward token
	 * @param _withUpdate the flag whether we need to update all pools
	 */
	function add(
		address _poolToken,
		address[] calldata _rewardTokens,
		uint96[] calldata _allocationPoints,
		bool _withUpdate
	) external onlyAuthorized {
		require(_rewardTokens.length > 0, "Invalid reward tokens length");
		require(_rewardTokens.length == _allocationPoints.length, "Invalid allocation points length");
		require(_poolToken != address(0), "Invalid token address");
		require(poolIdList[_poolToken] == 0, "Token already added");

		if (_withUpdate) {
			updateAllPools();
		}

		poolInfoList.push(PoolInfo({ poolToken: IERC20(_poolToken), rewardTokens: _rewardTokens }));
		//indexing starts from 1 in order to check whether token was already added
		poolIdList[_poolToken] = poolInfoList.length;

		for (uint256 i = 0; i < _rewardTokens.length; i++) {
			associatePoolToRewardToken(_poolToken, _rewardTokens[i], _allocationPoints[i]);
		}

		emit PoolTokenAdded(msg.sender, _poolToken, _rewardTokens, _allocationPoints);
	}

	function associatePoolToRewardToken(
		address _poolToken,
		address _rewardToken,
		uint96 _allocationPoint
	) internal {
		uint256 poolId = _getPoolId(_poolToken);

		// Allocation point checks
		require(_allocationPoint > 0, "Invalid allocation point");

		// Reward token checks
		RewardToken storage rewardToken = rewardTokensMap[_rewardToken];
		uint256 startBlock = rewardToken.startBlock;
		require(startBlock != 0, "Not initialized");

		// Check association is not done twice

		require(poolInfoRewardTokensMap[poolId][_rewardToken].allocationPoint == 0, "Already associated");

		uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
		rewardToken.totalAllocationPoint = rewardToken.totalAllocationPoint.add(_allocationPoint);

		poolInfoRewardTokensMap[poolId][_rewardToken] = PoolInfoRewardToken({
			allocationPoint: _allocationPoint,
			lastRewardBlock: lastRewardBlock,
			accumulatedRewardPerShare: 0
		});

		emit PoolTokenAssociation(msg.sender, poolId, _rewardToken, _allocationPoint);
	}

	/**
	 * @notice updates the given pool's reward tokens allocation point
	 * @param _poolToken the address of pool token
	 * @param _rewardTokens the addresses of reward tokens for given pool
	 * @param _allocationPoints the allocation points (weight) for the given pool and each reward token
	 * @param _updateAllFlag the flag whether we need to update all pools
	 */
	function update(
		address _poolToken,
		address[] calldata _rewardTokens,
		uint96[] calldata _allocationPoints,
		bool _updateAllFlag
	) external onlyAuthorized {
		if (_updateAllFlag) {
			updateAllPools();
		} else {
			updatePool(_poolToken);
		}
		_updateTokens(_poolToken, _rewardTokens, _allocationPoints);
	}

	function _updateTokens(
		address _poolToken,
		address[] memory _rewardTokens,
		uint96[] memory _allocationPoints
	) internal {
		for (uint256 i = 0; i < _rewardTokens.length; i++) {
			_updateToken(_poolToken, _rewardTokens[i], _allocationPoints[i]);
		}
	}

	function _updateToken(
		address _poolToken,
		address _rewardToken,
		uint96 _allocationPoint
	) internal {
		uint256 poolId = _getPoolId(_poolToken);
		RewardToken storage rewardToken = rewardTokensMap[_rewardToken];
		PoolInfoRewardToken storage poolInfoRewardToken = poolInfoRewardTokensMap[poolId][_rewardToken];

		uint96 previousAllocationPoint = poolInfoRewardToken.allocationPoint;
		rewardToken.totalAllocationPoint = rewardToken.totalAllocationPoint.sub(previousAllocationPoint).add(_allocationPoint);
		poolInfoRewardToken.allocationPoint = _allocationPoint;

		emit PoolTokenUpdated(msg.sender, _poolToken, _rewardToken, _allocationPoint, previousAllocationPoint);
	}

	/**
	 * @notice updates the given pools' reward tokens allocation points
	 * @param _poolTokens array of addresses of pool tokens
	 * @param _allocationPoints array of allocation points (weight) for the given pools
	 * @param _updateAllFlag the flag whether we need to update all pools
	 */
	function updateTokens(
		address[] calldata _poolTokens,
		address[][] calldata _rewardTokens,
		uint96[][] calldata _allocationPoints,
		bool _updateAllFlag
	) external onlyAuthorized {
		require(_poolTokens.length == _allocationPoints.length, "Arrays mismatch");
		require(_poolTokens.length == _rewardTokens.length, "Arrays mismatch");

		if (_updateAllFlag) {
			updateAllPools();
		}
		uint256 length = _poolTokens.length;
		for (uint256 i = 0; i < length; i++) {
			require(_allocationPoints[i].length == _rewardTokens[i].length, "Arrays mismatch");
			_updateTokens(_poolTokens[i], _rewardTokens[i], _allocationPoints[i]);
		}
	}

	/**
	 * @notice returns reward multiplier over the given _from to _to block
	 * @param _from the first block for a calculation
	 * @param _to the last block for a calculation
	 */
	function _getPassedBlocks(
		RewardToken storage _rewardToken,
		uint256 _from,
		uint256 _to
	) internal view returns (uint256) {
		if (_from < _rewardToken.startBlock) {
			_from = _rewardToken.startBlock;
		}

		if (_rewardToken.endBlock > 0 && _to > _rewardToken.endBlock) {
			_to = _rewardToken.endBlock;
		}

		if (_to <= _from) {
			return 0;
		}

		return _to.sub(_from);
	}

	function _getUserAccumulatedReward(
		uint256 _poolId,
		address _rewardToken,
		address _user
	) internal view returns (uint256) {
		PoolInfo storage pool = poolInfoList[_poolId];
		PoolInfoRewardToken storage poolRewardToken = poolInfoRewardTokensMap[_poolId][_rewardToken];
		UserInfo storage user = userInfoMap[_poolId][_user];

		uint256 accumulatedRewardPerShare = poolRewardToken.accumulatedRewardPerShare;
		uint256 poolTokenBalance = pool.poolToken.balanceOf(address(this));
		if (block.number > poolRewardToken.lastRewardBlock && poolTokenBalance != 0) {
			(, uint256 accumulatedRewardPerShare_) = _getPoolAccumulatedReward(pool, poolRewardToken, rewardTokensMap[_rewardToken]);
			accumulatedRewardPerShare = accumulatedRewardPerShare.add(accumulatedRewardPerShare_);
		}
		return user.amount.mul(accumulatedRewardPerShare).div(PRECISION).sub(user.rewards[_rewardToken].rewardDebt);
	}

	/**
	 * @notice returns accumulated reward
	 * @param _poolToken the address of pool token
	 * @param _rewardToken the reward token address
	 * @param _user the user address
	 */
	function getUserAccumulatedReward(
		address _poolToken,
		address _rewardToken,
		address _user
	) external view returns (uint256) {
		uint256 poolId = _getPoolId(_poolToken);
		return _getUserAccumulatedReward(poolId, _rewardToken, _user);
	}

	/**
	 * @notice returns estimated reward
	 * @param _poolToken the address of pool token
	 * @param _rewardToken the reward token address
	 * @param _amount the amount of tokens to be deposited
	 * @param _duration the duration of liquidity providing in seconds
	 */
	function getEstimatedReward(
		address _poolToken,
		address _rewardToken,
		uint256 _amount,
		uint256 _duration
	) external view returns (uint256) {
		uint256 poolId = _getPoolId(_poolToken);
		PoolInfo storage pool = poolInfoList[poolId];
		uint256 start = block.number;
		uint256 end = start.add(_duration.div(SECONDS_PER_BLOCK));
		(, uint256 accumulatedRewardPerShare) =
			_getPoolAccumulatedReward(
				pool,
				_amount,
				rewardTokensMap[_rewardToken],
				poolInfoRewardTokensMap[poolId][_rewardToken],
				start,
				end
			);
		return _amount.mul(accumulatedRewardPerShare).div(PRECISION);
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

		uint256 rewardTokensLength = pool.rewardTokens.length;
		for (uint256 i = 0; i < rewardTokensLength; i++) {
			_updatePoolRewardToken(pool, _poolId, pool.rewardTokens[i]);
		}
	}

	function _updatePoolRewardToken(
		PoolInfo storage pool,
		uint256 _poolId,
		address _rewardToken
	) internal {
		PoolInfoRewardToken storage poolRewardToken = poolInfoRewardTokensMap[_poolId][_rewardToken];
		// this pool has been updated recently
		if (block.number <= poolRewardToken.lastRewardBlock) {
			return;
		}

		uint256 poolTokenBalance = pool.poolToken.balanceOf(address(this));
		if (poolTokenBalance == 0) {
			poolRewardToken.lastRewardBlock = block.number;
			return;
		}
		RewardToken storage rewardToken = rewardTokensMap[_rewardToken];

		(uint256 accumulatedReward_, uint256 accumulatedRewardPerShare_) = _getPoolAccumulatedReward(pool, poolRewardToken, rewardToken);
		poolRewardToken.accumulatedRewardPerShare = poolRewardToken.accumulatedRewardPerShare.add(accumulatedRewardPerShare_);
		poolRewardToken.lastRewardBlock = block.number;

		rewardToken.totalUsersBalance = rewardToken.totalUsersBalance.add(accumulatedReward_);
	}

	function _getPoolAccumulatedReward(
		PoolInfo storage _pool,
		PoolInfoRewardToken storage _poolRewardToken,
		RewardToken storage _rewardToken
	) internal view returns (uint256, uint256) {
		return _getPoolAccumulatedReward(_pool, 0, _rewardToken, _poolRewardToken, block.number);
	}

	function _getPoolAccumulatedReward(
		PoolInfo storage _pool,
		uint256 _additionalAmount,
		RewardToken storage _rewardToken,
		PoolInfoRewardToken storage _poolRewardToken,
		uint256 _endBlock
	) internal view returns (uint256, uint256) {
		return
			_getPoolAccumulatedReward(
				_pool,
				_additionalAmount,
				_rewardToken,
				_poolRewardToken,
				_poolRewardToken.lastRewardBlock,
				_endBlock
			);
	}

	function _getPoolAccumulatedReward(
		PoolInfo storage _pool,
		uint256 _additionalAmount,
		RewardToken storage _rewardToken,
		PoolInfoRewardToken storage _poolRewardToken,
		uint256 _startBlock,
		uint256 _endBlock
	) internal view returns (uint256, uint256) {
		uint256 passedBlocks = _getPassedBlocks(_rewardToken, _startBlock, _endBlock);
		uint256 accumulatedReward =
			passedBlocks.mul(_rewardToken.rewardTokensPerBlock).mul(PRECISION).mul(_poolRewardToken.allocationPoint).div(
				_rewardToken.totalAllocationPoint
			);

		uint256 poolTokenBalance = _pool.poolToken.balanceOf(address(this));
		poolTokenBalance = poolTokenBalance.add(_additionalAmount);
		uint256 accumulatedRewardPerShare = accumulatedReward.div(poolTokenBalance);
		return (accumulatedReward.div(PRECISION), accumulatedRewardPerShare);
	}

	/**
	 * @notice deposits pool tokens
	 * @param _poolToken the address of pool token
	 * @param _amount the amount of pool tokens
	 * @param _user the address of user, tokens will be deposited to it or to msg.sender
	 */
	function deposit(
		address _poolToken,
		uint256 _amount,
		address _user
	) external onlyAfterMigrationFinished {
		_deposit(_poolToken, _amount, _user, false);
	}

	/**
	 * @notice if the lending pools directly mint/transfer tokens to this address, process it like a user deposit
	 * @dev only callable by the pool which issues the tokens
	 * @param _user the user address
	 * @param _amount the minted amount
	 */
	function onTokensDeposited(address _user, uint256 _amount) external {
		//the msg.sender is the pool token. if the msg.sender is not a valid pool token, _deposit will revert
		_deposit(msg.sender, _amount, _user, true);
	}

	/**
	 * @notice internal function for depositing pool tokens
	 * @param _poolToken the address of pool token
	 * @param _amount the amount of pool tokens
	 * @param _user the address of user, tokens will be deposited to it
	 * @param alreadyTransferred true if the pool tokens have already been transferred
	 */
	function _deposit(
		address _poolToken,
		uint256 _amount,
		address _user,
		bool alreadyTransferred
	) internal {
		require(poolIdList[_poolToken] != 0, "Pool token not found");
		address userAddress = _user != address(0) ? _user : msg.sender;

		uint256 poolId = _getPoolId(_poolToken);
		PoolInfo storage pool = poolInfoList[poolId];
		UserInfo storage user = userInfoMap[poolId][userAddress];

		uint256 rewardTokensLength = pool.rewardTokens.length;
		for (uint256 i = 0; i < rewardTokensLength; i++) {
			address rewardTokenAddress = pool.rewardTokens[i];
			_updatePoolRewardToken(pool, poolId, rewardTokenAddress);
			//sends reward directly to the user
			_updateReward(poolId, rewardTokenAddress, user);
		}

		if (_amount > 0) {
			//receives pool tokens from msg.sender, it can be user or WrapperProxy contract
			if (!alreadyTransferred) pool.poolToken.safeTransferFrom(address(msg.sender), address(this), _amount);
			user.amount = user.amount.add(_amount);
		}

		for (uint256 i = 0; i < rewardTokensLength; i++) {
			address rewardTokenAddress = pool.rewardTokens[i];
			_updateRewardDebt(poolId, rewardTokenAddress, user);
		}
		emit Deposit(userAddress, _poolToken, _amount);
	}

	/**
	 * @notice transfers reward tokens
	 * @param _poolToken the address of pool token
	 * @param _user the address of user to claim reward from (can be passed only by wrapper contract)
	 */
	function claimRewards(address _poolToken, address _user) external onlyAfterMigrationFinished {
		address userAddress = _getUserAddress(_user);

		uint256 poolId = _getPoolId(_poolToken);
		PoolInfo storage pool = poolInfoList[poolId];
		uint256 rewardTokensLength = pool.rewardTokens.length;
		for (uint256 i = 0; i < rewardTokensLength; i++) {
			address rewardTokenAddress = pool.rewardTokens[i];
			_claimReward(poolId, rewardTokenAddress, userAddress);
		}
	}

	/**
	 * @notice transfers rewards from a specific reward token
	 * @param _poolToken the address of pool token
	 * @param _rewardToken the address of reward token
	 * @param _user the address of user to claim reward from (can be passed only by wrapper contract)
	 */
	function claimReward(
		address _poolToken,
		address _rewardToken,
		address _user
	) external onlyAfterMigrationFinished {
		address userAddress = _getUserAddress(_user);

		uint256 poolId = _getPoolId(_poolToken);
		_claimReward(poolId, _rewardToken, userAddress);
	}

	function _claimReward(
		uint256 _poolId,
		address _rewardToken,
		address _userAddress
	) internal {
		UserInfo storage user = userInfoMap[_poolId][_userAddress];
		PoolInfo storage pool = poolInfoList[_poolId];

		_updatePoolRewardToken(pool, _poolId, _rewardToken);
		_updateReward(_poolId, _rewardToken, user);
		_transferReward(_rewardToken, user, _userAddress, false, true);
		_updateRewardDebt(_poolId, _rewardToken, user);
	}

	/**
	 * @notice transfers reward tokens from all pools
	 * @param _user the address of user to claim reward from (can be passed only by wrapper contract)
	 */
	function claimRewardFromAllPools(address _user) external onlyAfterMigrationFinished {
		address userAddress = _getUserAddress(_user);

		uint256 length = poolInfoList.length;
		for (uint256 i = 0; i < length; i++) {
			uint256 poolId = i;
			PoolInfo storage pool = poolInfoList[poolId];
			uint256 rewardTokensLength = pool.rewardTokens.length;
			for (uint256 j = 0; j < rewardTokensLength; j++) {
				address rewardTokenAddress = pool.rewardTokens[j];
				_claimReward(poolId, rewardTokenAddress, userAddress);
			}
		}
	}

	/**
	 * @notice withdraws pool tokens and transfers reward tokens
	 * @param _poolToken the address of pool token
	 * @param _amount the amount of pool tokens
	 * @param _user the user address will be used to process a withdrawal (can be passed only by wrapper contract)
	 */
	function withdraw(
		address _poolToken,
		uint256 _amount,
		address _user
	) external onlyAfterMigrationFinished {
		require(poolIdList[_poolToken] != 0, "Pool token not found");
		address userAddress = _getUserAddress(_user);

		uint256 poolId = _getPoolId(_poolToken);
		PoolInfo storage pool = poolInfoList[poolId];
		UserInfo storage user = userInfoMap[poolId][userAddress];
		require(user.amount >= _amount, "Not enough balance");

		// Start collecting rewards for each reward token the user holds
		uint256 rewardTokensLength = pool.rewardTokens.length;
		for (uint256 i = 0; i < rewardTokensLength; i++) {
			address rewardTokenAddress = pool.rewardTokens[i];
			_updatePoolRewardToken(pool, poolId, rewardTokenAddress);
			_updateReward(poolId, rewardTokenAddress, user);
			_transferReward(rewardTokenAddress, user, userAddress, true, false);
		}
		user.amount = user.amount.sub(_amount);

		//msg.sender is wrapper -> send to wrapper
		if (msg.sender == wrapper) {
			pool.poolToken.safeTransfer(address(msg.sender), _amount);
		}
		//msg.sender is user or pool token (lending pool) -> send to user
		else {
			pool.poolToken.safeTransfer(userAddress, _amount);
		}

		for (uint256 i = 0; i < rewardTokensLength; i++) {
			address rewardTokenAddress = pool.rewardTokens[i];
			_updateRewardDebt(poolId, rewardTokenAddress, user);
		}
		emit Withdraw(userAddress, _poolToken, _amount);
	}

	function _getUserAddress(address _user) internal view returns (address) {
		address userAddress = msg.sender;
		if (_user != address(0)) {
			//only wrapper can pass _user parameter
			require(msg.sender == wrapper || poolIdList[msg.sender] != 0, "only wrapper or pools may withdraw for a user");
			userAddress = _user;
		}
		return userAddress;
	}

	function _updateReward(
		uint256 _poolId,
		address _rewardTokenAddress,
		UserInfo storage user
	) internal {
		UserReward storage reward = user.rewards[_rewardTokenAddress];
		//update user accumulated reward
		if (user.amount > 0) {
			//add reward for the previous amount of deposited tokens
			uint256 accumulatedReward =
				user.amount.mul(poolInfoRewardTokensMap[_poolId][_rewardTokenAddress].accumulatedRewardPerShare).div(PRECISION).sub(
					reward.rewardDebt
				);
			reward.accumulatedReward = reward.accumulatedReward.add(accumulatedReward);
		}
	}

	function _updateRewardDebt(
		uint256 poolId,
		address rewardToken,
		UserInfo storage user
	) internal {
		//reward accumulated before amount update (should be subtracted during next reward calculation)
		user.rewards[rewardToken].rewardDebt = user.amount.mul(poolInfoRewardTokensMap[poolId][rewardToken].accumulatedRewardPerShare).div(
			PRECISION
		);
	}

	/**
	 * @notice Send reward in SOV to the lockedSOV vault.
	 * @param _user The user info, to get its reward share.
	 * @param _userAddress The address of the user, to send SOV in its behalf.
	 * @param _isWithdrawal The flag whether determines if the user is withdrawing all the funds
	 * @param _isCheckingBalance The flag whether we need to throw error or don't process reward if SOV balance isn't enough
	 */
	function _transferReward(
		address _rewardToken,
		UserInfo storage _user,
		address _userAddress,
		bool _isWithdrawal,
		bool _isCheckingBalance
	) internal {
		uint256 userAccumulatedReward = _user.rewards[_rewardToken].accumulatedReward;
		RewardToken storage rewardToken = rewardTokensMap[_rewardToken];
		IERC20 token = IERC20(_rewardToken);
		/// @dev Transfer if enough token balance on this LM contract.
		uint256 balance = token.balanceOf(address(this));
		if (balance >= userAccumulatedReward) {
			rewardToken.totalUsersBalance = rewardToken.totalUsersBalance.sub(userAccumulatedReward);
			_user.rewards[_rewardToken].accumulatedReward = 0;

			IRewardTransferLogic transferLogic = rewardToken.rewardTransferLogic;
			require(token.approve(transferLogic.senderToAuthorize(), userAccumulatedReward), "Approve failed");
			transferLogic.transferReward(_userAddress, userAccumulatedReward, _isWithdrawal);
			/// @dev Event log.
			emit RewardClaimed(_userAddress, _rewardToken, userAccumulatedReward);
		} else {
			require(!_isCheckingBalance, "Claiming reward failed");
		}
	}

	/**
	 * @notice withdraws pool tokens without transferring reward tokens
	 * @param _poolToken the address of pool token
	 * @dev EMERGENCY ONLY
	 */
	function emergencyWithdraw(address _poolToken) external onlyAfterMigrationFinished {
		uint256 poolId = _getPoolId(_poolToken);
		PoolInfo storage pool = poolInfoList[poolId];
		UserInfo storage user = userInfoMap[poolId][msg.sender];

		uint256 rewardTokensLength = pool.rewardTokens.length;
		for (uint256 i = 0; i < rewardTokensLength; i++) {
			address rewardTokenAddress = pool.rewardTokens[i];
			_updatePoolRewardToken(pool, poolId, rewardTokenAddress);
			_updateReward(poolId, rewardTokenAddress, user);
			// substract user balance from total balance for each reward token
			UserReward storage userReward = user.rewards[pool.rewardTokens[i]];
			uint256 accumulatedReward = userReward.accumulatedReward;
			RewardToken storage rewardToken = rewardTokensMap[pool.rewardTokens[i]];
			rewardToken.totalUsersBalance = rewardToken.totalUsersBalance.sub(accumulatedReward);
			emit EmergencyWithdraw(msg.sender, _poolToken, rewardTokenAddress, user.amount, accumulatedReward);

			userReward.rewardDebt = 0;
			userReward.accumulatedReward = 0;
		}

		uint256 userAmount = user.amount;
		user.amount = 0;
		pool.poolToken.safeTransfer(address(msg.sender), userAmount);

		for (uint256 i = 0; i < rewardTokensLength; i++) {
			address rewardTokenAddress = pool.rewardTokens[i];
			_updateRewardDebt(poolId, rewardTokenAddress, user);
		}
	}

	function getRewardToken(address _rewardToken) external view returns (RewardToken memory) {
		return rewardTokensMap[_rewardToken];
	}

	/**
	 * @notice returns a list of PoolInfoRewardToken for the given pool
	 * @param _poolToken the address of pool token
	 */
	function getPoolRewards(address _poolToken) external view returns (PoolInfoRewardToken[] memory) {
		uint256 poolId = _getPoolId(_poolToken);
		PoolInfo memory poolInfo = poolInfoList[poolId];
		uint256 rewardsLength = poolInfo.rewardTokens.length;
		PoolInfoRewardToken[] memory rewards = new PoolInfoRewardToken[](rewardsLength);
		for (uint256 i = 0; i < rewardsLength; i++) {
			rewards[i] = poolInfoRewardTokensMap[poolId][poolInfo.rewardTokens[i]];
		}
		return rewards;
	}

	/**
	 * @notice returns a PoolInfoRewardToken for the given pool and reward token
	 * @param _poolToken the address of pool token
	 * @param _rewardToken the address of reward token
	 */
	function getPoolReward(address _poolToken, address _rewardToken) external view returns (PoolInfoRewardToken memory) {
		uint256 poolId = _getPoolId(_poolToken);
		return poolInfoRewardTokensMap[poolId][_rewardToken];
	}

	/**
	 * @notice returns pool id
	 * @param _poolToken the address of pool token
	 */
	function getPoolId(address _poolToken) external view returns (uint256) {
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

	struct UserBalance {
		uint256 amount;
		address rewardToken;
		uint256 accumulatedReward;
	}

	/**
	 * @notice returns list of [amount, rewardToken, accumulatedReward] for the given user for each pool token and reward token
	 * @param _user the address of the user
	 */
	function getUserBalanceList(address _user) external view returns (UserBalance[][] memory) {
		uint256 length = poolInfoList.length;
		UserBalance[][] memory userBalanceList = new UserBalance[][](length);
		for (uint256 i = 0; i < length; i++) {
			PoolInfo memory poolInfo = poolInfoList[i];
			uint256 rewardLength = poolInfo.rewardTokens.length;
			userBalanceList[i] = new UserBalance[](rewardLength);
			for (uint256 j = 0; j < rewardLength; j++) {
				address _rewardToken = poolInfo.rewardTokens[j];
				userBalanceList[i][j].amount = userInfoMap[i][_user].amount;
				userBalanceList[i][j].rewardToken = _rewardToken;
				userBalanceList[i][j].accumulatedReward = _getUserAccumulatedReward(i, _rewardToken, _user);
			}
		}
		return userBalanceList;
	}

	struct PoolUserInfo {
		uint256 amount;
		UserReward[] rewards;
	}

	/**
	 * @notice returns UserInfo for the given pool and user
	 * @param _poolToken the address of pool token
	 * @param _user the address of the user
	 */
	function getUserInfo(address _poolToken, address _user) external view returns (PoolUserInfo memory) {
		uint256 poolId = _getPoolId(_poolToken);
		return _getPoolUserInfo(poolId, _user);
	}

	/**
	 * @notice returns list of UserInfo for the given user for each pool token
	 * @param _user the address of the user
	 */
	function getUserInfoList(address _user) external view returns (PoolUserInfo[] memory) {
		uint256 length = poolInfoList.length;
		PoolUserInfo[] memory userInfoList = new PoolUserInfo[](length);
		for (uint256 i = 0; i < length; i++) {
			userInfoList[i] = _getPoolUserInfo(i, _user);
		}
		return userInfoList;
	}

	function _getPoolUserInfo(uint256 _poolId, address _user) internal view returns (PoolUserInfo memory) {
		PoolInfo memory pool = poolInfoList[_poolId];
		uint256 rewardsLength = pool.rewardTokens.length;
		UserInfo storage userInfo = userInfoMap[_poolId][_user];
		PoolUserInfo memory poolUserInfo;
		poolUserInfo.amount = userInfo.amount;
		poolUserInfo.rewards = new UserReward[](rewardsLength);
		for (uint256 i = 0; i < rewardsLength; i++) {
			poolUserInfo.rewards[i] = userInfo.rewards[pool.rewardTokens[i]];
		}
		return poolUserInfo;
	}

	struct UserAccumulatedReward {
		address rewardToken;
		uint256 accumulatedReward;
	}

	/**
	 * @notice returns accumulated reward for the given user for each pool token and reward token
	 * @param _user the address of the user
	 */
	function getUserAccumulatedRewardList(address _user) external view returns (UserAccumulatedReward[][] memory) {
		uint256 length = poolInfoList.length;
		UserAccumulatedReward[][] memory rewardList = new UserAccumulatedReward[][](length);
		for (uint256 i = 0; i < length; i++) {
			PoolInfo memory poolInfo = poolInfoList[i];
			uint256 rewardsLength = poolInfo.rewardTokens.length;
			rewardList[i] = new UserAccumulatedReward[](rewardsLength);
			for (uint256 j = 0; j < rewardsLength; j++) {
				rewardList[i][j].rewardToken = poolInfo.rewardTokens[j];
				rewardList[i][j].accumulatedReward = _getUserAccumulatedReward(i, poolInfo.rewardTokens[j], _user);
			}
		}
		return rewardList;
	}

	/**
	 * @notice returns the pool token balance a user has on the contract
	 * @param _poolToken the address of pool token
	 * @param _user the address of the user
	 */
	function getUserPoolTokenBalance(address _poolToken, address _user) external view returns (uint256) {
		uint256 poolId = _getPoolId(_poolToken);
		return userInfoMap[poolId][_user].amount;
	}

	function setPoolInfoRewardToken(
		address _poolToken,
		address _rewardToken,
		uint256 _lastRewardBlock,
		uint256 _accumulatedRewardPerShare
	) external onlyAuthorized onlyMigrator {
		uint256 poolId = _getPoolId(_poolToken);
		PoolInfoRewardToken storage poolInfoRewardToken = poolInfoRewardTokensMap[poolId][_rewardToken];
		poolInfoRewardToken.lastRewardBlock = _lastRewardBlock;
		poolInfoRewardToken.accumulatedRewardPerShare = _accumulatedRewardPerShare;
	}

	function setRewardToken(
		address _rewardToken,
		uint256 _startBlock,
		uint256 _totalUsersBalance
	) external onlyAuthorized onlyMigrator {
		RewardToken storage rewardToken = rewardTokensMap[_rewardToken];
		rewardToken.startBlock = _startBlock;
		rewardToken.totalUsersBalance = _totalUsersBalance;
	}

	function setUserInfo(
		uint256 _poolId,
		address _user,
		address _rewardToken,
		uint256 _amount,
		uint256 _rewardDebt,
		uint256 _accumulatedReward
	) external onlyAuthorized onlyMigrator {
		UserInfo storage userInfo = userInfoMap[_poolId][_user];
		UserReward storage userReward = userInfo.rewards[_rewardToken];
		userInfo.amount += _amount;
		userReward.rewardDebt += _rewardDebt;
		userReward.accumulatedReward += _accumulatedReward;
	}

	/**
	 * @notice finish migration
	 */
	function finishMigration() external onlyAuthorized onlyMigrator {
		migrationFinished = true;
	}
}
