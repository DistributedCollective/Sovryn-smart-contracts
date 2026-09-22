// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

/// @notice An address that refuses every native payment, for staging a QA-fork
///         withdrawal whose payout cannot be delivered. Reverts in its
///         fallback, and holds no token-transfer hook, so an ERC20 payout to
///         it succeeds — the native-RBTC payout path is the one the
///         stuck-payout exception procedure exists to be rehearsed against.
contract MockBouncingReceiver {
    function() external payable {
        revert("MockBouncingReceiver: refuses payment");
    }
}
