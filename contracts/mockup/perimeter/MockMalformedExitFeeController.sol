// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

/// @notice Worst-case controller for the Perimeter fail-open tests: answers ANY
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

    /// @notice The security-perimeter delay leg is fail-CLOSED, so the delay
    ///         quote MUST be answered cleanly by any controller a product pins —
    ///         a real deployed `ExitFeeController` always implements it. This
    ///         double is malformed ONLY on the FEE quote (the fallback above);
    ///         the delay quote reports a healthy, DISABLED perimeter (`d = 0`,
    ///         raw identities) so the test isolates the fee leg's fail-open
    ///         defensive decode without the delay leg fail-closing the exit.
    function quoteExitDelayFor(
        address rawOriginator,
        address owner,
        address /* receiver */,
        bytes32 /* surfaceId */,
        address /* subProduct */
    ) external pure returns (uint32 d, address effOrig, address effOwner) {
        return (0, rawOriginator, owner);
    }

    function securityPerimeterEnabled() external pure returns (bool) {
        return false;
    }
}
