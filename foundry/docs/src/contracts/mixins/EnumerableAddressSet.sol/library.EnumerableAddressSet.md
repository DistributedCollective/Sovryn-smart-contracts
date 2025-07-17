# EnumerableAddressSet
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/mixins/EnumerableAddressSet.sol)

*Based on Library for managing
https://en.wikipedia.org/wiki/Set_(abstract_data_type)[sets] of primitive
types.
Sets have the following properties:
- Elements are added, removed, and checked for existence in constant time
(O(1)).
- Elements are enumerated in O(n). No guarantees are made on the ordering.
As of v2.5.0, only `address` sets are supported.
Include with `using EnumerableSet for EnumerableSet.AddressSet;`.
_Available since v2.5.0._*


## Functions
### add

*Add a value to a set. O(1).
Returns false if the value was already in the set.*


```solidity
function add(AddressSet storage set, address value) internal returns (bool);
```

### remove

*Removes a value from a set. O(1).
Returns false if the value was not present in the set.*


```solidity
function remove(AddressSet storage set, address value) internal returns (bool);
```

### contains

*Returns true if the value is in the set. O(1).*


```solidity
function contains(AddressSet storage set, address value) internal view returns (bool);
```

### enumerate

*Returns an array with all values in the set. O(N).
Note that there are no guarantees on the ordering of values inside the
array, and it may change when more values are added or removed.
WARNING: This function may run out of gas on large sets: use [length](/contracts/mixins/EnumerableAddressSet.sol/library.EnumerableAddressSet.md#length) and
{get} instead in these cases.*


```solidity
function enumerate(AddressSet storage set) internal view returns (address[] memory);
```

### enumerateChunk

*Returns a chunk of array as recommended in enumerate() to avoid running of gas.
Note that there are no guarantees on the ordering of values inside the
array, and it may change when more values are added or removed.
WARNING: This function may run out of gas on large sets: use [length](/contracts/mixins/EnumerableAddressSet.sol/library.EnumerableAddressSet.md#length) and
{get} instead in these cases.*


```solidity
function enumerateChunk(AddressSet storage set, uint256 start, uint256 count)
    internal
    view
    returns (address[] memory output);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`set`|`AddressSet`||
|`start`|`uint256`|start index of chunk|
|`count`|`uint256`|num of element to return; if count == 0 then returns all the elements from the @param start|


### length

*Returns the number of elements on the set. O(1).*


```solidity
function length(AddressSet storage set) internal view returns (uint256);
```

### get

*Returns the element stored at position `index` in the set. O(1).
Note that there are no guarantees on the ordering of values inside the
array, and it may change when more values are added or removed.
Requirements:
- `index` must be strictly less than [length](/contracts/mixins/EnumerableAddressSet.sol/library.EnumerableAddressSet.md#length).*


```solidity
function get(AddressSet storage set, uint256 index) internal view returns (address);
```

## Structs
### AddressSet

```solidity
struct AddressSet {
    mapping(address => uint256) index;
    address[] values;
}
```

