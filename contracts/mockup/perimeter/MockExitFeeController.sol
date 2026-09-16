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

    // Surface-scoped actor fee policy, keyed as the real controller keys it.
    // Written by `setActorPolicy` and `setActorFeePolicyTest`, read back by
    // `actorPolicy`, and consulted first by `quoteExitFee`, so the view and
    // the quote agree.
    mapping(bytes32 => mapping(address => bool)) private _actorPolicyActive;
    mapping(bytes32 => mapping(address => uint16)) private _actorPolicyRate;

    // Sub-product (per-iToken) override (middle tier). Mirrors
    // `subProductPolicy[surfaceId][subProduct]` on the real controller.
    mapping(address => bool) public configuredSubProductActive;
    mapping(address => uint16) public configuredSubProductRate;

    // When set, `quoteExitFee` reverts outright — exercises the products'
    // CONTROLLER_REVERT fail-open (staticcall failure), as opposed to the
    // short-return shape (pinning a selector-less contract).
    bool public revertOnQuote;

    // ── Delay extension (security perimeter) ────────────────────────────────
    address private _admin;
    bool private _perimeterEnabled;
    uint32 private _globalDelaySeconds;
    // When set, `quoteExitDelayFor` reverts — exercises the hook's fail-CLOSED
    // per-pragma safe-quote wrapper.
    bool public revertOnDelayQuote;
    // surfaceId => actor => bypass (exempt from delay). Mirrors the actor tier.
    mapping(bytes32 => mapping(address => bool)) private _actorBypassActive;
    mapping(bytes32 => mapping(address => bool)) private _actorBypassValue;

    // Surface- and sub-product-tier bypass storage, and the enumeration
    // indexes the real controller keeps so the arming guard can discover a
    // bypass at any tier from the controller itself, the way it discovers
    // them on chain. Mirrors `_surfaceBypass`, `_subProductBypass`,
    // `_bypassSurfaceIds`, `_subProductBypassKeys` and `_actorBypassKeys`.
    mapping(bytes32 => bool) private _surfaceBypassActive;
    mapping(bytes32 => bool) private _surfaceBypassValue;
    mapping(bytes32 => mapping(address => bool)) private _subProductBypassActive;
    mapping(bytes32 => mapping(address => bool)) private _subProductBypassValue;

    bytes32[] private _bypassSurfaceIdsList;
    mapping(bytes32 => bool) private _bypassSurfaceSeen;
    mapping(bytes32 => address[]) private _subProductBypassKeysList;
    mapping(bytes32 => mapping(address => bool)) private _subProductBypassSeen;
    mapping(bytes32 => address[]) private _actorBypassKeysList;
    mapping(bytes32 => mapping(address => bool)) private _actorBypassSeen;

    /// @notice Record `surfaceId` in the any-tier master set once, the way
    ///         every real bypass writer does regardless of which tier it
    ///         touched.
    function _recordBypassSurface(bytes32 surfaceId) private {
        if (!_bypassSurfaceSeen[surfaceId]) {
            _bypassSurfaceSeen[surfaceId] = true;
            _bypassSurfaceIdsList.push(surfaceId);
        }
    }

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

    /// @notice Write a surface-scoped actor fee policy, as the owner's
    ///         `setActorPolicy` does, with flat arguments.
    function setActorFeePolicyTest(
        bytes32 surfaceId,
        address actor,
        bool active_,
        uint16 rateBps
    ) external {
        _actorPolicyActive[surfaceId][actor] = active_;
        _actorPolicyRate[surfaceId][actor] = rateBps;
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
        bytes32 surfaceId,
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
        // The actor tier reads the surface-scoped entry first, then the
        // surface-agnostic one `setActorPolicyTest` writes.
        uint16 rate;
        if (_actorPolicyActive[surfaceId][actor]) {
            rate = _actorPolicyRate[surfaceId][actor];
        } else if (configuredActorActive[actor]) {
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

    function actorPolicy(
        bytes32 surfaceId,
        address actor
    ) external view returns (RatePolicy memory p) {
        p.active = _actorPolicyActive[surfaceId][actor];
        p.rateBps = _actorPolicyRate[surfaceId][actor];
    }

    function subProductKeys(bytes32) external view returns (address[] memory keys) {
        return keys;
    }

    function actorKeys(bytes32) external view returns (address[] memory keys) {
        return keys;
    }

    // ── IExitFeeController admin ───────────────────────────────────────────

    function setExitFeeEnabled(bool enabled) external {
        _enabled = enabled;
    }

    function setFeeReceiver(address newReceiver) external {
        _feeReceiver = newReceiver;
    }

    function setSurfacePolicy(bytes32, RatePolicy calldata) external {}
    function setSubProductPolicy(bytes32, address, RatePolicy calldata) external {}
    function setSubProductPolicies(bytes32, address[] calldata, RatePolicy[] calldata) external {}

    function setActorPolicy(
        bytes32 surfaceId,
        address actor,
        RatePolicy calldata policy
    ) external {
        _actorPolicyActive[surfaceId][actor] = policy.active;
        _actorPolicyRate[surfaceId][actor] = policy.rateBps;
    }

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

    /// @notice Write a surface-scoped actor delay bypass, as the owner's
    ///         `setActorBypass` does, and register it in the same
    ///         enumeration indexes so the arming guard's enumeration reader
    ///         can discover it from the controller itself.
    function setActorBypassTest(
        bytes32 surfaceId,
        address actor,
        bool active_,
        bool bypass_
    ) external {
        _actorBypassActive[surfaceId][actor] = active_;
        _actorBypassValue[surfaceId][actor] = bypass_;
        if (!_actorBypassSeen[surfaceId][actor]) {
            _actorBypassSeen[surfaceId][actor] = true;
            _actorBypassKeysList[surfaceId].push(actor);
        }
        _recordBypassSurface(surfaceId);
    }

    /// @notice Write a surface-tier delay bypass, enumerated the same way.
    function setSurfaceBypassTest(bytes32 surfaceId, bool active_, bool bypass_) external {
        _surfaceBypassActive[surfaceId] = active_;
        _surfaceBypassValue[surfaceId] = bypass_;
        _recordBypassSurface(surfaceId);
    }

    /// @notice Write a sub-product-tier delay bypass, enumerated the same way.
    function setSubProductBypassTest(
        bytes32 surfaceId,
        address subProduct,
        bool active_,
        bool bypass_
    ) external {
        _subProductBypassActive[surfaceId][subProduct] = active_;
        _subProductBypassValue[surfaceId][subProduct] = bypass_;
        if (!_subProductBypassSeen[surfaceId][subProduct]) {
            _subProductBypassSeen[surfaceId][subProduct] = true;
            _subProductBypassKeysList[surfaceId].push(subProduct);
        }
        _recordBypassSurface(surfaceId);
    }

    // ── Delay extension: IExitFeeController quote API ───────────────────────

    function quoteExitDelay(
        bytes32 surfaceId,
        address /* subProduct */,
        address actor
    ) public view returns (uint32) {
        if (!_perimeterEnabled) return 0;
        if (_actorBypassActive[surfaceId][actor]) {
            return _actorBypassValue[surfaceId][actor] ? 0 : _globalDelaySeconds;
        }
        return _globalDelaySeconds;
    }

    function quoteExitDelayFor(
        address rawOriginator,
        address owner,
        address /* receiver */,
        bytes32 surfaceId,
        address subProduct
    ) external view returns (uint32 d, address effOrig, address effOwner) {
        require(!revertOnDelayQuote, "MockEFC: delay quote revert");
        // The originator and owner come back unchanged; the delay is quoted on
        // the originator, and is zero while the perimeter is switched off.
        return (quoteExitDelay(surfaceId, subProduct, rawOriginator), rawOriginator, owner);
    }

    // ── Delay extension: IExitFeeController state views ─────────────────────

    function admin() external view returns (address) {
        return _admin;
    }

    function securityPerimeterEnabled() external view returns (bool) {
        return _perimeterEnabled;
    }

    function globalDelaySeconds() external view returns (uint32) {
        return _globalDelaySeconds;
    }

    function surfaceBypass(bytes32 surfaceId) external view returns (DelayBypassPolicy memory p) {
        p.active = _surfaceBypassActive[surfaceId];
        p.bypass = _surfaceBypassValue[surfaceId];
    }

    function subProductBypass(
        bytes32 surfaceId,
        address subProduct
    ) external view returns (DelayBypassPolicy memory p) {
        p.active = _subProductBypassActive[surfaceId][subProduct];
        p.bypass = _subProductBypassValue[surfaceId][subProduct];
    }

    function actorBypass(
        bytes32 surfaceId,
        address actor
    ) external view returns (DelayBypassPolicy memory p) {
        p.active = _actorBypassActive[surfaceId][actor];
        p.bypass = _actorBypassValue[surfaceId][actor];
    }

    function surfaceBypassKeys() external view returns (bytes32[] memory) {
        return _bypassSurfaceIdsList;
    }

    function subProductBypassKeys(bytes32 surfaceId) external view returns (address[] memory) {
        return _subProductBypassKeysList[surfaceId];
    }

    function actorBypassKeys(bytes32 surfaceId) external view returns (address[] memory) {
        return _actorBypassKeysList[surfaceId];
    }

    function bypassSurfaceIds() external view returns (bytes32[] memory) {
        return _bypassSurfaceIdsList;
    }

    // ── Delay extension: IExitFeeController admin (no-ops / minimal) ─────────

    function setAdmin(address newAdmin) external {
        _admin = newAdmin;
    }

    function setSecurityPerimeterEnabled(bool e) external {
        _perimeterEnabled = e;
    }

    function setGlobalDelaySeconds(uint32 s) external {
        _globalDelaySeconds = s;
    }

    /// @notice Mirrors the real controller's `setSurfaceBypass`: stores the
    ///         policy and registers the surface in the enumeration the arming
    ///         guard's bypass check reads.
    function setSurfaceBypass(bytes32 surfaceId, DelayBypassPolicy calldata policy) external {
        _surfaceBypassActive[surfaceId] = policy.active;
        _surfaceBypassValue[surfaceId] = policy.bypass;
        _recordBypassSurface(surfaceId);
    }

    function removeSurfaceBypass(bytes32) external {}

    /// @notice Mirrors the real controller's `setSubProductBypass`, enumerated
    ///         the same way.
    function setSubProductBypass(
        bytes32 surfaceId,
        address subProduct,
        DelayBypassPolicy calldata policy
    ) external {
        _subProductBypassActive[surfaceId][subProduct] = policy.active;
        _subProductBypassValue[surfaceId][subProduct] = policy.bypass;
        if (!_subProductBypassSeen[surfaceId][subProduct]) {
            _subProductBypassSeen[surfaceId][subProduct] = true;
            _subProductBypassKeysList[surfaceId].push(subProduct);
        }
        _recordBypassSurface(surfaceId);
    }

    function setSubProductBypasses(
        bytes32,
        address[] calldata,
        DelayBypassPolicy[] calldata
    ) external {}

    /// @notice Mirrors the real controller's `setActorBypass`, enumerated the
    ///         same way, so an owner call written through the real admin
    ///         function — not just the test setter — is discoverable by the
    ///         arming guard's enumeration reader.
    function setActorBypass(
        bytes32 surfaceId,
        address actor,
        DelayBypassPolicy calldata policy
    ) external {
        _actorBypassActive[surfaceId][actor] = policy.active;
        _actorBypassValue[surfaceId][actor] = policy.bypass;
        if (!_actorBypassSeen[surfaceId][actor]) {
            _actorBypassSeen[surfaceId][actor] = true;
            _actorBypassKeysList[surfaceId].push(actor);
        }
        _recordBypassSurface(surfaceId);
    }

    function setActorBypasses(
        bytes32,
        address[] calldata,
        DelayBypassPolicy[] calldata
    ) external {}

    function removeSubProductBypass(bytes32, address) external {}

    function removeSubProductBypasses(bytes32, address[] calldata) external {}

    function removeActorBypass(bytes32, address) external {}

    function removeActorBypasses(bytes32, address[] calldata) external {}

    function revokeExemption(bytes32, address) external {}
}
