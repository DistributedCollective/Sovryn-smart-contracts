# ITeamVesting
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/ITeamVesting.sol)

*Interfaces are used to cast a contract address into a callable instance.
This interface is used by Staking contract to cancel the team vesting
function having the vesting contract instance address.*


## Functions
### startDate


```solidity
function startDate() external view returns (uint256);
```

### cliff


```solidity
function cliff() external view returns (uint256);
```

### endDate


```solidity
function endDate() external view returns (uint256);
```

### duration


```solidity
function duration() external view returns (uint256);
```

### tokenOwner


```solidity
function tokenOwner() external view returns (address);
```

### governanceWithdrawTokens


```solidity
function governanceWithdrawTokens(address receiver) external;
```

