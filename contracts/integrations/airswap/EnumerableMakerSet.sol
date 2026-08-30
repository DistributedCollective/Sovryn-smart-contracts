pragma solidity ^0.5.0;

import "./IAirswapFeeConnector.sol";
/**
 * @dev Based on Library for managing
 * https://en.wikipedia.org/wiki/Set_(abstract_data_type)[sets] of primitive
 * types.
 *
 * Sets have the following properties:
 *
 * - Elements are added, removed, and checked for existence in constant time
 * (O(1)).
 * - Elements are enumerated in O(n). No guarantees are made on the ordering.
 *
 *
 * Include with `using EnumerableSet for EnumerableSet.AddressSet;`.
 *
 * _Available since v2.5.0._
 */
library EnumerableMakerSet {
    struct MakerSet {
        // Position of the value in the `values` array, plus 1 because index 0
        // means a value is not in the set.
        mapping(address => uint256) index;
        IAirswapFeeConnector.Maker[] values;
    }

    /**
     * @dev Add a value to a set. O(1).
     * Returns false if the value was already in the set.
     */
    function add(MakerSet storage set, IAirswapFeeConnector.Maker memory value) internal returns (bool) {
        if (!contains(set, value.signer)) {
            set.index[value.signer] = set.values.push(value);
            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Removes a value from a set. O(1).
     * Returns false if the value was not present in the set.
     */
    function remove(MakerSet storage set, IAirswapFeeConnector.Maker memory value) internal returns (bool) {
        if (contains(set, value.signer)) {
            uint256 toDeleteIndex = set.index[value.signer] - 1;
            uint256 lastIndex = set.values.length - 1;

            // If the element we're deleting is the last one, we can just remove it without doing a swap
            if (lastIndex != toDeleteIndex) {
                IAirswapFeeConnector.Maker memory lastValue = set.values[lastIndex];

                // Move the last value to the index where the deleted value is
                set.values[toDeleteIndex] = lastValue;
                // Update the index for the moved value
                set.index[lastValue.signer] = toDeleteIndex + 1; // All indexes are 1-based
            }

            // Delete the index entry for the deleted value
            delete set.index[value.signer];

            // Delete the old entry for the moved value
            set.values.pop();

            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Returns true if the value is in the set. O(1).
     */
    function contains(MakerSet storage set, address signer) internal view returns (bool) {
        return set.index[signer] != 0;
    }

    /**
     * @dev Returns an array with all values in the set. O(N).
     * Note that there are no guarantees on the ordering of values inside the
     * array, and it may change when more values are added or removed.

     * WARNING: This function may run out of gas on large sets: use {length} and
     * {get} instead in these cases.
     */
    function enumerate(MakerSet storage set) internal view returns (IAirswapFeeConnector.Maker[] memory) {
        IAirswapFeeConnector.Maker[] memory output = new IAirswapFeeConnector.Maker[](set.values.length);
        for (uint256 i; i < set.values.length; i++) {
            output[i] = set.values[i];
        }
        return output;
    }

    /**
     * @dev Returns a chunk of array as recommended in enumerate() to avoid running of gas.
     * Note that there are no guarantees on the ordering of values inside the
     * array, and it may change when more values are added or removed.

     * WARNING: This function may run out of gas on large sets: use {length} and
     * {get} instead in these cases.
     
     * @param start start index of chunk
     * @param count num of element to return; if count == 0 then returns all the elements from the @param start
     */
    function enumerateChunk(
        MakerSet storage set,
        uint256 start,
        uint256 count
    ) internal view returns (IAirswapFeeConnector.Maker[] memory output) {
        uint256 end = start + count;
        require(end >= start, "addition overflow");
        end = (set.values.length < end || count == 0) ? set.values.length : end;
        if (end == 0 || start >= end) {
            return output;
        }

        output = new IAirswapFeeConnector.Maker[](end - start);
        for (uint256 i; i < end - start; i++) {
            output[i] = set.values[i + start];
        }
        return output;
    }

    /**
     * @dev Returns the number of elements on the set. O(1).
     */
    function length(MakerSet storage set) internal view returns (uint256) {
        return set.values.length;
    }

    /** @dev Returns the element stored at position `index` in the set. O(1).
     * Note that there are no guarantees on the ordering of values inside the
     * array, and it may change when more values are added or removed.
     *
     * Requirements:
     *
     * - `index` must be strictly less than {length}.
     */
    function get(MakerSet storage set, uint256 index) internal view returns (IAirswapFeeConnector.Maker memory) {
        return set.values[index];
    }
}
