// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

/// @title MoC-Medianizer-shaped dummy that always reports "no value".
///
/// Intended to be installed as `mocOracleAddress` on an MoC-wrapper adapter
/// (e.g. the shared RBTC sub-oracle at 0x4106e4Bb0C339cf7e8adc64Cf889F261Fef1e789)
/// as a break-glass lever: the wrapping adapter's `latestAnswer()` reverts
/// (or returns 0 depending on implementation) because `peek()` reports the
/// feed as unavailable. Downstream V2 pool oracles then revert on rate
/// queries, halting all swaps on the pools that consume that adapter.
/// LP deposits/withdrawals are unaffected — they use staked-balance math.
contract DummyMoCMedianizer {
    function peek() external pure returns (bytes32, bool) {
        return (bytes32(0), false);
    }
}
