# VestingRegistryLogic
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/VestingRegistryLogic.sol)

**Inherits:**
[VestingRegistryStorage](/contracts/governance/Vesting/VestingRegistryStorage.sol/contract.VestingRegistryStorage.md)


## Functions
### initialize

Replace constructor with initialize function for Upgradable Contracts
This function will be called only once by the owner


```solidity
function initialize(
    address _vestingFactory,
    address _SOV,
    address _staking,
    address _feeSharingCollector,
    address _vestingOwner,
    address _lockedSOV,
    address[] calldata _vestingRegistries
) external onlyOwner initializer;
```

### setVestingFactory

sets vesting factory address


```solidity
function setVestingFactory(address _vestingFactory) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vestingFactory`|`address`|the address of vesting factory contract|


### _setVestingFactory

Internal function that sets vesting factory address


```solidity
function _setVestingFactory(address _vestingFactory) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vestingFactory`|`address`|the address of vesting factory contract|


### transferSOV

transfers SOV tokens to given address


```solidity
function transferSOV(address _receiver, uint256 _amount) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_receiver`|`address`|the address of the SOV receiver|
|`_amount`|`uint256`|the amount to be transferred|


### addDeployedVestings

adds vestings that were deployed in previous vesting registries

*migration of data from previous vesting registy contracts*


```solidity
function addDeployedVestings(address[] calldata _tokenOwners, uint256[] calldata _vestingCreationTypes)
    external
    onlyAuthorized;
```

### addFourYearVestings

adds four year vestings to vesting registry logic


```solidity
function addFourYearVestings(address[] calldata _tokenOwners, address[] calldata _vestingAddresses)
    external
    onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwners`|`address[]`|array of token owners|
|`_vestingAddresses`|`address[]`|array of vesting addresses|


### createVesting

creates Vesting contract

*Calls a public createVestingAddr function with vestingCreationType. This is to accomodate the existing logic for LockedSOV*

*vestingCreationType 0 = LockedSOV*


```solidity
function createVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration)
    external
    onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|the owner of the tokens|
|`_amount`|`uint256`|the amount to be staked|
|`_cliff`|`uint256`|the cliff in seconds|
|`_duration`|`uint256`|the total duration in seconds|


### createVestingAddr

creates Vesting contract


```solidity
function createVestingAddr(
    address _tokenOwner,
    uint256 _amount,
    uint256 _cliff,
    uint256 _duration,
    uint256 _vestingCreationType
) public onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|the owner of the tokens|
|`_amount`|`uint256`|the amount to be staked|
|`_cliff`|`uint256`|the cliff in seconds|
|`_duration`|`uint256`|the total duration in seconds|
|`_vestingCreationType`|`uint256`|the type of vesting created(e.g. Origin, Bug Bounty etc.)|


### createTeamVesting

creates Team Vesting contract


```solidity
function createTeamVesting(
    address _tokenOwner,
    uint256 _amount,
    uint256 _cliff,
    uint256 _duration,
    uint256 _vestingCreationType
) external onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|the owner of the tokens|
|`_amount`|`uint256`|the amount to be staked|
|`_cliff`|`uint256`|the cliff in seconds|
|`_duration`|`uint256`|the total duration in seconds|
|`_vestingCreationType`|`uint256`|the type of vesting created(e.g. Origin, Bug Bounty etc.)|


### stakeTokens

stakes tokens according to the vesting schedule


```solidity
function stakeTokens(address _vesting, uint256 _amount) external onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vesting`|`address`|the address of Vesting contract|
|`_amount`|`uint256`|the amount of tokens to stake|


### getVesting

returns vesting contract address for the given token owner

*Calls a public getVestingAddr function with cliff and duration. This is to accomodate the existing logic for LockedSOV*

*We need to use LockedSOV.changeRegistryCliffAndDuration function very judiciously*

*vestingCreationType 0 - LockedSOV*


```solidity
function getVesting(address _tokenOwner) public view returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|the owner of the tokens|


### getVestingAddr

public function that returns vesting contract address for the given token owner, cliff, duration

*Important: Please use this instead of getVesting function*


```solidity
function getVestingAddr(address _tokenOwner, uint256 _cliff, uint256 _duration, uint256 _vestingCreationType)
    public
    view
    returns (address);
```

### getTeamVesting

returns team vesting contract address for the given token owner, cliff, duration


```solidity
function getTeamVesting(address _tokenOwner, uint256 _cliff, uint256 _duration, uint256 _vestingCreationType)
    public
    view
    returns (address);
```

### isTeamVesting

*check if the specific vesting address is team vesting or not*

*read the vestingType from vestingCreationAndTypes storage*


```solidity
function isTeamVesting(address _vestingAddress) external view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vestingAddress`|`address`|address of vesting contract|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|true for teamVesting, false for normal vesting|


### registerVestingToVestingCreationAndTypes

*setter function to register existing vesting contract to vestingCreationAndTypes storage*

*need to set the function visilibty to public to support VestingCreationAndTypeDetails struct as parameter*


```solidity
function registerVestingToVestingCreationAndTypes(
    address[] memory _vestingAddresses,
    VestingCreationAndTypeDetails[] memory _vestingCreationAndTypes
) public onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vestingAddresses`|`address[]`|array of vesting address|
|`_vestingCreationAndTypes`|`VestingCreationAndTypeDetails[]`|array for VestingCreationAndTypeDetails struct|


### _getOrCreateVesting

Internal function to deploy Vesting/Team Vesting contract


```solidity
function _getOrCreateVesting(
    address _tokenOwner,
    uint256 _cliff,
    uint256 _duration,
    uint256 _type,
    uint256 _vestingCreationType
) internal returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|the owner of the tokens|
|`_cliff`|`uint256`|the cliff in seconds|
|`_duration`|`uint256`|the total duration in seconds|
|`_type`|`uint256`|the type of vesting|
|`_vestingCreationType`|`uint256`|the type of vesting created(e.g. Origin, Bug Bounty etc.)|


### _addDeployedVestings

stores the addresses of Vesting contracts from all three previous versions of Vesting Registry


```solidity
function _addDeployedVestings(address _tokenOwner, uint256 _vestingCreationType) internal;
```

### getVestingsOf

returns all vesting details for the given token owner


```solidity
function getVestingsOf(address _tokenOwner) external view returns (Vesting[] memory);
```

### getVestingDetails

returns cliff and duration for Vesting & TeamVesting contracts


```solidity
function getVestingDetails(address _vestingAddress) external view returns (uint256 cliff, uint256 duration);
```

### isVestingAddress

returns if the address is a vesting address


```solidity
function isVestingAddress(address _vestingAddress) external view returns (bool isVestingAddr);
```

## Events
### SOVTransferred

```solidity
event SOVTransferred(address indexed receiver, uint256 amount);
```

### VestingCreated

```solidity
event VestingCreated(
    address indexed tokenOwner,
    address vesting,
    uint256 cliff,
    uint256 duration,
    uint256 amount,
    uint256 vestingCreationType
);
```

### TeamVestingCreated

```solidity
event TeamVestingCreated(
    address indexed tokenOwner,
    address vesting,
    uint256 cliff,
    uint256 duration,
    uint256 amount,
    uint256 vestingCreationType
);
```

### TokensStaked

```solidity
event TokensStaked(address indexed vesting, uint256 amount);
```

### VestingCreationAndTypesSet

```solidity
event VestingCreationAndTypesSet(address indexed vesting, VestingCreationAndTypeDetails vestingCreationAndType);
```

