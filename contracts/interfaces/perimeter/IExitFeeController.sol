// SPDX-License-Identifier: MIT
// Range pragma is intentional: this file is consumed under Solidity 0.5.17
// (Sovryn-smart-contracts), 0.6.11 (zero-contracts), and 0.8.20 (this repo).
// aderyn-ignore-next-line(unspecific-solidity-pragma)
pragma solidity >=0.5.17 <0.9.0;
// `pragma experimental ABIEncoderV2;` is required for the 0.5.17 leg — that
// compiler needs the directive to emit/decode struct returns (ExitFeeQuote)
// across the ABI boundary. The modern `pragma abicoder v2;` was only added
// in 0.7.4 and is incompatible with 0.5.x, so the experimental pragma is the
// only spelling that works across all three target compilers. On 0.6+/0.8+
// the experimental pragma is accepted (silently on 0.6.x; with a deprecation
// notice on 0.8.x that does NOT enable the historical encoder bugs — those
// bugs were fixed long before 0.6.0). This is a pure interface (no
// implementation, no storage), so there is no exposure to encoder-bug
// surface area beyond the ABI itself. Removing it would require one interface
// file per pragma, which is exactly the drift this single file avoids.
// aderyn-ignore-next-line(experimental-encoder)
pragma experimental ABIEncoderV2;

/// @title  IExitFeeController
/// @notice Cross-pragma interface for the Sovryn ExitFee (Perimeter) controller.
///         A single file consumed by Sovryn-smart-contracts (0.5.17),
///         zero-contracts (0.6.11), and the controller impl itself (0.8.20).
///         AMM (Solidity 0.4.26) uses a structurally-different variant at
///         `src/interfaces/v0_4/IExitFeeController.sol`, which must stay
///         ABI-identical to this file.
interface IExitFeeController {
    // ─── Types ────────────────────────────────────────────────────────────

    /// @notice Reason a `ExitFeeSkipped` event was emitted instead of an
    ///         `ExitFeeApplied`. NONE covers honest paths (positive charge,
    ///         dust, or actor-exemption); the rest cover off-state outcomes.
    enum SkipReason {
        NONE, // Controller computed an honest quote (charge / dust / zero-rate).
        INACTIVE, // exitFeeEnabled == false.
        DISABLED, // feeReceiver == address(0), OR surface gate off.
        INVALID_QUOTE, // Defensive: overflow or fee > gross.
        CONTROLLER_REVERT, // Set by the product's local _safeQuote on staticcall failure.
        VAULT_REVERT // Set by the product hook when the fee transfer itself failed.
    }

    /// @notice A single rate-policy entry. Lives at each of the three tiers
    ///         (actor → sub-product → surface).
    struct RatePolicy {
        bool active;
        uint16 rateBps;
    }

    /// @notice A delay bypass/exemption entry, mirroring the fee tiers
    ///         (actor → sub-product → surface). `active == false` ⇒ the tier is
    ///         not configured; resolution falls through. `active == true` ⇒ this
    ///         tier decides: `bypass == true` exempts (`d = 0`), `bypass == false`
    ///         FORCES `globalDelaySeconds` (overriding a broader bypass). It is an
    ///         exemption toggle only — there is no per-instance delay
    ///         duration.
    struct DelayBypassPolicy {
        bool active;
        bool bypass;
    }

    /// @notice Quote returned by `quoteExitFee`. `reason` carries the precise
    ///         off-state code; `active` is the resolved policy state (true iff
    ///         a RatePolicy.active entry was used and reason ∈ {NONE}).
    struct ExitFeeQuote {
        bool active;
        uint16 rateBps;
        uint256 feeAmount;
        uint256 netAmount;
        address feeReceiver;
        uint8 reason;
    }

    // ─── Events ───────────────────────────────────────────────────────────

    event ExitFeeEnabledSet(bool enabled);
    event FeeReceiverSet(address indexed feeReceiver);
    event SurfacePolicySet(bytes32 indexed surfaceId, bool active, uint16 rateBps);
    event SubProductPolicySet(
        bytes32 indexed surfaceId,
        address indexed subProduct,
        bool active,
        uint16 rateBps
    );
    event ActorPolicySet(
        bytes32 indexed surfaceId,
        address indexed actor,
        bool active,
        uint16 rateBps
    );
    event SubProductPolicyRemoved(bytes32 indexed surfaceId, address indexed subProduct);
    event ActorPolicyRemoved(bytes32 indexed surfaceId, address indexed actor);

    // Delay extension.
    event AdminSet(address indexed admin);
    event SecurityPerimeterEnabledSet(bool enabled);
    event GlobalDelaySet(uint32 seconds_);
    event SurfaceBypassSet(bytes32 indexed surfaceId, bool active, bool bypass);
    event SurfaceBypassRemoved(bytes32 indexed surfaceId);
    event SubProductBypassSet(
        bytes32 indexed surfaceId,
        address indexed subProduct,
        bool active,
        bool bypass
    );
    event ActorBypassSet(
        bytes32 indexed surfaceId,
        address indexed actor,
        bool active,
        bool bypass
    );
    event SubProductBypassRemoved(bytes32 indexed surfaceId, address indexed subProduct);
    event ActorBypassRemoved(bytes32 indexed surfaceId, address indexed actor);

    // ─── Quote ────────────────────────────────────────────────────────────

    /// @notice Resolve the fee policy for `(surfaceId, subProduct, actor)` and
    ///         compute the fee on `grossAmount`. Reads only; never reverts on
    ///         policy lookups (returns active=false with a SkipReason instead).
    ///         May revert only on internal arithmetic invariants (caught by
    ///         the product's local _safeQuote helper as CONTROLLER_REVERT).
    function quoteExitFee(
        bytes32 surfaceId,
        address subProduct,
        address actor,
        uint256 grossAmount
    ) external view returns (ExitFeeQuote memory);

    // ─── Delay quote (security perimeter) ─────────────────────────────────

    /// @notice The hook's SINGLE delay entry. Short-circuits the kill
    ///         switch FIRST: `if (!securityPerimeterEnabled) return (0,
    ///         rawOriginator, owner)` (pays direct without touching the queue).
    ///         Otherwise quotes the delay on the originator and returns the
    ///         originator and owner unchanged, so the quote and the record use
    ///         the SAME identity. The hook MUST ignore `effOrig` /
    ///         `effOwner` and pay direct whenever `d == 0`.
    /// @return d        Delay seconds to escrow for (0 ⇒ off / inactive / bypassed).
    /// @return effOrig  The originator, unchanged.
    /// @return effOwner The owner, unchanged.
    function quoteExitDelayFor(
        address rawOriginator,
        address owner,
        address receiver,
        bytes32 surfaceId,
        address subProduct
    ) external view returns (uint32 d, address effOrig, address effOwner);

    /// @notice Inner per-actor delay view (off / inactive / bypass ⇒ 0, else
    ///         `globalDelaySeconds`), evaluated on the actor passed — the
    ///         originator, as `quoteExitDelayFor` does; off-chain use.
    function quoteExitDelay(
        bytes32 surfaceId,
        address subProduct,
        address effectiveActor
    ) external view returns (uint32);

    // ─── State views ──────────────────────────────────────────────────────

    function exitFeeEnabled() external view returns (bool);
    function feeReceiver() external view returns (address);
    function surfacePolicy(bytes32 surfaceId) external view returns (RatePolicy memory);
    function subProductPolicy(
        bytes32 surfaceId,
        address subProduct
    ) external view returns (RatePolicy memory);
    function actorPolicy(
        bytes32 surfaceId,
        address actor
    ) external view returns (RatePolicy memory);
    function subProductKeys(bytes32 surfaceId) external view returns (address[] memory);
    function actorKeys(bytes32 surfaceId) external view returns (address[] memory);

    // ─── Delay state views ────────────────────────────────────────────────

    function admin() external view returns (address);
    function securityPerimeterEnabled() external view returns (bool);
    function globalDelaySeconds() external view returns (uint32);
    function surfaceBypass(bytes32 surfaceId) external view returns (DelayBypassPolicy memory);
    function subProductBypass(
        bytes32 surfaceId,
        address subProduct
    ) external view returns (DelayBypassPolicy memory);
    function actorBypass(
        bytes32 surfaceId,
        address actor
    ) external view returns (DelayBypassPolicy memory);

    /// @notice Every surfaceId ever configured in the surface-tier delay-bypass
    ///         index. Backed by an enumerable set so monitoring tooling can dump
    ///         every surface bypass without relying on off-chain event indexing.
    ///         Entries persist on `{active:false}`; use `removeSurfaceBypass` for
    ///         hard removal.
    function surfaceBypassKeys() external view returns (bytes32[] memory);
    function subProductBypassKeys(bytes32 surfaceId) external view returns (address[] memory);
    function actorBypassKeys(bytes32 surfaceId) external view returns (address[] memory);

    /// @notice Every surfaceId that carries a delay-bypass entry at any tier —
    ///         surface, sub-product, or actor. Recorded from all three writers,
    ///         so a surface with only a sub-product- or actor-tier bypass is
    ///         enumerable even though it was never passed to `setSurfaceBypass`.
    ///         Retention-only (entries never dropped).
    function bypassSurfaceIds() external view returns (bytes32[] memory);

    // ─── Admin ────────────────────────────────────────────────────────────

    function setExitFeeEnabled(bool enabled) external;
    function setFeeReceiver(address newReceiver) external;
    function setSurfacePolicy(bytes32 surfaceId, RatePolicy calldata policy) external;
    function setSubProductPolicy(
        bytes32 surfaceId,
        address subProduct,
        RatePolicy calldata policy
    ) external;
    function setSubProductPolicies(
        bytes32 surfaceId,
        address[] calldata subProducts,
        RatePolicy[] calldata policies
    ) external;
    function setActorPolicy(bytes32 surfaceId, address actor, RatePolicy calldata policy) external;
    function setActorPolicies(
        bytes32 surfaceId,
        address[] calldata actors,
        RatePolicy[] calldata policies
    ) external;
    function removeSubProductPolicy(bytes32 surfaceId, address subProduct) external;
    function removeSubProductPolicies(bytes32 surfaceId, address[] calldata subProducts) external;
    function removeActorPolicy(bytes32 surfaceId, address actor) external;
    function removeActorPolicies(bytes32 surfaceId, address[] calldata actors) external;

    // ─── Delay admin (security perimeter) ─────────────────────────────────
    // The kill switch is `onlyAdminOrOwner`; every other delay setter is
    // `onlyOwner`. View quotes are ungated.

    /// @notice Rotate the fast operational guardian (Admin). Owner-only. May
    ///         equal the Owner -- nothing requires the two to be distinct. The
    ///         only delay principal on the controller.
    function setAdmin(address newAdmin) external;

    function setSecurityPerimeterEnabled(bool enabled) external;
    function setGlobalDelaySeconds(uint32 seconds_) external;
    function setSurfaceBypass(bytes32 surfaceId, DelayBypassPolicy calldata policy) external;

    /// @notice Hard-remove a surface-tier delay bypass: clears the stored
    ///         policy and drops the surfaceId from the enumeration index.
    ///         Idempotent.
    function removeSurfaceBypass(bytes32 surfaceId) external;

    function setSubProductBypass(
        bytes32 surfaceId,
        address subProduct,
        DelayBypassPolicy calldata policy
    ) external;
    function setSubProductBypasses(
        bytes32 surfaceId,
        address[] calldata subProducts,
        DelayBypassPolicy[] calldata policies
    ) external;
    function setActorBypass(
        bytes32 surfaceId,
        address actor,
        DelayBypassPolicy calldata policy
    ) external;
    function setActorBypasses(
        bytes32 surfaceId,
        address[] calldata actors,
        DelayBypassPolicy[] calldata policies
    ) external;
    function removeSubProductBypass(bytes32 surfaceId, address subProduct) external;
    function removeSubProductBypasses(bytes32 surfaceId, address[] calldata subProducts) external;
    function removeActorBypass(bytes32 surfaceId, address actor) external;
    function removeActorBypasses(bytes32 surfaceId, address[] calldata actors) external;

    /// @notice Withdraw an actor-tier exemption in one call: the fee entry
    ///         inactive (surface rate applies), the delay entry active with no
    ///         bypass (delayed whatever a wider tier says). Owner-only.
    function revokeExemption(bytes32 surfaceId, address actor) external;
}
