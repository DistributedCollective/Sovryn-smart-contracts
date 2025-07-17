# VestingRegistry3
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/VestingRegistry3.sol)

**Inherits:**
[Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)


## State Variables
### vestingFactory

```solidity
IVestingFactory public vestingFactory;
```


### SOV
the SOV token contract


```solidity
address public SOV;
```


### staking
the staking contract address


```solidity
address public staking;
```


### feeSharingCollector

```solidity
address public feeSharingCollector;
```


### vestingOwner

```solidity
address public vestingOwner;
```


### vestingContracts

```solidity
mapping(address => mapping(uint256 => address)) public vestingContracts;
```


### admins

```solidity
mapping(address => bool) public admins;
```


## Functions
### constructor


```solidity
constructor(
    address _vestingFactory,
    address _SOV,
    address _staking,
    address _feeSharingCollector,
    address _vestingOwner
) public;
```

### onlyAuthorized

*Throws if called by any account other than the owner or admin.*


```solidity
modifier onlyAuthorized();
```

### addAdmin


```solidity
function addAdmin(address _admin) public onlyOwner;
```

### removeAdmin


```solidity
function removeAdmin(address _admin) public onlyOwner;
```

### setVestingFactory

sets vesting factory address


```solidity
function setVestingFactory(address _vestingFactory) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vestingFactory`|`address`|the address of vesting factory contract|


### _setVestingFactory


```solidity
function _setVestingFactory(address _vestingFactory) internal;
```

### transferSOV

transfers SOV tokens to given address


```solidity
function transferSOV(address _receiver, uint256 _amount) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_receiver`|`address`|the address of the SOV receiver|
|`_amount`|`uint256`|the amount to be transferred|


### createVesting

creates Vesting contract


```solidity
function createVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration) public onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|the owner of the tokens|
|`_amount`|`uint256`|the amount to be staked|
|`_cliff`|`uint256`|the cliff in seconds|
|`_duration`|`uint256`|the total duration in seconds|


### createTeamVesting

creates Team Vesting contract


```solidity
function createTeamVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration)
    public
    onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|the owner of the tokens|
|`_amount`|`uint256`|the amount to be staked|
|`_cliff`|`uint256`|the cliff in seconds|
|`_duration`|`uint256`|the total duration in seconds|


### stakeTokens

stakes tokens according to the vesting schedule


```solidity
function stakeTokens(address _vesting, uint256 _amount) public onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vesting`|`address`|the address of Vesting contract|
|`_amount`|`uint256`|the amount of tokens to stake|


### getVesting

returns vesting contract address for the given token owner


```solidity
function getVesting(address _tokenOwner) public view returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|the owner of the tokens|


### getTeamVesting

returns team vesting contract address for the given token owner


```solidity
function getTeamVesting(address _tokenOwner) public view returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|the owner of the tokens|


### _getOrCreateVesting


```solidity
function _getOrCreateVesting(address _tokenOwner, uint256 _cliff, uint256 _duration) internal returns (address);
```

### _getOrCreateTeamVesting


```solidity
function _getOrCreateTeamVesting(address _tokenOwner, uint256 _cliff, uint256 _duration) internal returns (address);
```

## Events
### SOVTransferred

```solidity
event SOVTransferred(address indexed receiver, uint256 amount);
```

### VestingCreated

```solidity
event VestingCreated(address indexed tokenOwner, address vesting, uint256 cliff, uint256 duration, uint256 amount);
```

### TeamVestingCreated

```solidity
event TeamVestingCreated(address indexed tokenOwner, address vesting, uint256 cliff, uint256 duration, uint256 amount);
```

### TokensStaked

```solidity
event TokensStaked(address indexed vesting, uint256 amount);
```

### AdminAdded

```solidity
event AdminAdded(address admin);
```

### AdminRemoved

```solidity
event AdminRemoved(address admin);
```

## Enums
### VestingType

```solidity
enum VestingType {
    TeamVesting,
    Vesting
}
```

