# LoanToken
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/LoanToken.sol)

**Inherits:**
[AdvancedTokenStorage](/contracts/connectors/loantoken/AdvancedTokenStorage.sol/contract.AdvancedTokenStorage.md)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
A loan token (iToken) is created as a proxy to an upgradable token contract.
Examples of loan tokens on Sovryn are iRBTC, iDOC, iUSDT, iBPro,
iSOV (near future).
Lenders receive iTokens that collect interest from the lending pool
which they can redeem by withdrawing them. The i in iToken stands for interest.
Do not confuse iTokens with underlying tokens. iDOC is an iToken (loan token)
whilest DOC is the underlying token (currency).

*TODO: can I change this proxy to EIP-1822 proxy standard, please.
https://eips.ethereum.org/EIPS/eip-1822. It's really hard to work with this.*


## State Variables
### sovrynContractAddress
*It is important to maintain the variables order so the delegate
calls can access sovrynContractAddress and wrbtcTokenAddress*


```solidity
address public sovrynContractAddress;
```


### wrbtcTokenAddress

```solidity
address public wrbtcTokenAddress;
```


### target_

```solidity
address internal target_;
```


### admin

```solidity
address public admin;
```


## Functions
### constructor

Deploy loan token proxy.
Sets ERC20 parameters of the token.


```solidity
constructor(address _newOwner, address _newTarget, address _sovrynContractAddress, address _wrbtcTokenAddress) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newOwner`|`address`|The address of the new owner.|
|`_newTarget`|`address`|The address of the new target contract instance.|
|`_sovrynContractAddress`|`address`|The address of the new sovrynContract instance.|
|`_wrbtcTokenAddress`|`address`|The address of the new wrBTC instance.|


### function

Fallback function performs a delegate call
to the actual implementation address is pointing this proxy.
Returns whatever the implementation call returns.


```solidity
function() external payable;
```

### setTarget

Public owner setter for target address.

*Calls internal setter.*


```solidity
function setTarget(address _newTarget) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newTarget`|`address`|The address of the new target contract instance.|


### _setTarget

Internal setter for target address.


```solidity
function _setTarget(address _newTarget) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newTarget`|`address`|The address of the new target contract instance.|


### _setSovrynContractAddress

Internal setter for sovrynContract address.


```solidity
function _setSovrynContractAddress(address _sovrynContractAddress) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_sovrynContractAddress`|`address`|The address of the new sovrynContract instance.|


### _setWrbtcTokenAddress

Internal setter for wrBTC address.


```solidity
function _setWrbtcTokenAddress(address _wrbtcTokenAddress) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_wrbtcTokenAddress`|`address`|The address of the new wrBTC instance.|


### initialize

Public owner cloner for pointed loan token.
Sets ERC20 parameters of the token.

*TODO: add check for double init.
idk but init usually can be called only once.*


```solidity
function initialize(address _loanTokenAddress, string memory _name, string memory _symbol) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_loanTokenAddress`|`address`|The address of the pointed loan token instance.|
|`_name`|`string`|The ERC20 token name.|
|`_symbol`|`string`|The ERC20 token symbol.|


