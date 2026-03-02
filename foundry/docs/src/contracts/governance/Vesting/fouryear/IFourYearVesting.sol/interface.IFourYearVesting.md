# IFourYearVesting
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/fouryear/IFourYearVesting.sol)

*Interfaces are used to cast a contract address into a callable instance.
This interface is used by FourYearVestingLogic contract to implement stakeTokens function
and on VestingRegistry contract to call IFourYearVesting(vesting).stakeTokens function
at a vesting instance.*


## Functions
### endDate


```solidity
function endDate() external returns (uint256);
```

### stakeTokens


```solidity
function stakeTokens(uint256 _amount, uint256 _restartStakeSchedule)
    external
    returns (uint256 lastSchedule, uint256 remainingAmount);
```

