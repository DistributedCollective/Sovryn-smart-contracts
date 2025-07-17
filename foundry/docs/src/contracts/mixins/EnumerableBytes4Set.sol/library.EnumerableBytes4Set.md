# EnumerableBytes4Set
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/mixins/EnumerableBytes4Set.sol)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

Sets have the following properties:
- Elements are added, removed, and checked for existence in constant time
(O(1)).
- Elements are enumerated in O(n). No guarantees are made on the ordering.
Include with `using EnumerableBytes4Set for EnumerableBytes4Set.Bytes4Set;`.


## Functions
### addBytes4

Add a value to a set. O(1).


```solidity
function addBytes4(Bytes4Set storage set, bytes4 value) internal returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`set`|`Bytes4Set`|The set of values.|
|`value`|`bytes4`|The new value to add.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|False if the value was already in the set.|


### removeBytes4

Remove a value from a set. O(1).


```solidity
function removeBytes4(Bytes4Set storage set, bytes4 value) internal returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`set`|`Bytes4Set`|The set of values.|
|`value`|`bytes4`|The value to remove.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|False if the value was not present in the set.|


### contains

If the element we're deleting is the last one,
we can just remove it without doing a swap.
Move the last value to the index where the deleted value is.
Update the index for the moved value.
Delete the index entry for the deleted value.
Delete the old entry for the moved value.

Find out whether a value exists in the set.


```solidity
function contains(Bytes4Set storage set, bytes4 value) internal view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`set`|`Bytes4Set`|The set of values.|
|`value`|`bytes4`|The value to find.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|True if the value is in the set. O(1).|


### enumerate

Get all set values.

*Note that there are no guarantees on the ordering of values inside the
array, and it may change when more values are added or removed.
WARNING: This function may run out of gas on large sets: use [length](/contracts/mixins/EnumerableBytes4Set.sol/library.EnumerableBytes4Set.md#length) and
{get} instead in these cases.*


```solidity
function enumerate(Bytes4Set storage set, uint256 start, uint256 count)
    internal
    view
    returns (bytes4[] memory output);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`set`|`Bytes4Set`|The set of values.|
|`start`|`uint256`|The offset of the returning set.|
|`count`|`uint256`|The limit of number of values to return.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`output`|`bytes4[]`|An array with all values in the set. O(N).|


### length

Get the legth of the set.


```solidity
function length(Bytes4Set storage set) internal view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`set`|`Bytes4Set`|The set of values.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|the number of elements on the set. O(1).|


### get

Get an item from the set by its index.

*Note that there are no guarantees on the ordering of values inside the
array, and it may change when more values are added or removed.
Requirements:
- `index` must be strictly less than [length](/contracts/mixins/EnumerableBytes4Set.sol/library.EnumerableBytes4Set.md#length).*


```solidity
function get(Bytes4Set storage set, uint256 index) internal view returns (bytes4);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`set`|`Bytes4Set`|The set of values.|
|`index`|`uint256`|The index of the value to return.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes4`|the element stored at position `index` in the set. O(1).|


## Structs
### Bytes4Set

```solidity
struct Bytes4Set {
    mapping(bytes4 => uint256) index;
    bytes4[] values;
}
```

