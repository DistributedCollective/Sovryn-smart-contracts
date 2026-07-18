# IFeeSharingCollector
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/IFeeSharingCollector.sol)

*Interfaces are used to cast a contract address into a callable instance.*


## Functions
### withdrawFees


```solidity
function withdrawFees(address[] calldata _token) external;
```

### transferTokens


```solidity
function transferTokens(address _token, uint96 _amount) external;
```

### withdraw


```solidity
function withdraw(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver) external;
```

