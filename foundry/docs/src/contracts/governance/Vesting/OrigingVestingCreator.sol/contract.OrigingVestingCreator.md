# OrigingVestingCreator
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/OrigingVestingCreator.sol)

**Inherits:**
[Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

It casts an instance of vestingRegistry and by using createVesting
function it creates a vesting, gets it and stakes some tokens w/ this vesting.


## State Variables
### vestingRegistry

```solidity
VestingRegistry public vestingRegistry;
```


### processedList

```solidity
mapping(address => bool) processedList;
```


## Functions
### constructor


```solidity
constructor(address _vestingRegistry) public;
```

### createVesting

Create a vesting, get it and stake some tokens w/ this vesting.


```solidity
function createVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|The owner of the tokens.|
|`_amount`|`uint256`|The amount of tokens to be vested.|
|`_cliff`|`uint256`|The time interval to the first withdraw in seconds.|
|`_duration`|`uint256`|The total duration in seconds.|


