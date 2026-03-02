# SafeMath96
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Staking/SafeMath96.sol)

Improved Solidity's arithmetic operations with added overflow checks.

*SafeMath96 uses uint96, unsigned integers of 96 bits length, so every
integer from 0 to 2^96-1 can be operated.
Arithmetic operations in Solidity wrap on overflow. This can easily result
in bugs, because programmers usually assume that an overflow raises an
error, which is the standard behavior in high level programming languages.
SafeMath restores this intuition by reverting the transaction when an
operation overflows.
Using this contract instead of the unchecked operations eliminates an entire
class of bugs, so it's recommended to use it always.*


## Functions
### safe32


```solidity
function safe32(uint256 n, string memory errorMessage) internal pure returns (uint32);
```

### safe64


```solidity
function safe64(uint256 n, string memory errorMessage) internal pure returns (uint64);
```

### safe96


```solidity
function safe96(uint256 n, string memory errorMessage) internal pure returns (uint96);
```

### add96

Adds two unsigned integers, reverting on overflow.

*Counterpart to Solidity's `+` operator.*


```solidity
function add96(uint96 a, uint96 b, string memory errorMessage) internal pure returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`a`|`uint96`|First integer.|
|`b`|`uint96`|Second integer.|
|`errorMessage`|`string`|The revert message on overflow.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The safe addition a+b.|


### sub96

Substracts two unsigned integers, reverting on underflow.

*Counterpart to Solidity's `-` operator.*


```solidity
function sub96(uint96 a, uint96 b, string memory errorMessage) internal pure returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`a`|`uint96`|First integer.|
|`b`|`uint96`|Second integer.|
|`errorMessage`|`string`|The revert message on underflow.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The safe substraction a-b.|


### mul96

Multiplies two unsigned integers, reverting on overflow.

*Counterpart to Solidity's `*` operator.*


```solidity
function mul96(uint96 a, uint96 b, string memory errorMessage) internal pure returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`a`|`uint96`|First integer.|
|`b`|`uint96`|Second integer.|
|`errorMessage`|`string`|The revert message on overflow.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The safe product a*b.|


### div96

Divides two unsigned integers, reverting on overflow.

*Counterpart to Solidity's `/` operator.*


```solidity
function div96(uint96 a, uint96 b, string memory errorMessage) internal pure returns (uint96);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`a`|`uint96`|First integer.|
|`b`|`uint96`|Second integer.|
|`errorMessage`|`string`|The revert message on overflow.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint96`|The safe division a/b.|


