// SPDX-License-Identifier: MIT
// ─────────────────────────────────────────────────────────────────────────────
// PROVENANCE — copied verbatim from DistributedCollective/perimeter
//   @ 51457b21bc9a87958e99ea51325ded150422e791
//   src/interfaces/IExitDelayQueue.sol
// Do NOT modify the ABI here — the queue's IExitDelayQueue is final.
// To update: change upstream, re-copy, bump the SHA in this header.
//
// This file is the authoritative type/event/error + ABI catalog, kept for ABI
// parity and off-chain tooling. Upstream pins `0.8.20`; here the pragma is
// WIDENED to `>=0.8.4 <0.9.0` (the ONLY edit vs upstream, mirroring the
// range-pragma convention already used for the copied `IExitFeeController.sol`)
// so it builds against this repo's configured 0.8.x compilers — the ABI, types,
// events, and errors are byte-for-byte upstream. It is NOT importable from the
// 0.5.17 product hosts (custom `error`s + struct returns need 0.8.x); the 0.5.x
// hooks call the queue through the minimal cross-pragma stub
// `IExitDelayQueueHook.sol` (the four `record*` fns), whose signatures are kept
// byte-for-byte identical to the ones declared below.
// aderyn-ignore-next-line(unspecific-solidity-pragma)
pragma solidity >=0.8.4 <0.9.0;

/// @title  IExitDelayQueue
/// @notice External ABI + type/event/error catalog for `ExitDelayQueue`, the
///         per-request escrow that holds the *user* leg of an exit for a
///         configurable delay so a detected theft can be blocked (frozen or
///         blacklisted) and routed to recovery before the funds leave.
///
///         This interface mirrors the queue's complete function catalog
///         and its event/error catalog, and declares the shared types.
///
///         Types (enums/structs) are declared here so cross-pragma callers
///         and off-chain tooling share one source of truth. The queue itself
///         is 0.8.20 UUPS; the four `record*` ingress fns are consumed from
///         0.5.x / 0.6.x product hosts via a minimal interface stub.
interface IExitDelayQueue {
    // ─── Types ───────────────────────────────────────────────────

    /// @notice Per-request lifecycle. `None` is the zero value (never stored
    ///         for a live id); the three terminal states are mutually
    ///         exclusive and a request leaves `Queued` at most once.
    enum ExitStatus {
        None, //               0 — never recorded
        Queued, //             1 — escrowed, awaiting execute / recovery
        Executed, //           2 — paid to receiver (terminal)
        ResolvedToProtocol, // 3 — Leg-2 recovery-away (terminal)
        ResolvedBySIP //       4 — Leg-3 DAO catch-all (terminal)
    }

    /// @notice Per-address block state. `Frozen` = temporary (investigating);
    ///         `Blacklisted` = confirmed hack. Execution treats both as
    ///         "blocked"; recovery-away distinguishes them.
    enum BlockState {
        None, //        0
        Frozen, //      1 — temporary, cleared by unfreeze
        Blacklisted // 2 — confirmed, cleared only by unblacklist
    }

    /// @notice An immutable exit request. Every field except `status` is
    ///         frozen at record time. Packed into 7 words.
    struct ExitRequest {
        // word 1 (128 + 64 + 64 = 256 bits):
        uint128 amount; //    narrowed from the uint256 Perimeter amount at record
        uint64 createdAt; //  audit/analytics; emitted in ExitQueued
        uint64 unlockAt; //   COMPUTED by the queue = createdAt + delaySeconds
        // words 2-5:
        address originator; // withdrawal caller (effective, post-normalization) — block key + executor
        address owner; //      position owner — MANDATORY block key + executor
        address receiver; //   immutable payout destination — block key iff freezeReceiver; NOT an executor
        address token; //      address(0) = native RBTC
        // word 6:
        bytes32 surfaceId; //  provenance: recovery-route key
        // word 7 (160 + 8 + 8 = 176 bits):
        address subProduct; // provenance: iToken / converter / address(0)
        ExitStatus status; //  uint8
        bool unwrapOnDelivery; // queue holds WRBTC, executeExit unwraps → native RBTC
    }

    /// @notice A pre-approved Leg-2 recovery route. `routeId` is
    ///         `keccak256(abi.encode(surfaceId, subProduct, token, destination))`.
    struct RecoveryRoute {
        bool active;
        bytes32 surfaceId;
        address subProduct;
        address token;
        address destination;
        bool topUpPool; // 2a: plain top-up of the originating pool (destination == subProduct)
    }

    // ─── Events ──────────────────────────────────────────────────

    event ExitQueued(
        uint256 indexed id,
        address indexed originator,
        address indexed owner,
        address receiver,
        address token,
        uint128 amount,
        uint64 unlockAt,
        bytes32 surfaceId,
        address subProduct
    );
    event ExitExecuted(
        uint256 indexed id,
        address indexed receiver,
        address token,
        uint128 amount
    );
    event ExitResolvedToProtocol(
        uint256 indexed id,
        bytes32 indexed routeId,
        address destination,
        uint128 amount
    );
    event ExitResolvedBySIP(uint256 indexed id, address indexed destination, uint128 amount);
    event AccountBlocked(
        address indexed account,
        BlockState state,
        uint256 indexed triggerRequestId,
        bytes32 reasonHash
    );
    event AccountUnblocked(address indexed account, BlockState fromState);
    event RecoveryRouteSet(
        bytes32 indexed routeId,
        bytes32 surfaceId,
        address subProduct,
        address token,
        address destination,
        bool topUpPool
    );
    event RecoveryRouteRemoved(bytes32 indexed routeId);
    event AllowedSourceSet(address indexed source, bool allowed);
    event TopUpFeasibleSet(bytes32 indexed surfaceId, bool feasible);
    event MinimumDelaySet(uint32 seconds_);
    event SecurityPerimeterPausedSet(bool paused);
    event NativePusherSet(address indexed pusher);
    event SurplusSwept(address indexed token, address indexed to, uint256 amount);

    // ─── Custom errors ───────────────────────────────────────────

    error UnregisteredSource(address caller); //  onlyAllowedSource — DISTINCT record-path halt selector
    error ActorBlocked(address actor, BlockState state); // execution-gate revert (event: AccountBlocked)
    error NotExecutor(address caller); //         msg.sender ∉ {originator, owner}
    error NotUnlocked(uint256 id, uint64 unlockAt);
    error QueuePaused();
    error AlreadyTerminal(uint256 id); //         status != Queued at a transition (also duplicate-batch-id)
    error UnknownRequest(uint256 id);
    error DelayBelowFloor(uint32 delay, uint32 floor);
    error AmountTooLarge(uint256 amount); //      uint256→uint128 narrowing guard
    error AmountMismatch(uint256 msgValue, uint256 amount); // native value-carrying
    error ReceivedAmountMismatch(address token, uint256 have, uint256 want); // pull / measured-delta proof
    error ZeroAmount();
    error RouteInactive(bytes32 routeId);
    error RouteProvenanceMismatch(uint256 id, bytes32 routeId);
    error TopUpInfeasibleSurface(bytes32 surfaceId); // setRecoveryRoute topUpPool guard
    error SourceNotBlacklisted(address src); //   Leg-2 OR-predicate not satisfied
    error NotBlacklisted(address a); //           unblacklist on a non-Blacklisted address
    error NotFrozen(address a); //                unfreeze on a non-Frozen address
    error NotResolvableBySIP(uint256 id); //      Leg-3 bounded predicate not satisfied
    error UnwrapNonWrbtc(); //                    unwrapOnDelivery set on a non-WRBTC token
    error InvalidAltReceiver(address altReceiver); // recoverStuckExit altReceiver ∈ {0,this,token,wrbtc}
    error SelfOnly(); //                          payoutExternal trampoline is self-call-only
    error ZeroAddress();
    error EmptyIds();
    error SweepToZero();
    error SolvencyViolated(); //                  post-sweep balance < totalEscrowed

    // ─── Ingress ─────────────────────────────────────────────────

    /// @dev CALLER-SIDE NARROWING PRECONDITION. Every
    ///      `record*` takes `amount` as a **`uint128`**, deliberately NOT widened
    ///      to `uint256`. The Perimeter hook computes the user leg as a `uint256` and
    ///      MUST narrow it (`uint128(userAmount)`) at the call site; that narrowing
    ///      is the caller's responsibility and MUST be preceded by the caller's own
    ///      `require(userAmount <= type(uint128).max)` (`AmountTooLarge`) so a value
    ///      that would silently truncate is rejected UPSTREAM, before any escrow
    ///      accounting. The queue keeps `AmountTooLarge` as a defensive
    ///      queue-boundary guard on the narrowing path — it is NOT dead code: it is
    ///      the last line of defense if a caller ever omits its own check. Keeping
    ///      the ABI at `uint128` also packs `amount` into `ExitRequest` word 1 —
    ///      widening would cost a whole extra storage word per request.

    function recordERC20Exit(
        address token,
        uint128 amount,
        uint32 delaySeconds,
        bytes32 surfaceId,
        address subProduct,
        address effOrig,
        address effOwner,
        address receiver,
        bool unwrapOnDelivery
    ) external returns (uint256 id);

    function recordReceivedERC20Exit(
        address token,
        uint128 amount,
        uint32 delaySeconds,
        bytes32 surfaceId,
        address subProduct,
        address effOrig,
        address effOwner,
        address receiver
    ) external returns (uint256 id);

    function recordNativeExit(
        uint128 amount,
        uint32 delaySeconds,
        bytes32 surfaceId,
        address subProduct,
        address effOrig,
        address effOwner,
        address receiver
    ) external payable returns (uint256 id);

    function recordReceivedNativeExit(
        uint128 amount,
        uint32 delaySeconds,
        bytes32 surfaceId,
        address subProduct,
        address effOrig,
        address effOwner,
        address receiver
    ) external returns (uint256 id);

    // ─── Execution ───────────────────────────────────────────────

    function executeExit(uint256 requestId) external;

    function executeExits(uint256[] calldata ids) external;

    /// @notice Verify-by-attempting stuck-exit recovery. Callable ONLY by the
    ///         frozen-metadata `{originator, owner}` set (same as `executeExit`; the
    ///         receiver is NEVER an executor). Requires the request Queued, unlocked,
    ///         and the queue not paused.
    ///
    ///         Attempts the STORED-receiver payout FIRST; pays `altReceiver` ONLY if
    ///         the stored-receiver payout genuinely bounces — so a HEALTHY exit is
    ///         never redirected (no arbitrary redirect)
    ///         and there is NO stored failure flag. If `altReceiver` also fails, the
    ///         whole call reverts (funds stay Queued).
    ///
    ///         Block gate covers ALL FOUR actors — `{originator, owner, STORED
    ///         receiver, altReceiver}`: a blocked/hacked original receiver refuses
    ///         recovery entirely (→ Leg-3), so the blacklist trap is preserved
    ///         rather than turned into an escape hatch. `altReceiver` is
    ///         guarded: reverts if it is
    ///         `0`, this contract, the request token, or WRBTC. The stored request is
    ///         NEVER re-targeted (`altReceiver` is a payout-time destination only), so
    ///         request immutability and the block gate still hold.
    function recoverStuckExit(uint256 id, address altReceiver) external;

    // ─── Block model ─────────────────────────────────────────────

    function freezeFromRequest(
        uint256 requestId,
        bool freezeReceiver,
        bytes32 reasonHash
    ) external;
    function blacklistFromRequest(
        uint256 requestId,
        bool freezeReceiver,
        bytes32 reasonHash
    ) external;

    // Batch by-request-id — whole-batch atomic (one bad
    // id reverts all, like executeExits); last-write-wins trigger/reason per account.
    function freezeFromRequest(
        uint256[] calldata requestIds,
        bool freezeReceiver,
        bytes32 reasonHash
    ) external;
    function blacklistFromRequest(
        uint256[] calldata requestIds,
        bool freezeReceiver,
        bytes32 reasonHash
    ) external;

    function freeze(address a) external;
    function blacklist(address a) external;
    function unfreeze(address a) external;
    function unblacklist(address a) external;

    // Batch by-address: each reverts `EmptyIds()` on
    // an empty array, for API consistency with the by-id batch variants
    // (`executeExits` / batch `freezeFromRequest` / `resolveToProtocol` /
    // `resolveBySIP`) — an empty batch is a caller mistake, never a silent no-op.
    function freeze(address[] calldata a) external;
    function blacklist(address[] calldata a) external;
    function unfreeze(address[] calldata a) external;
    function unblacklist(address[] calldata a) external;

    // ─── Pause ───────────────────────────────────────────────────

    function setSecurityPerimeterPaused(bool p) external;

    // ─── Recovery ────────────────────────────────────────────────

    function resolveToProtocol(uint256[] calldata ids, bytes32 routeId) external;
    function resolveBySIP(uint256[] calldata ids, address destination) external;

    function setRecoveryRoute(RecoveryRoute calldata route) external returns (bytes32 routeId);
    function removeRecoveryRoute(bytes32 routeId) external;
    function setTopUpFeasible(bytes32 surfaceId, bool feasible) external;

    // ─── Config ──────────────────────────────────────────────────

    function addAllowedSource(address src) external;
    function removeAllowedSource(address src) external;
    function setNativePusher(address pusher) external;
    function setMinimumDelaySeconds(uint32 s) external;
    function sweepSurplus(address token, address to) external;

    // ─── Views ───────────────────────────────────────────────────

    function getRequest(uint256 id) external view returns (ExitRequest memory);
    function getActive(
        address party,
        uint256 cursor,
        uint256 n
    ) external view returns (uint256[] memory ids, uint256 nextCursor);
    function blockStateOf(address a) external view returns (BlockState);

    /// @notice Paginate the blocked set (Frozen ∪ Blacklisted).
    /// @param offset First index into the blocked set to return.
    /// @param limit  Requested page size; clamped to `MAX_GET_ACTIVE_PAGE` (500).
    /// @return page  The clamped slice `[offset, offset + page.length)` of the
    ///               blocked set (empty when `offset >= total` or `limit == 0`).
    /// @return total The FULL blocked-set size (EnumerableSet length), independent
    ///               of `offset`/`limit` — so a caller/monitor knows the whole
    ///               range ("showing offset..offset+page.length of total") and
    ///               never silently undercounts past the 500-entry page cap
    function blockedAccounts(
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory page, uint256 total);
    function blockTrigger(address a) external view returns (uint256);

    function totalEscrowed(address token) external view returns (uint256);
    function getRecoveryRoute(bytes32 routeId) external view returns (RecoveryRoute memory);
    function allowedSources() external view returns (address[] memory);

    /// @notice Max page size for the paginated `getActive` / `blockedAccounts`
    ///         views. Public constant, so paging is
    ///         self-describing on-chain (500).
    function MAX_GET_ACTIVE_PAGE() external view returns (uint256);
}
