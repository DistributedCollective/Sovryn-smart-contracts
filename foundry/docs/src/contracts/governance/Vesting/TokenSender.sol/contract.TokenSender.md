# TokenSender
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/TokenSender.sol)

**Inherits:**
[Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

This contract includes functions to transfer SOV tokens
to a recipient or to several recipients in a list. There is
an ACL control check by modifier.


## State Variables
### SOV
The SOV token contract.


```solidity
address public SOV;
```


### admins
*user => flag whether user has admin role*


```solidity
mapping(address => bool) public admins;
```


## Functions
### constructor


```solidity
constructor(address _SOV) public;
```

### onlyAuthorized

*Throws if called by any account other than the owner or admin.*


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


### transferSOVusingList

Transfer given amounts of SOV to the given addresses.


```solidity
function transferSOVusingList(address[] memory _receivers, uint256[] memory _amounts) public onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_receivers`|`address[]`|The addresses of the SOV receivers.|
|`_amounts`|`uint256[]`|The amounts to be transferred.|


### transferSOV

Transfer SOV tokens to given address.


```solidity
function transferSOV(address _receiver, uint256 _amount) public onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_receiver`|`address`|The address of the SOV receiver.|
|`_amount`|`uint256`|The amount to be transferred.|


### _transferSOV


```solidity
function _transferSOV(address _receiver, uint256 _amount) internal;
```

## Events
### SOVTransferred

```solidity
event SOVTransferred(address indexed receiver, uint256 amount);
```

### AdminAdded

```solidity
event AdminAdded(address admin);
```

### AdminRemoved

```solidity
event AdminRemoved(address admin);
```

