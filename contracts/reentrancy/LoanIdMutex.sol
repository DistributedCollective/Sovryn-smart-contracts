pragma solidity ^0.5.17;

/**
 * @title Loan ID Mutex contract
 *
 * @notice A mutex contract that prevents multiple operations on the same loan ID
 * within the same block. This prevents exploits where an attacker manipulates
 * protocol state (like interest rates) and then operates on the same loan in the
 * same transaction to take advantage of the temporary state change.
 *
 * @dev Uses block.number to track when each loan ID was last operated on.
 * This blocks any operations on the same loan ID within the same block, whether
 * in the same transaction or different transactions. This is an acceptable trade-off
 * to prevent flash loan attacks.
 */
contract LoanIdMutex {
    /**
     * @notice Mapping from loan ID to the block number where it was last operated on.
     *
     * @dev 0 = never operated on
     *      non-zero = last operated in that block number
     */
    mapping(bytes32 => uint256) public loanIdToBlockNumber;

    /**
     * @notice Check and mark that a loan ID is being operated on in this block.
     *
     * @dev Reverts if the loan was already operated on in the current block.
     * This prevents both sequential operations in the same transaction AND
     * multiple transactions on the same loan in the same block.
     *
     * @param loanId The ID of the loan to check and mark.
     */
    function checkAndToggle(bytes32 loanId) external {
        uint256 lastBlock = loanIdToBlockNumber[loanId];

        // Revert if loan was operated on in the current block
        require(lastBlock != block.number, "loan ID already used in this block");

        // Mark the loan as operated on in this block
        loanIdToBlockNumber[loanId] = block.number;
    }

    /**
     * @notice Get the block number when a loan ID was last operated on.
     *
     * @param loanId The ID of the loan.
     * @return The block number (0 if never operated on).
     */
    function getBlockNumber(bytes32 loanId) external view returns (uint256) {
        return loanIdToBlockNumber[loanId];
    }
}
