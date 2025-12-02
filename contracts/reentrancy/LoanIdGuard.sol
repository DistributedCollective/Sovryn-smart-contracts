pragma solidity ^0.5.17;

import "../core/State.sol";

/**
 * @title Abstract contract for loan ID-specific reentrancy guards
 *
 * @notice Exposes a modifier `loanIdNonReentrant` that prevents the same loan ID
 * from being operated on multiple times within the same block.
 *
 * @dev This prevents exploits where an attacker:
 * 1. Opens a loan to manipulate protocol state (e.g., inflate interest rates)
 * 2. Operates on the same loan again in the same transaction (or same block)
 * 3. Takes advantage of the manipulated state
 *
 * The LoanIdMutex contract address is hardcoded to a deterministically deployed address.
 * This contract has no state and is safe to add to the inheritance chain of upgradeable contracts.
 */
contract LoanIdGuard is State {
    function checkAndToggle(bytes32 loanId) internal {
        uint256 lastBlock = loanIdToBlockNumber[loanId];

        // Revert if loan was operated on in the current block
        require(lastBlock != block.number, "loan ID already used in this block");

        // Mark the loan as operated on in this block
        loanIdToBlockNumber[loanId] = block.number;
    }

    /**
     * @notice This modifier protects functions from being called multiple times on
     * the same loan ID within the same block.
     *
     * @dev Uses block.number tracking in LoanIdMutex. Reverts if the loan was
     * already operated on in the current block. This prevents flash loan attacks
     * where a loan is created and closed in the same transaction.
     *
     * Note: This also prevents multiple operations on the same loan in different
     * transactions within the same block, which is an acceptable trade-off for security.
     *
     * @param loanId The ID of the loan being operated on.
     */
    modifier loanIdNonReentrant(bytes32 loanId) {
        // Check and mark that this loan is being operated on in this block
        // Reverts if already operated on in this block
        checkAndToggle(loanId);

        // Execute the function
        _;

        // No cleanup needed - block.number naturally differs in the next block
    }
}
