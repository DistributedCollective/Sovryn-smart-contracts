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
    /// keccak256("sovryn.perimeterExitFeeController") - 1
    bytes32 internal constant EXIT_FEE_CONTROLLER_SLOT =
        bytes32(uint256(keccak256("sovryn.perimeterExitFeeController")) - 1);

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
    /// keccak256("sovryn.perimeterBorrowerExitOps") - 1
    bytes32 internal constant BORROWER_EXIT_PERIMETER_OPS_SLOT =
        bytes32(uint256(keccak256("sovryn.perimeterBorrowerExitOps")) - 1);

    /// @notice Read the pinned charge-hook address (address(0) until pinned).
    ///         Inlined `sload` against the caller's storage.
    function getBorrowerExitOps() internal view returns (address ops) {
        bytes32 slot = BORROWER_EXIT_PERIMETER_OPS_SLOT;
        assembly {
            ops := sload(slot)
        }
    }

    /// @notice Write the charge-hook pointer (caller owns auth + the event).
    function setBorrowerExitOps(address ops) internal {
        bytes32 slot = BORROWER_EXIT_PERIMETER_OPS_SLOT;
        assembly {
            sstore(slot, ops)
        }
    }

    /// @notice Fail-open read of `host`'s pinned controller via its public
    ///         `exitFeeController()` view. Any abnormal outcome — no code at
    ///         `host`, unregistered selector, short/long return — yields
    ///         address(0), which `safeQuote` treats as "skip", so the lookup
    ///         can never block an exit.
    function safeControllerLookup(address host) internal view returns (address) {
        (bool ok, bytes memory ret) = host.staticcall(
            abi.encodeWithSignature("exitFeeController()")
        );
        if (ok && ret.length == 32) {
            return abi.decode(ret, (address));
        }
        return address(0);
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
