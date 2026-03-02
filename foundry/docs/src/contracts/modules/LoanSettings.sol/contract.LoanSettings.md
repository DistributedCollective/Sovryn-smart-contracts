# LoanSettings
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/modules/LoanSettings.sol)

**Inherits:**
[State](/contracts/core/State.sol/contract.State.md), [LoanSettingsEvents](/contracts/events/LoanSettingsEvents.sol/contract.LoanSettingsEvents.md), [ModuleCommonFunctionalities](/contracts/mixins/ModuleCommonFunctionalities.sol/contract.ModuleCommonFunctionalities.md)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains functions to get and set loan parameters.


## Functions
### constructor

Empty public constructor.


```solidity
constructor() public;
```

### function

Fallback function is to react to receiving value (rBTC).


```solidity
function() external;
```

### initialize

Set function selectors on target contract.


```solidity
function initialize(address target) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`target`|`address`|The address of the target contract.|


### setupLoanParams

Setup loan parameters, by looping every loan
and populating its parameters.

*For each loan calls _setupLoanParams internal function.*


```solidity
function setupLoanParams(LoanParams[] calldata loanParamsList)
    external
    whenNotPaused
    returns (bytes32[] memory loanParamsIdList);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanParamsList`|`LoanParams[]`|The array of loan parameters.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loanParamsIdList`|`bytes32[]`|The array of loan parameters IDs.|


### disableLoanParams

Deactivate LoanParams for future loans. Active loans
using it are unaffected.


```solidity
function disableLoanParams(bytes32[] calldata loanParamsIdList) external whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanParamsIdList`|`bytes32[]`|The array of loan parameters IDs to deactivate.|


### getLoanParams

Get loan parameters for every matching IDs.


```solidity
function getLoanParams(bytes32[] memory loanParamsIdList) public view returns (LoanParams[] memory loanParamsList);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanParamsIdList`|`bytes32[]`|The array of loan parameters IDs to match.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loanParamsList`|`LoanParams[]`|The result array of loan parameters.|


### getLoanParamsList

Get loan parameters for an owner and a given page
defined by an offset and a limit.


```solidity
function getLoanParamsList(address owner, uint256 start, uint256 count)
    external
    view
    returns (bytes32[] memory loanParamsList);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`owner`|`address`|The address of the loan owner.|
|`start`|`uint256`|The page offset.|
|`count`|`uint256`|The page limit.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`loanParamsList`|`bytes32[]`|The result array of loan parameters.|


### getTotalPrincipal

Get the total principal of the loans by a lender.


```solidity
function getTotalPrincipal(address lender, address loanToken) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lender`|`address`|The address of the lender.|
|`loanToken`|`address`|The address of the token instance.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The total principal of the loans.|


### _setupLoanParams

Setup a loan parameters.


```solidity
function _setupLoanParams(LoanParams memory loanParamsLocal) internal returns (bytes32);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanParamsLocal`|`LoanParams`|The loan parameters.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes32`|loanParamsId The loan parameters ID.|


### minInitialMargin

A defined maxLoanTerm has to be greater than one hour.


```solidity
function minInitialMargin(bytes32 loanParamsId) external view returns (uint256);
```

