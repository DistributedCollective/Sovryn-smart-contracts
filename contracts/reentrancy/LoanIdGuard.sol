pragma solidity ^0.5.17;

import "./LoanIdMutex.sol";

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
contract LoanIdGuard {
    /**
     * @notice The address of the LoanIdMutex contract.
     *
     * @dev Hardcoded to avoid changing the memory layout of derived contracts.
     * The LoanIdMutex is deployed to the same address on all networks using
     * deterministic deployment (similar to ERC1820Registry).
     *
     * @dev Internal visibility allows derived contracts to access it directly when needed
     * (e.g., in LoanOpenings.sol where the loanId is created dynamically).
     */
    LoanIdMutex internal constant LOAN_ID_MUTEX =
        LoanIdMutex(0x6B8F44710CdCC7D5A5F60a3665F7B181Cda7ED27);

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
        LOAN_ID_MUTEX.checkAndToggle(loanId);

        // Execute the function
        _;

        // No cleanup needed - block.number naturally differs in the next block
    }
}
