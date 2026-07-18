# ErrorDecoder
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/ErrorDecoder.sol)

*On EVM if the return data length of a call is less than 68,
then the transaction fails silently without a revert message!
As described in the Solidity documentation
https://solidity.readthedocs.io/en/v0.5.17/control-structures.html#revert
the revert reason is an ABI-encoded string consisting of:
0x08c379a0 // Function selector (method id) for "Error(string)" signature
0x0000000000000000000000000000000000000000000000000000000000000020 // Data offset
0x000000000000000000000000000000000000000000000000000000000000001a // String length
0x4e6f7420656e6f7567682045746865722070726f76696465642e000000000000 // String data
Another example, debug data from test:
0x08c379a0
0000000000000000000000000000000000000000000000000000000000000020
0000000000000000000000000000000000000000000000000000000000000034
54696d656c6f636b3a3a73657444656c61793a2044656c6179206d7573742065
7863656564206d696e696d756d2064656c61792e000000000000000000000000
Parsed into:
Data offset: 20
Length: 34
Error message:
54696d656c6f636b3a3a73657444656c61793a2044656c6179206d7573742065
7863656564206d696e696d756d2064656c61792e000000000000000000000000*


## State Variables
### ERROR_MESSAGE_SHIFT

```solidity
uint256 constant ERROR_MESSAGE_SHIFT = 68;
```


## Functions
### _addErrorMessage

Concats two error strings taking into account ERROR_MESSAGE_SHIFT.


```solidity
function _addErrorMessage(string memory str1, string memory str2) internal pure returns (string memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`str1`|`string`|First string, usually a hardcoded context written by dev.|
|`str2`|`string`|Second string, usually the error message from the reverted call.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`string`|The concatenated error string|


