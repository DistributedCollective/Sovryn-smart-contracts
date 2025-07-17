# FourYearVestingFactory
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/fouryear/FourYearVestingFactory.sol)

**Inherits:**
[IFourYearVestingFactory](/contracts/governance/Vesting/fouryear/IFourYearVestingFactory.sol/interface.IFourYearVestingFactory.md), [Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

Factory pattern allows to create multiple instances
of the same contract and keep track of them easier.


## Functions
### deployFourYearVesting

Deploys four year vesting contract.

*_vestingOwnerMultisig should ALWAYS be multisig.*


```solidity
function deployFourYearVesting(
    address _SOV,
    address _staking,
    address _tokenOwner,
    address _feeSharing,
    address _vestingOwnerMultisig,
    address _fourYearVestingLogic,
    uint256 _extendDurationFor
) external onlyOwner returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_SOV`|`address`|the address of SOV token.|
|`_staking`|`address`|The address of staking contract.|
|`_tokenOwner`|`address`|The owner of the tokens.|
|`_feeSharing`|`address`|The address of fee sharing contract.|
|`_vestingOwnerMultisig`|`address`|The address of an owner of vesting contract.|
|`_fourYearVestingLogic`|`address`|The implementation contract.|
|`_extendDurationFor`|`uint256`|Duration till the unlocked tokens are extended.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The four year vesting contract address.|


## Events
### FourYearVestingCreated
*Added an event to keep track of the vesting contract created for a token owner*


```solidity
event FourYearVestingCreated(address indexed tokenOwner, address indexed vestingAddress);
```

