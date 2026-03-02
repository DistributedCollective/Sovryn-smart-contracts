# VaultController
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/mixins/VaultController.sol)

**Inherits:**
[State](/contracts/core/State.sol/contract.State.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized margin
trading and lending https://bzx.network similar to the dYdX protocol.
This contract implements functionality to deposit and withdraw wrBTC and
other tokens from the vault.


## Functions
### vaultEtherDeposit

Deposit wrBTC into the vault.


```solidity
function vaultEtherDeposit(address from, uint256 value) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`from`|`address`|The address of the account paying the deposit.|
|`value`|`uint256`|The amount of wrBTC tokens to transfer.|


### vaultEtherWithdraw

Withdraw wrBTC from the vault.


```solidity
function vaultEtherWithdraw(address to, uint256 value) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`to`|`address`|The address of the recipient.|
|`value`|`uint256`|The amount of wrBTC tokens to transfer.|


### vaultDeposit

Deposit tokens into the vault.


```solidity
function vaultDeposit(address token, address from, uint256 value) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|The address of the token instance.|
|`from`|`address`|The address of the account paying the deposit.|
|`value`|`uint256`|The amount of tokens to transfer.|


### vaultWithdraw

Withdraw tokens from the vault.


```solidity
function vaultWithdraw(address token, address to, uint256 value) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|The address of the token instance.|
|`to`|`address`|The address of the recipient.|
|`value`|`uint256`|The amount of tokens to transfer.|


### vaultTransfer

Transfer tokens from an account into another one.


```solidity
function vaultTransfer(address token, address from, address to, uint256 value) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|The address of the token instance.|
|`from`|`address`|The address of the account paying.|
|`to`|`address`|The address of the recipient.|
|`value`|`uint256`|The amount of tokens to transfer.|


### vaultApprove

Approve an allowance of tokens to be spent by an account.


```solidity
function vaultApprove(address token, address to, uint256 value) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|The address of the token instance.|
|`to`|`address`|The address of the spender.|
|`value`|`uint256`|The amount of tokens to allow.|


## Events
### VaultDeposit

```solidity
event VaultDeposit(address indexed asset, address indexed from, uint256 amount);
```

### VaultWithdraw

```solidity
event VaultWithdraw(address indexed asset, address indexed to, uint256 amount);
```

