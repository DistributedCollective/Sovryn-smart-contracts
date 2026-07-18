# LoanTokenLogicWrbtc
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/modules/beaconLogicWRBTC/LoanTokenLogicWrbtc.sol)

**Inherits:**
[LoanTokenLogicStandard](/contracts/connectors/loantoken/LoanTokenLogicStandard.sol/contract.LoanTokenLogicStandard.md)


## Functions
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


### _verifyTransfers

Handle transfers prior to adding newPrincipal to loanTokenSent.

*internal override functions*

*Put all of internal override function dedicated to the loanTokenWrtbc module here
e.g: _verifyTransfers will override the implementation of _verifyTransfers in loanTokenLogicSplit*


```solidity
function _verifyTransfers(
    address collateralTokenAddress,
    MarginTradeStructHelpers.SentAddresses memory sentAddresses,
    MarginTradeStructHelpers.SentAmounts memory sentAmounts,
    uint256 withdrawalAmount
) internal returns (uint256 msgValue);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`collateralTokenAddress`|`address`|The address of the collateral token.|
|`sentAddresses`|`MarginTradeStructHelpers.SentAddresses`|The struct which contains addresses of - lender - borrower - receiver - manager|
|`sentAmounts`|`MarginTradeStructHelpers.SentAmounts`|The struct which contains uint256 of: - interestRate - newPrincipal - interestInitialAmount - loanTokenSent - collateralTokenSent|
|`withdrawalAmount`|`uint256`|The amount to withdraw.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`msgValue`|`uint256`|The amount of value sent.|


