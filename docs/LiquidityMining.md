# LiquidityMining.sol

View Source: [contracts/farm/LiquidityMining.sol](../contracts/farm/LiquidityMining.sol)

**↗ Extends: [ILiquidityMining](ILiquidityMining.md), [LiquidityMiningStorage](LiquidityMiningStorage.md)**

**LiquidityMining**

## Contract Members
**Constants & Variables**

```js
uint256 public constant PRECISION;
uint256 public constant BONUS_BLOCK_MULTIPLIER;
uint256 public constant SECONDS_PER_BLOCK;

```

**Events**

```js
event SOVTransferred(address indexed receiver, uint256  amount);
event PoolTokenAdded(address indexed user, address indexed poolToken, uint256  allocationPoint);
event PoolTokenUpdated(address indexed user, address indexed poolToken, uint256  newAllocationPoint, uint256  oldAllocationPoint);
event Deposit(address indexed user, address indexed poolToken, uint256  amount);
event RewardClaimed(address indexed user, address indexed poolToken, uint256  amount);
event Withdraw(address indexed user, address indexed poolToken, uint256  amount);
event EmergencyWithdraw(address indexed user, address indexed poolToken, uint256  amount, uint256  accumulatedReward);
```

## Functions

- [initialize(IERC20 _SOV, uint256 _rewardTokensPerBlock, uint256 _startDelayBlocks, uint256 _numberOfBonusBlocks, address _wrapper, ILockedSOV _lockedSOV, uint256 _unlockedImmediatelyPercent)](#initialize)
- [setLockedSOV(ILockedSOV _lockedSOV)](#setlockedsov)
- [setUnlockedImmediatelyPercent(uint256 _unlockedImmediatelyPercent)](#setunlockedimmediatelypercent)
- [setWrapper(address _wrapper)](#setwrapper)
- [stopMining()](#stopmining)
- [transferSOV(address _receiver, uint256 _amount)](#transfersov)
- [getMissedBalance()](#getmissedbalance)
- [add(address _poolToken, uint96 _allocationPoint, bool _withUpdate)](#add)
- [update(address _poolToken, uint96 _allocationPoint, bool _updateAllFlag)](#update)
- [_updateToken(address _poolToken, uint96 _allocationPoint)](#_updatetoken)
- [updateTokens(address[] _poolTokens, uint96[] _allocationPoints, bool _updateAllFlag)](#updatetokens)
- [_getPassedBlocksWithBonusMultiplier(uint256 _from, uint256 _to)](#_getpassedblockswithbonusmultiplier)
- [_getUserAccumulatedReward(uint256 _poolId, address _user)](#_getuseraccumulatedreward)
- [getUserAccumulatedReward(address _poolToken, address _user)](#getuseraccumulatedreward)
- [getEstimatedReward(address _poolToken, uint256 _amount, uint256 _duration)](#getestimatedreward)
- [updateAllPools()](#updateallpools)
- [updatePool(address _poolToken)](#updatepool)
- [_updatePool(uint256 _poolId)](#_updatepool)
- [_getPoolAccumulatedReward(struct LiquidityMiningStorage.PoolInfo _pool)](#_getpoolaccumulatedreward)
- [_getPoolAccumulatedReward(struct LiquidityMiningStorage.PoolInfo _pool, uint256 _additionalAmount, uint256 _startBlock, uint256 _endBlock)](#_getpoolaccumulatedreward)
- [deposit(address _poolToken, uint256 _amount, address _user)](#deposit)
- [onTokensDeposited(address _user, uint256 _amount)](#ontokensdeposited)
- [_deposit(address _poolToken, uint256 _amount, address _user, bool alreadyTransferred)](#_deposit)
- [claimReward(address _poolToken, address _user)](#claimreward)
- [_claimReward(uint256 _poolId, address _userAddress, bool _isStakingTokens)](#_claimreward)
- [claimRewardFromAllPools(address _user)](#claimrewardfromallpools)
- [withdraw(address _poolToken, uint256 _amount, address _user)](#withdraw)
- [_getUserAddress(address _user)](#_getuseraddress)
- [_updateReward(struct LiquidityMiningStorage.PoolInfo pool, struct LiquidityMiningStorage.UserInfo user)](#_updatereward)
- [_updateRewardDebt(struct LiquidityMiningStorage.PoolInfo pool, struct LiquidityMiningStorage.UserInfo user)](#_updaterewarddebt)
- [_transferReward(address _poolToken, struct LiquidityMiningStorage.UserInfo _user, address _userAddress, bool _isStakingTokens, bool _isCheckingBalance)](#_transferreward)
- [emergencyWithdraw(address _poolToken)](#emergencywithdraw)
- [getPoolId(address _poolToken)](#getpoolid)
- [_getPoolId(address _poolToken)](#_getpoolid)
- [getPoolLength()](#getpoollength)
- [getPoolInfoList()](#getpoolinfolist)
- [getPoolInfo(address _poolToken)](#getpoolinfo)
- [getUserBalanceList(address _user)](#getuserbalancelist)
- [getUserInfo(address _poolToken, address _user)](#getuserinfo)
- [getUserInfoList(address _user)](#getuserinfolist)
- [getUserAccumulatedRewardList(address _user)](#getuseraccumulatedrewardlist)
- [getUserPoolTokenBalance(address _poolToken, address _user)](#getuserpooltokenbalance)

---    

> ### initialize

Initialize mining.
     *

```solidity
function initialize(IERC20 _SOV, uint256 _rewardTokensPerBlock, uint256 _startDelayBlocks, uint256 _numberOfBonusBlocks, address _wrapper, ILockedSOV _lockedSOV, uint256 _unlockedImmediatelyPercent) external nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _SOV | IERC20 | The SOV token. | 
| _rewardTokensPerBlock | uint256 | The number of reward tokens per block. | 
| _startDelayBlocks | uint256 | The number of blocks should be passed to start   mining. | 
| _numberOfBonusBlocks | uint256 | The number of blocks when each block will   be calculated as N blocks (BONUS_BLOCK_MULTIPLIER). | 
| _wrapper | address |  | 
| _lockedSOV | ILockedSOV | The contract instance address of the lockedSOV vault.   SOV rewards are not paid directly to liquidity providers. Instead they   are deposited into a lockedSOV vault contract. | 
| _unlockedImmediatelyPercent | uint256 | The % which determines how much will be unlocked immediately. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### setLockedSOV

Sets lockedSOV contract.

```solidity
function setLockedSOV(ILockedSOV _lockedSOV) external nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _lockedSOV | ILockedSOV | The contract instance address of the lockedSOV vault. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setLockedSOV(ILockedSOV _lockedSOV) external onlyAuthorized {
        require(address(_lockedSOV) != address(0), "Invalid lockedSOV Address.");
        lockedSOV = _lockedSOV;
    }
```
</details>

---    

> ### setUnlockedImmediatelyPercent

Sets unlocked immediately percent.

```solidity
function setUnlockedImmediatelyPercent(uint256 _unlockedImmediatelyPercent) external nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _unlockedImmediatelyPercent | uint256 | The % which determines how much will be unlocked immediately. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setUnlockedImmediatelyPercent(uint256 _unlockedImmediatelyPercent)
        external
        onlyAuthorized
    {
        require(
            _unlockedImmediatelyPercent < 10000,
            "Unlocked immediately percent has to be less than 10000."
        );
        unlockedImmediatelyPercent = _unlockedImmediatelyPercent;
    }
```
</details>

---    

> ### setWrapper

sets wrapper proxy contract

```solidity
function setWrapper(address _wrapper) external nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _wrapper | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setWrapper(address _wrapper) external onlyAuthorized {
        wrapper = _wrapper;
    }
```
</details>

---    

> ### stopMining

stops mining by setting end block

```solidity
function stopMining() external nonpayable onlyAuthorized 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function stopMining() external onlyAuthorized {
        require(endBlock == 0, "Already stopped");

        endBlock = block.number;
    }
```
</details>

---    

> ### transferSOV

Transfers SOV tokens to given address.
  Owner use this function to withdraw SOV from LM contract
  into another account.

```solidity
function transferSOV(address _receiver, uint256 _amount) external nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiver | address | The address of the SOV receiver. | 
| _amount | uint256 | The amount to be transferred. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### getMissedBalance

Get the missed SOV balance of LM contract.
     *

```solidity
function getMissedBalance() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getMissedBalance() external view returns (uint256) {
        uint256 balance = SOV.balanceOf(address(this));
        return balance >= totalUsersBalance ? 0 : totalUsersBalance.sub(balance);
    }
```
</details>

---    

> ### add

adds a new lp to the pool. Can only be called by the owner or an admin

```solidity
function add(address _poolToken, uint96 _allocationPoint, bool _withUpdate) external nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address | the address of pool token | 
| _allocationPoint | uint96 | the allocation point (weight) for the given pool | 
| _withUpdate | bool | the flag whether we need to update all pools | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### update

updates the given pool's reward tokens allocation point

```solidity
function update(address _poolToken, uint96 _allocationPoint, bool _updateAllFlag) external nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address | the address of pool token | 
| _allocationPoint | uint96 | the allocation point (weight) for the given pool | 
| _updateAllFlag | bool | the flag whether we need to update all pools | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### _updateToken

```solidity
function _updateToken(address _poolToken, uint96 _allocationPoint) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address |  | 
| _allocationPoint | uint96 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _updateToken(address _poolToken, uint96 _allocationPoint) internal {
        uint256 poolId = _getPoolId(_poolToken);

        uint256 previousAllocationPoint = poolInfoList[poolId].allocationPoint;
        totalAllocationPoint = totalAllocationPoint.sub(previousAllocationPoint).add(
            _allocationPoint
        );
        poolInfoList[poolId].allocationPoint = _allocationPoint;

        emit PoolTokenUpdated(msg.sender, _poolToken, _allocationPoint, previousAllocationPoint);
    }
```
</details>

---    

> ### updateTokens

updates the given pools' reward tokens allocation points

```solidity
function updateTokens(address[] _poolTokens, uint96[] _allocationPoints, bool _updateAllFlag) external nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolTokens | address[] | array of addresses of pool tokens | 
| _allocationPoints | uint96[] | array of allocation points (weight) for the given pools | 
| _updateAllFlag | bool | the flag whether we need to update all pools | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### _getPassedBlocksWithBonusMultiplier

returns reward multiplier over the given _from to _to block

```solidity
function _getPassedBlocksWithBonusMultiplier(uint256 _from, uint256 _to) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _from | uint256 | the first block for a calculation | 
| _to | uint256 | the last block for a calculation | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### _getUserAccumulatedReward

```solidity
function _getUserAccumulatedReward(uint256 _poolId, address _user) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolId | uint256 |  | 
| _user | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getUserAccumulatedReward(uint256 _poolId, address _user)
        internal
        view
        returns (uint256)
    {
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
```
</details>

---    

> ### getUserAccumulatedReward

returns accumulated reward

```solidity
function getUserAccumulatedReward(address _poolToken, address _user) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address | the address of pool token | 
| _user | address | the user address | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUserAccumulatedReward(address _poolToken, address _user)
        external
        view
        returns (uint256)
    {
        uint256 poolId = _getPoolId(_poolToken);
        return _getUserAccumulatedReward(poolId, _user);
    }
```
</details>

---    

> ### getEstimatedReward

returns estimated reward

```solidity
function getEstimatedReward(address _poolToken, uint256 _amount, uint256 _duration) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address | the address of pool token | 
| _amount | uint256 | the amount of tokens to be deposited | 
| _duration | uint256 | the duration of liquidity providing in seconds | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### updateAllPools

Updates reward variables for all pools.

```solidity
function updateAllPools() public nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function updateAllPools() public {
        uint256 length = poolInfoList.length;
        for (uint256 i = 0; i < length; i++) {
            _updatePool(i);
        }
    }
```
</details>

---    

> ### updatePool

Updates reward variables of the given pool to be up-to-date

```solidity
function updatePool(address _poolToken) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address | the address of pool token | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function updatePool(address _poolToken) public {
        uint256 poolId = _getPoolId(_poolToken);
        _updatePool(poolId);
    }
```
</details>

---    

> ### _updatePool

```solidity
function _updatePool(uint256 _poolId) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolId | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### _getPoolAccumulatedReward

```solidity
function _getPoolAccumulatedReward(struct LiquidityMiningStorage.PoolInfo _pool) internal view
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _pool | struct LiquidityMiningStorage.PoolInfo |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getPoolAccumulatedReward(PoolInfo storage _pool)
        internal
        view
        returns (uint256, uint256)
    {
        return _getPoolAccumulatedReward(_pool, 0, _pool.lastRewardBlock, block.number);
    }
```
</details>

---    

> ### _getPoolAccumulatedReward

```solidity
function _getPoolAccumulatedReward(struct LiquidityMiningStorage.PoolInfo _pool, uint256 _additionalAmount, uint256 _startBlock, uint256 _endBlock) internal view
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _pool | struct LiquidityMiningStorage.PoolInfo |  | 
| _additionalAmount | uint256 |  | 
| _startBlock | uint256 |  | 
| _endBlock | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### deposit

deposits pool tokens

```solidity
function deposit(address _poolToken, uint256 _amount, address _user) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address | the address of pool token | 
| _amount | uint256 | the amount of pool tokens | 
| _user | address | the address of user, tokens will be deposited to it or to msg.sender | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function deposit(
        address _poolToken,
        uint256 _amount,
        address _user
    ) external {
        _deposit(_poolToken, _amount, _user, false);
    }
```
</details>

---    

> ### onTokensDeposited

⤾ overrides [ILiquidityMining.onTokensDeposited](ILiquidityMining.md#ontokensdeposited)

if the lending pools directly mint/transfer tokens to this address, process it like a user deposit

```solidity
function onTokensDeposited(address _user, uint256 _amount) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | the user address | 
| _amount | uint256 | the minted amount | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function onTokensDeposited(address _user, uint256 _amount) external {
        //the msg.sender is the pool token. if the msg.sender is not a valid pool token, _deposit will revert
        _deposit(msg.sender, _amount, _user, true);
    }
```
</details>

---    

> ### _deposit

internal function for depositing pool tokens

```solidity
function _deposit(address _poolToken, uint256 _amount, address _user, bool alreadyTransferred) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address | the address of pool token | 
| _amount | uint256 | the amount of pool tokens | 
| _user | address | the address of user, tokens will be deposited to it | 
| alreadyTransferred | bool | true if the pool tokens have already been transferred | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### claimReward

transfers reward tokens

```solidity
function claimReward(address _poolToken, address _user) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address | the address of pool token | 
| _user | address | the address of user to claim reward from (can be passed only by wrapper contract) | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function claimReward(address _poolToken, address _user) external {
        address userAddress = _getUserAddress(_user);

        uint256 poolId = _getPoolId(_poolToken);
        _claimReward(poolId, userAddress, true);
    }
```
</details>

---    

> ### _claimReward

```solidity
function _claimReward(uint256 _poolId, address _userAddress, bool _isStakingTokens) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolId | uint256 |  | 
| _userAddress | address |  | 
| _isStakingTokens | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### claimRewardFromAllPools

transfers reward tokens from all pools

```solidity
function claimRewardFromAllPools(address _user) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | the address of user to claim reward from (can be passed only by wrapper contract) | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function claimRewardFromAllPools(address _user) external {
        address userAddress = _getUserAddress(_user);

        uint256 length = poolInfoList.length;
        for (uint256 i = 0; i < length; i++) {
            uint256 poolId = i;
            _claimReward(poolId, userAddress, false);
        }
        lockedSOV.withdrawAndStakeTokensFrom(userAddress);
    }
```
</details>

---    

> ### withdraw

⤾ overrides [ILiquidityMining.withdraw](ILiquidityMining.md#withdraw)

withdraws pool tokens and transfers reward tokens

```solidity
function withdraw(address _poolToken, uint256 _amount, address _user) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address | the address of pool token | 
| _amount | uint256 | the amount of pool tokens | 
| _user | address | the user address will be used to process a withdrawal (can be passed only by wrapper contract) | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### _getUserAddress

```solidity
function _getUserAddress(address _user) internal view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### _updateReward

```solidity
function _updateReward(struct LiquidityMiningStorage.PoolInfo pool, struct LiquidityMiningStorage.UserInfo user) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| pool | struct LiquidityMiningStorage.PoolInfo |  | 
| user | struct LiquidityMiningStorage.UserInfo |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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
```
</details>

---    

> ### _updateRewardDebt

```solidity
function _updateRewardDebt(struct LiquidityMiningStorage.PoolInfo pool, struct LiquidityMiningStorage.UserInfo user) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| pool | struct LiquidityMiningStorage.PoolInfo |  | 
| user | struct LiquidityMiningStorage.UserInfo |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _updateRewardDebt(PoolInfo storage pool, UserInfo storage user) internal {
        //reward accumulated before amount update (should be subtracted during next reward calculation)
        user.rewardDebt = user.amount.mul(pool.accumulatedRewardPerShare).div(PRECISION);
    }
```
</details>

---    

> ### _transferReward

Send reward in SOV to the lockedSOV vault.

```solidity
function _transferReward(address _poolToken, struct LiquidityMiningStorage.UserInfo _user, address _userAddress, bool _isStakingTokens, bool _isCheckingBalance) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address |  | 
| _user | struct LiquidityMiningStorage.UserInfo | The user info, to get its reward share. | 
| _userAddress | address | The address of the user, to send SOV in its behalf. | 
| _isStakingTokens | bool | The flag whether we need to stake tokens | 
| _isCheckingBalance | bool | The flag whether we need to throw error or don't process reward if SOV balance isn't enough | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _transferReward(
        address _poolToken,
        UserInfo storage _user,
        address _userAddress,
        bool _isStakingTokens,
        bool _isCheckingBalance
    ) internal {
        uint256 userAccumulatedReward = _user.accumulatedReward;

        /// @dev Transfer if enough SOV balance on this LM contract.
        uint256 balance = SOV.balanceOf(address(this));
        if (balance >= userAccumulatedReward) {
            totalUsersBalance = totalUsersBalance.sub(userAccumulatedReward);
            _user.accumulatedReward = 0;

            /// @dev Instead of transferring the reward to the LP (user),
            ///   deposit it into lockedSOV vault contract, but first
            ///   SOV deposit must be approved to move the SOV tokens
            ///   from this LM contract into the lockedSOV vault.
            require(SOV.approve(address(lockedSOV), userAccumulatedReward), "Approve failed");
            lockedSOV.deposit(_userAddress, userAccumulatedReward, unlockedImmediatelyPercent);

            if (_isStakingTokens) {
                lockedSOV.withdrawAndStakeTokensFrom(_userAddress);
            }

            /// @dev Event log.
            emit RewardClaimed(_userAddress, _poolToken, userAccumulatedReward);
        } else {
            require(!_isCheckingBalance, "Claiming reward failed");
        }
    }
```
</details>

---    

> ### emergencyWithdraw

withdraws pool tokens without transferring reward tokens

```solidity
function emergencyWithdraw(address _poolToken) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address | the address of pool token | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
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

        _updateRewardDebt(pool, user);

        emit EmergencyWithdraw(msg.sender, _poolToken, userAmount, userAccumulatedReward);
    }
```
</details>

---    

> ### getPoolId

returns pool id

```solidity
function getPoolId(address _poolToken) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address | the address of pool token | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPoolId(address _poolToken) external view returns (uint256) {
        return _getPoolId(_poolToken);
    }
```
</details>

---    

> ### _getPoolId

```solidity
function _getPoolId(address _poolToken) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getPoolId(address _poolToken) internal view returns (uint256) {
        uint256 poolId = poolIdList[_poolToken];
        require(poolId > 0, "Pool token not found");
        return poolId - 1;
    }
```
</details>

---    

> ### getPoolLength

returns count of pool tokens

```solidity
function getPoolLength() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPoolLength() external view returns (uint256) {
        return poolInfoList.length;
    }
```
</details>

---    

> ### getPoolInfoList

returns list of pool token's info

```solidity
function getPoolInfoList() external view
returns(struct LiquidityMiningStorage.PoolInfo[])
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPoolInfoList() external view returns (PoolInfo[] memory) {
        return poolInfoList;
    }
```
</details>

---    

> ### getPoolInfo

returns pool info for the given token

```solidity
function getPoolInfo(address _poolToken) external view
returns(struct LiquidityMiningStorage.PoolInfo)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address | the address of pool token | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPoolInfo(address _poolToken) external view returns (PoolInfo memory) {
        uint256 poolId = _getPoolId(_poolToken);
        return poolInfoList[poolId];
    }
```
</details>

---    

> ### getUserBalanceList

returns list of [amount, accumulatedReward] for the given user for each pool token

```solidity
function getUserBalanceList(address _user) external view
returns(uint256[2][])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | the address of the user | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUserBalanceList(address _user) external view returns (uint256[2][] memory) {
        uint256 length = poolInfoList.length;
        uint256[2][] memory userBalanceList = new uint256[2][](length);
        for (uint256 i = 0; i < length; i++) {
            userBalanceList[i][0] = userInfoMap[i][_user].amount;
            userBalanceList[i][1] = _getUserAccumulatedReward(i, _user);
        }
        return userBalanceList;
    }
```
</details>

---    

> ### getUserInfo

returns UserInfo for the given pool and user

```solidity
function getUserInfo(address _poolToken, address _user) public view
returns(struct LiquidityMiningStorage.UserInfo)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address | the address of pool token | 
| _user | address | the address of the user | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUserInfo(address _poolToken, address _user) public view returns (UserInfo memory) {
        uint256 poolId = _getPoolId(_poolToken);
        return userInfoMap[poolId][_user];
    }
```
</details>

---    

> ### getUserInfoList

returns list of UserInfo for the given user for each pool token

```solidity
function getUserInfoList(address _user) external view
returns(struct LiquidityMiningStorage.UserInfo[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | the address of the user | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUserInfoList(address _user) external view returns (UserInfo[] memory) {
        uint256 length = poolInfoList.length;
        UserInfo[] memory userInfoList = new UserInfo[](length);
        for (uint256 i = 0; i < length; i++) {
            userInfoList[i] = userInfoMap[i][_user];
        }
        return userInfoList;
    }
```
</details>

---    

> ### getUserAccumulatedRewardList

returns accumulated reward for the given user for each pool token

```solidity
function getUserAccumulatedRewardList(address _user) external view
returns(uint256[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | the address of the user | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUserAccumulatedRewardList(address _user) external view returns (uint256[] memory) {
        uint256 length = poolInfoList.length;
        uint256[] memory rewardList = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            rewardList[i] = _getUserAccumulatedReward(i, _user);
        }
        return rewardList;
    }
```
</details>

---    

> ### getUserPoolTokenBalance

⤾ overrides [ILiquidityMining.getUserPoolTokenBalance](ILiquidityMining.md#getuserpooltokenbalance)

returns the pool token balance a user has on the contract

```solidity
function getUserPoolTokenBalance(address _poolToken, address _user) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _poolToken | address | the address of pool token | 
| _user | address | the address of the user | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUserPoolTokenBalance(address _poolToken, address _user)
        external
        view
        returns (uint256)
    {
        UserInfo memory ui = getUserInfo(_poolToken, _user);
        return ui.amount;
    }
```
</details>

## Contracts

* [Address](Address.md)
* [Administered](Administered.md)
* [AdminRole](AdminRole.md)
* [AdvancedToken](AdvancedToken.md)
* [AdvancedTokenStorage](AdvancedTokenStorage.md)
* [Affiliates](Affiliates.md)
* [AffiliatesEvents](AffiliatesEvents.md)
* [ApprovalReceiver](ApprovalReceiver.md)
* [BProPriceFeed](BProPriceFeed.md)
* [Checkpoints](Checkpoints.md)
* [Constants](Constants.md)
* [Context](Context.md)
* [DevelopmentFund](DevelopmentFund.md)
* [DummyContract](DummyContract.md)
* [ECDSA](ECDSA.md)
* [EnumerableAddressSet](EnumerableAddressSet.md)
* [EnumerableBytes32Set](EnumerableBytes32Set.md)
* [EnumerableBytes4Set](EnumerableBytes4Set.md)
* [ERC20](ERC20.md)
* [ERC20Detailed](ERC20Detailed.md)
* [ErrorDecoder](ErrorDecoder.md)
* [Escrow](Escrow.md)
* [EscrowReward](EscrowReward.md)
* [FeedsLike](FeedsLike.md)
* [FeesEvents](FeesEvents.md)
* [FeeSharingLogic](FeeSharingLogic.md)
* [FeeSharingProxy](FeeSharingProxy.md)
* [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
* [FeesHelper](FeesHelper.md)
* [FourYearVesting](FourYearVesting.md)
* [FourYearVestingFactory](FourYearVestingFactory.md)
* [FourYearVestingLogic](FourYearVestingLogic.md)
* [FourYearVestingStorage](FourYearVestingStorage.md)
* [GenericTokenSender](GenericTokenSender.md)
* [GovernorAlpha](GovernorAlpha.md)
* [GovernorVault](GovernorVault.md)
* [IApproveAndCall](IApproveAndCall.md)
* [IChai](IChai.md)
* [IContractRegistry](IContractRegistry.md)
* [IConverterAMM](IConverterAMM.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IFeeSharingProxy](IFeeSharingProxy.md)
* [IFourYearVesting](IFourYearVesting.md)
* [IFourYearVestingFactory](IFourYearVestingFactory.md)
* [ILiquidityMining](ILiquidityMining.md)
* [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
* [ILoanPool](ILoanPool.md)
* [ILoanToken](ILoanToken.md)
* [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
* [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
* [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
* [ILoanTokenModules](ILoanTokenModules.md)
* [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
* [ILockedSOV](ILockedSOV.md)
* [IMoCState](IMoCState.md)
* [Initializable](Initializable.md)
* [InterestUser](InterestUser.md)
* [IPot](IPot.md)
* [IPriceFeeds](IPriceFeeds.md)
* [IPriceFeedsExt](IPriceFeedsExt.md)
* [IProtocol](IProtocol.md)
* [IRSKOracle](IRSKOracle.md)
* [ISovryn](ISovryn.md)
* [ISovrynSwapNetwork](ISovrynSwapNetwork.md)
* [IStaking](IStaking.md)
* [ISwapsImpl](ISwapsImpl.md)
* [ITeamVesting](ITeamVesting.md)
* [ITimelock](ITimelock.md)
* [IV1PoolOracle](IV1PoolOracle.md)
* [IVesting](IVesting.md)
* [IVestingFactory](IVestingFactory.md)
* [IVestingRegistry](IVestingRegistry.md)
* [IWrbtc](IWrbtc.md)
* [IWrbtcERC20](IWrbtcERC20.md)
* [LenderInterestStruct](LenderInterestStruct.md)
* [LiquidationHelper](LiquidationHelper.md)
* [LiquidityMining](LiquidityMining.md)
* [LiquidityMiningConfigToken](LiquidityMiningConfigToken.md)
* [LiquidityMiningProxy](LiquidityMiningProxy.md)
* [LiquidityMiningStorage](LiquidityMiningStorage.md)
* [LoanClosingsEvents](LoanClosingsEvents.md)
* [LoanClosingsLiquidation](LoanClosingsLiquidation.md)
* [LoanClosingsRollover](LoanClosingsRollover.md)
* [LoanClosingsShared](LoanClosingsShared.md)
* [LoanClosingsWith](LoanClosingsWith.md)
* [LoanInterestStruct](LoanInterestStruct.md)
* [LoanMaintenance](LoanMaintenance.md)
* [LoanMaintenanceEvents](LoanMaintenanceEvents.md)
* [LoanOpenings](LoanOpenings.md)
* [LoanOpeningsEvents](LoanOpeningsEvents.md)
* [LoanParamsStruct](LoanParamsStruct.md)
* [LoanSettings](LoanSettings.md)
* [LoanSettingsEvents](LoanSettingsEvents.md)
* [LoanStruct](LoanStruct.md)
* [LoanToken](LoanToken.md)
* [LoanTokenBase](LoanTokenBase.md)
* [LoanTokenLogicBeacon](LoanTokenLogicBeacon.md)
* [LoanTokenLogicLM](LoanTokenLogicLM.md)
* [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
* [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
* [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
* [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
* [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
* [LockedSOV](LockedSOV.md)
* [Medianizer](Medianizer.md)
* [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
* [ModulesCommonEvents](ModulesCommonEvents.md)
* [MultiSigKeyHolders](MultiSigKeyHolders.md)
* [MultiSigWallet](MultiSigWallet.md)
* [Objects](Objects.md)
* [OrderStruct](OrderStruct.md)
* [OrigingVestingCreator](OrigingVestingCreator.md)
* [OriginInvestorsClaim](OriginInvestorsClaim.md)
* [Ownable](Ownable.md)
* [Pausable](Pausable.md)
* [PausableOz](PausableOz.md)
* [PreviousLoanToken](PreviousLoanToken.md)
* [PreviousLoanTokenSettingsLowerAdmin](PreviousLoanTokenSettingsLowerAdmin.md)
* [PriceFeedRSKOracle](PriceFeedRSKOracle.md)
* [PriceFeeds](PriceFeeds.md)
* [PriceFeedsLocal](PriceFeedsLocal.md)
* [PriceFeedsMoC](PriceFeedsMoC.md)
* [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
* [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
* [ProtocolLike](ProtocolLike.md)
* [ProtocolSettings](ProtocolSettings.md)
* [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
* [ProtocolSettingsLike](ProtocolSettingsLike.md)
* [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
* [ProtocolTokenUser](ProtocolTokenUser.md)
* [Proxy](Proxy.md)
* [ReentrancyGuard](ReentrancyGuard.md)
* [RewardHelper](RewardHelper.md)
* [RSKAddrValidator](RSKAddrValidator.md)
* [SafeERC20](SafeERC20.md)
* [SafeMath](SafeMath.md)
* [SafeMath96](SafeMath96.md)
* [setGet](setGet.md)
* [SignedSafeMath](SignedSafeMath.md)
* [SOV](SOV.md)
* [sovrynProtocol](sovrynProtocol.md)
* [Staking](Staking.md)
* [StakingInterface](StakingInterface.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingStorage](StakingStorage.md)
* [State](State.md)
* [SVR](SVR.md)
* [SwapsEvents](SwapsEvents.md)
* [SwapsExternal](SwapsExternal.md)
* [SwapsImplLocal](SwapsImplLocal.md)
* [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
* [SwapsUser](SwapsUser.md)
* [TeamVesting](TeamVesting.md)
* [Timelock](Timelock.md)
* [TimelockHarness](TimelockHarness.md)
* [TimelockInterface](TimelockInterface.md)
* [TokenSender](TokenSender.md)
* [UpgradableProxy](UpgradableProxy.md)
* [USDTPriceFeed](USDTPriceFeed.md)
* [VaultController](VaultController.md)
* [Vesting](Vesting.md)
* [VestingCreator](VestingCreator.md)
* [VestingFactory](VestingFactory.md)
* [VestingLogic](VestingLogic.md)
* [VestingRegistry](VestingRegistry.md)
* [VestingRegistry2](VestingRegistry2.md)
* [VestingRegistry3](VestingRegistry3.md)
* [VestingRegistryLogic](VestingRegistryLogic.md)
* [VestingRegistryProxy](VestingRegistryProxy.md)
* [VestingRegistryStorage](VestingRegistryStorage.md)
* [VestingStorage](VestingStorage.md)
* [WeightedStaking](WeightedStaking.md)
* [WRBTC](WRBTC.md)
