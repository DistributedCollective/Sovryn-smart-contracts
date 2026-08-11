// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.6.0;

/// @title  IColFeeEvents
/// @notice Canonical declaration of the ColFee product-side events. Inherited
///         by every emitter and product ABI so the shape is defined once and
///         `topic0` can't drift.
interface IColFeeEvents {
    /// @notice Emitted when the ExitFeeController pointer is pinned or rotated.
    event ExitFeeControllerSet(address indexed previous, address indexed current);

    /// @notice Emitted when the borrower-exit charge-hook pointer is pinned or
    ///         rotated.
    event ColFeeBorrowerExitOpsSet(address indexed previous, address indexed current);

    event ExitFeeApplied(
        bytes32 indexed surfaceId,
        address indexed actor,
        address indexed asset,
        address subProduct,
        address recipient,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 netAmount,
        address feeReceiver
    );

    event ExitFeeSkipped(
        bytes32 indexed surfaceId,
        address indexed actor,
        address indexed asset,
        uint256 grossAmount,
        uint16 rateBps,
        uint8 reason
    );
}
