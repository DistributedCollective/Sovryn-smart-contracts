# IVestingRegistry
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/IVestingRegistry.sol)

*Interfaces are used to cast a contract address into a callable instance.*


## Functions
### getVesting


```solidity
function getVesting(address _tokenOwner) external view returns (address);
```

### getTeamVesting


```solidity
function getTeamVesting(address _tokenOwner) external view returns (address);
```

### setVestingRegistry


```solidity
function setVestingRegistry(address _vestingRegistryProxy) external;
```

### isVestingAddress


```solidity
function isVestingAddress(address _vestingAddress) external view returns (bool);
```

### isTeamVesting


```solidity
function isTeamVesting(address _vestingAddress) external view returns (bool);
```

