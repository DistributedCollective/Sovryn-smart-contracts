# Proxy
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/proxy/Proxy.sol)

The proxy performs delegated calls to the contract implementation
it is pointing to. This way upgradable contracts are possible on blockchain.
Delegating proxy contracts are widely used for both upgradeability and gas
savings. These proxies rely on a logic contract (also known as implementation
contract or master copy) that is called using delegatecall. This allows
proxies to keep a persistent state (storage and balance) while the code is
delegated to the logic contract.
Proxy contract is meant to be inherited and its internal functions
_setImplementation and _setProxyOwner to be called when upgrades become
neccessary.
The loan token (iToken) contract as well as the protocol contract act as
proxies, delegating all calls to underlying contracts. Therefore, if you
want to interact with them using web3, you need to use the ABIs from the
contracts containing the actual logic or the interface contract.
ABI for LoanToken contracts: LoanTokenLogicStandard
ABI for Protocol contract: ISovryn

*UpgradableProxy is the contract that inherits Proxy and wraps these
functions.*


## State Variables
### KEY_IMPLEMENTATION

```solidity
bytes32 private constant KEY_IMPLEMENTATION = keccak256("key.implementation");
```


### KEY_OWNER

```solidity
bytes32 private constant KEY_OWNER = keccak256("key.proxy.owner");
```


## Functions
### constructor

Set sender as an owner.


```solidity
constructor() public;
```

### onlyProxyOwner

Throw error if called not by an owner.


```solidity
modifier onlyProxyOwner();
```

### _setImplementation

Set address of the implementation.


```solidity
function _setImplementation(address _implementation) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_implementation`|`address`|Address of the implementation.|


### getImplementation

Return address of the implementation.


```solidity
function getImplementation() public view returns (address _implementation);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_implementation`|`address`|Address of the implementation.|


### _setProxyOwner

Set address of the owner.


```solidity
function _setProxyOwner(address _owner) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_owner`|`address`|Address of the owner.|


### getProxyOwner

Return address of the owner.


```solidity
function getProxyOwner() public view returns (address _owner);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_owner`|`address`|Address of the owner.|


### function

Fallback function performs a delegate call
to the actual implementation address is pointing this proxy.
Returns whatever the implementation call returns.


```solidity
function() external payable;
```

## Events
### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed _oldOwner, address indexed _newOwner);
```

### ImplementationChanged

```solidity
event ImplementationChanged(address indexed _oldImplementation, address indexed _newImplementation);
```

