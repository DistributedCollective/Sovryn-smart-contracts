# ApprovalReceiver
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/ApprovalReceiver.sol)

**Inherits:**
[ErrorDecoder](/contracts/governance/ErrorDecoder.sol/contract.ErrorDecoder.md), [IApproveAndCall](/contracts/token/IApproveAndCall.sol/interface.IApproveAndCall.md)


## Functions
### onlyThisContract


```solidity
modifier onlyThisContract();
```

### receiveApproval

Receives approval from SOV token.


```solidity
function receiveApproval(address _sender, uint256 _amount, address _token, bytes calldata _data) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_sender`|`address`||
|`_amount`|`uint256`||
|`_token`|`address`||
|`_data`|`bytes`|The data will be used for low level call.|


### _getToken

Returns token address, only this address can be a sender for receiveApproval.

*Should be overridden in child contracts, otherwise error will be thrown.*


```solidity
function _getToken() internal view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|By default, 0x. When overriden, the token address making the call.|


### _getSelectors

Returns list of function selectors allowed to be invoked.

*Should be overridden in child contracts, otherwise error will be thrown.*


```solidity
function _getSelectors() internal pure returns (bytes4[] memory);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes4[]`|By default, empty array. When overriden, allowed selectors.|


### _call

Makes call and reverts w/ enhanced error message.


```solidity
function _call(bytes memory _data) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_data`|`bytes`|Error message as bytes.|


### _getSig

Extracts the called function selector, a hash of the signature.

*The first four bytes of the call data for a function call specifies
the function to be called. It is the first (left, high-order in big-endian)
four bytes of the Keccak-256 (SHA-3) hash of the signature of the function.
Solidity doesn't yet support a casting of byte[4] to bytes4.
Example:
msg.data:
0xcdcd77c000000000000000000000000000000000000000000000000000000000000
000450000000000000000000000000000000000000000000000000000000000000001
selector (or method ID): 0xcdcd77c0
signature: baz(uint32,bool)*


```solidity
function _getSig(bytes memory _data) internal pure returns (bytes4 sig);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_data`|`bytes`|The msg.data from the low level call.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`sig`|`bytes4`|First 4 bytes of msg.data i.e. the selector, hash of the signature.|


