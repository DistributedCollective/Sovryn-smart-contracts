# ILiquidityMining
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/farm/ILiquidityMining.sol)


## Functions
### withdraw


```solidity
function withdraw(address _poolToken, uint256 _amount, address _user) external;
```

### onTokensDeposited


```solidity
function onTokensDeposited(address _user, uint256 _amount) external;
```

### getUserPoolTokenBalance


```solidity
function getUserPoolTokenBalance(address _poolToken, address _user) external view returns (uint256);
```

