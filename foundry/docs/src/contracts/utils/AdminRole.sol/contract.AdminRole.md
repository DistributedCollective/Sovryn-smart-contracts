# AdminRole
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/utils/AdminRole.sol)

**Inherits:**
[Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)


## State Variables
### admins
*user => flag whether user has admin role.*


```solidity
mapping(address => bool) public admins;
```


## Functions
### onlyAuthorized

*Throws if called by any account other than the owner or admin.
or on our own overriding sovrynOwnable.*


```solidity
modifier onlyAuthorized();
```

### addAdmin

Add account to ACL.


```solidity
function addAdmin(address _admin) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_admin`|`address`|The addresses of the account to grant permissions.|


### removeAdmin

Remove account from ACL.


```solidity
function removeAdmin(address _admin) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_admin`|`address`|The addresses of the account to revoke permissions.|


## Events
### AdminAdded

```solidity
event AdminAdded(address admin);
```

### AdminRemoved

```solidity
event AdminRemoved(address admin);
```

