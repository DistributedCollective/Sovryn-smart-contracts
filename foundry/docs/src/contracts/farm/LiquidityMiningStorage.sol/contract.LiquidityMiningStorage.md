# LiquidityMiningStorage
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/farm/LiquidityMiningStorage.sol)

**Inherits:**
[AdminRole](/contracts/utils/AdminRole.sol/contract.AdminRole.md)


## State Variables
### rewardTokensPerBlock

```solidity
uint256 public rewardTokensPerBlock;
```


### startBlock

```solidity
uint256 public startBlock;
```


### bonusEndBlock

```solidity
uint256 public bonusEndBlock;
```


### endBlock

```solidity
uint256 public endBlock;
```


### wrapper

```solidity
address public wrapper;
```


### poolInfoList

```solidity
PoolInfo[] public poolInfoList;
```


### poolIdList

```solidity
mapping(address => uint256) poolIdList;
```


### totalAllocationPoint

```solidity
uint256 public totalAllocationPoint;
```


### userInfoMap

```solidity
mapping(uint256 => mapping(address => UserInfo)) public userInfoMap;
```


### totalUsersBalance

```solidity
uint256 public totalUsersBalance;
```


### SOV
*The SOV token*


```solidity
IERC20 public SOV;
```


### lockedSOV
*The locked vault contract to deposit LP's rewards into.*


```solidity
ILockedSOV public lockedSOV;
```


### unlockedImmediatelyPercent
*10000 is 100%*


```solidity
uint256 public unlockedImmediatelyPercent;
```


### poolTokensUnlockedImmediatelyPercent
*overwrite the unlockedImmediatelyPercent for specific token.*


```solidity
mapping(address => uint256) public poolTokensUnlockedImmediatelyPercent;
```


## Structs
### UserInfo

```solidity
struct UserInfo {
    uint256 amount;
    uint256 rewardDebt;
    uint256 accumulatedReward;
}
```

### PoolInfo

```solidity
struct PoolInfo {
    IERC20 poolToken;
    uint96 allocationPoint;
    uint256 lastRewardBlock;
    uint256 accumulatedRewardPerShare;
}
```

