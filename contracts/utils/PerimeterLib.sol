// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../interfaces/perimeter/IExitFeeController.sol";

/// @title  PerimeterLib
/// @notice Storage-free Perimeter plumbing: the controller/ops slot accessors and
///         the quote helpers. `internal` functions are inlined into the caller,
///         so the slot accessors operate on the caller's storage and the
///         library is never deployed.
library PerimeterLib {
    // ─── Controller pointer ─────────────────────────────────────────────────

    /// @notice EIP-1967-style unstructured slot where each consumer pins its
    ///         ExitFeeController. Defined once here so the getter and setter
    ///         can never drift onto different slots.
    /// keccak256("sovryn.exitFeeController") - 1
    bytes32 internal constant EXIT_FEE_CONTROLLER_SLOT =
        bytes32(uint256(keccak256("sovryn.exitFeeController")) - 1);

    /// @notice Read the calling contract's pinned controller from the shared
    ///         slot (address(0) until the owner pins one). Inlined, so the
    ///         `sload` targets the caller's storage.
    function getController() internal view returns (address ctrl) {
        bytes32 slot = EXIT_FEE_CONTROLLER_SLOT;
        assembly {
            ctrl := sload(slot)
        }
    }

    /// @notice Write the calling contract's controller pointer. The caller
    ///         owns authorization, the `Address.isContract` guard, and the
    ///         `ExitFeeControllerSet` event; this performs only the slot write
    ///         (inlined into the caller's storage).
    function setController(address ctrl) internal {
        bytes32 slot = EXIT_FEE_CONTROLLER_SLOT;
        assembly {
            sstore(slot, ctrl)
        }
    }

    // ─── Borrower-exit Ops pointer ──────────────────────────────────────────

    /// @notice EIP-1967-style unstructured slot holding the borrower-exit
    ///         charge-hook (`BorrowerExitPerimeterOps`) address.
    /// @dev The literal below is a deployed storage slot: the borrower-exit
    ///      hook pointer already written at this address on mainnet. Its old
    ///      spelling is load-bearing — rewriting the string moves the slot and
    ///      orphans the pointer. Do not "finish the rename" here.
    /// keccak256("sovryn.colFeeBorrowerExitOps") - 1
    bytes32 internal constant COLFEE_BORROWER_EXIT_OPS_SLOT =
        bytes32(uint256(keccak256("sovryn.colFeeBorrowerExitOps")) - 1);

    /// @notice Read the pinned charge-hook address (address(0) until pinned).
    ///         Inlined `sload` against the caller's storage.
    function getBorrowerExitOps() internal view returns (address ops) {
        bytes32 slot = COLFEE_BORROWER_EXIT_OPS_SLOT;
        assembly {
            ops := sload(slot)
        }
    }

    /// @notice Write the charge-hook pointer (caller owns auth + the event).
    function setBorrowerExitOps(address ops) internal {
        bytes32 slot = COLFEE_BORROWER_EXIT_OPS_SLOT;
        assembly {
            sstore(slot, ops)
        }
    }

    /// @notice Fail-open read of `host`'s pinned controller via its public
    ///         `exitFeeController()` view. Any abnormal outcome — no code at
    ///         `host`, unregistered selector, short/long return — yields
    ///         address(0), which `safeQuote` treats as "skip", so the lookup
    ///         can never block an exit.
    ///
    /// @dev    POINTER lookup is FAIL-OPEN, QUOTE is FAIL-CLOSED.
    ///         This is a deliberate, documented split:
    ///           • A missing/unreachable controller POINTER (address(0) here)
    ///             skips BOTH the fee and the delay reroute and pays direct —
    ///             mirroring the fee path. A fail-CLOSED read-through would
    ///             brick EVERY lender exit on a botched module rotation, so the
    ///             pointer read must never revert.
    ///           • Once a controller IS reachable, the delay QUOTE
    ///             (`safeQuoteDelay` → `quoteExitDelayFor`) stays FAIL-CLOSED
    ///             a quote that reverts reverts the whole exit, so
    ///             an active perimeter can never be silently bypassed.
    ///         Accepted residual: a missing pointer silently disables the
    ///         perimeter for that host until governance re-pins it. This is NOT
    ///         attacker-reachable (setting the pointer is an Owner/SIP action)
    ///         and is covered by the go-live wiring assertion plus
    ///         off-chain pointer monitoring.
    function safeControllerLookup(address host) internal view returns (address) {
        (bool ok, bytes memory ret) = host.staticcall(
            abi.encodeWithSignature("exitFeeController()")
        );
        if (ok && ret.length == 32) {
            return abi.decode(ret, (address));
        }
        return address(0);
    }

    // ─── Exit-delay queue pointer (security perimeter) ──────────────────────

    /// @notice EIP-1967-style unstructured slot where each product storage host
    ///         pins its ExitDelayQueue. Because the queue pointer redirects
    ///         ESCROW it is MORE sensitive than the controller pointer — rotation
    ///         is an Owner/SIP action. Defined once so the
    ///         getter and setter can never drift onto different slots.
    /// keccak256("sovryn.exitDelayQueue") - 1
    bytes32 internal constant EXIT_DELAY_QUEUE_SLOT =
        bytes32(uint256(keccak256("sovryn.exitDelayQueue")) - 1);

    /// @notice Read the calling contract's pinned queue from the shared slot
    ///         (address(0) until governance pins one). An unwired queue pays
    ///         direct ONLY when the perimeter quotes `d == 0`; once `d > 0` the
    ///         caller must escrow, so an unresolvable queue fails CLOSED (the
    ///         exit reverts) — a delay can never be silently bypassed by an
    ///         unwired pointer. Inlined, so the `sload` targets the caller's
    ///         storage.
    function getExitDelayQueue() internal view returns (address queue) {
        bytes32 slot = EXIT_DELAY_QUEUE_SLOT;
        assembly {
            queue := sload(slot)
        }
    }

    /// @notice Write the calling contract's queue pointer (caller owns auth, the
    ///         `Address.isContract` guard, and the event). Inlined into the
    ///         caller's storage.
    function setExitDelayQueue(address queue) internal {
        bytes32 slot = EXIT_DELAY_QUEUE_SLOT;
        assembly {
            sstore(slot, queue)
        }
    }

    /// @notice Fail-open read of `host`'s pinned queue via its public
    ///         `exitDelayQueue()` view. Any abnormal outcome (no code at `host`,
    ///         unregistered selector, short/long return) yields address(0). The
    ///         lookup itself is view-only and never touches the queue, so it
    ///         cannot brick anything; but note that a resulting address(0) pays
    ///         direct ONLY when the perimeter quotes `d == 0`. When `d > 0` the
    ///         caller escrows, so an unresolvable queue then fails CLOSED at the
    ///         escrow step (the exit reverts until the queue is wired) — an
    ///         unwired queue cannot silently bypass an active delay.
    function safeQueueLookup(address host) internal view returns (address) {
        (bool ok, bytes memory ret) = host.staticcall(abi.encodeWithSignature("exitDelayQueue()"));
        if (ok && ret.length == 32) {
            return abi.decode(ret, (address));
        }
        return address(0);
    }

    // ─── Delay quote (per-pragma safe-quote wrapper) ────────────────────────

    /// @notice Fail-CLOSED delay quote: `quoteExitDelayFor` via `staticcall`
    ///         (0.5.17 has no try/catch). A staticcall FAILURE reverts the exit —
    ///         it MUST NOT be interpreted as `d = 0`-direct (that would silently
    ///         disable the perimeter — the hazard this guards against). The
    ///         `!securityPerimeterEnabled` short-circuit is the FIRST statement
    ///         inside `quoteExitDelayFor`, so a
    ///         healthy-but-disabled perimeter returns `(0, raw, owner)` normally
    ///         (liveness); only a fully-bricked controller (bad upgrade) is
    ///         unescapable, and the go-live gates cover it.
    ///
    ///         The return is decoded word-wise (three static words) and each is
    ///         bounds-checked, mirroring `safeQuote`'s defensive decode so a
    ///         malformed controller return reverts loudly (fail-closed) rather than
    ///         mis-escrowing.
    /// @param  ctrl The caller's pinned ExitFeeController (address(0) ⇒ perimeter
    ///              unwired ⇒ direct pay, d = 0).
    function safeQuoteDelay(
        address ctrl,
        address rawOriginator,
        address owner,
        address receiver,
        bytes32 surfaceId,
        address subProduct
    ) internal view returns (uint32 d, address effOrig, address effOwner) {
        // No controller pinned ⇒ perimeter is unwired; pay direct (d = 0). Raw
        // identities are returned but the hook ignores them when d == 0.
        if (ctrl == address(0)) {
            return (0, rawOriginator, owner);
        }
        (bool ok, bytes memory ret) = ctrl.staticcall(
            abi.encodeWithSelector(
                IExitFeeController(ctrl).quoteExitDelayFor.selector,
                rawOriginator,
                owner,
                receiver,
                surfaceId,
                subProduct
            )
        );
        // FAIL-CLOSED: a staticcall failure or a short/malformed return reverts
        // the exit. 3 static words = 96 bytes (uint32 d, address effOrig,
        // address effOwner). Decode as RAW WORDS then bounds-check each — a
        // uint256-tuple decode cannot revert on any >= 96-byte payload, so we
        // control the revert reason instead of letting the validating decoder
        // brick the exit with an opaque panic.
        require(ok && ret.length >= 96, "PERIMETER:delay-quote-failed");
        (uint256 rawD, uint256 rawOrig, uint256 rawOwner) = abi.decode(
            ret,
            (uint256, uint256, uint256)
        );
        require(
            rawD <= 0xffffffff && rawOrig >> 160 == 0 && rawOwner >> 160 == 0,
            "PERIMETER:delay-quote-malformed"
        );
        d = uint32(rawD);
        effOrig = address(uint160(rawOrig));
        effOwner = address(uint160(rawOwner));
    }

    // ─── Quote ──────────────────────────────────────────────────────────────

    /// @notice Quote the fee for an exit, failing open on any non-ideal
    ///         outcome (controller not pinned, controller revert, short
    ///         return). Solidity 0.5.17 has no `try/catch`, so the only way
    ///         to keep the burn/exit alive when the controller misbehaves is
    ///         to go through `staticcall` rather than a direct interface call.
    ///         Semantic validation of the returned quote lives in
    ///         `quoteIsValid`, not here.
    /// @param ctrl The caller's pinned ExitFeeController (address(0) => skip).
    function safeQuote(
        address ctrl,
        bytes32 surfaceId,
        address subProduct,
        address actor,
        uint256 gross
    ) internal view returns (IExitFeeController.ExitFeeQuote memory q) {
        if (ctrl != address(0)) {
            (bool ok, bytes memory ret) = ctrl.staticcall(
                abi.encodeWithSelector(
                    IExitFeeController(ctrl).quoteExitFee.selector,
                    surfaceId,
                    subProduct,
                    actor,
                    gross
                )
            );
            // 6 static fields × 32 bytes = 192-byte canonical encoding of
            // `(ExitFeeQuote)`. Decode as RAW WORDS first — a uint256-tuple
            // decode cannot revert on any >= 192-byte payload — then bounds-
            // check each word for its target type. Decoding the struct
            // directly would let the 0.5.17 validating decoder revert on a
            // non-canonical word (bool > 1, dirty uint16/address upper bits),
            // and on the inline iToken path that revert would brick the burn
            // instead of failing open. Malformed words route to
            // CONTROLLER_REVERT below; extra trailing bytes are tolerated; a
            // short return is rejected by the length gate.
            if (ok && ret.length >= 192) {
                (
                    uint256 rawActive,
                    uint256 rawRateBps,
                    uint256 feeAmount,
                    uint256 netAmount,
                    uint256 rawReceiver,
                    uint256 rawReason
                ) = abi.decode(ret, (uint256, uint256, uint256, uint256, uint256, uint256));
                if (
                    rawActive <= 1 &&
                    rawRateBps <= 0xffff &&
                    rawReceiver >> 160 == 0 &&
                    rawReason <= 0xff
                ) {
                    q.active = rawActive == 1;
                    q.rateBps = uint16(rawRateBps);
                    q.feeAmount = feeAmount;
                    q.netAmount = netAmount;
                    q.feeReceiver = address(uint160(rawReceiver));
                    q.reason = uint8(rawReason);
                    return q;
                }
            }
        }
        // Fail open: pretend the controller returned an inactive quote.
        q.netAmount = gross;
        q.reason = uint8(IExitFeeController.SkipReason.CONTROLLER_REVERT);
    }

    /// @dev Defensive sanity-check on a quote returned by the (upgradable,
    ///      external) controller. A misconfigured or hostile controller could
    ///      overpay from pool liquidity, send fee value to address(0), or
    ///      desync net+fee from gross. Failure routes to INVALID_QUOTE.
    function quoteIsValid(
        IExitFeeController.ExitFeeQuote memory q,
        uint256 gross
    ) internal pure returns (bool) {
        if (q.feeReceiver == address(0)) return false;
        if (q.feeAmount > gross) return false;
        // `gross - q.feeAmount` cannot underflow because of the check above.
        // Phrasing the invariant as "net == gross - fee" instead of
        // "fee + net == gross" avoids the unchecked addition that 0.5.17
        // would otherwise allow to wrap.
        if (q.netAmount != gross - q.feeAmount) return false;
        if (q.rateBps > 10_000) return false;
        return true;
    }
}
