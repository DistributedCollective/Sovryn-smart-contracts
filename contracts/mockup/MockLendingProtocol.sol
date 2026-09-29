// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

/**
 * The two reads a task makes on the protocol to list its lending pools: the
 * paged pool list and each pool's underlying asset. Pools are set directly by
 * the test; no predicate of the real protocol is enforced here.
 */
contract MockLendingProtocol {
    mapping(address => address) public loanPoolToUnderlying;
    address[] private pools;

    /// @notice Set a pool's underlying asset; the zero address removes the pool.
    function setLoanPool(address pool, address underlying) external {
        bool listed = false;
        uint256 at = 0;
        for (uint256 i = 0; i < pools.length; i++) {
            if (pools[i] == pool) {
                listed = true;
                at = i;
                break;
            }
        }
        loanPoolToUnderlying[pool] = underlying;
        if (underlying == address(0)) {
            if (listed) {
                pools[at] = pools[pools.length - 1];
                pools.length--;
            }
        } else if (!listed) {
            pools.push(pool);
        }
    }

    function getLoanPoolsList(
        uint256 start,
        uint256 count
    ) external view returns (bytes32[] memory) {
        uint256 end = start + count;
        if (end > pools.length) end = pools.length;
        if (start >= end) return new bytes32[](0);
        bytes32[] memory out = new bytes32[](end - start);
        for (uint256 i = start; i < end; i++) {
            out[i - start] = bytes32(uint256(pools[i]));
        }
        return out;
    }
}
