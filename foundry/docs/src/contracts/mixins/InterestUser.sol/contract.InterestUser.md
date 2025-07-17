# InterestUser
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/mixins/InterestUser.sol)

**Inherits:**
[VaultController](/contracts/mixins/VaultController.sol/contract.VaultController.md), [FeesHelper](/contracts/mixins/FeesHelper.sol/contract.FeesHelper.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.


## Functions
### _payInterest

Internal function to pay interest of a loan.

*Calls _payInterestTransfer internal function to transfer tokens.*


```solidity
function _payInterest(address lender, address interestToken) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lender`|`address`|The account address of the lender.|
|`interestToken`|`address`|The token address to pay interest with.|


### _payInterestTransfer

Internal function to transfer tokens for the interest of a loan.


```solidity
function _payInterestTransfer(address lender, address interestToken, uint256 interestOwedNow) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lender`|`address`|The account address of the lender.|
|`interestToken`|`address`|The token address to pay interest with.|
|`interestOwedNow`|`uint256`|The amount of interest to pay.|


## Events
### PayInterestTransfer
Triggered whenever interest is paid to lender.


```solidity
event PayInterestTransfer(address indexed interestToken, address indexed lender, uint256 effectiveInterest);
```

