# LoanTokenLogic
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/modules/beaconLogicLM/LoanTokenLogic.sol)

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


