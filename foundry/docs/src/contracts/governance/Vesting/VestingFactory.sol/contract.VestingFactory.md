# VestingFactory
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/VestingFactory.sol)

**Inherits:**
[IVestingFactory](/contracts/governance/Vesting/IVestingFactory.sol/interface.IVestingFactory.md), [Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

Factory pattern allows to create multiple instances
of the same contract and keep track of them easier.


## State Variables
### vestingLogic

```solidity
address public vestingLogic;
```


## Functions
### constructor


```solidity
constructor(address _vestingLogic) public;
```

### deployVesting

Deploys Vesting contract.


```solidity
function deployVesting(
    address _SOV,
    address _staking,
    address _tokenOwner,
    uint256 _cliff,
    uint256 _duration,
    address _feeSharing,
    address _vestingOwner
) external onlyOwner returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_SOV`|`address`|the address of SOV token.|
|`_staking`|`address`|The address of staking contract.|
|`_tokenOwner`|`address`|The owner of the tokens.|
|`_cliff`|`uint256`|The time interval to the first withdraw in seconds.|
|`_duration`|`uint256`|The total duration in seconds.|
|`_feeSharing`|`address`|The address of fee sharing contract.|
|`_vestingOwner`|`address`|The address of an owner of vesting contract.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The vesting contract address.|


### deployTeamVesting

Deploys Team Vesting contract.


```solidity
function deployTeamVesting(
    address _SOV,
    address _staking,
    address _tokenOwner,
    uint256 _cliff,
    uint256 _duration,
    address _feeSharing,
    address _vestingOwner
) external onlyOwner returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_SOV`|`address`|The address of SOV token.|
|`_staking`|`address`|The address of staking contract.|
|`_tokenOwner`|`address`|The owner of the tokens.|
|`_cliff`|`uint256`|The time interval to the first withdraw in seconds.|
|`_duration`|`uint256`|The total duration in seconds.|
|`_feeSharing`|`address`|The address of fee sharing contract.|
|`_vestingOwner`|`address`|The address of an owner of vesting contract.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The vesting contract address.|


