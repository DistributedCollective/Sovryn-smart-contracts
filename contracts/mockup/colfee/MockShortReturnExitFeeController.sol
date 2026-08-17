// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

/// @notice Controller double for the ColFee fee-leg fail-open tests that
///         exercises `ColFeeLib.safeQuote`'s LENGTH-GATE branch: `quoteExitFee`
///         has no explicit implementation, so it hits the empty fallback and
///         returns ZERO bytes (`ok == true`, `ret.length == 0 < 192`). safeQuote
///         must synthesize a CONTROLLER_REVERT quote and the product must fail
///         open (full gross) instead of bricking the exit.
///
///         The security-perimeter delay leg is fail-CLOSED, so — like any real
///         deployed `ExitFeeController` — this double answers the delay quote
///         cleanly (healthy, DISABLED perimeter: `d = 0`, raw identities). That
///         isolates the FEE leg's short-return handling without the delay leg
///         fail-closing the exit, which is the production-faithful state (a real
///         controller always implements `quoteExitDelayFor`).
contract MockShortReturnExitFeeController {
    /// @dev Empty fallback: any call without an explicit function (notably
    ///      `quoteExitFee`) returns zero-length data with `ok == true`.
    function() external {}

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
