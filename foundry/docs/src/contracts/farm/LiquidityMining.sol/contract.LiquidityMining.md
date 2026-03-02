# LiquidityMining
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/farm/LiquidityMining.sol)

**Inherits:**
[ILiquidityMining](/contracts/farm/ILiquidityMining.sol/interface.ILiquidityMining.md), [LiquidityMiningStorage](/contracts/farm/LiquidityMiningStorage.sol/contract.LiquidityMiningStorage.md)


## State Variables
### PRECISION

```solidity
uint256 public constant PRECISION = 1e12;
```


### BONUS_BLOCK_MULTIPLIER

```solidity
uint256 public constant BONUS_BLOCK_MULTIPLIER = 10;
```


### SECONDS_PER_BLOCK

```solidity
uint256 public constant SECONDS_PER_BLOCK = 30;
```


## Functions
### initialize

Initialize mining.


```solidity
function initialize(
    IERC20 _SOV,
    uint256 _rewardTokensPerBlock,
    uint256 _startDelayBlocks,
    uint256 _numberOfBonusBlocks,
    address _wrapper,
    ILockedSOV _lockedSOV,
    uint256 _unlockedImmediatelyPercent
) external onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_SOV`|`IERC20`|The SOV token.|
|`_rewardTokensPerBlock`|`uint256`|The number of reward tokens per block.|
|`_startDelayBlocks`|`uint256`|The number of blocks should be passed to start mining.|
|`_numberOfBonusBlocks`|`uint256`|The number of blocks when each block will be calculated as N blocks (BONUS_BLOCK_MULTIPLIER).|
|`_wrapper`|`address`||
|`_lockedSOV`|`ILockedSOV`|The contract instance address of the lockedSOV vault. SOV rewards are not paid directly to liquidity providers. Instead they are deposited into a lockedSOV vault contract.|
|`_unlockedImmediatelyPercent`|`uint256`|The % which determines how much will be unlocked immediately.|


### setLockedSOV

Sets lockedSOV contract.

*Non-idempotent function. Must be called just once.*


```solidity
function setLockedSOV(ILockedSOV _lockedSOV) external onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_lockedSOV`|`ILockedSOV`|The contract instance address of the lockedSOV vault.|


### setUnlockedImmediatelyPercent

Sets unlocked immediately percent.

*10000 is 100%*


```solidity
function setUnlockedImmediatelyPercent(uint256 _unlockedImmediatelyPercent) external onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_unlockedImmediatelyPercent`|`uint256`|The % which determines how much will be unlocked immediately.|


### setPoolTokenUnlockedImmediatelyPercent

Sets unlocked immediately percent overwrite for specific pool token.

*10000 is 100%*


```solidity
function setPoolTokenUnlockedImmediatelyPercent(address _poolToken, uint256 _poolTokenUnlockedImmediatelyPercent)
    external
    onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`|the address of pool token|
|`_poolTokenUnlockedImmediatelyPercent`|`uint256`|The % which determines how much will be unlocked immediately.|


### setWrapper

sets wrapper proxy contract

*can be set to zero address to remove wrapper*


```solidity
function setWrapper(address _wrapper) external onlyAuthorized;
```

### stopMining

stops mining by setting end block


```solidity
function stopMining() external onlyAuthorized;
```

### transferSOV

Transfers SOV tokens to given address.
Owner use this function to withdraw SOV from LM contract
into another account.


```solidity
function transferSOV(address _receiver, uint256 _amount) external onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_receiver`|`address`|The address of the SOV receiver.|
|`_amount`|`uint256`|The amount to be transferred.|


### getMissedBalance

Get the missed SOV balance of LM contract.

*Do not transfer more SOV than available.*

*The actual transfer.*

*Event log.*


```solidity
function getMissedBalance() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The amount of SOV tokens according to totalUsersBalance in excess of actual SOV balance of the LM contract.|


### add

adds a new lp to the pool. Can only be called by the owner or an admin


```solidity
function add(address _poolToken, uint96 _allocationPoint, bool _withUpdate) external onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`|the address of pool token|
|`_allocationPoint`|`uint96`|the allocation point (weight) for the given pool|
|`_withUpdate`|`bool`|the flag whether we need to update all pools|


### update

updates the given pool's reward tokens allocation point


```solidity
function update(address _poolToken, uint96 _allocationPoint, bool _updateAllFlag) external onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`|the address of pool token|
|`_allocationPoint`|`uint96`|the allocation point (weight) for the given pool|
|`_updateAllFlag`|`bool`|the flag whether we need to update all pools|


### _updateToken


```solidity
function _updateToken(address _poolToken, uint96 _allocationPoint) internal;
```

### updateTokens

updates the given pools' reward tokens allocation points


```solidity
function updateTokens(address[] calldata _poolTokens, uint96[] calldata _allocationPoints, bool _updateAllFlag)
    external
    onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolTokens`|`address[]`|array of addresses of pool tokens|
|`_allocationPoints`|`uint96[]`|array of allocation points (weight) for the given pools|
|`_updateAllFlag`|`bool`|the flag whether we need to update all pools|


### _getPassedBlocksWithBonusMultiplier

returns reward multiplier over the given _from to _to block


```solidity
function _getPassedBlocksWithBonusMultiplier(uint256 _from, uint256 _to) internal view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_from`|`uint256`|the first block for a calculation|
|`_to`|`uint256`|the last block for a calculation|


### _getUserAccumulatedReward


```solidity
function _getUserAccumulatedReward(uint256 _poolId, address _user) internal view returns (uint256);
```

### getUserAccumulatedReward

returns accumulated reward


```solidity
function getUserAccumulatedReward(address _poolToken, address _user) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`|the address of pool token|
|`_user`|`address`|the user address|


### getEstimatedReward

returns estimated reward


```solidity
function getEstimatedReward(address _poolToken, uint256 _amount, uint256 _duration) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`|the address of pool token|
|`_amount`|`uint256`|the amount of tokens to be deposited|
|`_duration`|`uint256`|the duration of liquidity providing in seconds|


### updateAllPools

Updates reward variables for all pools.

*Be careful of gas spending!*


```solidity
function updateAllPools() public;
```

### updatePool

Updates reward variables of the given pool to be up-to-date


```solidity
function updatePool(address _poolToken) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`|the address of pool token|


### _updatePool


```solidity
function _updatePool(uint256 _poolId) internal;
```

### _getPoolAccumulatedReward


```solidity
function _getPoolAccumulatedReward(PoolInfo storage _pool) internal view returns (uint256, uint256);
```

### _getPoolAccumulatedReward


```solidity
function _getPoolAccumulatedReward(
    PoolInfo storage _pool,
    uint256 _additionalAmount,
    uint256 _startBlock,
    uint256 _endBlock
) internal view returns (uint256, uint256);
```

### deposit

deposits pool tokens


```solidity
function deposit(address _poolToken, uint256 _amount, address _user) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`|the address of pool token|
|`_amount`|`uint256`|the amount of pool tokens|
|`_user`|`address`|the address of user, tokens will be deposited to it or to msg.sender|


### onTokensDeposited

if the lending pools directly mint/transfer tokens to this address, process it like a user deposit

*only callable by the pool which issues the tokens*


```solidity
function onTokensDeposited(address _user, uint256 _amount) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|the user address|
|`_amount`|`uint256`|the minted amount|


### _deposit

internal function for depositing pool tokens


```solidity
function _deposit(address _poolToken, uint256 _amount, address _user, bool alreadyTransferred) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`|the address of pool token|
|`_amount`|`uint256`|the amount of pool tokens|
|`_user`|`address`|the address of user, tokens will be deposited to it|
|`alreadyTransferred`|`bool`|true if the pool tokens have already been transferred|


### claimReward

transfers reward tokens


```solidity
function claimReward(address _poolToken, address _user) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`|the address of pool token|
|`_user`|`address`|the address of user to claim reward from (can be passed only by wrapper contract)|


### _claimReward


```solidity
function _claimReward(uint256 _poolId, address _userAddress, bool _isStakingTokens) internal;
```

### claimRewardFromAllPools

transfers reward tokens from all pools


```solidity
function claimRewardFromAllPools(address _user) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|the address of user to claim reward from (can be passed only by wrapper contract)|


### withdraw

withdraws pool tokens and transfers reward tokens


```solidity
function withdraw(address _poolToken, uint256 _amount, address _user) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`|the address of pool token|
|`_amount`|`uint256`|the amount of pool tokens|
|`_user`|`address`|the user address will be used to process a withdrawal (can be passed only by wrapper contract)|


### _getUserAddress


```solidity
function _getUserAddress(address _user) internal view returns (address);
```

### _updateReward


```solidity
function _updateReward(PoolInfo storage pool, UserInfo storage user) internal;
```

### _updateRewardDebt


```solidity
function _updateRewardDebt(PoolInfo storage pool, UserInfo storage user) internal;
```

### _transferReward

Send reward in SOV to the lockedSOV vault.


```solidity
function _transferReward(
    address _poolToken,
    UserInfo storage _user,
    address _userAddress,
    bool _isStakingTokens,
    bool _isCheckingBalance
) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`||
|`_user`|`UserInfo`|The user info, to get its reward share.|
|`_userAddress`|`address`|The address of the user, to send SOV in its behalf.|
|`_isStakingTokens`|`bool`|The flag whether we need to stake tokens|
|`_isCheckingBalance`|`bool`|The flag whether we need to throw error or don't process reward if SOV balance isn't enough|


### emergencyWithdraw

withdraws pool tokens without transferring reward tokens

*get unlock immediate percent of the pool token.*

*Transfer if enough SOV balance on this LM contract.*

*If calculatedUnlockedImmediatelyPercent is 100%, transfer the reward to the LP (user).
else, deposit it into lockedSOV vault contract, but first
SOV deposit must be approved to move the SOV tokens
from this LM contract into the lockedSOV vault.*

*Event log.*

*EMERGENCY ONLY*


```solidity
function emergencyWithdraw(address _poolToken) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`|the address of pool token|


### getPoolId

returns pool id


```solidity
function getPoolId(address _poolToken) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`|the address of pool token|


### _getPoolId


```solidity
function _getPoolId(address _poolToken) internal view returns (uint256);
```

### getPoolLength

returns count of pool tokens


```solidity
function getPoolLength() external view returns (uint256);
```

### getPoolInfoList

returns list of pool token's info


```solidity
function getPoolInfoList() external view returns (PoolInfo[] memory);
```

### getPoolInfo

returns pool info for the given token


```solidity
function getPoolInfo(address _poolToken) external view returns (PoolInfo memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`|the address of pool token|


### getUserBalanceList

returns list of [amount, accumulatedReward] for the given user for each pool token


```solidity
function getUserBalanceList(address _user) external view returns (uint256[2][] memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|the address of the user|


### getUserInfo

returns UserInfo for the given pool and user


```solidity
function getUserInfo(address _poolToken, address _user) public view returns (UserInfo memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`|the address of pool token|
|`_user`|`address`|the address of the user|


### getUserInfoList

returns list of UserInfo for the given user for each pool token


```solidity
function getUserInfoList(address _user) external view returns (UserInfo[] memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|the address of the user|


### getUserAccumulatedRewardList

returns accumulated reward for the given user for each pool token


```solidity
function getUserAccumulatedRewardList(address _user) external view returns (uint256[] memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|the address of the user|


### getUserPoolTokenBalance

returns the pool token balance a user has on the contract


```solidity
function getUserPoolTokenBalance(address _poolToken, address _user) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolToken`|`address`|the address of pool token|
|`_user`|`address`|the address of the user|


### getUserAccumulatedRewardToBePaidLiquid

returns the accumulated liquid reward for the given user for each pool token


```solidity
function getUserAccumulatedRewardToBePaidLiquid(address _user) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|the address of the user|


### getUserAccumulatedRewardToBeVested

returns the accumulated vested reward for the given user for each pool token


```solidity
function getUserAccumulatedRewardToBeVested(address _user) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|the address of the user|


### calcUnlockedImmediatelyPercent

*calculate the unlocked immediate percentage of specific pool token
use the poolTokensUnlockedImmediatelyPercent by default, if it is not set, then use the unlockedImmediatelyPercent*


```solidity
function calcUnlockedImmediatelyPercent(address _poolToken) public view returns (uint256);
```

## Events
### SOVTransferred

```solidity
event SOVTransferred(address indexed receiver, uint256 amount);
```

### PoolTokenAdded

```solidity
event PoolTokenAdded(address indexed user, address indexed poolToken, uint256 allocationPoint);
```

### PoolTokenUpdated

```solidity
event PoolTokenUpdated(
    address indexed user, address indexed poolToken, uint256 newAllocationPoint, uint256 oldAllocationPoint
);
```

### Deposit

```solidity
event Deposit(address indexed user, address indexed poolToken, uint256 amount);
```

### RewardClaimed

```solidity
event RewardClaimed(address indexed user, address indexed poolToken, uint256 amount);
```

### Withdraw

```solidity
event Withdraw(address indexed user, address indexed poolToken, uint256 amount);
```

### EmergencyWithdraw

```solidity
event EmergencyWithdraw(address indexed user, address indexed poolToken, uint256 amount, uint256 accumulatedReward);
```

