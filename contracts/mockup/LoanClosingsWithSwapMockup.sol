pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../modules/LoanClosingsWithSwap.sol";

/**
 * @dev The swap-close counterpart of `LoanClosingsWithMockup`.
 *
 * `closeWithSwap` lives in its own module, so a test that registers only the
 * deposit-close mockup leaves the swap path on the real implementation and
 * silently exercises different behaviour. The mockup pair has to follow the
 * module pair.
 */
contract LoanClosingsWithSwapMockup is LoanClosingsWithSwap {
    function _worthTheTransfer(address, uint256) internal returns (bool) {
        return true;
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
