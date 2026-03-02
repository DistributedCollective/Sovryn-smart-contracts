# AdvancedTokenStorage
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/AdvancedTokenStorage.sol)

**Inherits:**
[LoanTokenBase](/contracts/connectors/loantoken/LoanTokenBase.sol/contract.LoanTokenBase.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
AdvancedTokenStorage implements standard ERC-20 getters functionality:
totalSupply, balanceOf, allowance and some events.
iToken logic is divided into several contracts AdvancedToken,
AdvancedTokenStorage and LoanTokenBase.


## State Variables
### balances

```solidity
mapping(address => uint256) internal balances;
```


### allowed

```solidity
mapping(address => mapping(address => uint256)) internal allowed;
```


### totalSupply_

```solidity
uint256 internal totalSupply_;
```


## Functions
### totalSupply

Get the total supply of iTokens.


```solidity
function totalSupply() public view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The total number of iTokens in existence as of now.|


### balanceOf

Get the amount of iTokens owned by an account.


```solidity
function balanceOf(address _owner) public view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_owner`|`address`|The account owner of the iTokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The number of iTokens an account owns.|


### allowance

Get the amount of iTokens allowed to be spent by a
given account on behalf of the owner.


```solidity
function allowance(address _owner, address _spender) public view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_owner`|`address`|The account owner of the iTokens.|
|`_spender`|`address`|The account allowed to send the iTokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The number of iTokens an account is allowing the spender to send on its behalf.|


## Events
### Transfer
topic: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef


```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

### Approval
topic: 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925


```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```

### AllowanceUpdate
topic: 0x628e75c63c1873bcd3885f7aee9f58ee36f60dc789b2a6b3a978c4189bc548ba


```solidity
event AllowanceUpdate(address indexed owner, address indexed spender, uint256 valueBefore, uint256 valueAfter);
```

### Mint
topic: 0xb4c03061fb5b7fed76389d5af8f2e0ddb09f8c70d1333abbb62582835e10accb


```solidity
event Mint(address indexed minter, uint256 tokenAmount, uint256 assetAmount, uint256 price);
```

### Burn
topic: 0x743033787f4738ff4d6a7225ce2bd0977ee5f86b91a902a58f5e4d0b297b4644


```solidity
event Burn(address indexed burner, uint256 tokenAmount, uint256 assetAmount, uint256 price);
```

### FlashBorrow
topic: 0xc688ff9bd4a1c369dd44c5cf64efa9db6652fb6b280aa765cd43f17d256b816e


```solidity
event FlashBorrow(address borrower, address target, address loanToken, uint256 loanAmount);
```

