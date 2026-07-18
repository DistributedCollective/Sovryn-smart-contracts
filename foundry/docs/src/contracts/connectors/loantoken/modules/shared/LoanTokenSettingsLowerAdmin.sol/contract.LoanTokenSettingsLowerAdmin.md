# LoanTokenSettingsLowerAdmin
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/modules/shared/LoanTokenSettingsLowerAdmin.sol)

**Inherits:**
[LoanTokenLogicStorage](/contracts/connectors/loantoken/LoanTokenLogicStorage.sol/contract.LoanTokenLogicStorage.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.


## Functions
### onlyAdmin

*TODO: Check for restrictions in this contract.*


```solidity
modifier onlyAdmin();
```

### getListFunctionSignatures

This function is MANDATORY, which will be called by LoanTokenLogicBeacon and be registered.
Every new public function, the signature needs to be included in this function.

*This function will return the list of function signature in this contract that are available for public call
Then this function will be called by LoanTokenLogicBeacon, and the function signatures will be registred in LoanTokenLogicBeacon.*

*To save the gas we can just directly return the list of function signature from this pure function.
The other workaround (fancy way) is we can create a storage for the list of the function signature, and then we can store each function signature to that storage from the constructor.
Then, in this function we just need to return that storage variable.*


```solidity
function getListFunctionSignatures() external pure returns (bytes4[] memory functionSignatures, bytes32 moduleName);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`functionSignatures`|`bytes4[]`|The list of function signatures (bytes4[])|
|`moduleName`|`bytes32`||


### setAdmin

Set admin account.


```solidity
function setAdmin(address _admin) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_admin`|`address`|The address of the account to grant admin permissions.|


### setPauser

Set pauser account.


```solidity
function setPauser(address _pauser) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_pauser`|`address`|The address of the account to grant pause permissions.|


### function

Fallback function not allowed


```solidity
function() external;
```

### setupLoanParams

Set loan token parameters.


```solidity
function setupLoanParams(LoanParamsStruct.LoanParams[] memory loanParamsList, bool areTorqueLoans) public onlyAdmin;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanParamsList`|`LoanParamsStruct.LoanParams[]`|The array of loan parameters.|
|`areTorqueLoans`|`bool`|Whether the loan is a torque loan.|


### disableLoanParams

isTorqueLoan

Disable loan token parameters.


```solidity
function disableLoanParams(address[] calldata collateralTokens, bool[] calldata isTorqueLoans) external onlyAdmin;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`collateralTokens`|`address[]`|The array of collateral tokens.|
|`isTorqueLoans`|`bool[]`|Whether the loan is a torque loan.|


### setDemandCurve

Set loan token parameters about the demand curve.

*These params should be percentages represented
like so: 5% = 5000000000000000000 /// 18 digits precision.
rateMultiplier + baseRate can't exceed 100%
To maintain a healthy credit score, it's important to keep your
credit utilization rate (CUR) low (_lowUtilBaseRate). In general
you don't want your CUR to exceed 30%, but increasingly financial
experts are recommending that you don't want to go above 10% if you
really want an excellent credit score.
Interest rates tend to cluster around the kink level of a kinked
interest rate model. More info at https://arxiv.org/pdf/2006.13922.pdf
and https://compound.finance/governance/proposals/12*


```solidity
function setDemandCurve(
    uint256 _baseRate,
    uint256 _rateMultiplier,
    uint256 _lowUtilBaseRate,
    uint256 _lowUtilRateMultiplier,
    uint256 _targetLevel,
    uint256 _kinkLevel,
    uint256 _maxScaleRate
) public onlyAdmin;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_baseRate`|`uint256`|The interest rate.|
|`_rateMultiplier`|`uint256`|The precision multiplier for base rate.|
|`_lowUtilBaseRate`|`uint256`|The credit utilization rate (CUR) low value.|
|`_lowUtilRateMultiplier`|`uint256`|The precision multiplier for low util base rate.|
|`_targetLevel`|`uint256`|The target level.|
|`_kinkLevel`|`uint256`|The level that interest rates cluster on kinked model.|
|`_maxScaleRate`|`uint256`|The maximum rate of the scale.|


### toggleFunctionPause

80 ether
90 ether
100 ether

Set the pause flag for a function to true or false.

*Combining the hash of "iToken_FunctionPause" string and a function
selector gets a slot to write a flag for pause state.*


```solidity
function toggleFunctionPause(string memory funcId, bool isPaused) public onlyPauserOrOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`funcId`|`string`|The ID of a function, the selector.|
|`isPaused`|`bool`|true/false value of the flag.|


### setTransactionLimits

keccak256("iToken_FunctionPause")
Set the transaction limit per token address.


```solidity
function setTransactionLimits(address[] memory addresses, uint256[] memory limits) public onlyAdmin;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`addresses`|`address[]`|The token addresses.|
|`limits`|`uint256[]`|The limit denominated in the currency of the token address.|


### changeLoanTokenNameAndSymbol

Update the loan token parameters.


```solidity
function changeLoanTokenNameAndSymbol(string memory _name, string memory _symbol) public onlyAdmin;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_name`|`string`|The new name of the loan token.|
|`_symbol`|`string`|The new symbol of the loan token.|


### withdrawRBTCTo

Withdraws RBTC from the contract by Multisig.


```solidity
function withdrawRBTCTo(address payable _receiverAddress, uint256 _amount) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_receiverAddress`|`address payable`|The address where the rBTC has to be transferred.|
|`_amount`|`uint256`|The amount of rBTC to be transferred.|


### setLiquidityMiningAddress

sets the liquidity mining contract address


```solidity
function setLiquidityMiningAddress(address LMAddress) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`LMAddress`|`address`|the address of the liquidity mining contract|


### getLiquidityMiningAddress

We need separate getter for newly added storage variable

Getter for liquidityMiningAddress


```solidity
function getLiquidityMiningAddress() public view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|liquidityMiningAddress|


### setStakingContractAddress

sets the staking contract address


```solidity
function setStakingContractAddress(address _stakingContractAddress) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_stakingContractAddress`|`address`|the address of the staking contract|


### getStakingContractAddress

We need separate getter for newly added storage variable

Getter for stakingContractAddress


```solidity
function getStakingContractAddress() public view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|stakingContractAddress|


### checkPause

Check whether a function is paused.

*Used to read externally from the smart contract to see if a
function is paused.*


```solidity
function checkPause(string memory funcId) public view returns (bool isPaused);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`funcId`|`string`|The function ID, the selector.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`isPaused`|`bool`|Whether the function is paused: true or false.|


## Events
### SetTransactionLimits

```solidity
event SetTransactionLimits(address[] addresses, uint256[] limits);
```

### ToggledFunctionPaused

```solidity
event ToggledFunctionPaused(string functionId, bool prevFlag, bool newFlag);
```

### WithdrawRBTCTo

```solidity
event WithdrawRBTCTo(address indexed to, uint256 amount);
```

