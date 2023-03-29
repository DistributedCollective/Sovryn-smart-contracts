pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../openzeppelin/ERC20.sol";
import "../openzeppelin/SafeERC20.sol";
import "../openzeppelin/SafeMath.sol";
import "./LiquidityMiningStorage.sol";
import "./ILiquidityMining.sol";

contract LiquidityMining is ILiquidityMining, LiquidityMiningStorage {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* Constants */

    uint256 public constant PRECISION = 1e12;
    // Bonus multiplier for early liquidity providers.
    // During bonus period each passed block will be calculated like N passed blocks, where N = BONUS_MULTIPLIER
    uint256 public constant BONUS_BLOCK_MULTIPLIER = 10;

    uint256 public constant SECONDS_PER_BLOCK = 30;

    /* Events */

    event SOVTransferred(address indexed receiver, uint256 amount);
    event PoolTokenAdded(address indexed user, address indexed poolToken, uint256 allocationPoint);
    event PoolTokenUpdated(
        address indexed user,
        address indexed poolToken,
        uint256 newAllocationPoint,
        uint256 oldAllocationPoint
    );
    event Deposit(address indexed user, address indexed poolToken, uint256 amount);
    event RewardClaimed(address indexed user, address indexed poolToken, uint256 amount);
    event Withdraw(address indexed user, address indexed poolToken, uint256 amount);
    event EmergencyWithdraw(
        address indexed user,
        address indexed poolToken,
        uint256 amount,
        uint256 accumulatedReward
    );

    /* Functions */

    /**
     * @notice Initialize mining.
     *
     * @param _SOV The SOV token.
     * @param _rewardTokensPerBlock The number of reward tokens per block.
     * @param _startDelayBlocks The number of blocks should be passed to start
     *   mining.
     * @param _numberOfBonusBlocks The number of blocks when each block will
     *   be calculated as N blocks (BONUS_BLOCK_MULTIPLIER).
     * @param _lockedSOV The contract instance address of the lockedSOV vault.
     *   SOV rewards are not paid directly to liquidity providers. Instead they
     *   are deposited into a lockedSOV vault contract.
     * @param _unlockedImmediatelyPercent The % which determines how much will be unlocked immediately.
     */
    function initialize(
        IERC20 _SOV,
        uint256 _rewardTokensPerBlock,
        uint256 _startDelayBlocks,
        uint256 _numberOfBonusBlocks,
        address _wrapper,
        ILockedSOV _lockedSOV,
        uint256 _unlockedImmediatelyPercent
    ) external onlyAuthorized {
        /// @dev Non-idempotent function. Must be called just once.
        require(address(SOV) == address(0), "Already initialized");
        require(address(_SOV) != address(0), "Invalid token address");
        require(_startDelayBlocks > 0, "Invalid start block");
        require(
            _unlockedImmediatelyPercent < 10000,
            "Unlocked immediately percent has to be less than 10000."
        );

        SOV = _SOV;
        rewardTokensPerBlock = _rewardTokensPerBlock;
        startBlock = block.number + _startDelayBlocks;
        bonusEndBlock = startBlock + _numberOfBonusBlocks;
        wrapper = _wrapper;
        lockedSOV = _lockedSOV;
        unlockedImmediatelyPercent = _unlockedImmediatelyPercent;
    }

    /**
     * @notice Sets lockedSOV contract.
     * @param _lockedSOV The contract instance address of the lockedSOV vault.
     */
    function setLockedSOV(ILockedSOV _lockedSOV) external onlyAuthorized {
        require(address(_lockedSOV) != address(0), "Invalid lockedSOV Address.");
        lockedSOV = _lockedSOV;
    }

    /**
     * @notice Sets unlocked immediately percent.
     * @param _unlockedImmediatelyPercent The % which determines how much will be unlocked immediately.
     * @dev 10000 is 100%
     */
    function setUnlockedImmediatelyPercent(uint256 _unlockedImmediatelyPercent)
        external
        onlyAuthorized
    {
        require(
            _unlockedImmediatelyPercent <= 10000,
            "Unlocked immediately percent has to be less than equal to 10000."
        );
        unlockedImmediatelyPercent = _unlockedImmediatelyPercent;
    }

    /**
     * @notice Sets unlocked immediately percent overwrite for specific pool token.
     * @param _poolToken the address of pool token
     * @param _poolTokenUnlockedImmediatelyPercent The % which determines how much will be unlocked immediately.
     * @dev 10000 is 100%
     */
    function setPoolTokenUnlockedImmediatelyPercent(
        address _poolToken,
        uint256 _poolTokenUnlockedImmediatelyPercent
    ) external onlyAuthorized {
        require(
            _poolTokenUnlockedImmediatelyPercent <= 10000,
            "Unlocked immediately percent has to be less than equal to 10000."
        );
        poolTokensUnlockedImmediatelyPercent[_poolToken] = _poolTokenUnlockedImmediatelyPercent;
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
    function stopMining() external onlyAuthorized {
        require(endBlock == 0, "Already stopped");

        endBlock = block.number;
    }

    /**
     * @notice Transfers SOV tokens to given address.
     *   Owner use this function to withdraw SOV from LM contract
     *   into another account.
     * @param _receiver The address of the SOV receiver.
     * @param _amount The amount to be transferred.
     * */
    function transferSOV(address _receiver, uint256 _amount) external onlyAuthorized {
        require(_receiver != address(0), "Receiver address invalid");
        require(_amount != 0, "Amount invalid");

        /// @dev Do not transfer more SOV than available.
        uint256 SOVBal = SOV.balanceOf(address(this));
        if (_amount > SOVBal) {
            _amount = SOVBal;
        }

        /// @dev The actual transfer.
        require(SOV.transfer(_receiver, _amount), "Transfer failed");

        /// @dev Event log.
        emit SOVTransferred(_receiver, _amount);
    }

    /**
     * @notice Get the missed SOV balance of LM contract.
     *
     * @return The amount of SOV tokens according to totalUsersBalance
     *   in excess of actual SOV balance of the LM contract.
     * */
    function getMissedBalance() external view returns (uint256) {
        uint256 balance = SOV.balanceOf(address(this));
        return balance >= totalUsersBalance ? 0 : totalUsersBalance.sub(balance);
    }

    /**
     * @notice adds a new lp to the pool. Can only be called by the owner or an admin
     * @param _poolToken the address of pool token
     * @param _allocationPoint the allocation point (weight) for the given pool
     * @param _withUpdate the flag whether we need to update all pools
     */
    function add(
        address _poolToken,
        uint96 _allocationPoint,
        bool _withUpdate
    ) external onlyAuthorized {
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
     * @param _updateAllFlag the flag whether we need to update all pools
     */
    function update(
        address _poolToken,
        uint96 _allocationPoint,
        bool _updateAllFlag
    ) external onlyAuthorized {
        if (_updateAllFlag) {
            updateAllPools();
        } else {
            updatePool(_poolToken);
        }
        _updateToken(_poolToken, _allocationPoint);
    }

    function _updateToken(address _poolToken, uint96 _allocationPoint) internal {
        uint256 poolId = _getPoolId(_poolToken);

        uint256 previousAllocationPoint = poolInfoList[poolId].allocationPoint;
        totalAllocationPoint = totalAllocationPoint.sub(previousAllocationPoint).add(
            _allocationPoint
        );
        poolInfoList[poolId].allocationPoint = _allocationPoint;

        emit PoolTokenUpdated(msg.sender, _poolToken, _allocationPoint, previousAllocationPoint);
    }

    /**
     * @notice updates the given pools' reward tokens allocation points
     * @param _poolTokens array of addresses of pool tokens
     * @param _allocationPoints array of allocation points (weight) for the given pools
     * @param _updateAllFlag the flag whether we need to update all pools
     */
    function updateTokens(
        address[] calldata _poolTokens,
        uint96[] calldata _allocationPoints,
        bool _updateAllFlag
    ) external onlyAuthorized {
        require(_poolTokens.length == _allocationPoints.length, "Arrays mismatch");

        if (_updateAllFlag) {
            updateAllPools();
        }
        uint256 length = _poolTokens.length;
        for (uint256 i = 0; i < length; i++) {
            if (!_updateAllFlag) {
                updatePool(_poolTokens[i]);
            }
            _updateToken(_poolTokens[i], _allocationPoints[i]);
        }
    }

    /**
     * @notice returns reward multiplier over the given _from to _to block
     * @param _from the first block for a calculation
     * @param _to the last block for a calculation
     */
    function _getPassedBlocksWithBonusMultiplier(uint256 _from, uint256 _to)
        internal
        view
        returns (uint256)
    {
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
            return
                bonusEndBlock.sub(_from).mul(BONUS_BLOCK_MULTIPLIER).add(_to.sub(bonusEndBlock));
        }
    }

    function _getUserAccumulatedReward(uint256 _poolId, address _user)
        internal
        view
        returns (uint256)
    {
        PoolInfo storage pool = poolInfoList[_poolId];
        UserInfo storage user = userInfoMap[_poolId][_user];

        // SKIPPED THIS ONLY FOR TESTNET
        // Since this causing the error when calling the balanceOf function
        if(address(pool.poolToken) == 0xD449c0c468Cae235d3E320Ff48d05EbDdcde64c3) return 0;

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
    function getUserAccumulatedReward(address _poolToken, address _user)
        external
        view
        returns (uint256)
    {
        uint256 poolId = _getPoolId(_poolToken);
        return _getUserAccumulatedReward(poolId, _user);
    }

    /**
     * @notice returns estimated reward
     * @param _poolToken the address of pool token
     * @param _amount the amount of tokens to be deposited
     * @param _duration the duration of liquidity providing in seconds
     */
    function getEstimatedReward(
        address _poolToken,
        uint256 _amount,
        uint256 _duration
    ) external view returns (uint256) {
        uint256 poolId = _getPoolId(_poolToken);
        PoolInfo storage pool = poolInfoList[poolId];
        uint256 start = block.number;
        uint256 end = start.add(_duration.div(SECONDS_PER_BLOCK));
        (, uint256 accumulatedRewardPerShare) =
            _getPoolAccumulatedReward(pool, _amount, start, end);
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

        //this pool has been updated recently
        if (block.number <= pool.lastRewardBlock) {
            return;
        }

        uint256 poolTokenBalance = pool.poolToken.balanceOf(address(this));
        if (poolTokenBalance == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        (uint256 accumulatedReward_, uint256 accumulatedRewardPerShare_) =
            _getPoolAccumulatedReward(pool);
        pool.accumulatedRewardPerShare = pool.accumulatedRewardPerShare.add(
            accumulatedRewardPerShare_
        );
        pool.lastRewardBlock = block.number;

        totalUsersBalance = totalUsersBalance.add(accumulatedReward_);
    }

    function _getPoolAccumulatedReward(PoolInfo storage _pool)
        internal
        view
        returns (uint256, uint256)
    {
        return _getPoolAccumulatedReward(_pool, 0, _pool.lastRewardBlock, block.number);
    }

    function _getPoolAccumulatedReward(
        PoolInfo storage _pool,
        uint256 _additionalAmount,
        uint256 _startBlock,
        uint256 _endBlock
    ) internal view returns (uint256, uint256) {
        uint256 passedBlocks = _getPassedBlocksWithBonusMultiplier(_startBlock, _endBlock);
        uint256 accumulatedReward =
            passedBlocks.mul(rewardTokensPerBlock).mul(_pool.allocationPoint).div(
                totalAllocationPoint
            );

        uint256 poolTokenBalance = _pool.poolToken.balanceOf(address(this));
        poolTokenBalance = poolTokenBalance.add(_additionalAmount);
        uint256 accumulatedRewardPerShare = accumulatedReward.mul(PRECISION).div(poolTokenBalance);
        return (accumulatedReward, accumulatedRewardPerShare);
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
    ) external {
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

        _updatePool(poolId);
        //sends reward directly to the user
        _updateReward(pool, user);

        if (_amount > 0) {
            //receives pool tokens from msg.sender, it can be user or WrapperProxy contract
            if (!alreadyTransferred)
                pool.poolToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }
        _updateRewardDebt(pool, user);
        emit Deposit(userAddress, _poolToken, _amount);
    }

    /**
     * @notice transfers reward tokens
     * @param _poolToken the address of pool token
     * @param _user the address of user to claim reward from (can be passed only by wrapper contract)
     */
    function claimReward(address _poolToken, address _user) external {
        address userAddress = _getUserAddress(_user);

        uint256 poolId = _getPoolId(_poolToken);
        _claimReward(poolId, userAddress, true);
    }

    function _claimReward(
        uint256 _poolId,
        address _userAddress,
        bool _isStakingTokens
    ) internal {
        PoolInfo storage pool = poolInfoList[_poolId];
        UserInfo storage user = userInfoMap[_poolId][_userAddress];

        _updatePool(_poolId);
        _updateReward(pool, user);
        _transferReward(address(pool.poolToken), user, _userAddress, _isStakingTokens, true);
        _updateRewardDebt(pool, user);
    }

    /**
     * @notice transfers reward tokens from all pools
     * @param _user the address of user to claim reward from (can be passed only by wrapper contract)
     */
    function claimRewardFromAllPools(address _user) external {
        address userAddress = _getUserAddress(_user);

        uint256 length = poolInfoList.length;
        for (uint256 i = 0; i < length; i++) {
            uint256 poolId = i;
            _claimReward(poolId, userAddress, false);
        }

        if (
            lockedSOV.getLockedBalance(userAddress) > 0 ||
            lockedSOV.getUnlockedBalance(userAddress) > 0
        ) {
            lockedSOV.withdrawAndStakeTokensFrom(userAddress);
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
    ) external {
        require(poolIdList[_poolToken] != 0, "Pool token not found");
        address userAddress = _getUserAddress(_user);

        uint256 poolId = _getPoolId(_poolToken);
        PoolInfo storage pool = poolInfoList[poolId];
        UserInfo storage user = userInfoMap[poolId][userAddress];
        require(user.amount >= _amount, "Not enough balance");

        _updatePool(poolId);
        _updateReward(pool, user);
        _transferReward(_poolToken, user, userAddress, false, false);

        user.amount = user.amount.sub(_amount);

        //msg.sender is wrapper -> send to wrapper
        if (msg.sender == wrapper) {
            pool.poolToken.safeTransfer(address(msg.sender), _amount);
        }
        //msg.sender is user or pool token (lending pool) -> send to user
        else {
            pool.poolToken.safeTransfer(userAddress, _amount);
        }

        _updateRewardDebt(pool, user);
        emit Withdraw(userAddress, _poolToken, _amount);
    }

    function _getUserAddress(address _user) internal view returns (address) {
        address userAddress = msg.sender;
        if (_user != address(0)) {
            //only wrapper can pass _user parameter
            require(
                msg.sender == wrapper || poolIdList[msg.sender] != 0,
                "only wrapper or pools may withdraw for a user"
            );
            userAddress = _user;
        }
        return userAddress;
    }

    function _updateReward(PoolInfo storage pool, UserInfo storage user) internal {
        //update user accumulated reward
        if (user.amount > 0) {
            //add reward for the previous amount of deposited tokens
            uint256 accumulatedReward =
                user.amount.mul(pool.accumulatedRewardPerShare).div(PRECISION).sub(
                    user.rewardDebt
                );
            user.accumulatedReward = user.accumulatedReward.add(accumulatedReward);
        }
    }

    function _updateRewardDebt(PoolInfo storage pool, UserInfo storage user) internal {
        //reward accumulated before amount update (should be subtracted during next reward calculation)
        user.rewardDebt = user.amount.mul(pool.accumulatedRewardPerShare).div(PRECISION);
    }

    /**
     * @notice Send reward in SOV to the lockedSOV vault.
     * @param _user The user info, to get its reward share.
     * @param _userAddress The address of the user, to send SOV in its behalf.
     * @param _isStakingTokens The flag whether we need to stake tokens
     * @param _isCheckingBalance The flag whether we need to throw error or don't process reward if SOV balance isn't enough
     */
    function _transferReward(
        address _poolToken,
        UserInfo storage _user,
        address _userAddress,
        bool _isStakingTokens,
        bool _isCheckingBalance
    ) internal {
        uint256 userAccumulatedReward = _user.accumulatedReward;
        /// @dev get unlock immediate percent of the pool token.
        uint256 calculatedUnlockedImmediatelyPercent = calcUnlockedImmediatelyPercent(_poolToken);

        /// @dev Transfer if enough SOV balance on this LM contract.
        uint256 balance = SOV.balanceOf(address(this));
        if (balance >= userAccumulatedReward) {
            totalUsersBalance = totalUsersBalance.sub(userAccumulatedReward);
            _user.accumulatedReward = 0;

            /// @dev If calculatedUnlockedImmediatelyPercent is 100%, transfer the reward to the LP (user).
            ///   else, deposit it into lockedSOV vault contract, but first
            ///   SOV deposit must be approved to move the SOV tokens
            ///   from this LM contract into the lockedSOV vault.
            if (calculatedUnlockedImmediatelyPercent == 10000) {
                SOV.transfer(_userAddress, userAccumulatedReward);
            } else {
                require(SOV.approve(address(lockedSOV), userAccumulatedReward), "Approve failed");
                lockedSOV.deposit(
                    _userAddress,
                    userAccumulatedReward,
                    calculatedUnlockedImmediatelyPercent
                );

                if (_isStakingTokens) {
                    lockedSOV.withdrawAndStakeTokensFrom(_userAddress);
                }
            }

            /// @dev Event log.
            emit RewardClaimed(_userAddress, _poolToken, userAccumulatedReward);
        } else {
            require(!_isCheckingBalance, "Claiming reward failed");
        }
    }

    /**
     * @notice withdraws pool tokens without transferring reward tokens
     * @param _poolToken the address of pool token
     * @dev EMERGENCY ONLY
     */
    function emergencyWithdraw(address _poolToken) external {
        uint256 poolId = _getPoolId(_poolToken);
        PoolInfo storage pool = poolInfoList[poolId];
        UserInfo storage user = userInfoMap[poolId][msg.sender];

        _updatePool(poolId);
        _updateReward(pool, user);

        totalUsersBalance = totalUsersBalance.sub(user.accumulatedReward);
        uint256 userAmount = user.amount;
        uint256 userAccumulatedReward = user.accumulatedReward;
        user.amount = 0;
        user.rewardDebt = 0;
        user.accumulatedReward = 0;
        pool.poolToken.safeTransfer(address(msg.sender), userAmount);

        emit EmergencyWithdraw(msg.sender, _poolToken, userAmount, userAccumulatedReward);
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
    function getUserInfo(address _poolToken, address _user) public view returns (UserInfo memory) {
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

    /**
     * @notice returns the pool token balance a user has on the contract
     * @param _poolToken the address of pool token
     * @param _user the address of the user
     */
    function getUserPoolTokenBalance(address _poolToken, address _user)
        external
        view
        returns (uint256)
    {
        UserInfo memory ui = getUserInfo(_poolToken, _user);
        return ui.amount;
    }

    /**
     * @notice returns the accumulated liquid reward for the given user for each pool token
     * @param _user the address of the user
     */
    function getUserAccumulatedRewardToBePaidLiquid(address _user)
        external
        view
        returns (uint256)
    {
        uint256 length = poolInfoList.length;
        uint256 result;
        for (uint256 i = 0; i < length; i++) {
            address _poolToken = address(poolInfoList[i].poolToken);
            uint256 calculatedUnlockedImmediatelyPercent =
                calcUnlockedImmediatelyPercent(_poolToken);
            result = result.add(
                calculatedUnlockedImmediatelyPercent.mul(_getUserAccumulatedReward(i, _user)).div(
                    10000
                )
            );
        }

        return result;
    }

    /**
     * @notice returns the accumulated vested reward for the given user for each pool token
     * @param _user the address of the user
     */
    function getUserAccumulatedRewardToBeVested(address _user) external view returns (uint256) {
        uint256 length = poolInfoList.length;
        uint256 result;
        for (uint256 i = 0; i < length; i++) {
            address _poolToken = address(poolInfoList[i].poolToken);
            uint256 calculatedUnlockedImmediatelyPercent =
                calcUnlockedImmediatelyPercent(_poolToken);
            result = result.add(
                (10000 - calculatedUnlockedImmediatelyPercent)
                    .mul(_getUserAccumulatedReward(i, _user))
                    .div(10000)
            );
        }

        return result;
    }

    /**
     * @dev calculate the unlocked immediate percentage of specific pool token
     * use the poolTokensUnlockedImmediatelyPercent by default, if it is not set, then use the unlockedImmediatelyPercent
     */
    function calcUnlockedImmediatelyPercent(address _poolToken) public view returns (uint256) {
        uint256 poolTokenUnlockedImmediatelyPercent =
            poolTokensUnlockedImmediatelyPercent[_poolToken];
        return
            poolTokenUnlockedImmediatelyPercent > 0
                ? poolTokenUnlockedImmediatelyPercent
                : unlockedImmediatelyPercent;
    }
}
