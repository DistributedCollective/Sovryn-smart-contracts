pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./LoanClosingsWithSwapMockup.sol";

/**
 * @dev The swap-close counterpart of `LoanClosingsWithoutInvariantCheck`:
 *      drops the iToken supply invariant so the shared reentrancy guard is the
 *      thing under test, rather than the invariant catching the attempt first.
 */
contract LoanClosingsWithSwapWithoutInvariantCheck is LoanClosingsWithSwapMockup {
    /** Override the modifier of invariant check so that we can test the shared reentrancy guard */
    modifier iTokenSupplyUnchanged(bytes32 loanId) {
        _;
    }

    function initialize(address target) external onlyOwner {
        address prevModuleContractAddress = logicTargets[this.closeWithSwap.selector];
        _setTarget(this.closeWithSwap.selector, target);
        emit ProtocolModuleContractReplaced(
            prevModuleContractAddress,
            target,
            "LoanClosingsWithSwap"
        );
    }
}
