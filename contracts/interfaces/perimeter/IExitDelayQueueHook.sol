// SPDX-License-Identifier: MIT
// ─────────────────────────────────────────────────────────────────────────────
// Cross-pragma ingress stub for `ExitDelayQueue` (the security-perimeter delay
// queue). The FULL interface + type/event/error catalog lives in
// `IExitDelayQueue.sol` (0.8.20, provenance-locked to
// DistributedCollective/perimeter @ 51457b21). This stub declares ONLY the members
// the 0.5.17 lending + borrower/margin product hooks actually call, so it can be
// imported under the range pragma the product repos compile with.
//
// The four `record*` signatures here are byte-for-byte identical to the FINAL
// ones in `IExitDelayQueue.sol`. Do NOT diverge — the queue's
// IExitDelayQueue is final.
// ─────────────────────────────────────────────────────────────────────────────
// aderyn-ignore-next-line(unspecific-solidity-pragma)
pragma solidity >=0.5.17 <0.9.0;

/// @title  IExitDelayQueueHook
/// @notice The minimal ingress surface the product hooks reach on the queue when
///         the controller quote returns `d > 0`. All ingress is
///         `onlyAllowedSource` on the queue (the record-CALLER must be a
///         registered source): the iToken proxy for lending, the `sovrynProtocol`
///         singleton for borrower/margin. Never called until `d > 0` is
///         established off-queue.
interface IExitDelayQueueHook {
    /// @notice ERC20 pull ingress (preferred; also the WRBTC path). The queue does
    ///         `safeTransferFrom(msg.sender, address(this), amount)` and requires
    ///         the measured received amount == `amount`. `unwrapOnDelivery` is
    ///         guarded to `token == WRBTC` at the queue boundary; set it true only
    ///         for lending `burnToBTC` (escrow WRBTC, unwrap → native at delivery).
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

    /// @notice ERC20 measured-delta ingress: the source PUSHES `amount` to the
    ///         queue first, then records in the SAME outer transaction. The queue
    ///         measures `delta = balanceOf(token) - totalEscrowed[token]`, requires
    ///         `delta >= amount`, and credits EXACTLY `amount`. Used by the
    ///         borrower/margin surface (push via `vaultWithdraw` then record).
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

    /// @notice Native value-carrying ingress: `require(msg.value == amount)`;
    ///         token is implicitly `address(0)`.
    function recordNativeExit(
        uint128 amount,
        uint32 delaySeconds,
        bytes32 surfaceId,
        address subProduct,
        address effOrig,
        address effOwner,
        address receiver
    ) external payable returns (uint256 id);

    /// @notice Native measured-receipt ingress: the native RBTC is pushed to the
    ///         queue's `receive()` first (e.g. `vaultEtherWithdraw(queue, amount)`),
    ///         then recorded in the SAME outer transaction. The queue measures
    ///         `delta = address(this).balance - totalEscrowed[address(0)]`, requires
    ///         `delta >= amount`, and credits EXACTLY `amount`. Used by the
    ///         borrower/margin native-collateral path.
    function recordReceivedNativeExit(
        uint128 amount,
        uint32 delaySeconds,
        bytes32 surfaceId,
        address subProduct,
        address effOrig,
        address effOwner,
        address receiver
    ) external returns (uint256 id);
}
