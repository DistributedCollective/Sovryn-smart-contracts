pragma solidity ^0.5.17;

import "../reentrancy/LoanIdMutex.sol";

/**
 * @title Helper contract to test LoanIdMutex same-block protection
 * @notice This contract calls checkAndToggle twice in a single transaction
 * to verify that the mutex properly blocks same-block operations
 */
contract LoanIdMutexTester {
    LoanIdMutex public loanIdMutex;

    constructor(address _loanIdMutex) public {
        loanIdMutex = LoanIdMutex(_loanIdMutex);
    }

    /**
     * @notice Attempts to call checkAndToggle twice on the same loan ID
     * @dev This should revert on the second call since both are in the same transaction/block
     */
    function doubleCheckAndToggle(bytes32 loanId) external {
        loanIdMutex.checkAndToggle(loanId);
        loanIdMutex.checkAndToggle(loanId); // This should revert
    }
}
