# IFourYearVestingFactory
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/fouryear/IFourYearVestingFactory.sol)

*Interfaces are used to cast a contract address into a callable instance.
This interface is used by FourYearVestingFactory contract to override empty
implemention of deployFourYearVesting function
and use an instance of FourYearVestingFactory.*


## Functions
### deployFourYearVesting


```solidity
function deployFourYearVesting(
    address _SOV,
    address _staking,
    address _tokenOwner,
    address _feeSharing,
    address _vestingOwnerMultisig,
    address _fourYearVestingLogic,
    uint256 _extendDurationFor
) external returns (address);
```

