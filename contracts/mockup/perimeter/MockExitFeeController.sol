// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../interfaces/perimeter/IExitFeeController.sol";

/// @notice Configurable stub controller for the Perimeter tests in this repo. Tests
///         set the resolved rate via `setRate(rateBps)` and the fee receiver
///         via `setFeeReceiver(addr)`; `quoteExitFee` then computes
///         `fee = gross * rateBps / 10_000` and returns a quote shaped like
///         the real controller's. No policy-resolution logic — that's the
///         controller's job and is covered by the perimeter Foundry suite.
contract MockExitFeeController is IExitFeeController {
    uint16 public configuredRateBps;
    bool public configuredActive;
    address private _feeReceiver;
    bool private _enabled;

    // Actor override (top tier of the perimeter controller's resolution order).
    // Mirrors the real controller's `actorPolicy[surfaceId][actor]` lookup.
    mapping(address => bool) public configuredActorActive;
    mapping(address => uint16) public configuredActorRate;

    // Sub-product (per-iToken) override (middle tier). Mirrors
    // `subProductPolicy[surfaceId][subProduct]` on the real controller.
    mapping(address => bool) public configuredSubProductActive;
    mapping(address => uint16) public configuredSubProductRate;

    // When set, `quoteExitFee` reverts outright — exercises the products'
    // CONTROLLER_REVERT fail-open (staticcall failure), as opposed to the
    // short-return shape (pinning a selector-less contract).
    bool public revertOnQuote;

    // ── Test-only configuration ────────────────────────────────────────────

    function setRate(uint16 rateBps) external {
        configuredRateBps = rateBps;
    }

    function setRevertOnQuote(bool v) external {
        revertOnQuote = v;
    }

    function setActive(bool active_) external {
        configuredActive = active_;
    }

    function setFeeReceiverTest(address newReceiver) external {
        _feeReceiver = newReceiver;
    }

    function setExitFeeEnabledTest(bool enabled) external {
        _enabled = enabled;
    }

    /// @notice Pin an actor-policy entry so tests can prove that going
    ///         through a wrapper makes `actorPolicy[surface][userEOA]`
    ///         unreachable (controller never sees `userEOA` as the actor
    ///         in that path; the surface default fires instead).
    function setActorPolicyTest(address actor, bool active_, uint16 rateBps) external {
        configuredActorActive[actor] = active_;
        configuredActorRate[actor] = rateBps;
    }

    /// @notice Pin a sub-product (per-iToken) policy entry so tests can
    ///         verify per-iToken rates (e.g. iWRBTC 30 bps, iXUSD 50 bps)
    ///         override the surface default.
    function setSubProductPolicyTest(address subProduct, bool active_, uint16 rateBps) external {
        configuredSubProductActive[subProduct] = active_;
        configuredSubProductRate[subProduct] = rateBps;
    }

    // ── IExitFeeController quote API ───────────────────────────────────────

    function quoteExitFee(
        bytes32 /* surfaceId */,
        address subProduct,
        address actor,
        uint256 grossAmount
    ) external view returns (ExitFeeQuote memory q) {
        require(!revertOnQuote, "MockEFC: quote revert");
        if (!_enabled) {
            q.netAmount = grossAmount;
            q.reason = uint8(SkipReason.INACTIVE);
            return q;
        }
        if (_feeReceiver == address(0)) {
            q.netAmount = grossAmount;
            q.reason = uint8(SkipReason.DISABLED);
            return q;
        }
        if (!configuredActive) {
            q.netAmount = grossAmount;
            q.reason = uint8(SkipReason.DISABLED);
            return q;
        }

        // Resolution order matches the real controller:
        //   actor (top) > sub-product > surface default.
        uint16 rate;
        if (configuredActorActive[actor]) {
            rate = configuredActorRate[actor];
        } else if (configuredSubProductActive[subProduct]) {
            rate = configuredSubProductRate[subProduct];
        } else {
            rate = configuredRateBps;
        }

        uint256 fee = (grossAmount * uint256(rate)) / 10_000;
        q.active = true;
        q.rateBps = rate;
        q.feeAmount = fee;
        q.netAmount = grossAmount - fee;
        q.feeReceiver = _feeReceiver;
        q.reason = uint8(SkipReason.NONE);
    }

    // ── IExitFeeController view methods ────────────────────────────────────

    function exitFeeEnabled() external view returns (bool) {
        return _enabled;
    }

    function feeReceiver() external view returns (address) {
        return _feeReceiver;
    }

    function surfacePolicy(bytes32) external view returns (RatePolicy memory p) {
        p.active = configuredActive;
        p.rateBps = configuredRateBps;
    }

    function subProductPolicy(bytes32, address) external view returns (RatePolicy memory p) {
        p.active = configuredActive;
        p.rateBps = configuredRateBps;
    }

    function actorPolicy(bytes32, address) external view returns (RatePolicy memory p) {}

    function subProductKeys(bytes32) external view returns (address[] memory keys) {
        return keys;
    }

    function actorKeys(bytes32) external view returns (address[] memory keys) {
        return keys;
    }

    // ── IExitFeeController admin (no-ops on the stub) ──────────────────────

    function setExitFeeEnabled(bool enabled) external {
        _enabled = enabled;
    }

    function setFeeReceiver(address newReceiver) external {
        _feeReceiver = newReceiver;
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
