pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./LoanClosingsWithMockup.sol";

contract LoanClosingsWithoutInvariantCheck is LoanClosingsWithMockup {
    /** Override the modifier of invariant check so that we can test the shared reentrancy guard */
    modifier iTokenSupplyUnchanged(bytes32 loanId) {
        _;
    }

    function initialize(address target) external onlyOwner {
        address prevModuleContractAddress = logicTargets[this.closeWithDeposit.selector];
        _setTarget(this.closeWithDeposit.selector, target);
        _setTarget(this.closeWithSwap.selector, target);
        _setTarget(this.checkCloseWithDepositIsTinyPosition.selector, target);
        emit ProtocolModuleContractReplaced(prevModuleContractAddress, target, "LoanClosingsWith");
    }
}
