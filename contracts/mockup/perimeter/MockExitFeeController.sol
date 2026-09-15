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

    // ── Delay extension (security perimeter) ────────────────────────────────
    bool private _perimeterEnabled;
    uint32 private _globalDelaySeconds;
    // When set, `quoteExitDelayFor` reverts — exercises the hook's fail-CLOSED
    // per-pragma safe-quote wrapper.
    bool public revertOnDelayQuote;
    // surfaceId => actor => is-passthrough. A passthrough resolves to the
    // receiver in `effectiveActor` / `quoteExitDelayFor`.
    mapping(bytes32 => mapping(address => bool)) private _passthrough;
    // surfaceId => actor => bypass (exempt from delay). Mirrors the actor tier.
    mapping(bytes32 => mapping(address => bool)) private _actorBypassActive;
    mapping(bytes32 => mapping(address => bool)) private _actorBypassValue;

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

    // ── Delay extension: test-only configuration ────────────────────────────

    function setSecurityPerimeterEnabledTest(bool e) external {
        _perimeterEnabled = e;
    }

    function setGlobalDelaySecondsTest(uint32 s) external {
        _globalDelaySeconds = s;
    }

    function setRevertOnDelayQuote(bool v) external {
        revertOnDelayQuote = v;
    }

    function setPassthroughActorTest(bytes32 surfaceId, address a, bool isPassthrough) external {
        _passthrough[surfaceId][a] = isPassthrough;
    }

    function setActorBypassTest(
        bytes32 surfaceId,
        address actor,
        bool active_,
        bool bypass_
    ) external {
        _actorBypassActive[surfaceId][actor] = active_;
        _actorBypassValue[surfaceId][actor] = bypass_;
    }

    // ── Delay extension: IExitFeeController quote API ───────────────────────

    function effectiveActor(
        bytes32 surfaceId,
        address raw,
        address receiver
    ) public view returns (address) {
        return _passthrough[surfaceId][raw] ? receiver : raw;
    }

    function quoteExitDelay(
        bytes32 surfaceId,
        address /* subProduct */,
        address effectiveActor_
    ) public view returns (uint32) {
        if (!_perimeterEnabled) return 0;
        if (_actorBypassActive[surfaceId][effectiveActor_]) {
            return _actorBypassValue[surfaceId][effectiveActor_] ? 0 : _globalDelaySeconds;
        }
        return _globalDelaySeconds;
    }

    function quoteExitDelayFor(
        address rawOriginator,
        address owner,
        address receiver,
        bytes32 surfaceId,
        address subProduct
    ) external view returns (uint32 d, address effOrig, address effOwner) {
        require(!revertOnDelayQuote, "MockEFC: delay quote revert");
        // Short-circuit the kill switch FIRST: a disabled perimeter pays
        // direct with RAW identities and never consults the registry.
        if (!_perimeterEnabled) {
            return (0, rawOriginator, owner);
        }
        effOrig = effectiveActor(surfaceId, rawOriginator, receiver);
        effOwner = effectiveActor(surfaceId, owner, receiver);
        d = quoteExitDelay(surfaceId, subProduct, effOrig);
    }

    // ── Delay extension: IExitFeeController state views ─────────────────────

    function securityPerimeterEnabled() external view returns (bool) {
        return _perimeterEnabled;
    }

    function globalDelaySeconds() external view returns (uint32) {
        return _globalDelaySeconds;
    }

    function surfaceBypass(bytes32) external view returns (DelayBypassPolicy memory p) {
        return p;
    }

    function subProductBypass(
        bytes32,
        address
    ) external view returns (DelayBypassPolicy memory p) {
        return p;
    }

    function actorBypass(
        bytes32 surfaceId,
        address actor
    ) external view returns (DelayBypassPolicy memory p) {
        p.active = _actorBypassActive[surfaceId][actor];
        p.bypass = _actorBypassValue[surfaceId][actor];
    }

    function passthroughActor(bytes32 surfaceId, address a) external view returns (bool) {
        return _passthrough[surfaceId][a];
    }

    // ── Delay extension: IExitFeeController admin (no-ops / minimal) ─────────

    function setSecurityPerimeterEnabled(bool e) external {
        _perimeterEnabled = e;
    }

    function setGlobalDelaySeconds(uint32 s) external {
        _globalDelaySeconds = s;
    }

    function setSurfaceBypass(bytes32, DelayBypassPolicy calldata) external {}

    function setSubProductBypass(bytes32, address, DelayBypassPolicy calldata) external {}

    function setActorBypass(
        bytes32 surfaceId,
        address actor,
        DelayBypassPolicy calldata policy
    ) external {
        _actorBypassActive[surfaceId][actor] = policy.active;
        _actorBypassValue[surfaceId][actor] = policy.bypass;
    }

    function setPassthroughActor(bytes32 surfaceId, address a, bool isPassthrough) external {
        _passthrough[surfaceId][a] = isPassthrough;
    }
}
