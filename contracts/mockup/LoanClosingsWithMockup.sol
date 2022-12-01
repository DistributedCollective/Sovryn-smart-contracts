pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../modules/LoanClosingsWith.sol";

contract LoanClosingsWithMockup is LoanClosingsWith {
    function worthTheTransfer(address, uint256) internal returns (bool) {
        return true;
    }

    function initialize(address target) external onlyOwner {
        address prevModuleContractAddress = logicTargets[this.closeWithDeposit.selector];
        _setTarget(this.closeWithDeposit.selector, target);
        _setTarget(this.closeWithSwap.selector, target);
        _setTarget(this.checkCloseWithDepositIsTinyPosition.selector, target);
        emit ProtocolModuleContractReplaced(prevModuleContractAddress, target, "LoanClosingsWith");
    }
}
