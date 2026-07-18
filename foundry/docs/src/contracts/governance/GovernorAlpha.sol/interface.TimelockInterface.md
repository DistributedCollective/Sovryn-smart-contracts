# TimelockInterface
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/GovernorAlpha.sol)


## Functions
### delay


```solidity
function delay() external view returns (uint256);
```

### GRACE_PERIOD


```solidity
function GRACE_PERIOD() external view returns (uint256);
```

### acceptAdmin


```solidity
function acceptAdmin() external;
```

### queuedTransactions


```solidity
function queuedTransactions(bytes32 hash) external view returns (bool);
```

### queueTransaction


```solidity
function queueTransaction(address target, uint256 value, string calldata signature, bytes calldata data, uint256 eta)
    external
    returns (bytes32);
```

### cancelTransaction


```solidity
function cancelTransaction(address target, uint256 value, string calldata signature, bytes calldata data, uint256 eta)
    external;
```

### executeTransaction


```solidity
function executeTransaction(address target, uint256 value, string calldata signature, bytes calldata data, uint256 eta)
    external
    payable
    returns (bytes memory);
```

