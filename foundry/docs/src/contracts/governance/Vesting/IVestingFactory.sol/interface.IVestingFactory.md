# IVestingFactory
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/IVestingFactory.sol)

*Interfaces are used to cast a contract address into a callable instance.
This interface is used by VestingFactory contract to override empty
implemention of deployVesting and deployTeamVesting functions
and on VestingRegistry contract to use an instance of VestingFactory.*


## Functions
### deployVesting


```solidity
function deployVesting(
    address _SOV,
    address _staking,
    address _tokenOwner,
    uint256 _cliff,
    uint256 _duration,
    address _feeSharing,
    address _owner
) external returns (address);
```

### deployTeamVesting


```solidity
function deployTeamVesting(
    address _SOV,
    address _staking,
    address _tokenOwner,
    uint256 _cliff,
    uint256 _duration,
    address _feeSharing,
    address _owner
) external returns (address);
```

