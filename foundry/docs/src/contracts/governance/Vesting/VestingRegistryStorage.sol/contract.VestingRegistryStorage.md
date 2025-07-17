# VestingRegistryStorage
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/VestingRegistryStorage.sol)

**Inherits:**
[Initializable](/contracts/openzeppelin/Initializable.sol/contract.Initializable.md), [AdminRole](/contracts/utils/AdminRole.sol/contract.AdminRole.md)

This contract is just the storage required for vesting registry.
It is parent of VestingRegistryProxy and VestingRegistryLogic.

*Use Ownable as a parent to align storage structure for Logic and Proxy contracts.*


## State Variables
### vestingFactory
the vesting factory contract


```solidity
IVestingFactory public vestingFactory;
```


### lockedSOV
the Locked SOV contract

*NOTES: No need to update lockedSOV in this contract, since it might break the vestingRegistry if the new lockedSOV does not have the same value of cliff & duration.*


```solidity
ILockedSOV public lockedSOV;
```


### vestingRegistries
the list of vesting registries


```solidity
IVestingRegistry[] public vestingRegistries;
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
fee sharing proxy


```solidity
address public feeSharingCollector;
```


### vestingOwner
the vesting owner (e.g. governance timelock address)


```solidity
address public vestingOwner;
```


### vestings
A record of vesting details for a unique id

*vestings[uid] returns vesting data*


```solidity
mapping(uint256 => Vesting) public vestings;
```


### vestingsOf
A record of all unique ids for a particular token owner

*vestingsOf[tokenOwner] returns array of unique ids*


```solidity
mapping(address => uint256[]) public vestingsOf;
```


### isVesting
A record of all vesting addresses

*isVesting[address] returns if the address is a vesting address*


```solidity
mapping(address => bool) public isVesting;
```


### vestingCreationAndTypes
A record of all vesting addresses with the detail

*vestingDetail[vestingAddress] returns Vesting struct data*

*can be used to easily check the vesting type / creation type based on the vesting address itself*


```solidity
mapping(address => VestingCreationAndTypeDetails) public vestingCreationAndTypes;
```


## Structs
### Vesting
Vesting details


```solidity
struct Vesting {
    uint256 vestingType;
    uint256 vestingCreationType;
    address vestingAddress;
}
```

### VestingCreationAndTypeDetails
Store vesting creation type & vesting type information

*it is packed into 1 single storage slot for cheaper gas usage*


```solidity
struct VestingCreationAndTypeDetails {
    bool isSet;
    uint32 vestingType;
    uint128 vestingCreationType;
}
```

## Enums
### VestingType

```solidity
enum VestingType {
    TeamVesting,
    Vesting
}
```

