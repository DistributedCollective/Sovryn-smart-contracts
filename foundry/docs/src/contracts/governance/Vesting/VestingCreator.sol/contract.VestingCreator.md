# VestingCreator
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/VestingCreator.sol)

**Inherits:**
[AdminRole](/contracts/utils/AdminRole.sol/contract.AdminRole.md)


## State Variables
### vestingCreated
Boolean to check both vesting creation and staking is completed for a record


```solidity
bool vestingCreated;
```


### TWO_WEEKS
2 weeks in seconds.


```solidity
uint256 public constant TWO_WEEKS = 2 weeks;
```


### SOV
the SOV token contract


```solidity
IERC20 public SOV;
```


### vestingRegistryLogic
the vesting registry contract


```solidity
VestingRegistryLogic public vestingRegistryLogic;
```


### vestingDataList
list of vesting to be processed


```solidity
VestingData[] public vestingDataList;
```


## Functions
### constructor


```solidity
constructor(address _SOV, address _vestingRegistryProxy) public;
```

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


### addVestings

adds vestings to be processed to the list


```solidity
function addVestings(
    address[] calldata _tokenOwners,
    uint256[] calldata _amounts,
    uint256[] calldata _cliffs,
    uint256[] calldata _durations,
    bool[] calldata _governanceControls,
    uint256[] calldata _vestingCreationTypes
) external onlyAuthorized;
```

### processNextVesting

Creates vesting contract and stakes tokens

*Vesting and Staking are merged for calls that fits the gas limit*


```solidity
function processNextVesting() external;
```

### processVestingCreation

Creates vesting contract without staking any tokens

*Separating the Vesting and Staking to tackle Block Gas Limit*


```solidity
function processVestingCreation() public;
```

### processStaking

Staking vested tokens

*it can be the case when vesting creation and tokens staking can't be done in one transaction because of block gas limit*


```solidity
function processStaking() public;
```

### removeNextVesting

removes next vesting data from the list

*we process inverted list*

*we should be able to remove incorrect vesting data that can't be processed*


```solidity
function removeNextVesting() external onlyAuthorized;
```

### clearVestingDataList

removes all data about unprocessed vestings to be processed


```solidity
function clearVestingDataList() public onlyAuthorized;
```

### getVestingAddress

returns address after vesting creation


```solidity
function getVestingAddress() external view returns (address);
```

### getVestingPeriod

returns period i.e. ((duration - cliff) / 4 WEEKS)

*will be used for deciding if vesting and staking needs to be processed
in a single transaction or separate transactions*


```solidity
function getVestingPeriod() external view returns (uint256);
```

### getUnprocessedCount

returns count of vestings to be processed


```solidity
function getUnprocessedCount() external view returns (uint256);
```

### getUnprocessedAmount

returns total amount of vestings to be processed


```solidity
function getUnprocessedAmount() public view returns (uint256);
```

### isEnoughBalance

checks if contract balance is enough to process all vestings


```solidity
function isEnoughBalance() public view returns (bool);
```

### getMissingBalance

returns missed balance to process all vestings


```solidity
function getMissingBalance() external view returns (uint256);
```

### _createAndGetVesting

creates TeamVesting or Vesting contract

*new contract won't be created if account already has contract of the same type*


```solidity
function _createAndGetVesting(VestingData memory vestingData) internal returns (address vesting);
```

### _getVesting

returns an address of TeamVesting or Vesting contract (depends on a governance control)


```solidity
function _getVesting(
    address _tokenOwner,
    uint256 _cliff,
    uint256 _duration,
    bool _governanceControl,
    uint256 _vestingCreationType
) internal view returns (address vestingAddress);
```

## Events
### SOVTransferred

```solidity
event SOVTransferred(address indexed receiver, uint256 amount);
```

### TokensStaked

```solidity
event TokensStaked(address indexed vesting, address indexed tokenOwner, uint256 amount);
```

### VestingDataRemoved

```solidity
event VestingDataRemoved(address indexed caller, address indexed tokenOwner);
```

### DataCleared

```solidity
event DataCleared(address indexed caller);
```

## Structs
### VestingData
Holds Vesting Data


```solidity
struct VestingData {
    uint256 amount;
    uint256 cliff;
    uint256 duration;
    bool governanceControl;
    address tokenOwner;
    uint256 vestingCreationType;
}
```

