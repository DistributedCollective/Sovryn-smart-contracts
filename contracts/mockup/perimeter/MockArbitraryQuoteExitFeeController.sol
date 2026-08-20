// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../interfaces/perimeter/IExitFeeController.sol";

/// @notice Controller stub that returns a fully settable `ExitFeeQuote`
///         VERBATIM — no recomputation, no sanitising, no early-outs.
///
///         `MockExitFeeController` models an HONEST controller: it short-
///         circuits to DISABLED when the receiver is zero and always derives
///         `netAmount = grossAmount - fee`. That makes two arms of
///         `PerimeterLib.quoteIsValid` (`feeReceiver == address(0)` and
///         `netAmount != gross - feeAmount`) unreachable through it, so the
///         products' defensive gate can only be exercised on shapes an honest
///         controller happens to produce. The ExitFeeController is upgradable
///         and external: a future implementation — or a compromised one — can
///         return any of the four invalid shapes. This mock lets a test state
///         one directly.
///
///         Solidity-side twin of the Foundry `MockQuoteController` in
///         `tests-foundry/perimeter/PerimeterSplit.fuzz.t.sol`, which plays the same
///         role for the protocol (borrower-exit) tree.
///
///         The quote fields are set as flat arguments rather than a struct so
///         a JS test can express a shape without going through ABIEncoderV2
///         tuple encoding.
contract MockArbitraryQuoteExitFeeController is IExitFeeController {
    ExitFeeQuote internal _quote;

    // ── Test-only configuration ────────────────────────────────────────────

    /// @notice Pin the exact quote `quoteExitFee` will return, field for
    ///         field. Nothing here is validated or derived — that is the
    ///         entire point.
    function setQuote(
        bool active,
        uint16 rateBps,
        uint256 feeAmount,
        uint256 netAmount,
        address feeReceiver_,
        uint8 reason
    ) external {
        _quote.active = active;
        _quote.rateBps = rateBps;
        _quote.feeAmount = feeAmount;
        _quote.netAmount = netAmount;
        _quote.feeReceiver = feeReceiver_;
        _quote.reason = reason;
    }

    // ── IExitFeeController quote API ───────────────────────────────────────

    /// @notice Returns the pinned quote unchanged, ignoring every argument
    ///         (including `grossAmount` — a desynced `netAmount` is a shape
    ///         this mock exists to produce).
    function quoteExitFee(
        bytes32 /* surfaceId */,
        address /* subProduct */,
        address /* actor */,
        uint256 /* grossAmount */
    ) external view returns (ExitFeeQuote memory) {
        return _quote;
    }

    // ── IExitFeeController view methods ────────────────────────────────────

    function exitFeeEnabled() external view returns (bool) {
        return true;
    }

    function feeReceiver() external view returns (address) {
        return _quote.feeReceiver;
    }

    function surfacePolicy(bytes32) external view returns (RatePolicy memory p) {
        p.active = _quote.active;
        p.rateBps = _quote.rateBps;
    }

    function subProductPolicy(bytes32, address) external view returns (RatePolicy memory p) {
        p.active = _quote.active;
        p.rateBps = _quote.rateBps;
    }

    function actorPolicy(bytes32, address) external view returns (RatePolicy memory p) {}

    function subProductKeys(bytes32) external view returns (address[] memory keys) {
        return keys;
    }

    function actorKeys(bytes32) external view returns (address[] memory keys) {
        return keys;
    }

    // ── IExitFeeController admin (no-ops on the stub) ──────────────────────

    function setExitFeeEnabled(bool) external {}

    function setFeeReceiver(address newReceiver) external {
        _quote.feeReceiver = newReceiver;
    }

    function setSurfacePolicy(bytes32, RatePolicy calldata) external {}
    function setSubProductPolicy(bytes32, address, RatePolicy calldata) external {}
    function setSubProductPolicies(bytes32, address[] calldata, RatePolicy[] calldata) external {}
    function setActorPolicy(bytes32, address, RatePolicy calldata) external {}
    function setActorPolicies(bytes32, address[] calldata, RatePolicy[] calldata) external {}
    function removeSubProductPolicy(bytes32, address) external {}
    function removeSubProductPolicies(bytes32, address[] calldata) external {}
    function removeActorPolicy(bytes32, address) external {}
    function removeActorPolicies(bytes32, address[] calldata) external {}
}
