# IV1PoolOracle
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/feeds/IV1PoolOracle.sol)


## Functions
### read


```solidity
function read(uint256 price, uint256 timestamp)
    external
    view
    returns (uint256, uint256, uint256, uint256, uint256, uint256);
```

### latestAnswer


```solidity
function latestAnswer() external view returns (uint256);
```

### liquidityPool


```solidity
function liquidityPool() external view returns (address);
```

### latestPrice


```solidity
function latestPrice(address _baseToken) external view returns (uint256 answer);
```

