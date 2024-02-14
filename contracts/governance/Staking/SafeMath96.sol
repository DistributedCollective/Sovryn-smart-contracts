pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

/**
 * @title SafeMath96 contract.
 * @notice Improved Solidity's arithmetic operations with added overflow checks.
 * @dev SafeMath96 uses uint96, unsigned integers of 96 bits length, so every
 * integer from 0 to 2^96-1 can be operated.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * SafeMath restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this contract instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 * */
contract SafeMath96 {
    function safe32(uint256 n, string memory errorMessage) internal pure returns (uint32) {
        require(n < 2**32, errorMessage);
        return uint32(n);
    }

    function safe64(uint256 n, string memory errorMessage) internal pure returns (uint64) {
        require(n < 2**64, errorMessage);
        return uint64(n);
    }

    function safe96(uint256 n, string memory errorMessage) internal pure returns (uint96) {
        require(n < 2**96, errorMessage);
        return uint96(n);
    }

    /**
     * @notice Adds two unsigned integers, reverting on overflow.
     * @dev Counterpart to Solidity's `+` operator.
     * @param a First integer.
     * @param b Second integer.
     * @param errorMessage The revert message on overflow.
     * @return The safe addition a+b.
     * */
    function add96(
        uint96 a,
        uint96 b,
        string memory errorMessage
    ) internal pure returns (uint96) {
        uint96 c = a + b;
        require(c >= a, errorMessage);
        return c;
    }

    /**
     * @notice Substracts two unsigned integers, reverting on underflow.
     * @dev Counterpart to Solidity's `-` operator.
     * @param a First integer.
     * @param b Second integer.
     * @param errorMessage The revert message on underflow.
     * @return The safe substraction a-b.
     * */
    function sub96(
        uint96 a,
        uint96 b,
        string memory errorMessage
    ) internal pure returns (uint96) {
        require(b <= a, errorMessage);
        return a - b;
    }

    /**
     * @notice Multiplies two unsigned integers, reverting on overflow.
     * @dev Counterpart to Solidity's `*` operator.
     * @param a First integer.
     * @param b Second integer.
     * @param errorMessage The revert message on overflow.
     * @return The safe product a*b.
     * */
    function mul96(
        uint96 a,
        uint96 b,
        string memory errorMessage
    ) internal pure returns (uint96) {
        if (a == 0) {
            return 0;
        }

        uint96 c = a * b;
        require(c / a == b, errorMessage);

        return c;
    }

    /**
     * @notice Divides two unsigned integers, reverting on overflow.
     * @dev Counterpart to Solidity's `/` operator.
     * @param a First integer.
     * @param b Second integer.
     * @param errorMessage The revert message on overflow.
     * @return The safe division a/b.
     * */
    function div96(
        uint96 a,
        uint96 b,
        string memory errorMessage
    ) internal pure returns (uint96) {
        // Solidity only automatically asserts when dividing by 0
        require(b > 0, errorMessage);
        uint96 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }
}
