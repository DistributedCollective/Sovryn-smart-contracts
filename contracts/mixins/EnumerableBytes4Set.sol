/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

/**
 * @title Library for managing loan sets.
 *
 * @notice Sets have the following properties:
 *
 * - Elements are added, removed, and checked for existence in constant time
 * (O(1)).
 * - Elements are enumerated in O(n). No guarantees are made on the ordering.
 *
 * Include with `using EnumerableBytes4Set for EnumerableBytes4Set.Bytes4Set;`.
 * */
library EnumerableBytes4Set {
	struct Bytes4Set {
		/// Position of the value in the `values` array, plus 1 because index 0
		/// means a value is not in the set.
		mapping(bytes4 => uint256) index;
		bytes4[] values;
	}

	/**
	 * @notice Add an address value to a set. O(1).
	 *
	 * @param set The set of values.
	 * @param addrvalue The address to add.
	 *
	 * @return False if the value was already in the set.
	 */
	function addAddress(Bytes4Set storage set, address addrvalue) internal returns (bool) {
		bytes4 value;
		assembly {
			value := addrvalue
		}
		return addBytes4(set, value);
	}

	/**
	 * @notice Add a value to a set. O(1).
	 *
	 * @param set The set of values.
	 * @param value The new value to add.
	 *
	 * @return False if the value was already in the set.
	 */
	function addBytes4(Bytes4Set storage set, bytes4 value) internal returns (bool) {
		if (!contains(set, value)) {
			set.index[value] = set.values.push(value);
			return true;
		} else {
			return false;
		}
	}

	/**
	 * @notice Remove an address value from a set. O(1).
	 *
	 * @param set The set of values.
	 * @param addrvalue The address to remove.
	 *
	 * @return False if the address was not present in the set.
	 */
	function removeAddress(Bytes4Set storage set, address addrvalue) internal returns (bool) {
		bytes4 value;
		assembly {
			value := addrvalue
		}
		return removeBytes4(set, value);
	}

	/**
	 * @notice Remove a value from a set. O(1).
	 *
	 * @param set The set of values.
	 * @param value The value to remove.
	 *
	 * @return False if the value was not present in the set.
	 */
	function removeBytes4(Bytes4Set storage set, bytes4 value) internal returns (bool) {
		if (contains(set, value)) {
			uint256 toDeleteIndex = set.index[value] - 1;
			uint256 lastIndex = set.values.length - 1;

			/// If the element we're deleting is the last one,
			/// we can just remove it without doing a swap.
			if (lastIndex != toDeleteIndex) {
				bytes4 lastValue = set.values[lastIndex];

				/// Move the last value to the index where the deleted value is.
				set.values[toDeleteIndex] = lastValue;

				/// Update the index for the moved value.
				set.index[lastValue] = toDeleteIndex + 1; // All indexes are 1-based
			}

			/// Delete the index entry for the deleted value.
			delete set.index[value];

			/// Delete the old entry for the moved value.
			set.values.pop();

			return true;
		} else {
			return false;
		}
	}

	/**
	 * @notice Find out whether a value exists in the set.
	 *
	 * @param set The set of values.
	 * @param value The value to find.
	 *
	 * @return True if the value is in the set. O(1).
	 */
	function contains(Bytes4Set storage set, bytes4 value) internal view returns (bool) {
		return set.index[value] != 0;
	}

	/**
	 * @dev Returns true if the value is in the set. O(1).
	 */
	function containsAddress(Bytes4Set storage set, address addrvalue) internal view returns (bool) {
		bytes4 value;
		assembly {
			value := addrvalue
		}
		return set.index[value] != 0;
	}

	/**
	 * @notice Get all set values.
	 *
	 * @param set The set of values.
	 * @param start The offset of the returning set.
	 * @param count The limit of number of values to return.
	 *
	 * @return An array with all values in the set. O(N).
	 *
	 * @dev Note that there are no guarantees on the ordering of values inside the
	 * array, and it may change when more values are added or removed.
	 *
	 * WARNING: This function may run out of gas on large sets: use {length} and
	 * {get} instead in these cases.
	 */
	function enumerate(
		Bytes4Set storage set,
		uint256 start,
		uint256 count
	) internal view returns (bytes4[] memory output) {
		uint256 end = start + count;
		require(end >= start, "addition overflow");
		end = set.values.length < end ? set.values.length : end;
		if (end == 0 || start >= end) {
			return output;
		}

		output = new bytes4[](end - start);
		for (uint256 i; i < end - start; i++) {
			output[i] = set.values[i + start];
		}
		return output;
	}

	/**
	 * @notice Get the legth of the set.
	 *
	 * @param set The set of values.
	 *
	 * @return the number of elements on the set. O(1).
	 */
	function length(Bytes4Set storage set) internal view returns (uint256) {
		return set.values.length;
	}

	/**
	 * @notice Get an item from the set by its index.
	 *
	 * @dev Note that there are no guarantees on the ordering of values inside the
	 * array, and it may change when more values are added or removed.
	 *
	 * Requirements:
	 *
	 * - `index` must be strictly less than {length}.
	 *
	 * @param set The set of values.
	 * @param index The index of the value to return.
	 *
	 * @return the element stored at position `index` in the set. O(1).
	 */
	function get(Bytes4Set storage set, uint256 index) internal view returns (bytes4) {
		return set.values[index];
	}
}
