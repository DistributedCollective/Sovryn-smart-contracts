# UpgradableProxy
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/proxy/UpgradableProxy.sol)

**Inherits:**
[Proxy](/contracts/proxy/Proxy.sol/contract.Proxy.md)

A disadvantage of the immutable ledger is that nobody can change the
source code of a smart contract after it’s been deployed. In order to fix
bugs or introduce new features, smart contracts need to be upgradable somehow.
Although it is not possible to upgrade the code of an already deployed smart
contract, it is possible to set-up a proxy contract architecture that will
allow to use new deployed contracts as if the main logic had been upgraded.
A proxy architecture pattern is such that all message calls go through a
Proxy contract that will redirect them to the latest deployed contract logic.
To upgrade, a new version of the contract is deployed, and the Proxy is
updated to reference the new contract address.


## Functions
### setImplementation

Set address of the implementation.

*Wrapper for _setImplementation that exposes the function
as public for owner to be able to set a new version of the
contract as current pointing implementation.*


```solidity
function setImplementation(address _implementation) public onlyProxyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_implementation`|`address`|Address of the implementation.|


### setProxyOwner

Set address of the owner.


```solidity
function setProxyOwner(address _owner) public onlyProxyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_owner`|`address`|Address of the owner.|


