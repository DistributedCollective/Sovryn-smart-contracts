# IVesting
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/IVesting.sol)

*Interfaces are used to cast a contract address into a callable instance.
This interface is used by VestingLogic contract to implement stakeTokens function
and on VestingRegistry contract to call IVesting(vesting).stakeTokens function
at a vesting instance.*


## Functions
### duration


```solidity
function duration() external returns (uint256);
```

### endDate


```solidity
function endDate() external returns (uint256);
```

### stakeTokens


```solidity
function stakeTokens(uint256 amount) external;
```

### tokenOwner


```solidity
function tokenOwner() external view returns (address);
```

