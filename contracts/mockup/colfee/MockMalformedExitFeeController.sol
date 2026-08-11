// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

/// @notice Worst-case controller for the ColFee fail-open tests: answers ANY
///         call (including `quoteExitFee`) with 192 bytes of all-ones words —
///         long enough to pass `safeQuote`'s `ret.length >= 192` gate, but
///         every word is non-canonical for its target type (bool > 1, dirty
///         uint16/address upper bits). A struct `abi.decode` of this payload
///         REVERTS under the 0.5.17 ABIEncoderV2 validating decoder; the
///         products must contain that and fail open (CONTROLLER_REVERT, full
///         gross) instead of letting the decode brick exits.
contract MockMalformedExitFeeController {
    function() external payable {
        assembly {
            mstore(0, not(0))
            mstore(32, not(0))
            mstore(64, not(0))
            mstore(96, not(0))
            mstore(128, not(0))
            mstore(160, not(0))
            return(0, 192)
        }
    }
}
