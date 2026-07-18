# LoanTokenLogicSplit
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/LoanTokenLogicSplit.sol)

**Inherits:**
[LoanTokenLogicShared](/contracts/connectors/loantoken/LoanTokenLogicShared.sol/contract.LoanTokenLogicShared.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized margin
trading and lending https://bzx.network similar to the dYdX protocol.
Logic around loan tokens (iTokens) required to operate borrowing,
and margin trading financial processes.
The user provides funds to the lending pool using the mint function and
withdraws funds from the lending pool using the burn function. Mint and
burn refer to minting and burning loan tokens. Loan tokens represent a
share of the pool and gather interest over time.
Interest rates are determined by supply and demand. When a lender deposits
funds, the interest rates go down. When a trader borrows funds, the
interest rates go up. Fulcrum uses a simple linear interest rate formula
of the form y = mx + b. The interest rate starts at 1% when loans aren't
being utilized and scales up to 40% when all the funds in the loan pool
are being borrowed.
The borrow rate is determined at the time of the loan and represents the
net contribution of each borrower. Each borrower's interest contribution
is determined by the utilization rate of the pool and is netted against
all prior borrows. This means that the total amount of interest flowing
into the lending pool is not directly changed by lenders entering or
exiting the pool. The entrance or exit of lenders only impacts how the
interest payments are split up.
For example, if there are 2 lenders with equal holdings each earning
5% APR, but one of the lenders leave, then the remaining lender will earn
10% APR since the interest payments don't have to be split between two
individuals.


## Functions
### mint

DON'T ADD VARIABLES HERE, PLEASE

Mint loan token wrapper.
Adds a check before calling low level _mintToken function.
The function retrieves the tokens from the message sender, so make sure
to first approve the loan token contract to access your funds. This is
done by calling approve(address spender, uint amount) on the ERC20
token contract, where spender is the loan token contract address and
amount is the amount to be deposited.


```solidity
function mint(address receiver, uint256 depositAmount)
    external
    nonReentrant
    globallyNonReentrant
    returns (uint256 mintAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|The account getting the minted tokens.|
|`depositAmount`|`uint256`|The amount of underlying tokens provided on the loan. (Not the number of loan tokens to mint).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`mintAmount`|`uint256`|The amount of loan tokens minted.|


### burn

Burn loan token wrapper.
Adds a pay-out transfer after calling low level _burnToken function.
In order to withdraw funds to the pool, call burn on the respective
loan token contract. This will burn your loan tokens and send you the
underlying token in exchange.


```solidity
function burn(address receiver, uint256 burnAmount)
    external
    nonReentrant
    globallyNonReentrant
    returns (uint256 loanAmountPaid);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|The account getting the minted tokens.|
|`burnAmount`|`uint256`|The amount of loan tokens to redeem.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loanAmountPaid`|`uint256`|The amount of underlying tokens payed to lender.|


### _mintToken

transfers the underlying asset from the msg.sender and mints tokens for the receiver


```solidity
function _mintToken(address receiver, uint256 depositAmount) internal returns (uint256 mintAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|the address of the iToken receiver|
|`depositAmount`|`uint256`|the amount of underlying assets to be deposited|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`mintAmount`|`uint256`|the amount of iTokens issued|


### _prepareMinting

calculates the amount of tokens to mint and transfers the underlying asset to this contract


```solidity
function _prepareMinting(uint256 depositAmount) internal returns (uint256 mintAmount, uint256 currentPrice);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`depositAmount`|`uint256`|the amount of the underyling asset deposited|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`mintAmount`|`uint256`|the amount to be minted|
|`currentPrice`|`uint256`||


### _burnToken

A wrapper for AdvancedToken::_burn


```solidity
function _burnToken(uint256 burnAmount) internal returns (uint256 loanAmountPaid);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`burnAmount`|`uint256`|The amount of loan tokens to redeem.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loanAmountPaid`|`uint256`|The amount of underlying tokens payed to lender.|


### _mintWithLM


```solidity
function _mintWithLM(address receiver, uint256 depositAmount) internal returns (uint256 minted);
```

### _burnFromLM


```solidity
function _burnFromLM(uint256 burnAmount) internal returns (uint256);
```

